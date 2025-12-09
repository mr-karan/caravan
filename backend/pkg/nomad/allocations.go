package nomad

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/hashicorp/nomad/api"
)

// ListAllocations handles GET /clusters/{cluster}/v1/allocations
func (h *Handler) ListAllocations(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	allocs, _, err := client.Allocations().List(opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, allocs)
}

// GetAllocation handles GET /clusters/{cluster}/v1/allocation/{allocID}
func (h *Handler) GetAllocation(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	allocID := r.PathValue("allocID")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	alloc, _, err := client.Allocations().Info(allocID, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, alloc)
}

// RestartAllocation handles POST /clusters/{cluster}/v1/allocation/{allocID}/restart
func (h *Handler) RestartAllocation(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	allocID := r.PathValue("allocID")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	// Optional task name
	taskName := r.URL.Query().Get("task")

	opts := getQueryOptions(r)
	err = client.Allocations().Restart(&api.Allocation{ID: allocID}, taskName, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, map[string]string{"status": "restarted"})
}

// StopAllocation handles POST /clusters/{cluster}/v1/allocation/{allocID}/stop
func (h *Handler) StopAllocation(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	allocID := r.PathValue("allocID")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	resp, err := client.Allocations().Stop(&api.Allocation{ID: allocID}, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, resp)
}

// StreamLogs handles GET /clusters/{cluster}/v1/allocation/{allocID}/logs/{task}
func (h *Handler) StreamLogs(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	allocID := r.PathValue("allocID")
	task := r.PathValue("task")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	// Get log type (stdout or stderr)
	logType := r.URL.Query().Get("type")
	if logType == "" {
		logType = "stdout"
	}

	// Get follow parameter
	follow := r.URL.Query().Get("follow") == "true"

	// Get origin (start or end)
	origin := r.URL.Query().Get("origin")
	if origin == "" {
		origin = "end" // Default to end for better UX
	}

	// Get offset - bytes from origin to start reading
	// Default to 50000 (50KB) when origin=end for reasonable history
	var offset int64 = 0
	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		if parsed, err := strconv.ParseInt(offsetStr, 10, 64); err == nil {
			offset = parsed
		}
	} else if origin == "end" {
		// Default offset from end: ~50KB of history (like Nomad UI)
		offset = 50000
	}

	alloc := &api.Allocation{ID: allocID}
	opts := getQueryOptions(r)
	opts.AuthToken = token // Required for client endpoints like /v1/client/fs/logs

	ctx := r.Context()
	cancel := context.CancelFunc(func() {})

	if follow {
		// Create a context that can be cancelled
		ctx, cancel = context.WithCancel(r.Context())
		defer cancel()

		// Handle client disconnect
		go func() {
			<-r.Context().Done()
			cancel()
		}()
	}

	// Set up SSE headers for streaming
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, fmt.Errorf("streaming not supported"), http.StatusInternalServerError)
		return
	}

	// Stream logs from the specified offset
	frames, errCh := client.AllocFS().Logs(alloc, follow, task, logType, origin, offset, ctx.Done(), opts)

	for {
		select {
		case frame, ok := <-frames:
			if !ok {
				return
			}
			if frame != nil && len(frame.Data) > 0 {
				// Split the frame data into lines and send each as a separate SSE event
				// This ensures proper SSE formatting since data fields can't contain raw newlines
				scanner := bufio.NewScanner(bytes.NewReader(frame.Data))
				for scanner.Scan() {
					line := scanner.Text()
					fmt.Fprintf(w, "data: %s\n\n", line)
					flusher.Flush()
				}
			}
		case err := <-errCh:
			if err != nil && err != io.EOF {
				fmt.Fprintf(w, "event: error\ndata: %s\n\n", err.Error())
				flusher.Flush()
			}
			return
		case <-ctx.Done():
			return
		}
	}
}

// GetAllocationStats handles GET /clusters/{cluster}/v1/allocation/{allocID}/stats
func (h *Handler) GetAllocationStats(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	allocID := r.PathValue("allocID")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	alloc := &api.Allocation{ID: allocID}
	opts := getQueryOptions(r)
	opts.AuthToken = token // Required for client endpoints like /v1/client/allocation/stats
	stats, err := client.Allocations().Stats(alloc, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, stats)
}
