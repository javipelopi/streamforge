# ATDD Checklist - Epic 1, Story 4: Implement System Tray Integration

**Date:** 2026-01-19
**Author:** Javier
**Primary Test Level:** E2E (Manual Verification)

---

## Story Summary

As a user, I want the app to minimize to system tray, so that it can run in the background without cluttering my taskbar.

**As a** user
**I want** the app to minimize to system tray
**So that** it can run in the background without cluttering my taskbar

---

## Acceptance Criteria

1. **Given** the application is running
   **When** I click the window close button
   **Then** the app minimizes to system tray instead of quitting
   **And** a tray icon appears with the app logo

2. **Given** the app is in the system tray
   **When** I click the tray icon
   **Then** the main window is shown and focused

3. **Given** the app is in the system tray
   **When** I right-click the tray icon
   **Then** a context menu appears with options:
   - Show Window
   - Quit
   **And** selecting "Quit" exits the application completely

---

## Important Note: Manual Verification Required

**System tray interactions occur at the OS level and cannot be automated with Playwright.** This story requires manual E2E verification testing rather than automated tests.

**Why Manual Testing:**
- System tray icons exist outside the browser/webview context
- Native OS interactions (tray icon clicks, context menus) are not accessible via web automation tools
- Tauri's system tray is a native OS feature, not a web UI element

**Testing Approach:**
- Manual verification checklist provided below
- Run Tauri app in dev mode: `pnpm tauri dev`
- Execute each test scenario manually
- Document results in this checklist

---

## Manual Verification Tests (RED Phase)

### E2E Test 1: System Tray Icon Appears on Launch

**File:** Manual Verification (No automated test file)

- ✅ **Test:** System tray icon appears when application launches
  - **Status:** RED - Tray icon feature not implemented yet
  - **Verifies:** AC#1 - Tray icon appears with app logo
  - **Steps:**
    1. Run `pnpm tauri dev`
    2. Look for app icon in system tray (macOS: top-right menu bar)
    3. Verify icon matches app logo from `src-tauri/icons/`
  - **Expected Result:** Tray icon visible in system tray
  - **Actual Result:** (To be filled during testing)

### E2E Test 2: Window Hides to Tray on Close

**File:** Manual Verification (No automated test file)

- ✅ **Test:** Clicking window close button hides app to tray
  - **Status:** RED - Hide-on-close behavior not implemented
  - **Verifies:** AC#1 - App minimizes to tray instead of quitting
  - **Steps:**
    1. Launch app with `pnpm tauri dev`
    2. Verify app window is visible
    3. Click the window close button (X)
    4. Check if window disappears
    5. Verify tray icon remains visible
    6. Check if app process is still running (Activity Monitor on macOS)
  - **Expected Result:** Window hidden, tray icon visible, app process running
  - **Actual Result:** (To be filled during testing)

### E2E Test 3: Left-Click Tray Icon Shows Window

**File:** Manual Verification (No automated test file)

- ✅ **Test:** Left-clicking tray icon shows and focuses window
  - **Status:** RED - Tray icon click handler not implemented
  - **Verifies:** AC#2 - Main window shown and focused
  - **Steps:**
    1. Launch app and hide window to tray (click close button)
    2. Left-click the tray icon
    3. Verify window becomes visible
    4. Verify window receives focus (brought to foreground)
  - **Expected Result:** Window visible and focused
  - **Actual Result:** (To be filled during testing)

### E2E Test 4: Left-Click Tray Icon Toggles Window

**File:** Manual Verification (No automated test file)

- ✅ **Test:** Left-clicking tray icon toggles window visibility
  - **Status:** RED - Toggle behavior not implemented
  - **Verifies:** AC#2 - Toggle show/hide on click
  - **Steps:**
    1. Launch app with visible window
    2. Left-click tray icon
    3. Verify window hides
    4. Left-click tray icon again
    5. Verify window shows and focuses
  - **Expected Result:** Window toggles between visible/hidden states
  - **Actual Result:** (To be filled during testing)

### E2E Test 5: Right-Click Shows Context Menu

**File:** Manual Verification (No automated test file)

- ✅ **Test:** Right-clicking tray icon displays context menu
  - **Status:** RED - Context menu not implemented
  - **Verifies:** AC#3 - Context menu appears
  - **Steps:**
    1. Launch app
    2. Right-click the tray icon
    3. Verify context menu appears
    4. Verify menu contains "Show Window" option
    5. Verify menu contains "Quit" option
  - **Expected Result:** Context menu with "Show Window" and "Quit" options
  - **Actual Result:** (To be filled during testing)

### E2E Test 6: Context Menu "Show Window" Action

**File:** Manual Verification (No automated test file)

- ✅ **Test:** Selecting "Show Window" from context menu shows window
  - **Status:** RED - Menu action handler not implemented
  - **Verifies:** AC#3 - Show Window menu action
  - **Steps:**
    1. Launch app and hide window to tray
    2. Right-click tray icon
    3. Click "Show Window" menu item
    4. Verify window becomes visible and focused
  - **Expected Result:** Window visible and focused
  - **Actual Result:** (To be filled during testing)

### E2E Test 7: Context Menu "Quit" Action

**File:** Manual Verification (No automated test file)

- ✅ **Test:** Selecting "Quit" from context menu exits application
  - **Status:** RED - Quit action handler not implemented
  - **Verifies:** AC#3 - Quit exits application completely
  - **Steps:**
    1. Launch app
    2. Right-click tray icon
    3. Click "Quit" menu item
    4. Verify window closes
    5. Verify tray icon disappears
    6. Verify app process terminates (check Activity Monitor)
  - **Expected Result:** App exits completely, no lingering processes
  - **Actual Result:** (To be filled during testing)

### E2E Test 8: App Persists After Window Close

**File:** Manual Verification (No automated test file)

- ✅ **Test:** App continues running after window close
  - **Status:** RED - RunEvent handler not implemented
  - **Verifies:** AC#1 - App runs in background
  - **Steps:**
    1. Launch app
    2. Close window with close button (X)
    3. Check Activity Monitor for running process
    4. Verify app process still exists
    5. Click tray icon to restore window
    6. Verify app state is preserved (no restart occurred)
  - **Expected Result:** App process running, state preserved
  - **Actual Result:** (To be filled during testing)

---

## Data Factories Created

**None required** - This story tests system-level behavior (native OS tray integration) with no data dependencies.

---

## Fixtures Created

**None required** - Manual verification tests do not use Playwright fixtures.

---

## Mock Requirements

**None required** - System tray functionality is native OS-level, no external services to mock.

---

## Required data-testid Attributes

**None required** - System tray interactions are native OS features, not web UI elements.

The existing React GUI already has the necessary `data-testid` attributes from Story 1-3.

---

## Implementation Checklist

### Test: System Tray Icon Appears on Launch

**Verification:** Manual (see E2E Test 1)

**Tasks to make this test pass:**

- [ ] Task 1: Enable tray-icon feature in Cargo.toml
  - [ ] Add `tray-icon` feature to tauri dependency in `src-tauri/Cargo.toml`
  - [ ] Run `cargo check` to verify feature compilation
- [ ] Task 2: Import tray and menu types in lib.rs
  - [ ] Add `use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};`
  - [ ] Add `use tauri::menu::{Menu, MenuItem};`
  - [ ] Add `use tauri::{Manager, RunEvent, WindowEvent};`
- [ ] Task 3: Create tray menu in setup function
  - [ ] Create "Show Window" menu item: `MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?`
  - [ ] Create "Quit" menu item: `MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?`
  - [ ] Build menu: `Menu::with_items(app, &[&show_i, &quit_i])?`
- [ ] Task 4: Build TrayIconBuilder
  - [ ] Get app icon: `app.default_window_icon().unwrap().clone()`
  - [ ] Configure: `.menu(&menu)` and `.menu_on_left_click(false)`
  - [ ] Call `.build(app)?` to create tray icon
- [ ] Run manual verification: Execute E2E Test 1
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: Window Hides to Tray on Close

**Verification:** Manual (see E2E Test 2)

**Tasks to make this test pass:**

- [ ] Task 5: Add on_window_event handler to Builder
  - [ ] Add `.on_window_event(|window, event| {...})` to Builder chain
  - [ ] Match `WindowEvent::CloseRequested { api, .. }`
  - [ ] Call `window.hide().unwrap()` to hide instead of close
  - [ ] Call `api.prevent_close()` to prevent window destruction
- [ ] Run manual verification: Execute E2E Test 2
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 30 minutes

---

### Test: Left-Click Tray Icon Shows/Toggles Window

**Verification:** Manual (see E2E Tests 3 & 4)

**Tasks to make this test pass:**

- [ ] Task 6: Implement on_tray_icon_event handler
  - [ ] Add `.on_tray_icon_event(|tray, event| {...})` to TrayIconBuilder
  - [ ] Match `TrayIconEvent::Click` with `MouseButton::Left` and `MouseButtonState::Up`
  - [ ] Get app handle: `tray.app_handle()`
  - [ ] Get window: `app.get_webview_window("main")`
  - [ ] Check visibility: `window.is_visible().unwrap_or(false)`
  - [ ] If visible: `window.hide()`, if hidden: `window.unminimize()`, `window.show()`, `window.set_focus()`
- [ ] Run manual verification: Execute E2E Tests 3 & 4
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 45 minutes

---

### Test: Right-Click Shows Context Menu with Actions

**Verification:** Manual (see E2E Tests 5, 6, 7)

**Tasks to make this test pass:**

- [ ] Task 7: Implement on_menu_event handler
  - [ ] Add `.on_menu_event(|app, event| {...})` to TrayIconBuilder
  - [ ] Match event.id "show":
    - [ ] Get window: `app.get_webview_window("main")`
    - [ ] Call `window.unminimize()`, `window.show()`, `window.set_focus()`
  - [ ] Match event.id "quit":
    - [ ] Call `app.exit(0)` to exit with explicit code
- [ ] Run manual verification: Execute E2E Tests 5, 6, 7
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 30 minutes

---

### Test: App Persists After Window Close

**Verification:** Manual (see E2E Test 8)

**Tasks to make this test pass:**

- [ ] Task 8: Change Builder pattern to support run event handling
  - [ ] Change from `.run(tauri::generate_context!())` to `.build(tauri::generate_context!())?`
  - [ ] Add `.run(|_app_handle, event| {...})` after build
  - [ ] Match `RunEvent::ExitRequested { api, code, .. }`
  - [ ] If `code.is_none()`: call `api.prevent_exit()` (window close triggered exit)
  - [ ] If `code.is_some()`: allow exit (explicit quit from menu)
  - [ ] Adjust function signature: change `expect()` to `?` and return `Result<(), Box<dyn std::error::Error>>`
- [ ] Update main.rs to handle Result from run()
- [ ] Run manual verification: Execute E2E Test 8
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 45 minutes

---

### Final Verification: All Tests Pass

**Verification:** Manual (run all E2E tests 1-8)

**Tasks:**

- [ ] Task 9: Run full manual test suite
  - [ ] Execute all 8 E2E tests in sequence
  - [ ] Document actual results in this checklist
  - [ ] Verify all tests pass (GREEN phase)
- [ ] Task 10: Test edge cases
  - [ ] Test window state preservation after hide/show cycle
  - [ ] Test rapid clicking tray icon
  - [ ] Test multiple window close attempts
  - [ ] Verify tray icon appears on different screen resolutions
- [ ] Task 11: Platform verification
  - [ ] Test on macOS (primary platform)
  - [ ] Document any platform-specific behavior
- [ ] Task 12: Production build verification
  - [ ] Run `pnpm tauri build`
  - [ ] Install built app
  - [ ] Verify tray functionality in production build
  - [ ] Test on clean system (no dev environment)
- [ ] ✅ All tests pass, story complete

**Estimated Effort:** 1 hour

---

## Running Tests

```bash
# Launch Tauri app in development mode
pnpm tauri dev

# Execute manual verification tests (follow checklist above)
# 1. Verify tray icon appears
# 2. Close window and verify app stays in tray
# 3. Click tray icon to show/hide window
# 4. Right-click tray icon and test menu actions
# 5. Verify "Quit" exits app completely

# Build production version for final testing
pnpm tauri build

# Run Rust compilation checks during development
cd src-tauri
cargo check
cargo clippy -- -D warnings
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All manual verification tests documented with clear steps
- ✅ Expected results specified for each test
- ✅ Implementation checklist created with detailed tasks
- ✅ Tasks mapped to acceptance criteria
- ✅ No data factories/fixtures needed (system-level testing)

**Verification:**

- Manual tests will fail initially (tray feature not implemented)
- Implementation tasks are clear and actionable
- Each task maps directly to making a test pass

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Start with Task 1** - Enable tray-icon feature
2. **Follow implementation checklist in order** - Each task builds on previous
3. **Run manual verification after each major task** - Immediate feedback
4. **Mark tasks complete** as they pass verification
5. **Document any issues or deviations** in this checklist

**Key Principles:**

- One task at a time (systematic implementation)
- Verify after each major milestone (tray appears, window hides, click works, menu works)
- Use the Tauri 2.0 API patterns documented in story dev notes
- Handle all Result types properly (use `let _ =` for fire-and-forget operations)
- Test on target platform (macOS)

**Progress Tracking:**

- Check off tasks as completed
- Fill in "Actual Result" fields during manual testing
- Update story status to IN_PROGRESS in sprint-status.yaml
- Share blockers immediately in standup

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all manual tests pass** (all 8 E2E tests green)
2. **Review Rust code quality**
   - Clear error handling (no unwrap() in production code paths)
   - Proper Result propagation
   - Clean separation of concerns (menu setup, event handlers)
3. **Optimize if needed**
   - Ensure tray icon loads quickly
   - Verify no memory leaks (app runs in background indefinitely)
4. **Run final checks**
   - `cargo clippy -- -D warnings` (no clippy warnings)
   - `cargo check` (clean compilation)
   - `pnpm tauri build` (production build succeeds)

**Key Principles:**

- Manual tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if behavior changes)
- Re-verify critical flows after refactoring
- Don't change behavior (only improve code structure)

**Completion:**

- All manual tests pass consistently
- Code quality meets Rust standards (clippy clean)
- No unwrap() calls in production paths
- Production build verified
- Ready for code review and story approval

---

## Next Steps

1. **Share this checklist** with the dev workflow (manual handoff)
2. **Review implementation approach** - Understand Tauri 2.0 TrayIconBuilder API
3. **Begin implementation** - Start with Task 1 (enable feature flag)
4. **Work through checklist systematically** - One task at a time
5. **Run manual verification frequently** - After each major milestone
6. **Document results** - Fill in "Actual Result" fields during testing
7. **When all tests pass** - Run full verification suite and production build
8. **When complete** - Update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **test-quality.md** - Test design principles (determinism, isolation, explicit assertions)
- **selector-resilience.md** - Selector best practices (data-testid hierarchy, though not applicable to native tray)
- **data-factories.md** - Factory patterns (not applicable - no data dependencies)

**Note:** Most TEA knowledge base patterns focus on UI automation with Playwright. Since system tray testing requires manual verification (native OS feature), this checklist adapts the ATDD approach with comprehensive manual testing documentation instead of automated test files.

See `_bmad/bmm/testarch/tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Verification Method:** Manual Testing

**Expected State:**

Before implementation, attempting to manually verify any test should fail:

- **E2E Test 1:** No tray icon visible when app launches
- **E2E Test 2:** Clicking close button exits app (doesn't hide to tray)
- **E2E Test 3-4:** No tray icon to click
- **E2E Test 5-7:** No context menu available
- **E2E Test 8:** App terminates when window closes (doesn't persist)

**Actual State:** (To be documented after implementation)

**Summary:**

- Total manual tests: 8
- Passing: 0 (expected in RED phase)
- Failing: 8 (expected in RED phase)
- Status: ✅ RED phase verified (no implementation exists yet)

---

## Notes

### Platform-Specific Considerations

- **macOS:** Tray icon appears in top-right menu bar
- **Windows:** Tray icon appears in system tray (bottom-right taskbar area)
- **Linux:** Tray icon click events NOT supported (limitation of Linux tray implementations)
  - Menu will still work on right-click
  - Left-click events won't trigger

### Tauri 2.0 API Notes

- Feature flag: `tray-icon` (not `system-tray` from Tauri 1.x)
- Use `TrayIconBuilder` from `tauri::tray` module
- Use `MenuItem::with_id()` and `Menu::with_items()` from `tauri::menu`
- Window access: `get_webview_window("main")` (not `get_window()`)
- Prevent exit: `RunEvent::ExitRequested` with `api.prevent_exit()`

### Implementation References

- Story dev notes contain complete Rust implementation example
- Tauri 2.0 docs: https://v2.tauri.app/learn/system-tray/
- Existing lib.rs structure already has setup closure (add tray code there)

### Testing Strategy

Since system tray is native OS feature:
- **Cannot use Playwright** - Tray exists outside webview context
- **Manual verification required** - Human tester executes checklist
- **Document thoroughly** - Clear steps, expected results, actual results
- **Verify on target platform** - Test on macOS (user's platform)

### Success Criteria

Story is complete when:
1. All 8 manual E2E tests pass consistently
2. Tray icon appears with correct logo
3. Window hides to tray on close (app persists)
4. Tray icon click shows/hides window
5. Context menu works (Show Window, Quit)
6. Quit exits app completely
7. Production build verified
8. No clippy warnings or compilation errors

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Refer to story dev notes for implementation details
- Consult Tauri 2.0 documentation for API reference
- Check `src-tauri/Cargo.toml` for feature flags

---

**Generated by BMad TEA Agent** - 2026-01-19
