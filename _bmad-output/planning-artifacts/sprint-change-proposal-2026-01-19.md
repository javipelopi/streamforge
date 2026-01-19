# Sprint Change Proposal - Channel Hierarchy Correction

**Date:** 2026-01-19
**Author:** Bob (Scrum Master)
**Approved By:** Javier
**Scope Classification:** MODERATE

---

## 1. Issue Summary

### Problem Statement

The current architecture treats **Xtream channels as primary** and matches XMLTV data TO them. The intended design is the **inverse**: XMLTV channels should be primary ("kings of the hill"), with Xtream streams matched TO them.

- **XMLTV channels** define the channel lineup for Plex (names, IDs, icons, EPG)
- **Xtream streams** provide the actual video sources that get matched to XMLTV channels

### Discovery Context

- **Discovered:** Pre-Epic 3 implementation review
- **Issue Type:** Misunderstanding of original requirements
- **Evidence:** User observed Channels tab only shows Xtream channels, not XMLTV channels

### Why This Matters

The user's mental model (and correct interpretation):
1. XMLTV defines what channels appear in Plex with proper names/icons
2. Xtream provides streams that are "attached" to those XMLTV channels
3. EPG tab shows the Plex preview (enabled XMLTV channels only)
4. User selects which XMLTV channels to enable for Plex

---

## 2. Impact Analysis

### Epic Impact

| Epic | Status | Impact Level | Notes |
|------|--------|--------------|-------|
| Epic 1 | Done | None | Foundation unaffected |
| Epic 2 | Done | None | Data storage is correct (both sources stored separately) |
| Epic 3 | Backlog | **HIGH** | All 7 stories need rewrite - flip matching direction |
| Epic 4 | Backlog | **MEDIUM** | M3U/EPG generation uses XMLTV channel info |
| Epic 5 | Backlog | **MEDIUM** | EPG viewer shows enabled XMLTV channels only |
| Epic 6 | Backlog | None | Settings/logging unaffected |

### Artifact Conflicts

#### PRD Updates Required

| Requirement | Current | Proposed |
|-------------|---------|----------|
| FR14 | "fuzzy matching between Xtream and XMLTV" (ambiguous) | "Match Xtream streams TO XMLTV channels. XMLTV channels are primary." |
| FR21 | "view all channels" (unclear source) | "view all XMLTV channels with their matched Xtream stream status" |
| NEW FR26a | N/A | "User can view all channels from all sources with icons indicating source type and match relationships" |

#### Architecture Updates Required

**Database Schema Change:**

```sql
-- CURRENT (incorrect direction)
CREATE TABLE channel_mappings (
    xtream_channel_id INTEGER REFERENCES xtream_channels(id),
    xmltv_channel_id INTEGER REFERENCES xmltv_channels(id),
    ...
);

-- CORRECTED (XMLTV as primary)
CREATE TABLE channel_mappings (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER NOT NULL REFERENCES xmltv_channels(id),
    xtream_channel_id INTEGER REFERENCES xtream_channels(id),  -- nullable until matched
    match_confidence REAL,
    is_manual BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN DEFAULT FALSE,  -- default disabled until user enables
    display_order INTEGER,
    UNIQUE(xmltv_channel_id)
);
```

**Component Updates:**
- M3U Generation: Use XMLTV channel data (name, ID, icon)
- EPG Generation: Serve only enabled XMLTV channels
- Channels View: Show XMLTV channels as primary list

#### UI/UX Updates Required

| View | Current Behavior | Corrected Behavior |
|------|-----------------|-------------------|
| Channels Tab | Shows Xtream channels | Shows XMLTV channels with source icons indicating match status |
| EPG Tab | Shows all EPG data | Shows only enabled XMLTV channels (Plex preview) |
| Matching UI | Match XMLTV to Xtream | Match Xtream streams to selected XMLTV channel |

---

## 3. Recommended Approach

### Selected Path: Direct Adjustment

**Rationale:**
- Epic 3 (where matching logic lives) is still in **backlog** - no code written yet
- Epic 2 correctly stored both Xtream and XMLTV channels in **separate tables**
- This is a requirements clarification, not a technical failure
- Correcting course now prevents significant rework later

**Effort Estimate:** LOW
- PRD clarification: ~30 min
- Architecture schema update: ~1 hour
- Epic 3/4/5 story rewrites: ~2-3 hours

**Risk Level:** LOW
- No existing code to roll back
- Data model fundamentally supports the correction
- Catching this before implementation is optimal timing

**Timeline Impact:** Minimal
- Delays Epic 3 start by 1-2 days for documentation updates
- Overall project timeline unaffected

---

## 4. Detailed Change Proposals

### PRD Changes

#### FR14 (Channel Matching)

**OLD:**
> FR14: System can perform fuzzy matching between Xtream channels and XMLTV channels

**NEW:**
> FR14: System can perform fuzzy matching to associate Xtream streams with XMLTV channels. XMLTV channels are the primary channel list that defines what appears in Plex (channel names, numbers, icons, and EPG data).

---

#### FR21 (Channel View)

**OLD:**
> FR21: User can view all channels with their match status

**NEW:**
> FR21: User can view all XMLTV channels with their matched Xtream stream status. The Channels view shows XMLTV channels as the primary list, with indicators showing which Xtream streams are matched to each.

---

#### NEW FR26a (Multi-Source View)

**ADD:**
> FR26a: User can view all channels from all sources (XMLTV and Xtream) in the Channels tab, with icons indicating source type and match relationships. The XMLTV channel list defines the Plex lineup; Xtream streams are the video sources matched to those channels.

---

### Architecture Changes

#### Database Schema

Update `channel_mappings` table to make XMLTV the primary key:

```sql
CREATE TABLE channel_mappings (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER NOT NULL REFERENCES xmltv_channels(id) ON DELETE CASCADE,
    xtream_channel_id INTEGER REFERENCES xtream_channels(id) ON DELETE SET NULL,
    match_confidence REAL,
    is_manual BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN DEFAULT FALSE,
    display_order INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(xmltv_channel_id)
);
```

**Key Changes:**
- `xmltv_channel_id` is NOT NULL (required) - XMLTV is primary
- `xtream_channel_id` is nullable - stream may not be matched yet
- `is_enabled` defaults to FALSE - user explicitly enables channels for Plex

#### Data Flow Update

```
XMLTV Sources → Parse → xmltv_channels (PRIMARY)
                              ↓
                    channel_mappings ← Fuzzy Match
                              ↑
Xtream Account → Fetch → xtream_channels (STREAMS)
                              ↓
                    M3U/EPG Generation
                    (uses XMLTV channel info)
                              ↓
                         Plex Server
```

---

### Epic 3 Story Rewrites

#### Story 3.1: Implement Fuzzy Channel Matching Algorithm

**Key Changes:**
- Direction: Match Xtream streams → XMLTV channels (not vice versa)
- For each Xtream channel, find best matching XMLTV channel
- Create mapping record with XMLTV as primary key

---

#### Story 3.2: Display Channel List with Match Status

**Key Changes:**
- Show XMLTV channels as primary list
- Each row shows: XMLTV name, icon, matched Xtream stream (or "No stream")
- Add source type icons to distinguish origins
- Show both matched and unmatched XMLTV channels

---

#### Story 3.3: Manual Match Override via Search Dropdown

**Key Changes:**
- Select an XMLTV channel, then search for Xtream stream to match
- Dropdown searches Xtream channels
- Allow "No match" to leave XMLTV channel without stream source

---

#### Story 3.4: Auto-Rematch on Provider Changes

**Key Changes:**
- When Xtream list changes, re-match affected streams to XMLTV channels
- XMLTV channels remain stable; only stream sources may change
- Manual matches preserved

---

#### Story 3.5: Channel Enable/Disable Functionality

**Key Changes:**
- Enable/disable applies to XMLTV channels
- Only enabled XMLTV channels appear in Plex
- XMLTV channels default to disabled until user enables

---

#### Story 3.6: Drag-and-Drop Channel Reordering

**Key Changes:**
- Reorder XMLTV channels (defines Plex channel order)
- Display order stored on XMLTV mapping record

---

#### Story 3.7: Bulk Channel Operations

**Key Changes:**
- Bulk operations apply to XMLTV channels
- "Enable all matched" - enable XMLTV channels that have Xtream streams
- Filter by category (XMLTV categories)

---

### Epic 4 Story Updates

#### Story 4.1: Serve M3U Playlist Endpoint

**Key Changes:**
- Generate M3U from enabled XMLTV channels
- Use XMLTV channel name, ID, and icon in playlist
- Stream URL points to matched Xtream stream

---

#### Story 4.2: Serve XMLTV EPG Endpoint

**Key Changes:**
- Serve EPG only for enabled XMLTV channels
- Channel IDs match those in M3U playlist

---

#### Story 4.3: Implement HDHomeRun Emulation

**Key Changes:**
- Lineup uses XMLTV channel info (GuideName from XMLTV)
- TunerCount from Xtream account

---

### Epic 5 Story Updates

#### Stories 5.1-5.3: EPG Viewer

**Key Changes:**
- Show only enabled XMLTV channels (Plex preview mode)
- This is the "as Plex will see it" view
- Programs from XMLTV EPG data for enabled channels only

---

## 5. Implementation Handoff

### Scope Classification: MODERATE

This change requires:
- PRD clarification (minor text updates)
- Architecture schema redesign (before implementation)
- Epic 3/4/5 story rewrites (significant but pre-implementation)

### Handoff Responsibilities

| Role | Responsibility | Priority |
|------|----------------|----------|
| **Scrum Master** | Update PRD with FR changes | HIGH - Do first |
| **Architect** | Update Architecture with schema changes | HIGH - Do second |
| **Scrum Master** | Rewrite Epic 3 stories | HIGH - Do third |
| **Scrum Master** | Update Epic 4/5 stories | MEDIUM - After Epic 3 |
| **Dev Team** | Implement with corrected specifications | After docs updated |

### Success Criteria

1. PRD clearly states XMLTV channels are primary for Plex lineup
2. Architecture schema has `xmltv_channel_id` as primary key in mappings
3. All Epic 3 stories reflect XMLTV-first approach
4. Epic 4/5 stories updated for filtered XMLTV output
5. Sprint status reflects updated story definitions

### Next Steps

1. **Immediate:** Update PRD (FR14, FR21, add FR26a)
2. **Immediate:** Update Architecture (schema, data flow)
3. **Before Epic 3:** Rewrite all Epic 3 stories
4. **Before Epic 4:** Update Epic 4 stories
5. **Before Epic 5:** Update Epic 5 stories
6. **Then:** Proceed with Epic 3 implementation using corrected specs

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-19 | Bob (SM) | Initial Sprint Change Proposal |
| 1.0 | 2026-01-19 | Javier | Approved |
