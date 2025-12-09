package config

import (
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/knadh/koanf"
	"github.com/knadh/koanf/providers/basicflag"
	"github.com/knadh/koanf/providers/env"
	"github.com/caravan-nomad/caravan/backend/pkg/logger"
)

const (
	defaultPort = 4466
	osWindows   = "windows"
)

type Config struct {
	Version               bool   `koanf:"version"`
	DevMode               bool   `koanf:"dev"`
	InsecureSsl           bool   `koanf:"insecure-ssl"`
	EnableDynamicClusters bool   `koanf:"enable-dynamic-clusters"`
	ListenAddr            string `koanf:"listen-addr"`
	WatchPluginsChanges   bool   `koanf:"watch-plugins-changes"`
	Port                  uint   `koanf:"port"`
	StaticDir             string `koanf:"html-static-dir"`
	PluginsDir            string `koanf:"plugins-dir"`
	UserPluginsDir        string `koanf:"user-plugins-dir"`
	BaseURL               string `koanf:"base-url"`
	ProxyURLs             string `koanf:"proxy-urls"`
	// TLS config
	TLSCertPath string `koanf:"tls-cert-path"`
	TLSKeyPath  string `koanf:"tls-key-path"`
}

func (c *Config) Validate() error {
	if c.BaseURL != "" && !strings.HasPrefix(c.BaseURL, "/") {
		return errors.New("base-url needs to start with a '/' or be empty")
	}

	return nil
}

// normalizeArgs skips the first arg for flag parsing.
func normalizeArgs(args []string) []string {
	if len(args) == 0 {
		return []string{}
	}

	return args[1:]
}

// loadDefaultsFromFlags loads default flag values into koanf.
func loadDefaultsFromFlags(k *koanf.Koanf, f *flag.FlagSet) error {
	if err := k.Load(basicflag.Provider(f, "."), nil); err != nil {
		logger.Log(logger.LevelError, nil, err, "loading default config from flags")

		return fmt.Errorf("error loading default config from flags: %w", err)
	}

	return nil
}

// parseFlags parses command-line flags using the provided flagset.
func parseFlags(f *flag.FlagSet, args []string) error {
	if err := f.Parse(args); err != nil {
		logger.Log(logger.LevelError, nil, err, "parsing flags")
		return fmt.Errorf("error parsing flags: %w", err)
	}

	return nil
}

// recordExplicitFlags reloads only explicitly-set flag values to override env.
func recordExplicitFlags(f *flag.FlagSet) map[string]bool {
	explicitFlags := make(map[string]bool)

	f.Visit(func(f *flag.Flag) {
		explicitFlags[f.Name] = true
	})

	return explicitFlags
}

// loadConfigFromEnv loads config values from environment variables into koanf.
func loadConfigFromEnv(k *koanf.Koanf) error {
	err := k.Load(env.Provider("CARAVAN_CONFIG_", ".", func(s string) string {
		return strings.ReplaceAll(strings.ToLower(strings.TrimPrefix(s, "CARAVAN_CONFIG_")), "_", "-")
	}), nil)
	if err != nil {
		logger.Log(logger.LevelError, nil, err, "loading config from env")
		return fmt.Errorf("error loading config from env: %w", err)
	}

	return nil
}

// reloadExplicitFlags reloads only explicitly-set flag values to override env.
func reloadExplicitFlags(k *koanf.Koanf, f *flag.FlagSet, explicitFlags map[string]bool) error {
	err := k.Load(basicflag.ProviderWithValue(f, ".", func(key, value string) (string, interface{}) {
		if explicitFlags[key] {
			return key, value
		}

		return "", nil
	}), nil)
	if err != nil {
		logger.Log(logger.LevelError, nil, err, "loading config from flags")
		return fmt.Errorf("error loading config from flags: %w", err)
	}

	return nil
}

// unmarshalConfig unmarshals the config from koanf into our struct.
func unmarshalConfig(k *koanf.Koanf, config *Config) error {
	if err := k.Unmarshal("", config); err != nil {
		logger.Log(logger.LevelError, nil, err, "unmarshalling config")
		return fmt.Errorf("error unmarshal config: %w", err)
	}

	return nil
}

// Parse loads the config from flags and env.
// env vars should start with CARAVAN_CONFIG_ and use _ as separator
// If a value is set both in flags and env then flag takes priority.
func Parse(args []string) (*Config, error) {
	var config Config

	f := flagset()

	k := koanf.New(".")

	args = normalizeArgs(args)

	// 1. Load default flag values into koanf.
	if err := loadDefaultsFromFlags(k, f); err != nil {
		return nil, err
	}

	// 2. Parse command-line arguments.
	if err := parseFlags(f, args); err != nil {
		return nil, err
	}

	// 3. Track explicitly set flags.
	explicitFlags := recordExplicitFlags(f)

	// 4. Load config from environment variables.
	if err := loadConfigFromEnv(k); err != nil {
		return nil, err
	}

	// 5. Reload explicitly-set flags to override env values.
	if err := reloadExplicitFlags(k, f, explicitFlags); err != nil {
		return nil, err
	}

	// 6. Unmarshal into config struct.
	if err := unmarshalConfig(k, &config); err != nil {
		return nil, err
	}

	// 7. Validate parsed config.
	if err := config.Validate(); err != nil {
		logger.Log(logger.LevelError, nil, err, "validating config")
		return nil, err
	}

	return &config, nil
}

func flagset() *flag.FlagSet {
	f := flag.NewFlagSet("config", flag.ContinueOnError)

	addGeneralFlags(f)
	addTLSFlags(f)

	return f
}

func addGeneralFlags(f *flag.FlagSet) {
	f.Bool("version", false, "Print version information and exit")
	f.Bool("dev", false, "Allow connections from other origins")
	f.Bool("insecure-ssl", false, "Accept/Ignore all server SSL certificates")
	f.Bool("enable-dynamic-clusters", true, "Enable adding clusters from the UI (default: true)")
	f.Bool("watch-plugins-changes", true, "Reloads plugins when there are changes to them or their directory")

	f.String("html-static-dir", "", "Static HTML directory to serve")
	f.String("plugins-dir", defaultPluginDir(), "Specify the plugins directory to build the backend with")
	f.String("user-plugins-dir", defaultUserPluginDir(), "Specify the user-installed plugins directory")
	f.String("base-url", "", "Base URL path. eg. /caravan")
	f.String("listen-addr", "", "Address to listen on; default is empty, which means listening to any address")
	f.Uint("port", defaultPort, "Port to listen from")
	f.String("proxy-urls", "", "Allow proxy requests to specified URLs")
}

func addTLSFlags(f *flag.FlagSet) {
	f.String("tls-cert-path", "", "Certificate for serving TLS")
	f.String("tls-key-path", "", "Key for serving TLS")
}

// Gets the default plugins-dir depending on platform.
func defaultPluginDir() string {
	userConfigDir, err := os.UserConfigDir()
	if err != nil {
		logger.Log(logger.LevelError, nil, err, "getting user config dir")
		return ""
	}

	pluginsConfigDir := filepath.Join(userConfigDir, "Caravan", "plugins")
	if runtime.GOOS == osWindows {
		pluginsConfigDir = filepath.Join(userConfigDir, "Caravan", "Config", "plugins")
	}

	fileMode := 0o755

	err = os.MkdirAll(pluginsConfigDir, fs.FileMode(fileMode))
	if err != nil {
		logger.Log(logger.LevelError, nil, err, "creating plugins directory")
		return ""
	}

	return pluginsConfigDir
}

// Gets the default user-plugins-dir depending on platform.
func defaultUserPluginDir() string {
	userConfigDir, err := os.UserConfigDir()
	if err != nil {
		logger.Log(logger.LevelError, nil, err, "getting user config dir")
		return ""
	}

	userPluginsConfigDir := filepath.Join(userConfigDir, "Caravan", "user-plugins")
	if runtime.GOOS == osWindows {
		userPluginsConfigDir = filepath.Join(userConfigDir, "Caravan", "Config", "user-plugins")
	}

	fileMode := 0o755

	err = os.MkdirAll(userPluginsConfigDir, fs.FileMode(fileMode))
	if err != nil {
		logger.Log(logger.LevelError, nil, err, "creating user-plugins directory")
		return ""
	}

	return userPluginsConfigDir
}
