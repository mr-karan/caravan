# Caravan

<p align="center">
  <img src="./Caravan-Logo-Minimal.svg" alt="Caravan Logo" width="120">
</p>

<p align="center">
  <strong>A modern web UI for <a href="https://www.nomadproject.io/">HashiCorp Nomad</a></strong>
</p>

---

## Features

- **Jobs** — View, manage, and monitor jobs with real-time updates
- **Allocations** — Track status, stream logs, browse files, exec into tasks
- **Nodes** — Monitor cluster nodes, manage drain and eligibility
- **Services** — Browse service registrations and health checks
- **Variables** — Manage Nomad variables with secure reveal
- **Multi-cluster** — Connect to multiple Nomad clusters from a single UI
- **ACL & OIDC** — Full ACL token support and SSO with OIDC providers

## Install

Caravan is a **single binary** with the UI embedded. No database, no config files — just run it.

### Download Binary

Grab the latest release from [GitHub Releases](https://github.com/mr-karan/caravan/releases):

```bash
# Linux (amd64)
curl -sL https://github.com/mr-karan/caravan/releases/latest/download/caravan_linux_amd64.tar.gz | tar xz
./caravan

# macOS (Apple Silicon)
curl -sL https://github.com/mr-karan/caravan/releases/latest/download/caravan_darwin_arm64.zip -o caravan.zip && unzip caravan.zip
./caravan
```

### Docker

```bash
docker run -p 4466:4466 ghcr.io/mr-karan/caravan:latest
```

### Build from Source

```bash
just build-embed
./backend/caravan
```

Open http://localhost:4466 and connect to your Nomad cluster through the UI.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup.

## License

Apache License 2.0

---

Caravan is built on the foundation of [Headlamp](https://github.com/headlamp-k8s/headlamp), an excellent Kubernetes dashboard. We thank the Headlamp team for their work.
