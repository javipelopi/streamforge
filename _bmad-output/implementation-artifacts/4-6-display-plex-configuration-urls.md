# Story 4.6: Display Plex Configuration URLs

Status: review

## Story

As a user,
I want to see the URLs I need to configure Plex,
So that I can easily set up my tuner.

## Background

This is the **final story in Epic 4: Plex Integration & Streaming**. Epic 4 enables users to add StreamForge as a tuner in Plex and watch live TV. This story provides the user-facing configuration display that tells users exactly what URLs to enter in Plex.

**Epic 4 Story Sequence:**
1. Story 4-1 (done): M3U playlist endpoint
2. Story 4-2 (done): XMLTV EPG endpoint
3. Story 4-3 (done): HDHomeRun emulation
4. Story 4-4 (done): Stream proxy with quality selection
5. Story 4-5 (done): Automatic stream failover
6. **Story 4-6 (this):** Display Plex configuration URLs

**Key Insight:** All the endpoints already exist and work. This story is purely about **UI/UX** - displaying the existing URLs to users in an accessible way with copy-to-clipboard functionality.

## Acceptance Criteria

1. **Given** the Dashboard or Settings view
   **When** I look at the Plex Integration section
   **Then** I see:
   - M3U Playlist URL: `http://{local_ip}:{port}/playlist.m3u`
   - EPG/XMLTV URL: `http://{local_ip}:{port}/epg.xml`
   - HDHomeRun URL: `http://{local_ip}:{port}` (for manual tuner setup)
   - Tuner count: {count} (from Xtream account)

2. **Given** any URL is displayed
   **When** I click a "Copy" button next to it
   **Then** the URL is copied to clipboard
   **And** a toast notification confirms the copy

3. **Given** the HTTP server is not running
   **When** I view the Plex Integration section
   **Then** I see a warning that the server needs to be started
   **And** URLs show as unavailable

## Tasks / Subtasks

### Backend - Tauri Command for Configuration Info

- [x] Task 1: Create `get_plex_config` Tauri command (AC: #1, #3)
  - [x] 1.1 Create command in `src-tauri/src/commands/mod.rs`:
    ```rust
    #[derive(Serialize)]
    pub struct PlexConfig {
        pub server_running: bool,
        pub local_ip: String,
        pub port: u16,
        pub m3u_url: String,
        pub epg_url: String,
        pub hdhr_url: String,
        pub tuner_count: i32,
    }

    #[tauri::command]
    pub async fn get_plex_config(state: State<'_, AppState>) -> Result<PlexConfig, String>
    ```
  - [x] 1.2 Reuse existing `get_local_ip()` from `src-tauri/src/server/hdhr.rs`
  - [x] 1.3 Get port from `state.get_port()`
  - [x] 1.4 Get tuner count from active accounts (same logic as discover.json)
  - [x] 1.5 Determine server_running by checking if server is accepting connections
  - [x] 1.6 Register command in `src-tauri/src/lib.rs` builder

### Frontend - Dashboard Enhancement

- [x] Task 2: Create PlexConfigSection component (AC: #1, #2, #3)
  - [x] 2.1 Create `src/components/dashboard/PlexConfigSection.tsx`
  - [x] 2.2 Follow Settings.tsx card styling pattern:
    ```tsx
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Plex Integration</h2>
      // ... content
    </div>
    ```
  - [x] 2.3 Display each URL with label, URL text, and copy button
  - [x] 2.4 Show server status indicator (reuse StatusIndicator component)
  - [x] 2.5 Show warning state when server not running (AC #3)

- [x] Task 3: Implement URL row component (AC: #1, #2)
  - [x] 3.1 Create reusable `ConfigUrlRow` component within PlexConfigSection:
    ```tsx
    interface ConfigUrlRowProps {
      label: string;
      description: string;
      url: string;
      disabled?: boolean;
    }
    ```
  - [x] 3.2 Style URL display with monospace font for clarity
  - [x] 3.3 Add copy button with clipboard icon (use Lucide icons)
  - [x] 3.4 Show "Unavailable" placeholder when disabled

- [x] Task 4: Implement clipboard copy with toast (AC: #2)
  - [x] 4.1 Use `navigator.clipboard.writeText(url)`
  - [x] 4.2 Create simple toast notification for feedback
  - [x] 4.3 Show success message: "URL copied to clipboard"
  - [x] 4.4 Handle clipboard API failures gracefully

- [x] Task 5: Add Tauri binding for get_plex_config
  - [x] 5.1 Add type definition in `src/lib/tauri.ts`:
    ```typescript
    export interface PlexConfig {
      server_running: boolean;
      local_ip: string;
      port: number;
      m3u_url: string;
      epg_url: string;
      hdhr_url: string;
      tuner_count: number;
    }
    ```
  - [x] 5.2 Add invoke function:
    ```typescript
    export async function getPlexConfig(): Promise<PlexConfig> {
      return invoke<PlexConfig>('get_plex_config');
    }
    ```

- [x] Task 6: Integrate into Dashboard view (AC: #1)
  - [x] 6.1 Update `src/views/Dashboard.tsx` to include PlexConfigSection
  - [x] 6.2 Use TanStack Query for data fetching with auto-refresh
  - [x] 6.3 Show loading skeleton while fetching
  - [x] 6.4 Handle error states with retry option

### Testing

- [x] Task 7: Unit tests for Tauri command
  - [x] 7.1 Add test in `src-tauri/src/commands/mod.rs` (mod tests)
  - [x] 7.2 Test: get_plex_config returns valid URLs
  - [x] 7.3 Test: tuner_count reflects active accounts

- [x] Task 8: Integration tests for Dashboard
  - [x] 8.1 Create `tests/integration/dashboard.spec.ts` (ATDD tests created earlier)
  - [x] 8.2 Test: PlexConfigSection displays URLs
  - [x] 8.3 Test: Copy button copies URL to clipboard
  - [x] 8.4 Test: Warning shown when server not running

- [x] Task 9: Build verification
  - [x] 9.1 Run `cargo check` - no Rust errors
  - [x] 9.2 Run `cargo test` - all 203 unit tests pass
  - [x] 9.3 Run `npm run build` - build succeeds
  - [x] 9.4 Run `npx tsc --noEmit` - TypeScript compiles cleanly

## Dev Notes

### CRITICAL: Reuse Existing Code

This story should **NOT** implement any new endpoint logic. All endpoints already exist:

| Endpoint | Implementation | Works |
|----------|---------------|-------|
| `/playlist.m3u` | Story 4-1 | Yes |
| `/epg.xml` | Story 4-2 | Yes |
| `/discover.json` | Story 4-3 | Yes |
| `/stream/{id}` | Story 4-4 | Yes |

The **only** backend work is a single Tauri command that aggregates existing data. DO NOT reimplement or duplicate any endpoint logic.

### Reuse get_local_ip() Function

The `get_local_ip()` function already exists in hdhr.rs and is tested:

```rust
// src-tauri/src/server/hdhr.rs:111-115
pub fn get_local_ip() -> String {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string())
}
```

Either:
1. Make it `pub` and import from `server::hdhr::get_local_ip()`
2. Or move to a shared location if needed by multiple modules

DO NOT reimplement IP detection logic.

[Source: src-tauri/src/server/hdhr.rs:111-115]

### Tuner Count Logic

Tuner count is already calculated in discover.json endpoint:

```rust
// src-tauri/src/server/hdhr.rs - generate_discover_response()
let tuner_count: i32 = accounts
    .iter()
    .filter(|a| a.is_active)
    .map(|a| a.max_connections)
    .sum();
```

Reuse this pattern. DO NOT create separate tuner count logic.

[Source: src-tauri/src/server/hdhr.rs:142-170]

### Port Retrieval Pattern

Port is already retrievable via existing `get_server_port` command or `AppState::get_port()`:

```rust
// src-tauri/src/server/state.rs:97-111
pub fn get_port(&self) -> u16 {
    const DEFAULT_SERVER_PORT: u16 = 5004;
    // Returns port from settings or default
}
```

[Source: src-tauri/src/server/state.rs:97-111]

### Dashboard.tsx Current State

Dashboard is a placeholder ready for enhancement:

```tsx
// src/views/Dashboard.tsx
export function Dashboard() {
  return (
    <div data-testid="dashboard-view">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p className="text-gray-600">
        Status overview and quick actions will appear here.
      </p>
    </div>
  );
}
```

Replace placeholder content with PlexConfigSection. Keep heading structure.

[Source: src/views/Dashboard.tsx]

### UI Patterns from Settings.tsx

Follow established patterns from Settings view:

**Section Card Pattern:**
```tsx
<div className="bg-white rounded-lg shadow p-6">
  <h2 className="text-lg font-semibold mb-4">Section Title</h2>
  <div className="space-y-4">
    {/* content */}
  </div>
</div>
```

**Label + Description Pattern:**
```tsx
<div className="flex flex-col">
  <label className="text-sm font-medium text-gray-900">Label</label>
  <span className="text-sm text-gray-500">Description text</span>
</div>
```

**Error State Pattern:**
```tsx
<div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
  Error message here
</div>
```

[Source: src/views/Settings.tsx]

### Clipboard API Implementation

Use the standard Web Clipboard API:

```typescript
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}
```

The Clipboard API is available in Tauri's WebView on all platforms.

### Toast Notification Pattern

Create a simple toast using existing Tailwind utilities:

```tsx
// Simple toast state in component
const [toast, setToast] = useState<string | null>(null);

// Show toast for 3 seconds
const showToast = (message: string) => {
  setToast(message);
  setTimeout(() => setToast(null), 3000);
};

// Toast UI (position fixed at bottom)
{toast && (
  <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg">
    {toast}
  </div>
)}
```

Consider using a portal for proper z-index stacking.

### Server Running Detection

To detect if server is running, the Tauri command should attempt a health check:

```rust
async fn is_server_running(port: u16) -> bool {
    let url = format!("http://127.0.0.1:{}/health", port);
    match reqwest::get(&url).await {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    }
}
```

Note: This adds a small latency to the command. Alternatively, track server state in AppState.

### TanStack Query Usage

Use TanStack Query for data fetching with appropriate options:

```typescript
const { data: plexConfig, isLoading, error, refetch } = useQuery({
  queryKey: ['plexConfig'],
  queryFn: getPlexConfig,
  refetchInterval: 30000, // Refresh every 30s in case IP changes
  staleTime: 10000,
});
```

[Source: src/hooks/useChannels.ts - similar query patterns]

### Previous Story Learnings (Story 4-5)

**Patterns established in Epic 4:**
1. Use `eprintln!` for server-side error logging
2. Return opaque errors to clients
3. Follow existing module structure (don't create new folders)
4. Test data seeding via `/test/seed` endpoint (IPTV_TEST_MODE=1)
5. Integration tests may need mock data setup

**Key insight from 4-5:** Keep implementations simple. The simplified failover approach was more maintainable than the complex FailoverStream wrapper. Apply same principle here - simple Tauri command, simple React component.

[Source: _bmad-output/implementation-artifacts/4-5-automatic-stream-failover.md]

### Project Structure Notes

**Files to Create:**
```
src/components/dashboard/PlexConfigSection.tsx (new - main component)
tests/integration/dashboard.spec.ts (new - E2E tests)
```

**Files to Modify:**
```
src-tauri/src/commands/mod.rs (add get_plex_config command)
src-tauri/src/lib.rs (register new command)
src/lib/tauri.ts (add PlexConfig type and function)
src/views/Dashboard.tsx (integrate PlexConfigSection)
```

**DO NOT Create:**
- New backend modules (all logic fits in existing commands/mod.rs)
- New API endpoints (reuse existing)
- Complex state management (simple component state suffices)

### NFR Reference

- **NFR5:** GUI responsiveness < 100ms for user interactions
  - Copy-to-clipboard should be instant
  - Toast should appear immediately
- **NFR16:** Setup time < 10 minutes for complete setup
  - Clear, visible URLs help users configure Plex quickly
- **NFR17:** Usable without documentation
  - URLs should be self-explanatory with descriptive labels

### Epic 4 Completion

This is the **final story** in Epic 4. Upon completion:
1. All Plex integration features are complete
2. User can configure Plex using displayed URLs
3. Live TV streaming with failover is fully functional
4. Run epic-4 retrospective if desired

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.6]
- [Source: _bmad-output/planning-artifacts/architecture.md#HTTP Server endpoints]
- [Source: src-tauri/src/server/hdhr.rs - get_local_ip() and discover_handler()]
- [Source: src-tauri/src/server/state.rs - AppState::get_port()]
- [Source: src-tauri/src/commands/mod.rs - existing Tauri commands]
- [Source: src/views/Dashboard.tsx - current placeholder]
- [Source: src/views/Settings.tsx - UI patterns to follow]
- [Source: src/lib/tauri.ts - Tauri invoke patterns]
- [Source: _bmad-output/implementation-artifacts/4-5-automatic-stream-failover.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Clean implementation with no blocking issues.

### Completion Notes List

1. **Backend Implementation:**
   - Created `PlexConfig` struct and `get_plex_config` async command in `src-tauri/src/commands/mod.rs`
   - Reused existing `get_local_ip()` and `get_tuner_count()` functions from `hdhr.rs`
   - Server health check via HTTP request to `discover.json` endpoint
   - Registered command in `lib.rs` invoke_handler

2. **Frontend Implementation:**
   - Created `PlexConfigSection` component with `ConfigUrlRow` subcomponent
   - Used TanStack Query for data fetching with 30-second auto-refresh
   - Implemented clipboard copy with toast notifications
   - Added loading skeleton and error states with retry
   - Shows server status indicator and warning when server stopped

3. **Testing:**
   - Added 6 unit tests for PlexConfig serialization and URL format consistency
   - ATDD integration tests (created earlier) in `tests/e2e/plex-config-display.spec.ts`
   - All 203 Rust tests pass

4. **Build Verification:**
   - `cargo check` passes
   - `cargo test` - 203 tests pass
   - `npm run build` succeeds (Tauri build completes)
   - `npx tsc --noEmit` - TypeScript compiles cleanly

### File List

**Created:**
- `src/components/dashboard/PlexConfigSection.tsx` - Main component with URL display and copy functionality

**Modified:**
- `src-tauri/src/commands/mod.rs` - Added PlexConfig struct, get_plex_config command, and unit tests
- `src-tauri/src/lib.rs` - Registered get_plex_config command
- `src/lib/tauri.ts` - Added PlexConfig interface and getPlexConfig function
- `src/views/Dashboard.tsx` - Integrated PlexConfigSection component
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated status to in-progress then dev-complete

**Tests (pre-existing ATDD):**
- `tests/e2e/plex-config-display.spec.ts` - E2E tests for Plex config display
- `tests/integration/plex-config-command.spec.ts` - Integration tests for get_plex_config command
