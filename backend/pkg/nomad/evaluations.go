package nomad

import (
	"net/http"
)

// ListEvaluations handles GET /clusters/{cluster}/v1/evaluations
func (h *Handler) ListEvaluations(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	evals, _, err := client.Evaluations().List(opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, evals)
}

// GetEvaluation handles GET /clusters/{cluster}/v1/evaluation/{evalID}
func (h *Handler) GetEvaluation(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	evalID := r.PathValue("evalID")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	eval, _, err := client.Evaluations().Info(evalID, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, eval)
}

// GetEvaluationAllocations handles GET /clusters/{cluster}/v1/evaluation/{evalID}/allocations
func (h *Handler) GetEvaluationAllocations(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	evalID := r.PathValue("evalID")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	allocs, _, err := client.Evaluations().Allocations(evalID, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, allocs)
}
