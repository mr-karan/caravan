package nomad

import (
	"encoding/json"
	"net/http"

	"github.com/hashicorp/nomad/api"
)

// OIDCAuthURLRequest is the request body for getting the OIDC auth URL
type OIDCAuthURLRequest struct {
	AuthMethodName string `json:"auth_method_name"`
	RedirectURI    string `json:"redirect_uri"`
	ClientNonce    string `json:"client_nonce"`
}

// OIDCAuthURLResponse is the response containing the OIDC auth URL
type OIDCAuthURLResponse struct {
	AuthURL string `json:"auth_url"`
}

// OIDCCompleteAuthRequest is the request body for completing OIDC auth
type OIDCCompleteAuthRequest struct {
	AuthMethodName string `json:"auth_method_name"`
	ClientNonce    string `json:"client_nonce"`
	State          string `json:"state"`
	Code           string `json:"code"`
	RedirectURI    string `json:"redirect_uri"`
}

// OIDCCompleteAuthResponse is the response containing the Nomad ACL token
type OIDCCompleteAuthResponse struct {
	AccessorID string   `json:"accessor_id"`
	SecretID   string   `json:"secret_id"`
	Name       string   `json:"name"`
	Type       string   `json:"type"`
	Policies   []string `json:"policies"`
	Global     bool     `json:"global"`
	CreateTime string   `json:"create_time,omitempty"`
	ExpiryTime string   `json:"expiry_time,omitempty"`
}

// AuthMethodResponse represents an auth method in the list response
type AuthMethodResponse struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Default bool   `json:"default"`
}

// ListAuthMethods handles GET /clusters/{cluster}/v1/acl/auth-methods
// Returns a list of configured auth methods for the cluster
func (h *Handler) ListAuthMethods(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)

	// For listing auth methods, we don't need a token - this is a public endpoint
	client, err := h.GetClient(clusterName)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	methods, _, err := client.ACLAuthMethods().List(opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	// Transform to our response format
	response := make([]AuthMethodResponse, 0, len(methods))
	for _, m := range methods {
		response = append(response, AuthMethodResponse{
			Name:    m.Name,
			Type:    m.Type,
			Default: m.Default,
		})
	}

	writeJSON(w, response)
}

// GetOIDCAuthURL handles POST /clusters/{cluster}/v1/acl/oidc/auth-url
// Returns the OIDC provider URL to redirect the user to
func (h *Handler) GetOIDCAuthURL(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)

	var req OIDCAuthURLRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	if req.AuthMethodName == "" {
		writeError(w, errMissingField("auth_method_name"), http.StatusBadRequest)
		return
	}
	if req.RedirectURI == "" {
		writeError(w, errMissingField("redirect_uri"), http.StatusBadRequest)
		return
	}
	if req.ClientNonce == "" {
		writeError(w, errMissingField("client_nonce"), http.StatusBadRequest)
		return
	}

	// For getting auth URL, we don't need a token - this is part of the login flow
	client, err := h.GetClient(clusterName)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	nomadReq := &api.ACLOIDCAuthURLRequest{
		AuthMethodName: req.AuthMethodName,
		RedirectURI:    req.RedirectURI,
		ClientNonce:    req.ClientNonce,
	}

	resp, _, err := client.ACLAuth().GetAuthURL(nomadReq, nil)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, OIDCAuthURLResponse{
		AuthURL: resp.AuthURL,
	})
}

// CompleteOIDCAuth handles POST /clusters/{cluster}/v1/acl/oidc/complete-auth
// Exchanges the OIDC callback code for a Nomad ACL token
func (h *Handler) CompleteOIDCAuth(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)

	var req OIDCCompleteAuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	if req.AuthMethodName == "" {
		writeError(w, errMissingField("auth_method_name"), http.StatusBadRequest)
		return
	}
	if req.State == "" {
		writeError(w, errMissingField("state"), http.StatusBadRequest)
		return
	}
	if req.Code == "" {
		writeError(w, errMissingField("code"), http.StatusBadRequest)
		return
	}
	if req.RedirectURI == "" {
		writeError(w, errMissingField("redirect_uri"), http.StatusBadRequest)
		return
	}
	if req.ClientNonce == "" {
		writeError(w, errMissingField("client_nonce"), http.StatusBadRequest)
		return
	}

	// For completing auth, we don't need a token - we're getting one
	client, err := h.GetClient(clusterName)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	nomadReq := &api.ACLOIDCCompleteAuthRequest{
		AuthMethodName: req.AuthMethodName,
		ClientNonce:    req.ClientNonce,
		State:          req.State,
		Code:           req.Code,
		RedirectURI:    req.RedirectURI,
	}

	token, _, err := client.ACLAuth().CompleteAuth(nomadReq, nil)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	// Return the token info
	response := OIDCCompleteAuthResponse{
		AccessorID: token.AccessorID,
		SecretID:   token.SecretID,
		Name:       token.Name,
		Type:       token.Type,
		Policies:   token.Policies,
		Global:     token.Global,
	}

	if !token.CreateTime.IsZero() {
		response.CreateTime = token.CreateTime.Format("2006-01-02T15:04:05Z07:00")
	}
	if token.ExpirationTime != nil && !token.ExpirationTime.IsZero() {
		response.ExpiryTime = token.ExpirationTime.Format("2006-01-02T15:04:05Z07:00")
	}

	writeJSON(w, response)
}

// Helper to create missing field error
func errMissingField(field string) error {
	return &fieldError{field: field}
}

type fieldError struct {
	field string
}

func (e *fieldError) Error() string {
	return "missing required field: " + e.field
}
