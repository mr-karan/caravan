package nomad

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/hashicorp/nomad/api"
)

// ListJobs handles GET /clusters/{cluster}/v1/jobs
func (h *Handler) ListJobs(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	jobs, _, err := client.Jobs().List(opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, jobs)
}

// GetJob handles GET /clusters/{cluster}/v1/job?id=jobID
func (h *Handler) GetJob(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	jobID := r.URL.Query().Get("id")
	if jobID == "" {
		writeError(w, fmt.Errorf("job id is required"), http.StatusBadRequest)
		return
	}

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	job, _, err := client.Jobs().Info(jobID, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, job)
}

// UpdateJob handles POST /clusters/{cluster}/v1/job/{jobID}
func (h *Handler) UpdateJob(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	var job api.Job
	if err := json.NewDecoder(r.Body).Decode(&job); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	opts := getWriteOptions(r)
	resp, _, err := client.Jobs().Register(&job, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, resp)
}

// DeleteJob handles DELETE /clusters/{cluster}/v1/job?id=jobID
func (h *Handler) DeleteJob(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	jobID := r.URL.Query().Get("id")
	if jobID == "" {
		writeError(w, fmt.Errorf("job id is required"), http.StatusBadRequest)
		return
	}

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getWriteOptions(r)

	// Check if purge is requested
	purge := r.URL.Query().Get("purge") == "true"

	var resp string
	var meta *api.WriteMeta
	if purge {
		resp, meta, err = client.Jobs().Deregister(jobID, true, opts)
	} else {
		resp, meta, err = client.Jobs().Deregister(jobID, false, opts)
	}
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, map[string]interface{}{
		"evalID":    resp,
		"writeMeta": meta,
	})
}

// DispatchJob handles POST /clusters/{cluster}/v1/job/dispatch?id=jobID
func (h *Handler) DispatchJob(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	jobID := r.URL.Query().Get("id")
	if jobID == "" {
		writeError(w, fmt.Errorf("job id is required"), http.StatusBadRequest)
		return
	}

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	var dispatchReq struct {
		Payload []byte            `json:"payload"`
		Meta    map[string]string `json:"meta"`
	}
	if err := json.NewDecoder(r.Body).Decode(&dispatchReq); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	opts := getWriteOptions(r)
	resp, _, err := client.Jobs().Dispatch(jobID, dispatchReq.Meta, dispatchReq.Payload, "", opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, resp)
}

// GetJobAllocations handles GET /clusters/{cluster}/v1/job/allocations?id=jobID
func (h *Handler) GetJobAllocations(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	jobID := r.URL.Query().Get("id")
	if jobID == "" {
		writeError(w, fmt.Errorf("job id is required"), http.StatusBadRequest)
		return
	}

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	allocs, _, err := client.Jobs().Allocations(jobID, false, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, allocs)
}

// GetJobVersions handles GET /clusters/{cluster}/v1/job/versions?id=jobID
func (h *Handler) GetJobVersions(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	jobID := r.URL.Query().Get("id")
	if jobID == "" {
		writeError(w, fmt.Errorf("job id is required"), http.StatusBadRequest)
		return
	}

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	versions, diffs, _, err := client.Jobs().Versions(jobID, false, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, map[string]interface{}{
		"versions": versions,
		"diffs":    diffs,
	})
}

// ScaleJob handles POST /clusters/{cluster}/v1/job/scale?id=jobID
func (h *Handler) ScaleJob(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	jobID := r.URL.Query().Get("id")
	if jobID == "" {
		writeError(w, fmt.Errorf("job id is required"), http.StatusBadRequest)
		return
	}

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	var scaleReq struct {
		Target map[string]string      `json:"target"`
		Count  *int                   `json:"count"`
		Error  bool                   `json:"error"`
		Meta   map[string]interface{} `json:"meta"`
	}
	if err := json.NewDecoder(r.Body).Decode(&scaleReq); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	opts := getWriteOptions(r)
	resp, _, err := client.Jobs().Scale(jobID, scaleReq.Target["group"], scaleReq.Count, "Scaled via Caravan", scaleReq.Error, scaleReq.Meta, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, resp)
}
