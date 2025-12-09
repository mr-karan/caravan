package nomad

import (
	"encoding/json"
	"net/http"
)

// ListDeployments handles GET /clusters/{cluster}/v1/deployments
func (h *Handler) ListDeployments(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	deployments, _, err := client.Deployments().List(opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, deployments)
}

// GetDeployment handles GET /clusters/{cluster}/v1/deployment/{deployID}
func (h *Handler) GetDeployment(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	deployID := r.PathValue("deployID")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	deployment, _, err := client.Deployments().Info(deployID, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, deployment)
}

// PromoteDeployment handles POST /clusters/{cluster}/v1/deployment/{deployID}/promote
func (h *Handler) PromoteDeployment(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	deployID := r.PathValue("deployID")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	var promoteReq struct {
		All    bool     `json:"all"`
		Groups []string `json:"groups"`
	}
	if err := json.NewDecoder(r.Body).Decode(&promoteReq); err != nil {
		// Default to promoting all
		promoteReq.All = true
	}

	opts := getWriteOptions(r)
	resp, _, err := client.Deployments().PromoteGroups(deployID, promoteReq.Groups, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, resp)
}

// FailDeployment handles POST /clusters/{cluster}/v1/deployment/{deployID}/fail
func (h *Handler) FailDeployment(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	deployID := r.PathValue("deployID")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getWriteOptions(r)
	resp, _, err := client.Deployments().Fail(deployID, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, resp)
}

// GetDeploymentAllocations handles GET /clusters/{cluster}/v1/deployment/{deployID}/allocations
func (h *Handler) GetDeploymentAllocations(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	deployID := r.PathValue("deployID")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	allocs, _, err := client.Deployments().Allocations(deployID, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, allocs)
}

// PauseDeployment handles POST /clusters/{cluster}/v1/deployment/{deployID}/pause
func (h *Handler) PauseDeployment(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	deployID := r.PathValue("deployID")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	var pauseReq struct {
		Pause bool `json:"pause"`
	}
	if err := json.NewDecoder(r.Body).Decode(&pauseReq); err != nil {
		// Default to pausing
		pauseReq.Pause = true
	}

	opts := getWriteOptions(r)
	resp, _, err := client.Deployments().Pause(deployID, pauseReq.Pause, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, resp)
}
