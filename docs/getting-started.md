# Getting Started

This guide will help you get Caravan up and running.

## Prerequisites

- A running Nomad cluster (v1.4+)
- Go 1.21+ (for building from source)
- Node.js 18+ or Bun (for building frontend)
- [just](https://github.com/casey/just) command runner (optional but recommended)

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/caravan.git
cd caravan

# Install dependencies
just install

# Build everything
just build
```

### Pre-built Binaries

Download the latest release for your platform from the releases page.

## Configuration

### Single Cluster (Environment Variables)

The simplest way to connect to a Nomad cluster:

```bash
# Required: Nomad server address
export NOMAD_ADDR=http://localhost:4646

# Optional: ACL token for authentication
export NOMAD_TOKEN=your-acl-token

# Optional: Default region
export NOMAD_REGION=global

# Optional: Default namespace
export NOMAD_NAMESPACE=default

# Optional: Custom cluster name (defaults to "default")
export NOMAD_CLUSTER_NAME=my-cluster
```

### TLS Configuration

For secure connections:

```bash
export NOMAD_ADDR=https://nomad.example.com:4646
export NOMAD_CACERT=/path/to/ca.pem
export NOMAD_CLIENT_CERT=/path/to/client.pem
export NOMAD_CLIENT_KEY=/path/to/client-key.pem

# Or to skip verification (not recommended for production)
export NOMAD_SKIP_VERIFY=true
```

## Running

### Development Mode

For development with hot reload:

```bash
# Terminal 1: Run backend
just run-backend

# Terminal 2: Run frontend dev server
just run-frontend
```

Or run both together:

```bash
just dev
```

Access the UI at http://localhost:3000 (frontend dev server proxies to backend).

### Production Mode

Build and run with embedded frontend:

```bash
# Build single binary with embedded frontend
just build-embed

# Run the server
./backend/caravan
```

Access the UI at http://localhost:4466.

### With Pre-built Frontend

```bash
# Build frontend
just build-frontend

# Run backend serving static files
./backend/caravan -html-static-dir ./frontend/build
```

## Verifying the Setup

1. Open http://localhost:4466 (or :3000 in dev mode)
2. You should see the Caravan dashboard
3. Navigate to Jobs, Nodes, or Allocations to verify connectivity

### Troubleshooting

**Cannot connect to Nomad:**
```bash
# Verify Nomad is reachable
just check-nomad

# Or manually
curl $NOMAD_ADDR/v1/status/leader
```

**CORS errors in browser:**
- Make sure you're accessing via the backend port (4466), not directly
- In dev mode, the frontend dev server proxies API calls

**Authentication errors:**
- Verify your NOMAD_TOKEN is valid
- Check ACL policies allow the required permissions

## Next Steps

- [Configuration Guide](./configuration.md) - Advanced configuration options
- [Multi-cluster Setup](./configuration.md#multi-cluster) - Connect to multiple clusters
- [Development Guide](./development.md) - Contributing to the project
