# Story 5.4: EPG TV-Style Layout Foundation

Status: ready-for-dev

## Story

As a user,
I want a TV-style EPG interface with three panels over a cinematic background,
So that I can browse channels in a lean-back, television-friendly experience.

## Acceptance Criteria

1. **Given** the EPG view **When** it loads **Then** I see a three-panel layout:
   - Left panel (~30%): Channel list with now-playing info
   - Center panel (~30%): Schedule for selected channel
   - Right panel (~40%): Program details (when selected)
   **And** a gradient background (purple to dark blue, diagonal)
   **And** semi-transparent dark overlays on each panel

2. **Given** no program is selected **When** viewing the EPG **Then** the right panel shows only the gradient background **And** left and center panels are visible

3. **Given** a program is selected **When** viewing the EPG **Then** the right panel displays full program details

## Tasks / Subtasks

- [ ] Task 1: Create gradient background component (AC: #1)
  - [ ] 1.1 Create `src/components/epg/tv-style/EpgBackground.tsx`
  - [ ] 1.2 Implement gradient: `linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)`
  - [ ] 1.3 Set fixed position, covers entire viewport, z-index: 0
  - [ ] 1.4 Add `data-testid="epg-background"` for testing

- [ ] Task 2: Create three-panel layout container (AC: #1)
  - [ ] 2.1 Create `src/components/epg/tv-style/EpgMainContent.tsx`
  - [ ] 2.2 Implement flex row layout below top bar (top bar comes in Story 5.7)
  - [ ] 2.3 Left panel container: ~30% width, `rgba(0, 0, 0, 0.6)` background
  - [ ] 2.4 Center panel container: ~30% width, `rgba(0, 0, 0, 0.5)` background
  - [ ] 2.5 Right panel container: ~40% width, `rgba(0, 0, 0, 0.5)` background
  - [ ] 2.6 Add proper padding and rounded corners (optional, subtle)
  - [ ] 2.7 Add `data-testid` attributes: `epg-left-panel`, `epg-center-panel`, `epg-right-panel`

- [ ] Task 3: Create placeholder channel list panel (AC: #1, #2)
  - [ ] 3.1 Create `src/components/epg/tv-style/EpgChannelListPlaceholder.tsx`
  - [ ] 3.2 Display placeholder text: "Channel list (Story 5.5)"
  - [ ] 3.3 Apply semi-transparent dark background styling
  - [ ] 3.4 Maintain scroll container for future virtualized list

- [ ] Task 4: Create placeholder schedule panel (AC: #1, #2)
  - [ ] 4.1 Create `src/components/epg/tv-style/EpgSchedulePanelPlaceholder.tsx`
  - [ ] 4.2 Display placeholder text: "Schedule panel (Story 5.6)"
  - [ ] 4.3 Include date header placeholder
  - [ ] 4.4 Apply semi-transparent dark background styling

- [ ] Task 5: Create placeholder details panel with visibility logic (AC: #2, #3)
  - [ ] 5.1 Create `src/components/epg/tv-style/EpgDetailsPanelPlaceholder.tsx`
  - [ ] 5.2 Accept `isVisible` prop to control display
  - [ ] 5.3 When `isVisible=false`: show gradient background only (empty state)
  - [ ] 5.4 When `isVisible=true`: show placeholder for details content
  - [ ] 5.5 Display placeholder text: "Program details (Story 5.8)"
  - [ ] 5.6 Apply semi-transparent dark background when visible

- [ ] Task 6: Create new EPG TV view page (AC: #1, #2, #3)
  - [ ] 6.1 Create `src/views/EpgTv.tsx` (new view, parallel to existing EPG.tsx)
  - [ ] 6.2 Compose all layout components: EpgBackground, EpgMainContent, three panels
  - [ ] 6.3 Add state for `selectedProgram` (null initially)
  - [ ] 6.4 Wire visibility logic: right panel visible only when selectedProgram is not null
  - [ ] 6.5 Add temporary toggle button to test right panel visibility
  - [ ] 6.6 Add `data-testid="epg-tv-view"` to root container

- [ ] Task 7: Add routing for new EPG TV view
  - [ ] 7.1 Update `src/App.tsx` to add route `/epg-tv` pointing to EpgTv view
  - [ ] 7.2 Keep existing `/epg` route unchanged (legacy grid view)
  - [ ] 7.3 Consider future switch: make `/epg` point to new view after all stories complete

- [ ] Task 8: Create component exports and structure
  - [ ] 8.1 Create `src/components/epg/tv-style/index.ts` with all exports
  - [ ] 8.2 Update `src/components/epg/index.ts` to re-export tv-style components
  - [ ] 8.3 Ensure TypeScript compilation succeeds
  - [ ] 8.4 Ensure Vite build succeeds

## Dev Notes

### Architecture Compliance

This story implements the foundation for **FR39** (User can browse EPG data) as redesigned per course correction 2026-01-22. It follows the TV-style EPG design from `ux-epg-tv-guide.md`.

**CRITICAL - This is a foundation story:**
- Creates layout structure and placeholder components
- Full functionality (data loading, interactions) comes in Stories 5.5-5.8
- Do NOT integrate with existing Tauri commands or EPG data in this story
- Focus on CSS layout, visual styling, and component structure

### Visual Design Requirements

From `ux-epg-tv-guide.md`:

**Background Gradient:**
```css
background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
```

**Panel Backgrounds:**
| Panel | Background | Purpose |
|-------|------------|---------|
| Top bar | `rgba(0, 0, 0, 0.7)` | Fixed top navigation (Story 5.7) |
| Left panel | `rgba(0, 0, 0, 0.6)` | Channel list - most prominent |
| Center panel | `rgba(0, 0, 0, 0.5)` | Schedule - slightly less opaque for depth |
| Right panel | `rgba(0, 0, 0, 0.5)` | Details - same as center |

**Panel Widths:**
- Left panel: ~30% (channel list)
- Center panel: ~30% (schedule)
- Right panel: ~40% (details)

**Text Colors:**
- Primary text: `#ffffff` (white)
- Secondary text: `#a0a0a0` (light gray)
- Muted text: `#c0c0c0` (lighter gray for descriptions)

### Component Hierarchy (Target)

```
EpgTv.tsx (view) - THIS STORY
├── EpgBackground (gradient layer, z-index: 0) - THIS STORY
│
├── EpgTopBar (fixed top, z-index: 10) - Story 5.7
│   └── ... (not this story)
│
├── EpgMainContent (flex row below top bar) - THIS STORY
│   │
│   ├── EpgChannelListPlaceholder → EpgChannelList (Story 5.5)
│   │
│   ├── EpgSchedulePanelPlaceholder → EpgSchedulePanel (Story 5.6)
│   │
│   └── EpgDetailsPanelPlaceholder → EpgProgramDetails (Story 5.8)
```

### Existing Code - Components to Reference (NOT Replace Yet)

The existing EPG implementation uses these components which will be superseded later (Story 5.9):
- `src/views/EPG.tsx` - Current grid-based EPG view
- `src/components/epg/EpgGrid.tsx` - Horizontal timeline grid
- `src/components/epg/EpgCell.tsx` - Grid cells
- `src/components/epg/TimeNavigationBar.tsx` - Current time nav
- `src/components/epg/ProgramDetailsPanel.tsx` - Slide-in details (can adapt for Story 5.8)
- `src/components/epg/EpgSearchInput.tsx` - Keep for Story 5.7
- `src/components/epg/EpgSearchResults.tsx` - Keep for Story 5.7

**DO NOT modify these existing components in this story.** Create new components in `tv-style/` subdirectory.

### File Structure to Create

```
src/components/epg/tv-style/
├── index.ts                          # Exports all tv-style components
├── EpgBackground.tsx                 # Gradient background layer
├── EpgMainContent.tsx                # Three-panel layout container
├── EpgChannelListPlaceholder.tsx     # Placeholder for left panel
├── EpgSchedulePanelPlaceholder.tsx   # Placeholder for center panel
└── EpgDetailsPanelPlaceholder.tsx    # Placeholder for right panel

src/views/
├── EPG.tsx                           # UNCHANGED - existing grid view
└── EpgTv.tsx                         # NEW - TV-style view
```

### Layout CSS Patterns

**Main Container (EpgTv.tsx):**
```tsx
<div className="relative h-full w-full overflow-hidden">
  <EpgBackground />
  <div className="relative z-10 flex flex-col h-full">
    {/* Future: EpgTopBar */}
    <EpgMainContent>
      <EpgChannelListPlaceholder />
      <EpgSchedulePanelPlaceholder />
      <EpgDetailsPanelPlaceholder isVisible={!!selectedProgram} />
    </EpgMainContent>
  </div>
</div>
```

**Three-Panel Layout (EpgMainContent.tsx):**
```tsx
<div className="flex flex-1 gap-4 p-4 min-h-0">
  {/* Left Panel - Channel List */}
  <div className="w-[30%] bg-black/60 rounded-lg overflow-hidden">
    {children[0]}
  </div>

  {/* Center Panel - Schedule */}
  <div className="w-[30%] bg-black/50 rounded-lg overflow-hidden">
    {children[1]}
  </div>

  {/* Right Panel - Details (conditionally visible) */}
  <div className="w-[40%] bg-black/50 rounded-lg overflow-hidden">
    {children[2]}
  </div>
</div>
```

**Background Component (EpgBackground.tsx):**
```tsx
<div
  data-testid="epg-background"
  className="fixed inset-0 z-0"
  style={{
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
  }}
/>
```

### Responsive Considerations

For this foundation story, implement **desktop-first** (1280px+) layout:
- Full three-panel layout visible
- Responsive breakpoints will be added in future stories

**Do NOT implement tablet/mobile layouts in this story** - that's future scope after Stories 5.4-5.8 complete.

### Previous Story Learnings (Story 5.3)

From Story 5.3 code review:
1. **Event naming:** Use camelCase for custom events
2. **Memory leaks:** Clean up event listeners in useEffect return
3. **Test data-testids:** Add meaningful `data-testid` attributes for E2E testing
4. **Code review process:** Expect style fixes in code review - keep code clean

### Testing Considerations

- Add `data-testid="epg-tv-view"` to root container
- Add `data-testid="epg-background"` to background layer
- Add `data-testid="epg-left-panel"` to channel list container
- Add `data-testid="epg-center-panel"` to schedule container
- Add `data-testid="epg-right-panel"` to details container
- Test: Three panels render with correct widths
- Test: Gradient background is visible
- Test: Right panel visibility toggles correctly
- Test: Panel backgrounds have correct opacity

### Edge Cases to Handle

1. **Window resize** - Layout should remain proportional (flexbox handles this)
2. **Very narrow viewport** - For now, let it scroll horizontally (responsive in future)
3. **No program selected** - Right panel shows gradient background only

### What NOT to Do in This Story

- Do NOT fetch EPG data from Tauri backend
- Do NOT implement channel list rendering (Story 5.5)
- Do NOT implement schedule rendering (Story 5.6)
- Do NOT implement top bar with search/navigation (Story 5.7)
- Do NOT implement full details panel (Story 5.8)
- Do NOT modify existing EPG.tsx or its components
- Do NOT implement keyboard navigation (future enhancement)
- Do NOT implement responsive tablet/mobile layouts

### References

- [Source: _bmad-output/planning-artifacts/ux-epg-tv-guide.md - Complete UX specification]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.4-EPG-TV-Style-Layout-Foundation]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-Architecture]
- [Source: _bmad-output/implementation-artifacts/5-3-program-details-view.md - Previous story patterns]
- [Source: src/views/EPG.tsx - Existing EPG implementation (reference only)]
- [Source: src/components/epg/index.ts - Export pattern to follow]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
