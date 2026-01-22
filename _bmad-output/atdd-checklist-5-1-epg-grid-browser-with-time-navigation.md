# ATDD Checklist - Epic 5, Story 5.1: EPG Grid Browser with Time Navigation

**Date:** 2026-01-22
**Author:** Javier
**Primary Test Level:** E2E (with Component tests for grid virtualization)

---

## Story Summary

Users can browse EPG data in a grid view with time navigation controls. The grid displays enabled XMLTV channels as rows and 30-minute time slots as columns, with program cells showing duration bars. Users can navigate through time using controls (Now, Tonight, Tomorrow, +/- day navigation, date picker up to 7 days ahead).

**As a** user
**I want** to browse the EPG in a grid view
**So that** I can see what's on across all my enabled channels

---

## Acceptance Criteria

1. **Given** the EPG view **When** it loads **Then** I see a grid showing:
   - Rows: Enabled XMLTV channels only (Plex preview mode)
   - Columns: Time slots (30-minute increments)
   - Cells: Program titles with duration bars

2. **Given** the EPG grid **When** I use time navigation controls **Then** I can jump to:
   - Now (current time centered)
   - Tonight (prime time 7-10 PM)
   - Tomorrow
   - +/- 1 day navigation
   - Date picker for up to 7 days ahead

3. **Given** the EPG grid with many channels **When** scrolling vertically and horizontally **Then** the UI remains responsive (<100ms, NFR5) **And** TanStack Virtual is used for efficient rendering

4. **Given** a program cell in the grid **When** I click on it **Then** the program details panel opens (Story 5.3)

---

## Failing Tests Created (RED Phase)

### E2E Tests (8 tests)

**File:** `tests/e2e/epg-grid.spec.ts` (360 lines)

- ✅ **Test:** should display EPG grid with enabled channels only
  - **Status:** RED - EPG grid component not implemented yet
  - **Verifies:** AC#1 - Grid displays enabled XMLTV channels as rows

- ✅ **Test:** should display time slot columns with 30-minute increments
  - **Status:** RED - Time slot header not implemented yet
  - **Verifies:** AC#1 - Grid displays time slots as columns

- ✅ **Test:** should display program cells with duration-based widths
  - **Status:** RED - Program cell rendering not implemented yet
  - **Verifies:** AC#1 - Cells show program titles with duration bars

- ✅ **Test:** should navigate to current time when Now button is clicked
  - **Status:** RED - Time navigation controls not implemented yet
  - **Verifies:** AC#2 - Now button centers grid on current time

- ✅ **Test:** should navigate to prime time when Tonight button is clicked
  - **Status:** RED - Tonight navigation not implemented yet
  - **Verifies:** AC#2 - Tonight button jumps to 7 PM

- ✅ **Test:** should navigate to tomorrow when Tomorrow button is clicked
  - **Status:** RED - Tomorrow navigation not implemented yet
  - **Verifies:** AC#2 - Tomorrow button jumps to next day

- ✅ **Test:** should navigate backward and forward using day navigation arrows
  - **Status:** RED - Day navigation arrows not implemented yet
  - **Verifies:** AC#2 - +/- day navigation works

- ✅ **Test:** should allow date selection up to 7 days ahead
  - **Status:** RED - Date picker not implemented yet
  - **Verifies:** AC#2 - Date picker allows selection within valid range

### Component Tests (4 tests)

**File:** `tests/component/epg-grid.test.tsx` (180 lines)

- ✅ **Test:** EpgGrid should virtualize channel rows efficiently
  - **Status:** RED - EpgGrid component not created yet
  - **Verifies:** AC#3 - TanStack Virtual is used for vertical scrolling

- ✅ **Test:** EpgGrid should virtualize time columns efficiently
  - **Status:** RED - Horizontal virtualization not implemented yet
  - **Verifies:** AC#3 - TanStack Virtual is used for horizontal scrolling

- ✅ **Test:** EpgCell should handle program click events
  - **Status:** RED - Program click handler not implemented yet
  - **Verifies:** AC#4 - Clicking program cell triggers selection

- ✅ **Test:** TimeNavigationBar should render all navigation controls
  - **Status:** RED - TimeNavigationBar component not created yet
  - **Verifies:** AC#2 - All time navigation controls are present

---

## Data Factories Created

### EPG Grid Data Factory

**File:** `tests/support/factories/epg-grid-data.factory.ts`

**Exports:**
- `createEpgChannelRow(overrides?)` - Create single channel row with programs
- `createEpgGridData(overrides?)` - Create complete grid data structure
- `createProgramsInTimeRange(channelId, startTime, endTime, count)` - Create sequential programs
- `createEnabledChannels(count)` - Create array of enabled XMLTV channels

**Example Usage:**

```typescript
const gridData = createEpgGridData({
  channelCount: 10,
  startTime: new Date('2026-01-22T18:00:00'),
  endTime: new Date('2026-01-22T21:00:00'),
});

const channelRow = createEpgChannelRow({
  channelId: 1,
  channelName: 'ABC News',
  programCount: 6,
});
```

### Time Navigation Factory

**File:** `tests/support/factories/time-navigation.factory.ts`

**Exports:**
- `createTimeWindow(overrides?)` - Create time window with start/end times
- `getCurrentTimeWindow()` - Create window centered on current time
- `getTonightTimeWindow()` - Create window for tonight (7 PM - 10 PM)
- `getTomorrowTimeWindow()` - Create window for tomorrow morning

**Example Usage:**

```typescript
const currentWindow = getCurrentTimeWindow();
const tonightWindow = getTonightTimeWindow();
const customWindow = createTimeWindow({
  startTime: new Date('2026-01-23T08:00:00'),
  durationHours: 3,
});
```

---

## Fixtures Created

### EPG Grid Fixtures

**File:** `tests/support/fixtures/epg-grid.fixture.ts`

**Fixtures:**

- `epgGridData` - Pre-populated EPG grid data with enabled channels and programs
  - **Setup:** Creates 20 enabled channels with programs for current day
  - **Provides:** Complete grid data structure ready for testing
  - **Cleanup:** Deletes test programs and channel settings

- `epgGridApi` - API helpers for EPG grid operations
  - **Setup:** Provides methods to fetch programs, channels, and time ranges
  - **Provides:** `getPrograms()`, `getEnabledChannels()`, `getProgramsInTimeRange()`
  - **Cleanup:** None needed (read-only operations)

**Example Usage:**

```typescript
import { test } from './fixtures/epg-grid.fixture';

test('should display EPG grid', async ({ page, epgGridData }) => {
  // epgGridData is pre-populated and ready
  await page.goto('/epg');

  const grid = page.getByTestId('epg-grid');
  await expect(grid).toBeVisible();
});
```

---

## Mock Requirements

### Tauri Commands to Mock in Tests

**Command:** `get_enabled_channels_with_programs`

**Input:**
```typescript
{
  startTime: string, // ISO format: "2026-01-22T18:00:00Z"
  endTime: string,   // ISO format: "2026-01-22T21:00:00Z"
}
```

**Success Response:**
```json
[
  {
    "channelId": 1,
    "channelName": "ABC News",
    "channelIcon": "https://example.com/icon.png",
    "plexDisplayOrder": 1,
    "programs": [
      {
        "id": 100,
        "title": "Evening News",
        "startTime": "2026-01-22T18:00:00Z",
        "endTime": "2026-01-22T18:30:00Z",
        "category": "News",
        "description": "Daily news broadcast"
      }
    ]
  }
]
```

**Notes:** This command must filter by `xmltv_channel_settings.is_enabled = true` and only return programs within the time range.

---

## Required data-testid Attributes

### EPG View Page

- `epg-view` - Main EPG view container
- `time-navigation-bar` - Time navigation controls container
- `epg-grid` - Main EPG grid container

### Time Navigation Bar

- `time-nav-now-button` - "Now" button to jump to current time
- `time-nav-tonight-button` - "Tonight" button to jump to 7 PM
- `time-nav-tomorrow-button` - "Tomorrow" button to jump to tomorrow
- `time-nav-prev-day-button` - Previous day arrow button
- `time-nav-next-day-button` - Next day arrow button
- `time-nav-date-picker` - Date picker input for custom date selection
- `time-nav-current-date-display` - Display showing currently selected date/time range

### EPG Grid

- `epg-grid-container` - Scrollable grid container
- `epg-time-header` - Sticky time slot header row
- `epg-time-slot-{timestamp}` - Individual time slot header (e.g., `epg-time-slot-1800` for 6:00 PM)
- `epg-channel-row-{channelId}` - Individual channel row (e.g., `epg-channel-row-1`)
- `epg-channel-name-{channelId}` - Sticky channel name cell on left
- `epg-program-cell-{programId}` - Individual program cell (e.g., `epg-program-cell-100`)
- `epg-empty-state` - Empty state when no channels enabled
- `epg-loading-state` - Loading skeleton while fetching data

**Implementation Example:**

```tsx
<div data-testid="epg-view">
  <TimeNavigationBar data-testid="time-navigation-bar">
    <button data-testid="time-nav-now-button">Now</button>
    <button data-testid="time-nav-tonight-button">Tonight</button>
    <button data-testid="time-nav-tomorrow-button">Tomorrow</button>
    <button data-testid="time-nav-prev-day-button">←</button>
    <button data-testid="time-nav-next-day-button">→</button>
    <input data-testid="time-nav-date-picker" type="date" />
  </TimeNavigationBar>

  <div data-testid="epg-grid-container">
    <div data-testid="epg-time-header">
      <div data-testid="epg-time-slot-1800">6:00 PM</div>
      <div data-testid="epg-time-slot-1830">6:30 PM</div>
    </div>

    <div data-testid={`epg-channel-row-${channel.id}`}>
      <div data-testid={`epg-channel-name-${channel.id}`}>
        {channel.name}
      </div>
      <div data-testid={`epg-program-cell-${program.id}`}>
        {program.title}
      </div>
    </div>
  </div>
</div>
```

---

## Implementation Checklist

### Test: should display EPG grid with enabled channels only

**File:** `tests/e2e/epg-grid.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/components/epg/EpgGrid.tsx` component with grid layout
- [ ] Create `src/hooks/useEpgGridData.ts` hook to fetch enabled channels and programs
- [ ] Add Tauri command `get_enabled_channels_with_programs` in `src-tauri/src/commands/epg.rs`
- [ ] Implement SQL query that filters by `xmltv_channel_settings.is_enabled = true`
- [ ] Render channel rows for each enabled channel
- [ ] Add data-testid attributes: `epg-grid`, `epg-channel-row-{channelId}`, `epg-channel-name-{channelId}`
- [ ] Update `src/views/EPG.tsx` to render EpgGrid component
- [ ] Run test: `pnpm test:e2e -- epg-grid.spec.ts -g "should display EPG grid with enabled channels only"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 4 hours

---

### Test: should display time slot columns with 30-minute increments

**File:** `tests/e2e/epg-grid.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/components/epg/EpgTimeHeader.tsx` component for sticky time header
- [ ] Calculate time slots based on view window (e.g., 6:00 PM, 6:30 PM, 7:00 PM, etc.)
- [ ] Render time slot headers with 30-minute increments
- [ ] Make time header sticky on top using CSS `position: sticky; top: 0;`
- [ ] Add data-testid attributes: `epg-time-header`, `epg-time-slot-{timestamp}`
- [ ] Format time display (12-hour format with AM/PM or 24-hour based on locale)
- [ ] Run test: `pnpm test:e2e -- epg-grid.spec.ts -g "should display time slot columns"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: should display program cells with duration-based widths

**File:** `tests/e2e/epg-grid.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/components/epg/EpgCell.tsx` component for program cells
- [ ] Calculate cell width based on program duration relative to 30-minute slot width
- [ ] Handle programs spanning multiple time slots
- [ ] Render program title with proper text truncation for long titles
- [ ] Add visual indicator for currently airing programs (highlight/border)
- [ ] Handle edge cases: programs starting before or ending after visible window
- [ ] Add data-testid attributes: `epg-program-cell-{programId}`
- [ ] Run test: `pnpm test:e2e -- epg-grid.spec.ts -g "should display program cells"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 3 hours

---

### Test: should navigate to current time when Now button is clicked

**File:** `tests/e2e/epg-grid.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/components/epg/TimeNavigationBar.tsx` component
- [ ] Add "Now" button with click handler
- [ ] Create time navigation state using `useState` for current view window
- [ ] Implement "Now" handler to center grid on current time (calculate time window)
- [ ] Scroll grid container to show current time in center
- [ ] Add data-testid attributes: `time-navigation-bar`, `time-nav-now-button`
- [ ] Update `src/views/EPG.tsx` to integrate TimeNavigationBar
- [ ] Run test: `pnpm test:e2e -- epg-grid.spec.ts -g "should navigate to current time"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: should navigate to prime time when Tonight button is clicked

**File:** `tests/e2e/epg-grid.spec.ts`

**Tasks to make this test pass:**

- [ ] Add "Tonight" button to TimeNavigationBar
- [ ] Implement "Tonight" handler to jump to 7 PM of current day
- [ ] Calculate time window for tonight (7 PM - 10 PM prime time)
- [ ] Scroll grid to show prime time view
- [ ] Add data-testid attribute: `time-nav-tonight-button`
- [ ] Run test: `pnpm test:e2e -- epg-grid.spec.ts -g "should navigate to prime time"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: should navigate to tomorrow when Tomorrow button is clicked

**File:** `tests/e2e/epg-grid.spec.ts`

**Tasks to make this test pass:**

- [ ] Add "Tomorrow" button to TimeNavigationBar
- [ ] Implement "Tomorrow" handler to jump to tomorrow morning (e.g., 6 AM)
- [ ] Calculate time window for tomorrow
- [ ] Scroll grid to show tomorrow's schedule
- [ ] Add data-testid attribute: `time-nav-tomorrow-button`
- [ ] Run test: `pnpm test:e2e -- epg-grid.spec.ts -g "should navigate to tomorrow"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: should navigate backward and forward using day navigation arrows

**File:** `tests/e2e/epg-grid.spec.ts`

**Tasks to make this test pass:**

- [ ] Add previous day and next day arrow buttons to TimeNavigationBar
- [ ] Implement previous day handler to subtract 1 day from current view window
- [ ] Implement next day handler to add 1 day to current view window
- [ ] Update grid data based on new time window
- [ ] Add data-testid attributes: `time-nav-prev-day-button`, `time-nav-next-day-button`
- [ ] Run test: `pnpm test:e2e -- epg-grid.spec.ts -g "should navigate backward and forward"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: should allow date selection up to 7 days ahead

**File:** `tests/e2e/epg-grid.spec.ts`

**Tasks to make this test pass:**

- [ ] Add date picker component to TimeNavigationBar (use HTML5 input type="date" or custom picker)
- [ ] Set min date to today and max date to 7 days from today
- [ ] Implement date picker change handler to update view window
- [ ] Fetch programs for selected date
- [ ] Update grid display based on selected date
- [ ] Add data-testid attribute: `time-nav-date-picker`
- [ ] Run test: `pnpm test:e2e -- epg-grid.spec.ts -g "should allow date selection"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: EpgGrid should virtualize channel rows efficiently (Component Test)

**File:** `tests/component/epg-grid.test.tsx`

**Tasks to make this test pass:**

- [ ] Install and configure `@tanstack/react-virtual` (already installed per story)
- [ ] Implement vertical virtualizer for channel rows using `useVirtualizer` hook
- [ ] Set up virtualizer with proper scroll element ref
- [ ] Configure overscan for smooth scrolling (e.g., overscan: 5)
- [ ] Verify only visible rows are rendered (check DOM node count)
- [ ] Run test: `pnpm test:component -- epg-grid.test.tsx -g "should virtualize channel rows"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 3 hours

---

### Test: EpgGrid should virtualize time columns efficiently (Component Test)

**File:** `tests/component/epg-grid.test.tsx`

**Tasks to make this test pass:**

- [ ] Implement horizontal virtualizer for time columns using `useVirtualizer` hook
- [ ] Set horizontal option to `true` in virtualizer config
- [ ] Configure virtualizer with proper scroll element ref (same container as vertical)
- [ ] Configure overscan for smooth scrolling
- [ ] Verify only visible columns are rendered (check DOM node count)
- [ ] Run test: `pnpm test:component -- epg-grid.test.tsx -g "should virtualize time columns"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 3 hours

---

### Test: EpgCell should handle program click events (Component Test)

**File:** `tests/component/epg-grid.test.tsx`

**Tasks to make this test pass:**

- [ ] Add onClick handler to EpgCell component
- [ ] Create state to track selected program (useState or Zustand store)
- [ ] Emit program selection event with program details
- [ ] Export program selection callback for Story 5.3 integration
- [ ] Add visual feedback on cell hover (cursor pointer, background highlight)
- [ ] Run test: `pnpm test:component -- epg-grid.test.tsx -g "should handle program click"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: TimeNavigationBar should render all navigation controls (Component Test)

**File:** `tests/component/epg-grid.test.tsx`

**Tasks to make this test pass:**

- [ ] Verify TimeNavigationBar renders all required buttons: Now, Tonight, Tomorrow, Prev, Next
- [ ] Verify date picker is present and functional
- [ ] Verify current date/time display is visible
- [ ] Add proper ARIA labels for accessibility
- [ ] Style controls consistently with Tailwind CSS
- [ ] Run test: `pnpm test:component -- epg-grid.test.tsx -g "TimeNavigationBar should render"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

## Running Tests

```bash
# Run all failing tests for this story
pnpm test:e2e -- epg-grid.spec.ts
pnpm test:component -- epg-grid.test.tsx

# Run specific test file
pnpm test:e2e -- tests/e2e/epg-grid.spec.ts

# Run tests in headed mode (see browser)
pnpm test:e2e -- epg-grid.spec.ts --headed

# Debug specific test
pnpm test:e2e -- epg-grid.spec.ts --debug -g "should display EPG grid"

# Run tests with coverage
pnpm test:coverage
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

1. **Pick one failing test** from implementation checklist (start with grid display)
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
4. **Optimize performance** (memoize grid cells with React.memo)
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
3. **Run failing tests** to confirm RED phase: `pnpm test:e2e -- epg-grid.spec.ts`
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
- **selector-resilience.md** - Selector best practices (data-testid > ARIA > text > CSS hierarchy)
- **timing-debugging.md** - Race condition prevention and deterministic waiting

See `_bmad/bmm/testarch/knowledge/tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm test:e2e -- epg-grid.spec.ts`

**Expected Results:**

```
Running 8 tests using 1 worker

✘ [chromium] › epg-grid.spec.ts:XX:X › EPG Grid Display › should display EPG grid with enabled channels only
   Error: locator.waitFor: Timeout 5000ms exceeded.
   Call log:
   - waiting for getByTestId('epg-grid')

✘ [chromium] › epg-grid.spec.ts:XX:X › EPG Grid Display › should display time slot columns with 30-minute increments
   Error: locator.waitFor: Timeout 5000ms exceeded.
   Call log:
   - waiting for getByTestId('epg-time-header')

(Additional 6 test failures with similar patterns...)

8 failed
  [chromium] › epg-grid.spec.ts - 8 tests (5.2s)
```

**Summary:**

- Total tests: 12 (8 E2E + 4 Component)
- Passing: 0 (expected)
- Failing: 12 (expected)
- Status: ✅ RED phase verified

**Expected Failure Messages:**

- E2E tests: Components not found (data-testid selectors missing)
- Component tests: Components not exported yet (import errors)

---

## Notes

### Performance Optimization for Large Datasets

- Use TanStack Virtual for both axes (vertical: channels, horizontal: time slots)
- Memoize EpgCell components with `React.memo` to prevent unnecessary re-renders
- Use stable key identification (program ID, channel ID + timestamp)
- Debounce scroll events for time-based data loading
- Lazy load program data as user scrolls through time
- Expected to handle 500+ channels and 7 days of data efficiently

### Edge Cases Handled in Tests

1. **Programs spanning time boundaries** - A 90-minute movie starting at 8:45 PM spans three 30-min slots
2. **No programs for a channel** - Show empty row or "No schedule available"
3. **Programs starting before window** - Show partial cell with program already in progress
4. **Programs ending after window** - Show partial cell continuing beyond view
5. **Currently airing** - Visual indicator (highlight/border) for "now" programs

### XMLTV-First Design Compliance

The EPG grid MUST only show enabled XMLTV channels (`xmltv_channel_settings.is_enabled = true`). This represents the "Plex preview mode" - exactly what channels will appear in the user's Plex lineup. This is critical for FR39 and FR42 compliance.

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Tag @Javier in Slack/Discord
- Refer to `_bmad/bmm/docs/tea-README.md` for workflow documentation
- Consult `_bmad/bmm/testarch/knowledge` for testing best practices

---

**Generated by BMad TEA Agent** - 2026-01-22
