package nomad

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/hashicorp/nomad/api"
	"github.com/caravan-nomad/caravan/backend/pkg/logger"
)

// NomadExecStreamingInput matches Nomad's ExecStreamingInput structure
type NomadExecStreamingInput struct {
	Stdin   *NomadExecStreamingIOOperation `json:"stdin,omitempty"`
	TTYSize *NomadTerminalSize             `json:"tty_size,omitempty"`
}

// NomadExecStreamingIOOperation matches Nomad's ExecStreamingIOOperation structure
type NomadExecStreamingIOOperation struct {
	Data  []byte `json:"data,omitempty"`
	Close bool   `json:"close,omitempty"`
}

// NomadTerminalSize matches Nomad's TerminalSize structure
type NomadTerminalSize struct {
	Height int `json:"height"`
	Width  int `json:"width"`
}

// NomadExecStreamingOutput matches Nomad's ExecStreamingOutput structure
type NomadExecStreamingOutput struct {
	Stdout *NomadExecStreamingIOOperation `json:"stdout,omitempty"`
	Stderr *NomadExecStreamingIOOperation `json:"stderr,omitempty"`
	Exited bool                           `json:"exited,omitempty"`
	Result *NomadExecStreamingExitResult  `json:"result,omitempty"`
}

// NomadExecStreamingExitResult matches Nomad's ExecStreamingExitResult structure
type NomadExecStreamingExitResult struct {
	ExitCode int `json:"exit_code"`
}

// sendWSError sends an error message over WebSocket and closes the connection
func sendWSError(ctx context.Context, conn *websocket.Conn, errMsg string) {
	msg, _ := json.Marshal(map[string]interface{}{
		"type":  "error",
		"error": errMsg,
	})
	conn.Write(ctx, websocket.MessageText, msg)
}

// ExecAllocation handles WebSocket connection for exec into an allocation
// This creates a WebSocket proxy to Nomad's exec endpoint
// GET /clusters/{cluster}/v1/allocation/{allocID}/exec/{task}
func (h *Handler) ExecAllocation(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	allocID := r.PathValue("allocID")
	task := r.PathValue("task")

	logger.Log(logger.LevelInfo, map[string]string{
		"cluster": clusterName,
		"allocID": allocID,
		"task":    task,
	}, nil, "ExecAllocation: Starting exec request")

	// Get command from query params
	cmdStr := r.URL.Query().Get("command")
	if cmdStr == "" {
		cmdStr = "/bin/sh"
	}
	// Parse command - Nomad expects JSON array
	command := strings.Split(cmdStr, " ")

	// Check if TTY is requested
	tty := r.URL.Query().Get("tty") != "false"

	// FIRST: Upgrade the client connection to WebSocket using coder/websocket
	clientConn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"*"}, // Allow all origins for now
	})
	if err != nil {
		logger.Log(logger.LevelError, nil, err, "ExecAllocation: Failed to upgrade client connection")
		return
	}
	defer clientConn.CloseNow()

	// Create context for the WebSocket connection
	ctx := r.Context()

	logger.Log(logger.LevelInfo, nil, nil, "ExecAllocation: Client WebSocket upgraded")

	// Get context for cluster address
	nomadCtx, err := h.configStore.GetContext(clusterName)
	if err != nil {
		errMsg := fmt.Sprintf("Failed to get cluster context: %v", err)
		logger.Log(logger.LevelError, map[string]string{"cluster": clusterName}, err, errMsg)
		sendWSError(ctx, clientConn, errMsg)
		return
	}

	// Get allocation info to validate the allocation exists
	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		errMsg := fmt.Sprintf("Failed to create Nomad client: %v", err)
		logger.Log(logger.LevelError, nil, err, errMsg)
		sendWSError(ctx, clientConn, errMsg)
		return
	}

	// Get allocation info
	opts := getQueryOptions(r)
	alloc, _, err := client.Allocations().Info(allocID, opts)
	if err != nil {
		errMsg := fmt.Sprintf("Failed to get allocation info: %v", err)
		logger.Log(logger.LevelError, map[string]string{"allocID": allocID}, err, errMsg)
		sendWSError(ctx, clientConn, errMsg)
		return
	}

	logger.Log(logger.LevelInfo, map[string]string{
		"allocID": allocID,
		"nodeID":  alloc.NodeID,
		"task":    task,
	}, nil, "ExecAllocation: Got allocation info")

	// Build the Nomad WebSocket URL
	nomadURL, err := url.Parse(nomadCtx.Address)
	if err != nil {
		errMsg := fmt.Sprintf("Invalid Nomad address: %v", err)
		logger.Log(logger.LevelError, nil, err, errMsg)
		sendWSError(ctx, clientConn, errMsg)
		return
	}

	// Convert HTTP(S) to WS(S)
	scheme := "ws"
	if nomadURL.Scheme == "https" {
		scheme = "wss"
	}

	// Build query params for Nomad
	commandJSON, _ := json.Marshal(command)
	nomadParams := url.Values{}
	nomadParams.Set("task", task)
	nomadParams.Set("tty", fmt.Sprintf("%t", tty))
	nomadParams.Set("command", string(commandJSON))

	nomadExecURL := fmt.Sprintf("%s://%s/v1/client/allocation/%s/exec?%s",
		scheme, nomadURL.Host, allocID, nomadParams.Encode())

	logger.Log(logger.LevelInfo, map[string]string{
		"url": nomadExecURL,
	}, nil, "ExecAllocation: Connecting to Nomad WebSocket")

	// Build dial options for Nomad connection
	dialOpts := &websocket.DialOptions{
		HTTPHeader: http.Header{},
	}

	// Add token header if present
	if token != "" {
		dialOpts.HTTPHeader.Set("X-Nomad-Token", token)
	}

	// Configure TLS
	if scheme == "wss" {
		tlsConfig := &tls.Config{}
		if nomadCtx.TLS != nil && nomadCtx.TLS.Insecure {
			tlsConfig.InsecureSkipVerify = true
		}
		dialOpts.HTTPClient = &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: tlsConfig,
			},
		}
	}

	// Connect to Nomad WebSocket
	nomadConn, resp, err := websocket.Dial(ctx, nomadExecURL, dialOpts)
	if err != nil {
		errMsg := fmt.Sprintf("Failed to connect to Nomad exec: %v", err)
		if resp != nil {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			errMsg = fmt.Sprintf("%s - Response: %d %s", errMsg, resp.StatusCode, string(body))
		}
		logger.Log(logger.LevelError, nil, err, errMsg)
		sendWSError(ctx, clientConn, errMsg)
		return
	}
	defer nomadConn.CloseNow()

	logger.Log(logger.LevelInfo, nil, nil, "ExecAllocation: WebSocket proxy established, starting message relay")

	// Create a mutex for writing to each connection
	var clientWriteMu sync.Mutex
	var nomadWriteMu sync.Mutex

	// Create cancellable context for managing goroutines
	proxyCtx, cancelProxy := context.WithCancel(ctx)
	defer cancelProxy()

	// Channel to signal when either connection closes
	done := make(chan struct{})
	var once sync.Once

	// Forward messages from client to Nomad
	go func() {
		defer once.Do(func() { close(done) })

		for {
			msgType, message, err := clientConn.Read(proxyCtx)
			if err != nil {
				if websocket.CloseStatus(err) != websocket.StatusNormalClosure {
					logger.Log(logger.LevelError, nil, err, "ExecAllocation: Client read error")
				}
				return
			}

			if msgType != websocket.MessageText {
				continue
			}

			// Parse client message (our custom format)
			var clientMsg struct {
				Type string          `json:"type"`
				Data json.RawMessage `json:"data"`
			}
			if err := json.Unmarshal(message, &clientMsg); err != nil {
				logger.Log(logger.LevelWarn, nil, err, "ExecAllocation: Failed to parse client message")
				continue
			}

			// Convert to Nomad format
			var nomadInput NomadExecStreamingInput

			switch clientMsg.Type {
			case "stdin":
				var data string
				if err := json.Unmarshal(clientMsg.Data, &data); err != nil {
					logger.Log(logger.LevelWarn, nil, err, "ExecAllocation: Failed to parse stdin data")
					continue
				}
				nomadInput.Stdin = &NomadExecStreamingIOOperation{
					Data: []byte(data),
				}
			case "resize":
				var size struct {
					Width  int `json:"width"`
					Height int `json:"height"`
				}
				if err := json.Unmarshal(clientMsg.Data, &size); err != nil {
					logger.Log(logger.LevelWarn, nil, err, "ExecAllocation: Failed to parse resize data")
					continue
				}
				nomadInput.TTYSize = &NomadTerminalSize{
					Width:  size.Width,
					Height: size.Height,
				}
			default:
				logger.Log(logger.LevelWarn, map[string]string{"type": clientMsg.Type}, nil, "ExecAllocation: Unknown client message type")
				continue
			}

			// Send to Nomad
			nomadMsg, _ := json.Marshal(nomadInput)
			nomadWriteMu.Lock()
			err = nomadConn.Write(proxyCtx, websocket.MessageText, nomadMsg)
			nomadWriteMu.Unlock()

			if err != nil {
				logger.Log(logger.LevelError, nil, err, "ExecAllocation: Failed to send to Nomad")
				return
			}
		}
	}()

	// Forward messages from Nomad to client
	go func() {
		defer once.Do(func() { close(done) })

		for {
			msgType, message, err := nomadConn.Read(proxyCtx)
			if err != nil {
				if websocket.CloseStatus(err) != websocket.StatusNormalClosure {
					logger.Log(logger.LevelError, nil, err, "ExecAllocation: Nomad read error")
				}
				return
			}

			if msgType != websocket.MessageText {
				continue
			}

			// Parse Nomad message
			var nomadOutput NomadExecStreamingOutput
			if err := json.Unmarshal(message, &nomadOutput); err != nil {
				logger.Log(logger.LevelWarn, nil, err, "ExecAllocation: Failed to parse Nomad message")
				continue
			}

			// Convert to client format
			var clientMsg map[string]interface{}

			if nomadOutput.Stdout != nil && len(nomadOutput.Stdout.Data) > 0 {
				clientMsg = map[string]interface{}{
					"type": "stdout",
					"data": string(nomadOutput.Stdout.Data),
				}
			} else if nomadOutput.Stderr != nil && len(nomadOutput.Stderr.Data) > 0 {
				clientMsg = map[string]interface{}{
					"type": "stderr",
					"data": string(nomadOutput.Stderr.Data),
				}
			} else if nomadOutput.Exited && nomadOutput.Result != nil {
				clientMsg = map[string]interface{}{
					"type":     "exit",
					"exitCode": nomadOutput.Result.ExitCode,
				}
			} else {
				// Heartbeat or other message, skip
				continue
			}

			clientMsgBytes, _ := json.Marshal(clientMsg)
			clientWriteMu.Lock()
			err = clientConn.Write(proxyCtx, websocket.MessageText, clientMsgBytes)
			clientWriteMu.Unlock()

			if err != nil {
				logger.Log(logger.LevelError, nil, err, "ExecAllocation: Failed to send to client")
				return
			}

			// If exited, close connections
			if nomadOutput.Exited {
				return
			}
		}
	}()

	// Send periodic heartbeats to Nomad
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-done:
				return
			case <-proxyCtx.Done():
				return
			case <-ticker.C:
				// Send empty heartbeat to Nomad
				heartbeat, _ := json.Marshal(NomadExecStreamingInput{})
				nomadWriteMu.Lock()
				err := nomadConn.Write(proxyCtx, websocket.MessageText, heartbeat)
				nomadWriteMu.Unlock()
				if err != nil {
					return
				}
			}
		}
	}()

	// Wait for either connection to close
	<-done
	logger.Log(logger.LevelInfo, nil, nil, "ExecAllocation: WebSocket proxy closed")

	// Close connections gracefully
	clientConn.Close(websocket.StatusNormalClosure, "session ended")
	nomadConn.Close(websocket.StatusNormalClosure, "session ended")
}

// GetAllocFS handles GET /clusters/{cluster}/v1/allocation/{allocID}/fs
// Returns file listing for an allocation
func (h *Handler) GetAllocFS(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	allocID := r.PathValue("allocID")

	path := r.URL.Query().Get("path")
	if path == "" {
		path = "/"
	}

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	alloc := &api.Allocation{ID: allocID}
	opts := getQueryOptions(r)
	opts.AuthToken = token // Required for client endpoints like /v1/client/fs/ls

	files, _, err := client.AllocFS().List(alloc, path, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, files)
}

// ReadAllocFile handles GET /clusters/{cluster}/v1/allocation/{allocID}/file
// Returns content of a file in an allocation
func (h *Handler) ReadAllocFile(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	allocID := r.PathValue("allocID")

	path := r.URL.Query().Get("path")
	if path == "" {
		writeError(w, os.ErrInvalid, http.StatusBadRequest)
		return
	}

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	alloc := &api.Allocation{ID: allocID}
	opts := getQueryOptions(r)
	opts.AuthToken = token // Required for client endpoints like /v1/client/fs/cat

	rc, err := client.AllocFS().Cat(alloc, path, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}
	defer rc.Close()

	w.Header().Set("Content-Type", "application/octet-stream")
	io.Copy(w, rc)
}
