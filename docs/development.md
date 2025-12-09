# Development Guide

This guide covers setting up a development environment and contributing to Caravan.

## Prerequisites

- Go 1.21+
- Node.js 18+ / Bun
- [just](https://github.com/casey/just) (recommended)
- A running Nomad cluster for testing

## Project Structure

```
caravan/
├── backend/           # Go backend server
│   ├── cmd/           # Main application entry point
│   └── pkg/           # Backend packages
│       ├── nomad/     # Nomad API handlers
│       ├── nomadconfig/ # Cluster configuration
│       └── spa/       # Static file serving
├── frontend/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── nomad/ # Nomad-specific components
│   │   ├── lib/
│   │   │   └── nomad/ # Nomad API client
│   │   └── redux/     # State management
│   └── public/
├── docs/              # Documentation
└── justfile           # Build commands
```

## Getting Started

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/yourusername/caravan.git
cd caravan
just install
```

### 2. Start a Nomad Dev Cluster

```bash
# In a separate terminal
nomad agent -dev
```

### 3. Run in Development Mode

```bash
# Set Nomad address
export NOMAD_ADDR=http://localhost:4646

# Run backend and frontend
just dev
```

Or run them separately:

```bash
# Terminal 1: Backend
just run-backend

# Terminal 2: Frontend (with hot reload)
just run-frontend
```

## Development Workflow

### Backend Development

The backend is written in Go and handles:
- Proxying requests to Nomad clusters
- Multi-cluster management
- Static file serving
- Authentication

```bash
# Build backend
just build-backend

# Run tests
just test-backend

# Lint
just lint-backend

# Format code
cd backend && go fmt ./...
```

### Frontend Development

The frontend is a React application using:
- TypeScript
- Material-UI
- Redux for state management
- React Router

```bash
# Build frontend
just build-frontend

# Run tests
just test-frontend

# Type check
just tsc

# Lint
just lint-frontend
```

### Adding a New Nomad Resource

1. **Define types** in `frontend/src/lib/nomad/types.ts`

2. **Create API functions** in `frontend/src/lib/nomad/api/`:
```typescript
// frontend/src/lib/nomad/api/myresource.ts
import { get, post } from './requests';
import { MyResource } from '../types';

export function listMyResources(): Promise<MyResource[]> {
  return get('/v1/myresources');
}

export function getMyResource(id: string): Promise<MyResource> {
  return get(`/v1/myresource/${id}`);
}
```

3. **Export from index** in `frontend/src/lib/nomad/api/index.ts`

4. **Create components** in `frontend/src/components/nomad/myresource/`:
```
myresource/
├── index.ts
├── MyResourceList.tsx
└── MyResourceDetails.tsx
```

5. **Add routes** in `frontend/src/lib/router/nomadRoutes.tsx`

6. **Add sidebar entry** in `frontend/src/components/Sidebar/useSidebarItems.ts`

## Testing

### Backend Tests

```bash
cd backend
go test -v ./...

# With coverage
go test -v -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### Frontend Tests

```bash
cd frontend
npm run test

# With coverage
npm run test -- --coverage
```

## Code Style

### Go

- Follow standard Go conventions
- Use `gofmt` for formatting
- Run `golangci-lint` for linting

### TypeScript/React

- Use TypeScript for type safety
- Follow React hooks conventions
- Use functional components
- Format with Prettier

## Building for Release

### Single Binary (Embedded Frontend)

```bash
just build-embed
# Output: backend/caravan
```

### All Platforms

```bash
just build-all v1.0.0
# Output: backend/dist/caravan_v1.0.0_*
```

## Debugging

### Backend

```bash
# Enable verbose logging
./caravan -dev

# Check Nomad connectivity
just check-nomad
```

### Frontend

- React DevTools browser extension
- Redux DevTools for state inspection
- Browser Network tab for API calls

## Common Issues

### CORS Errors

In development, access via `localhost:3000` (frontend dev server), not `localhost:4466`.

### API Errors

Check that:
1. Nomad is running (`just check-nomad`)
2. Environment variables are set correctly
3. ACL token has required permissions

### Build Failures

```bash
# Clean and rebuild
just clean
just install
just build
```
