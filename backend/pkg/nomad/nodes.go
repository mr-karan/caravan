package nomad

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/hashicorp/nomad/api"
)

// ListNodes handles GET /clusters/{cluster}/v1/nodes
func (h *Handler) ListNodes(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	nodes, _, err := client.Nodes().List(opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, nodes)
}

// GetNode handles GET /clusters/{cluster}/v1/node/{nodeID}
func (h *Handler) GetNode(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	nodeID := r.PathValue("nodeID")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	node, _, err := client.Nodes().Info(nodeID, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, node)
}

// DrainNode handles POST /clusters/{cluster}/v1/node/{nodeID}/drain
func (h *Handler) DrainNode(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	nodeID := r.PathValue("nodeID")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	var drainReq struct {
		Enable       bool   `json:"enable"`
		Deadline     string `json:"deadline"`
		Force        bool   `json:"force"`
		IgnoreSystem bool   `json:"ignoreSystem"`
	}
	if err := json.NewDecoder(r.Body).Decode(&drainReq); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	opts := getWriteOptions(r)

	var drainSpec *api.DrainSpec
	if drainReq.Enable {
		deadline := 1 * time.Hour // Default deadline
		if drainReq.Deadline != "" {
			d, err := time.ParseDuration(drainReq.Deadline)
			if err != nil {
				writeError(w, err, http.StatusBadRequest)
				return
			}
			deadline = d
		}
		drainSpec = &api.DrainSpec{
			Deadline:         deadline,
			IgnoreSystemJobs: drainReq.IgnoreSystem,
		}
	}

	resp, err := client.Nodes().UpdateDrain(nodeID, drainSpec, !drainReq.Force, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, resp)
}

// SetEligibility handles POST /clusters/{cluster}/v1/node/{nodeID}/eligibility
func (h *Handler) SetEligibility(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	nodeID := r.PathValue("nodeID")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	var eligReq struct {
		Eligible bool `json:"eligible"`
	}
	if err := json.NewDecoder(r.Body).Decode(&eligReq); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	opts := getWriteOptions(r)

	resp, err := client.Nodes().ToggleEligibility(nodeID, eligReq.Eligible, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, resp)
}

// GetNodeAllocations handles GET /clusters/{cluster}/v1/node/{nodeID}/allocations
func (h *Handler) GetNodeAllocations(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	nodeID := r.PathValue("nodeID")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	allocs, _, err := client.Nodes().Allocations(nodeID, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, allocs)
}
