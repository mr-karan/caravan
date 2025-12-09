# Nomad Caravan - Development Commands
# Run `just --list` to see all available commands

set dotenv-load := true

# Default recipe - show help
default:
    @just --list

# ============================================================================
# Development
# ============================================================================

# Run everything needed for development (backend + frontend)
dev: build-backend
    #!/usr/bin/env bash
    echo "Starting Nomad Caravan in development mode..."
    echo "Backend: http://localhost:4466"
    echo "Frontend: http://localhost:3000"
    echo ""
    echo "Make sure NOMAD_ADDR is set (default: http://127.0.0.1:4646)"
    trap 'kill 0' EXIT
    just run-backend &
    sleep 2
    just run-frontend &
    wait

# Run the Go backend server (builds first)
run-backend: build-backend
    cd backend && ./caravan

# Run the frontend dev server
run-frontend:
    cd frontend && bun run start

# ============================================================================
# Building
# ============================================================================

# Build everything (backend + frontend)
build: build-backend build-frontend
    @echo "Build complete!"

# Build the Go backend
build-backend:
    cd backend && go build -o caravan ./cmd

# Build the frontend
build-frontend:
    cd frontend && bun run build

# Build a single binary with embedded frontend
build-embed: build-frontend
    #!/usr/bin/env bash
    echo "Preparing static files for embedding..."
    rm -rf backend/pkg/spa/static
    mkdir -p backend/pkg/spa/static
    cp -R frontend/build/* backend/pkg/spa/static/
    cd backend && go build -tags embed -o caravan ./cmd
    echo "Built: backend/caravan (with embedded frontend)"

# Build for all platforms
build-all version="dev":
    #!/usr/bin/env bash
    just build-frontend
    rm -rf backend/pkg/spa/static
    mkdir -p backend/pkg/spa/static
    cp -R frontend/build/* backend/pkg/spa/static/
    mkdir -p backend/dist

    echo "Building for all platforms (version: {{version}})..."

    # Linux
    echo "  → linux/amd64"
    cd backend && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -tags embed -o dist/caravan_{{version}}_linux_amd64 ./cmd
    echo "  → linux/arm64"
    cd backend && CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -tags embed -o dist/caravan_{{version}}_linux_arm64 ./cmd

    # macOS
    echo "  → darwin/amd64"
    cd backend && CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -tags embed -o dist/caravan_{{version}}_darwin_amd64 ./cmd
    echo "  → darwin/arm64"
    cd backend && CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -tags embed -o dist/caravan_{{version}}_darwin_arm64 ./cmd

    # Windows
    echo "  → windows/amd64"
    cd backend && CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -tags embed -o dist/caravan_{{version}}_windows_amd64.exe ./cmd

    echo "All builds complete! Files in backend/dist/"
    ls -la backend/dist/

# ============================================================================
# Testing & Quality
# ============================================================================

# Run all tests
test: test-backend test-frontend
    @echo "All tests passed!"

# Run backend tests
test-backend:
    cd backend && go test -v ./...

# Run frontend tests
test-frontend:
    cd frontend && bun run test

# Type check frontend
tsc:
    cd frontend && bun run tsc

# Lint everything
lint: lint-backend lint-frontend

# Lint backend code
lint-backend:
    cd backend && golangci-lint run

# Lint frontend code
lint-frontend:
    cd frontend && bun run lint

# Fix linting issues
lint-fix:
    cd backend && golangci-lint run --fix || true
    cd frontend && bun run lint -- --fix || true

# Format code
fmt:
    cd backend && go fmt ./...
    cd frontend && bun run format || true

# ============================================================================
# Dependencies
# ============================================================================

# Install all dependencies
install: install-backend install-frontend
    @echo "All dependencies installed!"

# Install backend dependencies
install-backend:
    cd backend && go mod download

# Install frontend dependencies
install-frontend:
    cd frontend && bun install

# Update dependencies
update:
    cd backend && go get -u ./... && go mod tidy
    cd frontend && bun update

# ============================================================================
# Cleanup
# ============================================================================

# Clean build artifacts
clean:
    rm -rf backend/caravan
    rm -rf backend/dist
    rm -rf backend/pkg/spa/static
    rm -rf frontend/build
    @echo "Cleaned build artifacts"

# Deep clean (including dependencies)
clean-all: clean
    rm -rf frontend/node_modules
    rm -rf frontend/.bun
    @echo "Deep clean complete"

# ============================================================================
# Docker
# ============================================================================

# Build Docker image
docker-build tag="latest":
    docker build -t nomad-caravan:{{tag}} .

# Run in Docker
docker-run tag="latest":
    docker run -p 4466:4466 -e NOMAD_ADDR=${NOMAD_ADDR:-http://host.docker.internal:4646} nomad-caravan:{{tag}}

# ============================================================================
# Utilities
# ============================================================================

# Start a local Nomad dev agent
nomad-dev:
    @echo "Starting Nomad in dev mode..."
    nomad agent -dev

# Check if Nomad is reachable
check-nomad:
    #!/usr/bin/env bash
    ADDR="${NOMAD_ADDR:-http://127.0.0.1:4646}"
    echo "Checking Nomad at $ADDR..."
    if curl -s "$ADDR/v1/status/leader" > /dev/null; then
        echo "✓ Nomad is reachable"
        echo "Leader: $(curl -s $ADDR/v1/status/leader)"
    else
        echo "✗ Cannot reach Nomad at $ADDR"
        exit 1
    fi

# Show project info
info:
    @echo "Nomad Caravan"
    @echo "=============="
    @echo ""
    @echo "Environment:"
    @echo "  NOMAD_ADDR: ${NOMAD_ADDR:-http://127.0.0.1:4646 (default)}"
    @echo "  NOMAD_TOKEN: ${NOMAD_TOKEN:-(not set)}"
    @echo ""
    @echo "Directories:"
    @echo "  Backend:  ./backend"
    @echo "  Frontend: ./frontend"
    @echo "  Docs:     ./docs"
