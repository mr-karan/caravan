package nomad

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/hashicorp/nomad/api"
)

// StreamEvents handles GET /clusters/{cluster}/v1/event/stream
// This streams Nomad events using Server-Sent Events (SSE)
func (h *Handler) StreamEvents(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	// Parse topics from query params
	// Default to all main topics
	topicParams := r.URL.Query()["topic"]
	topics := make(map[api.Topic][]string)

	if len(topicParams) == 0 {
		// Default topics
		topics[api.TopicJob] = []string{"*"}
		topics[api.TopicAllocation] = []string{"*"}
		topics[api.TopicNode] = []string{"*"}
		topics[api.TopicDeployment] = []string{"*"}
		topics[api.TopicEvaluation] = []string{"*"}
		topics[api.TopicService] = []string{"*"}
	} else {
		for _, t := range topicParams {
			topics[api.Topic(t)] = []string{"*"}
		}
	}

	// Get starting index from query params
	var index uint64
	if indexStr := r.URL.Query().Get("index"); indexStr != "" {
		fmt.Sscanf(indexStr, "%d", &index)
	}

	// Set up SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // Disable nginx buffering

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, fmt.Errorf("streaming not supported"), http.StatusInternalServerError)
		return
	}

	// Create context for cancellation
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	// Handle client disconnect
	go func() {
		<-r.Context().Done()
		cancel()
	}()

	opts := getQueryOptions(r)
	eventsCh, err := client.EventStream().Stream(ctx, topics, index, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	// Stream events
	for {
		select {
		case events, ok := <-eventsCh:
			if !ok {
				return
			}

			if events.Err != nil {
				fmt.Fprintf(w, "event: error\ndata: %s\n\n", events.Err.Error())
				flusher.Flush()
				return
			}

			for _, event := range events.Events {
				data, err := json.Marshal(map[string]interface{}{
					"topic":   event.Topic,
					"type":    event.Type,
					"key":     event.Key,
					"index":   event.Index,
					"payload": event.Payload,
				})
				if err != nil {
					continue
				}

				fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.Topic, string(data))
				flusher.Flush()
			}

		case <-ctx.Done():
			return
		}
	}
}

// EventMessage represents an event message for WebSocket streaming
type EventMessage struct {
	Type      string      `json:"type"`
	Topic     string      `json:"topic,omitempty"`
	EventType string      `json:"eventType,omitempty"`
	Key       string      `json:"key,omitempty"`
	Namespace string      `json:"namespace,omitempty"`
	Index     uint64      `json:"index,omitempty"`
	Payload   interface{} `json:"payload,omitempty"`
	Error     string      `json:"error,omitempty"`
}
