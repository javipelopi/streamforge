# Sprint Change Proposal - Channels View Restructure (Target Lineup + Sources)

**Date:** 2026-01-20
**Author:** Javier (via Correct Course workflow)
**Status:** ✅ APPROVED (2026-01-20)
**UX Decision:** Option C - Hybrid (Target Lineup menu + Sources with tabs)

---

## Section 1: Issue Summary

### Problem Statement

The current Channels tab attempts to display a unified view of ALL channels from ALL sources with ALL their relationships in a single view. The `get_xmltv_channels_with_mappings` command loads 4 complete database tables into memory and performs in-memory joins, causing performance degradation with large datasets (1000+ XMLTV channels × 10,000+ Xtream streams).

### Context

- **Discovery:** Post Epic-3 completion, during channel list loading testing
- **Issue Type:** Technical limitation / UX scalability
- **Trigger:** User observation that Channels tab takes too long to load

### Evidence

Current implementation in `src-tauri/src/commands/xmltv_channels.rs:60-211`:
1. Loads ALL `xmltv_channels` table
2. Loads ALL `xmltv_channel_settings` table
3. Loads ALL `channel_mappings` table
4. Loads ALL `xtream_channels` table
5. Builds HashMap lookups for each
6. Performs O(n×m) in-memory joins

With large channel lists, this approach doesn't scale.

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact | Details |
|------|--------|---------|
| **Epic 3** | Extension | Add 3 new stories (3-9, 3-10, 3-11) for tabbed interface |
| **Epic 4** | Aligned | M3U/EPG endpoints expect enabled channels only - Target Lineup provides exactly this |
| **Epic 5** | Aligned | EPG Viewer already plans to show "enabled XMLTV channels only" |
| **Epic 6** | None | No impact |

### Artifact Conflicts

| Artifact | Conflict | Resolution |
|----------|----------|------------|
| **PRD** | Minor | Update FR21, FR26a to describe tabbed interface |
| **Architecture** | Minor | Add new optimized query commands |
| **UI/UX** | New | Define tabbed interface (no UX doc exists currently) |
| **sprint-status.yaml** | Update | Add new stories 3-9, 3-10, 3-11 |

### Technical Impact

| Component | Impact |
|-----------|--------|
| **Database Schema** | None - schema unchanged |
| **Backend Commands** | Add 3 new optimized commands |
| **Frontend Routing** | Add tabs within Channels view |
| **Existing Functionality** | Preserved - can deprecate old command later |

---

## Section 3: Recommended Approach

### Selected Path: Direct Adjustment (Option 1)

Add new stories to Epic 3 for the tabbed UI restructure.

### Rationale

1. **Low Risk:** Existing queries/schema work - we add new optimized queries alongside
2. **Natural Fit:** Epic 3 is "Channel Discovery & Matching" - UI organization fits
3. **Epic 4 Alignment:** Target Lineup provides exactly what M3U/EPG endpoints need
4. **No Breaking Changes:** Current functionality continues working during transition

### Effort Estimate

- **Stories:** 3 new stories
- **Backend:** ~2 days (new commands, optimize queries)
- **Frontend:** ~3 days (tab component, views, state)
- **Testing:** ~1 day (Playwright updates)

### Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| New UI confusion | Low | Clear tab names, consistent behavior |
| Migration path | Low | Old command works, deprecate later |
| State sync | Low | Each tab manages own state |

---

## Section 4: Detailed Change Proposals

### 4.1 PRD Updates

**FR21 (Current):**
> User can view all XMLTV channels with their matched Xtream stream status. The Channels view shows XMLTV channels as the primary list, with indicators showing which Xtream streams are matched to each

**FR21 (Proposed):**
> User can manage channels through a restructured navigation:
> - **Target Lineup (new menu item):** Shows channels enabled for Plex (XMLTV + promoted orphans) with enable/disable toggles and drag-drop reordering. This is the curated list that goes to Plex.
> - **Sources (new menu item with tabs):** Browse available channels/streams organized by source:
>   - XMLTV tab: Browse channels by XMLTV source with "In Lineup" status
>   - Xtream tab: Browse streams by Xtream account with link/orphan status

**New Navigation Structure:**
```
Sidebar:
├── Dashboard
├── Target Lineup  ← NEW (your Plex output)
├── Sources        ← NEW (replaces Channels)
│     └── [XMLTV] [Xtream] tabs
├── EPG
├── Accounts
├── Settings
└── Logs
```

---

### 4.2 New Stories

#### Story 3-9: Implement Target Lineup View

**As a** user,
**I want** a dedicated Target Lineup menu item showing my Plex channel lineup,
**So that** I can manage what channels appear in Plex efficiently.

**Acceptance Criteria:**

**Given** the sidebar navigation
**When** I click "Target Lineup"
**Then** I see a new view showing only channels where `is_enabled = true`
**And** the list loads quickly (<500ms for 500 enabled channels)
**And** I can drag-drop to reorder channels
**And** I can toggle enable/disable (removing from lineup)
**And** channels without streams show a warning icon

**Given** an enabled channel has no stream source
**When** viewing in Target Lineup
**Then** a warning badge "No stream" appears
**And** hovering shows tooltip "This channel has no video source"

**Given** the Target Lineup is empty
**When** viewing the page
**Then** I see an empty state: "No channels in lineup. Add channels from Sources."
**And** a button links to the Sources view

**Navigation Change:**
- Add "Target Lineup" menu item after Dashboard
- Remove old "Channels" menu item (replaced by Target Lineup + Sources)

---

#### Story 3-10: Implement Sources View with XMLTV Tab

**As a** user,
**I want** to browse channels from my XMLTV EPG sources,
**So that** I can find channels to add to my Target Lineup.

**Acceptance Criteria:**

**Given** the sidebar navigation
**When** I click "Sources"
**Then** I see a new view with tabs: [XMLTV] [Xtream]
**And** XMLTV tab is selected by default

**Given** the XMLTV tab is active
**When** the view loads
**Then** I see my XMLTV sources as expandable accordion sections
**And** each section header shows: source name, channel count

**Given** I expand an XMLTV source section
**When** the channels load (lazy-loaded per source)
**Then** I see all channels from that source
**And** each channel shows:
  - Display name and icon
  - "In Lineup" badge (green) if `is_enabled = true`
  - Match count badge (e.g., "3 streams matched")
  - "No streams" warning if matchCount = 0

**Given** I click a channel in XMLTV tab
**When** the action menu opens
**Then** I can "Add to Lineup" (enable) or "Remove from Lineup" (disable)
**And** I can view/edit matched Xtream streams

**Navigation Change:**
- Add "Sources" menu item after Target Lineup

---

#### Story 3-11: Implement Sources View Xtream Tab

**As a** user,
**I want** to browse streams from my Xtream accounts,
**So that** I can link streams to XMLTV channels or promote orphans to my lineup.

**Acceptance Criteria:**

**Given** the Sources view
**When** I click the "Xtream" tab
**Then** I see my Xtream accounts as expandable accordion sections
**And** each section header shows: account name, stream count, orphan count

**Given** I expand an Xtream account section
**When** the streams load (lazy-loaded per account)
**Then** I see all streams from that account
**And** each stream shows:
  - Stream name, icon, quality badges (HD/SD/4K)
  - "Linked" badge (blue) if mapped to an XMLTV channel
  - "Orphan" badge (amber) if not mapped to any channel
  - "Promoted" badge (green) if has synthetic channel in lineup

**Given** I click a linked stream
**When** the action menu opens
**Then** I can see which XMLTV channel(s) it's linked to
**And** I can unlink or change the link

**Given** I click an orphan stream
**When** the action menu opens
**Then** I can "Promote to Lineup" (create synthetic channel + enable)
**And** I can "Link to XMLTV Channel" (manual match to existing XMLTV channel)

---

### 4.3 Backend Changes

**New Tauri Commands:**

```rust
/// Get only enabled channels for Target Lineup (optimized)
#[tauri::command]
pub fn get_target_lineup_channels(
    db: State<DbConnection>,
) -> Result<Vec<XmltvChannelWithMappings>, String>

/// Get XMLTV channels for a specific source (lazy load)
#[tauri::command]
pub fn get_xmltv_channels_by_source(
    db: State<DbConnection>,
    source_id: i32,
) -> Result<Vec<XmltvChannelInfo>, String>

/// Get Xtream streams for a specific account (lazy load)
#[tauri::command]
pub fn get_xtream_streams_by_account(
    db: State<DbConnection>,
    account_id: i32,
) -> Result<Vec<XtreamStreamInfo>, String>
```

---

### 4.4 Sprint Status Update

Add to `sprint-status.yaml`:

```yaml
# Epic 3: Channel Discovery & Matching - Navigation Restructure (Option C)
3-9-implement-target-lineup-view: backlog
3-10-implement-sources-view-xmltv-tab: backlog
3-11-implement-sources-view-xtream-tab: backlog
```

**Navigation Changes Summary:**
| Old | New |
|-----|-----|
| Channels (single view) | Target Lineup (menu item) + Sources (menu item with tabs) |

---

## Section 5: Implementation Handoff

### Change Scope Classification

**Moderate** - Requires backlog reorganization and story creation

### Handoff Plan

| Role | Responsibility |
|------|----------------|
| **Scrum Master (SM)** | Update sprint-status.yaml, create story files |
| **Developer (Dev)** | Implement stories 3-9, 3-10, 3-11 |
| **Analyst** | Update PRD with new FR21 wording |

### Success Criteria

1. Target Lineup tab loads <500ms for 500 enabled channels
2. XMLTV Sources tab shows source-grouped channels without loading all data
3. Xtream Accounts tab shows account-grouped streams without loading all data
4. Existing channel management functionality preserved
5. All Playwright tests pass

### Next Steps

1. [ ] User approves this Sprint Change Proposal
2. [ ] SM updates sprint-status.yaml with new stories
3. [ ] SM creates story 3-9 file (first to implement)
4. [ ] Dev implements stories in sequence: 3-9 → 3-10 → 3-11
5. [ ] Analyst updates PRD after implementation

---

## Approval

**User Approval:** ✅ APPROVED

- [x] Sprint Change Proposal approved
- [x] sprint-status.yaml updated with stories 3-9, 3-10, 3-11
- [x] Epic 3 status changed to in-progress

---

*Generated by Correct Course workflow on 2026-01-20*
*Approved: 2026-01-20*
