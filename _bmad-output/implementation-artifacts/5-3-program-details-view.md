# Story 5.3: Program Details View

Status: completed

## Story

As a user,
I want to see detailed information about a program,
So that I can decide if I want to watch it.

## Acceptance Criteria

1. **Given** a program is selected (from grid or search) **When** the details panel opens **Then** I see:
   - Program title
   - Channel name and logo (XMLTV info)
   - Start time and end time
   - Duration
   - Description (if available)
   - Category/genre (if available)
   - Episode info (if available, e.g., "S02E05")

2. **Given** the program details panel **When** I click outside or press Escape **Then** the panel closes

3. **Given** a program on a channel with multiple streams **When** viewing details **Then** I see which Xtream stream is currently primary **And** stream quality tier is displayed

## Tasks / Subtasks

- [x] Task 1: Create ProgramDetailsPanel component (AC: #1)
  - [x] 1.1 Create `src/components/epg/ProgramDetailsPanel.tsx`
  - [x] 1.2 Display program title prominently
  - [x] 1.3 Display channel name and logo
  - [x] 1.4 Display start time, end time, and calculated duration
  - [x] 1.5 Display description (if available), with graceful empty state
  - [x] 1.6 Display category/genre (if available)
  - [x] 1.7 Display episode info (if available) in format "S02E05" or fallback
  - [x] 1.8 Style panel with Tailwind to match existing UI patterns

- [x] Task 2: Add stream information display (AC: #3)
  - [x] 2.1 Create Tauri command `get_channel_stream_info` in `src-tauri/src/commands/epg.rs`
  - [x] 2.2 Query `channel_mappings` for primary stream of the XMLTV channel
  - [x] 2.3 Return stream name, quality tier, and is_primary status
  - [x] 2.4 Add `ChannelStreamInfo` type to `src/lib/tauri.ts`
  - [x] 2.5 Display primary stream name and quality badge in panel
  - [x] 2.6 Handle channels with no matched streams gracefully

- [x] Task 3: Implement panel open/close behavior (AC: #2)
  - [x] 3.1 Add panel visibility state to EPG.tsx (use `selectedProgram` state)
  - [x] 3.2 Implement click-outside detection to close panel
  - [x] 3.3 Add Escape key handler to close panel
  - [x] 3.4 Add close button (X) in panel header
  - [x] 3.5 Add panel slide-in animation (right side panel or modal)

- [x] Task 4: Integrate panel with program selection events (AC: #1)
  - [x] 4.1 Connect panel to `handleProgramClick` in EPG.tsx
  - [x] 4.2 Handle 'programSelected' custom event from search results (Story 5.2)
  - [x] 4.3 Ensure panel opens on both grid click and search result selection
  - [x] 4.4 Add data-testid attributes for E2E testing

- [x] Task 5: Export and integrate component
  - [x] 5.1 Export ProgramDetailsPanel from `src/components/epg/index.ts`
  - [x] 5.2 Register new Tauri command in `src-tauri/src/lib.rs`
  - [x] 5.3 Add component tests for ProgramDetailsPanel (E2E tests in red phase)

## Dev Notes

### Architecture Compliance

This story implements **FR41** (User can view program details: title, description, time, channel) from the PRD. It addresses **NFR5** (<100ms GUI responsiveness) through optimized rendering.

**CRITICAL - XMLTV-First Design:** Program details display XMLTV channel info (name, logo) as primary. Xtream stream info is secondary, shown only for AC#3.

### Technical Stack

- **Frontend:** React 18 + TypeScript + Tailwind CSS
- **State:** Local component state in EPG.tsx
- **Data Fetching:** Tauri invoke for stream info
- **Build:** Vite

### Existing Code Integration Points

**EPG.tsx (lines 36-101)** already has program selection state:
```typescript
// Line 37 - selectedProgram state (currently unused with underscore prefix)
const [_selectedProgram, setSelectedProgram] = useState<EpgGridProgram | null>(null);

// Lines 96-101 - handleProgramClick already sets selection
const handleProgramClick = useCallback((program: EpgGridProgram) => {
  setSelectedProgram(program);
  console.log('Program selected:', program);
}, []);
```

**Story 5.2 Integration** - Search dispatches 'programSelected' event (useEpgSearch.ts line ~85):
```typescript
// Custom event dispatched when search result is selected
window.dispatchEvent(new CustomEvent('programSelected', { detail: result }));
```

**EpgGridProgram Type** (tauri.ts lines 1367-1374):
```typescript
export interface EpgGridProgram {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  category?: string;
  description?: string;
}
```

### Database Query for Stream Info (AC#3)

```sql
-- Get primary stream info for an XMLTV channel
SELECT
  xc.name as stream_name,
  xc.qualities as quality_tiers,
  cm.is_primary,
  cm.match_confidence
FROM channel_mappings cm
INNER JOIN xtream_channels xc ON xc.id = cm.xtream_channel_id
WHERE cm.xmltv_channel_id = :xmltv_channel_id
  AND cm.is_primary = 1
LIMIT 1;
```

### Type Definitions Required

```typescript
// For src/lib/tauri.ts
export interface ChannelStreamInfo {
  streamName: string;
  qualityTiers: string[];  // e.g., ["HD", "SD", "4K"]
  isPrimary: boolean;
  matchConfidence: number;
}

// Extended program type for panel (combines EpgGridProgram + channel info)
export interface ProgramDetails {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  category?: string;
  episodeInfo?: string;  // e.g., "S02E05"
  channelId: number;
  channelName: string;
  channelIcon?: string;
  streamInfo?: ChannelStreamInfo;
}
```

### Panel Design Pattern

Use a **slide-in right panel** pattern (not modal) for better UX:
- Panel slides in from right side
- Main content remains visible (dimmed or not)
- Click outside OR Escape closes
- 400px width, full height
- Smooth animation (150-200ms)

Example structure:
```tsx
{selectedProgram && (
  <div className="fixed inset-0 z-50">
    {/* Backdrop (optional, click to close) */}
    <div className="absolute inset-0 bg-black/20" onClick={onClose} />

    {/* Panel */}
    <div className="absolute right-0 top-0 h-full w-[400px] bg-white shadow-xl">
      {/* Header with close button */}
      {/* Content */}
    </div>
  </div>
)}
```

### Duration Calculation

Reuse existing `formatProgramDuration` from tauri.ts (lines 1490-1507):
```typescript
import { formatProgramDuration } from '../lib/tauri';
// Returns "1h 30m" or "45m" format
const duration = formatProgramDuration(program.startTime, program.endTime);
```

### Episode Info Parsing

Episode info in XMLTV can appear in various formats. Handle common patterns:
```typescript
function formatEpisodeInfo(episodeInfo?: string): string | null {
  if (!episodeInfo) return null;

  // XMLTV format: "1.4." means Season 2, Episode 5 (0-indexed)
  const match = episodeInfo.match(/^(\d+)\.(\d+)\./);
  if (match) {
    const season = parseInt(match[1], 10) + 1;
    const episode = parseInt(match[2], 10) + 1;
    return `S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`;
  }

  return episodeInfo; // Return as-is if not parseable
}
```

### Click Outside Detection

Use a ref and event listener pattern:
```typescript
const panelRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
      onClose();
    }
  };

  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [onClose]);
```

### Escape Key Handler

Add to EPG.tsx or panel component:
```typescript
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && selectedProgram) {
      setSelectedProgram(null);
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [selectedProgram]);
```

### Quality Tier Display

Quality tiers are stored as JSON array in `xtream_channels.qualities`. Display as badges:
```tsx
{streamInfo?.qualityTiers.map(tier => (
  <span key={tier} className={getQualityBadgeClasses(tier)}>
    {tier}
  </span>
))}

function getQualityBadgeClasses(tier: string): string {
  switch (tier.toUpperCase()) {
    case '4K': return 'bg-purple-100 text-purple-800';
    case 'HD': return 'bg-blue-100 text-blue-800';
    case 'SD': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}
```

### Project Structure Notes

**New Files to Create:**
- `src/components/epg/ProgramDetailsPanel.tsx` - Main panel component

**Files to Modify:**
- `src/lib/tauri.ts` - Add ChannelStreamInfo type and getChannelStreamInfo function
- `src/views/EPG.tsx` - Integrate panel, remove underscore from selectedProgram, add event listeners
- `src/components/epg/index.ts` - Export ProgramDetailsPanel
- `src-tauri/src/commands/epg.rs` - Add get_channel_stream_info command
- `src-tauri/src/lib.rs` - Register new command

### Previous Story Learnings (Story 5.2)

From Story 5.2 code review:
1. **Event naming:** Use camelCase for custom events (`programSelected` not `program-selected`)
2. **Race conditions:** Use AbortController for async operations that might be cancelled
3. **Null checks:** Always validate data before accessing properties
4. **Memory leaks:** Clean up event listeners in useEffect return
5. **Test data commands:** E2E tests may need test data setup commands

### Testing Considerations

- Add `data-testid="program-details-panel"` to panel container
- Add `data-testid="program-details-title"` to title element
- Add `data-testid="program-details-close"` to close button
- Test: Panel opens on program click
- Test: Panel closes on click outside
- Test: Panel closes on Escape key
- Test: Panel displays all available fields
- Test: Stream info loads and displays correctly
- Test: Empty states for missing optional fields

### Edge Cases to Handle

1. **No description** - Show "No description available" text
2. **No category** - Hide category section entirely
3. **No episode info** - Hide episode section entirely
4. **No stream matched** - Show "No stream source" message
5. **Multiple quality tiers** - Display all as badges
6. **Very long title/description** - Truncate or scroll
7. **Missing channel logo** - Show placeholder icon

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-5-Story-5.3]
- [Source: _bmad-output/planning-artifacts/prd.md#FR41]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-Architecture]
- [Source: _bmad-output/implementation-artifacts/5-2-epg-search-functionality.md - event patterns]
- [Source: src/views/EPG.tsx - existing EPG implementation and selection state]
- [Source: src/lib/tauri.ts - existing types and formatProgramDuration helper]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. Created ProgramDetailsPanel component with slide-in panel design
2. Added `get_channel_stream_info` Tauri command to fetch stream mapping info
3. Extended EpgGridProgram type to include episodeInfo field
4. Updated EpgGrid to pass channel info on program click
5. Integrated panel in EPG.tsx with state management for selection and stream info
6. Added test data commands for E2E testing: `create_test_channel_mapping`, `delete_test_stream_mapping`
7. Updated `create_test_program` to accept optional id and episodeInfo parameters
8. All Rust tests pass (238 tests)
9. TypeScript compiles successfully
10. Vite build succeeds
11. E2E tests are in red phase (expected - require full Tauri environment)

### File List

**New Files Created:**
- `src/components/epg/ProgramDetailsPanel.tsx` - Main details panel component

**Files Modified:**
- `src/views/EPG.tsx` - Added panel integration, stream info fetching, search result panel opening
- `src/components/epg/EpgGrid.tsx` - Updated onProgramClick to include channel info
- `src/components/epg/index.ts` - Export ProgramDetailsPanel
- `src/lib/tauri.ts` - Added ChannelStreamInfo type, getChannelStreamInfo function, episodeInfo to EpgGridProgram
- `src-tauri/src/commands/epg.rs` - Added get_channel_stream_info command, episode_info to EpgGridProgram
- `src-tauri/src/commands/test_data.rs` - Added create_test_channel_mapping, delete_test_stream_mapping, updated create_test_program
- `src-tauri/src/lib.rs` - Registered new commands

### Code Review (AI) - 2026-01-22

**Reviewer:** Claude Opus 4.5

**Issues Found:** 5 Medium, 3 Low

**Fixes Applied:**
1. Removed inconsistent blank lines in `EpgGrid.tsx`
2. Added missing `episodeInfo` field to `createProgramDetailsData` helper in `ProgramDetailsPanel.tsx`
3. Added explanatory comments for layout constants in `EpgGrid.tsx`

**Post-Implementation Style Changes Documented:**
The following UI polish changes were applied after initial implementation:
- `src/components/epg/EpgCell.tsx` - Enhanced cell styling (hover effects, padding, border radius)
- `src/components/epg/EpgGrid.tsx` - Increased row height/channel column width for better logo display, alternating row colors, placeholder icon for missing channel logos
- `src/components/layout/MainLayout.tsx` - Fixed flex layout to enable proper EPG grid scrolling
- `src/views/EPG.tsx` - Changed wrapper testid from `epg-grid` to `epg-grid-wrapper` to avoid duplicate testid conflict

**Low Issues Deferred:**
- Issue #6: Scale transform on hover (monitor for visual issues)
- Issue #7: Implicit padding relationship (acceptable complexity)
- Issue #8: "TV" placeholder text vs SVG icon (cosmetic preference)
