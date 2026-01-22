# Story 5.3: Program Details View

Status: ready-for-dev

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

- [ ] Task 1: Create ProgramDetailsPanel component (AC: #1)
  - [ ] 1.1 Create `src/components/epg/ProgramDetailsPanel.tsx`
  - [ ] 1.2 Display program title prominently
  - [ ] 1.3 Display channel name and logo
  - [ ] 1.4 Display start time, end time, and calculated duration
  - [ ] 1.5 Display description (if available), with graceful empty state
  - [ ] 1.6 Display category/genre (if available)
  - [ ] 1.7 Display episode info (if available) in format "S02E05" or fallback
  - [ ] 1.8 Style panel with Tailwind to match existing UI patterns

- [ ] Task 2: Add stream information display (AC: #3)
  - [ ] 2.1 Create Tauri command `get_channel_stream_info` in `src-tauri/src/commands/epg.rs`
  - [ ] 2.2 Query `channel_mappings` for primary stream of the XMLTV channel
  - [ ] 2.3 Return stream name, quality tier, and is_primary status
  - [ ] 2.4 Add `ChannelStreamInfo` type to `src/lib/tauri.ts`
  - [ ] 2.5 Display primary stream name and quality badge in panel
  - [ ] 2.6 Handle channels with no matched streams gracefully

- [ ] Task 3: Implement panel open/close behavior (AC: #2)
  - [ ] 3.1 Add panel visibility state to EPG.tsx (use `selectedProgram` state)
  - [ ] 3.2 Implement click-outside detection to close panel
  - [ ] 3.3 Add Escape key handler to close panel
  - [ ] 3.4 Add close button (X) in panel header
  - [ ] 3.5 Add panel slide-in animation (right side panel or modal)

- [ ] Task 4: Integrate panel with program selection events (AC: #1)
  - [ ] 4.1 Connect panel to `handleProgramClick` in EPG.tsx
  - [ ] 4.2 Handle 'programSelected' custom event from search results (Story 5.2)
  - [ ] 4.3 Ensure panel opens on both grid click and search result selection
  - [ ] 4.4 Add data-testid attributes for E2E testing

- [ ] Task 5: Export and integrate component
  - [ ] 5.1 Export ProgramDetailsPanel from `src/components/epg/index.ts`
  - [ ] 5.2 Register new Tauri command in `src-tauri/src/lib.rs`
  - [ ] 5.3 Add component tests for ProgramDetailsPanel

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
