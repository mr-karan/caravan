package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"path"
	"sort"
	"strings"
	"time"

	"github.com/rs/cors"

	"github.com/caravan-nomad/caravan/backend/pkg/cache"
	"github.com/caravan-nomad/caravan/backend/pkg/config"
	"github.com/caravan-nomad/caravan/backend/pkg/logger"
	"github.com/caravan-nomad/caravan/backend/pkg/nomad"
	"github.com/caravan-nomad/caravan/backend/pkg/nomadconfig"
	"github.com/caravan-nomad/caravan/backend/pkg/plugins"
	"github.com/caravan-nomad/caravan/backend/pkg/spa"
	"github.com/caravan-nomad/caravan/backend/pkg/telemetry"
)

// CaravanConfig holds the configuration for Caravan
type CaravanConfig struct {
	ListenAddr          string
	DevMode             bool
	WatchPluginsChanges bool
	Port                uint
	StaticDir           string
	PluginDir           string
	UserPluginDir       string
	StaticPluginDir     string
	BaseURL             string
	ProxyURLs           []string
	TLSCertPath         string
	TLSKeyPath          string
	NomadConfigStore    nomadconfig.ContextStore
	cache               cache.Cache[interface{}]
	multiplexer         *Multiplexer
	nomadHandler        *nomad.Handler
}

type clientConfig struct {
	Clusters []Cluster `json:"clusters"`
}

// returns True if a file exists.
func fileExists(filename string) bool {
	info, err := os.Stat(filename)
	if os.IsNotExist(err) {
		return false
	}
	return !info.IsDir()
}

func mustReadFile(path string) []byte {
	data, err := os.ReadFile(path)
	if err != nil {
		logger.Log(logger.LevelError, nil, err, "reading file")
		os.Exit(1)
	}
	return data
}

func mustWriteFile(path string, data []byte) {
	err := os.WriteFile(path, data, fs.FileMode(0o600))
	if err != nil {
		logger.Log(logger.LevelError, nil, err, "writing file")
		os.Exit(1)
	}
}

func makeBaseURLReplacements(data []byte, baseURL string) []byte {
	replaceURL := baseURL
	if baseURL == "" {
		replaceURL = "/"
	}

	data = bytes.ReplaceAll(
		data,
		[]byte("caravanBaseUrl = __baseUrl__"),
		[]byte(fmt.Sprintf("caravanBaseUrl = '%s'", replaceURL)),
	)

	data = bytes.ReplaceAll(
		data,
		[]byte("./"),
		[]byte(fmt.Sprintf("%s/", baseURL)),
	)

	data = bytes.ReplaceAll(
		data,
		[]byte("url("),
		[]byte(fmt.Sprintf("url(%s/", baseURL)),
	)

	return data
}

func baseURLReplace(staticDir string, baseURL string) {
	indexBaseURL := path.Join(staticDir, "index.baseUrl.html")
	index := path.Join(staticDir, "index.html")

	if !fileExists(indexBaseURL) {
		d := mustReadFile(index)
		mustWriteFile(indexBaseURL, d)
	}

	data := mustReadFile(indexBaseURL)
	output := makeBaseURLReplacements(data, baseURL)
	mustWriteFile(index, output)
}

func serveWithNoCacheHeader(fs http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Cache-Control", "no-cache")
		fs.ServeHTTP(w, r)
	}
}

// requestLogger is a middleware that logs all incoming requests
func requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Create a response wrapper to capture status code
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		// Log request
		logger.Log(logger.LevelInfo, map[string]string{
			"method": r.Method,
			"path":   r.URL.Path,
			"query":  r.URL.RawQuery,
		}, nil, "Incoming request")

		// Call the next handler
		next.ServeHTTP(rw, r)

		// Log response and record metrics
		duration := time.Since(start)
		logger.Log(logger.LevelInfo, map[string]string{
			"method":   r.Method,
			"path":     r.URL.Path,
			"status":   fmt.Sprintf("%d", rw.statusCode),
			"duration": duration.String(),
		}, nil, "Request completed")

		// Record HTTP metrics
		telemetry.RecordHTTPRequest(r.Method, r.URL.Path, rw.statusCode, duration.Seconds())
	})
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// Hijack implements http.Hijacker interface to support WebSocket upgrades
func (rw *responseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if hijacker, ok := rw.ResponseWriter.(http.Hijacker); ok {
		return hijacker.Hijack()
	}
	return nil, nil, fmt.Errorf("hijack not supported")
}

// Flush implements http.Flusher interface for streaming responses
func (rw *responseWriter) Flush() {
	if flusher, ok := rw.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

// addPluginRoutes adds plugin routes to a mux
func addPluginRoutes(config *CaravanConfig, mux *http.ServeMux) {
	// Plugin list route
	mux.HandleFunc("GET /plugins", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		pluginsList, err := config.cache.Get(r.Context(), plugins.PluginListKey)
		if err != nil && err == cache.ErrNotFound {
			pluginsList = []plugins.PluginMetadata{}
		}
		if err := json.NewEncoder(w).Encode(pluginsList); err != nil {
			logger.Log(logger.LevelError, nil, err, "encoding plugins base paths list")
		}
	})

	// Serve development plugins
	pluginHandler := http.StripPrefix("/plugins/", http.FileServer(http.Dir(config.PluginDir)))
	pluginHandler = serveWithNoCacheHeader(pluginHandler)
	mux.Handle("/plugins/", pluginHandler)

	// Serve user-installed plugins
	if config.UserPluginDir != "" {
		userPluginsHandler := http.StripPrefix("/user-plugins/",
			http.FileServer(http.Dir(config.UserPluginDir)))
		userPluginsHandler = serveWithNoCacheHeader(userPluginsHandler)
		mux.Handle("/user-plugins/", userPluginsHandler)
	}

	// Serve shipped/static plugins
	if config.StaticPluginDir != "" {
		staticPluginsHandler := http.StripPrefix("/static-plugins/",
			http.FileServer(http.Dir(config.StaticPluginDir)))
		mux.Handle("/static-plugins/", staticPluginsHandler)
	}
}

// addNomadRoutes adds all Nomad API routes under /api prefix
func addNomadRoutes(config *CaravanConfig, mux *http.ServeMux) {
	h := config.nomadHandler
	authHandler := nomad.NewAuthHandler(config.BaseURL, h)

	// Auth endpoints
	mux.HandleFunc("POST /api/clusters/{cluster}/v1/auth/login", authHandler.Login)
	mux.HandleFunc("POST /api/clusters/{cluster}/v1/auth/logout", authHandler.Logout)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/auth/check", authHandler.CheckAuth)

	// Cluster health endpoint - checks if cluster is reachable and auth is valid
	mux.HandleFunc("GET /api/clusters/{cluster}/health", h.ClusterHealth)

	// Jobs - use query param for jobID to handle slashes in job names (e.g., periodic jobs)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/jobs", h.ListJobs)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/job", h.GetJob)                        // ?id=jobID
	mux.HandleFunc("POST /api/clusters/{cluster}/v1/job", h.UpdateJob)                    // ?id=jobID
	mux.HandleFunc("DELETE /api/clusters/{cluster}/v1/job", h.DeleteJob)                  // ?id=jobID
	mux.HandleFunc("POST /api/clusters/{cluster}/v1/job/dispatch", h.DispatchJob)         // ?id=jobID
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/job/allocations", h.GetJobAllocations) // ?id=jobID
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/job/versions", h.GetJobVersions)       // ?id=jobID
	mux.HandleFunc("POST /api/clusters/{cluster}/v1/job/scale", h.ScaleJob)               // ?id=jobID

	// Allocations
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/allocations", h.ListAllocations)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/allocation/{allocID}", h.GetAllocation)
	mux.HandleFunc("POST /api/clusters/{cluster}/v1/allocation/{allocID}/restart", h.RestartAllocation)
	mux.HandleFunc("POST /api/clusters/{cluster}/v1/allocation/{allocID}/stop", h.StopAllocation)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/allocation/{allocID}/logs/{task}", h.StreamLogs)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/allocation/{allocID}/stats", h.GetAllocationStats)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/allocation/{allocID}/exec/{task}", h.ExecAllocation)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/allocation/{allocID}/fs", h.GetAllocFS)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/allocation/{allocID}/file", h.ReadAllocFile)

	// Nodes
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/nodes", h.ListNodes)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/node/{nodeID}", h.GetNode)
	mux.HandleFunc("POST /api/clusters/{cluster}/v1/node/{nodeID}/drain", h.DrainNode)
	mux.HandleFunc("POST /api/clusters/{cluster}/v1/node/{nodeID}/eligibility", h.SetEligibility)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/node/{nodeID}/allocations", h.GetNodeAllocations)

	// Namespaces
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/namespaces", h.ListNamespaces)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/namespace/{namespace}", h.GetNamespace)

	// Variables - use query param for path to handle slashes in variable paths
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/vars", h.ListVariables)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/var", h.GetVariable)       // ?path=my/var/path
	mux.HandleFunc("PUT /api/clusters/{cluster}/v1/var", h.PutVariable)       // ?path=my/var/path
	mux.HandleFunc("DELETE /api/clusters/{cluster}/v1/var", h.DeleteVariable) // ?path=my/var/path

	// ACL
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/acl/tokens", h.ListACLTokens)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/acl/token/self", h.GetSelfToken)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/acl/token/{tokenID}", h.GetACLToken)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/acl/policies", h.ListACLPolicies)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/acl/policy/{policyName}", h.GetACLPolicy)

	// ACL OIDC Authentication
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/acl/auth-methods", h.ListAuthMethods)
	mux.HandleFunc("POST /api/clusters/{cluster}/v1/acl/oidc/auth-url", h.GetOIDCAuthURL)
	mux.HandleFunc("POST /api/clusters/{cluster}/v1/acl/oidc/complete-auth", h.CompleteOIDCAuth)

	// Evaluations
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/evaluations", h.ListEvaluations)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/evaluation/{evalID}", h.GetEvaluation)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/evaluation/{evalID}/allocations", h.GetEvaluationAllocations)

	// Deployments
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/deployments", h.ListDeployments)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/deployment/{deployID}", h.GetDeployment)
	mux.HandleFunc("POST /api/clusters/{cluster}/v1/deployment/{deployID}/promote", h.PromoteDeployment)
	mux.HandleFunc("POST /api/clusters/{cluster}/v1/deployment/{deployID}/fail", h.FailDeployment)
	mux.HandleFunc("POST /api/clusters/{cluster}/v1/deployment/{deployID}/pause", h.PauseDeployment)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/deployment/{deployID}/allocations", h.GetDeploymentAllocations)

	// Services
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/services", h.ListServices)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/service/{serviceName}", h.GetService)

	// Events (Server-Sent Events)
	mux.HandleFunc("GET /api/clusters/{cluster}/v1/event/stream", h.StreamEvents)
}

// getConfig returns the configuration for the frontend
func (c *CaravanConfig) getConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	clusters := []Cluster{}
	for _, ctx := range c.NomadConfigStore.GetContexts() {
		clusters = append(clusters, Cluster{
			Name:     ctx.Name,
			Server:   ctx.Address,
			Region:   ctx.Region,
			AuthType: ctx.AuthType(),
			Metadata: ctx.Metadata,
			Error:    ctx.Error,
		})
	}

	// Sort clusters alphabetically by name
	sort.Slice(clusters, func(i, j int) bool {
		return clusters[i].Name < clusters[j].Name
	})

	clientConf := clientConfig{
		Clusters: clusters,
	}

	if err := json.NewEncoder(w).Encode(clientConf); err != nil {
		logger.Log(logger.LevelError, nil, err, "encoding config")
	}
}

// createCaravanHandler creates the main HTTP handler
func createCaravanHandler(config *CaravanConfig) http.Handler {
	config.StaticPluginDir = os.Getenv("CARAVAN_STATIC_PLUGINS_DIR")

	// Populate plugins cache
	plugins.PopulatePluginsCache(config.StaticPluginDir, config.UserPluginDir, config.PluginDir, config.cache)

	// Watch plugins for changes
	if config.WatchPluginsChanges {
		pluginEventChan := make(chan string)
		go plugins.Watch(config.PluginDir, pluginEventChan)

		if config.UserPluginDir != "" {
			userPluginEventChan := make(chan string)
			go plugins.Watch(config.UserPluginDir, userPluginEventChan)
			go func() {
				for event := range userPluginEventChan {
					pluginEventChan <- event
				}
			}()
		}

		go plugins.HandlePluginEvents(
			config.StaticPluginDir,
			config.UserPluginDir,
			config.PluginDir,
			pluginEventChan,
			config.cache,
		)
	}

	if config.StaticDir != "" {
		baseURLReplace(config.StaticDir, config.BaseURL)
	}

	// Setup router
	mux := http.NewServeMux()

	// Add plugin routes
	addPluginRoutes(config, mux)

	// Add Nomad API routes
	addNomadRoutes(config, mux)

	// Configuration endpoint
	mux.HandleFunc("GET /config", config.getConfig)

	// Websocket multiplexer for event streaming
	mux.HandleFunc("/wsMultiplexer", config.multiplexer.HandleClientWebSocket)

	// Cluster management routes
	config.addClusterSetupRoute(mux)

	// Health check
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// Metrics endpoint (Prometheus format)
	mux.Handle("GET /metrics", telemetry.MetricsHandler())

	// Serve static files (SPA) - this is a catch-all, so it must be registered last
	// In Go 1.22+, "/" only matches exact root path. Use "/{path...}" for catch-all.
	if config.StaticDir != "" {
		logger.Log(logger.LevelInfo, nil, nil, "Serving static files from: "+config.StaticDir)
		spaHandler := spa.GetHandler(config.BaseURL, config.StaticDir)
		mux.Handle("/{path...}", spaHandler)
		mux.Handle("/", spaHandler) // Also handle exact root
	}

	// CORS handling using rs/cors - cleaner API
	c := cors.New(cors.Options{
		AllowedOrigins: []string{
			"http://localhost:3000",
			"http://localhost:5173",
			"http://127.0.0.1:3000",
			"http://127.0.0.1:5173",
		},
		AllowedMethods: []string{
			http.MethodGet,
			http.MethodHead,
			http.MethodPost,
			http.MethodPut,
			http.MethodDelete,
			http.MethodOptions,
		},
		AllowedHeaders: []string{
			"X-Requested-With",
			"Content-Type",
			"Authorization",
			"X-Nomad-Token",
			"kubeconfig",
			"X-CARAVAN-BACKEND-TOKEN",
		},
		AllowCredentials: true,
	})

	// Apply request logging and CORS
	return c.Handler(requestLogger(mux))
}

// addClusterSetupRoute adds routes for dynamic cluster management under /api prefix
func (c *CaravanConfig) addClusterSetupRoute(mux *http.ServeMux) {
	// List clusters (sorted alphabetically by name)
	mux.HandleFunc("GET /api/clusters", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		clusters := []Cluster{}
		for _, ctx := range c.NomadConfigStore.GetContexts() {
			clusters = append(clusters, Cluster{
				Name:     ctx.Name,
				Server:   ctx.Address,
				Region:   ctx.Region,
				AuthType: ctx.AuthType(),
				Metadata: ctx.Metadata,
				Error:    ctx.Error,
			})
		}

		// Sort clusters alphabetically by name
		sort.Slice(clusters, func(i, j int) bool {
			return clusters[i].Name < clusters[j].Name
		})

		if err := json.NewEncoder(w).Encode(clusters); err != nil {
			logger.Log(logger.LevelError, nil, err, "encoding clusters")
		}
	})

	// Add cluster - frontend sets cluster context, backend stores it
	mux.HandleFunc("POST /api/cluster", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Name      string `json:"name"`
			Address   string `json:"address"`
			Region    string `json:"region"`
			Namespace string `json:"namespace"`
			Token     string `json:"token"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		ctx := &nomadconfig.Context{
			Name:      req.Name,
			Address:   req.Address,
			Region:    req.Region,
			Namespace: req.Namespace,
			Token:     req.Token,
			Source:    nomadconfig.DynamicCluster,
		}

		if err := c.NomadConfigStore.AddContext(ctx); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Invalidate cached client
		c.nomadHandler.InvalidateClient(req.Name)

		// Record cluster added metric
		telemetry.RecordClusterAdded()

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"status": "created"})
	})

	// Delete cluster
	mux.HandleFunc("DELETE /api/cluster/{clusterName}", func(w http.ResponseWriter, r *http.Request) {
		clusterName := r.PathValue("clusterName")

		if err := c.NomadConfigStore.RemoveContext(clusterName); err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}

		// Invalidate cached client
		c.nomadHandler.InvalidateClient(clusterName)

		// Record cluster removed metric
		telemetry.RecordClusterRemoved()

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
	})
}

func main() {
	// Parse configuration using the config package
	conf, err := config.Parse(os.Args)
	if err != nil {
		logger.Log(logger.LevelError, nil, err, "parsing configuration")
		os.Exit(1)
	}

	// Initialize cache
	cacheInstance := cache.New[interface{}]()

	// Initialize Nomad config store
	nomadConfigStore := nomadconfig.NewInMemoryContextStore()

	// Initialize Nomad handler
	nomadHandler := nomad.NewHandler(nomadConfigStore)

	// Initialize multiplexer for WebSocket connections
	multiplexer := NewMultiplexer(nomadConfigStore)

	caravanConfig := &CaravanConfig{
		ListenAddr:          conf.ListenAddr,
		DevMode:             conf.DevMode,
		WatchPluginsChanges: conf.WatchPluginsChanges,
		Port:                conf.Port,
		StaticDir:           conf.StaticDir,
		PluginDir:           conf.PluginsDir,
		UserPluginDir:       conf.UserPluginsDir,
		BaseURL:             conf.BaseURL,
		ProxyURLs:           strings.Split(conf.ProxyURLs, ","),
		TLSCertPath:         conf.TLSCertPath,
		TLSKeyPath:          conf.TLSKeyPath,
		NomadConfigStore:    nomadConfigStore,
		cache:               cacheInstance,
		multiplexer:         multiplexer,
		nomadHandler:        nomadHandler,
	}

	handler := createCaravanHandler(caravanConfig)

	// Start server
	addr := fmt.Sprintf("%s:%d", caravanConfig.ListenAddr, caravanConfig.Port)

	// Clean startup message
	displayAddr := addr
	if caravanConfig.ListenAddr == "" {
		displayAddr = fmt.Sprintf("localhost:%d", caravanConfig.Port)
	}
	fmt.Println()
	fmt.Println("  Caravan is running at http://" + displayAddr)
	fmt.Println()

	if caravanConfig.TLSCertPath != "" && caravanConfig.TLSKeyPath != "" {
		fmt.Println("  TLS enabled")
		err = http.ListenAndServeTLS(addr, caravanConfig.TLSCertPath, caravanConfig.TLSKeyPath, handler)
	} else {
		err = http.ListenAndServe(addr, handler)
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
