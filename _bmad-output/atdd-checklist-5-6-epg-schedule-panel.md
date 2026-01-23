# ATDD Checklist - Epic 5, Story 5.6: EPG Schedule Panel

**Date:** 2026-01-22
**Author:** Javier (via TEA Agent)
**Primary Test Level:** E2E

---

## Story Summary

As a user,
I want to see the full schedule for my selected channel,
So that I can browse what's coming up on that channel.

**Key Features:**
- Display schedule list with date header and time column
- Program selection with visual feedback (accent bar, highlight)
- NOW/PAST/FUTURE program status indicators
- Auto-scroll to current program on load
- Independent scrolling from channel list

---

## Acceptance Criteria

1. **Given** a channel is selected **When** the center panel loads **Then** I see a schedule list with:
   - Date header (e.g., "TUE 21 Jan")
   - Time column (~80px, gray)
   - Program titles (white, ellipsis on overflow)

2. **Given** the schedule list **When** I click a program **Then** that program is highlighted (left accent bar, brighter bg) **And** the right panel shows program details

3. **Given** the current time **When** viewing the schedule **Then** the "NOW" program is indicated distinctly **And** past programs show muted styling **And** schedule auto-scrolls to current time

4. **Given** the schedule panel **When** scrolling through programs **Then** scrolling is independent of channel list **And** UI remains responsive

---

## Failing Tests Created (RED Phase)

### E2E Tests (13 tests)

**File:** `tests/e2e/epg-schedule-panel.spec.ts` (687 lines)

- ✅ **Test:** should display schedule panel with date header and program list (AC1)
  - **Status:** RED - EpgSchedulePanel component not yet implemented
  - **Verifies:** Schedule panel renders with correct layout, date header formatting, time column, and program titles with ellipsis

- ✅ **Test:** should display NOW indicator for currently-airing program (AC3)
  - **Status:** RED - NOW indicator badge not yet implemented
  - **Verifies:** Current program shows distinct NOW badge with green styling

- ✅ **Test:** should display past programs with muted styling (AC3)
  - **Status:** RED - Past program muted styling not yet applied
  - **Verifies:** Past programs have reduced opacity or grayed text color

- ✅ **Test:** should auto-scroll to current program on initial load (AC3)
  - **Status:** RED - Auto-scroll functionality not yet implemented
  - **Verifies:** Current program is visible in viewport after channel selection

- ✅ **Test:** should select program and update state on click (AC2)
  - **Status:** RED - Program selection state management not yet implemented
  - **Verifies:** Selected program shows left accent bar (4px purple) and brighter background

- ✅ **Test:** should support keyboard navigation within schedule (AC2, AC4)
  - **Status:** RED - Keyboard navigation not yet implemented
  - **Verifies:** Arrow keys navigate through programs, updating aria-selected attribute

- ✅ **Test:** should maintain independent scrolling from channel list (AC4)
  - **Status:** RED - Independent scroll containers not yet separated
  - **Verifies:** Schedule panel scrolls independently from channel list

- ✅ **Test:** should display empty state when no channel selected (AC1)
  - **Status:** RED - Empty state component not yet created
  - **Verifies:** "Select a channel to see schedule" message displays when no channel selected

- ✅ **Test:** should display empty state when channel has no programs (AC1)
  - **Status:** RED - No programs empty state not yet implemented
  - **Verifies:** "No schedule data available" message displays for channels without programs

- ✅ **Test:** should show loading skeleton while schedule loads (AC1)
  - **Status:** RED - Loading skeleton UI not yet created
  - **Verifies:** Skeleton rows display during data fetch

- ✅ **Test:** should apply hover state to program rows (AC1)
  - **Status:** RED - Hover styling not yet implemented
  - **Verifies:** Subtle highlight (rgba(255,255,255,0.05)) on row hover

- ✅ **Test:** should handle long program titles with ellipsis (AC1)
  - **Status:** RED - Text truncation CSS not yet applied
  - **Verifies:** Long titles truncate with ellipsis, single line display

- ✅ **Test:** should reset scroll when channel changes (AC3)
  - **Status:** RED - Channel change scroll reset not yet implemented
  - **Verifies:** Scroll position resets to current program when selecting different channel

---

## Data Factories Created

### EPG Schedule Panel Factory

**File:** `tests/support/factories/epg-schedule-panel.factory.ts`

**Exports:**

- `createEpgProgram(overrides?)` - Create single program with NOW/PAST/FUTURE status
- `createCurrentProgram(overrides?)` - Create program currently airing (NOW)
- `createPastProgram(minutesAgo, duration, overrides?)` - Create past program
- `createFutureProgram(minutesFromNow, duration, overrides?)` - Create future program
- `createDaySchedule(channelId, overrides?)` - Create full day schedule (6 AM - 24 hours)
- `createScheduleWithTimeDistribution(channelId, config)` - Create schedule with specific PAST/NOW/FUTURE counts
- `createAllPastSchedule(channelId, programCount?)` - Create schedule with all past programs
- `createEmptySchedule(channelId, channelName?)` - Create empty schedule (no programs)
- `getProgramStatus(startTime, endTime, currentTime?)` - Determine program status (NOW/PAST/FUTURE)
- `formatTimeDisplay(isoString)` - Format time for display (e.g., "8:00 AM")
- `formatDateHeader(date?)` - Format date header (e.g., "TUE 21 Jan")

**Example Usage:**

```typescript
// Create full day schedule
const scheduleData = createDaySchedule(100, {
  channelName: 'Test Channel',
  programCount: 30,
  includeCurrentProgram: true,
});

// Create schedule with specific time distribution
const customSchedule = createScheduleWithTimeDistribution(101, {
  pastCount: 5,
  futureCount: 10,
  includeNowProgram: true,
});

// Create current program
const nowProgram = createCurrentProgram({ title: 'Live News' });
```

---

## Fixtures Created

### EPG Schedule Panel Fixtures

**File:** `tests/support/fixtures/epg-schedule-panel.fixture.ts`

**Fixtures:**

- `epgScheduleData` - Pre-populated schedule data for selected channel
  - **Setup:** Creates channel with 30 programs covering full day, seeds via Tauri commands
  - **Provides:** EpgScheduleData with programs (NOW/PAST/FUTURE), current program ID, date header
  - **Cleanup:** Deletes channel and all associated programs after test

- `epgSchedulePanelApi` - Helper methods for schedule panel interactions
  - **Setup:** None (read-only utilities)
  - **Provides:**
    - `selectChannel(channelId)` - Click channel row and wait for schedule to load
    - `selectProgram(programId)` - Click program row in schedule
    - `getScheduleForChannel(channelId)` - Fetch programs via Tauri command
    - `getCurrentProgram(channelId)` - Get currently-airing program
    - `scrollToCurrentProgram()` - Scroll to NOW program
  - **Cleanup:** None (no state modification)

**Example Usage:**

```typescript
import { test, expect } from './fixtures/epg-schedule-panel.fixture';

test('should display schedule', async ({ page, epgScheduleData, epgSchedulePanelApi }) => {
  await page.goto('/epg-tv');
  await epgSchedulePanelApi.selectChannel(epgScheduleData.channelId);

  const schedulePanel = page.getByTestId('epg-schedule-panel');
  await expect(schedulePanel).toBeVisible();
});
```

---

## Mock Requirements

**Tauri Commands (Backend):**

All EPG data is seeded via existing Tauri commands (no mocking needed):

- `create_test_xmltv_channel` - Create channel for testing
- `set_xmltv_channel_enabled` - Enable channel with display order
- `create_test_program` - Create program with time range and metadata
- `delete_test_channel_data` - Cleanup channel and programs
- `get_enabled_channels_with_programs` - Fetch channels with programs in time range
- `get_programs_in_time_range` - Fetch programs for specific channel

**Network Responses:** Not applicable - Tauri IPC used instead of HTTP

---

## Required data-testid Attributes

### EpgSchedulePanel Component

- `epg-schedule-panel` - Schedule panel container
- `schedule-header` - Date header (e.g., "TUE 21 Jan")
- `schedule-empty-state` - Empty state when no channel selected
- `schedule-no-data` - Empty state when channel has no programs
- `schedule-skeleton` - Loading skeleton rows

### ScheduleRow Component

- `schedule-row-{programId}` - Each program row (e.g., `schedule-row-12345`)
- `program-time` - Time column (e.g., "8:00 AM")
- `program-title` - Program title text
- `now-indicator` - NOW badge for currently-airing program

**Implementation Example:**

```tsx
// EpgSchedulePanel.tsx
<div data-testid="epg-schedule-panel" className="flex flex-col h-full">
  <div data-testid="schedule-header" className="text-center font-bold text-white text-base py-4">
    {dateHeader}
  </div>
  <div className="flex-1 overflow-y-auto">
    {programs.map((program) => (
      <ScheduleRow
        key={program.id}
        program={program}
        isSelected={selectedProgramId === program.id}
        onSelect={() => handleSelectProgram(program.id)}
      />
    ))}
  </div>
</div>

// ScheduleRow.tsx
<div
  data-testid={`schedule-row-${program.id}`}
  aria-selected={isSelected}
  className="flex items-center hover:bg-white/5 cursor-pointer"
>
  <div data-testid="program-time" className="w-20 text-gray-400">
    {formatTime(program.startTime)}
  </div>
  <div data-testid="program-title" className="flex-1 truncate text-white">
    {program.title}
  </div>
  {program.status === 'NOW' && (
    <div data-testid="now-indicator" className="px-2 py-1 bg-green-500 rounded">
      NOW
    </div>
  )}
</div>
```

---

## Implementation Checklist

### Test: should display schedule panel with date header and program list (AC1)

**File:** `tests/e2e/epg-schedule-panel.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/components/epg/tv-style/EpgSchedulePanel.tsx` component
- [ ] Accept `selectedChannelId` and `onSelectProgram` props
- [ ] Add semi-transparent dark background `bg-black/50` with `rounded-lg`
- [ ] Implement ScheduleHeader component with date formatting ("TUE 21 Jan")
- [ ] Create ScheduleRow component with two-column layout (time + title)
- [ ] Time format: "HH:MM AM/PM" in light gray (#a0a0a0), ~80px fixed width
- [ ] Program title: white, 14px, single line with `overflow-hidden text-ellipsis`
- [ ] Add `data-testid="epg-schedule-panel"` to container
- [ ] Add `data-testid="schedule-header"` to date header
- [ ] Add `data-testid="schedule-row-{programId}"` to each row
- [ ] Add `data-testid="program-time"` and `data-testid="program-title"` to row elements
- [ ] Run test: `npm run test:e2e -- epg-schedule-panel.spec.ts -g "should display schedule panel"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 4 hours

---

### Test: should display NOW indicator for currently-airing program (AC3)

**File:** `tests/e2e/epg-schedule-panel.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `useChannelSchedule` hook in `src/hooks/useChannelSchedule.ts`
- [ ] Implement `getProgramStatus` helper to determine NOW/PAST/FUTURE
- [ ] Add NOW indicator badge in ScheduleRow component
- [ ] Style NOW badge: distinct styling (green background #22c55e, white text)
- [ ] Add `data-testid="now-indicator"` to NOW badge
- [ ] Conditionally render badge only for programs with status === 'NOW'
- [ ] Run test: `npm run test:e2e -- epg-schedule-panel.spec.ts -g "should display NOW indicator"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: should display past programs with muted styling (AC3)

**File:** `tests/e2e/epg-schedule-panel.spec.ts`

**Tasks to make this test pass:**

- [ ] Add conditional styling for past programs in ScheduleRow
- [ ] Apply muted styling: `text-gray-500` or `opacity-60` for past programs
- [ ] Check program status (PAST) and apply appropriate CSS classes
- [ ] Ensure time and title both get muted styling for consistency
- [ ] Run test: `npm run test:e2e -- epg-schedule-panel.spec.ts -g "should display past programs with muted"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: should auto-scroll to current program on initial load (AC3)

**File:** `tests/e2e/epg-schedule-panel.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `useRef` to track schedule container and current program element
- [ ] Implement `useEffect` to detect when selectedChannelId changes
- [ ] Find current program (NOW) element using ref
- [ ] Call `scrollIntoView({ behavior: 'smooth', block: 'center' })` on NOW element
- [ ] Ensure scroll happens only once per channel selection
- [ ] Handle case when no NOW program exists (don't scroll)
- [ ] Run test: `npm run test:e2e -- epg-schedule-panel.spec.ts -g "should auto-scroll to current program"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: should select program and update state on click (AC2)

**File:** `tests/e2e/epg-schedule-panel.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `selectedProgramId` and `onSelectProgram` props to EpgSchedulePanel
- [ ] Pass `selectedProgramId` to each ScheduleRow component
- [ ] Apply selected styling when program matches `selectedProgramId`
- [ ] Selected state: left purple accent bar (4px, #6366f1) + brighter background (rgba(99,102,241,0.2))
- [ ] Emit selection event when schedule row is clicked: `onSelectProgram(program.id)`
- [ ] Add `aria-selected` attribute to selected row for accessibility
- [ ] Run test: `npm run test:e2e -- epg-schedule-panel.spec.ts -g "should select program and update state"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: should support keyboard navigation within schedule (AC2, AC4)

**File:** `tests/e2e/epg-schedule-panel.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `onKeyDown` handler to schedule panel container
- [ ] Detect ArrowUp and ArrowDown key presses
- [ ] Track current selected index in component state
- [ ] On ArrowDown: increment index, select next program
- [ ] On ArrowUp: decrement index, select previous program
- [ ] Wrap navigation at boundaries (don't go below 0 or above programs.length-1)
- [ ] Update `selectedProgramId` state on keyboard navigation
- [ ] Ensure selected row stays in viewport (scrollIntoViewIfNeeded)
- [ ] Run test: `npm run test:e2e -- epg-schedule-panel.spec.ts -g "should support keyboard navigation"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 3 hours

---

### Test: should maintain independent scrolling from channel list (AC4)

**File:** `tests/e2e/epg-schedule-panel.spec.ts`

**Tasks to make this test pass:**

- [ ] Ensure EpgSchedulePanel has `overflow-y-auto` on inner container (not parent)
- [ ] Verify channel list and schedule panel have separate scroll containers
- [ ] Test that scrolling schedule doesn't affect channel list scroll position
- [ ] Add `scroll-behavior: smooth` for better UX
- [ ] Run test: `npm run test:e2e -- epg-schedule-panel.spec.ts -g "should maintain independent scrolling"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: should display empty state when no channel selected (AC1)

**File:** `tests/e2e/epg-schedule-panel.spec.ts`

**Tasks to make this test pass:**

- [ ] Check if `selectedChannelId` is null
- [ ] Render empty state component with message: "Select a channel to see schedule"
- [ ] Add centered, user-friendly styling for empty state
- [ ] Include icon or visual indicator (optional)
- [ ] Add `data-testid="schedule-empty-state"`
- [ ] Run test: `npm run test:e2e -- epg-schedule-panel.spec.ts -g "should display empty state when no channel"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: should display empty state when channel has no programs (AC1)

**File:** `tests/e2e/epg-schedule-panel.spec.ts`

**Tasks to make this test pass:**

- [ ] Check if `programs` array is empty after fetch
- [ ] Render different empty state: "No schedule data available"
- [ ] Add `data-testid="schedule-no-data"`
- [ ] Style consistently with other empty states
- [ ] Run test: `npm run test:e2e -- epg-schedule-panel.spec.ts -g "should display empty state when channel has no programs"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: should show loading skeleton while schedule loads (AC1)

**File:** `tests/e2e/epg-schedule-panel.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `isLoading` state to useChannelSchedule hook
- [ ] Set isLoading=true when fetching data
- [ ] Render skeleton UI matching schedule row layout (time + title placeholders)
- [ ] Use Tailwind `animate-pulse` for skeleton animation
- [ ] Add `data-testid="schedule-skeleton"`
- [ ] Show 10-15 skeleton rows to fill viewport
- [ ] Set isLoading=false when data arrives
- [ ] Run test: `npm run test:e2e -- epg-schedule-panel.spec.ts -g "should show loading skeleton"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: should apply hover state to program rows (AC1)

**File:** `tests/e2e/epg-schedule-panel.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `hover:bg-white/5` Tailwind class to ScheduleRow component
- [ ] Verify hover styling applies subtle highlight (rgba(255,255,255,0.05))
- [ ] Ensure hover doesn't conflict with selected state styling
- [ ] Test hover works on all rows (PAST, NOW, FUTURE)
- [ ] Run test: `npm run test:e2e -- epg-schedule-panel.spec.ts -g "should apply hover state"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: should handle long program titles with ellipsis (AC1)

**File:** `tests/e2e/epg-schedule-panel.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `truncate` Tailwind class to program title element
- [ ] Verify CSS: `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`
- [ ] Test with long title (80+ characters) to ensure truncation works
- [ ] Ensure title container has `flex-1` to take available space
- [ ] Run test: `npm run test:e2e -- epg-schedule-panel.spec.ts -g "should handle long program titles"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: should reset scroll when channel changes (AC3)

**File:** `tests/e2e/epg-schedule-panel.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `useEffect` hook that watches `selectedChannelId`
- [ ] When channel changes, reset scroll to current program
- [ ] Reuse auto-scroll logic from initial load
- [ ] Ensure smooth transition when switching channels
- [ ] Handle case when new channel has no NOW program
- [ ] Run test: `npm run test:e2e -- epg-schedule-panel.spec.ts -g "should reset scroll when channel changes"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

## Running Tests

```bash
# Run all failing tests for this story
npm run test:e2e -- epg-schedule-panel.spec.ts

# Run specific test file with headed mode (see browser)
npm run test:e2e -- epg-schedule-panel.spec.ts --headed

# Debug specific test
npm run test:e2e -- epg-schedule-panel.spec.ts --debug -g "should display schedule panel"

# Run with coverage
npm run test:e2e -- epg-schedule-panel.spec.ts --coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All tests written and failing (13 E2E tests)
- ✅ Fixtures and factories created with auto-cleanup
- ✅ Mock requirements documented (Tauri commands)
- ✅ data-testid requirements listed (15 test IDs)
- ✅ Implementation checklist created with clear tasks

**Verification:**

- All tests run and fail as expected
- Failure messages are clear: "EpgSchedulePanel component not yet implemented"
- Tests fail due to missing components, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (start with "should display schedule panel")
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
4. **Optimize performance** (if needed - schedule typically <50 programs)
5. **Ensure tests still pass** after each refactor
6. **Update documentation** (if component API changes)

**Key Principles:**

- Tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if tests fail)
- Run tests after each change
- Don't change test behavior (only implementation)

**Completion:**

- All tests pass (13/13 green)
- Code quality meets team standards
- No duplications or code smells
- Ready for code review and story approval

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow (manual handoff)
2. **Review this checklist** with team in standup or planning
3. **Run failing tests** to confirm RED phase: `npm run test:e2e -- epg-schedule-panel.spec.ts`
4. **Begin implementation** using implementation checklist as guide
5. **Work one test at a time** (red → green for each)
6. **Share progress** in daily standup
7. **When all tests pass**, refactor code for quality
8. **When refactoring complete**, manually update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **fixture-architecture.md** - Test fixture patterns with setup/teardown and auto-cleanup
- **data-factories.md** - Factory patterns using faker for random test data with overrides
- **test-quality.md** - Test design principles (Given-When-Then, deterministic, isolated)
- **network-first.md** - Deterministic waiting patterns (not HTTP - Tauri IPC used)
- **selector-resilience.md** - data-testid selector hierarchy (testid > ARIA > text > CSS)
- **test-healing-patterns.md** - Common failure patterns and prevention strategies
- **timing-debugging.md** - Race condition prevention (waitForTimeout usage minimal)

See `_bmad/bmm/testarch/tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npm run test:e2e -- epg-schedule-panel.spec.ts`

**Expected Results:**

All 13 tests should fail with clear error messages:
- "locator.getByTestId('epg-schedule-panel') not found" (component doesn't exist yet)
- "locator.getByTestId('schedule-header') not found" (header component doesn't exist)
- "locator.getByTestId('schedule-row-*') not found" (row components don't exist)

**Summary:**

- Total tests: 13
- Passing: 0 (expected)
- Failing: 13 (expected)
- Status: ✅ RED phase verified

**Expected Failure Messages:**

1. "should display schedule panel with date header and program list" → Component not found
2. "should display NOW indicator for currently-airing program" → Component not found
3. "should display past programs with muted styling" → Component not found
4. "should auto-scroll to current program on initial load" → Component not found
5. "should select program and update state on click" → Component not found
6. "should support keyboard navigation within schedule" → Component not found
7. "should maintain independent scrolling from channel list" → Component not found
8. "should display empty state when no channel selected" → Component not found
9. "should display empty state when channel has no programs" → Component not found
10. "should show loading skeleton while schedule loads" → Component not found
11. "should apply hover state to program rows" → Component not found
12. "should handle long program titles with ellipsis" → Component not found
13. "should reset scroll when channel changes" → Component not found

---

## Notes

**Architecture Compliance:**
- Story builds on Story 5.4 (three-panel layout) and Story 5.5 (channel list panel)
- Replaces `EpgSchedulePanelPlaceholder` with functional `EpgSchedulePanel` component
- Integrates with existing `useEpgGridData` patterns for time window management
- Uses existing Tauri commands for data fetching (no new backend work needed)

**Performance Considerations:**
- Schedule typically <50 programs per channel (no virtualization needed)
- Auto-refresh every 60 seconds (match Story 5.5 pattern)
- Smooth scrolling with `scroll-behavior: smooth`
- Skeleton loading for polished UX

**Edge Cases Covered:**
- No channel selected (empty state)
- Channel with no programs (different empty state)
- All programs in past (no NOW indicator)
- Long program titles (truncate with ellipsis)
- Channel switching (reset scroll position)
- Keyboard navigation (accessibility)

**Integration Points:**
- `EpgTv.tsx` - View that manages selectedChannelId and selectedProgramId state
- `useChannelSchedule` hook - Fetches programs for selected channel
- `EpgDetailsPanelPlaceholder` - Will receive selectedProgramId in Story 5.8

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Tag @TEA-Agent in Slack/Discord
- Refer to `_bmad/bmm/docs/tea-README.md` for workflow documentation
- Consult `_bmad/bmm/testarch/knowledge` for testing best practices

---

**Generated by BMad TEA Agent** - 2026-01-22
