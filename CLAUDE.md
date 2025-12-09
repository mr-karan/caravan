# Claude Code Instructions

## Package Manager

**IMPORTANT: Always use `bun` instead of `npm` or `node` for all package management and script execution.**

- Use `bun install` instead of `npm install`
- Use `bun run <script>` instead of `npm run <script>`
- Use `bunx` instead of `npx`
- Use `bun add <package>` instead of `npm install <package>`
- Use `bun remove <package>` instead of `npm uninstall <package>`

## Project Structure

This is Caravan - a Nomad UI dashboard (fork of Headlamp) with:
- `frontend/` - React frontend with TypeScript
- `backend/` - Go backend server

## Frontend Development

```bash
# Install dependencies
cd frontend && bun install

# Run development server
bun run start

# Type check
bun run tsc --noEmit

# Build
bun run build
```

## Key Directories

- `frontend/src/components/nomad/` - Nomad-specific UI components
- `frontend/src/lib/nomad/` - Nomad API client and types
- `frontend/src/components/common/` - Shared UI components
- `frontend/src/lib/router/` - Routing configuration
