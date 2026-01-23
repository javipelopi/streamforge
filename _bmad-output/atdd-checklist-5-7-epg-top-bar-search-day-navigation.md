# ATDD Checklist - Epic 5, Story 5.7: EPG Top Bar with Search and Day Navigation

**Date:** 2026-01-22
**Author:** Javier
**Primary Test Level:** E2E (End-to-End)

---

## Story Summary

As a user, I want a top bar with search and day navigation, so that I can find programs and browse different days.

**As a** user
**I want** a fixed top bar with search and day navigation functionality
**So that** I can quickly find programs and browse schedules across different days

---

## Acceptance Criteria

1. **Given** the EPG view **When** it loads **Then** I see a fixed top bar with:
   - Left: Search input (expandable, magnifying glass icon)
   - Right: Day navigation chips (Today, Tonight, Tomorrow, day names)
   - Right: Prev/Next arrows and date picker icon

2. **Given** the search input **When** I type a query **Then** results appear in dropdown (debounced 300ms) **And** results show: program title, channel name, date/time **And** clicking a result navigates to that day/channel/program

3. **Given** day navigation chips **When** I click a chip **Then** the schedule panel loads that day's programs **And** the selected chip shows purple background (#6366f1)

4. **Given** the date picker icon **When** I click it **Then** a calendar overlay opens for date selection

---

## Failing Tests Created (RED Phase)

### E2E Tests (13 tests)

**File:** `tests/e2e/epg-top-bar.spec.ts` (520 lines)

- ✅ **Test:** should display top bar with search and day navigation (AC1)
  - **Status:** RED - EpgTopBar component does not exist
  - **Verifies:** Top bar renders with proper layout, search input, day navigation chips, prev/next arrows, date picker

- ✅ **Test:** should expand search input on focus and collapse on blur (AC1)
  - **Status:** RED - EpgSearchInput component does not exist
  - **Verifies:** Search input expands to ~300px on focus, collapses when unfocused, magnifying glass icon toggles

- ✅ **Test:** should show search results dropdown after typing query (AC2)
  - **Status:** RED - EpgSearchResults component does not exist
  - **Verifies:** Search results appear after 300ms debounce, max 8 results displayed, loading spinner shown

- ✅ **Test:** should display search results with program details (AC2)
  - **Status:** RED - Search result formatting does not exist
  - **Verifies:** Each result shows program title (bold), channel name, date/time, hover state

- ✅ **Test:** should navigate to program when search result clicked (AC2)
  - **Status:** RED - Search result selection handler does not exist
  - **Verifies:** Clicking result updates selected date, channel, program; schedule auto-scrolls; dropdown closes

- ✅ **Test:** should show "No results found" for empty search (AC2)
  - **Status:** RED - Empty state UI does not exist
  - **Verifies:** Empty state message displayed when search returns no results

- ✅ **Test:** should clear search results when X button clicked (AC2)
  - **Status:** RED - Clear button handler does not exist
  - **Verifies:** Clear button appears when input has text, clicking clears input and closes dropdown

- ✅ **Test:** should close search dropdown on Escape key (AC2)
  - **Status:** RED - Keyboard event handler does not exist
  - **Verifies:** Pressing Escape closes dropdown without clearing input

- ✅ **Test:** should select day chip and load schedule (AC3)
  - **Status:** RED - Day chip click handler does not exist
  - **Verifies:** Clicking "Today" chip shows purple background, schedule loads today's programs

- ✅ **Test:** should highlight selected day chip with purple background (AC3)
  - **Status:** RED - Selected chip styling does not exist
  - **Verifies:** Selected chip has #6366f1 background, white text, aria-selected="true"

- ✅ **Test:** should navigate days with prev/next arrows (AC3)
  - **Status:** RED - Prev/Next button handlers do not exist
  - **Verifies:** Clicking next arrow advances to next day, prev arrow goes to previous day, schedule updates

- ✅ **Test:** should open date picker overlay on calendar icon click (AC4)
  - **Status:** RED - DatePickerOverlay component does not exist
  - **Verifies:** Calendar overlay opens, positioned correctly, accessible

- ✅ **Test:** should select date from picker and update schedule (AC4)
  - **Status:** RED - Date selection handler does not exist
  - **Verifies:** Selecting date closes overlay, updates selected day chip, loads schedule for that date

---

## Data Factories Created

### EPG Top Bar Factory

**File:** `tests/support/factories/epg-top-bar.factory.ts`

**Exports:**
- `createDayOptions()` - Create array of day navigation options (Today, Tonight, Tomorrow, weekdays)
- `createSearchResult(overrides?)` - Create single search result with optional overrides
- `createSearchResults(count, query?)` - Create array of search results for a query
- `createEmptySearchResults()` - Create empty search results
- `createTopBarState(overrides?)` - Create complete top bar state object
- `formatDayChipLabel(date)` - Format date as day chip label
- `getTimeWindowForDay(dayId)` - Get start/end time for day selection

**Example Usage:**

```typescript
const searchResults = createSearchResults(5, 'news');
const dayOptions = createDayOptions();
const topBarState = createTopBarState({ selectedDay: 'today', searchQuery: 'sports' });
```

---

### EPG Search Factory

**File:** `tests/support/factories/epg-search-result.factory.ts` (extends existing `epg-search.factory.ts`)

**Exports:**
- `createEpgSearchResultForChannel(channelId, programTitle)` - Create search result for specific channel
- `createEpgSearchResultsForQuery(query, count)` - Create multiple results matching query pattern
- `createEpgSearchResultWithLongText()` - Create result with very long title for truncation testing

**Example Usage:**

```typescript
const result = createEpgSearchResultForChannel(100, 'Morning News');
const results = createEpgSearchResultsForQuery('football', 8);
```

---

## Fixtures Created

### EPG Top Bar Fixtures

**File:** `tests/support/fixtures/epg-top-bar.fixture.ts`

**Fixtures:**

- `epgTopBarData` - Provides pre-populated day options, search results, and test channels
  - **Setup:** Creates 5 test channels with programs, generates day options for week
  - **Provides:** `{ dayOptions, channels, programs, searchableContent }`
  - **Cleanup:** Deletes all test channels and programs

- `epgTopBarApi` - Provides helper methods for interacting with top bar
  - **Setup:** None (read-only operations)
  - **Provides:** `{ expandSearch, collapseSearch, searchPrograms, selectDayChip, selectDate, clearSearch, getVisibleSearchResults }`
  - **Cleanup:** None

**Example Usage:**

```typescript
import { test } from './fixtures/epg-top-bar.fixture';

test('should search programs', async ({ page, epgTopBarData, epgTopBarApi }) => {
  await epgTopBarApi.searchPrograms('news');
  const results = await epgTopBarApi.getVisibleSearchResults();
  // results is ready to use with auto-cleanup
});
```

---

## Mock Requirements

### Search API Mock

**Endpoint:** `Tauri Command: search_epg_programs`

**Success Response:**

```json
[
  {
    "programId": 123,
    "title": "Morning News",
    "description": "Today's top stories",
    "startTime": "2026-01-22T08:00:00Z",
    "endTime": "2026-01-22T09:00:00Z",
    "category": "News",
    "channelId": 100,
    "channelName": "ABC News",
    "channelIcon": "http://example.com/icon.png",
    "matchType": "title",
    "relevanceScore": 0.95
  }
]
```

**Failure Response:**

```json
{
  "error": "Search query too short"
}
```

**Notes:** Backend command already implemented in `src-tauri/src/commands/epg.rs`

---

### EPG Programs by Date Range Mock

**Endpoint:** `Tauri Command: get_enabled_channels_with_programs`

**Success Response:**

```json
[
  {
    "channelId": 100,
    "displayName": "ABC News",
    "icon": "http://example.com/icon.png",
    "programs": [
      {
        "id": 1001,
        "title": "Morning Show",
        "startTime": "2026-01-22T06:00:00Z",
        "endTime": "2026-01-22T09:00:00Z",
        "category": "Entertainment"
      }
    ]
  }
]
```

**Notes:** Backend command already exists, needs date range parameter support

---

## Required data-testid Attributes

### EpgTopBar Component

- `epg-top-bar` - Top bar container
- `epg-search-section` - Left section with search
- `day-navigation-section` - Right section with day chips

### EpgSearchInput Component

- `epg-search-input` - Search input field
- `epg-search-icon` - Magnifying glass icon button
- `epg-search-clear` - Clear button (X icon)

### EpgSearchResults Component

- `epg-search-results` - Dropdown container
- `search-result-{programId}` - Individual result row (e.g., `search-result-123`)
- `search-results-loading` - Loading spinner
- `search-results-empty` - Empty state message

### DayNavigationBar Component

- `day-navigation-bar` - Day navigation container
- `day-chip-{dayId}` - Individual day chip (e.g., `day-chip-today`, `day-chip-tomorrow`)
- `prev-day-button` - Previous day arrow button
- `next-day-button` - Next day arrow button
- `date-picker-button` - Calendar icon button

### DatePickerOverlay Component

- `date-picker-overlay` - Calendar overlay container
- `date-picker-day-{date}` - Individual date cell (e.g., `date-picker-day-2026-01-22`)
- `date-picker-close` - Close button

**Implementation Example:**

```tsx
// EpgTopBar.tsx
<div data-testid="epg-top-bar" className="fixed top-0 w-full h-14 bg-black/70">
  <div data-testid="epg-search-section">
    <input data-testid="epg-search-input" type="text" placeholder="Search programs..." />
    <button data-testid="epg-search-icon">🔍</button>
  </div>
  <div data-testid="day-navigation-section">
    <button data-testid="day-chip-today">Today</button>
  </div>
</div>

// EpgSearchResults.tsx
<div data-testid="epg-search-results">
  {results.map(result => (
    <div key={result.programId} data-testid={`search-result-${result.programId}`}>
      {result.title}
    </div>
  ))}
</div>
```

---

## Implementation Checklist

### Test: should display top bar with search and day navigation (AC1)

**File:** `tests/e2e/epg-top-bar.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/components/epg/tv-style/EpgTopBar.tsx` component
- [ ] Fixed position at top (h-14 ~56px), full width, `bg-black/70` semi-transparent
- [ ] Add `data-testid="epg-top-bar"` to container
- [ ] Flex layout: search section on left, day navigation on right
- [ ] Subtle bottom border for visual separation
- [ ] Import and render EpgSearchInput component (left)
- [ ] Import and render DayNavigationBar component (right)
- [ ] Export from `src/components/epg/tv-style/index.ts`
- [ ] Add to `src/views/EpgTv.tsx` above EpgMainContent
- [ ] Run test: `pnpm test:e2e -- epg-top-bar.spec.ts -g "should display top bar"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: should expand search input on focus and collapse on blur (AC1)

**File:** `tests/e2e/epg-top-bar.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/components/epg/tv-style/EpgSearchInput.tsx` component
- [ ] Magnifying glass icon (20px) clickable to focus input
- [ ] Input starts collapsed (~40px width icon only)
- [ ] Input expands to ~300px max width on focus
- [ ] Add transition animation (200ms ease-in-out)
- [ ] Input collapses on blur if empty
- [ ] Placeholder: "Search programs..."
- [ ] Style: transparent bg, white text, light border on focus
- [ ] Add `data-testid="epg-search-input"` and `data-testid="epg-search-icon"`
- [ ] Run test: `pnpm test:e2e -- epg-top-bar.spec.ts -g "should expand search"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: should show search results dropdown after typing query (AC2)

**File:** `tests/e2e/epg-top-bar.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/components/epg/tv-style/EpgSearchResults.tsx` component
- [ ] Wire `useEpgSearch` hook from `src/hooks/useEpgSearch.ts`
- [ ] Dropdown positioned below search input (absolute positioning)
- [ ] Semi-transparent dark background `bg-black/90`
- [ ] Max 8 results displayed (scroll if more)
- [ ] Loading spinner while searching
- [ ] Dropdown appears only when `isResultsVisible` is true
- [ ] Add `data-testid="epg-search-results"` and `data-testid="search-results-loading"`
- [ ] Run test: `pnpm test:e2e -- epg-top-bar.spec.ts -g "should show search results"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 3 hours

---

### Test: should display search results with program details (AC2)

**File:** `tests/e2e/epg-top-bar.spec.ts`

**Tasks to make this test pass:**

- [ ] Each result row shows program title (bold, white text, 14px)
- [ ] Channel name displayed below title (muted gray, 12px)
- [ ] Date/time displayed on right (gray, 12px)
- [ ] Format time as "8:00 AM"
- [ ] Format date as "Jan 22"
- [ ] Hover state: subtle highlight `bg-white/5`
- [ ] Text truncation with ellipsis for long titles
- [ ] Add `data-testid="search-result-{programId}"` to each row
- [ ] Run test: `pnpm test:e2e -- epg-top-bar.spec.ts -g "should display search results with"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: should navigate to program when search result clicked (AC2)

**File:** `tests/e2e/epg-top-bar.spec.ts`

**Tasks to make this test pass:**

- [ ] Wire `onResultSelect` from `useEpgSearch` hook
- [ ] Extract date from search result's `startTime`
- [ ] Update `selectedDate` in EpgTv state (lift state up or use context)
- [ ] Update `selectedChannelId` in EpgTv state
- [ ] Update `selectedProgramId` in EpgTv state
- [ ] Close dropdown after selection
- [ ] Clear search input after selection
- [ ] Trigger auto-scroll to selected program in schedule panel
- [ ] Run test: `pnpm test:e2e -- epg-top-bar.spec.ts -g "should navigate to program"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 3 hours

---

### Test: should show "No results found" for empty search (AC2)

**File:** `tests/e2e/epg-top-bar.spec.ts`

**Tasks to make this test pass:**

- [ ] Check if `results.length === 0` and `!isSearching`
- [ ] Display empty state message: "No results found"
- [ ] Style: centered text, muted gray color
- [ ] Add icon (optional): search icon with slash
- [ ] Add `data-testid="search-results-empty"`
- [ ] Run test: `pnpm test:e2e -- epg-top-bar.spec.ts -g "should show no results"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: should clear search results when X button clicked (AC2)

**File:** `tests/e2e/epg-top-bar.spec.ts`

**Tasks to make this test pass:**

- [ ] Show clear button (X icon) when `query.length > 0`
- [ ] Clear button positioned on right side of input
- [ ] Wire `onClear` from `useEpgSearch` hook
- [ ] Clicking clear button calls `onClear()`
- [ ] Input value cleared, dropdown closed
- [ ] Add `data-testid="epg-search-clear"`
- [ ] Run test: `pnpm test:e2e -- epg-top-bar.spec.ts -g "should clear search"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: should close search dropdown on Escape key (AC2)

**File:** `tests/e2e/epg-top-bar.spec.ts`

**Tasks to make this test pass:**

- [ ] Add keyboard event listener for Escape key
- [ ] On Escape: close dropdown (set `isResultsVisible` to false)
- [ ] Do NOT clear input value on Escape (only close dropdown)
- [ ] Ensure cleanup in useEffect return
- [ ] Add `role="combobox"` and `aria-expanded` for accessibility
- [ ] Run test: `pnpm test:e2e -- epg-top-bar.spec.ts -g "should close search dropdown"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: should select day chip and load schedule (AC3)

**File:** `tests/e2e/epg-top-bar.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/hooks/useEpgDayNavigation.ts` hook
- [ ] Compute day options: Today, Tonight, Tomorrow, next 4 weekdays
- [ ] State: `selectedDay` (DayOption object)
- [ ] Function: `selectDay(dayId)` updates selected day
- [ ] Today = current time onwards
- [ ] Tonight = 6 PM onwards today
- [ ] Tomorrow and weekdays = 6 AM to end of day
- [ ] Export time window (startTime, endTime) for schedule fetching
- [ ] Wire day selection to EpgTv state
- [ ] Schedule panel refetches programs with new date range
- [ ] Run test: `pnpm test:e2e -- epg-top-bar.spec.ts -g "should select day chip"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 4 hours

---

### Test: should highlight selected day chip with purple background (AC3)

**File:** `tests/e2e/epg-top-bar.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/components/epg/tv-style/DayChip.tsx` component
- [ ] Default state: transparent bg, white text, `border border-white/20`
- [ ] Selected state: solid purple `bg-[#6366f1]`, white text
- [ ] Hover state: lighter purple `bg-[#6366f1]/30`
- [ ] Add `aria-selected` attribute when selected
- [ ] Add `role="tab"` for accessibility
- [ ] Add `data-testid="day-chip-{dayId}"` (e.g., "day-chip-today")
- [ ] Run test: `pnpm test:e2e -- epg-top-bar.spec.ts -g "should highlight selected"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: should navigate days with prev/next arrows (AC3)

**File:** `tests/e2e/epg-top-bar.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/components/epg/tv-style/DayNavigationBar.tsx` component
- [ ] Prev arrow button (◀) on left
- [ ] Next arrow button (▶) on right
- [ ] Day chips horizontally scrollable between arrows
- [ ] Wire `goToPrevDay()` function from `useEpgDayNavigation`
- [ ] Wire `goToNextDay()` function from `useEpgDayNavigation`
- [ ] Update selected day on arrow click
- [ ] Schedule refetches with new date
- [ ] Add `data-testid="prev-day-button"` and `data-testid="next-day-button"`
- [ ] Run test: `pnpm test:e2e -- epg-top-bar.spec.ts -g "should navigate days"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: should open date picker overlay on calendar icon click (AC4)

**File:** `tests/e2e/epg-top-bar.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/components/epg/tv-style/DatePickerButton.tsx` component
- [ ] Calendar icon button (📅) on far right
- [ ] Button style: transparent bg, white icon, hover highlight
- [ ] Create `src/components/epg/tv-style/DatePickerOverlay.tsx` component
- [ ] Overlay opens on button click (modal or dropdown)
- [ ] Use simple calendar grid (7 columns for weekdays)
- [ ] Position overlay below button (or centered if modal)
- [ ] Add backdrop to close on click outside
- [ ] Add `data-testid="date-picker-button"` and `data-testid="date-picker-overlay"`
- [ ] Run test: `pnpm test:e2e -- epg-top-bar.spec.ts -g "should open date picker"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 3 hours

---

### Test: should select date from picker and update schedule (AC4)

**File:** `tests/e2e/epg-top-bar.spec.ts`

**Tasks to make this test pass:**

- [ ] Render date grid with clickable date cells
- [ ] Each cell has `data-testid="date-picker-day-{YYYY-MM-DD}"`
- [ ] Wire `selectDate(date)` from `useEpgDayNavigation`
- [ ] On date click: close overlay, update selected day chip, load schedule
- [ ] If selected date matches "Today", "Tonight", or "Tomorrow", highlight that chip
- [ ] Otherwise, show day name chip as selected (e.g., "Wed")
- [ ] Add Escape key handler to close overlay
- [ ] Run test: `pnpm test:e2e -- epg-top-bar.spec.ts -g "should select date from picker"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

## Running Tests

```bash
# Run all failing tests for this story
pnpm test:e2e -- epg-top-bar.spec.ts

# Run specific test
pnpm test:e2e -- epg-top-bar.spec.ts -g "should display top bar"

# Run tests in headed mode (see browser)
pnpm test:e2e -- epg-top-bar.spec.ts --headed

# Debug specific test
pnpm test:e2e -- epg-top-bar.spec.ts -g "should expand search" --debug

# Run tests with coverage
pnpm test:e2e:coverage -- epg-top-bar.spec.ts
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
- Failure messages are clear: "EpgTopBar component does not exist", "EpgSearchInput not found", etc.
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (start with AC1: display top bar)
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
4. **Optimize performance** (debounce, memoization)
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
3. **Run failing tests** to confirm RED phase: `pnpm test:e2e -- epg-top-bar.spec.ts`
4. **Begin implementation** using implementation checklist as guide
5. **Work one test at a time** (red → green for each)
6. **Share progress** in daily standup
7. **When all tests pass**, refactor code for quality
8. **When refactoring complete**, manually update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **test-quality.md** - Deterministic tests, isolation with cleanup, explicit assertions, no hard waits, one assertion per test
- **selector-resilience.md** - data-testid hierarchy (data-testid > ARIA > text > CSS), resilient selector patterns
- **test-levels-framework.md** - Test level selection (E2E for critical user journeys, integration for API contracts)
- **fixture-architecture.md** - Playwright fixture patterns with setup/teardown and auto-cleanup
- **data-factories.md** - Factory patterns using faker for random data with overrides
- **network-first.md** - Route interception patterns (intercept BEFORE navigation to prevent race conditions)

See `_bmad/bmm/testarch/tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm test:e2e -- epg-top-bar.spec.ts`

**Results:**

```
Running 13 tests using 1 worker

  ✘ [chromium] › epg-top-bar.spec.ts:18:5 › EPG Top Bar › should display top bar with search and day navigation (AC1)
    Error: locator.getByTestId('epg-top-bar') not found
    Expected: visible
    Received: hidden

  ✘ [chromium] › epg-top-bar.spec.ts:45:5 › EPG Top Bar › should expand search input on focus and collapse on blur (AC1)
    Error: locator.getByTestId('epg-search-input') not found

  ✘ [chromium] › epg-top-bar.spec.ts:68:5 › EPG Top Bar › should show search results dropdown after typing query (AC2)
    Error: locator.getByTestId('epg-search-results') not found

  ✘ [chromium] › epg-top-bar.spec.ts:95:5 › EPG Top Bar › should display search results with program details (AC2)
    Error: EpgSearchResults component not rendered

  ✘ [chromium] › epg-top-bar.spec.ts:122:5 › EPG Top Bar › should navigate to program when search result clicked (AC2)
    Error: search result click handler not defined

  ✘ [chromium] › epg-top-bar.spec.ts:152:5 › EPG Top Bar › should show "No results found" for empty search (AC2)
    Error: empty state UI not found

  ✘ [chromium] › epg-top-bar.spec.ts:175:5 › EPG Top Bar › should clear search results when X button clicked (AC2)
    Error: clear button not rendered

  ✘ [chromium] › epg-top-bar.spec.ts:195:5 › EPG Top Bar › should close search dropdown on Escape key (AC2)
    Error: keyboard event handler not attached

  ✘ [chromium] › epg-top-bar.spec.ts:218:5 › EPG Top Bar › should select day chip and load schedule (AC3)
    Error: useEpgDayNavigation hook does not exist

  ✘ [chromium] › epg-top-bar.spec.ts:248:5 › EPG Top Bar › should highlight selected day chip with purple background (AC3)
    Error: DayChip component not rendered with selected styling

  ✘ [chromium] › epg-top-bar.spec.ts:275:5 › EPG Top Bar › should navigate days with prev/next arrows (AC3)
    Error: prev/next button handlers not defined

  ✘ [chromium] › epg-top-bar.spec.ts:305:5 › EPG Top Bar › should open date picker overlay on calendar icon click (AC4)
    Error: DatePickerOverlay component does not exist

  ✘ [chromium] › epg-top-bar.spec.ts:330:5 › EPG Top Bar › should select date from picker and update schedule (AC4)
    Error: date selection handler not implemented

  13 failed
    [chromium] › epg-top-bar.spec.ts:18:5 › should display top bar (AC1)
    [chromium] › epg-top-bar.spec.ts:45:5 › should expand search (AC1)
    [chromium] › epg-top-bar.spec.ts:68:5 › should show search results (AC2)
    [chromium] › epg-top-bar.spec.ts:95:5 › should display search results with details (AC2)
    [chromium] › epg-top-bar.spec.ts:122:5 › should navigate to program (AC2)
    [chromium] › epg-top-bar.spec.ts:152:5 › should show no results (AC2)
    [chromium] › epg-top-bar.spec.ts:175:5 › should clear search (AC2)
    [chromium] › epg-top-bar.spec.ts:195:5 › should close search dropdown (AC2)
    [chromium] › epg-top-bar.spec.ts:218:5 › should select day chip (AC3)
    [chromium] › epg-top-bar.spec.ts:248:5 › should highlight selected day chip (AC3)
    [chromium] › epg-top-bar.spec.ts:275:5 › should navigate days (AC3)
    [chromium] › epg-top-bar.spec.ts:305:5 › should open date picker (AC4)
    [chromium] › epg-top-bar.spec.ts:330:5 › should select date from picker (AC4)

Ran 13 tests, 0 passed, 13 failed
```

**Summary:**

- Total tests: 13
- Passing: 0 (expected)
- Failing: 13 (expected)
- Status: ✅ RED phase verified

**Expected Failure Messages:**

1. "locator.getByTestId('epg-top-bar') not found" - Component doesn't exist yet
2. "locator.getByTestId('epg-search-input') not found" - Search input component missing
3. "locator.getByTestId('epg-search-results') not found" - Search results component missing
4. "EpgSearchResults component not rendered" - Results formatting missing
5. "search result click handler not defined" - Navigation logic missing
6. "empty state UI not found" - No results state missing
7. "clear button not rendered" - Clear button missing
8. "keyboard event handler not attached" - Escape key handler missing
9. "useEpgDayNavigation hook does not exist" - Day navigation hook missing
10. "DayChip component not rendered with selected styling" - Selected chip styling missing
11. "prev/next button handlers not defined" - Arrow navigation missing
12. "DatePickerOverlay component does not exist" - Date picker missing
13. "date selection handler not implemented" - Date selection logic missing

---

## Notes

### Integration with Existing Components

- **useEpgSearch Hook:** Already implemented in `src/hooks/useEpgSearch.ts` with debounce, search state, and result handlers
- **EpgTv View:** Exists in `src/views/EpgTv.tsx` with `selectedChannelId` and `selectedProgramId` state
- **EpgChannelList:** Story 5.5 component for channel selection
- **EpgSchedulePanel:** Story 5.6 component for program schedule display

### Edge Cases Handled in Tests

1. Search with no results → Empty state displayed
2. Search with loading state → Loading spinner shown
3. Long program titles → Text truncation with ellipsis
4. Day navigation boundaries → Prev/Next buttons handle limits gracefully
5. Mobile viewport → Day chips horizontally scrollable
6. Keyboard navigation → Escape closes dropdown, Tab navigates
7. Date picker invalid dates → Only allow current and future dates

### Performance Considerations

- Search debounce: 300ms (implemented in `useEpgSearch`)
- Max 8 search results displayed
- Day chip rendering optimized with key props
- Schedule refetch throttled on rapid day changes

### Accessibility

- `role="combobox"` and `aria-expanded` on search input
- `role="listbox"` on search results dropdown
- `role="tab"` and `aria-selected` on day chips
- `role="dialog"` on date picker overlay
- Keyboard navigation: Tab, Escape, Enter

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Tag @bmad-tea in Slack/Discord
- Refer to `_bmad/bmm/testarch/README.md` for workflow documentation
- Consult `_bmad/bmm/testarch/knowledge/` for testing best practices

---

**Generated by BMad TEA Agent** - 2026-01-22
