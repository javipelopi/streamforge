# Story 3.9: Implement Target Lineup View

Status: done

## Story

As a user,
I want a dedicated Target Lineup menu item showing my Plex channel lineup,
So that I can manage what channels appear in Plex efficiently.

## Background

This story is part of the **Navigation Restructure (Option C)** from Sprint Change Proposal 2026-01-20. The current Channels tab loads ALL data from ALL sources with complex SQL queries, causing performance issues. The new architecture separates concerns:

- **Target Lineup** (this story): Enabled channels going to Plex - fast, focused
- **Sources** (stories 3-10, 3-11): Browse XMLTV/Xtream sources to add channels

## Acceptance Criteria

1. **Given** the sidebar navigation
   **When** I look at the menu
   **Then** I see "Target Lineup" as a new menu item after Dashboard
   **And** the old "Channels" menu item is removed

2. **Given** the sidebar navigation
   **When** I click "Target Lineup"
   **Then** I see a new view showing only channels where `is_enabled = true`
   **And** the list loads quickly (<500ms for 500 enabled channels)

3. **Given** the Target Lineup view
   **When** I view the channel list
   **Then** I can drag-drop to reorder channels (existing functionality preserved)
   **And** I can toggle enable/disable (disabling removes from lineup)
   **And** channels without streams show a warning icon with tooltip "No stream source"

4. **Given** an enabled channel has no stream source
   **When** viewing in Target Lineup
   **Then** a warning badge "No stream" appears
   **And** hovering shows tooltip "This channel has no video source"

5. **Given** the Target Lineup is empty
   **When** viewing the page
   **Then** I see an empty state: "No channels in lineup. Add channels from Sources."
   **And** a button links to the Sources view

6. **Given** I disable a channel from Target Lineup
   **When** the toggle is clicked
   **Then** the channel is removed from the list (optimistic UI)
   **And** a toast shows "Channel removed from lineup"
   **And** an "Undo" action is available for 5 seconds

## Tasks / Subtasks

### Navigation Changes

- [x] Task 1: Update sidebar navigation (AC: #1)
  - [x] 1.1 Edit `src/components/layout/Sidebar.tsx`
  - [x] 1.2 Replace "Channels" menu item with "Target Lineup" (route: `/target-lineup`)
  - [x] 1.3 Add icon (use `ListChecks` or similar from lucide-react)
  - [x] 1.4 Keep same position in navigation order
  - [x] 1.5 Update active state styling

- [x] Task 2: Create route for Target Lineup (AC: #1, #2)
  - [x] 2.1 Edit `src/App.tsx` (or router config)
  - [x] 2.2 Add route `/target-lineup` → `TargetLineupView`
  - [x] 2.3 Remove `/channels` route (will be replaced by Sources in 3-10)
  - [x] 2.4 Add redirect from `/channels` to `/target-lineup` for backwards compat

### Backend - New Optimized Query

- [x] Task 3: Create `get_target_lineup_channels` command (AC: #2)
  - [x] 3.1 Add new command in `src-tauri/src/commands/channels.rs` or new file `target_lineup.rs`
  - [x] 3.2 Query ONLY enabled channels:
    ```sql
    SELECT xc.*, xcs.is_enabled, xcs.plex_display_order
    FROM xmltv_channels xc
    INNER JOIN xmltv_channel_settings xcs ON xc.id = xcs.xmltv_channel_id
    WHERE xcs.is_enabled = 1
    ORDER BY xcs.plex_display_order ASC
    ```
  - [x] 3.3 Include mapping count (subquery) for "No stream" warning
  - [x] 3.4 Return `Vec<TargetLineupChannel>` with:
    - channel info (id, displayName, icon, isSynthetic)
    - isEnabled (always true in this query)
    - plexDisplayOrder
    - streamCount (0 = no stream warning)
    - primaryStreamName (optional, for display)
  - [x] 3.5 Register command in `src-tauri/src/lib.rs`
  - [x] 3.6 Performance target: <100ms for 500 channels

### Frontend - Target Lineup View

- [x] Task 4: Create `TargetLineupView` component (AC: #2, #3, #4, #5)
  - [x] 4.1 Create `src/views/TargetLineup.tsx`
  - [x] 4.2 Use TanStack Query: `useQuery(['target-lineup'], getTargetLineupChannels)`
  - [x] 4.3 Display loading skeleton during fetch
  - [x] 4.4 Handle empty state (AC #5) with:
    - Message: "No channels in lineup. Add channels from Sources."
    - Button: "Browse Sources" → navigates to `/accounts` (Sources)
  - [x] 4.5 Add data-testid="target-lineup-view"

- [x] Task 5: Create `TargetLineupChannelRow` component (AC: #3, #4)
  - [x] 5.1 Create `src/components/channels/TargetLineupChannelRow.tsx`
  - [x] 5.2 Display: channel icon, name, synthetic badge (if applicable)
  - [x] 5.3 Display: "No stream" warning badge if streamCount = 0
  - [x] 5.4 Add tooltip on "No stream": "This channel has no video source"
  - [x] 5.5 Enable/disable toggle (disabling removes from view)
  - [x] 5.6 Drag handle for reordering
  - [x] 5.7 Reuse styling from existing `DraggableChannelRow` where possible

- [x] Task 6: Implement drag-drop reordering (AC: #3)
  - [x] 6.1 Use HTML5 drag-drop API for drag-drop
  - [x] 6.2 Reuse `updateChannelOrder` mutation from Channels view
  - [x] 6.3 Optimistic UI update on drag end
  - [x] 6.4 Persist new order to `xmltv_channel_settings.plex_display_order`

- [x] Task 7: Implement disable with undo (AC: #6)
  - [x] 7.1 Implemented undo logic directly in TargetLineup.tsx
  - [x] 7.2 On disable:
    - Optimistically remove from list
    - Show toast with "Undo" button (5 second timeout)
    - Call `toggleXmltvChannel(channelId)` after timeout if not undone
  - [x] 7.3 On undo:
    - Re-add channel to list at original position
    - Cancel the disable mutation
  - [x] 7.4 Use React state to track pending disables

### TypeScript Bindings

- [x] Task 8: Add TypeScript types and bindings (AC: #2)
  - [x] 8.1 Add `TargetLineupChannel` interface to `src/lib/tauri.ts`:
    ```typescript
    export interface TargetLineupChannel {
      id: number;
      displayName: string;
      icon: string | null;
      isSynthetic: boolean;
      isEnabled: boolean;
      plexDisplayOrder: number | null;
      streamCount: number;
    }
    ```
  - [x] 8.2 Add `getTargetLineupChannels(): Promise<TargetLineupChannel[]>`
  - [x] 8.3 Reuse existing `toggleXmltvChannel` and `updateChannelOrder`

### Testing

- [x] Task 9: E2E Tests (AC: #1-6)
  - [x] 9.1 Create `tests/e2e/target-lineup.spec.ts`
  - [x] 9.2 Test: Target Lineup appears in navigation
  - [x] 9.3 Test: Shows only enabled channels
  - [x] 9.4 Test: Empty state displays when no enabled channels
  - [x] 9.5 Test: "No stream" warning appears for channels without mappings
  - [x] 9.6 Test: Drag-drop reordering works
  - [x] 9.7 Test: Disable removes channel with undo toast
  - [x] 9.8 Test: Undo restores channel to list
  - [x] 9.9 Use Tauri mock injection pattern from story 3-8
  - All 20 E2E tests pass

- [x] Task 10: Build verification
  - [x] 10.1 Run `cargo check` - no Rust errors
  - [x] 10.2 Run `npx tsc --noEmit` - TypeScript compiles
  - [x] 10.3 Run `npm run build` - build succeeds

## Dev Notes

### CRITICAL: Navigation Restructure Context

This story is **Step 1 of 3** for the Navigation Restructure (Option C):
1. **Story 3-9** (this): Target Lineup View - the Plex output
2. **Story 3-10**: Sources View with XMLTV Tab - browse EPG sources
3. **Story 3-11**: Sources View with Xtream Tab - browse streams

**User Flow After All Three:**
```
Dashboard → Target Lineup (my Plex channels)
         → Sources [XMLTV | Xtream] (find channels to add)
```

### Architecture Compliance

**XMLTV-First Design:** Target Lineup shows XMLTV channels that are enabled. This includes:
- Real XMLTV channels (from EPG sources)
- Synthetic channels (promoted orphan Xtream streams from story 3-8)

Both types are stored in `xmltv_channels` table with settings in `xmltv_channel_settings`.

[Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture]

### Performance Requirements

**Current Problem:** `get_xmltv_channels_with_mappings` loads ALL tables and does in-memory joins.

**New Approach:** `get_target_lineup_channels` uses a focused query:
- INNER JOIN only loads enabled channels
- No need to load orphan section data
- No need to load all Xtream streams
- Subquery for stream count is O(1) per channel with index

**Target:** <100ms for 500 enabled channels (vs current multi-second load for all channels)

### Existing Code to Leverage

**Backend - Reuse Patterns:**
- `src-tauri/src/commands/xmltv_channels.rs`: Query patterns, response types
- `src-tauri/src/commands/channels.rs`: `update_channel_enabled`, `update_channel_order`
- Story 3-8 patterns for synthetic channel handling

**Frontend - Reuse Components:**
- `src/components/channels/DraggableChannelRow.tsx`: Row styling, drag handle
- `src/components/channels/DraggableXmltvChannelsList.tsx`: dnd-kit setup
- Toast notifications from existing Channels view
- TanStack Query patterns

### Files to Create

```
src/views/TargetLineupView.tsx
src/components/target-lineup/TargetLineupChannelRow.tsx
src/components/target-lineup/index.ts
tests/e2e/target-lineup.spec.ts
```

### Files to Modify

```
src/components/layout/Sidebar.tsx (navigation)
src/App.tsx (routing)
src-tauri/src/commands/channels.rs OR new target_lineup.rs
src-tauri/src/lib.rs (register command)
src/lib/tauri.ts (TypeScript bindings)
```

### Previous Story Intelligence (3-8)

**Key Patterns to Follow:**
1. **Tauri Mock Pattern:** Use `__TAURI_INTERNALS__` mock injection for E2E tests
2. **Optimistic UI:** Update local state immediately, rollback on error
3. **Toast Pattern:** Success/error toasts with action buttons
4. **Badge Styling:** Amber for warnings, green for success states

**Code Review Learnings:**
- Validate inputs (though less relevant here - no user input)
- Add ARIA labels for accessibility
- No console.log in production code
- Add data-testid attributes for E2E tests

### Backwards Compatibility

The old `/channels` route should redirect to `/target-lineup` for any bookmarks or deep links. This can be removed after 3-10/3-11 when Sources replaces the channel browsing functionality.

### Empty State UX

When Target Lineup is empty:
```
┌─────────────────────────────────────────┐
│                                         │
│    📺  No channels in lineup           │
│                                         │
│    Add channels from Sources to        │
│    start building your Plex lineup.    │
│                                         │
│    [ Browse Sources ]  (disabled        │
│                        until 3-10)      │
│                                         │
└─────────────────────────────────────────┘
```

### "No Stream" Warning Badge

For channels without any stream source (streamCount = 0):
```tsx
{channel.streamCount === 0 && (
  <span
    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800"
    title="This channel has no video source"
  >
    <AlertTriangle className="w-3 h-3 mr-1" />
    No stream
  </span>
)}
```

### Disable with Undo Pattern

```tsx
const useDisableChannelWithUndo = () => {
  const [pendingDisables, setPendingDisables] = useState<Map<number, NodeJS.Timeout>>();
  const queryClient = useQueryClient();

  const disableChannel = (channelId: number) => {
    // 1. Optimistically remove from cache
    queryClient.setQueryData(['target-lineup'], (old) =>
      old?.filter(c => c.id !== channelId)
    );

    // 2. Show toast with undo
    toast({
      title: "Channel removed from lineup",
      action: <Button onClick={() => undoDisable(channelId)}>Undo</Button>,
      duration: 5000
    });

    // 3. Schedule actual disable after 5 seconds
    const timeout = setTimeout(() => {
      updateChannelEnabled(channelId, false);
      pendingDisables.delete(channelId);
    }, 5000);

    pendingDisables.set(channelId, timeout);
  };

  const undoDisable = (channelId: number) => {
    clearTimeout(pendingDisables.get(channelId));
    pendingDisables.delete(channelId);
    queryClient.invalidateQueries(['target-lineup']);
  };

  return { disableChannel, undoDisable };
};
```

### Accessibility Requirements

- Navigation item: `aria-label="Target Lineup - Your Plex channel lineup"`
- Empty state button: `aria-label="Browse sources to add channels"`
- Warning badge: `role="img" aria-label="Warning: No stream source"`
- Drag handle: `aria-label="Drag to reorder"`
- Disable toggle: `aria-label="Remove from Plex lineup"`

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-01-20.md]
- [Source: _bmad-output/planning-artifacts/architecture.md#Database Schema]
- [Source: _bmad-output/planning-artifacts/prd.md#FR21-FR26]
- [Source: src/views/Channels.tsx - existing view patterns]
- [Source: src/components/channels/DraggableChannelRow.tsx - row component]
- [Source: src-tauri/src/commands/xmltv_channels.rs - query patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- E2E test run: 20 tests passing in 4.5s
- TypeScript compilation: clean
- Rust cargo check: clean
- Production build: built in 2.02s (frontend) + 22.14s (Rust)

### Completion Notes List

1. **Router Fix**: Changed Tauri detection in `src/router.tsx` to check protocol (`http:` or `https:`) in addition to `__TAURI_INTERNALS__` to distinguish real Tauri from mocked browser tests. This allows URL-based navigation tests to work correctly.

2. **Component Placement**: Created `TargetLineupChannelRow` in `src/components/channels/` instead of `src/components/target-lineup/` to colocate with other channel components.

3. **View Naming**: Created `TargetLineup.tsx` (not `TargetLineupView.tsx`) to follow existing view naming conventions.

4. **Drag-Drop Implementation**: Used HTML5 drag-drop API instead of dnd-kit for simplicity, as the existing drag-drop requirements were straightforward.

5. **Empty State + Toast Bug**: Fixed critical bug where the empty state early return prevented the undo toast from rendering when the last channel was disabled. Added separate empty state rendering path when undo toast is active.

6. **TestId Alignment**: Updated all component testIds to match the ATDD test expectations exactly (e.g., `no-stream-warning-{id}`, `target-lineup-empty-state`).

### File List

**Created:**
- `src/views/TargetLineup.tsx` - Main view component with virtualized list, drag-drop, and undo functionality
- `src/components/channels/TargetLineupChannelRow.tsx` - Channel row component with drag handle, warning badge, and toggle

**Modified:**
- `src/lib/routes.ts` - Added TARGET_LINEUP route, NavItem interface with testId/ariaLabel
- `src/components/layout/Sidebar.tsx` - Updated navigation with Target Lineup, testIds, aria-labels
- `src/router.tsx` - Updated routes, fixed Tauri detection for browser tests
- `src/views/index.ts` - Added TargetLineup export
- `src/lib/tauri.ts` - Added TargetLineupChannel type and getTargetLineupChannels function
- `src-tauri/src/commands/xmltv_channels.rs` - Added get_target_lineup_channels command and TargetLineupChannel struct
- `src-tauri/src/lib.rs` - Registered get_target_lineup_channels command
