# Story 5.6: EPG Schedule Panel

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see the full schedule for my selected channel,
So that I can browse what's coming up on that channel.

## Acceptance Criteria

1. **Given** a channel is selected **When** the center panel loads **Then** I see a schedule list with:
   - Date header (e.g., "TUE 21 Jan")
   - Time column (~80px, gray)
   - Program titles (white, ellipsis on overflow)

2. **Given** the schedule list **When** I click a program **Then** that program is highlighted (left accent bar, brighter bg) **And** the right panel shows program details

3. **Given** the current time **When** viewing the schedule **Then** the "NOW" program is indicated distinctly **And** past programs show muted styling **And** schedule auto-scrolls to current time

4. **Given** the schedule panel **When** scrolling through programs **Then** scrolling is independent of channel list **And** UI remains responsive

## Tasks / Subtasks

- [ ] Task 1: Create EpgSchedulePanel component structure (AC: #1, #4)
  - [ ] 1.1 Create `src/components/epg/tv-style/EpgSchedulePanel.tsx`
  - [ ] 1.2 Accept `selectedChannelId` and `onSelectProgram` props
  - [ ] 1.3 Add semi-transparent dark background `bg-black/50` with `rounded-lg`
  - [ ] 1.4 Implement independent vertical scroll with `overflow-y-auto`
  - [ ] 1.5 Add `data-testid="epg-schedule-panel"` to container

- [ ] Task 2: Create ScheduleHeader component (AC: #1)
  - [ ] 2.1 Create `src/components/epg/tv-style/ScheduleHeader.tsx`
  - [ ] 2.2 Display date in format "DAY DD Mon" (e.g., "TUE 21 Jan")
  - [ ] 2.3 Style: bold, white, 16px, center-aligned, padding 16px vertical
  - [ ] 2.4 Add `data-testid="schedule-header"` for testing

- [ ] Task 3: Create ScheduleRow component (AC: #1, #2, #3)
  - [ ] 3.1 Create `src/components/epg/tv-style/ScheduleRow.tsx`
  - [ ] 3.2 Implement two-column layout: time (~80px, fixed) + title (flex-grow)
  - [ ] 3.3 Time format: "HH:MM AM/PM" in light gray (#a0a0a0)
  - [ ] 3.4 Program title: white, 14px, single line with ellipsis on overflow
  - [ ] 3.5 Row hover state: subtle highlight `rgba(255,255,255,0.05)`
  - [ ] 3.6 Selected state: brighter background + left purple accent bar (4px, #6366f1)
  - [ ] 3.7 "NOW" indicator: distinct badge or styling for currently-airing program
  - [ ] 3.8 Past programs: muted styling (reduced opacity or grayed text)
  - [ ] 3.9 Add `data-testid="schedule-row-{programId}"` for each row

- [ ] Task 4: Implement program selection state (AC: #2)
  - [ ] 4.1 Accept `selectedProgramId` and `onSelectProgram` props in EpgSchedulePanel
  - [ ] 4.2 Apply selected styling when program matches `selectedProgramId`
  - [ ] 4.3 Emit selection event when schedule row is clicked
  - [ ] 4.4 Add `aria-selected` attribute for accessibility
  - [ ] 4.5 Support keyboard navigation (up/down arrows within schedule)

- [ ] Task 5: Create useChannelSchedule hook (AC: #1, #3)
  - [ ] 5.1 Create `src/hooks/useChannelSchedule.ts`
  - [ ] 5.2 Fetch programs for selected channel using existing `getEnabledChannelsWithPrograms` Tauri command
  - [ ] 5.3 Filter to get only the selected channel's programs
  - [ ] 5.4 Time window: Start of day (6 AM) to end of day (or 24 hours from now)
  - [ ] 5.5 Provide loading and error states
  - [ ] 5.6 Implement helper to determine if program is NOW, PAST, or FUTURE
  - [ ] 5.7 Sort programs by start time ascending

- [ ] Task 6: Implement auto-scroll to current program (AC: #3)
  - [ ] 6.1 Use `useRef` to track schedule container and current program element
  - [ ] 6.2 On initial load, scroll to bring "NOW" program into view
  - [ ] 6.3 When channel changes, reset scroll position to current program
  - [ ] 6.4 Ensure scroll behavior is smooth (`scroll-behavior: smooth`)

- [ ] Task 7: Handle empty/loading states (AC: #1)
  - [ ] 7.1 No channel selected: Display "Select a channel to see schedule" message
  - [ ] 7.2 Loading state: Show skeleton UI matching schedule row layout
  - [ ] 7.3 No programs found: Display "No schedule data available" message
  - [ ] 7.4 Error state: Display user-friendly error message per architecture.md

- [ ] Task 8: Integrate into EpgTv view (AC: #1, #2)
  - [ ] 8.1 Replace `EpgSchedulePanelPlaceholder` with `EpgSchedulePanel` in `EpgTv.tsx`
  - [ ] 8.2 Pass `selectedChannelId` from view state to schedule panel
  - [ ] 8.3 Add `selectedProgramId` state to `EpgTv.tsx`
  - [ ] 8.4 Wire `onSelectProgram` callback to update selected program state
  - [ ] 8.5 Pass selected program to details panel (for Story 5.8 integration)

- [ ] Task 9: Update component exports (AC: #1)
  - [ ] 9.1 Add exports to `src/components/epg/tv-style/index.ts`
  - [ ] 9.2 Ensure TypeScript compilation succeeds
  - [ ] 9.3 Ensure Vite build succeeds

- [ ] Task 10: Add unit/integration tests
  - [ ] 10.1 Test schedule panel renders with mock channel data (E2E in ATDD phase)
  - [ ] 10.2 Test program selection updates state
  - [ ] 10.3 Test NOW/PAST/FUTURE styling applied correctly
  - [ ] 10.4 Test auto-scroll to current program
  - [ ] 10.5 Test empty state when no channel selected
  - [ ] 10.6 Test keyboard navigation within schedule

## Dev Notes

### Architecture Compliance

This story implements the center panel of the TV-style EPG layout (Story 5.4 foundation). It fulfills **FR39** (User can browse EPG data) and **FR42** (User can navigate EPG by time) per the course correction for TV-style EPG redesign (2026-01-22).

**CRITICAL - Build on Story 5.4/5.5 Foundation:**
- Story 5.4 created the three-panel layout in `src/components/epg/tv-style/`
- Story 5.5 implemented `EpgChannelList` with channel selection state
- This story REPLACES `EpgSchedulePanelPlaceholder` with functional `EpgSchedulePanel`
- The `EpgTv.tsx` view already has `selectedChannelId` state ready to consume
- The right panel (`EpgDetailsPanelPlaceholder`) remains unchanged until Story 5.8

### Visual Design Requirements

From `ux-epg-tv-guide.md` Center Panel section:

**Schedule Panel Layout:**
```
┌─────────────────────────────────┐
│         TUE 21 Jan              │  ← Date header (bold, centered)
├─────────────────────────────────┤
│  6:00 AM    Morning News        │  ← Past (muted)
│  7:00 AM    Breakfast Show      │  ← Past (muted)
│  8:00 AM    Talk Time      NOW  │  ← Current (highlighted)
│  9:00 AM    Movie: Action...    │  ← Future
│  11:30 AM   Sports Roundup      │  ← Future
│  ...                            │
└─────────────────────────────────┘
```

**Color Specifications:**
| Element | Color |
|---------|-------|
| Panel background | `rgba(0, 0, 0, 0.5)` / `bg-black/50` |
| Date header | `#ffffff` (bold, 16px) |
| Time column | `#a0a0a0` (light gray, 14px) |
| Program title | `#ffffff` (14px) |
| Row hover | `rgba(255,255,255,0.05)` |
| Selected row accent | `#6366f1` (purple left bar) |
| Selected row background | `rgba(99,102,241,0.2)` |
| NOW badge | `#22c55e` (green) |
| Past program text | `#6b7280` (muted gray) |

**Sizing:**
- Time column width: ~80px fixed
- Row height: ~40px minimum (allow multi-line for long titles)
- Panel padding: 16px
- Row padding: 8px vertical, 12px horizontal

### Component Hierarchy

```
EpgTv.tsx (view)
├── EpgBackground
├── EpgMainContent
│   ├── EpgChannelList (Story 5.5 - done)
│   │   └── EpgChannelRow (repeated, virtualized)
│   │
│   ├── EpgSchedulePanel (THIS STORY)
│   │   ├── ScheduleHeader (date display)
│   │   └── ScheduleRow (repeated)
│   │       ├── Time column
│   │       ├── Program title
│   │       └── NOW badge (conditional)
│   │
│   └── EpgDetailsPanelPlaceholder (Story 5.8)
```

### Existing Code to Use

**EpgTv.tsx State (from Story 5.5):**
```typescript
// Already exists in EpgTv.tsx:
const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);

// Need to add for this story:
const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
```

**Tauri Commands (from `src/lib/tauri.ts`):**
```typescript
// Reuse the same command as Story 5.5
export async function getEnabledChannelsWithPrograms(
  startTime: string,
  endTime: string
): Promise<EpgGridChannel[]>;

// Types to use:
interface EpgGridProgram {
  id: number;
  title: string;
  startTime: string;  // ISO 8601
  endTime: string;    // ISO 8601
  category?: string;
  description?: string;
  episodeInfo?: string;
}

interface EpgGridChannel {
  channelId: number;
  channelName: string;
  channelIcon?: string;
  plexDisplayOrder: number;
  programs: EpgGridProgram[];
}
```

**Existing Hooks to Reference:**
- `useEpgChannelList.ts` - Pattern for data fetching, loading/error states, auto-refresh
- `useEpgGridData.ts` - Time window helpers: `getCurrentTimeWindow()`, `getTodayTimeWindow()`

### Time Utility Functions

Create or use existing time helpers:

```typescript
// Determine program status relative to current time
function getProgramStatus(program: EpgGridProgram): 'NOW' | 'PAST' | 'FUTURE' {
  const now = new Date();
  const start = new Date(program.startTime);
  const end = new Date(program.endTime);

  if (now >= start && now < end) return 'NOW';
  if (now >= end) return 'PAST';
  return 'FUTURE';
}

// Format time for display (e.g., "8:00 AM")
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Format date for header (e.g., "TUE 21 Jan")
function formatDateHeader(date: Date): string {
  const day = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dayNum = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  return `${day} ${dayNum} ${month}`;
}
```

### Previous Story Learnings (Story 5.5)

From Story 5.5 code review:
1. **Race conditions:** Use `isFetchingRef` and `isMountedRef` to prevent memory leaks and race conditions
2. **Skeleton loading:** Use skeleton UI that matches actual content layout for polished experience
3. **Error messages:** User-friendly messages per architecture.md Error Handling Strategy
4. **Accessibility:** Include `aria-selected`, `aria-activedescendant`, proper roles
5. **Constants:** Extract magic numbers (`REFRESH_INTERVAL_MS`, `ROW_HEIGHT_PX`)
6. **Tailwind over inline:** Use Tailwind classes like `bg-black/50` not inline styles

### Git Context (Recent Commits)

From recent commits on `feature/epic-5`:
- `c6c2233` - Code review fixes for Story 5.5 EPG channel list panel
- `fd2bc96` - Implement Story 5.5 EPG channel list panel
- Pattern: Follow the same component structure in `src/components/epg/tv-style/`

### Edge Cases to Handle

1. **No channel selected** - Display centered message: "Select a channel to see schedule"
2. **Channel selected but no programs** - Display: "No schedule data available for this channel"
3. **Long program titles** - Truncate with ellipsis (single line)
4. **Programs spanning midnight** - Handle date boundary gracefully
5. **All programs in past** - Show full schedule with muted styling, no "NOW"
6. **Loading state** - Skeleton rows matching schedule row layout
7. **Channel changes rapidly** - Cancel previous fetch, show loading for new channel

### What NOT to Do in This Story

- Do NOT implement the program details panel (Story 5.8)
- Do NOT implement day navigation (Story 5.7 - top bar with day chips)
- Do NOT implement search functionality (Story 5.7)
- Do NOT add virtualization (list is typically <50 items, not needed)
- Do NOT modify the EpgMainContent layout proportions
- Do NOT change EpgChannelList behavior

### Testing Considerations

- Add `data-testid="epg-schedule-panel"` to panel container
- Add `data-testid="schedule-header"` to date header
- Add `data-testid="schedule-row-{programId}"` to each row
- Add `data-testid="now-indicator"` to NOW badge
- Test: Schedule renders when channel is selected
- Test: Empty state when no channel selected
- Test: Program selection triggers callback
- Test: NOW program has distinct styling
- Test: Past programs have muted styling
- Test: Auto-scroll brings NOW into view
- Test: Keyboard navigation (up/down) works within schedule

### Performance Requirements

- Schedule load: <200ms after channel selection
- Scroll performance: 60fps maintained
- Memory: Minimal - schedule typically <50 programs per channel
- No virtualization needed (unlike channel list with 500+ items)

### References

- [Source: _bmad-output/planning-artifacts/ux-epg-tv-guide.md#Layer-3-Center-Panel-Schedule-List]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.6-EPG-Schedule-Panel]
- [Source: _bmad-output/implementation-artifacts/5-5-epg-channel-list-panel.md - Previous story patterns]
- [Source: src/components/epg/tv-style/EpgSchedulePanelPlaceholder.tsx - Component to replace]
- [Source: src/views/EpgTv.tsx - View integration point]
- [Source: src/lib/tauri.ts#getEnabledChannelsWithPrograms - Data fetching]
- [Source: src/hooks/useEpgChannelList.ts - Hook pattern reference]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
