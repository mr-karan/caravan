package nomadconfig

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"runtime"
	"strings"

	"github.com/hashicorp/nomad/api"
	"github.com/caravan-nomad/caravan/backend/pkg/logger"
)

var (
	Version = "unknown"
	AppName = "Caravan"
)

// Source constants for where the context was loaded from
const (
	EnvVar = 1 << iota
	DynamicCluster
	InCluster
)

// DefaultClusterName is the name used when a single cluster is configured via env vars
const DefaultClusterName = "default"

// TLSConfig holds TLS configuration for Nomad connections
type TLSConfig struct {
	CACert     string `json:"caCert"`
	ClientCert string `json:"clientCert"`
	ClientKey  string `json:"clientKey"`
	Insecure   bool   `json:"insecure"`
}

// Context contains all information related to a Nomad cluster context
type Context struct {
	Name      string                 `json:"name"`
	Address   string                 `json:"address"`
	Region    string                 `json:"region"`
	Namespace string                 `json:"namespace"`
	Token     string                 `json:"token,omitempty"`
	TLS       *TLSConfig             `json:"tls,omitempty"`
	Source    int                    `json:"source"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	Error     string                 `json:"error,omitempty"`
	proxy     *httputil.ReverseProxy `json:"-"`
	client    *api.Client            `json:"-"`
}

// userAgentRoundTripper wraps an http.RoundTripper and adds a Caravan User-Agent header
type userAgentRoundTripper struct {
	base      http.RoundTripper
	userAgent string
}

func (rt *userAgentRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	newReq := req.Clone(req.Context())
	newReq.Header.Set("User-Agent", rt.userAgent)
	return rt.base.RoundTrip(newReq)
}

// buildUserAgent creates a User-Agent string for Caravan
func buildUserAgent() string {
	return fmt.Sprintf("%s %s (%s/%s)", AppName, Version, runtime.GOOS, runtime.GOARCH)
}

// GetClient returns a configured Nomad API client for this context
func (c *Context) GetClient() (*api.Client, error) {
	if c.client != nil {
		return c.client, nil
	}

	cfg := api.DefaultConfig()

	if c.Address != "" {
		cfg.Address = c.Address
	}
	if c.Region != "" {
		cfg.Region = c.Region
	}
	if c.Namespace != "" {
		cfg.Namespace = c.Namespace
	}
	if c.Token != "" {
		cfg.SecretID = c.Token
	}

	if c.TLS != nil {
		cfg.TLSConfig = &api.TLSConfig{
			CACert:        c.TLS.CACert,
			ClientCert:    c.TLS.ClientCert,
			ClientKey:     c.TLS.ClientKey,
			Insecure:      c.TLS.Insecure,
		}
	}

	client, err := api.NewClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create Nomad client: %w", err)
	}

	c.client = client
	return client, nil
}

// GetClientWithToken returns a Nomad client configured with the given token
func (c *Context) GetClientWithToken(token string) (*api.Client, error) {
	cfg := api.DefaultConfig()

	if c.Address != "" {
		cfg.Address = c.Address
	}
	if c.Region != "" {
		cfg.Region = c.Region
	}
	if c.Namespace != "" {
		cfg.Namespace = c.Namespace
	}

	// Use provided token or fall back to context token
	if token != "" {
		cfg.SecretID = token
	} else if c.Token != "" {
		cfg.SecretID = c.Token
	}

	if c.TLS != nil {
		cfg.TLSConfig = &api.TLSConfig{
			CACert:        c.TLS.CACert,
			ClientCert:    c.TLS.ClientCert,
			ClientKey:     c.TLS.ClientKey,
			Insecure:      c.TLS.Insecure,
		}
	}

	return api.NewClient(cfg)
}

// SetupProxy sets up a reverse proxy for the context
func (c *Context) SetupProxy() error {
	URL, err := url.Parse(c.Address)
	if err != nil {
		return fmt.Errorf("failed to parse address: %w", err)
	}

	proxy := httputil.NewSingleHostReverseProxy(URL)

	// Configure custom transport with user agent
	transport := &http.Transport{}

	if c.TLS != nil && c.TLS.Insecure {
		transport.TLSClientConfig = nil // Will use default with InsecureSkipVerify
	}

	proxy.Transport = &userAgentRoundTripper{
		base:      transport,
		userAgent: buildUserAgent(),
	}

	c.proxy = proxy

	logger.Log(logger.LevelInfo, map[string]string{"context": c.Name, "clusterURL": c.Address},
		nil, "Proxy setup")

	return nil
}

// ProxyRequest proxies the given request to the Nomad cluster
func (c *Context) ProxyRequest(writer http.ResponseWriter, request *http.Request) error {
	if c.proxy == nil {
		err := c.SetupProxy()
		if err != nil {
			return err
		}
	}

	c.proxy.ServeHTTP(writer, request)
	return nil
}

// SourceStr returns the source from which the context was loaded
func (c *Context) SourceStr() string {
	switch c.Source {
	case EnvVar:
		return "env_var"
	case DynamicCluster:
		return "dynamic_cluster"
	case InCluster:
		return "incluster"
	default:
		return "unknown"
	}
}

// AuthType returns the authentication type for the context
func (c *Context) AuthType() string {
	if c.Token != "" {
		return "token"
	}
	return ""
}

// LoadFromEnv loads a single context from standard Nomad environment variables
// Environment variables used:
// - NOMAD_ADDR: Nomad server address (required)
// - NOMAD_TOKEN: ACL token for authentication
// - NOMAD_REGION: Default region
// - NOMAD_NAMESPACE: Default namespace
// - NOMAD_CACERT: Path to CA certificate
// - NOMAD_CLIENT_CERT: Path to client certificate
// - NOMAD_CLIENT_KEY: Path to client key
// - NOMAD_SKIP_VERIFY: Skip TLS verification
// - NOMAD_CLUSTER_NAME: Optional cluster name (defaults to "default")
//
// Returns nil if NOMAD_ADDR is not set (no default cluster created).
func LoadFromEnv() (*Context, error) {
	// Only create a context if NOMAD_ADDR is explicitly set
	addr := os.Getenv("NOMAD_ADDR")
	if addr == "" {
		// No cluster configured via env vars - this is fine
		return nil, nil
	}

	name := os.Getenv("NOMAD_CLUSTER_NAME")
	if name == "" {
		name = DefaultClusterName
	}

	ctx := &Context{
		Name:      name,
		Address:   addr,
		Region:    os.Getenv("NOMAD_REGION"),
		Namespace: os.Getenv("NOMAD_NAMESPACE"),
		Token:     os.Getenv("NOMAD_TOKEN"),
		Source:    EnvVar,
	}

	// Load TLS config from env vars
	caCert := os.Getenv("NOMAD_CACERT")
	clientCert := os.Getenv("NOMAD_CLIENT_CERT")
	clientKey := os.Getenv("NOMAD_CLIENT_KEY")
	skipVerify := os.Getenv("NOMAD_SKIP_VERIFY") == "true" || os.Getenv("NOMAD_SKIP_VERIFY") == "1"

	if caCert != "" || clientCert != "" || clientKey != "" || skipVerify {
		ctx.TLS = &TLSConfig{
			CACert:     caCert,
			ClientCert: clientCert,
			ClientKey:  clientKey,
			Insecure:   skipVerify,
		}
	}

	return ctx, nil
}

// LoadMultiClusterFromEnv loads multiple clusters from environment variables
// Environment variables used:
// - CARAVAN_CLUSTERS: Comma-separated list of cluster names
// - NOMAD_ADDR_<CLUSTER>: Address for specific cluster (uppercase, required)
// - NOMAD_TOKEN_<CLUSTER>: Token for specific cluster (uppercase)
// - NOMAD_REGION_<CLUSTER>: Region for specific cluster (uppercase)
// - NOMAD_NAMESPACE_<CLUSTER>: Namespace for specific cluster (uppercase)
// - NOMAD_CACERT_<CLUSTER>: CA cert path for specific cluster (uppercase)
// - NOMAD_SKIP_VERIFY_<CLUSTER>: Skip TLS verify for specific cluster (uppercase)
//
// Returns an empty list if no clusters are configured (no error).
func LoadMultiClusterFromEnv() ([]*Context, error) {
	clustersEnv := os.Getenv("CARAVAN_CLUSTERS")
	if clustersEnv == "" {
		// Fall back to single cluster from standard env vars
		ctx, err := LoadFromEnv()
		if err != nil {
			return nil, err
		}
		// If no NOMAD_ADDR is set, return empty list (no default cluster)
		if ctx == nil {
			return []*Context{}, nil
		}
		return []*Context{ctx}, nil
	}

	clusterNames := strings.Split(clustersEnv, ",")
	contexts := make([]*Context, 0, len(clusterNames))

	for _, name := range clusterNames {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}

		upperName := strings.ToUpper(strings.ReplaceAll(name, "-", "_"))

		addr := os.Getenv("NOMAD_ADDR_" + upperName)
		if addr == "" {
			// Try default NOMAD_ADDR as fallback for first cluster
			if len(contexts) == 0 {
				addr = os.Getenv("NOMAD_ADDR")
			}
			if addr == "" {
				// Skip clusters without an address configured
				logger.Log(logger.LevelWarn, map[string]string{"cluster": name}, nil,
					"Skipping cluster - no address configured")
				continue
			}
		}

		token := os.Getenv("NOMAD_TOKEN_" + upperName)
		if token == "" && len(contexts) == 0 {
			token = os.Getenv("NOMAD_TOKEN")
		}

		region := os.Getenv("NOMAD_REGION_" + upperName)
		if region == "" && len(contexts) == 0 {
			region = os.Getenv("NOMAD_REGION")
		}

		namespace := os.Getenv("NOMAD_NAMESPACE_" + upperName)
		if namespace == "" && len(contexts) == 0 {
			namespace = os.Getenv("NOMAD_NAMESPACE")
		}

		ctx := &Context{
			Name:      makeDNSFriendly(name),
			Address:   addr,
			Region:    region,
			Namespace: namespace,
			Token:     token,
			Source:    EnvVar,
		}

		// Load TLS config
		caCert := os.Getenv("NOMAD_CACERT_" + upperName)
		if caCert == "" && len(contexts) == 0 {
			caCert = os.Getenv("NOMAD_CACERT")
		}

		skipVerify := os.Getenv("NOMAD_SKIP_VERIFY_"+upperName) == "true" ||
			os.Getenv("NOMAD_SKIP_VERIFY_"+upperName) == "1"
		if !skipVerify && len(contexts) == 0 {
			skipVerify = os.Getenv("NOMAD_SKIP_VERIFY") == "true" ||
				os.Getenv("NOMAD_SKIP_VERIFY") == "1"
		}

		if caCert != "" || skipVerify {
			ctx.TLS = &TLSConfig{
				CACert:   caCert,
				Insecure: skipVerify,
			}
		}

		contexts = append(contexts, ctx)
	}

	// Return empty list if no clusters configured - this is fine
	return contexts, nil
}

// makeDNSFriendly converts a string to a DNS-friendly format
func makeDNSFriendly(name string) string {
	name = strings.ReplaceAll(name, "/", "--")
	name = strings.ReplaceAll(name, " ", "__")
	return name
}

// ContextError is an error that occurs in a context
type ContextError struct {
	ContextName string
	Reason      string
}

// Error returns a string representation of the error
func (e ContextError) Error() string {
	return fmt.Sprintf("Error in context '%s': %s", e.ContextName, e.Reason)
}
