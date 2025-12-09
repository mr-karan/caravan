# Development Roadmap

This document outlines the planned features and improvements for Caravan.

## Current Status

### Working Features ✅

- [x] Multi-cluster configuration via environment variables
- [x] Backend proxy to Nomad API
- [x] Frontend React application shell
- [x] Jobs list view
- [x] Job details view
- [x] Nodes list view
- [x] Node details view
- [x] Allocations list view
- [x] Allocation details view
- [x] Basic navigation and routing
- [x] ACL token support

### Known Issues 🐛

- [ ] Some i18n translations missing
- [ ] Real-time updates not yet implemented
- [ ] Some detail pages are placeholders

---

## Phase 1: Core Functionality (Current)

**Goal:** Make the basic views fully functional and useful.

### Jobs

- [x] List all jobs with status, type, namespace
- [x] Job details with task groups, constraints
- [ ] **Job actions:** Stop, Start, Force Periodic Run
- [ ] **Job submission:** Create/edit jobs via UI
- [ ] Job versions and diff view
- [ ] Job deployments view

### Allocations

- [x] List allocations with status, node, job
- [x] Allocation details with tasks, events
- [ ] **Task logs:** View stdout/stderr
- [ ] **Task exec:** Terminal into running tasks
- [ ] Allocation resource usage (CPU, memory)
- [ ] Restart individual tasks

### Nodes

- [x] List nodes with status, datacenter, resources
- [x] Node details with drivers, attributes
- [x] Toggle node eligibility
- [x] Enable/disable drain
- [ ] Node resource usage graphs
- [ ] Node events timeline

### Evaluations

- [ ] List evaluations
- [ ] Evaluation details
- [ ] Filter by status, job, node

---

## Phase 2: Enhanced Features

**Goal:** Add features that improve daily operations.

### Real-time Updates

- [ ] Implement Nomad Event Stream integration
- [ ] Auto-refresh lists when resources change
- [ ] Show live allocation status changes
- [ ] Deployment progress tracking

### Services

- [ ] List registered services
- [ ] Service health status
- [ ] Service instances and addresses
- [ ] Consul integration status

### Variables

- [ ] List variables by path
- [ ] View/edit variable values
- [ ] Variable versioning
- [ ] Create new variables

### Namespaces

- [ ] List namespaces
- [ ] Namespace details and quotas
- [ ] Switch between namespaces
- [ ] Namespace-scoped views

### Deployments

- [ ] List active deployments
- [ ] Deployment progress view
- [ ] Promote/fail deployments
- [ ] Auto-revert status

---

## Phase 3: Operations & Monitoring

**Goal:** Support operational workflows.

### ACL Management

- [ ] List ACL tokens
- [ ] Create/edit tokens
- [ ] List ACL policies
- [ ] Create/edit policies
- [ ] Role management

### Job Templates

- [ ] Save job specs as templates
- [ ] Template library
- [ ] Quick deploy from templates
- [ ] Parameterized templates

### Monitoring Integration

- [ ] Resource usage graphs
- [ ] Historical metrics view
- [ ] Alert integration
- [ ] Custom dashboards

### Cluster Overview

- [ ] Cluster health dashboard
- [ ] Resource utilization overview
- [ ] Recent activity feed
- [ ] Quota status

---

## Phase 4: Advanced Features

**Goal:** Power user and enterprise features.

### Multi-Cluster

- [ ] Unified view across clusters
- [ ] Cross-cluster job comparison
- [ ] Cluster health comparison
- [ ] Federation support

### Plugin System

- [ ] Plugin API documentation
- [ ] Example plugins
- [ ] Plugin marketplace/registry
- [ ] Custom views via plugins

### Configuration Management

- [ ] Config file support (YAML)
- [ ] Import from Nomad CLI config
- [ ] Bookmarked resources
- [ ] Saved filters and queries

### Enterprise Features

- [ ] OIDC/SSO authentication
- [ ] Audit logging
- [ ] RBAC enforcement
- [ ] Custom branding

---

## Contributing

We welcome contributions! Here's how to get involved:

### High-Priority Items

These are the most impactful features to work on:

1. **Task logs viewer** - Essential for debugging
2. **Real-time updates** - Core UX improvement
3. **Job actions** - Stop/start/restart jobs
4. **Evaluations list** - Important for troubleshooting

### How to Contribute

1. Check the [development guide](./development.md)
2. Pick an item from this roadmap
3. Open an issue to discuss approach
4. Submit a pull request

### Feature Requests

Have an idea not on this list? Open an issue with:
- Use case description
- Expected behavior
- Any relevant Nomad API endpoints

---

## Version Planning

### v0.1.0 (MVP)

- Basic job, allocation, node views
- Single cluster support
- Read-only operations

### v0.2.0

- Multi-cluster support
- Job actions (stop, start)
- Task logs

### v0.3.0

- Real-time updates
- Services and variables
- Deployments view

### v1.0.0

- Full ACL management
- Stable plugin API
- Production-ready
