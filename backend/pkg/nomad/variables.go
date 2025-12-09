package nomad

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/hashicorp/nomad/api"
)

// ListVariables handles GET /clusters/{cluster}/v1/vars
func (h *Handler) ListVariables(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	vars, _, err := client.Variables().List(opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, vars)
}

// GetVariable handles GET /clusters/{cluster}/v1/var?path=my/var/path
func (h *Handler) GetVariable(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	path := r.URL.Query().Get("path")
	if path == "" {
		writeError(w, fmt.Errorf("path is required"), http.StatusBadRequest)
		return
	}

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	variable, _, err := client.Variables().Read(path, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, variable)
}

// PutVariable handles PUT /clusters/{cluster}/v1/var?path=my/var/path
func (h *Handler) PutVariable(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	path := r.URL.Query().Get("path")
	if path == "" {
		writeError(w, fmt.Errorf("path is required"), http.StatusBadRequest)
		return
	}

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	var varReq struct {
		Items     map[string]string `json:"items"`
		Namespace string            `json:"namespace"`
	}
	if err := json.NewDecoder(r.Body).Decode(&varReq); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	variable := &api.Variable{
		Path:      path,
		Namespace: varReq.Namespace,
		Items:     varReq.Items,
	}

	opts := getWriteOptions(r)
	if varReq.Namespace != "" {
		opts.Namespace = varReq.Namespace
	}

	resp, _, err := client.Variables().Create(variable, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, resp)
}

// DeleteVariable handles DELETE /clusters/{cluster}/v1/var?path=my/var/path
func (h *Handler) DeleteVariable(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	path := r.URL.Query().Get("path")
	if path == "" {
		writeError(w, fmt.Errorf("path is required"), http.StatusBadRequest)
		return
	}

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getWriteOptions(r)
	_, err = client.Variables().Delete(path, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, map[string]string{"status": "deleted"})
}
