# Story 3.11: Implement Sources View Xtream Tab

Status: ready-for-dev

## Story

As a user,
I want to browse streams from my Xtream accounts,
So that I can link streams to XMLTV channels or promote orphans to my lineup.

## Background

This story is part of the **Navigation Restructure (Option C)** from Sprint Change Proposal 2026-01-20. It adds the Xtream tab to the Sources view created in Story 3-10:

- **Story 3-9** (done): Target Lineup View - the Plex output
- **Story 3-10** (done): Sources View with XMLTV Tab - browse EPG sources
- **Story 3-11** (this): Sources View with Xtream Tab - browse streams

**User Flow After All Three:**
```
Dashboard → Target Lineup (my Plex channels)
         → Sources [XMLTV | Xtream] (find channels to add)
```

## Acceptance Criteria

1. **Given** the Sources view
   **When** I click the "Xtream" tab
   **Then** I see my Xtream accounts as expandable accordion sections
   **And** each section header shows: account name, stream count, orphan count

2. **Given** I expand an Xtream account section
   **When** the streams load (lazy-loaded per account)
   **Then** I see all streams from that account
   **And** each stream shows:
   - Stream name, icon, quality badges (HD/SD/4K)
   - "Linked" badge (blue) if mapped to an XMLTV channel
   - "Orphan" badge (amber) if not mapped to any channel
   - "Promoted" badge (green) if has synthetic channel in lineup

3. **Given** I click a linked stream
   **When** the action menu opens
   **Then** I can see which XMLTV channel(s) it's linked to
   **And** I can unlink or change the link

4. **Given** I click an orphan stream
   **When** the action menu opens
   **Then** I can "Promote to Lineup" (create synthetic channel + enable)
   **And** I can "Link to XMLTV Channel" (manual match to existing XMLTV channel)

## Tasks / Subtasks

### Backend - Xtream Streams with Mapping Status

- [ ] Task 1: Create `get_xtream_streams_for_account` command (AC: #1, #2)
  - [ ] 1.1 Add new command in `src-tauri/src/commands/channels.rs`
  - [ ] 1.2 Create response type `XtreamAccountStream`:
    ```rust
    #[derive(Debug, Serialize, Clone)]
    #[serde(rename_all = "camelCase")]
    pub struct XtreamAccountStream {
        pub id: i32,
        pub stream_id: i32,
        pub name: String,
        pub stream_icon: Option<String>,
        pub qualities: Vec<String>,
        pub category_name: Option<String>,
        /// "linked" | "orphan" | "promoted"
        pub link_status: String,
        /// XMLTV channel IDs this stream is linked to (empty if orphan)
        pub linked_xmltv_ids: Vec<i32>,
        /// If promoted, the synthetic channel ID
        pub synthetic_channel_id: Option<i32>,
    }
    ```
  - [ ] 1.3 Query streams with mapping and synthetic status:
    ```sql
    SELECT xc.*,
           GROUP_CONCAT(cm.xmltv_channel_id) as linked_ids,
           (SELECT xch.id FROM xmltv_channels xch
            WHERE xch.is_synthetic = 1
            AND EXISTS (SELECT 1 FROM channel_mappings cm2
                        WHERE cm2.xmltv_channel_id = xch.id
                        AND cm2.xtream_channel_id = xc.id)) as synthetic_id
    FROM xtream_channels xc
    LEFT JOIN channel_mappings cm ON xc.id = cm.xtream_channel_id
    WHERE xc.account_id = ?
    GROUP BY xc.id
    ORDER BY xc.name ASC
    ```
  - [ ] 1.4 Determine link_status: "promoted" if synthetic_id exists, "linked" if linked_ids not empty, else "orphan"
  - [ ] 1.5 Register command in `src-tauri/src/lib.rs`

- [ ] Task 2: Create `get_account_stream_stats` command (AC: #1)
  - [ ] 2.1 Add new command in `src-tauri/src/commands/channels.rs`
  - [ ] 2.2 Create response type `AccountStreamStats`:
    ```rust
    #[derive(Debug, Serialize, Clone)]
    #[serde(rename_all = "camelCase")]
    pub struct AccountStreamStats {
        pub stream_count: i32,
        pub linked_count: i32,
        pub orphan_count: i32,
        pub promoted_count: i32,
    }
    ```
  - [ ] 2.3 Query to count streams by status for efficient header display
  - [ ] 2.4 Register command in `src-tauri/src/lib.rs`

### Frontend - TypeScript Bindings

- [ ] Task 3: Add TypeScript types and bindings (AC: #1, #2)
  - [ ] 3.1 Add `XtreamAccountStream` interface to `src/lib/tauri.ts`:
    ```typescript
    export interface XtreamAccountStream {
      id: number;
      streamId: number;
      name: string;
      streamIcon: string | null;
      qualities: string[];
      categoryName: string | null;
      /** "linked" | "orphan" | "promoted" */
      linkStatus: 'linked' | 'orphan' | 'promoted';
      /** XMLTV channel IDs this stream is linked to */
      linkedXmltvIds: number[];
      /** If promoted, the synthetic channel ID */
      syntheticChannelId: number | null;
    }
    ```
  - [ ] 3.2 Add `AccountStreamStats` interface:
    ```typescript
    export interface AccountStreamStats {
      streamCount: number;
      linkedCount: number;
      orphanCount: number;
      promotedCount: number;
    }
    ```
  - [ ] 3.3 Add `getXtreamStreamsForAccount(accountId: number): Promise<XtreamAccountStream[]>`
  - [ ] 3.4 Add `getAccountStreamStats(accountId: number): Promise<AccountStreamStats>`

### Frontend - Xtream Tab Implementation

- [ ] Task 4: Enable Xtream tab in Sources view (AC: #1)
  - [ ] 4.1 Edit `src/views/Sources.tsx`:
    - Remove `disabled` attribute from Xtream tab button
    - Remove "Soon" badge from Xtream tab
    - Remove `cursor-not-allowed` and gray styling
    - Add click handler: `onClick={() => setActiveTab('xtream')}`
    - Add conditional rendering for `XtreamSourcesTab` component
  - [ ] 4.2 Update test file to remove "disabled" test expectations

- [ ] Task 5: Create `XtreamSourcesTab` component (AC: #1, #2)
  - [ ] 5.1 Create `src/components/sources/XtreamSourcesTab.tsx`
  - [ ] 5.2 Use TanStack Query to fetch accounts: `useQuery(['accounts'], getAccounts)`
  - [ ] 5.3 Display loading skeleton during initial fetch
  - [ ] 5.4 Handle empty state: "No Xtream accounts configured. Add accounts in Accounts."
  - [ ] 5.5 Render `XtreamAccountAccordion` for each account
  - [ ] 5.6 Add data-testid="xtream-sources-tab"

- [ ] Task 6: Create `XtreamAccountAccordion` component (AC: #1, #2)
  - [ ] 6.1 Create `src/components/sources/XtreamAccountAccordion.tsx`
  - [ ] 6.2 Accordion header with expand/collapse toggle:
    - Account name
    - Stream count (total)
    - Orphan count badge (amber) if > 0
    - Expand/collapse chevron icon
  - [ ] 6.3 Use `getAccountStreamStats` query for header counts (enabled always)
  - [ ] 6.4 Use local state `isExpanded: boolean` for toggle
  - [ ] 6.5 Lazy-load streams only when expanded: `useQuery(['xtream-streams', accountId], ..., { enabled: isExpanded })`
  - [ ] 6.6 Display loading spinner while streams load
  - [ ] 6.7 Render stream list when loaded
  - [ ] 6.8 Add aria-expanded and aria-controls for accessibility
  - [ ] 6.9 Add data-testid="xtream-account-accordion-{accountId}"

- [ ] Task 7: Create `XtreamStreamRow` component (AC: #2, #3, #4)
  - [ ] 7.1 Create `src/components/sources/XtreamStreamRow.tsx`
  - [ ] 7.2 Display stream info:
    - Icon (with fallback placeholder)
    - Stream name
    - Quality badges (HD/SD/4K) - use existing `getQualityBadgeClasses`
    - Status badge based on linkStatus:
      - "Linked" (blue) if linkStatus === 'linked'
      - "Orphan" (amber) if linkStatus === 'orphan'
      - "Promoted" (green) if linkStatus === 'promoted'
  - [ ] 7.3 Click to open action menu (dropdown):
    **For linked streams:**
    - "View Linked Channels" → show list of XMLTV channel names
    - "Unlink" → remove mapping (calls `removeStreamMapping`)
    **For orphan streams:**
    - "Promote to Lineup" → open promote dialog (reuse from Story 3-8)
    - "Link to XMLTV Channel" → open stream search dropdown (reuse from Story 3-3)
    **For promoted streams:**
    - "View in Lineup" → navigate to Target Lineup
    - "Edit Channel" → open edit synthetic channel dialog (reuse from Story 3-8)
  - [ ] 7.4 Add data-testid="xtream-stream-row-{streamId}"

- [ ] Task 8: Create action dialogs/components (AC: #3, #4)
  - [ ] 8.1 Create `XtreamStreamActionMenu.tsx` for action dropdown
  - [ ] 8.2 Reuse `PromoteOrphanDialog` from `src/components/channels/OrphanXtreamSection.tsx` (or extract to shared component)
  - [ ] 8.3 Reuse `StreamSearchDropdown` pattern from `src/components/channels/ManualMatchDropdown.tsx` for linking
  - [ ] 8.4 Create `LinkedChannelsPopover.tsx` to show which XMLTV channels a stream is linked to

### Frontend - Component Organization

- [ ] Task 9: Update component exports (AC: all)
  - [ ] 9.1 Update `src/components/sources/index.ts` with new exports:
    - XtreamSourcesTab
    - XtreamAccountAccordion
    - XtreamStreamRow
    - XtreamStreamActionMenu
    - LinkedChannelsPopover

### Testing

- [ ] Task 10: E2E Tests (AC: #1-4)
  - [ ] 10.1 Update `tests/e2e/sources-xmltv.spec.ts` → rename to `tests/e2e/sources.spec.ts`
  - [ ] 10.2 Test: Xtream tab is now clickable (not disabled)
  - [ ] 10.3 Test: Clicking Xtream tab shows Xtream sources
  - [ ] 10.4 Test: Xtream accounts display as accordion sections
  - [ ] 10.5 Test: Account header shows stream count and orphan count
  - [ ] 10.6 Test: Expanding account lazy-loads streams
  - [ ] 10.7 Test: Stream shows "Linked" badge when mapped
  - [ ] 10.8 Test: Stream shows "Orphan" badge when not mapped
  - [ ] 10.9 Test: Stream shows "Promoted" badge for synthetic channels
  - [ ] 10.10 Test: Orphan stream action menu shows "Promote to Lineup"
  - [ ] 10.11 Test: Linked stream action menu shows "View Linked Channels"
  - [ ] 10.12 Test: "Promote to Lineup" creates synthetic channel (reuse 3-8 test pattern)
  - [ ] 10.13 Test: "Link to XMLTV Channel" opens search dropdown
  - [ ] 10.14 Use Tauri mock injection pattern from story 3-9/3-10

- [ ] Task 11: Build verification
  - [ ] 11.1 Run `cargo check` - no Rust errors
  - [ ] 11.2 Run `npx tsc --noEmit` - TypeScript compiles
  - [ ] 11.3 Run `npm run build` - build succeeds

## Dev Notes

### CRITICAL: This is Step 3 of Navigation Restructure

This story completes the Sources view by adding the Xtream tab. The tabbed interface was created in Story 3-10, and this story enables the second tab.

### Architecture Compliance

**XMLTV-First Design:** While this tab shows Xtream streams, the primary action is to LINK streams to XMLTV channels or PROMOTE orphans (which creates synthetic XMLTV channels). The Xtream tab is a secondary view for managing stream sources.

[Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture]

### Database Schema Reference

From `architecture.md`:

```sql
-- Channels from Xtream provider
CREATE TABLE xtream_channels (
    id INTEGER PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    stream_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    stream_icon TEXT,
    category_id INTEGER,
    category_name TEXT,
    qualities TEXT, -- JSON array: ["HD", "SD", "4K"]
    epg_channel_id TEXT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, stream_id)
);

-- Channel mappings (XMLTV -> Xtream) - One XMLTV channel can have MULTIPLE Xtream streams
CREATE TABLE channel_mappings (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER NOT NULL REFERENCES xmltv_channels(id) ON DELETE CASCADE,
    xtream_channel_id INTEGER NOT NULL REFERENCES xtream_channels(id) ON DELETE CASCADE,
    match_confidence REAL,
    is_manual BOOLEAN DEFAULT FALSE,
    is_primary BOOLEAN DEFAULT FALSE,
    stream_priority INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(xmltv_channel_id, xtream_channel_id)
);

-- Channels from XMLTV (or synthetic for orphan Xtream channels)
CREATE TABLE xmltv_channels (
    id INTEGER PRIMARY KEY,
    source_id INTEGER REFERENCES xmltv_sources(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    icon TEXT,
    is_synthetic BOOLEAN DEFAULT FALSE,  -- True for promoted orphan Xtream channels
    UNIQUE(source_id, channel_id)
);
```

### Performance Requirements

**Lazy Loading:** Streams are NOT loaded until an account is expanded. This prevents loading thousands of streams upfront.

**Per-Account Queries:** Each accordion fetches its own streams independently using `getXtreamStreamsForAccount(accountId)`.

**Header Stats:** Account headers use a lightweight `getAccountStreamStats` query that runs always (not lazy) for counts.

### Existing Code to Leverage

**Backend - Existing Commands:**
- `getAccounts()` - Already exists, returns Account[]
- `getChannels(accountId)` - Already exists, returns Channel[]
- `getOrphanXtreamStreams()` - From Story 3-8, returns orphan streams
- `promoteOrphanToPlex(...)` - From Story 3-8, promotes orphan to synthetic channel
- `addManualStreamMapping(...)` - From Story 3-3, links stream to XMLTV channel
- `removeStreamMapping(mappingId)` - From Story 3-3, removes a mapping
- Need NEW: `getXtreamStreamsForAccount(accountId)` - Returns streams with link status
- Need NEW: `getAccountStreamStats(accountId)` - Returns count summary for header

**Frontend - Reuse Components:**
- Accordion pattern from `XmltvSourceAccordion.tsx` (Story 3-10)
- Quality badges from `getQualityBadgeClasses()` in `src/lib/tauri.ts`
- Promote dialog from `OrphanXtreamSection.tsx` (Story 3-8)
- Stream search dropdown from `ManualMatchDropdown.tsx` (Story 3-3)
- Toast notifications pattern
- Action menu pattern from `XmltvSourceChannelRow.tsx` (Story 3-10)

**From Story 3-10:**
- Tab navigation already implemented
- XmltvSourcesTab as reference for structure
- Accordion expand/collapse pattern
- Lazy loading with TanStack Query `enabled` option

### Files to Create

```
src/components/sources/XtreamSourcesTab.tsx
src/components/sources/XtreamAccountAccordion.tsx
src/components/sources/XtreamStreamRow.tsx
src/components/sources/XtreamStreamActionMenu.tsx
src/components/sources/LinkedChannelsPopover.tsx
```

### Files to Modify

```
src/views/Sources.tsx (enable Xtream tab)
src/components/sources/index.ts (add new exports)
src/lib/tauri.ts (add XtreamAccountStream type and functions)
src-tauri/src/commands/channels.rs (add get_xtream_streams_for_account, get_account_stream_stats)
src-tauri/src/lib.rs (register new commands)
tests/e2e/sources-xmltv.spec.ts → tests/e2e/sources.spec.ts (rename, add Xtream tests)
```

### Badge Styling Reference

From story 3-10 and existing components:

```tsx
// "Linked" badge (blue)
<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
  Linked
</span>

// "Orphan" badge (amber)
<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
  <AlertTriangle className="w-3 h-3 mr-1" />
  Orphan
</span>

// "Promoted" badge (green)
<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
  Promoted
</span>

// Quality badges (from getQualityBadgeClasses)
// 4K: bg-purple-100 text-purple-800
// FHD: bg-blue-100 text-blue-800
// HD: bg-green-100 text-green-800
// SD: bg-gray-100 text-gray-800
```

### Xtream Tab Enabled State

Update Sources.tsx tab button from:
```tsx
<button
  data-testid="xtream-tab"
  role="tab"
  aria-selected={activeTab === 'xtream'}
  aria-controls="xtream-tab-panel"
  className="px-4 py-2 font-medium text-sm text-gray-400 cursor-not-allowed"
  disabled
  title="Coming in story 3-11"
>
  Xtream
  <span className="ml-2 text-xs bg-gray-200 px-1.5 py-0.5 rounded">Soon</span>
</button>
```

To:
```tsx
<button
  data-testid="xtream-tab"
  role="tab"
  aria-selected={activeTab === 'xtream'}
  aria-controls="xtream-tab-panel"
  className={`px-4 py-2 font-medium text-sm ${
    activeTab === 'xtream'
      ? 'border-b-2 border-blue-500 text-blue-600'
      : 'text-gray-500 hover:text-gray-700'
  }`}
  onClick={() => setActiveTab('xtream')}
>
  Xtream
</button>
```

### Empty State UX

When no Xtream accounts are configured:

```
┌─────────────────────────────────────────┐
│                                         │
│    📺  No Xtream accounts configured   │
│                                         │
│    Add accounts in the Accounts         │
│    section to browse streams.           │
│                                         │
│    [ Go to Accounts ]                   │
│                                         │
└─────────────────────────────────────────┘
```

### Action Menu Pattern

For stream rows, use similar pattern to XmltvSourceChannelRow:

```tsx
const [openMenuId, setOpenMenuId] = useState<number | null>(null);
const menuRef = useRef<HTMLDivElement>(null);

// Close on outside click
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setOpenMenuId(null);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);

// In stream row:
<div ref={menuRef} className="relative">
  <button onClick={() => setOpenMenuId(stream.id === openMenuId ? null : stream.id)}>
    <MoreVertical className="w-4 h-4" />
  </button>

  {openMenuId === stream.id && (
    <XtreamStreamActionMenu
      stream={stream}
      onClose={() => setOpenMenuId(null)}
      onPromote={handlePromote}
      onLink={handleLink}
      onUnlink={handleUnlink}
      onViewLinked={handleViewLinked}
    />
  )}
</div>
```

### Integration with Existing Features

**Promote to Lineup:** Reuse the `promoteOrphanToPlex` command from Story 3-8. The dialog should:
1. Pre-fill display name from stream name
2. Pre-fill icon from stream icon
3. On submit: create synthetic channel, create mapping, optionally enable for lineup
4. Show success toast

**Link to XMLTV Channel:** Reuse the `addManualStreamMapping` command from Story 3-3. The flow:
1. Open search dropdown showing XMLTV channels
2. User searches and selects a channel
3. Call `addManualStreamMapping(xmltvChannelId, xtreamStreamId, setAsPrimary)`
4. Update stream status to "linked"
5. Show success toast

**Unlink:** Call `removeStreamMapping(mappingId)` from Story 3-3.

### Accessibility Requirements

- Tab buttons: `role="tab"`, `aria-selected`
- Tab panel: `role="tabpanel"`, `aria-labelledby`
- Accordion header: `aria-expanded`, `aria-controls`
- Accordion content: `id` matching aria-controls
- Action menu: `aria-haspopup="menu"`, proper focus management
- Badges: `role="status"` or descriptive text
- Quality badges: tooltip for accessibility

### Previous Story Intelligence (3-10)

From Story 3-10 Code Review:
- Action menu close-on-outside-click pattern was fixed - use useEffect + ref pattern
- Toast timeout was extracted to constant - follow same pattern
- Channel loading error should have retry button

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-01-20.md]
- [Source: _bmad-output/planning-artifacts/architecture.md#Database Schema]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.11]
- [Source: src/views/Sources.tsx - existing tab structure]
- [Source: src/components/sources/XmltvSourcesTab.tsx - tab component pattern]
- [Source: src/components/sources/XmltvSourceAccordion.tsx - accordion pattern]
- [Source: src/components/channels/OrphanXtreamSection.tsx - promote dialog pattern]
- [Source: src/components/channels/ManualMatchDropdown.tsx - stream search pattern]
- [Source: src/lib/tauri.ts - TypeScript bindings]
- [Source: src-tauri/src/commands/channels.rs - channel commands]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
