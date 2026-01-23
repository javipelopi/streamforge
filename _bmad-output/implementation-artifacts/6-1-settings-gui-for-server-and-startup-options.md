# Story 6.1: Settings GUI for Server and Startup Options

Status: ready-for-dev

## Story

As a user,
I want to configure server and startup settings via GUI,
So that I can customize how the app runs without editing config files.

## Acceptance Criteria

1. **Server Settings Section**
   - Given the Settings view loads
   - Then I see a "Server Settings" section with a port number input (default 5004)
   - And the port field validates input (1024-65535, non-privileged ports only)
   - And invalid input shows clear error messages

2. **Port Change with Server Restart**
   - Given I change the server port value
   - When I save the setting
   - Then the HTTP server restarts on the new port
   - And Plex configuration URLs (Dashboard) update to show the new port
   - And a success message confirms the change
   - And the UI shows server status during restart

3. **Auto-start on Boot Toggle** (Already implemented - Story 1.6)
   - Given the Settings view
   - When I toggle "Start on boot"
   - Then the OS autostart entry is created/removed
   - And this works on Windows (registry), macOS (launchd), and Linux (desktop file)

4. **EPG Refresh Schedule** (Already implemented - Story 2.6)
   - Given I change EPG refresh time
   - When the setting is saved
   - Then the scheduler is updated with the new time
   - And next refresh time is displayed

5. **Section Organization**
   - Settings view displays three clear sections:
     1. Server Settings (port configuration)
     2. Startup Settings (auto-start toggle)
     3. EPG Settings (refresh schedule)

## Tasks / Subtasks

- [ ] Task 1: Add Server Settings section to Settings.tsx (AC: #1, #5)
  - [ ] 1.1: Create ServerSettings component with port input field
  - [ ] 1.2: Add port validation (1024-65535)
  - [ ] 1.3: Add error state display for invalid ports
  - [ ] 1.4: Add loading state during port change
  - [ ] 1.5: Wire up to `getServerPort` and `setServerPort` tauri bindings

- [ ] Task 2: Add TypeScript bindings for server port commands (AC: #1, #2)
  - [ ] 2.1: Add `getServerPort()` function to src/lib/tauri.ts
  - [ ] 2.2: Add `setServerPort(port: number)` function to src/lib/tauri.ts
  - [ ] 2.3: Add `restartServer()` function to src/lib/tauri.ts

- [ ] Task 3: Implement server restart functionality in Rust backend (AC: #2)
  - [ ] 3.1: Add `restart_server` Tauri command that stops current server and starts on new port
  - [ ] 3.2: Update `set_server_port` to trigger server restart
  - [ ] 3.3: Add server restart event/state tracking
  - [ ] 3.4: Handle restart errors gracefully

- [ ] Task 4: Update UI feedback for port changes (AC: #2)
  - [ ] 4.1: Show "Restarting server..." status during restart
  - [ ] 4.2: Show success toast after successful port change
  - [ ] 4.3: Show error message if restart fails
  - [ ] 4.4: Disable save button during restart

- [ ] Task 5: Reorganize Settings view sections (AC: #5)
  - [ ] 5.1: Reorder sections: Server Settings → Startup → EPG
  - [ ] 5.2: Ensure consistent styling across all sections
  - [ ] 5.3: Add section headers with descriptions

- [ ] Task 6: Write tests (All ACs)
  - [ ] 6.1: Unit tests for port validation logic
  - [ ] 6.2: Integration test for port change flow
  - [ ] 6.3: E2E test for Settings view functionality

## Dev Notes

### Architecture Patterns to Follow

**Frontend (React + TypeScript):**
- Use existing Tauri invoke pattern from `src/lib/tauri.ts`
- Follow component structure established in other views
- Use Tailwind CSS for styling (consistent with existing Settings sections)
- State management: Local React state (useState/useEffect) as shown in current Settings.tsx

**Backend (Rust + Tauri):**
- Commands exist in `src-tauri/src/commands/mod.rs`: `get_server_port`, `set_server_port`
- Server is managed via Axum in `src-tauri/src/server/mod.rs`
- Use existing DbConnection State pattern for settings persistence

### Existing Code Reference

**Settings View:** `src/views/Settings.tsx`
- Already has Startup and EPG sections - add Server Settings section above them
- Follow same card/section layout pattern with `<section>` and `bg-white rounded-lg shadow p-4`

**Backend Commands:** `src-tauri/src/commands/mod.rs`
- `get_server_port()` - Returns current port (default 5004)
- `set_server_port(port: u16)` - Saves port to settings table (validates >= 1024)
- Both commands exist but frontend bindings are missing

**Server Module:** `src-tauri/src/server/mod.rs`
- Contains Axum server setup
- Need to add restart capability

**TypeScript Bindings:** `src/lib/tauri.ts`
- Missing: `getServerPort()` and `setServerPort(port)` bindings
- Pattern: `invoke<ReturnType>('command_name', { param })`

### Port Validation Rules

Per architecture/PRD:
- Valid range: 1024-65535 (non-privileged ports)
- Default: 5004
- Error if port < 1024: "Port must be 1024 or higher (non-privileged ports)"
- Server restart required for port change to take effect

### Server Restart Strategy

**Option A (Recommended):** Save port → Show "Restart required" message → User manually restarts app
- Simpler implementation
- No risk of server state issues
- Clear user expectation

**Option B:** Hot restart server on same Tokio runtime
- More complex
- Requires careful handling of active connections
- Better UX (immediate effect)

**Recommendation:** Start with Option A, then enhance to Option B if time permits.

### Project Structure Notes

- Settings view location: `src/views/Settings.tsx`
- Tauri commands: `src-tauri/src/commands/mod.rs`
- Server implementation: `src-tauri/src/server/mod.rs`
- Database settings table stores key-value pairs

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Technology Stack]
- [Source: _bmad-output/planning-artifacts/prd.md#FR43-FR46]
- [Source: src/views/Settings.tsx - existing implementation]
- [Source: src-tauri/src/commands/mod.rs#get_server_port]

### Critical Implementation Notes

1. **Do NOT break existing functionality** - Auto-start and EPG schedule already work
2. **Port validation** must happen both frontend (UX) and backend (security)
3. **Server restart** - Consider graceful handling of in-progress streams
4. **Plex URLs** automatically update via `getPlexConfig()` which reads port from settings

### Previous Epic Learnings

- From Epic 5: TV-style EPG used consistent component patterns - follow same for Settings sections
- From Epic 4: Tauri commands follow async pattern with State<DbConnection>
- Settings persistence uses SQLite `settings` table with key-value pairs

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

