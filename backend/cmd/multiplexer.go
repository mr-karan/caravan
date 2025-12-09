package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/hashicorp/nomad/api"
	"github.com/caravan-nomad/caravan/backend/pkg/logger"
	"github.com/caravan-nomad/caravan/backend/pkg/nomadconfig"
)

const (
	// StateConnecting is the state when the connection is being established.
	StateConnecting ConnectionState = "connecting"
	// StateConnected is the state when the connection is established.
	StateConnected ConnectionState = "connected"
	// StateError is the state when the connection has an error.
	StateError ConnectionState = "error"
	// StateClosed is the state when the connection is closed.
	StateClosed ConnectionState = "closed"
)

const (
	// HeartbeatInterval is the interval at which the multiplexer sends heartbeat messages.
	HeartbeatInterval = 30 * time.Second
	// CleanupRoutineInterval is the interval at which the multiplexer cleans up unused connections.
	CleanupRoutineInterval = 5 * time.Minute
)

// ConnectionState represents the current state of a connection.
type ConnectionState string

// ConnectionStatus holds the current status of a connection.
type ConnectionStatus struct {
	State   ConnectionState `json:"state"`
	Error   string          `json:"error,omitempty"`
	LastMsg time.Time       `json:"lastMsg"`
}

// Connection represents an event stream connection to a Nomad cluster.
type Connection struct {
	ClusterID string
	UserID    string
	Topics    []string
	Client    *WSConnLock
	Status    ConnectionStatus
	Done      chan struct{}
	cancel    context.CancelFunc
	mu        sync.RWMutex
	closed    bool
	Token     string
}

// Message represents a WebSocket message structure.
type Message struct {
	ClusterID string `json:"clusterId"`
	UserID    string `json:"userId"`
	Topics    string `json:"topics,omitempty"`
	Data      string `json:"data,omitempty"`
	Type      string `json:"type"`
	Error     string `json:"error,omitempty"`
}

// Multiplexer manages multiple WebSocket connections for Nomad event streams.
type Multiplexer struct {
	connections      map[string]*Connection
	mutex            sync.RWMutex
	nomadConfigStore nomadconfig.ContextStore
}

// WSConnLock provides a thread-safe wrapper around a WebSocket connection.
type WSConnLock struct {
	conn    *websocket.Conn
	writeMu sync.Mutex
	ctx     context.Context
}

// NewWSConnLock creates a new WSConnLock instance.
func NewWSConnLock(conn *websocket.Conn, ctx context.Context) *WSConnLock {
	return &WSConnLock{conn: conn, ctx: ctx}
}

// WriteJSON writes JSON to the connection.
func (c *WSConnLock) WriteJSON(v interface{}) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()

	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return c.conn.Write(c.ctx, websocket.MessageText, data)
}

// ReadJSON reads JSON from the connection.
func (c *WSConnLock) ReadJSON(v interface{}) error {
	_, data, err := c.conn.Read(c.ctx)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, v)
}

// ReadMessage reads a message from the connection.
func (c *WSConnLock) ReadMessage() (websocket.MessageType, []byte, error) {
	return c.conn.Read(c.ctx)
}

// WriteMessage writes a message to the connection.
func (c *WSConnLock) WriteMessage(messageType websocket.MessageType, data []byte) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return c.conn.Write(c.ctx, messageType, data)
}

// Close closes the connection.
func (c *WSConnLock) Close() error {
	return c.conn.Close(websocket.StatusNormalClosure, "connection closed")
}

// CloseNow closes the connection immediately.
func (c *WSConnLock) CloseNow() error {
	return c.conn.CloseNow()
}

// NewMultiplexer creates a new Multiplexer instance.
func NewMultiplexer(nomadConfigStore nomadconfig.ContextStore) *Multiplexer {
	return &Multiplexer{
		connections:      make(map[string]*Connection),
		nomadConfigStore: nomadConfigStore,
	}
}

// HandleClientWebSocket handles incoming WebSocket connections from clients.
func (m *Multiplexer) HandleClientWebSocket(w http.ResponseWriter, r *http.Request) {
	clientConn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"*"}, // Allow all origins for now
	})
	if err != nil {
		logger.Log(logger.LevelError, nil, err, "upgrading connection")
		return
	}
	defer clientConn.CloseNow()

	ctx := r.Context()
	lockClientConn := NewWSConnLock(clientConn, ctx)

	for {
		var msg Message
		_, rawMessage, err := clientConn.Read(ctx)
		if err != nil {
			if websocket.CloseStatus(err) != websocket.StatusNormalClosure {
				logger.Log(logger.LevelError, nil, err, "reading message")
			}
			break
		}

		if err := json.Unmarshal(rawMessage, &msg); err != nil {
			logger.Log(logger.LevelError, nil, err, "unmarshaling message")
			continue
		}

		switch msg.Type {
		case "SUBSCRIBE":
			m.handleSubscribe(msg, lockClientConn, r)
		case "UNSUBSCRIBE":
			m.handleUnsubscribe(msg)
		case "CLOSE":
			m.CloseConnection(msg.ClusterID, msg.UserID)
		}
	}

	m.cleanupConnections()
}

// handleSubscribe handles a subscribe request for Nomad events.
func (m *Multiplexer) handleSubscribe(msg Message, clientConn *WSConnLock, r *http.Request) {
	connKey := m.createConnectionKey(msg.ClusterID, msg.UserID)

	m.mutex.RLock()
	_, exists := m.connections[connKey]
	m.mutex.RUnlock()

	if exists {
		// Already subscribed
		return
	}

	// Get token from header
	token := r.Header.Get("X-Nomad-Token")

	// Create connection
	ctx, cancel := context.WithCancel(context.Background())
	conn := &Connection{
		ClusterID: msg.ClusterID,
		UserID:    msg.UserID,
		Topics:    []string{"Job", "Allocation", "Node", "Deployment", "Evaluation"},
		Client:    clientConn,
		Done:      make(chan struct{}),
		cancel:    cancel,
		Token:     token,
		Status: ConnectionStatus{
			State:   StateConnecting,
			LastMsg: time.Now(),
		},
	}

	m.mutex.Lock()
	m.connections[connKey] = conn
	m.mutex.Unlock()

	// Start streaming events
	go m.streamNomadEvents(ctx, conn)
}

// handleUnsubscribe handles an unsubscribe request.
func (m *Multiplexer) handleUnsubscribe(msg Message) {
	m.CloseConnection(msg.ClusterID, msg.UserID)
}

// streamNomadEvents streams events from a Nomad cluster to the client.
func (m *Multiplexer) streamNomadEvents(ctx context.Context, conn *Connection) {
	defer m.cleanupConnection(conn)

	// Get Nomad client
	nomadCtx, err := m.nomadConfigStore.GetContext(conn.ClusterID)
	if err != nil {
		conn.sendError(fmt.Sprintf("Failed to get cluster context: %v", err))
		return
	}

	client, err := nomadCtx.GetClientWithToken(conn.Token)
	if err != nil {
		conn.sendError(fmt.Sprintf("Failed to create Nomad client: %v", err))
		return
	}

	// Build topics map
	topics := map[api.Topic][]string{
		api.TopicJob:        {"*"},
		api.TopicAllocation: {"*"},
		api.TopicNode:       {"*"},
		api.TopicDeployment: {"*"},
		api.TopicEvaluation: {"*"},
		api.TopicService:    {"*"},
	}

	// Start event stream
	eventsCh, err := client.EventStream().Stream(ctx, topics, 0, nil)
	if err != nil {
		conn.sendError(fmt.Sprintf("Failed to start event stream: %v", err))
		return
	}

	conn.updateStatus(StateConnected, nil)

	// Stream events
	for {
		select {
		case <-ctx.Done():
			return
		case <-conn.Done:
			return
		case events, ok := <-eventsCh:
			if !ok {
				return
			}

			if events.Err != nil {
				conn.sendError(fmt.Sprintf("Event stream error: %v", events.Err))
				return
			}

			for _, event := range events.Events {
				m.sendEvent(conn, event)
			}
		}
	}
}

// sendEvent sends an event to the client.
func (m *Multiplexer) sendEvent(conn *Connection, event api.Event) {
	conn.mu.Lock()
	if conn.closed {
		conn.mu.Unlock()
		return
	}
	conn.mu.Unlock()

	eventData, err := json.Marshal(map[string]interface{}{
		"topic":   event.Topic,
		"type":    event.Type,
		"key":     event.Key,
		"index":   event.Index,
		"payload": event.Payload,
	})
	if err != nil {
		logger.Log(logger.LevelError, nil, err, "marshaling event")
		return
	}

	msg := Message{
		ClusterID: conn.ClusterID,
		UserID:    conn.UserID,
		Data:      string(eventData),
		Type:      "DATA",
	}

	if err := conn.Client.WriteJSON(msg); err != nil {
		logger.Log(logger.LevelError, nil, err, "writing event to client")
	}

	conn.mu.Lock()
	conn.Status.LastMsg = time.Now()
	conn.mu.Unlock()
}

// updateStatus updates the connection status.
func (conn *Connection) updateStatus(state ConnectionState, err error) {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	if conn.closed {
		return
	}

	conn.Status.State = state
	conn.Status.LastMsg = time.Now()

	if err != nil {
		conn.Status.Error = err.Error()
	} else {
		conn.Status.Error = ""
	}

	// Send status update to client
	statusMsg := Message{
		ClusterID: conn.ClusterID,
		UserID:    conn.UserID,
		Type:      "STATUS",
		Data:      string(state),
	}

	if err != nil {
		statusMsg.Error = err.Error()
	}

	if conn.Client != nil {
		conn.Client.WriteJSON(statusMsg)
	}
}

// sendError sends an error message to the client.
func (conn *Connection) sendError(errMsg string) {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	if conn.closed || conn.Client == nil {
		return
	}

	msg := Message{
		ClusterID: conn.ClusterID,
		UserID:    conn.UserID,
		Type:      "ERROR",
		Error:     errMsg,
	}

	conn.Client.WriteJSON(msg)
}

// cleanupConnection cleans up a connection.
func (m *Multiplexer) cleanupConnection(conn *Connection) {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	if conn.closed {
		return
	}

	conn.closed = true

	if conn.cancel != nil {
		conn.cancel()
	}

	m.mutex.Lock()
	connKey := m.createConnectionKey(conn.ClusterID, conn.UserID)
	delete(m.connections, connKey)
	m.mutex.Unlock()
}

// CloseConnection closes a specific connection.
func (m *Multiplexer) CloseConnection(clusterID, userID string) {
	connKey := m.createConnectionKey(clusterID, userID)

	m.mutex.Lock()
	conn, exists := m.connections[connKey]
	if !exists {
		m.mutex.Unlock()
		return
	}

	delete(m.connections, connKey)
	m.mutex.Unlock()

	conn.mu.Lock()
	if !conn.closed {
		conn.closed = true
		if conn.cancel != nil {
			conn.cancel()
		}
		close(conn.Done)
	}
	conn.mu.Unlock()
}

// cleanupConnections cleans up all connections.
func (m *Multiplexer) cleanupConnections() {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	for key, conn := range m.connections {
		conn.mu.Lock()
		if !conn.closed {
			conn.closed = true
			if conn.cancel != nil {
				conn.cancel()
			}
			close(conn.Done)
		}
		conn.mu.Unlock()
		delete(m.connections, key)
	}
}

// createConnectionKey creates a unique key for a connection.
func (m *Multiplexer) createConnectionKey(clusterID, userID string) string {
	return fmt.Sprintf("%s:%s", clusterID, userID)
}
