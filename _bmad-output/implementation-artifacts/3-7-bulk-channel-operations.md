# Story 3.7: Bulk Channel Operations

Status: review

## Story

As a user,
I want to enable/disable multiple XMLTV channels at once,
So that I can quickly configure categories of channels.

## Acceptance Criteria

1. **Given** the Channels view
   **When** I select multiple XMLTV channels using checkboxes
   **Then** a bulk action toolbar appears

2. **Given** multiple channels are selected
   **When** I click "Enable Selected"
   **Then** all selected channels with matched streams are enabled
   **And** channels without streams show a warning count

3. **Given** multiple channels are selected
   **When** I click "Disable Selected"
   **Then** all selected channels are disabled

4. **Given** the Channels view
   **When** I click "Select All Matched"
   **Then** only XMLTV channels with at least one Xtream stream are selected

5. **Given** the Channels view has category filters
   **When** I filter by XMLTV category and select all
   **Then** only filtered channels are selected for bulk operations

## Tasks / Subtasks

- [x] Task 1: Add selection state management (AC: #1)
  - [x] 1.1 Add `selectedChannelIds: Set<number>` state to Channels.tsx
  - [x] 1.2 Add `toggleChannelSelection(channelId: number)` callback
  - [x] 1.3 Add `selectAllChannels()` and `clearSelection()` callbacks
  - [x] 1.4 Pass selection props to DraggableXmltvChannelsList

- [x] Task 2: Add checkbox UI to channel rows (AC: #1)
  - [x] 2.1 Add checkbox column to DraggableChannelRow.tsx before drag handle
  - [x] 2.2 Checkbox reflects selection state from props
  - [x] 2.3 Clicking checkbox calls toggleChannelSelection
  - [x] 2.4 Add data-testid="channel-checkbox-{id}" for E2E tests
  - [x] 2.5 Checkbox is accessible (proper label, focusable)

- [x] Task 3: Create BulkActionToolbar component (AC: #1, #2, #3)
  - [x] 3.1 Create `src/components/channels/BulkActionToolbar.tsx`
  - [x] 3.2 Show when selectedChannelIds.size > 0
  - [x] 3.3 Display count: "{n} channels selected"
  - [x] 3.4 "Enable Selected" button (primary action)
  - [x] 3.5 "Disable Selected" button
  - [x] 3.6 "Clear Selection" button
  - [x] 3.7 Toolbar positioned sticky at bottom of channels list
  - [x] 3.8 Add data-testid="bulk-action-toolbar" for E2E tests

- [x] Task 4: Create backend bulk toggle command (AC: #2, #3)
  - [x] 4.1 Add `bulk_toggle_channels` in `src-tauri/src/commands/xmltv_channels.rs`
  - [x] 4.2 Accept `channel_ids: Vec<i32>` and `enabled: bool`
  - [x] 4.3 Return `BulkToggleResult { success_count, skipped_count, skipped_ids }`
  - [x] 4.4 For enable=true: Skip channels without matched streams (skipped_ids)
  - [x] 4.5 Use database transaction for atomicity
  - [x] 4.6 Register command in `src-tauri/src/lib.rs`
  - [x] 4.7 Add TypeScript binding in `src/lib/tauri.ts`

- [x] Task 5: Implement bulk enable with warning (AC: #2)
  - [x] 5.1 Add `bulkToggleMutation` to Channels.tsx
  - [x] 5.2 On "Enable Selected" click: call `bulk_toggle_channels(ids, true)`
  - [x] 5.3 Show success toast with counts: "Enabled {n} channels"
  - [x] 5.4 If skipped_count > 0: show warning "Skipped {n} channels without streams"
  - [x] 5.5 Clear selection after successful operation
  - [x] 5.6 Invalidate query cache to refresh list

- [x] Task 6: Implement bulk disable (AC: #3)
  - [x] 6.1 On "Disable Selected" click: call `bulk_toggle_channels(ids, false)`
  - [x] 6.2 Show success toast: "Disabled {n} channels"
  - [x] 6.3 Clear selection after successful operation

- [x] Task 7: Implement "Select All Matched" (AC: #4)
  - [x] 7.1 Add "Select All Matched" button to toolbar or header area
  - [x] 7.2 Filters channels where `matchCount > 0`
  - [x] 7.3 Adds all matched channel IDs to selection
  - [x] 7.4 Button text updates: "Select All Matched ({n})"

- [x] Task 8: Add category filter with filtered selection (AC: #5)
  - [x] 8.1 Extract unique categories from channels (from XMLTV source)
  - [x] 8.2 Add category filter dropdown above channel list
  - [x] 8.3 Filter displayed channels by selected category
  - [x] 8.4 "Select All" only selects visible (filtered) channels
  - [x] 8.5 Bulk actions only apply to selected channels (not filtered)
  - [x] 8.6 Add data-testid="category-filter" for E2E tests

- [x] Task 9: Testing and verification
  - [x] 9.1 Run `cargo check` - verify no Rust errors
  - [x] 9.2 Run `npx tsc --noEmit` - verify TypeScript compiles
  - [x] 9.3 All Rust tests pass (107 tests)
  - [x] 9.4 All E2E tests pass for bulk operations scenarios (14 tests)

## Dev Notes

### CRITICAL: Architecture Compliance

**XMLTV-First Design:** XMLTV channels are the PRIMARY channel list for Plex. Bulk operations apply to XMLTV channels, affecting their `is_enabled` status in `xmltv_channel_settings`.

**From PRD FR24:**
> FR24: User can bulk-enable or bulk-disable channels

[Source: _bmad-output/planning-artifacts/epics.md#Story 3.7]

### Database Schema Reference

**Existing Table (from Story 3-5):**

```sql
CREATE TABLE xmltv_channel_settings (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER NOT NULL UNIQUE REFERENCES xmltv_channels(id) ON DELETE CASCADE,
    is_enabled INTEGER DEFAULT 0,
    plex_display_order INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_xmltv_channel_settings_enabled_order
    ON xmltv_channel_settings(is_enabled, plex_display_order);
```

[Source: _bmad-output/planning-artifacts/architecture.md#Database Schema]

### Existing Code to Leverage

**Backend - `src-tauri/src/commands/xmltv_channels.rs`:**
- `toggle_xmltv_channel` - Single channel toggle logic (line ~130)
- Uses upsert pattern with `ON CONFLICT DO UPDATE`
- Returns `XmltvChannelWithMappings` after toggle

**Frontend - `src/views/Channels.tsx`:**
- Already has `toggleMutation` for single channel toggle
- TanStack Query pattern for optimistic updates and cache invalidation
- Toast notification system (`showToast`)
- Query key: `['xmltv-channels-with-mappings']`

**Frontend - `src/components/channels/DraggableXmltvChannelsList.tsx`:**
- Receives channels array via props
- Uses TanStack Virtual for efficient rendering
- Already has callbacks: `onToggleChannel`, `onReorder`
- **ADD:** `selectedChannelIds`, `onToggleSelection` props

**Frontend - `src/components/channels/DraggableChannelRow.tsx`:**
- Memoized row component
- Has drag handle, toggle switch, expand/collapse
- **MODIFY:** Add checkbox before drag handle

**Frontend - `src/lib/tauri.ts`:**
- Existing `toggleXmltvChannel(channelId: number)`
- **ADD:** `bulkToggleChannels(channelIds: number[], enabled: boolean)`

### Backend Implementation Guide

**New Command in `src-tauri/src/commands/xmltv_channels.rs`:**

```rust
/// Result of bulk toggle operation
#[derive(Debug, Clone, serde::Serialize)]
pub struct BulkToggleResult {
    pub success_count: i32,
    pub skipped_count: i32,
    pub skipped_ids: Vec<i32>,
}

/// Bulk enable/disable XMLTV channels
/// Story 3-7: Bulk Channel Operations
///
/// For enable=true: Skips channels without matched Xtream streams
/// For enable=false: Disables all selected channels
#[tauri::command]
pub fn bulk_toggle_channels(
    db: State<DbConnection>,
    channel_ids: Vec<i32>,
    enabled: bool,
) -> Result<BulkToggleResult, String> {
    use crate::db::schema::{xmltv_channel_settings, channel_mappings};
    use diesel::dsl::count;

    let conn = &mut *db.0.lock().map_err(|e| e.to_string())?;

    let mut success_count = 0;
    let mut skipped_ids = Vec::new();

    conn.transaction::<_, diesel::result::Error, _>(|conn| {
        for &channel_id in &channel_ids {
            // If enabling, check if channel has matched streams
            if enabled {
                let match_count: i64 = channel_mappings::table
                    .filter(channel_mappings::xmltv_channel_id.eq(channel_id))
                    .select(count(channel_mappings::id))
                    .first(conn)?;

                if match_count == 0 {
                    // Skip channels without streams
                    skipped_ids.push(channel_id);
                    continue;
                }
            }

            // Upsert the settings record
            diesel::insert_into(xmltv_channel_settings::table)
                .values((
                    xmltv_channel_settings::xmltv_channel_id.eq(channel_id),
                    xmltv_channel_settings::is_enabled.eq(enabled as i32),
                ))
                .on_conflict(xmltv_channel_settings::xmltv_channel_id)
                .do_update()
                .set((
                    xmltv_channel_settings::is_enabled.eq(enabled as i32),
                    xmltv_channel_settings::updated_at.eq(diesel::dsl::now),
                ))
                .execute(conn)?;

            success_count += 1;
        }
        Ok(())
    }).map_err(|e| format!("Bulk toggle failed: {}", e))?;

    // Log the bulk operation
    eprintln!("[INFO] Bulk toggle: {} channels {}, {} skipped",
        success_count,
        if enabled { "enabled" } else { "disabled" },
        skipped_ids.len()
    );

    Ok(BulkToggleResult {
        success_count,
        skipped_count: skipped_ids.len() as i32,
        skipped_ids,
    })
}
```

**Register in `src-tauri/src/lib.rs`:**
```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    commands::xmltv_channels::bulk_toggle_channels,
])
```

### Frontend Implementation Guide

**TypeScript Binding (`src/lib/tauri.ts`):**

```typescript
/**
 * Result of bulk toggle operation
 */
export interface BulkToggleResult {
  successCount: number;
  skippedCount: number;
  skippedIds: number[];
}

/**
 * Bulk enable/disable XMLTV channels
 * Story 3-7: Bulk Channel Operations
 */
export async function bulkToggleChannels(
  channelIds: number[],
  enabled: boolean
): Promise<BulkToggleResult> {
  return invoke('bulk_toggle_channels', { channelIds, enabled });
}
```

**Selection State Management (Channels.tsx):**

```typescript
// Add to Channels component
const [selectedChannelIds, setSelectedChannelIds] = useState<Set<number>>(new Set());

const toggleChannelSelection = useCallback((channelId: number) => {
  setSelectedChannelIds((prev) => {
    const next = new Set(prev);
    if (next.has(channelId)) {
      next.delete(channelId);
    } else {
      next.add(channelId);
    }
    return next;
  });
}, []);

const selectAllMatched = useCallback(() => {
  const matchedIds = channels
    .filter((ch) => ch.matchCount > 0)
    .map((ch) => ch.id);
  setSelectedChannelIds(new Set(matchedIds));
}, [channels]);

const selectAllVisible = useCallback((visibleChannels: XmltvChannelWithMappings[]) => {
  const visibleIds = visibleChannels.map((ch) => ch.id);
  setSelectedChannelIds(new Set(visibleIds));
}, []);

const clearSelection = useCallback(() => {
  setSelectedChannelIds(new Set());
}, []);
```

**Bulk Toggle Mutation:**

```typescript
// Bulk toggle mutation (Story 3-7)
const bulkToggleMutation = useMutation({
  mutationFn: ({ channelIds, enabled }: { channelIds: number[]; enabled: boolean }) =>
    bulkToggleChannels(channelIds, enabled),
  onSuccess: (result, { enabled }) => {
    const action = enabled ? 'Enabled' : 'Disabled';
    showToast(`${action} ${result.successCount} channels`, 'success');

    if (result.skippedCount > 0 && enabled) {
      // Show warning for skipped channels (only when enabling)
      setTimeout(() => {
        showToast(`Skipped ${result.skippedCount} channels without streams`, 'error');
      }, 1500);
    }

    // Clear selection and refresh
    clearSelection();
    queryClient.invalidateQueries({ queryKey: ['xmltv-channels-with-mappings'] });
  },
  onError: (err) => {
    showToast(`Bulk operation failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
  },
});
```

**BulkActionToolbar Component:**

```tsx
// src/components/channels/BulkActionToolbar.tsx
interface BulkActionToolbarProps {
  selectedCount: number;
  onEnableSelected: () => void;
  onDisableSelected: () => void;
  onClearSelection: () => void;
  isLoading?: boolean;
}

export function BulkActionToolbar({
  selectedCount,
  onEnableSelected,
  onDisableSelected,
  onClearSelection,
  isLoading = false,
}: BulkActionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      data-testid="bulk-action-toolbar"
      className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg flex items-center justify-between z-10"
    >
      <span className="text-sm font-medium text-gray-700">
        {selectedCount} channel{selectedCount !== 1 ? 's' : ''} selected
      </span>

      <div className="flex items-center gap-2">
        <button
          onClick={onEnableSelected}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          Enable Selected
        </button>
        <button
          onClick={onDisableSelected}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          Disable Selected
        </button>
        <button
          onClick={onClearSelection}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Clear Selection
        </button>
      </div>
    </div>
  );
}
```

**Checkbox in DraggableChannelRow:**

```tsx
// Add to DraggableChannelRow.tsx props
interface DraggableChannelRowProps {
  // ... existing props ...
  isSelected?: boolean;
  onToggleSelection?: (channelId: number) => void;
}

// In the row component, add checkbox before drag handle
<input
  type="checkbox"
  data-testid={`channel-checkbox-${channel.id}`}
  checked={isSelected}
  onChange={() => onToggleSelection?.(channel.id)}
  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
  aria-label={`Select ${channel.displayName}`}
/>
```

### Category Filter Implementation

XMLTV channels may have category information. Check `xmltv_channels` table for category field or parse from source.

```typescript
// Extract unique categories
const categories = useMemo(() => {
  const cats = new Set<string>();
  channels.forEach((ch) => {
    // Category may be in xmltv channel data or inferred from matches
    if (ch.category) cats.add(ch.category);
  });
  return Array.from(cats).sort();
}, [channels]);

// Category filter state
const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

// Filtered channels
const filteredChannels = useMemo(() => {
  if (!categoryFilter) return channels;
  return channels.filter((ch) => ch.category === categoryFilter);
}, [channels, categoryFilter]);
```

**Note:** If category is not available in current schema, this task may need to be deferred or simplified to just "Select All Visible" which selects currently displayed (potentially filtered) channels.

### Previous Story Intelligence (Story 3-6)

**Key Patterns Established:**
1. **Optimistic updates with TanStack Query** - REUSE for bulk operations
2. **Error handling with toast notifications** - REUSE
3. **Mutation with onMutate, onError, onSuccess, onSettled** - REUSE pattern
4. **State stored in ref for rollback** - ADAPT (selection state is simpler)

**Code Review Learnings from 3-6:**
- Remove unused packages (dnd-kit was installed but HTML5 DnD used instead)
- Remove console.log statements before completion
- Add ARIA live region for screen reader feedback on bulk operations
- Add input validation (e.g., empty array check)

### Git Intelligence

**Recent Commits (from Story 3-6):**
- `fb7eb3e` - Code review fixes for story 3-6
- `a738f31` - Implement story 3-6: Drag-and-drop channel reordering

**Patterns from Recent Work:**
- Commands registered in `src-tauri/src/lib.rs` invoke_handler
- TypeScript types/functions in `src/lib/tauri.ts`
- TanStack Query cache invalidation via `queryClient.invalidateQueries()`
- Radix UI components for accessible controls
- lucide-react for icons

### Project Structure Notes

**Files to Create:**
- `src/components/channels/BulkActionToolbar.tsx` - Bulk action toolbar component
- `src/components/channels/CategoryFilter.tsx` - Category filter dropdown (if categories available)

**Files to Modify:**
- `src-tauri/src/commands/xmltv_channels.rs` - Add `bulk_toggle_channels` command
- `src-tauri/src/lib.rs` - Register new command
- `src/lib/tauri.ts` - Add `bulkToggleChannels` binding and `BulkToggleResult` type
- `src/views/Channels.tsx` - Add selection state, bulk mutation, toolbar integration
- `src/components/channels/DraggableXmltvChannelsList.tsx` - Pass selection props to rows
- `src/components/channels/DraggableChannelRow.tsx` - Add checkbox UI
- `src/components/channels/index.ts` - Export new components

### Alignment with Unified Project Structure

- Backend commands follow pattern: `src-tauri/src/commands/{module}.rs`
- Frontend components: `src/components/channels/{Component}.tsx`
- TypeScript bindings: `src/lib/tauri.ts`
- Views: `src/views/{View}.tsx`
- All aligned with existing project structure

### Testing Requirements

**Rust Unit Tests:**
- Test `bulk_toggle_channels` with valid channel IDs
- Test enable skips channels without streams
- Test disable affects all selected
- Test empty array (no-op)
- Test transaction rollback on error

**E2E Tests (Playwright):**
- Test selecting multiple channels via checkboxes
- Test bulk action toolbar appears when selection > 0
- Test "Enable Selected" enables matched channels
- Test warning shown for channels without streams
- Test "Disable Selected" disables all selected
- Test "Select All Matched" selects only matched channels
- Test "Clear Selection" clears all selections
- Test category filter (if implemented)
- Test selection persists during filtering

### Performance Considerations

- **Batch database updates:** Single transaction for all toggle operations
- **Efficient selection state:** Use `Set<number>` for O(1) lookup
- **Virtualization preserved:** Checkbox rendering within virtual list
- **Optimistic UI:** Instant feedback, async persistence

### Accessibility Requirements

- Checkboxes must be focusable and operable via keyboard
- Screen reader announces selection count changes
- Bulk action toolbar accessible via keyboard navigation
- Clear visual indication of selected state
- ARIA live region for bulk operation results

### Error Handling

- Database transaction failure: Roll back all changes, show toast
- Network error: Show toast, don't clear selection (allow retry)
- Empty selection: Disable bulk action buttons (defensive)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend (React) - Tailwind, Radix UI]
- [Source: _bmad-output/planning-artifacts/architecture.md#Database Schema - xmltv_channel_settings]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7]
- [Source: src-tauri/src/commands/xmltv_channels.rs - toggle_xmltv_channel implementation]
- [Source: src/views/Channels.tsx - toggleMutation pattern]
- [Source: src/components/channels/DraggableChannelRow.tsx - row component structure]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Implementation completed without issues requiring debug.

### Completion Notes List

1. **All 5 Acceptance Criteria implemented and tested:**
   - AC1: Bulk action toolbar appears when channels selected via checkboxes
   - AC2: Enable Selected enables matched channels, shows warning count for unmatched
   - AC3: Disable Selected disables all selected channels
   - AC4: Select All Matched button selects only channels with streams
   - AC5: Category filter allows selecting filtered channels only

2. **Backend Implementation:**
   - New `bulk_toggle_channels` command in Rust with transaction support
   - Returns `BulkToggleResult` with success/skipped counts and IDs
   - Properly skips enabling channels without matched streams

3. **Frontend Implementation:**
   - Selection state with `Set<number>` for O(1) operations
   - BulkActionToolbar component with Enable/Disable/Clear buttons
   - Checkbox column added to DraggableChannelRow
   - Category filter extracts patterns from channel names
   - "Select All Matched" button with count display

4. **Test Results:**
   - TypeScript: ✅ Compiles without errors
   - Rust: ✅ 107 tests pass
   - E2E: ✅ 14 tests pass (bulk-channel-operations.spec.ts)

5. **Test Fix Applied:**
   - Fixed AC5 test selector ambiguity (used `exact: true` for "Select All" button)

### File List

**Created:**
- `src/components/channels/BulkActionToolbar.tsx` - Bulk action toolbar component

**Modified:**
- `src-tauri/src/commands/xmltv_channels.rs` - Added `bulk_toggle_channels` command and `BulkToggleResult` struct
- `src-tauri/src/lib.rs` - Registered `bulk_toggle_channels` command
- `src/lib/tauri.ts` - Added `bulkToggleChannels` function and `BulkToggleResult` type
- `src/views/Channels.tsx` - Added selection state, category filter, bulk mutations, toolbar integration
- `src/components/channels/DraggableXmltvChannelsList.tsx` - Added selection props passthrough
- `src/components/channels/DraggableChannelRow.tsx` - Added checkbox UI with accessibility
- `src/components/channels/index.ts` - Export BulkActionToolbar
- `tests/e2e/bulk-channel-operations.spec.ts` - Fixed AC5 test selector
