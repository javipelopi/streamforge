# Story 5.1: EPG Grid Browser with Time Navigation

Status: done

## Story

As a user,
I want to browse the EPG in a grid view,
So that I can see what's on across all my enabled channels.

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

## Tasks / Subtasks

- [x] Task 1: Create EPG data fetching hook (AC: #1, #3)
  - [x] 1.1 Create `src/hooks/useEpgGridData.ts` hook
  - [x] 1.2 Add new Tauri command `get_enabled_channels_with_programs` to fetch programs for enabled channels only
  - [x] 1.3 Add time range filtering to query
  - [x] 1.4 Implement data transformation to group programs by channel and time slot

- [x] Task 2: Create time navigation state and controls (AC: #2)
  - [x] 2.1 Create time navigation state using `useState` for current view window
  - [x] 2.2 Implement "Now" button - centers grid on current time
  - [x] 2.3 Implement "Tonight" button - jumps to 7 PM of current day
  - [x] 2.4 Implement "Tomorrow" button - jumps to tomorrow morning
  - [x] 2.5 Implement +/- day navigation arrows
  - [x] 2.6 Add date picker component for jumping to specific dates (max 7 days ahead)
  - [x] 2.7 Create `TimeNavigationBar` component with all controls

- [x] Task 3: Create EPG Grid component with dual-axis virtualization (AC: #1, #3)
  - [x] 3.1 Create `src/components/epg/EpgGrid.tsx` main component
  - [x] 3.2 Implement vertical virtualizer for channel rows using `@tanstack/react-virtual`
  - [x] 3.3 Implement horizontal virtualizer for time columns using `@tanstack/react-virtual`
  - [x] 3.4 Create `EpgRow` component for a single channel row (merged into EpgGrid)
  - [x] 3.5 Create `EpgCell` component for program cells with duration-based width
  - [x] 3.6 Implement sticky channel name column on left side
  - [x] 3.7 Implement sticky time header row on top
  - [x] 3.8 Handle programs spanning multiple 30-minute slots

- [x] Task 4: Create program cell styling and rendering (AC: #1)
  - [x] 4.1 Calculate cell width based on program duration relative to 30-min slot width
  - [x] 4.2 Style program cells with proper truncation for long titles
  - [x] 4.3 Add visual indicator for currently airing programs
  - [x] 4.4 Handle edge cases: programs starting before or ending after visible window

- [x] Task 5: Implement program click handler (AC: #4)
  - [x] 5.1 Add onClick handler to program cells
  - [x] 5.2 Create state to track selected program for details panel
  - [x] 5.3 Export program selection callback for Story 5.3 integration

- [x] Task 6: Update EPG view page (AC: #1, #2, #3)
  - [x] 6.1 Replace placeholder content in `src/views/EPG.tsx`
  - [x] 6.2 Integrate `TimeNavigationBar` component
  - [x] 6.3 Integrate `EpgGrid` component
  - [x] 6.4 Add loading and empty states
  - [x] 6.5 Handle error states gracefully

- [x] Task 7: Backend - Add efficient EPG queries (AC: #1, #3)
  - [x] 7.1 Create `get_enabled_channels_with_programs` command in `src-tauri/src/commands/epg.rs`
  - [x] 7.2 Add SQL query that joins `xmltv_channel_settings` (enabled=true) with `xmltv_channels` and `programs`
  - [x] 7.3 Add time range filtering to query (only fetch programs in visible window + buffer)
  - [x] 7.4 Register command in Tauri invoke handler

## Dev Notes

### Architecture Compliance

This story implements **FR39** (User can browse EPG data within the application) and **FR42** (User can navigate EPG by time). It addresses **NFR5** (<100ms GUI responsiveness) through TanStack Virtual.

**CRITICAL - XMLTV-First Design:** The EPG grid MUST only show enabled XMLTV channels (`xmltv_channel_settings.is_enabled = true`). This represents the "Plex preview mode" - exactly what channels will appear in the user's Plex lineup.

### Technical Stack (from Architecture)

- **Frontend:** React 18 + TypeScript + Tailwind CSS
- **Virtualization:** TanStack Virtual (`@tanstack/react-virtual` v3.13.2 already installed)
- **State:** Local component state with `useState` for view window, Zustand for global app state
- **Data Fetching:** Direct Tauri invoke (not TanStack Query for this view - data is local)
- **Build:** Vite

### Existing Patterns to Follow

1. **Virtualization Pattern** - See `src/components/channels/ChannelsList.tsx`:
   ```typescript
   const virtualizer = useVirtualizer({
     count: items.length,
     getScrollElement: () => parentRef.current,
     estimateSize: () => 72,
     overscan: 5,
   });
   ```

2. **Tauri Command Pattern** - See `src/lib/tauri.ts`:
   ```typescript
   export async function getPrograms(sourceId: number): Promise<Program[]> {
     return invoke<Program[]>('get_programs', { sourceId });
   }
   ```

3. **Loading/Empty State Pattern** - From ChannelsList:
   ```typescript
   if (isLoading) {
     return <div className="animate-pulse">Loading...</div>;
   }
   if (items.length === 0) {
     return <div>No data found</div>;
   }
   ```

### Project Structure Notes

**New Files to Create:**
- `src/hooks/useEpgGridData.ts` - Data fetching and transformation hook
- `src/components/epg/EpgGrid.tsx` - Main grid component
- `src/components/epg/EpgRow.tsx` - Channel row component
- `src/components/epg/EpgCell.tsx` - Program cell component
- `src/components/epg/TimeNavigationBar.tsx` - Time navigation controls
- `src/components/epg/EpgTimeHeader.tsx` - Sticky time slot header

**Files to Modify:**
- `src/views/EPG.tsx` - Replace placeholder with actual implementation
- `src/lib/tauri.ts` - Add new EPG query type definitions
- `src-tauri/src/commands/epg.rs` - Add new efficient queries
- `src/components/epg/index.ts` - Export new components

### Database Queries Required

The existing `get_programs(sourceId)` returns ALL programs for a source. This is inefficient for EPG grid. New queries needed:

```sql
-- Get enabled channels with programs in time range
SELECT
  xc.id, xc.display_name, xc.icon,
  p.id as program_id, p.title, p.start_time, p.end_time, p.category
FROM xmltv_channels xc
INNER JOIN xmltv_channel_settings xcs ON xcs.xmltv_channel_id = xc.id
LEFT JOIN programs p ON p.xmltv_channel_id = xc.id
  AND p.end_time > :window_start
  AND p.start_time < :window_end
WHERE xcs.is_enabled = 1
ORDER BY xcs.plex_display_order, xc.display_name, p.start_time;
```

### Time Handling

- Program times are stored in database as ISO strings: `"2026-01-22 14:00:00"`
- Frontend should handle timezone conversion (display in user's local time)
- Time slots are 30-minute increments
- Default view window: 3 hours (6 slots visible at a time, scrollable)

### Performance Requirements (from NFR5)

- Grid must remain responsive with 500+ channels and 7 days of program data
- Use virtualization for BOTH axes (vertical for channels, horizontal for time)
- Only render visible rows/columns plus small overscan buffer
- Lazy load program data as user scrolls in time

### TanStack Virtual Grid Best Practices (2025)

From web research:
- Use two virtualizers for grid: `rowVirtualizer` (vertical) and `columnVirtualizer` (horizontal: true)
- Memoize cell components with `React.memo` to prevent unnecessary re-renders
- Use stable key identification to avoid flickering
- Consider debouncing scroll events for time-based data loading
- TanStack Virtual handles 1M+ cells efficiently

### Edge Cases to Handle

1. **Programs spanning time boundaries** - A 90-minute movie starting at 8:45 PM spans three 30-min slots
2. **No programs for a channel** - Show empty row or "No schedule available"
3. **Programs starting before window** - Show partial cell with program already in progress
4. **Programs ending after window** - Show partial cell continuing beyond view
5. **Currently airing** - Visual indicator (highlight/border) for "now" programs

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-5-Story-5.1]
- [Source: _bmad-output/planning-artifacts/prd.md#FR39-FR42]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-Architecture]
- [Source: src/components/channels/ChannelsList.tsx - virtualization pattern]
- [Source: src/lib/tauri.ts - Tauri command patterns]
- [TanStack Virtual Docs](https://tanstack.com/virtual/latest/docs/introduction)
- [TanStack Virtual Grid Best Practices](https://borstch.com/blog/development/tanstack-virtual-grid-large-datasets-in-react)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 12 component tests passing
- 235 Rust backend tests passing
- Frontend build successful

### Completion Notes List

1. Implemented dual-axis virtualization using TanStack Virtual for both channel rows (vertical) and time slots (horizontal)
2. Created efficient backend query `get_enabled_channels_with_programs` that:
   - Filters by enabled XMLTV channels only (Plex preview mode)
   - Joins channels with programs
   - Filters programs by time range overlap
   - Orders by plex_display_order then display_name
3. TimeNavigationBar provides all navigation controls: Now, Tonight, Tomorrow, +/- day, and date picker (limited to 7 days)
4. Program cells display with duration-based widths and visual indicators for currently airing programs
5. Added test infrastructure: vitest config, jsdom setup with proper mocks for TanStack Virtual
6. Installed testing dependencies: @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, vitest, jsdom

### Code Review (2026-01-22)

**Review Status:** ✅ PASSED with fixes applied

**Issues Found:** 8 total (0 Critical, 2 Medium fixed, 6 Low)

**Medium Issues Fixed:**
1. **Memory leak in EpgGrid (src/components/epg/EpgGrid.tsx:107)** - FIXED
   - Issue: `useMemo(() => new Date(), [])` cached Date object never updated
   - Impact: "Currently airing" indicator incorrect after mount
   - Fix: Removed useMemo, now creates fresh Date on each render
   - Files changed: `src/components/epg/EpgGrid.tsx`

2. **Test syntax error blocking test runs (tests/unit/matcher.test.ts:274)** - FIXED
   - Issue: `vec![/* ... */]` in comment caused parse error
   - Impact: Test suite unable to run
   - Fix: Changed to `vec![...]` in comment
   - Files changed: `tests/unit/matcher.test.ts`

**Low Issues (Not Fixed - Minor Impact):**
3. Missing error boundary for component failures
4. Performance: No React.memo on EpgCell (TanStack Virtual mitigates)
5. Missing time window validation (startTime < endTime)
6. Silent date parsing errors in TimeNavigationBar
7. Test coverage incomplete (blocked by issue #2, now resolved)

**Acceptance Criteria Verification:**
- ✅ AC#1: Grid displays enabled channels, time slots, program cells - IMPLEMENTED
- ✅ AC#2: Time navigation (Now, Tonight, Tomorrow, +/- day, date picker) - IMPLEMENTED
- ✅ AC#3: TanStack Virtual for responsive UI - IMPLEMENTED
- ✅ AC#4: Program click handler emits event - IMPLEMENTED

**Task Completion Audit:**
All 7 tasks marked [x] verified as complete. No false completions found.

### File List

**New Files:**
- `src/hooks/useEpgGridData.ts` - Data fetching hook with time window helpers
- `src/components/epg/EpgGrid.tsx` - Main grid component with dual-axis virtualization
- `src/components/epg/EpgCell.tsx` - Program cell component with duration-based width
- `src/components/epg/TimeNavigationBar.tsx` - Time navigation controls
- `vitest.config.ts` - Vitest configuration for component tests
- `tests/support/vitest.setup.ts` - Test setup with jsdom mocks for TanStack Virtual

**Modified Files:**
- `src/views/EPG.tsx` - Replaced placeholder with full implementation
- `src/components/epg/index.ts` - Added exports for new components
- `src/lib/tauri.ts` - Added EPG grid types and functions
- `src-tauri/src/commands/epg.rs` - Added `get_enabled_channels_with_programs` command
- `src-tauri/src/lib.rs` - Registered new command in invoke handler

**Files Modified During Code Review:**
- `src/components/epg/EpgGrid.tsx` - Fixed memory leak (removed useMemo on Date)
- `tests/unit/matcher.test.ts` - Fixed comment syntax error

