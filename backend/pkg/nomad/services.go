package nomad

import (
	"net/http"
)

// ListServices handles GET /clusters/{cluster}/v1/services
func (h *Handler) ListServices(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	services, _, err := client.Services().List(opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, services)
}

// GetService handles GET /clusters/{cluster}/v1/service/{serviceName}
func (h *Handler) GetService(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	serviceName := r.PathValue("serviceName")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	services, _, err := client.Services().Get(serviceName, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, services)
}
