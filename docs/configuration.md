# Configuration Guide

Caravan can be configured using command-line flags and environment variables.

## Command Line Flags

```bash
./caravan [flags]
```

### Server Options

| Flag | Description | Default |
|------|-------------|---------|
| `-port` | Port to listen on | `4466` |
| `-listen-addr` | Address to bind to | `` (all interfaces) |
| `-base-url` | Base URL path (e.g., `/caravan`) | `` |
| `-html-static-dir` | Directory to serve frontend from | (embedded) |
| `-dev` | Enable development mode (allows CORS from other origins) | `false` |

### TLS Options

| Flag | Description | Default |
|------|-------------|---------|
| `-tls-cert-path` | Path to TLS certificate | (none) |
| `-tls-key-path` | Path to TLS private key | (none) |

### Plugin Options

| Flag | Description | Default |
|------|-------------|---------|
| `-plugins-dir` | Directory for plugins | `~/.config/Caravan/plugins` |
| `-user-plugins-dir` | Directory for user-installed plugins | `~/.config/Caravan/user-plugins` |
| `-watch-plugins-changes` | Auto-reload plugins on changes | `true` |

### Other Options

| Flag | Description | Default |
|------|-------------|---------|
| `-version` | Print version and exit | |
| `-insecure-ssl` | Skip TLS verification for upstream connections | `false` |
| `-enable-dynamic-clusters` | Allow adding clusters from the UI | `true` |
| `-proxy-urls` | Comma-separated URLs to allow proxying | `` |

## Environment Variables

All flags can be set via environment variables using the prefix `CARAVAN_CONFIG_`:

```bash
# Flag: -port 8080
export CARAVAN_CONFIG_PORT=8080

# Flag: -base-url /nomad
export CARAVAN_CONFIG_BASE_URL=/nomad

# Flag: -html-static-dir ./dist
export CARAVAN_CONFIG_HTML_STATIC_DIR=./dist
```

**Convention:** Replace hyphens with underscores and use uppercase.

## Examples

### Basic Usage

```bash
# Run with defaults (port 4466, embedded frontend)
./caravan

# Custom port
./caravan -port 8080

# Listen on specific address
./caravan -listen-addr 127.0.0.1 -port 8080
```

### With TLS

```bash
./caravan \
  -tls-cert-path /path/to/cert.pem \
  -tls-key-path /path/to/key.pem
```

### Development Mode

```bash
# Backend only (frontend served by Vite dev server)
./caravan -dev

# Or serve static build
./caravan -html-static-dir ./frontend/build
```

### Behind a Reverse Proxy

```bash
# Serve under /caravan path
./caravan -base-url /caravan
```

## Cluster Configuration

Clusters are managed through the Caravan UI. When you add a cluster in the UI, the configuration is:

1. Stored in the browser's localStorage
2. Synced to the server for the current session

### Adding Clusters via UI

1. Click **Add Cluster** on the home page
2. Enter the cluster details:
   - **Name**: A friendly name for the cluster
   - **Address**: The Nomad server URL (e.g., `https://nomad.example.com:4646`)
   - **Region**: Optional Nomad region
   - **Namespace**: Optional default namespace
3. Choose authentication method:
   - **ACL Token**: Enter a Nomad ACL token directly
   - **OIDC**: Use your organization's SSO provider

### Environment Variables for Nomad

These standard Nomad environment variables are supported when connecting:

| Variable | Description |
|----------|-------------|
| `NOMAD_ADDR` | Nomad server address |
| `NOMAD_TOKEN` | ACL token |
| `NOMAD_REGION` | Default region |
| `NOMAD_NAMESPACE` | Default namespace |
| `NOMAD_CACERT` | CA certificate path |
| `NOMAD_CLIENT_CERT` | Client certificate path |
| `NOMAD_CLIENT_KEY` | Client key path |
| `NOMAD_SKIP_VERIFY` | Skip TLS verification |

## Docker

```bash
docker run -p 4466:4466 caravan:latest
```

With environment variables:

```bash
docker run -p 4466:4466 \
  -e CARAVAN_CONFIG_PORT=4466 \
  caravan:latest
```

## Docker Compose

```yaml
version: '3'
services:
  caravan:
    image: caravan:latest
    ports:
      - "4466:4466"
    environment:
      - CARAVAN_CONFIG_PORT=4466
```
