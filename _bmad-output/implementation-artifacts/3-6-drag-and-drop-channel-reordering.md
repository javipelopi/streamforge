# Story 3.6: Drag-and-Drop Channel Reordering

Status: ready-for-dev

## Story

As a user,
I want to reorder my XMLTV channels by dragging them,
So that I can organize my Plex channel lineup to my preference.

## Acceptance Criteria

1. **Given** the Channels view
   **When** I drag an XMLTV channel row
   **Then** visual feedback shows the dragging state
   **And** drop zones are highlighted

2. **Given** I drop a channel in a new position
   **When** the drop completes
   **Then** the `xmltv_channel_settings.plex_display_order` values are recalculated
   **And** the M3U playlist reflects the new order

3. **Given** I reorder channels
   **When** I restart the app
   **Then** the custom order is preserved (FR25)

**Implementation notes:** Use dnd-kit library for accessible drag-and-drop.

## Tasks / Subtasks

- [ ] Task 1: Install and configure dnd-kit (AC: #1)
  - [ ] 1.1 Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` packages
  - [ ] 1.2 Configure dnd-kit sensors (pointer, keyboard) for accessibility
  - [ ] 1.3 Test installation with basic example

- [ ] Task 2: Create backend reorder command (AC: #2)
  - [ ] 2.1 Add `update_channel_order` Tauri command in `src-tauri/src/commands/xmltv_channels.rs`
  - [ ] 2.2 Accept array of channel IDs in new order
  - [ ] 2.3 Update `plex_display_order` for each channel in transaction
  - [ ] 2.4 Register command in `src-tauri/src/lib.rs`
  - [ ] 2.5 Add TypeScript binding in `src/lib/tauri.ts`

- [ ] Task 3: Integrate dnd-kit with virtualized list (AC: #1, #2)
  - [ ] 3.1 Create `SortableXmltvChannelsList.tsx` wrapper component
  - [ ] 3.2 Integrate `DndContext` and `SortableContext` with TanStack Virtual
  - [ ] 3.3 Create `SortableChannelRow.tsx` with `useSortable` hook
  - [ ] 3.4 Add drag handle UI element (grip icon)
  - [ ] 3.5 Implement `DragOverlay` for visual feedback during drag

- [ ] Task 4: Implement drag visual feedback (AC: #1)
  - [ ] 4.1 Style dragging row with elevation/shadow
  - [ ] 4.2 Add drop zone highlighting between rows
  - [ ] 4.3 Show placeholder in original position during drag
  - [ ] 4.4 Animate items moving to make room

- [ ] Task 5: Handle drop and persist order (AC: #2)
  - [ ] 5.1 Implement `onDragEnd` handler to call backend
  - [ ] 5.2 Optimistically update local state for instant feedback
  - [ ] 5.3 Roll back on error with toast notification
  - [ ] 5.4 Invalidate query cache after successful reorder

- [ ] Task 6: Verify persistence (AC: #3)
  - [ ] 6.1 Verify `getXmltvChannelsWithMappings` returns channels ordered by `plex_display_order`
  - [ ] 6.2 Test: reorder, restart app, verify order preserved
  - [ ] 6.3 Add ORDER BY clause to query if not present

- [ ] Task 7: Testing and verification
  - [ ] 7.1 Run `cargo check` - verify no Rust errors
  - [ ] 7.2 Run `pnpm exec tsc --noEmit` - verify TypeScript compiles
  - [ ] 7.3 Run `cargo test` - verify Rust tests pass
  - [ ] 7.4 Full build succeeds with `pnpm build`
  - [ ] 7.5 Write E2E tests for drag-and-drop scenarios

## Dev Notes

### CRITICAL: Architecture Compliance

**XMLTV-First Design:** XMLTV channels are the PRIMARY channel list for Plex. Reordering controls the `plex_display_order` which defines channel numbers in the M3U playlist served to Plex.

**From PRD FR23:**
> FR23: User can reorder channels via drag-and-drop

**From PRD FR25:**
> FR25: System can remember channel order and enabled state across restarts

[Source: _bmad-output/planning-artifacts/epics.md#Story 3.6]

### Required Library: dnd-kit

**Architecture specifies dnd-kit:**
> **Drag & Drop** | dnd-kit | Modern, accessible drag-drop for channel ordering

[Source: _bmad-output/planning-artifacts/architecture.md#Frontend (React)]

**Installation:**
```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Key dnd-kit Concepts:**
- `DndContext` - Wraps drag-and-drop area
- `SortableContext` - Provides sortable list context
- `useSortable` - Hook for sortable items
- `DragOverlay` - Portal for drag preview
- Sensors: `PointerSensor`, `KeyboardSensor` for accessibility

### Database Schema Reference

**Existing Table (from Story 3-5):**

```sql
CREATE TABLE xmltv_channel_settings (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER NOT NULL UNIQUE REFERENCES xmltv_channels(id) ON DELETE CASCADE,
    is_enabled INTEGER DEFAULT 0,
    plex_display_order INTEGER,  -- THIS IS WHAT WE UPDATE
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_xmltv_channel_settings_enabled_order
    ON xmltv_channel_settings(is_enabled, plex_display_order);
```

[Source: _bmad-output/planning-artifacts/architecture.md#Database Schema]

### Existing Code to Leverage

**Backend - `src-tauri/src/commands/xmltv_channels.rs`:**
- `XmltvChannelWithMappings` struct already includes `plex_display_order: Option<i32>` (line 45)
- `get_xmltv_channels_with_mappings` fetches from `xmltv_channel_settings` (lines 128, 190)

**Frontend - `src/lib/tauri.ts`:**
- `XmltvChannelWithMappings` type needs `plexDisplayOrder?: number` field
- Add `updateChannelOrder(channelIds: number[])` function

**Frontend - `src/components/channels/XmltvChannelsList.tsx`:**
- Uses TanStack Virtual (`useVirtualizer`) for efficient rendering
- Row heights calculated dynamically for expand/collapse
- Keyboard navigation already implemented
- **INTEGRATION POINT:** Wrap with dnd-kit context

**Frontend - `src/components/channels/XmltvChannelRow.tsx`:**
- Memoized component for performance
- **MODIFICATION NEEDED:** Add drag handle element

### Backend Implementation Guide

**New Command in `src-tauri/src/commands/xmltv_channels.rs`:**

```rust
/// Update the display order of XMLTV channels for Plex lineup
/// Story 3-6: Drag-and-Drop Channel Reordering
#[tauri::command]
pub fn update_channel_order(
    db: State<DbConnection>,
    channel_ids: Vec<i32>,
) -> Result<(), String> {
    use crate::db::schema::xmltv_channel_settings::dsl::*;

    let conn = &mut *db.0.lock().map_err(|e| e.to_string())?;

    conn.transaction::<_, diesel::result::Error, _>(|conn| {
        for (position, channel_id) in channel_ids.iter().enumerate() {
            // Update or insert settings record with new display order
            diesel::insert_into(xmltv_channel_settings)
                .values((
                    xmltv_channel_id.eq(channel_id),
                    plex_display_order.eq(position as i32),
                ))
                .on_conflict(xmltv_channel_id)
                .do_update()
                .set((
                    plex_display_order.eq(position as i32),
                    updated_at.eq(diesel::dsl::now),
                ))
                .execute(conn)?;
        }
        Ok(())
    }).map_err(|e| format!("Failed to update channel order: {}", e))?;

    // Log the reorder event
    eprintln!("[INFO] Channel order updated: {} channels reordered", channel_ids.len());

    Ok(())
}
```

**Register in `src-tauri/src/lib.rs`:**
```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    commands::xmltv_channels::update_channel_order,
])
```

### Frontend Implementation Guide

**TypeScript Binding (`src/lib/tauri.ts`):**

```typescript
/**
 * Update the display order of XMLTV channels for Plex lineup
 * Story 3-6: Drag-and-Drop Channel Reordering
 */
export async function updateChannelOrder(channelIds: number[]): Promise<void> {
  return invoke('update_channel_order', { channelIds });
}
```

**dnd-kit Integration Pattern:**

```tsx
// SortableXmltvChannelsList.tsx
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

function SortableXmltvChannelsList({ channels, onReorder }) {
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // Prevent accidental drags
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      // Calculate new order
      const oldIndex = channels.findIndex(c => c.id === active.id);
      const newIndex = channels.findIndex(c => c.id === over.id);
      const newOrder = arrayMove(channels, oldIndex, newIndex);

      // Call reorder handler
      onReorder(newOrder.map(c => c.id));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={channels.map(c => c.id)}
        strategy={verticalListSortingStrategy}
      >
        {/* Render sortable items */}
      </SortableContext>

      <DragOverlay>
        {activeId ? <ChannelDragPreview channel={findChannel(activeId)} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
```

**Sortable Row Component:**

```tsx
// SortableChannelRow.tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

function SortableChannelRow({ channel, ...props }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: channel.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-2"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </button>

      <XmltvChannelRow channel={channel} {...props} />
    </div>
  );
}
```

### Virtualization + dnd-kit Integration

**Challenge:** TanStack Virtual renders only visible items, but dnd-kit needs all items for sorting context.

**Solution Pattern:**
1. Keep full channel ID array in `SortableContext`
2. Virtualize the rendering only
3. Use `DragOverlay` for drag preview (avoids virtualization issues)

```tsx
<SortableContext
  items={channels.map(c => c.id)} // ALL channel IDs
  strategy={verticalListSortingStrategy}
>
  <div style={{ height: virtualizer.getTotalSize() }}>
    {virtualizer.getVirtualItems().map((virtualItem) => {
      const channel = channels[virtualItem.index];
      return (
        <SortableChannelRow
          key={channel.id}
          channel={channel}
          style={{
            position: 'absolute',
            top: virtualItem.start,
            height: virtualItem.size,
          }}
        />
      );
    })}
  </div>
</SortableContext>
```

### Optimistic Updates with TanStack Query

```tsx
// In Channels.tsx
const reorderMutation = useMutation({
  mutationFn: (channelIds: number[]) => updateChannelOrder(channelIds),
  onMutate: async (newOrder) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['xmltv-channels'] });

    // Snapshot previous value
    const previous = queryClient.getQueryData(['xmltv-channels']);

    // Optimistically reorder
    queryClient.setQueryData(['xmltv-channels'], (old: XmltvChannelWithMappings[]) => {
      const orderMap = new Map(newOrder.map((id, index) => [id, index]));
      return [...old].sort((a, b) =>
        (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)
      );
    });

    return { previous };
  },
  onError: (err, _, context) => {
    // Rollback on error
    queryClient.setQueryData(['xmltv-channels'], context?.previous);
    toast.error(`Failed to reorder: ${err.message}`);
  },
  onSettled: () => {
    // Refetch to ensure consistency
    queryClient.invalidateQueries({ queryKey: ['xmltv-channels'] });
  },
});
```

### Previous Story Intelligence (Story 3-5)

**Key Patterns Established:**
1. Optimistic updates with TanStack Query cache - REUSE
2. Error handling with toast notifications - REUSE
3. Transaction-based database updates - REUSE for batch order update
4. Event logging for significant actions - ADD for reorder events

**Files Modified in 3-5:**
- `src-tauri/src/commands/xmltv_channels.rs` - Backend commands
- `src/components/channels/XmltvChannelRow.tsx` - Row component
- `src/views/Channels.tsx` - Main view with mutations

**Code Review Learnings from 3-5:**
- Add input validation before operations
- Use descriptive error messages
- Handle edge cases gracefully
- Ensure proper transaction rollback on errors

### Git Intelligence

**Recent Commits:**
- `2f9e59d` - Code review fixes for story 3-5: Channel enable/disable
- `e6775ec` - Implement story 3-5: Channel enable/disable for Plex
- `287bcd1` - Add fuzzy search API, orphaned stream detection, and code review fixes

**Patterns from Recent Work:**
- Commands registered in `src-tauri/src/lib.rs` invoke_handler
- TypeScript types/functions in `src/lib/tauri.ts`
- TanStack Query cache invalidation for data sync
- Radix UI components for accessible controls
- lucide-react for icons (use `GripVertical` for drag handle)

### Project Structure Notes

**Files to Create:**
- `src/components/channels/SortableXmltvChannelsList.tsx` - dnd-kit wrapper
- `src/components/channels/SortableChannelRow.tsx` - Sortable row with drag handle
- `src/components/channels/ChannelDragPreview.tsx` - Drag overlay preview

**Files to Modify:**
- `src-tauri/src/commands/xmltv_channels.rs` - Add `update_channel_order` command
- `src-tauri/src/lib.rs` - Register new command
- `src/lib/tauri.ts` - Add `updateChannelOrder` binding
- `src/views/Channels.tsx` - Integrate sortable list and mutation
- `src/components/channels/XmltvChannelRow.tsx` - Add drag handle slot
- `package.json` - Add dnd-kit dependencies

**Verify (query ordering):**
- `src-tauri/src/commands/xmltv_channels.rs` - Ensure ORDER BY `plex_display_order`

### Query Ordering Requirement

The `get_xmltv_channels_with_mappings` query MUST return channels ordered by `plex_display_order` for persistence to work. Check and add if missing:

```rust
// In get_xmltv_channels_with_mappings
.order_by(xmltv_channel_settings::plex_display_order.asc().nulls_last())
```

### Testing Requirements

**Rust Unit Tests:**
- Test `update_channel_order` with valid channel IDs
- Test order persists (call update, then fetch, verify order)
- Test partial order update (only some channels)
- Test empty array (no-op)
- Test non-existent channel ID (should create settings record)

**E2E Tests (Playwright):**
- Test drag channel to new position
- Test visual feedback during drag
- Test keyboard reordering (accessibility)
- Test order persists after page reload
- Test optimistic update (instant feedback)
- Test error rollback

### Performance Considerations

- **Virtualization preserved:** Only visible rows render
- **Batch database update:** Single transaction for all position updates
- **Optimistic UI:** Instant feedback, async persistence
- **Index usage:** `idx_xmltv_channel_settings_enabled_order` speeds ORDER BY

### Accessibility Requirements

- Drag handle must be focusable and operable via keyboard
- Screen reader announcements for drag start/end
- Arrow keys for keyboard reordering
- Clear visual indication of current position

### Error Handling

- Database transaction failure: Roll back all changes, show toast
- Network error: Optimistic update rolled back, show toast
- Invalid channel ID: Skip or log warning (defensive)

### M3U Integration Note (AC: #2)

The M3U endpoint (Epic 4, Story 4-1) will use `plex_display_order` for channel numbers:

```sql
-- M3U generation query (from handlers.rs TODO)
SELECT xc.*, xcs.plex_display_order
FROM xmltv_channels xc
JOIN xmltv_channel_settings xcs ON xcs.xmltv_channel_id = xc.id
WHERE xcs.is_enabled = 1
ORDER BY xcs.plex_display_order ASC NULLS LAST;
```

This story ensures the order is correctly stored; Epic 4 will consume it.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend (React) - dnd-kit specification]
- [Source: _bmad-output/planning-artifacts/architecture.md#Database Schema - xmltv_channel_settings]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6]
- [Source: src-tauri/src/commands/xmltv_channels.rs:45 - plex_display_order field]
- [Source: src/components/channels/XmltvChannelsList.tsx - virtualized list implementation]
- [Source: src/components/channels/XmltvChannelRow.tsx - row component]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
