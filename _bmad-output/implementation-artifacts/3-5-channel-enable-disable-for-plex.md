# Story 3.5: Channel Enable/Disable for Plex

Status: ready-for-dev

## Story

As a user,
I want to enable or disable XMLTV channels for my Plex lineup,
So that only the channels I want appear in Plex.

## Acceptance Criteria

1. **Given** an XMLTV channel row in the Channels view
   **When** I click the enable/disable toggle
   **Then** the `xmltv_channel_settings.is_enabled` status is updated immediately
   **And** the change is persisted to database

2. **Given** an XMLTV channel is disabled
   **When** the M3U playlist is generated for Plex
   **Then** the disabled channel is excluded

3. **Given** an XMLTV channel has no matched Xtream streams
   **When** I try to enable it
   **Then** I see a warning: "No stream source available"
   **And** the channel cannot be enabled until a stream is matched

4. **Given** I restart the app
   **When** the Channels view loads
   **Then** all enable/disable states are preserved (FR25)

## Tasks / Subtasks

- [ ] Task 1: Verify existing toggle implementation (AC: #1)
  - [ ] 1.1 Verify `toggle_xmltv_channel` command in `src-tauri/src/commands/xmltv_channels.rs` works correctly
  - [ ] 1.2 Verify frontend `toggleXmltvChannel()` in `src/lib/tauri.ts` invokes backend correctly
  - [ ] 1.3 Verify UI toggle in `XmltvChannelRow.tsx` correctly shows enabled/disabled state
  - [ ] 1.4 Verify optimistic cache updates in `Channels.tsx`

- [ ] Task 2: Add enable prevention for unmatched channels (AC: #3)
  - [ ] 2.1 Update `toggle_xmltv_channel` backend to check for matched streams before enabling
  - [ ] 2.2 Return error with message "No stream source available" if no matches and trying to enable
  - [ ] 2.3 Update `XmltvChannelRow.tsx` to disable toggle and show tooltip when no matches
  - [ ] 2.4 Add toast notification on frontend when enable is blocked

- [ ] Task 3: Verify M3U playlist integration (AC: #2)
  - [ ] 3.1 Verify M3U generation in `src-tauri/src/server/m3u.rs` filters by `is_enabled`
  - [ ] 3.2 If M3U endpoint not yet implemented, stub placeholder for Epic 4

- [ ] Task 4: Verify persistence across restarts (AC: #4)
  - [ ] 4.1 Verify `xmltv_channel_settings` table persists correctly
  - [ ] 4.2 Verify `getXmltvChannelsWithMappings()` loads `is_enabled` from database
  - [ ] 4.3 Manual test: toggle channels, restart app, verify state preserved

- [ ] Task 5: Testing and verification
  - [ ] 5.1 Run `cargo check` - verify no Rust errors
  - [ ] 5.2 Run `pnpm exec tsc --noEmit` - verify TypeScript compiles
  - [ ] 5.3 Run `cargo test` - verify Rust tests pass
  - [ ] 5.4 Full build succeeds with `pnpm build`

## Dev Notes

### CRITICAL: Existing Implementation Status

**ALREADY IMPLEMENTED (from Stories 3-2 and 3-3):**
- Backend `toggle_xmltv_channel` command: `src-tauri/src/commands/xmltv_channels.rs:735-821`
- Frontend `toggleXmltvChannel()`: `src/lib/tauri.ts:696-700`
- UI toggle component: `src/components/channels/XmltvChannelRow.tsx:173-182`
- Toggle mutation: `src/views/Channels.tsx:47-65`
- Virtualized list integration: `src/components/channels/XmltvChannelsList.tsx:96-110`

**NEEDS IMPLEMENTATION:**
1. AC #3: Prevent enabling channels without matched streams (warning + block)
2. AC #2: M3U filtering (may be Epic 4 scope - verify)
3. AC #4: Verification that persistence works

### Architecture Compliance

**CRITICAL DESIGN PRINCIPLE:** XMLTV channels are the PRIMARY channel list for Plex. Users enable/disable XMLTV channels to control what appears in Plex lineup.

**From PRD FR22:**
> FR22: User can enable or disable individual channels

**From PRD FR25:**
> FR25: System can remember channel order and enabled state across restarts

**From PRD FR26:**
> FR26: Unmatched channels default to disabled

[Source: _bmad-output/planning-artifacts/epics.md#Story 3.5]

### Database Schema Reference

**Existing Tables (from previous stories):**

```sql
-- XMLTV channel settings for Plex lineup (one per XMLTV channel)
CREATE TABLE xmltv_channel_settings (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER NOT NULL UNIQUE REFERENCES xmltv_channels(id) ON DELETE CASCADE,
    is_enabled INTEGER DEFAULT 0,  -- 0 = disabled (default), 1 = enabled
    plex_display_order INTEGER,     -- Channel order in Plex lineup
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Index for ordering enabled channels in Plex lineup
CREATE INDEX idx_xmltv_channel_settings_enabled_order
    ON xmltv_channel_settings(is_enabled, plex_display_order);
```

[Source: _bmad-output/planning-artifacts/architecture.md#Database Schema]

### Existing Code to Leverage

**Backend `toggle_xmltv_channel` (lines 735-821):**
```rust
#[tauri::command]
pub fn toggle_xmltv_channel(
    db: State<DbConnection>,
    channel_id: i32,
) -> Result<XmltvChannelWithMappings, String>
```
- Already handles toggle logic
- Creates settings record if not exists
- Returns updated channel with mappings
- **NEEDS:** Add check for matched streams before enabling

**Frontend toggle hook (`Channels.tsx:47-65`):**
```typescript
const toggleMutation = useMutation({
  mutationFn: (channelId: number) => toggleXmltvChannel(channelId),
  onSuccess: (updatedChannel) => { ... },
  onError: (err) => { ... },
});
```
- Already has optimistic updates
- Already handles errors with toast
- **NEEDS:** No changes needed if backend returns proper error

**UI Toggle (`XmltvChannelRow.tsx:173-182`):**
```tsx
<Switch.Root
  checked={channel.isEnabled}
  onCheckedChange={onToggleEnabled}
  disabled={isTogglingEnabled}
  ...
/>
```
- Uses Radix UI Switch component
- **NEEDS:** Add `disabled` when `matchCount === 0` + tooltip

### Implementation Guide for AC #3 (Enable Prevention)

**Backend Changes (`src-tauri/src/commands/xmltv_channels.rs`):**

In `toggle_xmltv_channel`, before allowing enable:

```rust
// Check if trying to enable a channel with no matches
if !channel.isEnabled {
    // We're trying to enable - check for matches
    let match_count: i64 = channel_mappings::table
        .filter(channel_mappings::xmltv_channel_id.eq(channel_id))
        .count()
        .get_result(conn)?;

    if match_count == 0 {
        return Err("Cannot enable channel: No stream source available. Match an Xtream stream first.".to_string());
    }
}
```

**Frontend Changes (`src/components/channels/XmltvChannelRow.tsx`):**

```tsx
// Disable toggle and add tooltip when no matches
const cannotEnable = !channel.isEnabled && channel.matchCount === 0;

<div title={cannotEnable ? "No stream source available" : undefined}>
  <Switch.Root
    checked={channel.isEnabled}
    onCheckedChange={onToggleEnabled}
    disabled={isTogglingEnabled || cannotEnable}
    ...
  />
</div>
```

### Previous Story Intelligence (Story 3-4)

**Key Patterns Established:**
1. Error handling with toast notifications in `Channels.tsx`
2. Optimistic updates with TanStack Query cache
3. Transactions for database atomicity
4. Event logging for significant actions

**Code Review Learnings:**
- Add input validation before operations
- Use descriptive error messages
- Handle edge cases gracefully

### Git Intelligence

**Recent Commits:**
- `287bcd1` - Add fuzzy search API, orphaned stream detection, and code review fixes
- `b230f55` - Code review fixes for story 3-4: Auto-rematch on provider changes

**Patterns from Recent Work:**
- Commands registered in `src-tauri/src/lib.rs`
- TypeScript types in `src/lib/tauri.ts`
- TanStack Query cache invalidation for data sync
- Radix UI components for accessible controls

### Project Structure Notes

**Files to Modify:**
- `src-tauri/src/commands/xmltv_channels.rs` - Add enable prevention check
- `src/components/channels/XmltvChannelRow.tsx` - Add disabled state for unmatched

**Files to Verify (already implemented):**
- `src/lib/tauri.ts` - `toggleXmltvChannel()` exists
- `src/views/Channels.tsx` - Toggle mutation exists
- `src/components/channels/XmltvChannelsList.tsx` - Toggle handler exists

### Testing Requirements

**Rust Unit Tests:**
- Test enable blocked when no matches
- Test enable allowed when matches exist
- Test disable always allowed

**Manual Testing:**
1. Toggle enable/disable on matched channel - should work
2. Try to enable unmatched channel - should show error/warning
3. Disable channel, restart app, verify disabled state persists
4. Enable channel, restart app, verify enabled state persists

### Performance Considerations

- Toggle operation is fast (single row update)
- No performance concerns for this story
- Persistence already optimized with indexed table

### Error Handling

- Return clear error message when enable blocked
- Show toast notification to user
- Log event for enable attempts on unmatched channels

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Database Schema]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.5]
- [Source: src-tauri/src/commands/xmltv_channels.rs:735-821 - toggle_xmltv_channel]
- [Source: src/components/channels/XmltvChannelRow.tsx:173-182 - Switch component]
- [Source: src/views/Channels.tsx:47-65 - toggle mutation]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
