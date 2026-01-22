# ATDD Checklist - Epic 5, Story 5.5: EPG Channel List Panel

**Date:** 2026-01-22
**Author:** Javier
**Primary Test Level:** E2E (End-to-End)

---

## Story Summary

Build the vertical channel list panel for the EPG TV-style layout, showing all enabled channels with their current program information, including channel logos, program titles, time ranges, and progress bars indicating elapsed time. Users can select channels via click or keyboard navigation.

**As a** user,
**I want** a vertical channel list showing what's currently playing,
**So that** I can quickly see all my channels and their current programs.

---

## Acceptance Criteria

1. **Given** the EPG left panel **When** it loads **Then** I see a virtualized list of enabled XMLTV channels **And** each row shows:
   - Channel logo (80×60px)
   - Channel name (bold, white)
   - Current program time range
   - Current program title
   - Progress bar showing time elapsed

2. **Given** the channel list **When** I select a channel (click or keyboard) **Then** the row shows selected state (pill highlight, purple tint) **And** the center panel updates to show that channel's schedule

3. **Given** a large channel list **When** scrolling **Then** UI remains responsive (<100ms) **And** TanStack Virtual handles efficient rendering

---

## Failing Tests Created (RED Phase)

### E2E Tests (10 tests)

**File:** `tests/e2e/epg-channel-list-panel.spec.ts` (346 lines)

- ✅ **Test:** should display channel list with current program info (AC1)
  - **Status:** RED - EpgChannelList component not yet implemented
  - **Verifies:** Channel list renders with logos, names, program info, and progress bars

- ✅ **Test:** should display progress bar showing elapsed time (AC1)
  - **Status:** RED - EpgProgressBar component not yet implemented
  - **Verifies:** Progress bar width accurately reflects elapsed time percentage

- ✅ **Test:** should select channel and update state on click (AC2)
  - **Status:** RED - Channel selection state management not implemented
  - **Verifies:** Clicking a channel applies selected styling and updates state

- ✅ **Test:** should support keyboard navigation for channel selection (AC2)
  - **Status:** RED - Keyboard navigation handlers not implemented
  - **Verifies:** Arrow keys navigate up/down through channel list

- ✅ **Test:** should remain responsive with large channel list (AC3)
  - **Status:** RED - TanStack Virtual integration not yet complete
  - **Verifies:** 500+ channels render efficiently with virtualization

- ✅ **Test:** should display empty state when no enabled channels (AC1)
  - **Status:** RED - Empty state UI not implemented
  - **Verifies:** Helpful message shown when no channels are enabled

- ✅ **Test:** should handle channel without current program (AC1)
  - **Status:** RED - Fallback UI for missing program not implemented
  - **Verifies:** "No program info available" message shown gracefully

- ✅ **Test:** should truncate long channel names with ellipsis (AC1)
  - **Status:** RED - Text truncation styling not applied
  - **Verifies:** Long channel names don't break layout

- ✅ **Test:** should display placeholder icon for missing channel logo (AC1)
  - **Status:** RED - Fallback logo logic not implemented
  - **Verifies:** Placeholder or first letter shown when logo missing

- ✅ **Test:** should update progress bars every 60 seconds (AC1)
  - **Status:** RED - Auto-refresh interval not implemented
  - **Verifies:** Progress bars update periodically without manual refresh

---

## Data Factories Created

### EpgChannelList Factory

**File:** `tests/support/factories/epg-channel-list.factory.ts`

**Exports:**
- `createEpgChannelWithCurrentProgram(overrides?)` - Create single channel with current program
- `createEpgChannelWithoutProgram(overrides?)` - Create channel without program
- `createEpgChannelsWithPrograms(count)` - Create multiple channels with programs
- `createEpgChannelListData(overrides?)` - Create complete channel list data structure
- `createEpgChannelAtProgress(progressPercent, overrides?)` - Create channel with specific progress
- `createEpgChannelsWithVariedProgress(count)` - Create channels with 0-100% progress spread
- `calculateProgramProgress(startTime, endTime, currentTime?)` - Calculate progress percentage

**Example Usage:**

```typescript
// Create 20 channels with current programs
const channelListData = createEpgChannelListData({
  channelCount: 20,
  includeChannelsWithoutPrograms: true,
  withoutProgramCount: 3,
});

// Create channel at 50% progress
const channel = createEpgChannelAtProgress(50, {
  channelName: 'ESPN',
});

// Create channels with varied progress for visual testing
const channels = createEpgChannelsWithVariedProgress(10);
```

---

## Fixtures Created

### EpgChannelList Fixtures

**File:** `tests/support/fixtures/epg-channel-list.fixture.ts`

**Fixtures:**

- `epgChannelListData` - Pre-populated channel list with 20 channels and current programs
  - **Setup:** Creates test channels via Tauri commands, enables them, creates current programs
  - **Provides:** EpgChannelListData object with channels and timestamp
  - **Cleanup:** Deletes all test channels and programs after test completes

- `epgChannelListApi` - API helpers for interacting with channel list
  - **Setup:** None (read-only operations)
  - **Provides:** Helper methods for getting channels, selecting channels, refreshing
  - **Cleanup:** None needed

**Example Usage:**

```typescript
import { test, expect } from '../support/fixtures/epg-channel-list.fixture';

test('should display channels', async ({ page, epgChannelListData }) => {
  await page.goto('/epg-tv');

  // epgChannelListData.channels contains 20 test channels with auto-cleanup
  const firstChannel = epgChannelListData.channels[0];
  await expect(page.getByTestId(`channel-row-${firstChannel.id}`)).toBeVisible();
});
```

---

## Mock Requirements

### Tauri Commands Mock

**Required Tauri Commands:**
- `get_enabled_channels_with_programs(startTime, endTime)` - Returns enabled channels with programs in time range
- `create_test_xmltv_channel(id, displayName, icon)` - Test helper to create channel
- `set_xmltv_channel_enabled(channelId, enabled, plexDisplayOrder)` - Enable/disable channel
- `create_test_program(xmltvChannelId, title, startTime, endTime, category, description)` - Test helper to create program
- `delete_test_channel_data(channelId)` - Test cleanup helper

**Notes:** These commands should already exist from previous stories. If not, they must be implemented in the Rust backend for tests to pass.

---

## Required data-testid Attributes

### EpgChannelList Component

- `epg-channel-list` - Channel list container element
- `epg-channel-list-empty` - Empty state container (when no channels)

### EpgChannelRow Component

- `channel-row-{channelId}` - Individual channel row (e.g., `channel-row-123`)
- `channel-logo` - Channel logo image/placeholder
- `channel-name` - Channel name text
- `program-time-range` - Current program time range (e.g., "7:30 - 8:00 PM")
- `program-title` - Current program title text

### EpgProgressBar Component

- `progress-bar` - Progress bar container
- `progress-fill` - Progress bar fill element (shows elapsed percentage)

**Implementation Example:**

```tsx
// EpgChannelRow.tsx
<div data-testid={`channel-row-${channel.id}`} aria-selected={isSelected}>
  <img data-testid="channel-logo" src={channel.icon} />
  <span data-testid="channel-name">{channel.name}</span>
  <span data-testid="program-time-range">{timeRange}</span>
  <span data-testid="program-title">{program.title}</span>
  <EpgProgressBar percent={progressPercent} />
</div>

// EpgProgressBar.tsx
<div data-testid="progress-bar">
  <div data-testid="progress-fill" style={{ width: `${percent}%` }} />
</div>
```

---

## Implementation Checklist

### Test: should display channel list with current program info

**File:** `tests/e2e/epg-channel-list-panel.spec.ts:11`

**Tasks to make this test pass:**

- [ ] Create `src/components/epg/tv-style/EpgChannelList.tsx` component
- [ ] Integrate TanStack Virtual (`useVirtualizer`) for efficient rendering
- [ ] Create `src/components/epg/tv-style/EpgChannelRow.tsx` component
- [ ] Implement channel logo display (80×60px, object-fit: contain, rounded 4px)
- [ ] Display channel name (bold, white, 14-16px, truncate with ellipsis)
- [ ] Display current program time range (light gray #a0a0a0)
- [ ] Display current program title (white, 14px, single line with ellipsis)
- [ ] Add required data-testid attributes: `epg-channel-list`, `channel-row-{id}`, `channel-logo`, `channel-name`, `program-time-range`, `program-title`
- [ ] Run test: `pnpm test:e2e -- epg-channel-list-panel.spec.ts -g "should display channel list"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 3 hours

---

### Test: should display progress bar showing elapsed time

**File:** `tests/e2e/epg-channel-list-panel.spec.ts:67`

**Tasks to make this test pass:**

- [ ] Create `src/components/epg/tv-style/EpgProgressBar.tsx` component
- [ ] Implement progress calculation: `(elapsed / duration) * 100`
- [ ] Handle edge cases: program not started (0%), program ended (100%)
- [ ] Style progress bar: height 3px, bg `rgba(255,255,255,0.2)`, fill gradient `#6366f1` to `#22d3ee`
- [ ] Add rounded ends (border-radius)
- [ ] Add data-testid attributes: `progress-bar`, `progress-fill`
- [ ] Integrate progress bar into EpgChannelRow component
- [ ] Run test: `pnpm test:e2e -- epg-channel-list-panel.spec.ts -g "should display progress bar"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1.5 hours

---

### Test: should select channel and update state on click

**File:** `tests/e2e/epg-channel-list-panel.spec.ts:115`

**Tasks to make this test pass:**

- [ ] Add `selectedChannelId` prop to EpgChannelList component
- [ ] Add `onSelectChannel` callback prop to EpgChannelList component
- [ ] Implement click handler in EpgChannelRow to emit selection event
- [ ] Apply selected state styling: border `rgba(255,255,255,0.3)`, bg `rgba(99,102,241,0.2)`, border-radius 12px
- [ ] Add `aria-selected` attribute to channel row (true when selected)
- [ ] Ensure only one channel can be selected at a time
- [ ] Wire up state management in parent EpgTv component
- [ ] Run test: `pnpm test:e2e -- epg-channel-list-panel.spec.ts -g "should select channel and update state on click"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: should support keyboard navigation for channel selection

**File:** `tests/e2e/epg-channel-list-panel.spec.ts:145`

**Tasks to make this test pass:**

- [ ] Add keyboard event listeners to EpgChannelList component (onKeyDown)
- [ ] Handle ArrowDown key: Select next channel in list
- [ ] Handle ArrowUp key: Select previous channel in list
- [ ] Prevent selection from going out of bounds (stop at first/last channel)
- [ ] Update selected channel state on keyboard navigation
- [ ] Scroll virtualized list to keep selected channel visible
- [ ] Add proper focus management (focusable container)
- [ ] Run test: `pnpm test:e2e -- epg-channel-list-panel.spec.ts -g "should support keyboard navigation"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: should remain responsive with large channel list

**File:** `tests/e2e/epg-channel-list-panel.spec.ts:173`

**Tasks to make this test pass:**

- [ ] Configure TanStack Virtual with appropriate settings:
  - [ ] `estimateSize: () => 96` (estimated row height)
  - [ ] `overscan: 5` (render 5 extra items above/below viewport)
  - [ ] `getScrollElement: () => parentRef.current`
- [ ] Verify virtualization is working (only visible rows rendered)
- [ ] Test with 500+ channels in development
- [ ] Optimize any expensive calculations in row rendering
- [ ] Ensure progress bar updates don't cause full list re-render
- [ ] Run test: `pnpm test:e2e -- epg-channel-list-panel.spec.ts -g "should remain responsive"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: should display empty state when no enabled channels

**File:** `tests/e2e/epg-channel-list-panel.spec.ts:219`

**Tasks to make this test pass:**

- [ ] Add conditional rendering in EpgChannelList for empty state
- [ ] Create empty state UI with helpful message
- [ ] Style empty state: centered, muted text, icon
- [ ] Message: "No channels in lineup. Add channels from Sources."
- [ ] Add `data-testid="epg-channel-list-empty"` to empty state
- [ ] Handle loading state (show skeleton/spinner)
- [ ] Run test: `pnpm test:e2e -- epg-channel-list-panel.spec.ts -g "should display empty state"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: should handle channel without current program

**File:** `tests/e2e/epg-channel-list-panel.spec.ts:240`

**Tasks to make this test pass:**

- [ ] Add conditional rendering in EpgChannelRow for missing program
- [ ] Display "No program info available" when currentProgram is undefined
- [ ] Style fallback text with muted color
- [ ] Hide progress bar when no program is available
- [ ] Hide time range when no program is available
- [ ] Ensure channel name and logo still display
- [ ] Run test: `pnpm test:e2e -- epg-channel-list-panel.spec.ts -g "should handle channel without current program"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: should truncate long channel names with ellipsis

**File:** `tests/e2e/epg-channel-list-panel.spec.ts:262`

**Tasks to make this test pass:**

- [ ] Apply Tailwind classes to channel name element: `truncate` (or `overflow-hidden text-ellipsis whitespace-nowrap`)
- [ ] Set max-width or ensure parent container constrains width
- [ ] Test with very long channel name in development
- [ ] Verify ellipsis appears when name overflows
- [ ] Run test: `pnpm test:e2e -- epg-channel-list-panel.spec.ts -g "should truncate long channel names"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: should display placeholder icon for missing channel logo

**File:** `tests/e2e/epg-channel-list-panel.spec.ts:291`

**Tasks to make this test pass:**

- [ ] Add conditional rendering for channel logo (check if `channel.icon` exists)
- [ ] If logo missing, display placeholder: SVG icon or first letter of channel name
- [ ] Style placeholder: centered, 80×60px container, rounded 4px
- [ ] Consider using a TV/broadcast icon from Heroicons or similar
- [ ] Ensure placeholder has same dimensions as actual logo
- [ ] Run test: `pnpm test:e2e -- epg-channel-list-panel.spec.ts -g "should display placeholder icon"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: should update progress bars every 60 seconds

**File:** `tests/e2e/epg-channel-list-panel.spec.ts:324`

**Tasks to make this test pass:**

- [ ] Create custom hook `src/hooks/useEpgChannelList.ts`
- [ ] Implement auto-refresh interval using `setInterval` (60 seconds)
- [ ] Re-fetch channel data on interval (or recalculate progress locally)
- [ ] Ensure interval is cleaned up on unmount (useEffect cleanup)
- [ ] Verify progress bars update without full page reload
- [ ] Consider using React Query or similar for data fetching with refetch interval
- [ ] Run test: `pnpm test:e2e -- epg-channel-list-panel.spec.ts -g "should update progress bars"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1.5 hours

---

## Running Tests

```bash
# Run all failing tests for this story
pnpm test:e2e -- epg-channel-list-panel.spec.ts

# Run specific test by name
pnpm test:e2e -- epg-channel-list-panel.spec.ts -g "should display channel list"

# Run tests in headed mode (see browser)
pnpm test:e2e -- epg-channel-list-panel.spec.ts --headed

# Debug specific test
pnpm test:e2e -- epg-channel-list-panel.spec.ts --debug

# Run tests with coverage
pnpm test:e2e -- epg-channel-list-panel.spec.ts --coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All tests written and failing (10 E2E tests)
- ✅ Fixtures and factories created with auto-cleanup
- ✅ Mock requirements documented (Tauri commands)
- ✅ data-testid requirements listed (11 attributes)
- ✅ Implementation checklist created (10 test groups with detailed tasks)

**Verification:**

- All tests run and fail as expected
- Failure messages are clear: "EpgChannelList component not yet implemented"
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (recommended order: display → selection → keyboard → performance)
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
- Mark story as IN PROGRESS in sprint-status.yaml

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

1. **Share this checklist and failing tests** with dev-story workflow
2. **Review implementation checklist** with team in standup or planning
3. **Run failing tests** to confirm RED phase: `pnpm test:e2e -- epg-channel-list-panel.spec.ts`
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
- **selector-resilience.md** - data-testid selector strategy for stable test selectors
- **network-first.md** - Not directly applicable (no API mocking in these tests)
- **timing-debugging.md** - Performance testing patterns for virtualization validation

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm test -- epg-channel-list-panel.spec.ts --reporter=list`

**Actual Results:**

```
Running 10 tests using 1 worker

  ✗ EPG Channel List Panel › should display channel list with current program info (AC1)
    Error: locator.getByTestId('epg-channel-list') not found

  ✗ EPG Channel List Panel › should display progress bar showing elapsed time (AC1)
    Error: locator.getByTestId('epg-channel-list') not found

  ✗ EPG Channel List Panel › should select channel and update state on click (AC2)
    Error: locator.getByTestId('epg-channel-list') not found

  ✗ EPG Channel List Panel › should support keyboard navigation for channel selection (AC2)
    Error: locator.getByTestId('epg-channel-list') not found

  ✗ EPG Channel List Panel › should remain responsive with large channel list (AC3)
    Error: locator.getByTestId('epg-channel-list') not found

  ✗ EPG Channel List Panel › should display empty state when no enabled channels (AC1)
    Error: locator.getByTestId('epg-channel-list-empty') not found

  ✗ EPG Channel List Panel › should handle channel without current program (AC1)
    Error: locator.getByTestId('epg-channel-list') not found

  ✗ EPG Channel List Panel › should truncate long channel names with ellipsis (AC1)
    Error: locator.getByTestId('epg-channel-list') not found

  ✗ EPG Channel List Panel › should display placeholder icon for missing channel logo (AC1)
    Error: locator.getByTestId('epg-channel-list') not found

  ✗ EPG Channel List Panel › should update progress bars every 60 seconds (AC1)
    Error: locator.getByTestId('epg-channel-list') not found

  10 failed
    EPG Channel List Panel › should display channel list with current program info (AC1)
    EPG Channel List Panel › should display progress bar showing elapsed time (AC1)
    EPG Channel List Panel › should select channel and update state on click (AC2)
    EPG Channel List Panel › should support keyboard navigation for channel selection (AC2)
    EPG Channel List Panel › should remain responsive with large channel list (AC3)
    EPG Channel List Panel › should display empty state when no enabled channels (AC1)
    EPG Channel List Panel › should handle channel without current program (AC1)
    EPG Channel List Panel › should truncate long channel names with ellipsis (AC1)
    EPG Channel List Panel › should display placeholder icon for missing channel logo (AC1)
    EPG Channel List Panel › should update progress bars every 60 seconds (AC1)
```

**Summary:**

- Total tests: 10
- Passing: 0 (expected)
- Failing: 10 (expected)
- Status: ✅ RED phase verified

**Expected Failure Messages:**

1. "locator.getByTestId('epg-channel-list') not found" - EpgChannelList component doesn't exist yet
2. "locator.getByTestId('progress-bar') not found" - EpgProgressBar component doesn't exist yet
3. "aria-selected attribute not found" - Selection state not implemented
4. "keyboard navigation not working" - Keyboard handlers not implemented
5. "Empty state not found" - Empty state UI not implemented

---

## Notes

- **TanStack Virtual is critical for AC3** - Must be integrated correctly for performance with 500+ channels
- **Progress calculation must be accurate** - Tests verify progress percentage matches elapsed time
- **Selection state is shared with center panel** - This story prepares for Story 5.6 integration
- **Auto-refresh is important** - Progress bars must update every 60 seconds without user intervention
- **Keyboard navigation is a stretch goal** - Can be implemented in a future iteration if time is tight
- **Follow Story 5.4 patterns** - Use same component structure and styling approach

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Refer to `_bmad-output/implementation-artifacts/5-5-epg-channel-list-panel.md` for full story details
- Consult existing EPG components in `src/components/epg/` for patterns
- Review Story 5.4 implementation for layout context

---

**Generated by BMad TEA Agent** - 2026-01-22
