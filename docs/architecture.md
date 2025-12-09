# Architecture

This document describes the technical architecture of Caravan.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 React Frontend                            │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │   │
│  │  │   Jobs   │  │  Nodes   │  │  Allocs  │  │   ...   │  │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘  │   │
│  │       │              │              │              │       │   │
│  │  ┌────▼──────────────▼──────────────▼──────────────▼────┐ │   │
│  │  │              Nomad API Client (lib/nomad)            │ │   │
│  │  └──────────────────────┬───────────────────────────────┘ │   │
│  └─────────────────────────┼─────────────────────────────────┘   │
└────────────────────────────┼─────────────────────────────────────┘
                             │ HTTP
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Go Backend                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    HTTP Router                            │   │
│  │  /clusters/{cluster}/v1/*  →  Nomad Proxy                │   │
│  │  /config                   →  Cluster Config             │   │
│  │  /plugins/*                →  Plugin System              │   │
│  │  /*                        →  Static Files (SPA)         │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Context Store                             │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                  │   │
│  │  │ Cluster │  │ Cluster │  │ Cluster │                  │   │
│  │  │   #1    │  │   #2    │  │   #3    │                  │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘                  │   │
│  └───────┼────────────┼────────────┼───────────────────────┘   │
└──────────┼────────────┼────────────┼───────────────────────────┘
           │            │            │
           ▼            ▼            ▼
      ┌─────────┐  ┌─────────┐  ┌─────────┐
      │  Nomad  │  │  Nomad  │  │  Nomad  │
      │ Cluster │  │ Cluster │  │ Cluster │
      └─────────┘  └─────────┘  └─────────┘
```

## Components

### Frontend (React)

The frontend is a single-page application built with:

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Material-UI** - Component library
- **Redux Toolkit** - State management
- **React Router** - Client-side routing

#### Key Modules

```
frontend/src/
├── components/
│   ├── App/              # Main app shell
│   ├── Sidebar/          # Navigation sidebar
│   ├── common/           # Shared components
│   └── nomad/            # Nomad resource components
│       ├── job/          # Job list & details
│       ├── allocation/   # Allocation views
│       └── node/         # Node management
├── lib/
│   ├── nomad/            # Nomad API client
│   │   ├── api/          # API request functions
│   │   └── types.ts      # TypeScript types
│   └── router/           # Route definitions
└── redux/                # Redux state slices
```

### Backend (Go)

The backend is a Go HTTP server that:

1. **Proxies requests** to Nomad clusters
2. **Manages clusters** - Multiple cluster support
3. **Serves static files** - SPA and plugins
4. **Handles auth** - Token forwarding

#### Key Packages

```
backend/pkg/
├── nomad/           # Nomad API proxy handlers
├── nomadconfig/     # Cluster configuration
│   ├── nomadconfig.go   # Context definition
│   └── contextstore.go  # Multi-cluster store
├── spa/             # Static file serving
└── logger/          # Logging utilities
```

### Request Flow

1. **Browser** makes request to `/clusters/production/v1/jobs`
2. **Backend router** matches pattern, extracts `production` cluster
3. **Context store** looks up cluster configuration
4. **Proxy** forwards request to Nomad with token header
5. **Response** returned to frontend
6. **React** updates UI state

### Multi-Cluster Architecture

```
┌─────────────────────────────────────────┐
│            Context Store                │
│  ┌─────────────────────────────────┐   │
│  │     map[string]*Context         │   │
│  │                                  │   │
│  │  "production" → Context{        │   │
│  │    Address: "https://prod:4646" │   │
│  │    Token: "xxx"                 │   │
│  │    proxy: *ReverseProxy         │   │
│  │  }                              │   │
│  │                                  │   │
│  │  "staging" → Context{           │   │
│  │    Address: "https://stg:4646"  │   │
│  │    Token: "yyy"                 │   │
│  │    proxy: *ReverseProxy         │   │
│  │  }                              │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

Each cluster context maintains:
- Connection configuration (address, TLS, token)
- Reverse proxy instance
- Nomad API client

## Data Flow

### Listing Jobs

```
User clicks "Jobs"
       │
       ▼
React Router → JobList component
       │
       ▼
useEffect() calls listJobs()
       │
       ▼
nomadRequest('/v1/jobs')
       │
       ▼
fetch('/clusters/{cluster}/v1/jobs')
       │
       ▼
Go Backend receives request
       │
       ▼
Router extracts cluster from path
       │
       ▼
ContextStore.GetContext(cluster)
       │
       ▼
context.ProxyRequest() → Nomad
       │
       ▼
Response flows back
       │
       ▼
React updates state, renders table
```

## Authentication

### ACL Token Flow

1. **User** enters token in UI (or uses env var)
2. **Frontend** stores token in localStorage per cluster
3. **API requests** include `X-Nomad-Token` header
4. **Backend** forwards header to Nomad
5. **Nomad** validates token, returns data

### Token Storage

```javascript
// Frontend stores per-cluster tokens
localStorage.setItem(`nomad_token_${cluster}`, token);

// Requests include token header
headers['X-Nomad-Token'] = localStorage.getItem(`nomad_token_${cluster}`);
```

## Plugin System

The plugin system allows extending Caravan:

```
plugins/
└── my-plugin/
    ├── package.json
    └── src/
        └── index.tsx    # Plugin entry point
```

Plugins can:
- Add sidebar entries
- Register new routes
- Add detail view sections
- Customize the app bar

## Embedding

For single-binary distribution, the frontend is embedded:

```go
//go:embed static/*
var staticFiles embed.FS
```

Build with `-tags embed` to include static files in the binary.
