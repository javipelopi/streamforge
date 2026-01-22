# Story 5.8: EPG Program Details Panel

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see detailed program information in a right panel,
So that I can learn more about selected programs.

## Acceptance Criteria

1. **Given** a program is selected from the schedule **When** the right panel appears **Then** I see:
   - Program title (28-32px, bold, white)
   - Episode info (if applicable)
   - Channel logo + name + status (Live Now / Starts at X)
   - Time range with clock icon
   - Full date with calendar icon
   - Category/genre tags
   - Description (14-16px, light gray, scrollable)

2. **Given** no program is selected **When** viewing the EPG **Then** the right panel is hidden or shows "Select a program to see details"

3. **Given** the details panel is visible **When** I click outside or press Escape **Then** the panel closes and selection clears

## Tasks / Subtasks

- [x] Task 1: Create EpgProgramDetails component structure (AC: #1)
  - [x] 1.1 Create `src/components/epg/tv-style/EpgProgramDetails.tsx`
  - [x] 1.2 Right panel dimensions: ~40% viewport width, full height below top bar
  - [x] 1.3 Semi-transparent dark background `rgba(0,0,0,0.5)` / `bg-black/50`
  - [x] 1.4 Padding: 32px (p-8 in Tailwind)
  - [x] 1.5 Add `data-testid="epg-program-details"` to container

- [x] Task 2: Implement program header section (AC: #1)
  - [x] 2.1 Program title: bold, 28-32px (`text-2xl md:text-3xl font-bold`), white, max 2 lines with ellipsis
  - [x] 2.2 Episode info section (if available): 16px (`text-base`), gray (`text-white/60`)
  - [x] 2.3 Format episode info: "Season X, Episode Y" or "S0XE0Y" format
  - [x] 2.4 Add `data-testid="program-title"` and `data-testid="episode-info"`

- [x] Task 3: Implement channel badge section (AC: #1)
  - [x] 3.1 Channel logo: 48x36px, rounded corners
  - [x] 3.2 Channel name: bold, 16px (`text-base font-bold`), white
  - [x] 3.3 Status indicator: "Live Now" (green), "Starts in X min" (blue), or "Aired at X" (gray)
  - [x] 3.4 Status colors: Live=#22c55e, Upcoming=#3b82f6, Aired=#6b7280
  - [x] 3.5 Add `data-testid="channel-badge"` and `data-testid="program-status"`

- [x] Task 4: Implement program metadata section (AC: #1)
  - [x] 4.1 Time range with clock icon (Lucide `Clock` icon), 14px, white
  - [x] 4.2 Full date with calendar icon (Lucide `Calendar` icon), 14px, gray
  - [x] 4.3 Category/genre tags as small rounded chips with muted colors
  - [x] 4.4 Divider lines between sections (border-white/10)
  - [x] 4.5 Add `data-testid="program-time"`, `data-testid="program-date"`, `data-testid="program-categories"`

- [x] Task 5: Implement program description section (AC: #1)
  - [x] 5.1 Description text: 14-16px (`text-sm md:text-base`), light gray (`text-white/70`)
  - [x] 5.2 Line height: 1.5 (`leading-relaxed`)
  - [x] 5.3 Scrollable if content exceeds available space (`overflow-y-auto`)
  - [x] 5.4 Handle missing description gracefully ("No description available")
  - [x] 5.5 Add `data-testid="program-description"`

- [x] Task 6: Implement empty state (AC: #2)
  - [x] 6.1 When `selectedProgramId` is null, show empty state
  - [x] 6.2 Empty state message: "Select a program to see details"
  - [x] 6.3 Subtle styling: centered text, muted color
  - [x] 6.4 Alternative: hide panel entirely when no selection (defer to EpgMainContent layout)
  - [x] 6.5 Add `data-testid="details-empty-state"`

- [x] Task 7: Create useProgramDetails hook (AC: #1, #2)
  - [x] 7.1 Create `src/hooks/useProgramDetails.ts`
  - [x] 7.2 Accept `programId: number | null` parameter
  - [x] 7.3 Fetch program details from backend when programId changes
  - [x] 7.4 Return: `{ program, channel, isLoading, error }`
  - [x] 7.5 Handle null programId (return null program)
  - [x] 7.6 Use existing `Program` and `XmltvChannel` types from `src/lib/tauri.ts`

- [x] Task 8: Add Tauri command for program details (AC: #1)
  - [x] 8.1 Add `get_program_by_id` command to `src-tauri/src/commands/epg.rs`
  - [x] 8.2 Return program with associated channel information
  - [x] 8.3 Add TypeScript binding in `src/lib/tauri.ts`
  - [x] 8.4 Type: `getProgramById(programId: number): Promise<ProgramWithChannel | null>`
  - [x] 8.5 Register command in `main.rs`

- [x] Task 9: Implement close/deselect behavior (AC: #3)
  - [x] 9.1 Handle Escape key to clear selection (dispatch to EpgTv view)
  - [x] 9.2 Optional: Add close (X) button in top-right corner
  - [x] 9.3 Click outside panel clears selection (handled at EpgTv view level)
  - [x] 9.4 Add `data-testid="details-close-button"` if close button added

- [x] Task 10: Replace placeholder in EpgTv view (AC: #1, #2, #3)
  - [x] 10.1 Replace `EpgDetailsPanelPlaceholder` with `EpgProgramDetails`
  - [x] 10.2 Pass `selectedProgramId` and `onClose` callback
  - [x] 10.3 Wire Escape key handler to clear `selectedProgramId`
  - [x] 10.4 Update EpgMainContent if panel visibility logic changes

- [x] Task 11: Update component exports (AC: #1)
  - [x] 11.1 Add exports to `src/components/epg/tv-style/index.ts`
  - [x] 11.2 Add export to `src/hooks/index.ts` if exists
  - [x] 11.3 Ensure TypeScript compilation succeeds
  - [x] 11.4 Ensure Vite build succeeds

- [x] Task 12: Add unit/integration tests
  - [x] 12.1 Test details panel renders with all program fields (ATDD tests exist)
  - [x] 12.2 Test empty state when no program selected (ATDD tests exist)
  - [x] 12.3 Test status indicator logic (Live Now, Starts in, Aired) (ATDD tests exist)
  - [x] 12.4 Test Escape key closes panel (ATDD tests exist)
  - [x] 12.5 Test close button click (if implemented) (ATDD tests exist)
  - [x] 12.6 Test loading state while fetching program (implemented)
  - [x] 12.7 Test error handling for invalid program ID (implemented)

## Dev Notes

### Architecture Compliance

This story completes the right panel of the TV-style EPG layout (Story 5.4 foundation). It fulfills **FR41** (User can view program details: title, description, time, channel) per the course correction for TV-style EPG redesign (2026-01-22).

**CRITICAL - Build on Story 5.4/5.5/5.6/5.7 Foundation:**
- Story 5.4 created the three-panel layout in `src/components/epg/tv-style/`
- Story 5.5 implemented `EpgChannelList` with channel selection state
- Story 5.6 implemented `EpgSchedulePanel` with program selection state
- Story 5.7 implemented `EpgTopBar` with search and day navigation
- This story replaces `EpgDetailsPanelPlaceholder` with the actual details panel

### Visual Design Requirements

From `ux-epg-tv-guide.md` Right Panel section:

**Right Panel Layout:**
```
+----------------------------------------+
|                                        |
|  PROGRAM TITLE                         |  <- Bold, 28-32px, white
|  Season X, Episode Y (if applicable)   |  <- 16px, gray
|                                        |
|  +--------+                            |
|  | Channel|  Channel Name              |  <- Channel logo + name
|  |  Logo  |  Live Now / Starts at X    |  <- Status indicator
|  +--------+                            |
|                                        |
|  ----------------------------------------  <- Divider line
|                                        |
|  [Clock] 10:00 AM - 11:30 AM           |  <- Time range
|  [Cal]   Tuesday, April 11             |  <- Full date
|  [Tags]  Drama, Action                 |  <- Category/genre tags
|                                        |
|  ----------------------------------------  |
|                                        |
|  Program description goes here. This   |  <- 14-16px, light gray
|  can be multiple lines and should      |     Max ~150 words, scrollable
|  wrap naturally within the panel.      |     if longer
|                                        |
+----------------------------------------+
```

**Color Specifications:**
| Element | Color |
|---------|-------|
| Panel background | `rgba(0, 0, 0, 0.5)` / `bg-black/50` |
| Panel width | ~40% of viewport |
| Panel padding | 32px (`p-8`) |
| Program title | `#ffffff` (white), 28-32px, bold |
| Episode info | `#a0a0a0` (gray), 16px |
| Channel name | `#ffffff`, 16px, bold |
| Status - Live Now | `#22c55e` (green) |
| Status - Upcoming | `#3b82f6` (blue) |
| Status - Aired | `#6b7280` (gray) |
| Time/Date icons | `#ffffff` / `#a0a0a0` |
| Description text | `#c0c0c0` (light gray), 14-16px |
| Category tags | Muted background colors |
| Divider lines | `rgba(255,255,255,0.1)` / `border-white/10` |

### Component Hierarchy

```
EpgTv.tsx (view)
├── EpgTopBar (Story 5.7)
├── EpgBackground
└── EpgMainContent
    ├── EpgChannelList (Story 5.5)
    ├── EpgSchedulePanel (Story 5.6)
    └── EpgProgramDetails (THIS STORY)
        ├── ProgramHeader (title, episode info)
        ├── ChannelBadge (logo, name, status)
        ├── ProgramMeta (time, date, categories)
        └── ProgramDescription (scrollable)
```

### Existing Code to Reuse

**EpgDetailsPanelPlaceholder (from `src/components/epg/tv-style/EpgDetailsPanelPlaceholder.tsx`):**
```typescript
// Current placeholder - REPLACE with real implementation
interface EpgDetailsPanelPlaceholderProps {
  isVisible: boolean;
}
```

**EpgTv View State (from `src/views/EpgTv.tsx`):**
```typescript
// Selected program state already exists
const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);

// Handler already exists
const handleSelectProgram = useCallback((programId: number) => {
  setSelectedProgramId(programId);
}, []);

// Current usage (line 133)
<EpgDetailsPanelPlaceholder isVisible={!!selectedProgramId} />
```

**Program Type (from `src/lib/tauri.ts`):**
```typescript
export interface Program {
  id: number;
  xmltvChannelId: number;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  category?: string;
  episodeInfo?: string;
  createdAt: string;
}
```

**XmltvChannel Type (from `src/lib/tauri.ts`):**
```typescript
export interface XmltvChannel {
  id: number;
  sourceId: number;
  channelId: string;
  displayName: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}
```

### New Types Needed

**ProgramWithChannel Type (for backend response):**
```typescript
// Add to src/lib/tauri.ts
export interface ProgramWithChannel {
  program: Program;
  channel: {
    id: number;
    displayName: string;
    icon?: string;
  };
}
```

**ProgramStatus Type:**
```typescript
type ProgramStatus = 'live' | 'upcoming' | 'aired';

function getProgramStatus(startTime: string, endTime: string): ProgramStatus {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (now >= start && now <= end) return 'live';
  if (now < start) return 'upcoming';
  return 'aired';
}
```

### New Hook: useProgramDetails

```typescript
// src/hooks/useProgramDetails.ts
import { useState, useEffect, useRef } from 'react';
import { getProgramById, type ProgramWithChannel } from '../lib/tauri';

interface UseProgramDetailsResult {
  program: ProgramWithChannel | null;
  isLoading: boolean;
  error: string | null;
}

export function useProgramDetails(programId: number | null): UseProgramDetailsResult {
  const [program, setProgram] = useState<ProgramWithChannel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    if (programId === null) {
      setProgram(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const fetchProgram = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getProgramById(programId);
        if (isMountedRef.current) {
          setProgram(result);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load program');
          setIsLoading(false);
        }
      }
    };

    fetchProgram();

    return () => {
      isMountedRef.current = false;
    };
  }, [programId]);

  return { program, isLoading, error };
}
```

### Rust Backend Command

Add to `src-tauri/src/commands/epg.rs`:
```rust
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgramWithChannel {
    pub program: Program,
    pub channel: ChannelInfo,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelInfo {
    pub id: i32,
    pub display_name: String,
    pub icon: Option<String>,
}

#[tauri::command]
pub async fn get_program_by_id(
    db: State<'_, DbConnection>,
    program_id: i32,
) -> Result<Option<ProgramWithChannel>, String> {
    // Query program with JOIN to xmltv_channels
    // Return ProgramWithChannel or None
}
```

### Previous Story Learnings (Story 5.7)

From Story 5.7 code review:
1. **Race conditions:** Use `isMountedRef` and cleanup functions to prevent memory leaks
2. **Cleanup in useEffect:** Always return cleanup function for async operations
3. **Keyboard navigation:** Support Escape key to close/deselect
4. **Accessibility:** Include `aria-label`, `aria-live` for screen readers
5. **Constants:** Extract magic values for colors, sizes
6. **Tailwind over inline:** Use Tailwind classes like `bg-black/50` not inline styles
7. **Debounce state updates:** Prevent rapid re-renders during fast interactions

### Git Context (Recent Commits)

From recent commits on `feature/epic-5`:
- `b5d9a7e` - Code review fixes for Story 5.7 EPG top bar with search and day navigation
- `568b0e6` - Implement Story 5.7 EPG top bar with search and day navigation
- `806b5eb` - Add ATDD red phase tests for Story 5.7
- Pattern: Follow the same component structure in `src/components/epg/tv-style/`

### Status Indicator Logic

**Compute Program Status:**
```typescript
function getProgramStatus(startTime: string, endTime: string): {
  status: 'live' | 'upcoming' | 'aired';
  label: string;
  color: string;
} {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (now >= start && now <= end) {
    return { status: 'live', label: 'Live Now', color: 'text-green-500' };
  }

  if (now < start) {
    const diffMs = start.getTime() - now.getTime();
    const diffMinutes = Math.round(diffMs / 60000);

    if (diffMinutes < 60) {
      return { status: 'upcoming', label: `Starts in ${diffMinutes} min`, color: 'text-blue-500' };
    }
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) {
      return { status: 'upcoming', label: `Starts in ${diffHours}h`, color: 'text-blue-500' };
    }
    return { status: 'upcoming', label: `Starts ${formatTime(start)}`, color: 'text-blue-500' };
  }

  return { status: 'aired', label: `Aired at ${formatTime(start)}`, color: 'text-gray-500' };
}
```

### Time Formatting Helpers

```typescript
function formatTimeRange(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${start.toLocaleTimeString('en-US', options)} - ${end.toLocaleTimeString('en-US', options)}`;
}

function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
}

function parseDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

  if (durationMinutes < 60) return `${durationMinutes} min`;
  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
```

### Edge Cases to Handle

1. **Missing program data** - Show loading state while fetching, error state on failure
2. **Missing description** - Show "No description available" placeholder
3. **Missing episode info** - Hide episode info section entirely
4. **Missing channel icon** - Show fallback icon or placeholder
5. **Missing category** - Hide category tags section
6. **Long program title** - Truncate with ellipsis after 2 lines
7. **Long description** - Make scrollable within panel
8. **Rapid program changes** - Cancel previous fetch when new program selected
9. **Stale data** - Refresh status indicator in real-time for live programs

### What NOT to Do in This Story

- Do NOT implement action buttons (Watch, Record) - future enhancement
- Do NOT add backdrop artwork - future enhancement
- Do NOT modify channel selection logic (Story 5.5)
- Do NOT modify schedule panel behavior (Story 5.6)
- Do NOT add responsive panel overlays for tablet/mobile (future story)
- Do NOT add program reminders or notifications

### Testing Considerations

- Add `data-testid="epg-program-details"` to main container
- Add `data-testid="program-title"` to title element
- Add `data-testid="episode-info"` to episode info (if visible)
- Add `data-testid="channel-badge"` to channel section
- Add `data-testid="program-status"` to status indicator
- Add `data-testid="program-time"` to time range
- Add `data-testid="program-date"` to date display
- Add `data-testid="program-categories"` to category tags container
- Add `data-testid="program-description"` to description
- Add `data-testid="details-empty-state"` to empty state
- Add `data-testid="details-close-button"` to close button (if added)
- Add `data-testid="details-loading"` to loading state
- Add `data-testid="details-error"` to error state

### Performance Requirements

- Program details fetch: <200ms response time
- Panel render: <50ms for initial render
- Status update: Real-time for "Live Now" (1 second updates while live)
- Smooth transitions: Use CSS transitions for panel show/hide (300ms)
- No layout shift: Reserve space for loading/content states

### Accessibility Requirements

- Panel: `role="complementary"`, `aria-label="Program details"`
- Status indicator: `aria-live="polite"` for live status updates
- Close button: `aria-label="Close program details"`
- Time/date icons: `aria-hidden="true"` (decorative)
- Description: Scrollable region should be keyboard accessible
- Focus management: Focus should move to panel when it opens
- Escape key: Should close panel and return focus to schedule

### References

- [Source: _bmad-output/planning-artifacts/ux-epg-tv-guide.md#Right-Panel-Program-Details]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.8-EPG-Program-Details-Panel]
- [Source: _bmad-output/implementation-artifacts/5-7-epg-top-bar-search-day-navigation.md - Previous story patterns]
- [Source: src/components/epg/tv-style/EpgDetailsPanelPlaceholder.tsx - Component to replace]
- [Source: src/views/EpgTv.tsx - View integration point with selectedProgramId state]
- [Source: src/lib/tauri.ts#Program - Program type definition]
- [Source: src/lib/tauri.ts#XmltvChannel - Channel type definition]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

N/A - No debugging required

### Completion Notes List

1. **Backend Implementation**: Created `get_program_by_id` Tauri command in `src-tauri/src/commands/epg.rs` with proper JOIN to fetch program with channel info. Command registered in `src-tauri/src/lib.rs`.

2. **TypeScript Integration**: Added `ProgramWithChannel` interface and `getProgramById` function to `src/lib/tauri.ts` for type-safe frontend-backend communication.

3. **Custom Hook**: Implemented `useProgramDetails` hook with proper cleanup using `isMountedRef` and `AbortController` to prevent race conditions and memory leaks (learned from Story 5.7 review).

4. **Component Implementation**: Created `EpgProgramDetails` component with all required sections: title, episode info, channel badge with status indicator, metadata (time/date/categories), and scrollable description.

5. **Status Logic**: Implemented real-time status calculation (Live Now/Starts in X/Aired) with proper color coding (green/blue/gray).

6. **Accessibility**: Added proper ARIA labels, roles, focus management, and keyboard navigation (Escape key handler).

7. **Loading & Error States**: Implemented skeleton loading state and error handling with user-friendly messages.

8. **Integration**: Replaced `EpgDetailsPanelPlaceholder` with `EpgProgramDetails` in `EpgTv.tsx`, wired up selection state and close handlers.

9. **Test Data Support**: Modified `test_data.rs` to add helper commands for creating test programs with various scenarios (missing description, missing episode info, long titles).

10. **Comprehensive Tests**: ATDD tests cover all ACs with edge cases - empty state, loading, error, long titles, missing data, status indicators, close behavior.

11. **Minor Hook Import Update**: Added `useEffect` import to `useEpgDayNavigation.ts` (Story 5.7 file) - this was a benign change needed for consistency, no functional impact.

### File List

- `_bmad-output/implementation-artifacts/5-8-epg-program-details-panel.md` - Story file
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated sprint status
- `src-tauri/src/commands/epg.rs` - Added `get_program_by_id` command with `ProgramWithChannel` and `ChannelInfo` structs
- `src-tauri/src/commands/test_data.rs` - Added test data helper commands
- `src-tauri/src/lib.rs` - Registered `get_program_by_id` command
- `src/components/epg/tv-style/EpgProgramDetails.tsx` - New component implementation
- `src/components/epg/tv-style/index.ts` - Added EpgProgramDetails export
- `src/hooks/useProgramDetails.ts` - New hook for fetching program details
- `src/lib/tauri.ts` - Added `ProgramWithChannel` interface and `getProgramById` function
- `src/views/EpgTv.tsx` - Integrated EpgProgramDetails, replaced placeholder
- `tests/e2e/epg-program-details-panel.spec.ts` - Comprehensive E2E tests for all ACs
