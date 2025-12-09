# Caravan

A modern web UI for [HashiCorp Nomad](https://www.nomadproject.io/) with multi-cluster support.

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)

## About

Caravan is a fork of [Headlamp](https://github.com/headlamp-k8s/headlamp), originally a Kubernetes dashboard. It has been extensively modified to work with HashiCorp Nomad instead of Kubernetes, providing a clean and intuitive interface for managing your Nomad clusters.

## Features

- **Jobs** - View, manage, and monitor Nomad jobs
- **Allocations** - Track allocation status, view logs, restart tasks
- **Nodes** - Monitor cluster nodes, manage drain and eligibility
- **Multi-cluster** - Connect to multiple Nomad clusters from a single UI
- **ACL Support** - Full ACL token authentication

## Quick Start

### Prerequisites

- Go 1.21+
- Node.js 18+ or Bun
- A running Nomad cluster

### Build & Run

```bash
# Clone the repo
git clone https://github.com/yourusername/caravan.git
cd caravan

# Install dependencies
just install

# Set Nomad address
export NOMAD_ADDR=http://localhost:4646

# Build and run
just build
just run-backend
```

Open http://localhost:4466 in your browser.

### Development Mode

```bash
# Run with hot reload
just dev
```

## Multi-Cluster Setup

```bash
# Define clusters
export CARAVAN_CLUSTERS=prod,staging,local

# Production
export NOMAD_ADDR_PROD=https://nomad.prod.example.com:4646
export NOMAD_TOKEN_PROD=your-token

# Staging
export NOMAD_ADDR_STAGING=https://nomad.staging.example.com:4646

# Local
export NOMAD_ADDR_LOCAL=http://localhost:4646
```

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Configuration](./docs/configuration.md)
- [Development](./docs/development.md)
- [Architecture](./docs/architecture.md)
- [Roadmap](./docs/roadmap.md)

## Commands

```bash
just --list          # Show all commands
just build           # Build backend and frontend
just dev             # Run in development mode
just test            # Run all tests
just build-embed     # Build single binary with embedded frontend
```

## Project Structure

```
├── backend/         # Go backend server
├── frontend/        # React frontend
├── docs/            # Documentation
└── justfile         # Build commands
```

## Contributing

Contributions are welcome! See the [development guide](./docs/development.md) and [roadmap](./docs/roadmap.md).

## License

Apache License 2.0 - see [LICENSE](./LICENSE) for details.

## Acknowledgments

Caravan is built on the foundation of [Headlamp](https://github.com/headlamp-k8s/headlamp), an excellent Kubernetes dashboard created by [Kinvolk](https://kinvolk.io/) (now part of Microsoft). We thank the Headlamp team and contributors for their work.
