package telemetry

import (
	"fmt"
	"net/http"
	"sync"

	"github.com/VictoriaMetrics/metrics"
)

var (
	// HTTP request metrics with labels
	httpRequestsTotal   = make(map[string]*metrics.Counter)
	httpRequestDuration = metrics.NewHistogram("http_request_duration_seconds")
	httpRequestsMu      sync.Mutex

	// Cluster metrics - use gauge for current count
	clustersActive = metrics.NewCounter("clusters_active")

	// API proxy metrics
	apiProxyRequests = metrics.NewCounter("nomad_api_requests_total")
	apiProxyErrors   = metrics.NewCounter("nomad_api_errors_total")
)

// RecordHTTPRequest records an HTTP request with method, path, and status
func RecordHTTPRequest(method, path string, status int, duration float64) {
	// Normalize path to avoid high cardinality (remove IDs)
	normalizedPath := normalizePath(path)

	// Create labeled counter key
	key := fmt.Sprintf(`http_requests_total{method=%q,path=%q,status="%d"}`, method, normalizedPath, status)

	httpRequestsMu.Lock()
	counter, ok := httpRequestsTotal[key]
	if !ok {
		counter = metrics.NewCounter(key)
		httpRequestsTotal[key] = counter
	}
	httpRequestsMu.Unlock()

	counter.Inc()
	httpRequestDuration.Update(duration)
}

// normalizePath normalizes URL paths to reduce cardinality
func normalizePath(path string) string {
	// Keep first two segments for API paths, replace IDs with placeholders
	// e.g., /api/clusters/my-cluster/v1/jobs -> /api/clusters/:cluster/v1/jobs
	if len(path) > 100 {
		return path[:100]
	}
	return path
}

// RecordClusterAdded records when a cluster is added
func RecordClusterAdded() {
	clustersActive.Inc()
}

// RecordClusterRemoved records when a cluster is removed
func RecordClusterRemoved() {
	clustersActive.Dec()
}

// RecordAPIProxyRequest records a Nomad API proxy request
func RecordAPIProxyRequest() {
	apiProxyRequests.Inc()
}

// RecordAPIProxyError records a Nomad API proxy error
func RecordAPIProxyError() {
	apiProxyErrors.Inc()
}

// MetricsHandler returns an HTTP handler that exposes metrics in Prometheus format
func MetricsHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		metrics.WritePrometheus(w, true)
	})
}
