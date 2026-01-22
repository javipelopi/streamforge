# Story 5.7: EPG Top Bar with Search and Day Navigation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want a top bar with search and day navigation,
So that I can find programs and browse different days.

## Acceptance Criteria

1. **Given** the EPG view **When** it loads **Then** I see a fixed top bar with:
   - Left: Search input (expandable, magnifying glass icon)
   - Right: Day navigation chips (Today, Tonight, Tomorrow, day names)
   - Right: Prev/Next arrows and date picker icon

2. **Given** the search input **When** I type a query **Then** results appear in dropdown (debounced 300ms) **And** results show: program title, channel name, date/time **And** clicking a result navigates to that day/channel/program

3. **Given** day navigation chips **When** I click a chip **Then** the schedule panel loads that day's programs **And** the selected chip shows purple background (#6366f1)

4. **Given** the date picker icon **When** I click it **Then** a calendar overlay opens for date selection

## Tasks / Subtasks

- [ ] Task 1: Create EpgTopBar component structure (AC: #1)
  - [ ] 1.1 Create `src/components/epg/tv-style/EpgTopBar.tsx`
  - [ ] 1.2 Fixed position at top, full width, height ~56px
  - [ ] 1.3 Semi-transparent dark background `rgba(0,0,0,0.7)` / `bg-black/70`
  - [ ] 1.4 Subtle bottom border for visual separation
  - [ ] 1.5 Flex layout: search on left, day navigation on right
  - [ ] 1.6 Add `data-testid="epg-top-bar"` to container

- [ ] Task 2: Create EpgSearchInput component (AC: #1, #2)
  - [ ] 2.1 Create `src/components/epg/tv-style/EpgSearchInput.tsx`
  - [ ] 2.2 Magnifying glass icon (20px) clickable to expand input
  - [ ] 2.3 Input field: expands on focus, ~300px max width, placeholder "Search programs..."
  - [ ] 2.4 Clear button (X icon) when input has text
  - [ ] 2.5 Style matching dark theme (transparent bg, white text, light border on focus)
  - [ ] 2.6 Add `data-testid="epg-search-input"` for testing

- [ ] Task 3: Create EpgSearchResults dropdown (AC: #2)
  - [ ] 3.1 Create `src/components/epg/tv-style/EpgSearchResults.tsx`
  - [ ] 3.2 Dropdown below search input, max 8 results
  - [ ] 3.3 Semi-transparent dark background matching panel style
  - [ ] 3.4 Each result shows: program title (bold), channel name, date/time
  - [ ] 3.5 Hover state: subtle highlight `rgba(255,255,255,0.05)`
  - [ ] 3.6 Click handler for result selection
  - [ ] 3.7 Loading spinner while searching
  - [ ] 3.8 "No results found" empty state
  - [ ] 3.9 Add `data-testid="epg-search-results"` and `data-testid="search-result-{programId}"`

- [ ] Task 4: Implement search functionality with useEpgSearch hook (AC: #2)
  - [ ] 4.1 Wire existing `useEpgSearch` hook from `src/hooks/useEpgSearch.ts`
  - [ ] 4.2 Debounce search to 300ms (already implemented in hook)
  - [ ] 4.3 Display results in dropdown
  - [ ] 4.4 Handle result selection: emit event with channelId, programId, and date
  - [ ] 4.5 Clear search after selection
  - [ ] 4.6 Close dropdown on Escape key or click outside

- [ ] Task 5: Create DayNavigationBar component (AC: #1, #3)
  - [ ] 5.1 Create `src/components/epg/tv-style/DayNavigationBar.tsx`
  - [ ] 5.2 Horizontal layout: Prev arrow, day chips, Next arrow, date picker icon
  - [ ] 5.3 Day chips: "Today", "Tonight", "Tomorrow", then day names (Wed, Thu, Fri...)
  - [ ] 5.4 Chips horizontally scrollable if needed
  - [ ] 5.5 Add `data-testid="day-navigation-bar"` and `data-testid="day-chip-{day}"`

- [ ] Task 6: Create DayChip component (AC: #3)
  - [ ] 6.1 Create `src/components/epg/tv-style/DayChip.tsx`
  - [ ] 6.2 Default state: semi-transparent bg, white text, subtle border
  - [ ] 6.3 Selected state: solid purple background (#6366f1), white text
  - [ ] 6.4 Hover state: lighter purple background `rgba(99,102,241,0.3)`
  - [ ] 6.5 Click handler to select day
  - [ ] 6.6 Add `aria-selected` for accessibility

- [ ] Task 7: Create DatePickerButton and overlay (AC: #4)
  - [ ] 7.1 Create `src/components/epg/tv-style/DatePickerButton.tsx`
  - [ ] 7.2 Calendar icon button matching dark theme
  - [ ] 7.3 On click, open calendar overlay/modal
  - [ ] 7.4 Use Radix UI DatePicker or simple custom calendar
  - [ ] 7.5 Date selection triggers day navigation
  - [ ] 7.6 Close overlay on selection or click outside
  - [ ] 7.7 Add `data-testid="date-picker-button"` and `data-testid="date-picker-overlay"`

- [ ] Task 8: Create useEpgDayNavigation hook (AC: #3)
  - [ ] 8.1 Create `src/hooks/useEpgDayNavigation.ts`
  - [ ] 8.2 State: `selectedDate` (Date object)
  - [ ] 8.3 Compute day chips array (Today, Tonight, Tomorrow, next 4 days)
  - [ ] 8.4 Functions: `selectDay(date)`, `goToPrevDay()`, `goToNextDay()`
  - [ ] 8.5 "Today" = current date starting at current time
  - [ ] 8.6 "Tonight" = current date starting at 6 PM
  - [ ] 8.7 "Tomorrow" and day names = that date starting at 6 AM
  - [ ] 8.8 Export time window (startTime, endTime) for schedule fetching

- [ ] Task 9: Integrate top bar into EpgTv view (AC: #1, #2, #3)
  - [ ] 9.1 Add EpgTopBar to `src/views/EpgTv.tsx` above EpgMainContent
  - [ ] 9.2 Wire day navigation state to schedule panel
  - [ ] 9.3 Wire search result selection to channel/program selection
  - [ ] 9.4 Pass selected date to useChannelSchedule hook
  - [ ] 9.5 Ensure top bar doesn't push content (overlay/fixed positioning)

- [ ] Task 10: Update useChannelSchedule to accept date parameter (AC: #3)
  - [ ] 10.1 Modify `src/hooks/useChannelSchedule.ts` to accept `selectedDate` prop
  - [ ] 10.2 Calculate time window based on selectedDate instead of always "today"
  - [ ] 10.3 Refetch when selectedDate changes
  - [ ] 10.4 Update ScheduleHeader to display the selected date

- [ ] Task 11: Update component exports (AC: #1)
  - [ ] 11.1 Add exports to `src/components/epg/tv-style/index.ts`
  - [ ] 11.2 Ensure TypeScript compilation succeeds
  - [ ] 11.3 Ensure Vite build succeeds

- [ ] Task 12: Add unit/integration tests
  - [ ] 12.1 Test top bar renders with search and day navigation
  - [ ] 12.2 Test search input expands/collapses correctly
  - [ ] 12.3 Test search results display and selection
  - [ ] 12.4 Test day chip selection updates schedule
  - [ ] 12.5 Test prev/next day navigation
  - [ ] 12.6 Test date picker opens and selects date
  - [ ] 12.7 Test keyboard navigation (Escape closes search)

## Dev Notes

### Architecture Compliance

This story implements the top bar of the TV-style EPG layout (Story 5.4 foundation). It fulfills **FR40** (User can search EPG by program title, channel name, or description) and **FR42** (User can navigate EPG by time) per the course correction for TV-style EPG redesign (2026-01-22).

**CRITICAL - Build on Story 5.4/5.5/5.6 Foundation:**
- Story 5.4 created the three-panel layout in `src/components/epg/tv-style/`
- Story 5.5 implemented `EpgChannelList` with channel selection state
- Story 5.6 implemented `EpgSchedulePanel` with program selection state
- This story adds the TOP BAR above the three panels
- The `EpgTv.tsx` view already has `selectedChannelId` and `selectedProgramId` states

### Visual Design Requirements

From `ux-epg-tv-guide.md` Top Bar section:

**Top Bar Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [🔍] Search programs...          │    [◀] [Today] [Tonight] [▶]    [📅]   │
│       (expandable input)          │         Day Navigation                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Color Specifications:**
| Element | Color |
|---------|-------|
| Top bar background | `rgba(0, 0, 0, 0.7)` / `bg-black/70` |
| Top bar height | ~56px |
| Search icon | `#ffffff` (20px) |
| Search input text | `#ffffff` |
| Search input placeholder | `#a0a0a0` |
| Day chip default | `transparent` bg, `rgba(255,255,255,0.2)` border |
| Day chip selected | `#6366f1` bg (purple) |
| Day chip hover | `rgba(99,102,241,0.3)` |
| Dropdown background | `rgba(0,0,0,0.9)` |

**Search Behavior (from UX spec):**
- Debounced search (300ms delay)
- Results show: Program title, channel name, date/time
- Max 8 results in dropdown
- Clicking a result: navigates to that day, selects the channel, highlights the program, shows details

**Day Navigation Behavior:**
- "Today" = current time onwards
- "Tonight" = 6 PM onwards
- "Tomorrow" and day names = full day schedule (starting 6 AM)
- Date picker for arbitrary date selection

### Component Hierarchy

```
EpgTv.tsx (view)
├── EpgTopBar (THIS STORY)
│   ├── EpgSearchInput
│   │   └── EpgSearchResults (dropdown)
│   └── DayNavigationBar
│       ├── PrevDayButton (◀)
│       ├── DayChip (Today, Tonight, Tomorrow, Wed, Thu...)
│       ├── NextDayButton (▶)
│       └── DatePickerButton → DatePickerOverlay
│
├── EpgBackground
└── EpgMainContent
    ├── EpgChannelList (Story 5.5)
    ├── EpgSchedulePanel (Story 5.6)
    └── EpgDetailsPanelPlaceholder (Story 5.8)
```

### Existing Code to Reuse

**useEpgSearch Hook (from `src/hooks/useEpgSearch.ts`):**
```typescript
// Already implemented - provides search state and handlers
export interface UseEpgSearchResult {
  query: string;
  results: EpgSearchResult[];
  isSearching: boolean;
  error: string | null;
  isResultsVisible: boolean;
  onSearch: (query: string) => void;
  onClear: () => void;
  onResultSelect: (result: EpgSearchResult) => TimeWindow | null;
  cancelPendingSearch: () => void;
}
```

**EpgSearchResult Type (from `src/lib/tauri.ts`):**
```typescript
interface EpgSearchResult {
  programId: number;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  category?: string;
  channelId: number;
  channelName: string;
  channelIcon?: string;
  matchType: 'title' | 'channel' | 'description';
  relevanceScore: number;
}
```

**Backend Search Command (from `src-tauri/src/commands/epg.rs`):**
```rust
// Already implemented - searches enabled channels only
#[tauri::command]
pub async fn search_epg_programs(
    db: State<'_, DbConnection>,
    query: String,
) -> Result<Vec<EpgSearchResult>, String>;
```

**Time Window Helpers (from `src/hooks/useEpgGridData.ts`):**
```typescript
// Reuse these for day navigation
export function createCenteredTimeWindow(centerTime: Date, hoursAround: number): TimeWindow;
export function getTodayTimeWindow(): TimeWindow;
export function getCurrentTimeWindow(): TimeWindow;
```

### New Hook: useEpgDayNavigation

Create this hook to manage day selection state:

```typescript
// src/hooks/useEpgDayNavigation.ts
interface DayOption {
  id: string;           // "today", "tonight", "tomorrow", "wed", etc.
  label: string;        // "Today", "Tonight", "Tomorrow", "Wed", etc.
  date: Date;           // The date this represents
  startTime: Date;      // Start of time window
  endTime: Date;        // End of time window
}

interface UseEpgDayNavigationResult {
  selectedDay: DayOption;
  dayOptions: DayOption[];
  selectDay: (dayId: string) => void;
  selectDate: (date: Date) => void;
  goToPrevDay: () => void;
  goToNextDay: () => void;
  timeWindow: { startTime: string; endTime: string };
}

export function useEpgDayNavigation(): UseEpgDayNavigationResult {
  // Implementation...
}
```

**Day Computation Logic:**
```typescript
function computeDayOptions(): DayOption[] {
  const now = new Date();
  const today = new Date(now);
  today.setHours(6, 0, 0, 0); // 6 AM start

  const options: DayOption[] = [
    {
      id: 'today',
      label: 'Today',
      date: now,
      startTime: now, // Current time
      endTime: endOfDay(now),
    },
    {
      id: 'tonight',
      label: 'Tonight',
      date: now,
      startTime: setHours(now, 18), // 6 PM
      endTime: endOfDay(now),
    },
    {
      id: 'tomorrow',
      label: 'Tomorrow',
      date: addDays(now, 1),
      startTime: startOfDayAt6AM(addDays(now, 1)),
      endTime: endOfDay(addDays(now, 1)),
    },
    // Next 4 days (Wed, Thu, Fri, Sat)
    ...Array.from({ length: 4 }, (_, i) => {
      const date = addDays(now, i + 2);
      return {
        id: formatDayShort(date).toLowerCase(),
        label: formatDayShort(date),
        date,
        startTime: startOfDayAt6AM(date),
        endTime: endOfDay(date),
      };
    }),
  ];
  return options;
}
```

### Previous Story Learnings (Story 5.6)

From Story 5.6 code review:
1. **Race conditions:** Use `isFetchingRef` and `isMountedRef` to prevent memory leaks
2. **Cleanup in useEffect:** Always return cleanup function for timers and subscriptions
3. **Keyboard navigation:** Support Escape key to close dropdowns
4. **Accessibility:** Include `aria-expanded`, `aria-haspopup`, `role="combobox"` for search
5. **Constants:** Extract magic numbers (`DEBOUNCE_MS = 300`, `MAX_RESULTS = 8`)
6. **Tailwind over inline:** Use Tailwind classes like `bg-black/70` not inline styles

### Git Context (Recent Commits)

From recent commits on `feature/epic-5`:
- `2234347` - Code review fixes for Story 5.6 EPG schedule panel
- `b452acf` - Implement Story 5.6 EPG schedule panel
- Pattern: Follow the same component structure in `src/components/epg/tv-style/`

### Integration with Schedule Panel

When a search result is selected OR a day is changed, the following must happen:

**Search Result Selection Flow:**
1. User clicks search result with `channelId`, `programId`, `startTime`
2. Extract date from `startTime`
3. Update `selectedDate` via `useEpgDayNavigation`
4. Update `selectedChannelId` in EpgTv state (triggers channel list selection)
5. Update `selectedProgramId` in EpgTv state (triggers program highlight)
6. Schedule panel auto-scrolls to the program

**Day Change Flow:**
1. User clicks day chip
2. Update `selectedDate` via `useEpgDayNavigation`
3. Clear `selectedProgramId` (program may not exist on new day)
4. Keep `selectedChannelId` (preserve channel selection)
5. Schedule panel refetches programs for new date

### Edge Cases to Handle

1. **Search with no results** - Display "No results found" in dropdown
2. **Search error** - Display user-friendly error message
3. **Day navigation at boundaries** - Prev should not go before today, Next should limit to ~7 days
4. **Date picker invalid selection** - Only allow future/current dates (past dates may have no data)
5. **Mobile/narrow viewport** - Day chips should scroll horizontally
6. **Search result for past program** - Still navigate but show in muted styling
7. **Keyboard navigation** - Arrow keys in dropdown, Escape to close, Tab to navigate

### What NOT to Do in This Story

- Do NOT implement the program details panel (Story 5.8)
- Do NOT modify EpgChannelList behavior (Story 5.5)
- Do NOT modify EpgSchedulePanel behavior beyond date parameter (Story 5.6)
- Do NOT add complex date range validation (keep it simple)
- Do NOT implement time-of-day filtering beyond Tonight/full day

### Testing Considerations

- Add `data-testid="epg-top-bar"` to top bar container
- Add `data-testid="epg-search-input"` to search input
- Add `data-testid="epg-search-results"` to results dropdown
- Add `data-testid="search-result-{programId}"` to each result
- Add `data-testid="day-navigation-bar"` to day nav container
- Add `data-testid="day-chip-{day}"` to each day chip (e.g., `day-chip-today`)
- Add `data-testid="date-picker-button"` to calendar button
- Add `data-testid="date-picker-overlay"` to calendar overlay
- Test: Search input expands on focus, collapses on blur
- Test: Search results appear after typing (debounced)
- Test: Search result click navigates correctly
- Test: Day chip click updates schedule
- Test: Prev/Next arrows navigate days
- Test: Date picker opens and date selection works
- Test: Escape key closes search dropdown

### Performance Requirements

- Search debounce: 300ms (already in useEpgSearch)
- Search query: <500ms backend response (50 result limit)
- Day chip click: <100ms visual feedback
- Date change: <200ms schedule fetch start
- UI responsiveness: 60fps maintained during interactions

### Accessibility Requirements

- Search input: `role="combobox"`, `aria-expanded`, `aria-haspopup="listbox"`
- Search results: `role="listbox"`, `aria-label="Search results"`
- Each result: `role="option"`, `aria-selected`
- Day chips: `role="tablist"`, each chip `role="tab"`, `aria-selected`
- Date picker button: `aria-label="Open date picker"`
- Keyboard: Tab navigation, Enter to select, Escape to close

### References

- [Source: _bmad-output/planning-artifacts/ux-epg-tv-guide.md#Top-Bar-Search-Day-Navigation]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.7-EPG-Top-Bar-with-Search-and-Day-Navigation]
- [Source: _bmad-output/implementation-artifacts/5-6-epg-schedule-panel.md - Previous story patterns]
- [Source: src/hooks/useEpgSearch.ts - Existing search hook to reuse]
- [Source: src/hooks/useEpgGridData.ts - Time window helpers]
- [Source: src/lib/tauri.ts#searchEpgPrograms - Search function and types]
- [Source: src-tauri/src/commands/epg.rs#search_epg_programs - Backend search implementation]
- [Source: src/views/EpgTv.tsx - View integration point]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
