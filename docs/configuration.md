# Configuration Guide

Caravan can be configured using environment variables for flexibility across different deployment scenarios.

## Environment Variables

### Nomad Connection

| Variable | Description | Default |
|----------|-------------|---------|
| `NOMAD_ADDR` | Nomad server HTTP address | `http://127.0.0.1:4646` |
| `NOMAD_TOKEN` | ACL token for authentication | (none) |
| `NOMAD_REGION` | Default Nomad region | (from Nomad) |
| `NOMAD_NAMESPACE` | Default namespace | `default` |
| `NOMAD_CLUSTER_NAME` | Display name for the cluster | `default` |

### TLS Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NOMAD_CACERT` | Path to CA certificate | (none) |
| `NOMAD_CLIENT_CERT` | Path to client certificate | (none) |
| `NOMAD_CLIENT_KEY` | Path to client private key | (none) |
| `NOMAD_SKIP_VERIFY` | Skip TLS verification | `false` |

### Server

| Variable | Description | Default |
|----------|-------------|---------|
| `CARAVAN_PORT` | Port to listen on | `4466` |
| `CARAVAN_BASE_URL` | Base URL path | `/` |

## Multi-Cluster Setup {#multi-cluster}

Connect to multiple Nomad clusters by defining them via environment variables.

### Using CARAVAN_CLUSTERS

```bash
# Define cluster names (comma-separated)
export CARAVAN_CLUSTERS=production,staging,local

# Production cluster
export NOMAD_ADDR_PRODUCTION=https://nomad.prod.example.com:4646
export NOMAD_TOKEN_PRODUCTION=prod-acl-token
export NOMAD_REGION_PRODUCTION=us-east-1
export NOMAD_CACERT_PRODUCTION=/path/to/prod-ca.pem

# Staging cluster
export NOMAD_ADDR_STAGING=https://nomad.staging.example.com:4646
export NOMAD_TOKEN_STAGING=staging-acl-token
export NOMAD_REGION_STAGING=us-west-2

# Local development cluster
export NOMAD_ADDR_LOCAL=http://localhost:4646
```

### Environment Variable Naming

For multi-cluster configuration, append the uppercase cluster name to each variable:

- `NOMAD_ADDR_<CLUSTER>` - Server address
- `NOMAD_TOKEN_<CLUSTER>` - ACL token
- `NOMAD_REGION_<CLUSTER>` - Region
- `NOMAD_NAMESPACE_<CLUSTER>` - Namespace
- `NOMAD_CACERT_<CLUSTER>` - CA certificate path
- `NOMAD_SKIP_VERIFY_<CLUSTER>` - Skip TLS verification

**Note:** Cluster names with hyphens become underscores (e.g., `my-cluster` → `NOMAD_ADDR_MY_CLUSTER`)

### Fallback Behavior

For the first cluster in the list, standard `NOMAD_*` variables are used as fallbacks if cluster-specific variables aren't set.

## Example Configurations

### Local Development

```bash
export NOMAD_ADDR=http://localhost:4646
```

### Production with TLS

```bash
export NOMAD_ADDR=https://nomad.example.com:4646
export NOMAD_TOKEN=your-management-token
export NOMAD_CACERT=/etc/nomad.d/ca.pem
export NOMAD_CLIENT_CERT=/etc/nomad.d/client.pem
export NOMAD_CLIENT_KEY=/etc/nomad.d/client-key.pem
export NOMAD_CLUSTER_NAME=production
```

### Multiple Environments

```bash
# Define clusters
export CARAVAN_CLUSTERS=prod,staging,dev

# Production (us-east)
export NOMAD_ADDR_PROD=https://nomad.prod.example.com:4646
export NOMAD_TOKEN_PROD=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
export NOMAD_REGION_PROD=us-east-1

# Staging (us-west)
export NOMAD_ADDR_STAGING=https://nomad.staging.example.com:4646
export NOMAD_TOKEN_STAGING=11111111-2222-3333-4444-555555555555
export NOMAD_REGION_STAGING=us-west-2

# Dev (local)
export NOMAD_ADDR_DEV=http://localhost:4646
```

## Command Line Flags

The backend server accepts several command line flags:

```bash
./caravan [flags]

Flags:
  -html-static-dir string   Directory to serve static files from
  -listen-addr string       Address to listen on (default "0.0.0.0:4466")
  -dev                      Enable development mode
```

### Examples

```bash
# Serve embedded frontend (default)
./caravan

# Serve frontend from directory
./caravan -html-static-dir ./frontend/build

# Listen on different port
./caravan -listen-addr 0.0.0.0:8080

# Development mode (more verbose logging)
./caravan -dev
```

## Docker Configuration

When running in Docker, pass environment variables:

```bash
docker run -p 4466:4466 \
  -e NOMAD_ADDR=http://host.docker.internal:4646 \
  -e NOMAD_TOKEN=your-token \
  caravan:latest
```

For Docker Compose:

```yaml
version: '3'
services:
  caravan:
    image: caravan:latest
    ports:
      - "4466:4466"
    environment:
      - NOMAD_ADDR=http://nomad:4646
      - NOMAD_TOKEN=${NOMAD_TOKEN}
```
