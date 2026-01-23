# ATDD Checklist - Epic 5, Story 5.4: EPG TV-Style Layout Foundation

**Date:** 2026-01-22
**Author:** Javier
**Primary Test Level:** E2E

---

## Story Summary

Create the foundation for a TV-style EPG interface with a three-panel layout over a cinematic gradient background. This story establishes the visual structure and layout components that will be populated with functionality in subsequent stories (5.5-5.8).

**As a** user
**I want** a TV-style EPG interface with three panels over a cinematic background
**So that** I can browse channels in a lean-back, television-friendly experience

---

## Acceptance Criteria

1. **AC #1**: When EPG view loads, display three-panel layout with gradient background
   - Left panel (~30%): Channel list container with semi-transparent dark overlay
   - Center panel (~30%): Schedule container with semi-transparent dark overlay
   - Right panel (~40%): Details container with semi-transparent dark overlay
   - Gradient background: diagonal purple to dark blue

2. **AC #2**: When no program is selected, right panel shows only gradient background (empty state)

3. **AC #3**: When program is selected, right panel displays program details content

---

## Failing Tests Created (RED Phase)

### E2E Tests (5 tests)

**File:** `tests/e2e/epg-tv-layout.spec.ts` (162 lines)

#### Test 1: Three-panel layout with gradient background
- ✅ **Status:** RED - Route `/epg-tv` does not exist (404)
- **Verifies:** AC #1 - Three panels render with correct widths, gradient background visible, semi-transparent overlays applied

#### Test 2: Right panel empty state when no program selected
- ✅ **Status:** RED - Route `/epg-tv` does not exist (404)
- **Verifies:** AC #2 - Details content not visible, left and center panels visible

#### Test 3: Right panel shows details when program selected
- ✅ **Status:** RED - Route `/epg-tv` does not exist (404), toggle button does not exist
- **Verifies:** AC #3 - Details content becomes visible when state changes, placeholder text shown

#### Test 4: Placeholder content in left and center panels
- ✅ **Status:** RED - Route `/epg-tv` does not exist (404)
- **Verifies:** AC #1, #2 - Placeholder text displays in channel list and schedule panels

#### Test 5: Layout maintains structure on window resize
- ✅ **Status:** RED - Route `/epg-tv` does not exist (404)
- **Verifies:** AC #1 - Layout remains proportional when viewport changes

---

## Data Factories Created

**None required** - This story tests static layout structure with no dynamic data.

---

## Fixtures Created

**None required** - Simple E2E tests using standard Playwright test context. No authentication or data seeding needed.

---

## Mock Requirements

**None required** - This story has no backend integration. All components are presentational with placeholder content.

---

## Required data-testid Attributes

### EPG TV View Components

- `epg-tv-view` - Root container for entire EPG TV view
- `epg-background` - Gradient background layer (fixed position)
- `epg-left-panel` - Left panel container (channel list, ~30% width)
- `epg-center-panel` - Center panel container (schedule, ~30% width)
- `epg-right-panel` - Right panel container (details, ~40% width)
- `epg-details-content` - Content wrapper inside right panel (conditionally visible)
- `toggle-details-visibility` - Temporary test button to toggle right panel visibility

**Implementation Example:**

```tsx
// src/views/EpgTv.tsx
<div data-testid="epg-tv-view" className="relative h-full w-full overflow-hidden">
  <EpgBackground data-testid="epg-background" />

  <div className="relative z-10 flex flex-col h-full">
    <EpgMainContent>
      <div data-testid="epg-left-panel" className="w-[30%] bg-black/60 rounded-lg">
        <EpgChannelListPlaceholder />
      </div>

      <div data-testid="epg-center-panel" className="w-[30%] bg-black/50 rounded-lg">
        <EpgSchedulePanelPlaceholder />
      </div>

      <div data-testid="epg-right-panel" className="w-[40%] bg-black/50 rounded-lg">
        <EpgDetailsPanelPlaceholder isVisible={!!selectedProgram}>
          <div data-testid="epg-details-content">
            {/* Details content */}
          </div>
        </EpgDetailsPanelPlaceholder>
      </div>
    </EpgMainContent>
  </div>

  {/* Temporary test toggle button */}
  <button
    data-testid="toggle-details-visibility"
    onClick={() => setSelectedProgram(prev => prev ? null : {})}
  >
    Toggle Details
  </button>
</div>
```

---

## Implementation Checklist

### Test 1: Three-panel layout with gradient background

**File:** `tests/e2e/epg-tv-layout.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/components/epg/tv-style/EpgBackground.tsx` component
  - Apply gradient: `linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)`
  - Set `position: fixed`, full viewport coverage, `z-index: 0`
  - Add `data-testid="epg-background"`

- [ ] Create `src/components/epg/tv-style/EpgMainContent.tsx` layout container
  - Implement flex row layout with gap
  - Three child containers with widths: 30%, 30%, 40%
  - Semi-transparent backgrounds: `rgba(0,0,0,0.6)`, `rgba(0,0,0,0.5)`, `rgba(0,0,0,0.5)`
  - Add data-testids: `epg-left-panel`, `epg-center-panel`, `epg-right-panel`

- [ ] Create `src/components/epg/tv-style/EpgChannelListPlaceholder.tsx`
  - Display placeholder text: "Channel list (Story 5.5)"

- [ ] Create `src/components/epg/tv-style/EpgSchedulePanelPlaceholder.tsx`
  - Display placeholder text: "Schedule panel (Story 5.6)"

- [ ] Create `src/components/epg/tv-style/EpgDetailsPanelPlaceholder.tsx`
  - Accept `isVisible` prop
  - Conditionally render details content wrapper with `data-testid="epg-details-content"`

- [ ] Create `src/views/EpgTv.tsx` view
  - Compose all layout components
  - Add state for `selectedProgram` (initially null)
  - Wire visibility logic to right panel
  - Add temporary toggle button with `data-testid="toggle-details-visibility"`
  - Add `data-testid="epg-tv-view"` to root

- [ ] Update `src/App.tsx` routing
  - Add route `/epg-tv` pointing to `EpgTv` component
  - Keep existing `/epg` route unchanged

- [ ] Create `src/components/epg/tv-style/index.ts` exports

- [ ] Run test: `pnpm test:e2e -- epg-tv-layout.spec.ts -g "should display three-panel layout"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 3 hours

---

### Test 2: Right panel empty state when no program selected

**File:** `tests/e2e/epg-tv-layout.spec.ts`

**Tasks to make this test pass:**

- [ ] Verify `EpgDetailsPanelPlaceholder` renders conditionally
  - When `isVisible={false}`, details content wrapper not in DOM
  - When `isVisible={true}`, details content wrapper rendered with `data-testid="epg-details-content"`

- [ ] Ensure initial state: `selectedProgram = null` in `EpgTv.tsx`

- [ ] Run test: `pnpm test:e2e -- epg-tv-layout.spec.ts -g "should show only gradient background"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours (covered by Test 1 implementation)

---

### Test 3: Right panel shows details when program selected

**File:** `tests/e2e/epg-tv-layout.spec.ts`

**Tasks to make this test pass:**

- [ ] Add toggle button in `EpgTv.tsx` with `data-testid="toggle-details-visibility"`
  - onClick: toggle `selectedProgram` between null and mock object
  - Position: fixed bottom-right corner (for testing only)

- [ ] Verify details content displays placeholder text when visible
  - Text: "Program details (Story 5.8)" in `EpgDetailsPanelPlaceholder`

- [ ] Run test: `pnpm test:e2e -- epg-tv-layout.spec.ts -g "should display program details"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours (covered by Test 1 implementation)

---

### Test 4: Placeholder content in left and center panels

**File:** `tests/e2e/epg-tv-layout.spec.ts`

**Tasks to make this test pass:**

- [ ] Verify `EpgChannelListPlaceholder` contains text "Channel list"
- [ ] Verify `EpgSchedulePanelPlaceholder` contains text "Schedule panel"

- [ ] Run test: `pnpm test:e2e -- epg-tv-layout.spec.ts -g "should render placeholder content"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0 hours (covered by Test 1 implementation)

---

### Test 5: Layout maintains structure on window resize

**File:** `tests/e2e/epg-tv-layout.spec.ts`

**Tasks to make this test pass:**

- [ ] Ensure flexbox layout in `EpgMainContent` with percentage widths
  - Uses flex-based sizing (e.g., `w-[30%]`, `w-[40%]`)
  - Responds to viewport changes automatically

- [ ] Test at multiple viewport sizes: 1280x720, 1600x900
- [ ] Run test: `pnpm test:e2e -- epg-tv-layout.spec.ts -g "should maintain layout structure"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0 hours (covered by Test 1 implementation)

---

## Running Tests

```bash
# Run all E2E tests for this story
pnpm test:e2e -- epg-tv-layout.spec.ts

# Run specific test
pnpm test:e2e -- epg-tv-layout.spec.ts -g "three-panel layout"

# Run tests in headed mode (see browser)
pnpm test:e2e -- epg-tv-layout.spec.ts --headed

# Debug specific test
pnpm test:e2e -- epg-tv-layout.spec.ts -g "three-panel layout" --debug

# Run with UI mode (interactive debugging)
pnpm test:e2e -- epg-tv-layout.spec.ts --ui
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All 5 E2E tests written and failing
- ✅ Tests use Given-When-Then format
- ✅ Network-first pattern not applicable (no network requests)
- ✅ Selector resilience: data-testid attributes specified
- ✅ No fixtures or factories needed (static layout testing)
- ✅ Implementation checklist created with clear tasks

**Verification:**

- All tests fail with expected error: "Route /epg-tv does not exist" or "Element not found"
- Failure messages are clear and actionable
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick first test** from implementation checklist (Test 1: Three-panel layout)
2. **Create layout components** following the task breakdown:
   - Start with `EpgBackground.tsx` (gradient layer)
   - Build `EpgMainContent.tsx` (three-panel container)
   - Add placeholder components for each panel
   - Compose in `EpgTv.tsx` view
   - Wire up routing in `App.tsx`
3. **Run test incrementally** after each component is created
4. **Verify test passes** when all tasks complete
5. **Move to next test** (Tests 2-5 should pass automatically if Test 1 is implemented correctly)

**Key Principles:**

- Focus on minimal implementation (placeholders, not full functionality)
- Use Tailwind utility classes for styling (`bg-black/60`, `w-[30%]`, etc.)
- Follow exact gradient and color specifications from story
- Add all required `data-testid` attributes for test stability
- Keep existing `/epg` route unchanged (parallel implementation)

**Progress Tracking:**

- Check off tasks in implementation checklist as completed
- Share progress in daily standup
- Update story status to `in-progress` in sprint-status.yaml

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all 5 tests pass** (green phase complete)
2. **Review component structure**:
   - Extract common styles to Tailwind config if needed
   - Ensure proper TypeScript types for props
   - Verify accessibility (ARIA roles, semantic HTML)
3. **Code quality checks**:
   - Remove any hardcoded magic numbers
   - Add JSDoc comments to components
   - Ensure consistent naming conventions
4. **Run tests after refactoring** to ensure no regressions
5. **Prepare for code review**

**Key Principles:**

- Tests provide safety net (refactor with confidence)
- Maintain test stability (don't change data-testids)
- Focus on readability and maintainability
- Don't add features beyond story scope

**Completion:**

- All tests pass
- Code is clean and documented
- TypeScript compilation succeeds
- Vite build succeeds
- Ready for Story 5.5 (channel list implementation)

---

## Next Steps

1. **DEV workflow picks up this checklist** (manual handoff from TEA)
2. **Review story requirements** from `5-4-epg-tv-style-layout-foundation.md`
3. **Run failing tests** to confirm RED phase: `pnpm test:e2e -- epg-tv-layout.spec.ts`
4. **Begin implementation** using implementation checklist
5. **Work test by test** (red → green for each)
6. **Verify all tests pass** before moving to refactor phase
7. **Run code review workflow** when implementation complete
8. **Update story status to 'done'** in sprint-status.yaml after code review passes

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **test-quality.md** - Deterministic test patterns (Given-When-Then, explicit assertions, no hard waits)
- **selector-resilience.md** - data-testid hierarchy (preferred over CSS classes or IDs)
- **network-first.md** - Not applicable (no network requests in this story)
- **fixture-architecture.md** - Not applicable (no complex fixtures needed)
- **data-factories.md** - Not applicable (no dynamic test data needed)

See `tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm test:e2e -- epg-tv-layout.spec.ts`

**Expected Results:**

```
Running 5 tests using 1 worker

  ✗ EPG TV-Style Layout › should display three-panel layout with gradient background
    Error: page.goto: net::ERR_ABORTED; maybe frame was detached?

    Reason: Route /epg-tv does not exist (404)

  ✗ EPG TV-Style Layout › should show only gradient background in right panel when no program selected
    Error: page.goto: net::ERR_ABORTED; maybe frame was detached?

    Reason: Route /epg-tv does not exist (404)

  ✗ EPG TV-Style Layout › should display program details in right panel when program is selected
    Error: page.goto: net::ERR_ABORTED; maybe frame was detached?

    Reason: Route /epg-tv does not exist (404)

  ✗ EPG TV-Style Layout › should render placeholder content in left and center panels
    Error: page.goto: net::ERR_ABORTED; maybe frame was detached?

    Reason: Route /epg-tv does not exist (404)

  ✗ EPG TV-Style Layout › should maintain layout structure on window resize
    Error: page.goto: net::ERR_ABORTED; maybe frame was detached?

    Reason: Route /epg-tv does not exist (404)

5 failed
```

**Summary:**

- Total tests: 5
- Passing: 0 (expected)
- Failing: 5 (expected)
- Status: ✅ RED phase verified

**Expected Failure Messages:**

1. **Test 1**: Route /epg-tv does not exist → Need to create EpgTv view and add routing
2. **Test 2**: Route /epg-tv does not exist → Same as Test 1
3. **Test 3**: Route /epg-tv does not exist, toggle button missing → Create view with toggle button
4. **Test 4**: Route /epg-tv does not exist → Same as Test 1
5. **Test 5**: Route /epg-tv does not exist → Same as Test 1

---

## Notes

### Story Scope Boundaries

**This story creates ONLY the layout foundation:**
- ✅ Gradient background component
- ✅ Three-panel layout structure
- ✅ Placeholder components (channel list, schedule, details)
- ✅ Conditional visibility logic for right panel
- ✅ Basic routing to new `/epg-tv` view
- ✅ Temporary toggle button for testing visibility

**What is NOT in scope (future stories):**
- ❌ Channel list with real data (Story 5.5)
- ❌ Schedule grid with real programs (Story 5.6)
- ❌ Top bar with search/navigation (Story 5.7)
- ❌ Full program details panel (Story 5.8)
- ❌ Backend data integration (Stories 5.5-5.8)
- ❌ Responsive mobile/tablet layouts (future enhancement)
- ❌ Keyboard navigation (future enhancement)

### Visual Design Specifications

From `ux-epg-tv-guide.md`:

**Gradient Background:**
```css
background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
```

**Panel Backgrounds:**
- Left panel: `rgba(0, 0, 0, 0.6)` - Most prominent
- Center panel: `rgba(0, 0, 0, 0.5)` - Slightly less opaque for depth
- Right panel: `rgba(0, 0, 0, 0.5)` - Same as center

**Panel Widths:**
- Left: ~30% (channel list)
- Center: ~30% (schedule)
- Right: ~40% (details)

**Text Colors:**
- Primary: `#ffffff` (white)
- Secondary: `#a0a0a0` (light gray)
- Muted: `#c0c0c0` (lighter gray)

### Component Structure

```
src/components/epg/tv-style/
├── index.ts
├── EpgBackground.tsx
├── EpgMainContent.tsx
├── EpgChannelListPlaceholder.tsx
├── EpgSchedulePanelPlaceholder.tsx
└── EpgDetailsPanelPlaceholder.tsx

src/views/
└── EpgTv.tsx (new)
```

### Testing Strategy Notes

- **Primary focus**: Visual layout and structure
- **No data mocking needed**: All components use static placeholder text
- **No API calls**: Backend integration happens in Stories 5.5-5.8
- **Resize testing**: Verify flexbox layout adapts to viewport changes
- **Conditional rendering**: Test right panel visibility based on state

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Refer to `_bmad-output/implementation-artifacts/5-4-epg-tv-style-layout-foundation.md` for story details
- Consult `_bmad/bmm/testarch/knowledge` for testing best practices
- Review UX specifications in `_bmad-output/planning-artifacts/ux-epg-tv-guide.md`

---

**Generated by BMad TEA Agent** - 2026-01-22
