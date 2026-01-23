# Sprint Change Proposal - TV-Style EPG Redesign

**Date:** 2026-01-22
**Change Type:** Epic 5 Implementation Redesign
**Scope Classification:** Moderate
**Status:** APPROVED

---

## 1. Issue Summary

**Problem Statement:** Stakeholder-driven decision to replace the current horizontal timeline EPG grid with a TV-style vertical channel list interface. The new design provides a better "lean-back" experience optimized for channel-centric browsing rather than time-centric browsing.

**Discovery Context:** During review of Story 5.3 (Program Details View), stakeholder determined that enhancing the current grid-based implementation would be more complex than building the new TV-style interface from scratch.

**Evidence:** Complete UX specification provided in `ux-epg-tv-guide.md` with:
- Three-panel layout (Channels, Schedule, Details)
- Top bar with search and day navigation
- Dark cinematic visual style
- Detailed component hierarchy and interaction patterns
- Migration notes identifying components to retire/adapt

---

## 2. Impact Analysis

### Epic Impact

| Epic | Status | Action |
|------|--------|--------|
| Epic 5 (EPG Viewer) | Was: done | Reopened, stories 5.1-5.3 superseded |
| Epic 6 (Settings) | backlog | No impact |

### Story Impact

| Story | Old Status | New Status | Action |
|-------|------------|------------|--------|
| 5.1 EPG Grid Browser | done | superseded | Replaced by 5.4-5.6 |
| 5.2 EPG Search | done | superseded | Replaced by 5.7 |
| 5.3 Program Details | review | superseded | Replaced by 5.8 |
| 5.4 TV-Style Layout | - | backlog | NEW |
| 5.5 Channel List Panel | - | backlog | NEW |
| 5.6 Schedule Panel | - | backlog | NEW |
| 5.7 Top Bar Search/Nav | - | backlog | NEW |
| 5.8 Program Details Panel | - | backlog | NEW |
| 5.9 Legacy Cleanup | - | backlog | NEW |

### Artifact Conflicts

| Artifact | Impact | Action Taken |
|----------|--------|--------------|
| PRD | None | FR39-FR42 still valid |
| Architecture | Minor | Updated frontend component structure, added doc history entry |
| Epics | Moderate | Added stories 5.4-5.9, marked 5.1-5.3 as superseded |
| Sprint Status | Moderate | Updated Epic 5 status and all story statuses |

### Technical Impact

**Components to DELETE (Story 5.9):**
- `src/components/epg/EpgGrid.tsx`
- `src/components/epg/EpgCell.tsx`
- `src/components/epg/TimeNavigationBar.tsx`
- Associated test files
- Grid-specific styles

**Components to ADAPT (Story 5.9):**
- `ProgramDetailsPanel.tsx` → inline right panel
- `EpgSearchInput.tsx` → top bar context
- `EpgSearchResults.tsx` → dark theme dropdown

**Components to CREATE (Stories 5.4-5.8):**
- `EpgBackground` - gradient background layer
- `EpgTopBar` - search and day navigation container
- `DayNavigationBar` - day chips and arrows
- `EpgChannelList` - vertical channel list
- `EpgChannelRow` - channel with now-playing info
- `EpgSchedulePanel` - schedule for selected channel
- `ScheduleRow` - program in schedule
- `ProgressBar` - reusable progress indicator

---

## 3. Recommended Approach

**Selected Path:** Direct Adjustment - Add new implementation stories to Epic 5

**Rationale:**
1. **Clean implementation** - Building from new UX spec is cleaner than retrofitting
2. **Contained scope** - All changes within Epic 5, no ripple to other epics
3. **PRD compliance** - All functional requirements (FR39-FR42) still met
4. **Low risk** - Current implementation remains until new one is complete
5. **Stakeholder alignment** - Matches stakeholder vision for TV-style experience
6. **Explicit cleanup** - Story 5.9 ensures old code is removed cleanly

**Effort Estimate:** Medium (6 new stories)
**Risk Level:** Low
**Timeline Impact:** Epic 5 extended by ~6 stories

---

## 4. New Stories Summary

### Story 5.4: EPG TV-Style Layout Foundation
Three-panel layout with cinematic gradient background.

### Story 5.5: EPG Channel List Panel
Vertical channel list with now-playing info and progress bars.

### Story 5.6: EPG Schedule Panel
Full schedule for selected channel with time navigation.

### Story 5.7: EPG Top Bar with Search and Day Navigation
Search input, day chips, date picker in fixed top bar.

### Story 5.8: EPG Program Details Panel
Right panel showing full program details when selected.

### Story 5.9: EPG Legacy Component Cleanup
Delete old grid components, adapt reusable ones, verify clean build.

---

## 5. Implementation Handoff

**Change Scope:** Moderate

### Responsibilities

| Role | Responsibility | Status |
|------|----------------|--------|
| Scrum Master (Bob) | Update epics.md, sprint-status.yaml, architecture.md | COMPLETE |
| Development Team | Implement stories 5.4-5.9 per UX spec | READY |

### Files Modified

- `_bmad-output/planning-artifacts/epics.md` - Added stories 5.4-5.9, marked 5.1-5.3 superseded
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated Epic 5 and story statuses
- `_bmad-output/planning-artifacts/architecture.md` - Updated component structure, doc history

### Success Criteria

1. [x] Epic 5 stories 5.4-5.9 added to epics.md
2. [x] Stories 5.1-5.3 marked as superseded
3. [x] Sprint status updated with new backlog
4. [x] Architecture doc updated with course correction note
5. [ ] First new story (5.4) developed and reviewed
6. [ ] All new stories (5.4-5.8) implemented
7. [ ] Legacy cleanup (5.9) completed with clean build

---

## 6. Reference Documents

- **UX Specification:** `_bmad-output/planning-artifacts/ux-epg-tv-guide.md`
- **Updated Epics:** `_bmad-output/planning-artifacts/epics.md`
- **Sprint Status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md`

---

## Approval

**Approved by:** Javier
**Approval Date:** 2026-01-22
**Conditions:** Added Story 5.9 for explicit legacy component cleanup
