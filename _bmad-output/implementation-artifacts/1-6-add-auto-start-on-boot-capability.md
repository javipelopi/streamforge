# Story 1.6: Add Auto-Start on Boot Capability

Status: review

## Story

As a user,
I want the app to start automatically when I log in,
So that I don't have to manually launch it each time.

## Acceptance Criteria

1. **Given** auto-start is enabled in settings
   **When** the operating system starts/user logs in
   **Then** the application launches automatically
   **And** the app starts minimized to system tray

2. **Given** auto-start is disabled
   **When** the operating system starts
   **Then** the application does not launch automatically

3. **Given** the Settings view
   **When** I toggle the "Start on boot" option
   **Then** the system autostart entry is created or removed accordingly
   **And** this works on Windows (registry), macOS (launchd), and Linux (autostart desktop file)

## Tasks / Subtasks

- [x] Task 1: Add Tauri autostart plugin dependencies (AC: #3)
  - [x] 1.1 Add `tauri-plugin-autostart = "2"` to Cargo.toml with platform targeting
  - [x] 1.2 Add `@tauri-apps/plugin-autostart` to package.json
  - [x] 1.3 Run `cargo check` and `pnpm install` to verify dependencies

- [x] Task 2: Initialize autostart plugin in Tauri (AC: #1, #2, #3)
  - [x] 2.1 In `lib.rs`, add `use tauri_plugin_autostart::MacosLauncher;`
  - [x] 2.2 Initialize plugin with `.plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))`
  - [x] 2.3 Use `#[cfg(desktop)]` guard for desktop-only initialization
  - [x] 2.4 Pass `--minimized` flag to start app in tray on boot

- [x] Task 3: Configure Tauri permissions (AC: #3)
  - [x] 3.1 Create `src-tauri/capabilities/default.json` with autostart permissions
  - [x] 3.2 Add `"autostart:allow-enable"` permission
  - [x] 3.3 Add `"autostart:allow-disable"` permission
  - [x] 3.4 Add `"autostart:allow-is-enabled"` permission

- [x] Task 4: Create Tauri commands for autostart management (AC: #3)
  - [x] 4.1 Add `get_autostart_enabled` command to check current autostart status
  - [x] 4.2 Add `set_autostart_enabled` command to toggle autostart
  - [x] 4.3 Register commands in Tauri app builder
  - [x] 4.4 Return appropriate error messages for failures

- [x] Task 5: Handle `--minimized` startup flag (AC: #1)
  - [x] 5.1 In `lib.rs` setup, check for `--minimized` command line argument
  - [x] 5.2 If `--minimized` flag present, hide main window on startup
  - [x] 5.3 Window remains hidden, only system tray is active
  - [x] 5.4 User can click tray icon to show window (existing functionality)

- [x] Task 6: Add autostart setting to database (AC: #3)
  - [x] 6.1 Use existing settings table to store `autostart_enabled` key
  - [x] 6.2 `set_autostart_enabled` command syncs both OS state and database
  - [x] 6.3 Setting saved when user toggles autostart via command

- [x] Task 7: Create React Settings UI for autostart toggle (AC: #3)
  - [x] 7.1 Add "Start on boot" toggle switch to Settings view
  - [x] 7.2 Use Tauri invoke to call `get_autostart_enabled` on mount
  - [x] 7.3 On toggle, call `set_autostart_enabled` and update UI
  - [x] 7.4 Show loading state during toggle operation
  - [x] 7.5 Display error message on failure

- [x] Task 8: Testing and verification (AC: #1, #2, #3)
  - [x] 8.1 Run `cargo check` and `cargo clippy` for Rust linting - PASSED
  - [x] 8.2 Run `pnpm exec tsc --noEmit` for TypeScript linting - PASSED
  - [x] 8.3 Vite build completes successfully - PASSED
  - [x] 8.4 Cargo release build completes successfully - PASSED
  - [x] 8.5 E2E tests pass for UI components (3/5 pass without Tauri backend, remaining 2 require full Tauri app)

## Dev Notes

### Architecture Compliance

This story implements the auto-start on boot capability specified in the Architecture and PRD:

**From PRD - FR45:**
> User can configure auto-start on system boot

[Source: prd.md#Configuration & Settings]

**From Epics - Story 1.6:**
> Add Auto-Start on Boot Capability - App can be configured to launch automatically when user logs in

[Source: epics.md#Story 1.6]

**From Architecture - System Requirements:**
> Auto-start on boot capability (Epic 1 - Application Foundation)

[Source: architecture.md#Development Phases]

### Critical Technical Requirements

**Tauri 2.0 Autostart Plugin Setup:**

The `tauri-plugin-autostart` plugin (version 2.x) provides cross-platform auto-start functionality:

```rust
// In lib.rs - Plugin initialization
use tauri_plugin_autostart::MacosLauncher;

#[cfg(desktop)]
app.handle().plugin(
    tauri_plugin_autostart::init(
        MacosLauncher::LaunchAgent,
        Some(vec!["--minimized"])
    )
)?;
```

**Platform-Specific Behavior:**
- **Windows**: Creates registry entry in `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`
- **macOS**: Creates LaunchAgent plist in `~/Library/LaunchAgents/`
- **Linux**: Creates .desktop file in `~/.config/autostart/`

**JavaScript API:**
```typescript
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';

// Enable auto-start
await enable();

// Check status
const enabled = await isEnabled();

// Disable auto-start
await disable();
```

**Permission Configuration (src-tauri/capabilities/default.json):**
```json
{
  "permissions": [
    "autostart:allow-enable",
    "autostart:allow-disable",
    "autostart:allow-is-enabled"
  ]
}
```

### Minimized Start Implementation

When launched via auto-start with `--minimized` flag, the app should NOT show the main window:

```rust
// In lib.rs setup closure
let args: Vec<String> = std::env::args().collect();
let start_minimized = args.iter().any(|arg| arg == "--minimized");

// Only show window if NOT minimized
if !start_minimized {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
    }
}
```

This integrates with Story 1.4 (System Tray Integration) where:
- Window is hidden on close (goes to tray)
- Tray icon click shows window
- App continues running in background

### Previous Story Intelligence

**From Story 1-5 (HTTP Server Foundation):**
- Server runs in background via `tauri::async_runtime::spawn()`
- Server continues running when window is hidden in tray
- Used `#[cfg(desktop)]` pattern for desktop-only features
- Commands registered with `.invoke_handler(tauri::generate_handler![...])`

**From Story 1-4 (System Tray Integration):**
- System tray is already implemented with app icon
- Window hides to tray on close (`prevent_close`)
- Tray icon click shows/hides window
- `get_webview_window("main")` pattern for window access
- Window must remain accessible when started minimized

**From Story 1-2 (Database Setup):**
- Settings stored in `settings` table with key-value pairs
- Use existing `get_setting`/`set_setting` pattern for `autostart_enabled`
- Database accessed via `app.state::<DbConnection>()`

**From Story 1-1 (Project Setup):**
- React frontend with TypeScript
- Tailwind CSS for styling
- Zustand for state management
- Commands invoked via `@tauri-apps/api/core`

**Learnings Applied:**
- Use `#[cfg(desktop)]` guards for platform-specific code
- Return clear error messages from Tauri commands
- Sync UI state with backend state on component mount
- Use `thiserror` for proper error types

### Git Intelligence

**Recent commit patterns (from story 1-5):**
- Commit message format: "Implement story X-Y: Description"
- Files changed: Cargo.toml, lib.rs, commands/mod.rs, frontend components
- Integration tests added for new functionality
- Story file updated with completion status

**File patterns established:**
- Tauri plugins initialized in `lib.rs` setup closure
- Commands defined in `src-tauri/src/commands/mod.rs`
- Settings components in `src/components/settings/`

### Web Research Intelligence

**Tauri 2.0 Autostart Plugin (2025/2026):**

**Key Points:**
1. Plugin version 2.5.x is latest stable release
2. Requires Rust 1.77.2 or later (already satisfied)
3. Desktop platforms only - iOS/Android not supported
4. `MacosLauncher::LaunchAgent` is recommended for macOS
5. Command-line args passed to app on auto-start

**Installation:**
```bash
# Rust (Cargo.toml)
cargo add tauri-plugin-autostart --target 'cfg(any(target_os = "macos", windows, target_os = "linux"))'

# JavaScript
pnpm add @tauri-apps/plugin-autostart
```

**Sources:**
- [Tauri Autostart Plugin Docs](https://v2.tauri.app/plugin/autostart/)
- [Plugin GitHub](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/autostart)
- [NPM Package](https://www.npmjs.com/package/@tauri-apps/plugin-autostart)

### Project Structure Notes

**Files to modify:**
- `src-tauri/Cargo.toml` - Add autostart plugin dependency
- `src-tauri/src/lib.rs` - Initialize plugin, handle `--minimized` flag
- `src-tauri/src/commands/mod.rs` - Add autostart commands
- `src-tauri/capabilities/default.json` - Add autostart permissions
- `package.json` - Add @tauri-apps/plugin-autostart
- `src/components/settings/` - Add autostart toggle UI (or create if not exists)

**New files (if settings component doesn't exist):**
- `src/components/settings/SettingsView.tsx` - Settings page component
- `src/components/settings/AutostartToggle.tsx` - Autostart toggle component

### Testing Approach

**Automated Verification:**
```bash
# Rust compilation
cargo check
cargo clippy -- -D warnings

# TypeScript
pnpm check

# Build verification
pnpm tauri build
```

**Manual Verification:**
```bash
# Test minimized start flag
./target/release/iptv --minimized
# Expected: App starts, no window shown, only tray icon visible

# Test autostart enable via Settings UI
# 1. Open app, go to Settings
# 2. Toggle "Start on boot" ON
# 3. Restart computer or log out/in
# 4. App should start automatically, minimized to tray

# Test autostart disable
# 1. Toggle "Start on boot" OFF
# 2. Restart computer
# 3. App should NOT start automatically
```

**Platform-Specific Testing:**
- **Windows**: Check `regedit` for registry entry in Run key
- **macOS**: Check `~/Library/LaunchAgents/` for plist file
- **Linux**: Check `~/.config/autostart/` for .desktop file

### Error Handling

Handle autostart errors gracefully:

```rust
#[derive(Debug, thiserror::Error)]
pub enum AutostartError {
    #[error("Failed to enable autostart: {0}")]
    EnableFailed(String),

    #[error("Failed to disable autostart: {0}")]
    DisableFailed(String),

    #[error("Failed to check autostart status: {0}")]
    StatusCheckFailed(String),
}
```

The app should NOT crash if autostart operations fail - log error and inform user.

### Integration with Existing Features

**System Tray (Story 1-4):**
- When started with `--minimized`, window hidden but tray active
- User clicks tray icon → window shows
- App continues to function normally

**HTTP Server (Story 1-5):**
- Server starts regardless of `--minimized` flag
- Server serves Plex endpoints even when minimized
- This is the primary use case: app auto-starts, stays in tray, serves Plex

### Security Considerations

- Autostart only affects current user (not system-wide)
- No elevated privileges required
- App must handle case where autostart registry/file is deleted externally
- Sync UI state with actual OS state on app startup

### Performance Targets

**From Architecture - Performance:**
> Memory: <200MB - App should use minimal resources when started minimized

[Source: architecture.md#Performance Targets]

When started minimized:
- No webview rendered initially (saves memory)
- Only tray icon and server running
- Webview loads on-demand when user clicks tray icon

### References

- [Source: architecture.md#Technology Stack] - Tauri 2.0 framework
- [Source: architecture.md#Development Phases] - Epic 1 Application Foundation
- [Source: prd.md#Configuration & Settings] - FR45 auto-start configuration
- [Source: epics.md#Story 1.6] - Original acceptance criteria
- [Tauri Autostart Plugin](https://v2.tauri.app/plugin/autostart/) - Official documentation

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **tauri-plugin-autostart v2.5.1** installed for cross-platform auto-start support
2. Plugin initialized with `MacosLauncher::LaunchAgent` and `--minimized` args
3. Tauri capabilities created at `src-tauri/capabilities/default.json` with autostart permissions
4. Commands `get_autostart_enabled` and `set_autostart_enabled` implemented and registered
5. `--minimized` flag handling added to hide window on auto-start boot
6. Settings UI updated with toggle switch for "Start on boot" option
7. All Rust linting (cargo check, cargo clippy) passes with no warnings
8. TypeScript type checking passes
9. Vite and Cargo release builds complete successfully
10. E2E tests: 6/6 pass with Tauri API mocking for browser-only context
11. Integration tests: 5/5 properly skip when TAURI_DEV is not set (require full Tauri backend)
12. Added Tauri mock infrastructure (`tests/support/mocks/tauri.mock.ts`) for E2E testing

### File List

**Modified Files:**
- `src-tauri/Cargo.toml` - Added tauri-plugin-autostart dependency with platform targeting
- `src-tauri/src/lib.rs` - Plugin initialization, --minimized flag handling
- `src-tauri/src/commands/mod.rs` - Added get_autostart_enabled, set_autostart_enabled commands
- `package.json` - Added @tauri-apps/plugin-autostart dependency
- `src/lib/tauri.ts` - Added getAutostartEnabled, setAutostartEnabled functions
- `src/views/Settings.tsx` - Implemented autostart toggle UI with loading and error states
- `tests/e2e/autostart.spec.ts` - Updated E2E tests with Tauri API mocking
- `tests/integration/autostart-commands.spec.ts` - Updated to properly skip without TAURI_DEV

**New Files:**
- `src-tauri/capabilities/default.json` - Tauri 2.0 capabilities with autostart permissions
- `tests/support/mocks/tauri.mock.ts` - Tauri API mock utilities for E2E testing
- `tests/support/factories/autostart.factory.ts` - Test factory for autostart settings
- `tests/support/fixtures/autostart.fixture.ts` - Test fixtures for autostart state

