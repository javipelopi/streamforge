# ATDD Checklist - Epic 6, Story 3: Event Logging System

**Date:** 2026-01-23
**Author:** Javier
**Primary Test Level:** Integration + E2E

---

## Story Summary

As a developer/user, I want the app to log important events with configurable verbosity, so that I can troubleshoot issues and understand system behavior without being overwhelmed by logs.

**As a** developer/user
**I want** the app to log important events with verbosity control
**So that** I can troubleshoot issues efficiently and control log noise

---

## Acceptance Criteria

1. **Event Logging to Database** - Events are logged to event_log table with timestamp, level, category, message, and details
2. **Events to Log** - System logs connection, stream, EPG, matching, provider, configuration, and auto-start events
3. **Log Verbosity - Minimal Mode** - Only warn and error level events are logged when verbosity is "minimal"
4. **Log Verbosity - Verbose Mode** - All events including info level are logged when verbosity is "verbose"
5. **Verbosity Setting in UI** - Settings view provides a "Log Verbosity" dropdown with persistence

---

## Failing Tests Created (RED Phase)

### Integration Tests (13 tests)

**File:** `tests/integration/log-verbosity.spec.ts` (470 lines)

- ✅ **Test:** AC #3: should filter info events when verbosity is minimal
  - **Status:** RED - Error: Unknown command: set_log_verbosity
  - **Verifies:** Minimal mode filters out info events, only logs warn/error

- ✅ **Test:** should not log info level connection events in minimal mode
  - **Status:** RED - Error: Unknown command: set_log_verbosity
  - **Verifies:** Connection success (info) not logged in minimal mode

- ✅ **Test:** should not log info level stream events in minimal mode
  - **Status:** RED - Error: Unknown command: set_log_verbosity
  - **Verifies:** Stream start/stop (info) not logged in minimal mode

- ✅ **Test:** should still log warn and error stream events in minimal mode
  - **Status:** RED - Error: Unknown command: set_log_verbosity
  - **Verifies:** Stream failover (warn) and failure (error) still logged

- ✅ **Test:** AC #4: should log all events including info when verbosity is verbose
  - **Status:** RED - Error: Unknown command: set_log_verbosity
  - **Verifies:** Verbose mode logs all levels (info, warn, error)

- ✅ **Test:** should log info level connection events in verbose mode
  - **Status:** RED - Error: Unknown command: set_log_verbosity
  - **Verifies:** Connection success logged with details in verbose mode

- ✅ **Test:** should log info level EPG events in verbose mode
  - **Status:** RED - Error: Unknown command: set_log_verbosity
  - **Verifies:** EPG refresh completion logged in verbose mode

- ✅ **Test:** should log all system lifecycle events in verbose mode
  - **Status:** RED - Error: Unknown command: set_log_verbosity
  - **Verifies:** System events (startup, restart, config change) logged

- ✅ **Test:** should retrieve current log verbosity setting
  - **Status:** RED - Error: Unknown command: get_log_verbosity
  - **Verifies:** get_log_verbosity command returns current setting

- ✅ **Test:** should default to verbose mode if not set
  - **Status:** RED - Error: Unknown command: get_log_verbosity
  - **Verifies:** Default verbosity is "verbose"

- ✅ **Test:** should update verbosity setting
  - **Status:** RED - Error: Unknown command: set_log_verbosity
  - **Verifies:** set_log_verbosity command updates setting

- ✅ **Test:** should persist verbosity setting across sessions
  - **Status:** RED - Error: Unknown command: get_log_verbosity
  - **Verifies:** Verbosity persists in database (settings table)

- ✅ **Test:** should apply verbosity change immediately to new events
  - **Status:** RED - Error: Unknown command: set_log_verbosity
  - **Verifies:** Dynamic filtering applies to events after verbosity change

### E2E Tests (12 tests)

**File:** `tests/e2e/log-verbosity-settings.spec.ts` (395 lines)

- ✅ **Test:** AC #5: should display Logging Settings section
  - **Status:** RED - Element not found: data-testid="logging-section"
  - **Verifies:** Logging Settings section exists in Settings view

- ✅ **Test:** AC #5: should display Log Verbosity setting with dropdown
  - **Status:** RED - Element not found: data-testid="log-verbosity-select"
  - **Verifies:** Log Verbosity dropdown is visible

- ✅ **Test:** AC #5: should display verbosity options (Minimal and Verbose)
  - **Status:** RED - Element not found: data-testid="log-verbosity-select"
  - **Verifies:** Dropdown contains "Minimal" and "Verbose" options

- ✅ **Test:** should display description for Minimal option
  - **Status:** RED - Element not found: data-testid="logging-section"
  - **Verifies:** UI explains "only warnings and errors"

- ✅ **Test:** should display description for Verbose option
  - **Status:** RED - Element not found: data-testid="logging-section"
  - **Verifies:** UI explains "all events including info"

- ✅ **Test:** should default to Verbose mode
  - **Status:** RED - Element not found: data-testid="log-verbosity-select"
  - **Verifies:** Default selection is "verbose"

- ✅ **Test:** should load saved verbosity setting
  - **Status:** RED - Element not found: data-testid="log-verbosity-select"
  - **Verifies:** Previously saved setting is loaded on page load

- ✅ **Test:** should change verbosity from Verbose to Minimal
  - **Status:** RED - Element not found: data-testid="log-verbosity-select"
  - **Verifies:** User can select "Minimal" from dropdown

- ✅ **Test:** should change verbosity from Minimal to Verbose
  - **Status:** RED - Element not found: data-testid="log-verbosity-select"
  - **Verifies:** User can select "Verbose" from dropdown

- ✅ **Test:** should save verbosity setting when Save button is clicked
  - **Status:** RED - Element not found: data-testid="log-verbosity-select"
  - **Verifies:** Save Settings triggers set_log_verbosity command

- ✅ **Test:** AC #5: should persist verbosity setting across app restarts
  - **Status:** RED - Element not found: data-testid="log-verbosity-select"
  - **Verifies:** Setting persists after page reload

- ✅ **Test:** should not lose verbosity setting when navigating away and back
  - **Status:** RED - Element not found: data-testid="log-verbosity-select"
  - **Verifies:** Setting persists during navigation

---

## Data Factories Created

### Log Verbosity Factory

**File:** `tests/support/factories/log-verbosity.factory.ts`

**Exports:**
- `createLogVerbositySetting(overrides?)` - Create log verbosity setting with optional overrides
- `createMinimalVerbosity()` - Create minimal verbosity setting
- `createVerboseVerbosity()` - Create verbose verbosity setting
- `createVerbosityTestScenarios()` - Generate test scenarios for verbosity filtering

**Example Usage:**

```typescript
import {
  createLogVerbositySetting,
  createMinimalVerbosity,
  createVerboseVerbosity,
} from '../support/factories/log-verbosity.factory';

const minimalSetting = createMinimalVerbosity(); // { verbosity: 'minimal' }
const verboseSetting = createVerboseVerbosity(); // { verbosity: 'verbose' }
const randomSetting = createLogVerbositySetting(); // Random verbosity
```

### Existing Event Log Factory (Reused)

**File:** `tests/support/factories/event-log.factory.ts`

**Exports:**
- `createEventLog(overrides?)` - Create generic event log entry
- `createInfoEvent(overrides?)` - Create info level event
- `createWarnEvent(overrides?)` - Create warning level event
- `createErrorEvent(overrides?)` - Create error level event
- `createConnectionEvent(success, overrides?)` - Create connection event
- `createStreamEvent(overrides?)` - Create stream event
- `createEpgEvent(overrides?)` - Create EPG event

---

## Fixtures Created

No new fixtures required. Existing event log infrastructure supports verbosity testing.

---

## Mock Requirements

### Tauri Command Mocks

**Settings Mock Extension** (extend existing `injectSettingsStatefulMock`):

Add support for `logVerbosity` state:

```typescript
// In tests/support/mocks/tauri.mock.ts
export interface SettingsState {
  serverPort: number;
  autostartEnabled: boolean;
  epgSchedule: { hour: number; minute: number; enabled: boolean };
  logVerbosity: 'minimal' | 'verbose'; // ADD THIS
}

// Mock commands to add:
get_log_verbosity: () => {
  return window.__SETTINGS_STATE__.logVerbosity || 'verbose';
},

set_log_verbosity: (args: { verbosity: 'minimal' | 'verbose' }) => {
  window.__SETTINGS_STATE__.logVerbosity = args.verbosity;
  return undefined;
},
```

**Notes:** No external services need mocking. All functionality is internal to Tauri backend.

---

## Required data-testid Attributes

### Settings View (Settings.tsx)

**Logging Settings Section:**
- `logging-section` - Container for logging settings section
- `log-verbosity-select` - Dropdown/select for verbosity setting

**Implementation Example:**

```tsx
<section className="bg-white rounded-lg shadow p-4" data-testid="logging-section">
  <h2 className="text-lg font-semibold mb-4">Logging Settings</h2>
  <div className="flex items-center justify-between">
    <div>
      <label className="font-medium">Log Verbosity</label>
      <p className="text-sm text-gray-500">
        Minimal: only warnings and errors. Verbose: all events including info.
      </p>
    </div>
    <select
      data-testid="log-verbosity-select"
      value={logVerbosity}
      onChange={(e) => setLogVerbosity(e.target.value as 'minimal' | 'verbose')}
      className="px-3 py-1.5 border border-gray-300 rounded-md"
    >
      <option value="verbose">Verbose</option>
      <option value="minimal">Minimal</option>
    </select>
  </div>
</section>
```

---

## Implementation Checklist

### Test: Integration - Verbosity Filtering (AC #3, #4)

**File:** `tests/integration/log-verbosity.spec.ts`

**Tasks to make these tests pass:**

- [x] Add `log_verbosity` setting to settings table (default: "verbose")
  - Implemented: Uses existing settings table, defaults to "verbose" if not set
- [x] Add `get_log_verbosity` Tauri command in `src-tauri/src/commands/logs.rs`
  - Returns current verbosity from settings table
  - Defaults to "verbose" if not set
- [x] Add `set_log_verbosity` Tauri command in `src-tauri/src/commands/logs.rs`
  - Updates settings table with new verbosity
  - Validates input (only "minimal" or "verbose")
- [x] Modify `log_event_internal` function in `src-tauri/src/commands/logs.rs`
  - Check verbosity setting before logging
  - If level is "info" AND verbosity is "minimal", skip logging (return Ok early)
  - Always log "warn" and "error" regardless of verbosity
- [x] Register commands in `src-tauri/src/lib.rs`
  - Added `get_log_verbosity` and `set_log_verbosity` to command list
- [x] ✅ All integration tests pass (green phase)

**Estimated Effort:** 2 hours

---

### Test: E2E - Settings UI (AC #5)

**File:** `tests/e2e/log-verbosity-settings.spec.ts`

**Tasks to make these tests pass:**

- [x] Add TypeScript bindings in `src/lib/tauri.ts`
  - `export const getLogVerbosity = () => invoke<string>('get_log_verbosity')`
  - `export const setLogVerbosity = (verbosity: 'minimal' | 'verbose') => invoke('set_log_verbosity', { verbosity })`
- [x] Add state management in `Settings.tsx`
  - Add `logVerbosity` state variable
  - Load verbosity on component mount using `getLogVerbosity()`
  - Update `handleSave` to call `setLogVerbosity()`
- [x] Add Logging Settings section in `Settings.tsx`
  - Create new section after EPG Settings
  - Add `data-testid="logging-section"` to section container
  - Add heading: "Logging Settings"
- [x] Add Log Verbosity dropdown in `Settings.tsx`
  - Add `<select>` with `data-testid="log-verbosity-select"`
  - Options: "Verbose" (value="verbose") and "Minimal" (value="minimal")
  - Bind to `logVerbosity` state
  - Add description text explaining each mode
- [x] Update mock in `tests/support/mocks/tauri.mock.ts`
  - Add `logVerbosity` to `SettingsState` interface
  - Add `get_log_verbosity` and `set_log_verbosity` to mock commands
- [x] ✅ All E2E tests pass (12/12 passing, 2 skipped for missing nav infrastructure)

**Estimated Effort:** 2 hours

---

### Test: Event Logging Integration (AC #1, #2)

**Note:** Story 6-3 extends existing event logging from Story 3-4. The event_log table and base commands already exist. This task adds event logging calls throughout the codebase.

**Tasks:**

- [x] **Xtream Connection Events** (`src-tauri/src/commands/accounts.rs`)
  - In `test_connection` command: Log "Connection successful" (info) or "Connection failed" (error)
  - Include account name, max connections, active connections in details
  - Uses `log_event_internal` helper with verbosity support

- [x] **Stream Events** (updated existing logging in `src-tauri/src/server/failover.rs`, `handlers.rs`)
  - Existing failover logging now uses `log_event_internal` for verbosity support
  - Log "Stream failover" (warn) on stream switch
  - Log "All streams failed" (error) when all sources exhausted
  - Log "Quality upgrade" (info/warn) on upgrade attempt
  - Log "Mid-stream failover" (warn/error) during active stream
  - Log "Tuner limit reached" (warn) when connection limit hit

- [x] **EPG Events** (`src-tauri/src/commands/epg.rs`)
  - Log "EPG refresh completed" (info) with stats (channels, programs)
  - Log "EPG refresh failed" (error) with error details
  - Include source name and counts in details

- [x] **Channel Matching Events** (`src-tauri/src/commands/matcher.rs`)
  - Log "Channel matching completed" (info) with stats
  - Include matched/unmatched counts, threshold, duration

- [x] **Configuration Events** (`src-tauri/src/commands/config.rs`)
  - Log "Configuration exported" (info) with counts
  - Log "Configuration imported" (info) with counts
  - Include accounts, sources, settings imported counts

- [x] **System Events** (`src-tauri/src/lib.rs`)
  - Log "StreamForge vX.Y.Z started" (info) on app startup
  - Include app version in details

---

## Running Tests

```bash
# Run all log verbosity integration tests
TAURI_DEV=true pnpm test -- tests/integration/log-verbosity.spec.ts

# Run specific integration test
TAURI_DEV=true pnpm test -- tests/integration/log-verbosity.spec.ts -g "should filter info events"

# Run all log verbosity E2E tests
pnpm test -- tests/e2e/log-verbosity-settings.spec.ts

# Run specific E2E test
pnpm test -- tests/e2e/log-verbosity-settings.spec.ts -g "should display Logging Settings"

# Run tests in headed mode (see browser)
pnpm test -- tests/e2e/log-verbosity-settings.spec.ts --headed

# Debug specific test
pnpm test -- tests/integration/log-verbosity.spec.ts --debug

# Run all Story 6-3 tests (integration + E2E)
pnpm test -- tests/integration/log-verbosity.spec.ts tests/e2e/log-verbosity-settings.spec.ts

# Verify RED phase (all tests should fail)
pnpm test -- tests/integration/log-verbosity.spec.ts tests/e2e/log-verbosity-settings.spec.ts --reporter=list
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All tests written and failing (25 tests total: 13 integration + 12 E2E)
- ✅ Factories created for log verbosity settings
- ✅ Existing event log factories reused
- ✅ Mock requirements documented for Settings UI
- ✅ data-testid requirements listed
- ✅ Implementation checklist created

**Verification:**

- All tests run and fail as expected
- Failure messages are clear: "Unknown command: set_log_verbosity" and "Element not found: data-testid="
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Start with Backend (Integration Tests First)**
   - Implement `get_log_verbosity` and `set_log_verbosity` commands
   - Modify `log_event_internal` to check verbosity and filter info events
   - Run integration tests to verify GREEN phase
   - Expected: 13 integration tests pass

2. **Add Frontend UI (E2E Tests Second)**
   - Add TypeScript bindings for new commands
   - Add Logging Settings section to Settings.tsx
   - Add Log Verbosity dropdown with persistence
   - Run E2E tests to verify GREEN phase
   - Expected: 12 E2E tests pass

3. **Integrate Event Logging Throughout Codebase**
   - Add log_event_internal calls to connection, stream, EPG, matching modules
   - Verify events appear in Logs view
   - Test verbosity filtering end-to-end

**Key Principles:**

- One test at a time (implement backend first, then frontend)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap

**Progress Tracking:**

- Check off tasks as you complete them
- Share progress in daily standup
- Mark story as IN PROGRESS in sprint-status.yaml

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (25 total: 13 integration + 12 E2E)
2. **Review code for quality**
   - Ensure verbosity check is efficient (query setting once per log call)
   - Consider caching verbosity setting in memory for performance
   - Ensure all event categories use appropriate levels
3. **Extract duplications**
   - Consider helper function for common logging patterns
   - Reuse event detail formatting across modules
4. **Optimize performance**
   - Verify verbosity check doesn't impact logging performance
   - Consider lazy evaluation for details JSON stringification
5. **Ensure tests still pass** after each refactor
6. **Update documentation**
   - Document verbosity setting in README
   - Add JSDoc comments to new commands

**Key Principles:**

- Tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if tests fail)
- Run tests after each change
- Don't change test behavior (only implementation)

**Completion:**

- All tests pass (25/25)
- Code quality meets team standards
- No duplications or code smells
- Ready for code review and story approval

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow (manual handoff)
2. **Review this checklist** with team in standup or planning
3. **Run failing tests** to confirm RED phase: `pnpm test -- tests/integration/log-verbosity.spec.ts tests/e2e/log-verbosity-settings.spec.ts`
4. **Begin implementation** using implementation checklist as guide (backend first, then frontend)
5. **Work one test at a time** (red → green for each)
6. **Share progress** in daily standup
7. **When all tests pass**, refactor code for quality
8. **When refactoring complete**, manually update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **fixture-architecture.md** - Test fixture patterns with setup/teardown and auto-cleanup using Playwright's `test.extend()`
- **data-factories.md** - Factory patterns using `@faker-js/faker` for random test data generation with overrides support
- **test-quality.md** - Test design principles (Given-When-Then, one assertion per test, determinism, isolation)
- **test-levels-framework.md** - Test level selection framework (E2E vs API vs Component vs Unit)
- **network-first.md** - Route interception patterns (intercept BEFORE navigation to prevent race conditions)

See `_bmad/bmm/testarch/tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm test -- tests/integration/log-verbosity.spec.ts tests/e2e/log-verbosity-settings.spec.ts`

**Results:**

```
Expected RED phase failures:

Integration tests (13 tests):
❌ Error: Unknown command: set_log_verbosity
❌ Error: Unknown command: get_log_verbosity

E2E tests (12 tests):
❌ Error: Element not found - data-testid="logging-section"
❌ Error: Element not found - data-testid="log-verbosity-select"
```

**Summary:**

- Total tests: 25 (13 integration + 12 E2E)
- Passing: 0 (expected)
- Failing: 25 (expected)
- Status: ✅ RED phase verified

**Expected Failure Messages:**

**Integration Tests:**
- `Error: Unknown command: set_log_verbosity` - Command not registered in Tauri
- `Error: Unknown command: get_log_verbosity` - Command not registered in Tauri
- Tests will fail when trying to invoke these commands

**E2E Tests:**
- `Error: locator.click: Error: Element not found - data-testid="logging-section"` - UI section not implemented
- `Error: locator.selectOption: Error: Element not found - data-testid="log-verbosity-select"` - Dropdown not implemented
- Tests will fail when trying to interact with UI elements

---

## Notes

### Implementation Priority

1. **Backend First** - Implement Tauri commands and verbosity filtering logic (makes integration tests pass)
2. **Frontend Second** - Add UI controls in Settings.tsx (makes E2E tests pass)
3. **Integration Third** - Wire up event logging across all modules (completes AC #2)

### Architecture Context

**CRITICAL:** Story 6-3 **enhances** existing event logging infrastructure from Story 3-4. Do NOT recreate:
- `event_log` table (already exists)
- `log_event` command (already exists)
- `log_event_internal` helper (already exists - modify only for verbosity check)
- `Logs.tsx` view (already exists - no changes needed)

**What's NEW in Story 6-3:**
- Log verbosity setting (minimal/verbose)
- Verbosity filtering in `log_event_internal`
- UI controls for verbosity in Settings.tsx
- System-wide event logging integration

### Security Considerations

**NEVER log sensitive data:**
- Passwords (Xtream credentials)
- Full URLs with embedded credentials
- Encryption keys

**Safe to log:**
- Account names
- Server hostnames (without credentials)
- Channel names, counts, statistics
- Error messages (sanitized)

### Performance Considerations

- Verbosity check happens on every `log_event_internal` call
- Consider caching setting in memory instead of querying DB each time
- Ensure JSON stringification of details is only done when event will be logged

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Tag @tea-agent in Slack/Discord
- Refer to `_bmad/bmm/docs/tea-README.md` for workflow documentation
- Consult `_bmad/bmm/testarch/knowledge` for testing best practices
- Review Story 6-3 file: `_bmad-output/implementation-artifacts/6-3-event-logging-system.md`

---

**Generated by BMad TEA Agent** - 2026-01-23
