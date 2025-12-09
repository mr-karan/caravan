# Getting Started

Get Caravan up and running in minutes.

## Prerequisites

- A running Nomad cluster (v1.4+)
- Go 1.21+ (for building from source)
- Node.js 18+ or Bun (for building frontend)

## Quick Start

### Option 1: Download Release

Download the latest release for your platform from the [releases page](https://github.com/caravan-nomad/caravan/releases).

```bash
# Make executable
chmod +x caravan

# Run
./caravan
```

Open http://localhost:4466 in your browser.

### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/caravan-nomad/caravan.git
cd caravan

# Build (requires just command runner)
just build

# Run
./caravan
```

## Adding Your First Cluster

1. Open http://localhost:4466
2. Click **Add Cluster**
3. Enter your cluster details:
   - **Name**: e.g., `production`
   - **Address**: e.g., `https://nomad.example.com:4646`
4. Choose authentication:
   - **ACL Token**: Paste your Nomad token
   - **OIDC**: Use SSO (if configured)
5. Click **Add Cluster**

That's it! You can now browse your Nomad jobs, nodes, and allocations.

## Development Setup

For contributing or local development:

```bash
# Terminal 1: Run the server
just run

# Terminal 2: Run frontend dev server with hot reload
just run-frontend
```

Access the dev UI at http://localhost:3000.

## Verify Installation

```bash
# Check Caravan is running
curl http://localhost:4466/config

# Check Nomad connectivity (after adding a cluster)
curl http://localhost:4466/api/clusters/your-cluster/v1/status/leader
```

## Troubleshooting

### Cannot connect to Nomad

```bash
# Verify Nomad is reachable directly
curl $NOMAD_ADDR/v1/status/leader
```

### Authentication errors

- Verify your ACL token has the required permissions
- For OIDC, ensure your auth method is configured in Nomad

### TLS errors

- Check certificate paths are correct
- Try `-insecure-ssl` flag for testing (not recommended for production)

## Next Steps

- [Configuration Guide](./configuration.md) - All configuration options
- [Architecture](./architecture.md) - How Caravan works
- [Development Guide](./development.md) - Contributing to the project
