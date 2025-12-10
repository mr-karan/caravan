# Contributing to Caravan

Thanks for your interest in contributing to Caravan!

## Prerequisites

- **Go 1.21+**
- **Bun** (or Node.js 20+)
- **just** - command runner ([install](https://github.com/casey/just#installation))
- A running Nomad cluster (or use `just nomad-dev`)

## Getting Started

```bash
# Clone the repo
git clone https://github.com/yourusername/caravan.git
cd caravan

# Install all dependencies
just init

# Start a local Nomad dev agent (in a separate terminal)
just nomad-dev

# Run in development mode
just dev
```

This starts:
- **Backend** at http://localhost:4466
- **Frontend** at http://localhost:3000 (with hot reload)

## Useful Commands

```bash
just --list       # Show all available commands
just dev          # Start dev servers (auto-installs deps)
just build        # Build backend and frontend
just build-embed  # Build single binary with embedded frontend
just test         # Run all tests
just lint         # Lint code
just fmt          # Format code
```

## Project Structure

```
├── backend/      # Go backend (API proxy, auth)
│   ├── cmd/      # Main entrypoint
│   └── pkg/      # Packages (nomad client, spa server, etc.)
├── frontend/     # React frontend
│   └── src/
│       ├── components/  # UI components
│       └── lib/         # API clients, utilities
└── docs/         # Documentation
```

## Development Tips

- The frontend uses React with Material UI
- The backend proxies requests to Nomad and handles authentication
- Use `just check-nomad` to verify your Nomad connection
- Run `just info` to see your current environment

## Submitting Changes

1. Fork the repo and create a feature branch
2. Make your changes
3. Run `just lint` and `just test`
4. Submit a pull request

## Code Style

- Go: standard `gofmt`
- TypeScript/React: ESLint + Prettier (auto-fixed on commit)

