package nomad

import (
	"net/http"
)

// ListNamespaces handles GET /clusters/{cluster}/v1/namespaces
func (h *Handler) ListNamespaces(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	namespaces, _, err := client.Namespaces().List(opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, namespaces)
}

// GetNamespace handles GET /clusters/{cluster}/v1/namespace/{namespace}
func (h *Handler) GetNamespace(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	namespace := r.PathValue("namespace")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	ns, _, err := client.Namespaces().Info(namespace, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, ns)
}
