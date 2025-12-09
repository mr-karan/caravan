# Caravan Documentation

Caravan is a modern web dashboard for [HashiCorp Nomad](https://www.nomadproject.io/).

## Contents

- [Getting Started](./getting-started.md) - Installation and quick start
- [Configuration](./configuration.md) - Command-line flags and options
- [Architecture](./architecture.md) - Technical overview
- [Development](./development.md) - Contributing guide
- [Roadmap](./roadmap.md) - Planned features

## Quick Start

```bash
# Download and run
./caravan

# Open in browser
open http://localhost:4466
```

Or build from source:

```bash
just build
./caravan
```

## Features

- **Multi-cluster** - Connect to multiple Nomad clusters from a single UI
- **Jobs** - View, create, stop, and manage jobs
- **Allocations** - Monitor allocations, view logs, exec into tasks
- **Nodes** - View cluster nodes, manage drain/eligibility
- **Services** - Browse Nomad service discovery registrations
- **Variables** - Manage Nomad variables with secret masking
- **OIDC Support** - SSO authentication via OIDC providers
- **Real-time** - Live updates via Nomad Event Stream

## License

Apache License 2.0
