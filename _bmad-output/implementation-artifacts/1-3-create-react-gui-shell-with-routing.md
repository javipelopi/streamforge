# Story 1.3: Create React GUI Shell with Routing

Status: ready-for-dev

## Story

As a user,
I want a clean application interface with navigation,
So that I can access different sections of the application.

## Acceptance Criteria

1. **Given** the application is launched
   **When** the main window opens
   **Then** I see a GUI shell with:
   - Sidebar navigation with menu items: Dashboard, Channels, EPG, Accounts, Settings, Logs
   - Main content area
   - App header with title and status indicator
   **And** clicking navigation items routes to the corresponding view (placeholder content)
   **And** Zustand store is configured for global state
   **And** TanStack Query is configured for data fetching
   **And** Radix UI primitives are available for components

## Tasks / Subtasks

- [ ] Task 1: Install required dependencies (AC: #1)
  - [ ] 1.1 Install react-router-dom for client-side routing
  - [ ] 1.2 Install zustand for state management
  - [ ] 1.3 Install @tanstack/react-query for data fetching
  - [ ] 1.4 Install @radix-ui/react-slot and essential Radix primitives (icons, separator)
  - [ ] 1.5 Run `pnpm install` and verify dependencies resolve correctly

- [ ] Task 2: Set up React Router configuration (AC: #1)
  - [ ] 2.1 Create `src/router.tsx` with BrowserRouter/MemoryRouter setup (use MemoryRouter for Tauri)
  - [ ] 2.2 Define routes for all navigation views: /, /channels, /epg, /accounts, /settings, /logs
  - [ ] 2.3 Create route constants in `src/lib/routes.ts` for type-safe navigation
  - [ ] 2.4 Update `src/main.tsx` to wrap App with RouterProvider

- [ ] Task 3: Create placeholder view components (AC: #1)
  - [ ] 3.1 Create `src/views/Dashboard.tsx` with placeholder content
  - [ ] 3.2 Create `src/views/Channels.tsx` with placeholder content
  - [ ] 3.3 Create `src/views/EPG.tsx` with placeholder content
  - [ ] 3.4 Create `src/views/Accounts.tsx` with placeholder content
  - [ ] 3.5 Create `src/views/Settings.tsx` with placeholder content
  - [ ] 3.6 Create `src/views/Logs.tsx` with placeholder content
  - [ ] 3.7 Create `src/views/index.ts` barrel export

- [ ] Task 4: Create layout shell with sidebar navigation (AC: #1)
  - [ ] 4.1 Create `src/components/layout/Sidebar.tsx` with navigation menu
  - [ ] 4.2 Create `src/components/layout/Header.tsx` with app title and status indicator
  - [ ] 4.3 Create `src/components/layout/MainLayout.tsx` as the shell component
  - [ ] 4.4 Style sidebar with Tailwind: fixed width, full height, dark theme
  - [ ] 4.5 Add active state styling for current route
  - [ ] 4.6 Include icons for each navigation item (use Radix Icons or simple SVG)

- [ ] Task 5: Configure Zustand store (AC: #1)
  - [ ] 5.1 Create `src/stores/appStore.ts` with AppState interface
  - [ ] 5.2 Implement sidebarOpen, activeView, serverStatus state
  - [ ] 5.3 Add toggleSidebar action
  - [ ] 5.4 Add unreadLogCount state for future badge support
  - [ ] 5.5 Export useAppStore hook

- [ ] Task 6: Configure TanStack Query (AC: #1)
  - [ ] 6.1 Create `src/lib/queryClient.ts` with QueryClient configuration
  - [ ] 6.2 Configure default options (staleTime, gcTime, retry)
  - [ ] 6.3 Wrap app with QueryClientProvider in main.tsx
  - [ ] 6.4 Add ReactQueryDevtools for development (optional, disabled in production)

- [ ] Task 7: Integrate shell into App.tsx (AC: #1)
  - [ ] 7.1 Replace current App.tsx content with MainLayout + Outlet
  - [ ] 7.2 Ensure router renders views within the layout
  - [ ] 7.3 Verify navigation between all views works correctly
  - [ ] 7.4 Preserve responsive design for different window sizes

- [ ] Task 8: Add status indicator functionality (AC: #1)
  - [ ] 8.1 Add serverStatus to Zustand store (running/stopped/error)
  - [ ] 8.2 Create `src/components/ui/StatusIndicator.tsx` with color-coded dot
  - [ ] 8.3 Display status in header (green = running, red = error, gray = stopped)
  - [ ] 8.4 Add tooltip showing status text on hover

- [ ] Task 9: Build and verification (AC: #1)
  - [ ] 9.1 Run ESLint: `pnpm lint` and fix any issues
  - [ ] 9.2 Run TypeScript check: `pnpm exec tsc --noEmit`
  - [ ] 9.3 Run `pnpm tauri dev` and verify all navigation works
  - [ ] 9.4 Verify placeholder content displays for each route
  - [ ] 9.5 Run `pnpm tauri build` and verify production build works

## Dev Notes

### Architecture Compliance

This story implements the React frontend shell specified in the Architecture document:

**Frontend Directory Structure:**
```
src/
├── main.tsx                 # Entry point
├── App.tsx                  # Root component, routing
├── router.tsx               # NEW: Router configuration
├── components/
│   ├── ui/                  # Shared UI components
│   │   └── StatusIndicator.tsx
│   └── layout/              # Shell, sidebar
│       ├── MainLayout.tsx
│       ├── Sidebar.tsx
│       └── Header.tsx
├── views/                   # NEW: Route view components
│   ├── Dashboard.tsx
│   ├── Channels.tsx
│   ├── EPG.tsx
│   ├── Accounts.tsx
│   ├── Settings.tsx
│   ├── Logs.tsx
│   └── index.ts
├── hooks/                   # (empty for now, future stories)
├── stores/                  # NEW: Zustand stores
│   └── appStore.ts
├── lib/
│   ├── tauri.ts             # Existing Tauri helpers
│   ├── routes.ts            # NEW: Route constants
│   └── queryClient.ts       # NEW: TanStack Query config
└── styles/
    └── globals.css          # Existing Tailwind imports
```

[Source: architecture.md#Frontend Architecture]
[Source: architecture.md#Key Views]

### Critical Technical Requirements

**React Router for Tauri:**
Use MemoryRouter instead of BrowserRouter for Tauri apps since there's no browser history:
```typescript
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
```

**Zustand Store Pattern:**
```typescript
import { create } from 'zustand';

interface AppState {
  sidebarOpen: boolean;
  serverStatus: 'running' | 'stopped' | 'error';
  unreadLogCount: number;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  serverStatus: 'stopped',
  unreadLogCount: 0,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
```

**TanStack Query Configuration:**
```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      gcTime: 1000 * 60 * 5, // 5 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false, // Disable for desktop app
    },
  },
});
```

**Navigation Menu Items (from Architecture):**
| View | Route | Icon Suggestion |
|------|-------|-----------------|
| Dashboard | `/` | Home/Grid |
| Channels | `/channels` | List/TV |
| EPG | `/epg` | Calendar |
| Accounts | `/accounts` | User/Key |
| Settings | `/settings` | Gear/Cog |
| Logs | `/logs` | File/Document |

### Sidebar Design

Use a dark sidebar with light text for professional appearance:
```typescript
// Sidebar styling with Tailwind
<aside className="w-64 bg-gray-900 text-white h-screen fixed left-0 top-0">
  {/* Logo/Title */}
  <div className="p-4 border-b border-gray-800">
    <h1 className="text-xl font-bold">iptv</h1>
  </div>

  {/* Navigation */}
  <nav className="p-4">
    <NavLink
      to="/"
      className={({ isActive }) =>
        `block px-4 py-2 rounded ${isActive ? 'bg-blue-600' : 'hover:bg-gray-800'}`
      }
    >
      Dashboard
    </NavLink>
    {/* ... other links */}
  </nav>
</aside>
```

### Placeholder View Pattern

Each placeholder view should be minimal but identifiable:
```typescript
export function Dashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p className="text-gray-600">Status overview and quick actions will appear here.</p>
    </div>
  );
}
```

### Dependencies to Install

```bash
pnpm add react-router-dom zustand @tanstack/react-query
pnpm add @radix-ui/react-slot @radix-ui/react-separator
pnpm add -D @tanstack/react-query-devtools
```

**Version Guidance (2026):**
- react-router-dom: ^7.x (latest stable)
- zustand: ^5.x (latest stable)
- @tanstack/react-query: ^5.x (latest stable)
- @radix-ui/react-*: latest versions

### Previous Story Intelligence

**From Story 1-2 Implementation:**
- Database module exists at `src-tauri/src/db/`
- Connection pooling with r2d2 is configured
- get_setting/set_setting Tauri commands available for persistence
- Project uses pnpm as package manager
- Tailwind CSS v4 with @tailwindcss/vite plugin configured
- ESLint with TypeScript support configured

**From Story 1-1 Implementation:**
- Current App.tsx has a simple greeting demo component
- main.tsx uses React.StrictMode
- lib/tauri.ts contains typed Tauri invoke helpers
- index.css imports Tailwind base styles

**Learnings Applied:**
- Use `pnpm lint` before builds to catch issues early
- Add aria-labels for accessibility
- Handle loading and error states in UI components
- Follow existing code patterns (function components, TypeScript)

### Git Intelligence

Recent commit patterns:
- `d093529` - Code review fixes (connection pooling, error handling)
- `e5848c0` - Core implementation
- Commit message style: Descriptive, prefixed with action

### Project Structure Notes

- Alignment with unified project structure: Views go in `src/views/`, stores in `src/stores/`
- Layout components separate from UI primitives
- Route configuration separate from components

### References

- [Source: architecture.md#Frontend Architecture] - Directory structure
- [Source: architecture.md#Key Views] - Route definitions
- [Source: architecture.md#State Management] - Zustand store pattern
- [Source: architecture.md#Technology Stack] - React, Zustand, TanStack Query choices
- [Source: epics.md#Story 1.3] - Original acceptance criteria
- [Source: prd.md#Desktop Application Requirements] - GUI specifications

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

