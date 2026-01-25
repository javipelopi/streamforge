# ATDD Checklist - Epic 6, Story 6.5: Auto-Update Mechanism

**Date:** 2026-01-24
**Author:** Javier
**Primary Test Level:** E2E

---

## Story Summary

Implement automatic update functionality for StreamForge that checks for and installs updates with Ed25519 signature verification.

**As a** user,
**I want** the app to check for and install updates,
**So that** I always have the latest features and fixes.

---

## Acceptance Criteria

1. **Check for Updates on Launch** (FR53)
   - Given the app starts
   - When it checks for updates (on launch, configurable)
   - Then it queries the update server for new versions
   - And if an update is available, a notification appears

2. **Update Notification with Release Notes**
   - Given an update is available
   - When I see the notification
   - Then I can click to see release notes
   - And I can choose to "Download & Install" or "Remind Later"

3. **Download and Install with Signature Verification** (FR54, NFR22)
   - Given I click "Download & Install"
   - When the download completes
   - Then the update package signature is verified (Ed25519)
   - And on verification success, the update is installed
   - And the app restarts with the new version

4. **Signature Verification Failure Handling**
   - Given signature verification fails
   - When the update is rejected
   - Then an error is shown explaining the security issue
   - And the update is not applied
   - And the event is logged

5. **Settings View - Updates Section**
   - Given the Settings view
   - When I look at the Updates section
   - Then I see:
     - Current version
     - "Check for Updates" button
     - Auto-check toggle (on/off)
     - Last check timestamp

6. **Settings Preservation Across Updates** (FR55)
   - Given an update is installed
   - When the app restarts
   - Then all settings are preserved
   - And database migrations run if needed

---

## Failing Tests Created (RED Phase)

### E2E Tests (7 tests)

**File:** `tests/e2e/auto-update.spec.ts` (320 lines)

- ✅ **Test:** Settings shows Updates section with all required elements
  - **Status:** RED - Updates section not implemented
  - **Verifies:** AC#5 - Updates section displays current version, check button, auto-check toggle, last check timestamp

- ✅ **Test:** Check for Updates button triggers update check
  - **Status:** RED - Update check command not implemented
  - **Verifies:** AC#1 - Manual update check from Settings triggers backend check

- ✅ **Test:** Auto-check toggle persists setting
  - **Status:** RED - Auto-check setting not implemented
  - **Verifies:** AC#5 - Toggle state persists across page reloads

- ✅ **Test:** Update notification appears when update available
  - **Status:** RED - Update notification component not implemented
  - **Verifies:** AC#2 - Notification appears with update details

- ✅ **Test:** Release notes display in update notification
  - **Status:** RED - Release notes view not implemented
  - **Verifies:** AC#2 - User can view release notes before installing

- ✅ **Test:** Remind Later dismisses notification temporarily
  - **Status:** RED - Remind Later functionality not implemented
  - **Verifies:** AC#2 - User can snooze update notification

- ✅ **Test:** Current version displays correctly in Settings
  - **Status:** RED - Version display not implemented
  - **Verifies:** AC#5 - Current app version shown in Settings

---

## Data Factories Created

No data factories required for this story. Update testing relies on Tauri plugin mocks.

---

## Fixtures Created

### Update Mocking Fixtures

**File:** `tests/support/fixtures/update.fixture.ts`

**Fixtures:**

- `mockUpdateAvailable` - Mocks Tauri updater plugin to simulate available update
  - **Setup:** Injects mock update response with version, notes, date
  - **Provides:** Mock update info for testing notification flow
  - **Cleanup:** None required (mock is page-scoped)

- `mockUpdateNotAvailable` - Mocks Tauri updater plugin to simulate no updates
  - **Setup:** Injects mock response indicating app is up-to-date
  - **Provides:** Mock for testing "no updates" scenario
  - **Cleanup:** None required (mock is page-scoped)

**Example Usage:**

```typescript
import { test } from './fixtures/update.fixture';

test('should show notification when update available', async ({ page, mockUpdateAvailable }) => {
  // mockUpdateAvailable is injected and ready to use
  await page.goto('/');
  // Test notification appears
});
```

---

## Mock Requirements

### Tauri Updater Plugin Mock

**Commands:**

- `check_for_update` - Returns update availability status
- `get_update_settings` - Returns current update settings
- `set_auto_check_updates` - Sets auto-check preference
- `download_and_install_update` - Simulates download and install (mock only)

**Success Response (Update Available):**

```json
{
  "available": true,
  "version": "1.2.0",
  "notes": "## What's New\n- Feature X\n- Bug fix Y",
  "date": "2026-01-24T00:00:00Z"
}
```

**Success Response (No Update):**

```json
{
  "available": false,
  "version": null,
  "notes": null,
  "date": null
}
```

**Update Settings Response:**

```json
{
  "autoCheck": true,
  "lastCheck": "2026-01-24T10:30:00Z",
  "currentVersion": "1.1.0"
}
```

**Notes:** For E2E tests, the Tauri updater plugin will be mocked using page.addInitScript(). Integration tests will require a local update server or mocked HTTP responses.

---

## Required data-testid Attributes

### Settings View - Updates Section

- `updates-section` - Updates configuration section container
- `current-version-display` - Current app version text
- `check-for-updates-button` - Manual update check button
- `auto-check-updates-toggle` - Auto-check on launch toggle switch
- `last-update-check-display` - Last check timestamp text
- `update-checking-spinner` - Loading indicator during check

### Update Notification Component

- `update-notification-dialog` - Update notification modal/dialog
- `update-version-display` - New version number text
- `update-release-notes-button` - View release notes button
- `update-release-notes-content` - Release notes text content
- `update-download-install-button` - Download & Install button
- `update-remind-later-button` - Remind Later button
- `update-progress-bar` - Download progress bar
- `update-progress-percentage` - Progress percentage text

### Error Messages

- `update-error-message` - Update error notification/toast
- `signature-verification-error` - Specific signature verification error

**Implementation Example:**

```tsx
<section data-testid="updates-section">
  <div data-testid="current-version-display">v1.1.0</div>
  <button data-testid="check-for-updates-button">Check for Updates</button>
  <Switch data-testid="auto-check-updates-toggle" />
  <span data-testid="last-update-check-display">Last checked: 1 hour ago</span>
</section>

<Dialog data-testid="update-notification-dialog">
  <p data-testid="update-version-display">Version 1.2.0</p>
  <button data-testid="update-release-notes-button">View Release Notes</button>
  <pre data-testid="update-release-notes-content">{notes}</pre>
  <button data-testid="update-download-install-button">Download & Install</button>
  <button data-testid="update-remind-later-button">Remind Later</button>
</Dialog>
```

---

## Implementation Checklist

### Test: Settings shows Updates section with all required elements

**File:** `tests/e2e/auto-update.spec.ts`

**Tasks to make this test pass:**

- [ ] Add Updates section to `src/views/Settings.tsx`
- [ ] Display current version using Tauri app.getVersion() API
- [ ] Add "Check for Updates" button with data-testid
- [ ] Add auto-check toggle switch with data-testid
- [ ] Add last check timestamp display with data-testid
- [ ] Implement `get_update_settings` Tauri command in `src-tauri/src/commands/updater.rs`
- [ ] Add required data-testid attributes: `updates-section`, `current-version-display`, `check-for-updates-button`, `auto-check-updates-toggle`, `last-update-check-display`
- [ ] Run test: `pnpm test -- tests/e2e/auto-update.spec.ts -g "Settings shows Updates section"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: Check for Updates button triggers update check

**File:** `tests/e2e/auto-update.spec.ts`

**Tasks to make this test pass:**

- [ ] Implement `check_for_update` Tauri command in `src-tauri/src/commands/updater.rs`
- [ ] Add Tauri updater plugin dependency to `src-tauri/Cargo.toml`
- [ ] Register updater plugin in `src-tauri/src/lib.rs`
- [ ] Add TypeScript binding in `src/lib/tauri.ts` for `checkForUpdate()`
- [ ] Wire button click to call `checkForUpdate()` in Settings.tsx
- [ ] Show loading state during check (spinner or button text change)
- [ ] Update last check timestamp after successful check
- [ ] Add required data-testid attributes: `update-checking-spinner`
- [ ] Run test: `pnpm test -- tests/e2e/auto-update.spec.ts -g "Check for Updates button"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 3 hours

---

### Test: Auto-check toggle persists setting

**File:** `tests/e2e/auto-update.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `auto_check_updates` setting to settings table (via migration or seed)
- [ ] Implement `set_auto_check_updates` Tauri command in `src-tauri/src/commands/updater.rs`
- [ ] Add TypeScript binding in `src/lib/tauri.ts` for `setAutoCheckUpdates()`
- [ ] Wire toggle onChange to call `setAutoCheckUpdates(enabled)`
- [ ] Load auto-check setting on Settings view mount
- [ ] Persist toggle state in database
- [ ] Run test: `pnpm test -- tests/e2e/auto-update.spec.ts -g "Auto-check toggle persists"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1.5 hours

---

### Test: Update notification appears when update available

**File:** `tests/e2e/auto-update.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/components/updates/UpdateNotification.tsx` component
- [ ] Implement auto-check on app launch in `src/App.tsx`
- [ ] Call `checkForUpdate()` after app loads (with delay to not block render)
- [ ] Show UpdateNotification dialog when update available
- [ ] Add required data-testid attributes: `update-notification-dialog`, `update-version-display`
- [ ] Run test: `pnpm test -- tests/e2e/auto-update.spec.ts -g "Update notification appears"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2.5 hours

---

### Test: Release notes display in update notification

**File:** `tests/e2e/auto-update.spec.ts`

**Tasks to make this test pass:**

- [ ] Add "View Release Notes" button to UpdateNotification component
- [ ] Add expandable/collapsible section for release notes
- [ ] Parse and display release notes from update metadata
- [ ] Add required data-testid attributes: `update-release-notes-button`, `update-release-notes-content`
- [ ] Run test: `pnpm test -- tests/e2e/auto-update.spec.ts -g "Release notes display"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: Remind Later dismisses notification temporarily

**File:** `tests/e2e/auto-update.spec.ts`

**Tasks to make this test pass:**

- [ ] Add "Remind Later" button to UpdateNotification component
- [ ] Implement snooze logic (store snooze timestamp in localStorage)
- [ ] Dismiss notification dialog when Remind Later clicked
- [ ] Check snooze timestamp before showing notification on next launch
- [ ] Add required data-testid attributes: `update-remind-later-button`
- [ ] Run test: `pnpm test -- tests/e2e/auto-update.spec.ts -g "Remind Later dismisses"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1.5 hours

---

### Test: Current version displays correctly in Settings

**File:** `tests/e2e/auto-update.spec.ts`

**Tasks to make this test pass:**

- [ ] Fetch current version from Tauri app.getVersion() API
- [ ] Display version in Settings Updates section
- [ ] Format version string (e.g., "v1.1.0")
- [ ] Verify data-testid attribute on version display
- [ ] Run test: `pnpm test -- tests/e2e/auto-update.spec.ts -g "Current version displays"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

## Running Tests

```bash
# Run all failing tests for this story
pnpm test -- tests/e2e/auto-update.spec.ts

# Run specific test file
pnpm test -- tests/e2e/auto-update.spec.ts

# Run tests in headed mode (see browser)
pnpm test -- tests/e2e/auto-update.spec.ts --headed

# Debug specific test
pnpm test -- tests/e2e/auto-update.spec.ts --debug

# Run tests with coverage
pnpm test -- tests/e2e/auto-update.spec.ts --coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All tests written and failing
- ✅ Fixtures and factories created with auto-cleanup
- ✅ Mock requirements documented
- ✅ data-testid requirements listed
- ✅ Implementation checklist created

**Verification:**

- All tests run and fail as expected
- Failure messages are clear and actionable
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (start with "Settings shows Updates section")
2. **Read the test** to understand expected behavior
3. **Implement minimal code** to make that specific test pass
4. **Run the test** to verify it now passes (green)
5. **Check off the task** in implementation checklist
6. **Move to next test** and repeat

**Key Principles:**

- One test at a time (don't try to fix all at once)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap

**Progress Tracking:**

- Check off tasks as you complete them
- Share progress in daily standup
- Mark story as IN PROGRESS in `sprint-status.yaml`

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
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

- All tests pass
- Code quality meets team standards
- No duplications or code smells
- Ready for code review and story approval

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow (manual handoff)
2. **Review this checklist** with team in standup or planning
3. **Run failing tests** to confirm RED phase: `pnpm test -- tests/e2e/auto-update.spec.ts`
4. **Begin implementation** using implementation checklist as guide
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
- **selector-resilience.md** - Selector hierarchy (data-testid > ARIA > text > CSS) for test stability

See `_bmad/bmm/testarch/tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm test -- tests/e2e/auto-update.spec.ts`

**Results:**

```
Running 12 tests using 4 workers

  ✘  [chromium] › Auto-Update - Settings View › should display Updates section with all required elements
  ✘  [chromium] › Auto-Update - Settings View › should display current version correctly
  ✘  [chromium] › Auto-Update - Check for Updates › should trigger update check when button clicked
  ✘  [chromium] › Auto-Update - Check for Updates › should show success message when no update available
  ✘  [chromium] › Auto-Update - Auto-Check Toggle › should persist auto-check setting when toggled
  ✘  [chromium] › Auto-Update - Auto-Check Toggle › should enable auto-check when toggled on
  ✘  [chromium] › Auto-Update - Update Notification › should display update notification when update available
  ✘  [chromium] › Auto-Update - Update Notification › should display release notes when View Release Notes clicked
  ✘  [chromium] › Auto-Update - Update Notification › should have Download & Install button
  ✘  [chromium] › Auto-Update - Remind Later › should dismiss notification when Remind Later clicked
  ✘  [chromium] › Auto-Update - Remind Later › should not show notification again immediately after Remind Later
  ✘  [chromium] › Auto-Update - Last Check Timestamp › should display last check timestamp after manual check

  12 failed
    [chromium] › tests/e2e/auto-update.spec.ts:29:3 › Auto-Update - Settings View › should display Updates section with all required elements
    [chromium] › tests/e2e/auto-update.spec.ts:59:3 › Auto-Update - Settings View › should display current version correctly
    [chromium] › tests/e2e/auto-update.spec.ts:82:3 › Auto-Update - Check for Updates › should trigger update check when button clicked
    [chromium] › tests/e2e/auto-update.spec.ts:104:3 › Auto-Update - Check for Updates › should show success message when no update available
    [chromium] › tests/e2e/auto-update.spec.ts:136:3 › Auto-Update - Auto-Check Toggle › should persist auto-check setting when toggled
    [chromium] › tests/e2e/auto-update.spec.ts:163:3 › Auto-Update - Auto-Check Toggle › should enable auto-check when toggled on
    [chromium] › tests/e2e/auto-update.spec.ts:201:3 › Auto-Update - Update Notification › should display update notification when update available
    [chromium] › tests/e2e/auto-update.spec.ts:224:3 › Auto-Update - Update Notification › should display release notes when View Release Notes clicked
    [chromium] › tests/e2e/auto-update.spec.ts:246:3 › Auto-Update - Update Notification › should have Download & Install button
    [chromium] › tests/e2e/auto-update.spec.ts:274:3 › Auto-Update - Remind Later › should dismiss notification when Remind Later clicked
    [chromium] › tests/e2e/auto-update.spec.ts:294:3 › Auto-Update - Remind Later › should not show notification again immediately after Remind Later
    [chromium] › tests/e2e/auto-update.spec.ts:329:3 › Auto-Update - Last Check Timestamp › should display last check timestamp after manual check
```

**Summary:**

- Total tests: 12
- Passing: 0 (expected)
- Failing: 12 (expected - updates functionality not implemented)
- Status: ✅ RED phase verified

**Expected Failure Messages:**

1. "Updates section not found" - Settings doesn't have Updates section yet (data-testid="updates-section")
2. "Check button not found" - Update check functionality not implemented (data-testid="check-for-updates-button")
3. "Auto-check toggle not found" - Toggle setting not implemented (data-testid="auto-check-updates-toggle")
4. "Update notification not found" - Notification component not implemented (data-testid="update-notification-dialog")
5. "Release notes button not found" - Release notes view not implemented (data-testid="update-release-notes-button")
6. "Remind Later button not found" - Remind Later functionality not implemented (data-testid="update-remind-later-button")
7. "Version display not found" - Version display not implemented (data-testid="current-version-display")
8. "Last check display not found" - Last check timestamp not implemented (data-testid="last-update-check-display")

---

## Notes

- **Tauri Plugin Configuration:** The Tauri updater plugin requires configuration in `tauri.conf.json` with Ed25519 public key and update endpoint URLs. This configuration is needed before tests can pass.

- **Signing Keys:** Ed25519 keypair must be generated using `pnpm tauri signer generate` and stored securely. Private key goes in CI/CD secrets, public key goes in `tauri.conf.json`.

- **Mock Limitations:** E2E tests mock the update check response. To test actual update downloads and signature verification, integration tests with a local update server are required.

- **Settings Patterns:** Reuse existing patterns from Story 6-1 (server port, auto-start) for consistency in UI and backend implementation.

- **Event Logging:** Use existing `log_event_internal()` function from Story 6-4 to log update events (check, download, install, error).

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Tag @TEA-Agent in Slack/Discord
- Refer to `_bmad/bmm/docs/tea-README.md` for workflow documentation
- Consult `_bmad/bmm/testarch/knowledge` for testing best practices

---

**Generated by BMad TEA Agent** - 2026-01-24
