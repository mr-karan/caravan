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

## UI Design with Material UI

This project uses **Material UI (MUI)** for all UI components. Reference the official MUI documentation at https://mui.com/material-ui/ for component APIs and best practices.

### Commonly Used Components

| Component | Use Case |
|-----------|----------|
| `AppBar`, `Toolbar` | Top navigation bar |
| `Dialog`, `DialogContent` | Modals, search overlays |
| `Menu`, `MenuItem` | Dropdowns, context menus |
| `Chip`, `Badge` | Status indicators, labels, counts |
| `Typography`, `Box` | Text styling, layout containers |
| `TextField`, `InputAdornment` | Form inputs, search fields |
| `List`, `ListItemButton` | Lists, search results |
| `Tooltip`, `IconButton` | Action buttons with hints |
| `Paper`, `Card` | Content containers with elevation |
| `Table`, `TableRow`, `TableCell` | Data tables |
| `Tabs`, `Tab` | Tabbed navigation |
| `Grid` | Responsive layouts |
| `Divider` | Visual separation |
| `CircularProgress` | Loading states |
| `Alert`, `Snackbar` | Notifications, messages |

### Styling Guidelines

- Use `useTheme()` hook to access theme colors and breakpoints
- Use `alpha()` from `@mui/material/styles` for transparent colors
- Use `sx` prop for component-specific styles
- Use `useMediaQuery()` for responsive behavior
- Prefer theme palette colors (`theme.palette.primary.main`, etc.)

### Icons

Use `@iconify/react` for icons:
```tsx
import { Icon } from '@iconify/react';
<Icon icon="mdi:server" width={20} />
```

Browse icons at https://icon-sets.iconify.design/ (prefer `mdi:` prefix for Material Design Icons)
