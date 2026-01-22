# Story 5.2: EPG Search Functionality

Status: ready-for-dev

## Story

As a user,
I want to search the EPG by various criteria,
So that I can find specific programs I'm interested in.

## Acceptance Criteria

1. **Given** the EPG view **When** I click on the search field **Then** I can enter search text

2. **Given** I enter search text **When** the search executes **Then** results are filtered by:
   - Program title (partial match)
   - Program description (partial match)
   - Channel name (partial match)
   **And** only enabled XMLTV channels are searched

3. **Given** search results are displayed **When** I view the results **Then** each result shows:
   - Program title
   - Channel name
   - Start time and duration
   - Relevance indicator

4. **Given** I click a search result **When** the selection is made **Then** the EPG grid scrolls to that program's time slot **And** the program details panel opens

5. **Given** the search field **When** I clear the search **Then** the EPG returns to normal grid view

## Tasks / Subtasks

- [ ] Task 1: Create EPG search backend command (AC: #2)
  - [ ] 1.1 Create `search_epg_programs` Tauri command in `src-tauri/src/commands/epg.rs`
  - [ ] 1.2 Implement SQL query with LIKE matching on title, description, and channel name
  - [ ] 1.3 Filter results to only enabled XMLTV channels (`is_enabled = true`)
  - [ ] 1.4 Return search results with channel info, start time, and duration
  - [ ] 1.5 Register command in Tauri invoke handler

- [ ] Task 2: Add search types and functions to frontend (AC: #2, #3)
  - [ ] 2.1 Add `EpgSearchResult` type to `src/lib/tauri.ts`
  - [ ] 2.2 Add `searchEpgPrograms` function to `src/lib/tauri.ts`
  - [ ] 2.3 Include relevance scoring based on match type (title > channel > description)

- [ ] Task 3: Create search input component (AC: #1, #5)
  - [ ] 3.1 Create `src/components/epg/EpgSearchInput.tsx` with search icon
  - [ ] 3.2 Implement debounced search (300ms delay)
  - [ ] 3.3 Add clear button when search has content
  - [ ] 3.4 Style input to match existing UI patterns

- [ ] Task 4: Create search results display component (AC: #3)
  - [ ] 4.1 Create `src/components/epg/EpgSearchResults.tsx`
  - [ ] 4.2 Display results in a virtualized dropdown/panel
  - [ ] 4.3 Show program title, channel name, start time, duration for each result
  - [ ] 4.4 Add relevance indicator (match type or score display)
  - [ ] 4.5 Handle empty search results state

- [ ] Task 5: Implement search result selection and grid navigation (AC: #4)
  - [ ] 5.1 Add onClick handler to search result items
  - [ ] 5.2 Calculate time window that includes selected program
  - [ ] 5.3 Update EPG.tsx time window state to scroll to program time
  - [ ] 5.4 Trigger program selection (for Story 5.3 details panel)
  - [ ] 5.5 Clear search results after selection (optional, based on UX preference)

- [ ] Task 6: Integrate search into EPG view (AC: #1-#5)
  - [ ] 6.1 Add EpgSearchInput to EPG.tsx (integrate with TimeNavigationBar)
  - [ ] 6.2 Add search state management
  - [ ] 6.3 Conditionally render EpgSearchResults when search is active
  - [ ] 6.4 Handle search clearing and return to normal grid view

- [ ] Task 7: Add tests for search functionality
  - [ ] 7.1 Add backend tests for `search_epg_programs` command
  - [ ] 7.2 Add frontend component tests for EpgSearchInput
  - [ ] 7.3 Add integration test for search → result selection → grid navigation flow

## Dev Notes

### Architecture Compliance

This story implements **FR40** (User can search EPG by program title, channel name, or description) from the PRD. It addresses **NFR5** (<100ms GUI responsiveness) by using debounced search and efficient database queries.

**CRITICAL - XMLTV-First Design:** Search MUST only return programs from enabled XMLTV channels (`xmltv_channel_settings.is_enabled = true`). This ensures search results match what's visible in the EPG grid.

### Technical Stack (from Architecture)

- **Frontend:** React 18 + TypeScript + Tailwind CSS
- **State:** Local component state with `useState` for search query and results
- **Data Fetching:** Direct Tauri invoke (local SQLite database)
- **Build:** Vite

### Existing Patterns to Follow

From Story 5.1 implementation:

1. **EPG Data Hook Pattern** - See `src/hooks/useEpgGridData.ts`:
   ```typescript
   export function useEpgGridData(initialStartTime: string, initialEndTime: string) {
     const [data, setData] = useState<EpgGridData | null>(null);
     const [isLoading, setIsLoading] = useState(true);
     const [error, setError] = useState<string | null>(null);
     // ... fetches with Tauri invoke
   }
   ```

2. **Tauri Command Pattern** - See `src/lib/tauri.ts` (lines 1396-1404):
   ```typescript
   export async function getEnabledChannelsWithPrograms(
     startTime: string,
     endTime: string
   ): Promise<EpgGridChannel[]> {
     return invoke<EpgGridChannel[]>('get_enabled_channels_with_programs', {
       startTime,
       endTime,
     });
   }
   ```

3. **Time Window Pattern** - See `src/views/EPG.tsx`:
   - Store timeWindow in state
   - Update via setTimeWindow callback
   - Components receive timeWindow as prop

4. **Program Click Handler** - See `src/views/EPG.tsx` (line 78-83):
   ```typescript
   const handleProgramClick = useCallback((program: EpgGridProgram) => {
     setSelectedProgram(program);
     console.log('Program selected:', program);
   }, []);
   ```

### Database Query Required

```sql
-- Search programs in enabled channels
SELECT
  p.id, p.title, p.description, p.start_time, p.end_time, p.category,
  xc.id as channel_id, xc.display_name as channel_name, xc.icon as channel_icon
FROM programs p
INNER JOIN xmltv_channels xc ON xc.id = p.xmltv_channel_id
INNER JOIN xmltv_channel_settings xcs ON xcs.xmltv_channel_id = xc.id
WHERE xcs.is_enabled = 1
  AND (
    p.title LIKE '%' || :query || '%'
    OR p.description LIKE '%' || :query || '%'
    OR xc.display_name LIKE '%' || :query || '%'
  )
  AND p.end_time > :now  -- Only future/current programs
ORDER BY
  CASE
    WHEN p.title LIKE '%' || :query || '%' THEN 1
    WHEN xc.display_name LIKE '%' || :query || '%' THEN 2
    ELSE 3
  END,
  p.start_time ASC
LIMIT 50;
```

### Search Result Type Definition

```typescript
// For src/lib/tauri.ts
export interface EpgSearchResult {
  programId: number;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  category?: string;
  channelId: number;
  channelName: string;
  channelIcon?: string;
  /** Match type for relevance: 'title', 'channel', 'description' */
  matchType: 'title' | 'channel' | 'description';
  /** Match score 0-1 for relevance ordering */
  relevanceScore: number;
}
```

### Debounced Search Implementation

Use a debounce utility or implement with useEffect/setTimeout:

```typescript
// Example debounced search pattern
import { useState, useEffect } from 'react';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

### Grid Navigation on Selection

When a search result is selected:
1. Calculate a time window centered on the program's start time (e.g., ±1.5 hours)
2. Call `setTimeWindow` to update the EPG grid
3. Store selected program for details panel (Story 5.3)
4. Optionally highlight the program cell in the grid

### Project Structure Notes

**New Files to Create:**
- `src/components/epg/EpgSearchInput.tsx` - Search input with debounce
- `src/components/epg/EpgSearchResults.tsx` - Search results dropdown/panel

**Files to Modify:**
- `src/lib/tauri.ts` - Add EpgSearchResult type and searchEpgPrograms function
- `src/views/EPG.tsx` - Integrate search components and state
- `src/components/epg/index.ts` - Export new components
- `src-tauri/src/commands/epg.rs` - Add search_epg_programs command
- `src-tauri/src/lib.rs` - Register new command

### UX Considerations

1. **Search input placement:** Add to TimeNavigationBar or as a separate component above the grid
2. **Results display:** Use a dropdown panel below search input, similar to autocomplete
3. **Loading state:** Show spinner in search input while searching
4. **Empty state:** "No programs found for '{query}'" message
5. **Clear behavior:** X button clears search and returns to grid view
6. **Keyboard navigation:** Support Enter to select first result, Escape to clear

### Edge Cases to Handle

1. **Empty search query** - Don't make API call, show all channels in grid
2. **No results** - Display friendly message
3. **Very long search query** - Truncate or limit input length
4. **Special characters** - Escape SQL special characters (%, _, etc.)
5. **Programs in the past** - Filter to only show current/future programs
6. **Rapid typing** - Debounce prevents excessive API calls

### Previous Story Learnings (Story 5.1)

From the code review of Story 5.1:
1. **Memory leak fixed:** Don't cache Date objects with useMemo if they need to update
2. **Test infrastructure:** vitest and @testing-library/react are already configured
3. **Virtualization:** TanStack Virtual handles large lists efficiently (use for search results if > 50)
4. **Time handling:** ISO strings for database, Date objects for display calculations

### Performance Requirements (from NFR5)

- Search response time < 100ms for typical queries
- Debounce search input (300ms recommended)
- Limit results to 50 items for quick rendering
- Use virtualization only if results exceed reasonable limit

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-5-Story-5.2]
- [Source: _bmad-output/planning-artifacts/prd.md#FR40]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-Architecture]
- [Source: _bmad-output/implementation-artifacts/5-1-epg-grid-browser-with-time-navigation.md - previous story patterns]
- [Source: src/views/EPG.tsx - existing EPG implementation]
- [Source: src/lib/tauri.ts - existing type patterns]
- [Source: src/hooks/useEpgGridData.ts - data fetching patterns]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
