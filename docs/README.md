# Caravan Documentation

Caravan is a web-based dashboard for [HashiCorp Nomad](https://www.nomadproject.io/), providing a modern interface for managing and monitoring your Nomad clusters.

## Contents

- [Getting Started](./getting-started.md) - Installation and quick start guide
- [Configuration](./configuration.md) - Configuration options and multi-cluster setup
- [Development](./development.md) - Contributing and development setup
- [Architecture](./architecture.md) - Technical architecture overview
- [Roadmap](./roadmap.md) - Planned features and development roadmap

## Quick Start

```bash
# Set your Nomad address
export NOMAD_ADDR=http://localhost:4646

# Build and run
just build
just run-backend

# Or for development with hot reload
just dev
```

Then open http://localhost:4466 in your browser.

## Features

- **Jobs Management** - View, create, stop, and manage Nomad jobs
- **Allocations** - Monitor allocations, view logs, restart tasks
- **Nodes** - View cluster nodes, drain nodes, manage eligibility
- **Multi-cluster** - Connect to multiple Nomad clusters
- **ACL Support** - Full ACL token authentication support
- **Real-time Updates** - Live updates via Nomad Event Stream

## Requirements

- Go 1.21+ (for building backend)
- Node.js 18+ (for building frontend)
- A running Nomad cluster (v1.4+)

## License

Apache License 2.0
