package nomad

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"

	"github.com/hashicorp/nomad/api"
	"github.com/caravan-nomad/caravan/backend/pkg/auth"
	"github.com/caravan-nomad/caravan/backend/pkg/nomadconfig"
)

// Handler provides HTTP handlers for Nomad API endpoints
type Handler struct {
	configStore nomadconfig.ContextStore
	clients     map[string]*api.Client
	mutex       sync.RWMutex
}

// NewHandler creates a new Nomad handler
func NewHandler(configStore nomadconfig.ContextStore) *Handler {
	return &Handler{
		configStore: configStore,
		clients:     make(map[string]*api.Client),
	}
}

// GetClient returns a Nomad client for the given cluster
// It caches clients for reuse
func (h *Handler) GetClient(clusterName string) (*api.Client, error) {
	h.mutex.RLock()
	client, exists := h.clients[clusterName]
	h.mutex.RUnlock()

	if exists {
		return client, nil
	}

	ctx, err := h.configStore.GetContext(clusterName)
	if err != nil {
		return nil, err
	}

	client, err = ctx.GetClient()
	if err != nil {
		return nil, err
	}

	h.mutex.Lock()
	h.clients[clusterName] = client
	h.mutex.Unlock()

	return client, nil
}

// GetClientWithToken returns a Nomad client configured with the given token
// This does not cache the client as tokens may vary per request
func (h *Handler) GetClientWithToken(clusterName, token string) (*api.Client, error) {
	ctx, err := h.configStore.GetContext(clusterName)
	if err != nil {
		return nil, err
	}

	return ctx.GetClientWithToken(token)
}

// InvalidateClient removes a cached client for the given cluster
func (h *Handler) InvalidateClient(clusterName string) {
	h.mutex.Lock()
	defer h.mutex.Unlock()
	delete(h.clients, clusterName)
}

// getClusterName extracts the cluster name from the request using Go 1.22+ PathValue
func getClusterName(r *http.Request) string {
	return r.PathValue("cluster")
}

// getToken extracts the Nomad token from the request header, query param, or cookie
func getToken(r *http.Request) string {
	// Try X-Nomad-Token header first
	if token := r.Header.Get("X-Nomad-Token"); token != "" {
		return token
	}

	// Try query parameter (needed for EventSource/SSE which can't set headers)
	if token := r.URL.Query().Get("token"); token != "" {
		return token
	}

	// Fall back to HTTPOnly cookie
	cluster := getClusterName(r)
	if cluster != "" {
		if token, err := auth.GetTokenFromCookie(r, cluster); err == nil && token != "" {
			return token
		}
	}

	return ""
}

// writeJSON writes a JSON response
func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(data); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// writeError writes an error response
func writeError(w http.ResponseWriter, err error, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
}

// writeNomadError writes an error response with proper status code detection from Nomad errors
// This examines the error message to determine the appropriate HTTP status code
func writeNomadError(w http.ResponseWriter, err error) {
	errStr := err.Error()
	var status int

	switch {
	case contains403(errStr):
		status = http.StatusForbidden // 403
	case contains401(errStr):
		status = http.StatusUnauthorized // 401
	case strings.Contains(errStr, "not found") || strings.Contains(errStr, "Unknown"):
		status = http.StatusNotFound // 404
	case containsConnectionError(errStr):
		status = http.StatusBadGateway // 502
	default:
		status = http.StatusInternalServerError // 500
	}

	writeError(w, err, status)
}

// getQueryOptions extracts common query options from the request
func getQueryOptions(r *http.Request) *api.QueryOptions {
	q := r.URL.Query()
	opts := &api.QueryOptions{}

	if ns := q.Get("namespace"); ns != "" {
		opts.Namespace = ns
	}
	if region := q.Get("region"); region != "" {
		opts.Region = region
	}
	if prefix := q.Get("prefix"); prefix != "" {
		opts.Prefix = prefix
	}

	return opts
}

// getWriteOptions extracts common write options from the request
func getWriteOptions(r *http.Request) *api.WriteOptions {
	q := r.URL.Query()
	opts := &api.WriteOptions{}

	if ns := q.Get("namespace"); ns != "" {
		opts.Namespace = ns
	}
	if region := q.Get("region"); region != "" {
		opts.Region = region
	}

	return opts
}

// AuthHandler provides auth-related HTTP handlers
type AuthHandler struct {
	baseURL      string
	nomadHandler *Handler
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(baseURL string, nomadHandler *Handler) *AuthHandler {
	return &AuthHandler{baseURL: baseURL, nomadHandler: nomadHandler}
}

// LoginRequest represents a login request body
type LoginRequest struct {
	Token string `json:"token"`
}

// Login handles user login by validating and setting an HTTPOnly cookie with the Nomad token
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	cluster := getClusterName(r)
	if cluster == "" {
		writeError(w, fmt.Errorf("cluster name is required"), http.StatusBadRequest)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, fmt.Errorf("invalid request body"), http.StatusBadRequest)
		return
	}

	if req.Token == "" {
		writeError(w, fmt.Errorf("token is required"), http.StatusBadRequest)
		return
	}

	// Validate the token by calling ACL self endpoint
	if h.nomadHandler != nil {
		client, err := h.nomadHandler.GetClientWithToken(cluster, req.Token)
		if err != nil {
			writeError(w, fmt.Errorf("failed to create client: %v", err), http.StatusInternalServerError)
			return
		}

		// Try to get token info - this validates the token
		tokenInfo, _, err := client.ACLTokens().Self(nil)
		if err != nil {
			// Token is invalid
			writeNomadError(w, fmt.Errorf("invalid token: %v", err))
			return
		}

		// Token is valid, set the cookie
		auth.SetTokenCookie(w, r, cluster, req.Token, h.baseURL)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "ok",
			"token": map[string]interface{}{
				"name":       tokenInfo.Name,
				"type":       tokenInfo.Type,
				"policies":   tokenInfo.Policies,
				"global":     tokenInfo.Global,
				"createTime": tokenInfo.CreateTime,
			},
		})
		return
	}

	// Fallback if nomadHandler is not set (shouldn't happen in production)
	auth.SetTokenCookie(w, r, cluster, req.Token, h.baseURL)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// Logout handles user logout by clearing the HTTPOnly cookie
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	cluster := getClusterName(r)
	if cluster == "" {
		writeError(w, fmt.Errorf("cluster name is required"), http.StatusBadRequest)
		return
	}

	// Clear the HTTPOnly cookie
	auth.ClearTokenCookie(w, r, cluster, h.baseURL)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// CheckAuth checks if the user is authenticated (has a valid cookie)
func (h *AuthHandler) CheckAuth(w http.ResponseWriter, r *http.Request) {
	cluster := getClusterName(r)
	if cluster == "" {
		writeError(w, fmt.Errorf("cluster name is required"), http.StatusBadRequest)
		return
	}

	token := getToken(r)
	authenticated := token != ""

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]bool{"authenticated": authenticated})
}

// ClusterHealthResponse represents the health status of a cluster
type ClusterHealthResponse struct {
	Status        string `json:"status"`            // "healthy", "auth_required", "unreachable", "error"
	Reachable     bool   `json:"reachable"`         // Can we connect to the cluster?
	Authenticated bool   `json:"authenticated"`     // Do we have a valid token?
	Message       string `json:"message,omitempty"` // Error message if any
	Leader        string `json:"leader,omitempty"`  // Cluster leader if available
}

// ClusterHealth checks if a cluster is reachable and if authentication is valid
// This endpoint validates the token by making a real API call to Nomad
func (h *Handler) ClusterHealth(w http.ResponseWriter, r *http.Request) {
	cluster := getClusterName(r)
	if cluster == "" {
		writeError(w, fmt.Errorf("cluster name is required"), http.StatusBadRequest)
		return
	}

	token := getToken(r)
	response := ClusterHealthResponse{
		Status:        "healthy",
		Reachable:     false,
		Authenticated: false,
	}

	// Get client with token
	client, err := h.GetClientWithToken(cluster, token)
	if err != nil {
		response.Status = "error"
		response.Message = fmt.Sprintf("Failed to create client: %v", err)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// Try to get the leader status (requires minimal permissions)
	leader, err := client.Status().Leader()
	if err != nil {
		errStr := err.Error()
		// Check if it's an auth error
		if contains403(errStr) || contains401(errStr) {
			response.Status = "auth_required"
			response.Reachable = true
			response.Authenticated = false
			response.Message = "Authentication required or token expired"
		} else if containsConnectionError(errStr) {
			response.Status = "unreachable"
			response.Reachable = false
			response.Message = fmt.Sprintf("Cannot connect to cluster: %v", err)
		} else {
			response.Status = "error"
			response.Message = errStr
		}
	} else {
		response.Status = "healthy"
		response.Reachable = true
		response.Authenticated = true
		response.Leader = leader
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Helper functions to detect error types
func contains403(s string) bool {
	return strings.Contains(s, "403") || strings.Contains(s, "Permission denied")
}

func contains401(s string) bool {
	return strings.Contains(s, "401") || strings.Contains(s, "Unauthorized")
}

func containsConnectionError(s string) bool {
	return strings.Contains(s, "connection refused") ||
		strings.Contains(s, "no such host") ||
		strings.Contains(s, "timeout") ||
		strings.Contains(s, "dial tcp")
}
