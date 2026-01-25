# ATDD Checklist - Epic 6, Story 1: Settings GUI for Server and Startup Options

**Date:** 2026-01-23
**Author:** Javier
**Primary Test Level:** E2E

---

## Story Summary

User can configure server and startup settings via GUI, allowing customization of server port, auto-start on boot, and EPG refresh schedule without editing config files.

**As a** user
**I want** to configure server and startup settings via GUI
**So that** I can customize how the app runs without editing config files

---

## Acceptance Criteria

1. **Settings view displays all configuration sections**
   - Server Settings: Port number (default 5004)
   - Startup Settings: Auto-start on boot toggle
   - EPG Settings: Refresh schedule time picker

2. **Server port change restarts HTTP server and updates Plex URLs**
   - When port is changed and saved, HTTP server restarts on new port
   - Plex configuration URLs update to show new port

3. **Auto-start toggle creates/removes OS autostart entries**
   - When enabled, OS autostart entry is created (Windows registry, macOS launchd, Linux desktop file)
   - When disabled, OS autostart entry is removed

4. **EPG refresh time updates scheduler and shows next refresh time**
   - When refresh time is changed and saved, scheduler updates
   - Next refresh time is displayed to user

---

## Failing Tests Created (RED Phase)

### E2E Tests (18 tests)

**File:** `tests/e2e/settings-gui.spec.ts` (289 lines)

#### Settings Display Tests

- ✅ **Test:** should display all configuration sections
  - **Status:** RED - Settings view not yet implemented
  - **Verifies:** Settings view loads with all three sections visible (server, startup, EPG)

- ✅ **Test:** should display server port input with default value
  - **Status:** RED - Server settings section not yet implemented
  - **Verifies:** Port input exists and shows default value of 5004

- ✅ **Test:** should display auto-start toggle
  - **Status:** RED - Startup settings section not yet implemented
  - **Verifies:** Auto-start toggle control is present

- ✅ **Test:** should display EPG refresh time picker
  - **Status:** RED - EPG settings section not yet implemented
  - **Verifies:** Time picker input for EPG refresh schedule is present

#### Server Port Change Tests

- ✅ **Test:** should save new server port
  - **Status:** RED - Port change functionality not implemented
  - **Verifies:** User can change port and save, success message displays

- ✅ **Test:** should update Plex configuration URLs after port change
  - **Status:** RED - Port change integration with Plex config not implemented
  - **Verifies:** After port change, Plex config view shows updated URLs with new port

- ✅ **Test:** should validate port number range
  - **Status:** RED - Port validation not implemented
  - **Verifies:** Invalid port numbers (0, >65535) show error message

- ✅ **Test:** should validate port number is numeric
  - **Status:** RED - Input validation not implemented
  - **Verifies:** Non-numeric port values disable save button or show error

#### Auto-Start Toggle Tests

- ✅ **Test:** should enable auto-start on boot
  - **Status:** RED - Auto-start functionality not implemented
  - **Verifies:** Toggling auto-start on and saving creates OS autostart entry

- ✅ **Test:** should disable auto-start on boot
  - **Status:** RED - Auto-start functionality not implemented
  - **Verifies:** Toggling auto-start off and saving removes OS autostart entry

- ✅ **Test:** should persist auto-start setting across page reloads
  - **Status:** RED - Settings persistence not implemented
  - **Verifies:** Auto-start toggle state persists after page reload

#### EPG Refresh Schedule Tests

- ✅ **Test:** should update EPG refresh time
  - **Status:** RED - EPG schedule functionality not implemented
  - **Verifies:** User can set EPG refresh time and save successfully

- ✅ **Test:** should display next scheduled refresh time
  - **Status:** RED - Next refresh calculation not implemented
  - **Verifies:** After setting refresh time, next scheduled refresh is displayed

- ✅ **Test:** should validate time format
  - **Status:** RED - Time validation not implemented
  - **Verifies:** Invalid time formats (25:00, etc.) show error message

- ✅ **Test:** should persist EPG refresh time across page reloads
  - **Status:** RED - Settings persistence not implemented
  - **Verifies:** EPG refresh time persists after page reload

#### Form Interaction Tests

- ✅ **Test:** should show unsaved changes indicator
  - **Status:** RED - Unsaved changes tracking not implemented
  - **Verifies:** Indicator appears when user makes changes without saving

- ✅ **Test:** should clear unsaved changes indicator after save
  - **Status:** RED - Unsaved changes tracking not implemented
  - **Verifies:** Indicator disappears after successful save

- ✅ **Test:** should have cancel/reset button to revert unsaved changes
  - **Status:** RED - Reset functionality not implemented
  - **Verifies:** Reset button reverts form to last saved state

---

## Data Factories Created

### Settings Factory

**File:** `tests/support/factories/settings.factory.ts`

**Exports:**

- `createServerSettings(overrides?)` - Create server settings with optional overrides
- `createStartupSettings(overrides?)` - Create startup settings with optional overrides
- `createEpgSettings(overrides?)` - Create EPG settings with optional overrides
- `createAppSettings(overrides?)` - Create complete application settings with optional overrides
- `createDefaultSettings()` - Create settings with default values (port: 5004, autoStart: false, refreshTime: '03:00')
- `createSettingsWithAutoStart()` - Create settings with auto-start enabled
- `createSettingsWithCustomPort(port)` - Create settings with custom port
- `createSettingsWithCustomEpgTime(refreshTime)` - Create settings with custom EPG refresh time
- `generateValidPort()` - Generate random valid port number (1-65535)
- `generateInvalidPort()` - Generate random invalid port number (for validation testing)
- `generateRandomTime()` - Generate random time in HH:MM format
- `generateInvalidTime()` - Generate invalid time format (for validation testing)

**Example Usage:**

```typescript
const settings = createAppSettings({ server: { port: 5005 } });
const defaultSettings = createDefaultSettings();
const invalidPort = generateInvalidPort(); // For testing validation
```

---

## Fixtures Created

### Settings Fixtures

**File:** `tests/support/fixtures/settings.fixture.ts`

**Fixtures:**

- `defaultSettings` - Provides default application settings
  - **Setup:** Creates settings with default values
  - **Provides:** AppSettings object with defaults
  - **Cleanup:** Automatic via resetSettings fixture

- `customSettings` - Provides randomly generated settings for testing variations
  - **Setup:** Creates settings with random values using faker
  - **Provides:** AppSettings object with random values
  - **Cleanup:** Automatic via resetSettings fixture

- `resetSettings` - Provides a function to reset settings to defaults via GUI
  - **Setup:** Creates reset function
  - **Provides:** Async function to reset settings through UI
  - **Cleanup:** Automatically resets settings after each test

**Example Usage:**

```typescript
import { test, expect } from './fixtures/settings.fixture';

test('should do something with settings', async ({ page, defaultSettings, resetSettings }) => {
  // defaultSettings is available with default values
  // resetSettings function available for cleanup
  await resetSettings(page); // Resets to defaults via GUI
});
```

---

## Mock Requirements

No external services require mocking for this story. All functionality is internal:
- Settings storage (SQLite database)
- HTTP server restart (internal Axum server)
- OS autostart entries (Tauri API)
- EPG scheduler (internal cron-like scheduler)

---

## Required data-testid Attributes

### Settings View Navigation

- `settings-nav-link` - Navigation link to Settings view

### Settings View Structure

- `server-settings-section` - Server configuration section container
- `startup-settings-section` - Startup configuration section container
- `epg-settings-section` - EPG configuration section container

### Server Settings

- `server-port-input` - Port number input field
- `save-settings-button` - Save settings button
- `settings-success-message` - Success message container
- `settings-error-message` - Error message container

### Startup Settings

- `auto-start-toggle` - Auto-start on boot toggle switch (should have `aria-checked` attribute)

### EPG Settings

- `epg-refresh-time-input` - EPG refresh time picker (time input)
- `next-epg-refresh-display` - Display of next scheduled refresh time

### Plex Config View (for verification)

- `plex-config-nav-link` - Navigation link to Plex Config view
- `m3u-url-display` - M3U playlist URL display
- `xmltv-url-display` - XMLTV EPG URL display

### Form State

- `unsaved-changes-indicator` - Indicator showing unsaved changes
- `reset-settings-button` - Reset/cancel button to revert changes

**Implementation Example:**

```tsx
// Settings view structure
<div data-testid="server-settings-section">
  <h2>Server Settings</h2>
  <input
    type="number"
    data-testid="server-port-input"
    defaultValue={5004}
  />
</div>

<div data-testid="startup-settings-section">
  <h2>Startup Settings</h2>
  <Switch
    data-testid="auto-start-toggle"
    aria-checked={autoStart}
    onCheckedChange={setAutoStart}
  />
</div>

<div data-testid="epg-settings-section">
  <h2>EPG Settings</h2>
  <input
    type="time"
    data-testid="epg-refresh-time-input"
    defaultValue="03:00"
  />
  <div data-testid="next-epg-refresh-display">
    Next refresh: {nextRefreshTime}
  </div>
</div>

<button data-testid="save-settings-button">Save</button>
<button data-testid="reset-settings-button">Reset</button>

{unsavedChanges && (
  <div data-testid="unsaved-changes-indicator">
    You have unsaved changes
  </div>
)}

{successMessage && (
  <div data-testid="settings-success-message">{successMessage}</div>
)}

{errorMessage && (
  <div data-testid="settings-error-message">{errorMessage}</div>
)}
```

---

## Implementation Checklist

### Test Group 1: Settings View Structure

**File:** `tests/e2e/settings-gui.spec.ts:20-67`

**Tasks to make these tests pass:**

- [ ] Create Settings route `/settings` in React Router
- [ ] Create Settings view component (`src/views/Settings.tsx`)
- [ ] Add Settings navigation link to sidebar with `data-testid="settings-nav-link"`
- [ ] Create three section containers:
  - Server Settings section with `data-testid="server-settings-section"`
  - Startup Settings section with `data-testid="startup-settings-section"`
  - EPG Settings section with `data-testid="epg-settings-section"`
- [ ] Run tests: `pnpm test -- tests/e2e/settings-gui.spec.ts -g "Settings Display"`
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 2 hours

---

### Test Group 2: Server Port Configuration

**File:** `tests/e2e/settings-gui.spec.ts:69-125`

**Tasks to make these tests pass:**

- [ ] Add port input field with `data-testid="server-port-input"` (default: 5004)
- [ ] Add save button with `data-testid="save-settings-button"`
- [ ] Implement port validation (1-65535, numeric only)
- [ ] Create Tauri command `update_server_port(port: u16)` in Rust backend
- [ ] Command should:
  - Save port to settings table in SQLite
  - Restart Axum HTTP server on new port
  - Return success/error status
- [ ] Display success message with `data-testid="settings-success-message"`
- [ ] Display error message with `data-testid="settings-error-message"` for validation failures
- [ ] Disable save button when port value is invalid
- [ ] Update Plex config URLs to reflect new port (integration with Plex config view)
- [ ] Run tests: `pnpm test -- tests/e2e/settings-gui.spec.ts -g "Server Port Change"`
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 4 hours

---

### Test Group 3: Auto-Start Toggle

**File:** `tests/e2e/settings-gui.spec.ts:127-194`

**Tasks to make these tests pass:**

- [ ] Add toggle switch with `data-testid="auto-start-toggle"` and `aria-checked` attribute
- [ ] Create Tauri command `set_auto_start(enabled: bool)` in Rust backend
- [ ] Command should:
  - Save auto-start setting to settings table in SQLite
  - Use `tauri-plugin-autostart` to create/remove OS autostart entry
  - Handle platform-specific implementations (Windows registry, macOS launchd, Linux desktop file)
  - Return success/error status
- [ ] Display success message confirming "Auto-start enabled" or "Auto-start disabled"
- [ ] Persist toggle state across page reloads (load from settings on mount)
- [ ] Run tests: `pnpm test -- tests/e2e/settings-gui.spec.ts -g "Auto-Start Toggle"`
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 3 hours

---

### Test Group 4: EPG Refresh Schedule

**File:** `tests/e2e/settings-gui.spec.ts:196-261`

**Tasks to make these tests pass:**

- [ ] Add time input field with `data-testid="epg-refresh-time-input"` (default: "03:00")
- [ ] Implement time format validation (HH:MM, 00:00-23:59)
- [ ] Create Tauri command `update_epg_refresh_time(time: String)` in Rust backend
- [ ] Command should:
  - Save refresh time to settings table in SQLite
  - Update EPG scheduler with new time
  - Calculate next scheduled refresh time
  - Return next refresh time in response
- [ ] Display next refresh time with `data-testid="next-epg-refresh-display"`
- [ ] Display error message for invalid time formats
- [ ] Persist refresh time across page reloads (load from settings on mount)
- [ ] Run tests: `pnpm test -- tests/e2e/settings-gui.spec.ts -g "EPG Refresh Schedule"`
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 3 hours

---

### Test Group 5: Form Interactions

**File:** `tests/e2e/settings-gui.spec.ts:263-289`

**Tasks to make these tests pass:**

- [ ] Implement unsaved changes tracking:
  - Track when form values differ from saved values
  - Show indicator with `data-testid="unsaved-changes-indicator"`
  - Clear indicator after successful save
- [ ] Add reset/cancel button with `data-testid="reset-settings-button"`
- [ ] Reset button should revert form to last saved state
- [ ] Run tests: `pnpm test -- tests/e2e/settings-gui.spec.ts -g "Form Interactions"`
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 2 hours

---

## Running Tests

```bash
# Run all failing tests for story 6-1
pnpm test -- tests/e2e/settings-gui.spec.ts

# Run specific test group
pnpm test -- tests/e2e/settings-gui.spec.ts -g "Server Port Change"

# Run tests in headed mode (see browser)
pnpm test -- tests/e2e/settings-gui.spec.ts --headed

# Debug specific test
pnpm test -- tests/e2e/settings-gui.spec.ts -g "should save new server port" --debug

# Run with full Tauri app (for integration testing)
TAURI_DEV=true pnpm test -- tests/e2e/settings-gui.spec.ts
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All 18 tests written and failing
- ✅ Data factory created with faker for random test data
- ✅ Fixtures created with auto-cleanup patterns
- ✅ Required data-testid attributes documented (19 attributes)
- ✅ Implementation checklist created with 5 test groups

**Verification:**

- All tests run and fail as expected
- Failure messages are clear: "Settings view not yet implemented", "Port change functionality not implemented", etc.
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one test group** from implementation checklist (start with "Settings View Structure")
2. **Read the tests** in that group to understand expected behavior
3. **Implement minimal code** to make those specific tests pass
4. **Run the test group** to verify tests now pass (green)
5. **Check off the tasks** in implementation checklist
6. **Move to next test group** and repeat

**Key Principles:**

- One test group at a time (don't try to fix all at once)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap

**Progress Tracking:**

- Check off tasks as you complete them
- Share progress in daily standup
- Update story status to IN PROGRESS in `sprint-status.yaml`

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all 18 tests pass** (green phase complete)
2. **Review code for quality** (readability, maintainability, performance)
3. **Extract duplications** (DRY principle)
4. **Optimize performance** (if needed)
5. **Ensure tests still pass** after each refactor
6. **Update documentation** (if API contracts change)

**Key Principles:**

- Tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if tests fail)
- Run tests after each change
- Don't change test behavior (only implementation)

**Completion:**

- All 18 tests pass
- Code quality meets team standards
- No duplications or code smells
- Ready for code review and story approval

---

## Next Steps

1. **Review this checklist** with team in standup or planning
2. **Run failing tests** to confirm RED phase: `pnpm test -- tests/e2e/settings-gui.spec.ts`
3. **Begin implementation** using implementation checklist as guide (start with Settings View Structure)
4. **Work one test group at a time** (red → green for each group)
5. **Share progress** in daily standup
6. **When all tests pass**, refactor code for quality
7. **When refactoring complete**, update story status to 'done' in `sprint-status.yaml`

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **fixture-architecture.md** - Test fixture patterns with setup/teardown and auto-cleanup using Playwright's `test.extend()`
- **data-factories.md** - Factory patterns using `@faker-js/faker` for random test data generation with overrides support
- **test-quality.md** - Test design principles (Given-When-Then, one assertion per test, determinism, isolation)
- **selector-resilience.md** - data-testid selector patterns for stable test selectors

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm test -- tests/e2e/settings-gui.spec.ts`

**Expected Results:**

```
Running 18 tests using 1 worker

  ✗ Settings GUI - Server and Startup Options › should display all configuration sections
    Error: locator.click: Target closed
    =========================== logs ===========================
    waiting for locator('[data-testid="settings-nav-link"]')
    ============================================================

  ✗ Settings GUI - Server and Startup Options › should display server port input with default value
    Error: Timeout 30000ms exceeded waiting for locator('[data-testid="server-settings-section"]')

  ... (16 more failing tests)

18 failed
  Settings GUI - Server and Startup Options › should display all configuration sections
  Settings GUI - Server and Startup Options › should display server port input with default value
  Settings GUI - Server and Startup Options › should display auto-start toggle
  Settings GUI - Server and Startup Options › should display EPG refresh time picker
  Settings GUI - Server Port Change › should save new server port
  Settings GUI - Server Port Change › should update Plex configuration URLs after port change
  Settings GUI - Server Port Change › should validate port number range
  Settings GUI - Server Port Change › should validate port number is numeric
  Settings GUI - Auto-Start Toggle › should enable auto-start on boot
  Settings GUI - Auto-Start Toggle › should disable auto-start on boot
  Settings GUI - Auto-Start Toggle › should persist auto-start setting across page reloads
  Settings GUI - EPG Refresh Schedule › should update EPG refresh time
  Settings GUI - EPG Refresh Schedule › should display next scheduled refresh time
  Settings GUI - EPG Refresh Schedule › should validate time format
  Settings GUI - EPG Refresh Schedule › should persist EPG refresh time across page reloads
  Settings GUI - Form Interactions › should show unsaved changes indicator
  Settings GUI - Form Interactions › should clear unsaved changes indicator after save
  Settings GUI - Form Interactions › should have cancel/reset button to revert unsaved changes
```

**Summary:**

- Total tests: 18
- Passing: 0 (expected)
- Failing: 18 (expected)
- Status: ✅ RED phase verified - All tests fail due to missing implementation

**Expected Failure Messages:**

1. "Target closed" - Settings nav link doesn't exist yet
2. "Timeout waiting for locator" - Settings view elements don't exist yet
3. "locator not found" - Data-testid attributes not implemented yet

---

## Notes

- **Tauri Integration:** Tests require Tauri backend for settings persistence. Use `TAURI_DEV=true` flag when running tests.
- **Platform-Specific Testing:** Auto-start functionality behavior differs by OS. Consider platform-specific test variations.
- **HTTP Server Restart:** Port change requires HTTP server restart. Ensure graceful restart without dropping active streams.
- **EPG Scheduler:** Refresh time change should update the existing scheduler without restarting the app.
- **Form State Management:** Consider using React Hook Form or similar for form state, validation, and unsaved changes tracking.

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Refer to `_bmad/bmm/workflows/testarch/atdd/instructions.md` for workflow documentation
- Consult `_bmad/bmm/testarch/knowledge` for testing best practices

---

**Generated by BMad TEA Agent** - 2026-01-23
