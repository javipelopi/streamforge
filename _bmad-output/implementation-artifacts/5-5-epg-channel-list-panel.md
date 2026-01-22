# Story 5.5: EPG Channel List Panel

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want a vertical channel list showing what's currently playing,
So that I can quickly see all my channels and their current programs.

## Acceptance Criteria

1. **Given** the EPG left panel **When** it loads **Then** I see a virtualized list of enabled XMLTV channels **And** each row shows:
   - Channel logo (80×60px)
   - Channel name (bold, white)
   - Current program time range
   - Current program title
   - Progress bar showing time elapsed

2. **Given** the channel list **When** I select a channel (click or keyboard) **Then** the row shows selected state (pill highlight, purple tint) **And** the center panel updates to show that channel's schedule

3. **Given** a large channel list **When** scrolling **Then** UI remains responsive (<100ms) **And** TanStack Virtual handles efficient rendering

## Tasks / Subtasks

- [x] Task 1: Create EpgChannelList component structure (AC: #1, #3)
  - [x] 1.1 Create `src/components/epg/tv-style/EpgChannelList.tsx`
  - [x] 1.2 Integrate TanStack Virtual (`useVirtualizer`) for efficient list rendering
  - [x] 1.3 Calculate row heights for consistent virtualization (estimated 96px per row)
  - [x] 1.4 Add `data-testid="epg-channel-list"` to container
  - [x] 1.5 Add proper scrolling container with `overflow-y-auto`

- [x] Task 2: Create EpgChannelRow component (AC: #1, #2)
  - [x] 2.1 Create `src/components/epg/tv-style/EpgChannelRow.tsx`
  - [x] 2.2 Implement channel logo display (80×60px, object-fit: contain, rounded corners 4px)
  - [x] 2.3 Display channel name (bold, white, 14-16px)
  - [x] 2.4 Display current program time range (lighter gray #a0a0a0)
  - [x] 2.5 Display current program title (white, 14px, single line with ellipsis)
  - [x] 2.6 Add `data-testid="channel-row-{id}"` for each row

- [x] Task 3: Create EpgProgressBar component (AC: #1)
  - [x] 3.1 Create `src/components/epg/tv-style/EpgProgressBar.tsx`
  - [x] 3.2 Implement progress calculation based on start/end time vs current time
  - [x] 3.3 Style: height 3px, bg `rgba(255,255,255,0.2)`, fill gradient (#6366f1 to #22d3ee)
  - [x] 3.4 Add rounded ends
  - [x] 3.5 Add `data-testid="progress-bar"` for testing

- [x] Task 4: Implement channel selection state (AC: #2)
  - [x] 4.1 Accept `selectedChannelId` and `onSelectChannel` props in EpgChannelList
  - [x] 4.2 Apply selected state styling: border `rgba(255,255,255,0.3)`, bg `rgba(99,102,241,0.2)`, border-radius 12px
  - [x] 4.3 Emit selection event when channel row is clicked
  - [x] 4.4 Support keyboard navigation (up/down arrows) - stretch goal
  - [x] 4.5 Add `aria-selected` attribute for accessibility

- [x] Task 5: Create custom hook for channel list data (AC: #1)
  - [x] 5.1 Create `src/hooks/useEpgChannelList.ts`
  - [x] 5.2 Fetch enabled channels using existing `getEnabledChannelsWithPrograms` Tauri command
  - [x] 5.3 Filter to get only the current program for each channel (based on current time)
  - [x] 5.4 Provide loading and error states
  - [x] 5.5 Add auto-refresh interval (every 60 seconds to update progress bars)

- [x] Task 6: Integrate into EpgTv view (AC: #1, #2)
  - [x] 6.1 Replace `EpgChannelListPlaceholder` with `EpgChannelList` in `EpgTv.tsx`
  - [x] 6.2 Add `selectedChannelId` state to `EpgTv.tsx`
  - [x] 6.3 Wire `onSelectChannel` callback to update selected channel state
  - [x] 6.4 Pass selected channel ID to center panel (for Story 5.6 integration)
  - [x] 6.5 Remove temporary toggle button (no longer needed)

- [x] Task 7: Update component exports (AC: #1)
  - [x] 7.1 Add exports to `src/components/epg/tv-style/index.ts`
  - [x] 7.2 Ensure TypeScript compilation succeeds
  - [x] 7.3 Ensure Vite build succeeds

- [x] Task 8: Add unit/integration tests
  - [x] 8.1 Test channel list renders with mock data (E2E tests created in ATDD phase)
  - [x] 8.2 Test channel selection updates state (E2E tests created in ATDD phase)
  - [x] 8.3 Test progress bar calculation accuracy (E2E tests created in ATDD phase)
  - [x] 8.4 Test virtualization with large channel count (500+ channels) (E2E tests created in ATDD phase)

## Dev Notes

### Architecture Compliance

This story implements the left panel of the TV-style EPG layout (Story 5.4 foundation). It fulfills **FR39** (User can browse EPG data) per the course correction for TV-style EPG redesign (2026-01-22).

**CRITICAL - Build on Story 5.4 Foundation:**
- Story 5.4 created placeholder components in `src/components/epg/tv-style/`
- This story REPLACES `EpgChannelListPlaceholder` with functional `EpgChannelList`
- The three-panel layout container (`EpgMainContent`) remains unchanged
- The gradient background (`EpgBackground`) remains unchanged

### Visual Design Requirements

From `ux-epg-tv-guide.md`:

**Channel Row Layout:**
```
┌─────────────────────────────────────────────────┐
│  ┌────────┐                                     │
│  │  LOGO  │   Channel Name  HH:MM - HH:MM AM    │
│  │  80×60 │   Program Title                     │
│  │        │   ══════════════════────── (progress)│
│  └────────┘                                     │
└─────────────────────────────────────────────────┘
```

**Color Specifications:**
| Element | Color |
|---------|-------|
| Channel name | `#ffffff` (bold) |
| Time range | `#a0a0a0` (light gray) |
| Program title | `#ffffff` |
| Progress bar background | `rgba(255,255,255,0.2)` |
| Progress bar fill start | `#6366f1` (purple) |
| Progress bar fill end | `#22d3ee` (cyan) |
| Selected row border | `rgba(255,255,255,0.3)` |
| Selected row background | `rgba(99,102,241,0.2)` |

**Row Spacing:**
- Gap between rows: 8px
- Padding inside row: 12px vertical, 16px horizontal
- Logo container: 80×60px

### Component Hierarchy

```
EpgTv.tsx (view)
├── EpgBackground
├── EpgMainContent
│   ├── EpgChannelList (THIS STORY)
│   │   └── EpgChannelRow (repeated, virtualized)
│   │       ├── Channel Logo
│   │       ├── Channel Info (name, time, title)
│   │       └── EpgProgressBar
│   │
│   ├── EpgSchedulePanelPlaceholder (Story 5.6)
│   └── EpgDetailsPanelPlaceholder (Story 5.8)
```

### Existing Code to Use

**Tauri Commands (from `src/lib/tauri.ts`):**
- `getEnabledChannelsWithPrograms(startTime, endTime)` - Returns `EpgGridChannel[]` with programs
- `getTargetLineupChannels()` - Returns enabled channels for lineup (alternative if simpler data needed)

**Types (from `src/lib/tauri.ts`):**
```typescript
interface EpgGridChannel {
  channelId: number;
  channelName: string;
  channelIcon?: string;
  plexDisplayOrder: number;
  programs: EpgGridProgram[];
}

interface EpgGridProgram {
  id: number;
  title: string;
  startTime: string;  // ISO 8601
  endTime: string;    // ISO 8601
  category?: string;
  description?: string;
  episodeInfo?: string;
}
```

**Existing Hooks:**
- `useEpgGridData.ts` - Has helpers like `isProgramCurrentlyAiring()`, `getCurrentTimeWindow()`
- These can be adapted or imported for use

### TanStack Virtual Integration

Use `@tanstack/react-virtual` for virtualization:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: channels.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 96, // Estimated row height in pixels
  overscan: 5, // Render 5 extra items above/below viewport
});
```

### Progress Bar Calculation

```typescript
function calculateProgress(startTime: string, endTime: string): number {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (now < start) return 0; // Program hasn't started
  if (now > end) return 100; // Program has ended

  const elapsed = now.getTime() - start.getTime();
  const duration = end.getTime() - start.getTime();
  return (elapsed / duration) * 100;
}
```

### Previous Story Learnings (Story 5.4)

From Story 5.4 code review:
1. **Tailwind over inline styles:** Use Tailwind classes like `bg-black/60` instead of inline `style` props
2. **Type safety:** Use proper TypeScript types (not `unknown`)
3. **Accessibility:** Add `aria-label`, `aria-selected` attributes
4. **Testing:** Add `data-testid` attributes to all significant elements
5. **Navigation:** Story 5.4 added EPG TV to nav items - no nav changes needed here

### Git Context (Recent Commits)

From recent commits:
- `86b7b0b` - Code review fixes for Story 5.4 EPG TV-style layout foundation
- `5b938a3` - Implement Story 5.4 EPG TV-style layout foundation
- Pattern: Follow the same component structure established in `src/components/epg/tv-style/`

### Edge Cases to Handle

1. **No enabled channels** - Display empty state message: "No channels in lineup. Add channels from Sources."
2. **Channel without current program** - Display "No program info available" with muted styling
3. **Long channel names** - Truncate with ellipsis
4. **Long program titles** - Truncate with ellipsis (single line)
5. **Missing channel logo** - Use placeholder icon or first letter of channel name
6. **Progress at 100%** - Program just ended, show full bar until data refresh

### What NOT to Do in This Story

- Do NOT implement schedule panel updates (Story 5.6)
- Do NOT implement program details panel (Story 5.8)
- Do NOT implement keyboard navigation beyond basic focus (future enhancement)
- Do NOT implement responsive mobile layout (future scope)
- Do NOT modify the EpgMainContent layout proportions

### Testing Considerations

- Add `data-testid="epg-channel-list"` to list container
- Add `data-testid="channel-row-{channelId}"` to each row
- Add `data-testid="progress-bar"` to progress bar component
- Test: Channel list renders all enabled channels
- Test: Clicking a channel triggers selection callback
- Test: Selected channel has correct visual styling
- Test: Progress bar width matches elapsed time percentage
- Test: Virtualization works with 500+ channels (no performance degradation)

### Performance Requirements

- Initial render: <500ms for 500 enabled channels
- Scroll performance: 60fps maintained during rapid scrolling
- Memory: Virtualization should keep DOM nodes minimal (visible + overscan only)
- Progress updates: Every 60 seconds to keep bars current without excessive re-renders

### References

- [Source: _bmad-output/planning-artifacts/ux-epg-tv-guide.md#Left-Panel-Channel-List-with-Now-Playing]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.5-EPG-Channel-List-Panel]
- [Source: _bmad-output/implementation-artifacts/5-4-epg-tv-style-layout-foundation.md - Previous story patterns]
- [Source: src/components/epg/tv-style/EpgChannelListPlaceholder.tsx - Component to replace]
- [Source: src/lib/tauri.ts#getEnabledChannelsWithPrograms - Data fetching]
- [Source: src/hooks/useEpgGridData.ts - Existing EPG data utilities]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without issues.

### Completion Notes List

1. **EpgChannelList Component**: Created virtualized channel list using TanStack Virtual with 96px estimated row height, 5 item overscan, keyboard navigation (up/down arrows), and proper accessibility attributes (role="listbox", aria-selected, aria-activedescendant). Includes skeleton loading state and user-friendly error messages.

2. **EpgChannelRow Component**: Implemented channel row with 80x60px logo container (with first-letter fallback for missing logos), bold white channel name, gray time range, white program title with truncation, and selected state styling with purple tint border/background.

3. **EpgProgressBar Component**: Created progress bar with 3px height, semi-transparent white background, and purple-to-cyan gradient fill. Uses CSS linear-gradient for the fill effect.

4. **useEpgChannelList Hook**: Custom hook that fetches enabled channels with programs, filters to current program only, sorts by plexDisplayOrder, provides loading/error states, and auto-refreshes every 60 seconds. Includes race condition protection (isFetchingRef) and memory leak prevention (isMountedRef).

5. **EpgTv Integration**: Replaced placeholder with functional channel list, added selectedChannelId state, wired onSelectChannel callback, removed temporary toggle button.

6. **Edge Cases Handled**:
   - Empty channel list displays helpful message with icon
   - Channels without current program show "No program info available"
   - Missing logos show first letter of channel name
   - Long names truncate with ellipsis
   - Loading state shows skeleton UI matching channel row layout
   - Error state shows user-friendly messages per architecture.md Error Handling Strategy

7. **E2E Tests**: 10 E2E tests were created during ATDD RED phase. Tests verify channel list display, progress bar accuracy, selection state, keyboard navigation, virtualization performance, empty state, missing program handling, truncation, missing logo handling, and auto-refresh.

8. **Code Review Fixes (2026-01-22)**: Applied fixes for 7 HIGH and 2 MEDIUM issues found during adversarial code review:
   - Fixed hook dependency array and race conditions in useEpgChannelList (added isFetchingRef, isMountedRef)
   - Fixed ARIA accessibility violations (added aria-activedescendant, focus ring)
   - Fixed virtualization positioning bug on fast scroll (added bounds checking)
   - Enhanced error messages to be user-friendly per architecture.md
   - Added skeleton loading UI for polished TV-style experience
   - Extracted magic numbers to constants (ONE_HOUR_MS, REFRESH_INTERVAL_MS)
   - All fixes verified with successful build (npm run build)

### File List

**New Files:**
- src/components/epg/tv-style/EpgChannelList.tsx
- src/components/epg/tv-style/EpgChannelRow.tsx
- src/components/epg/tv-style/EpgProgressBar.tsx
- src/hooks/useEpgChannelList.ts

**Modified Files:**
- src/views/EpgTv.tsx (replaced placeholder, added state)
- src/components/epg/tv-style/index.ts (added exports)

### Change Log

- 2026-01-22: Story 5.5 implementation complete - EPG Channel List Panel with virtualized list, current program display, selection state, keyboard navigation, and auto-refresh
- 2026-01-22: Code review fixes applied - Fixed 7 HIGH and 2 MEDIUM issues (race conditions, accessibility, error handling, loading UX)

