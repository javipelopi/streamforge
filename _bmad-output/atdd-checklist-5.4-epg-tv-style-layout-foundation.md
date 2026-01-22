# ATDD Checklist - Epic 5, Story 5.4: EPG TV-Style Layout Foundation

**Date:** 2026-01-22
**Author:** Javier
**Primary Test Level:** E2E

---

## Story Summary

Create the foundational three-panel TV-style EPG layout with a cinematic gradient background. This story establishes the visual structure and placeholder components that will be populated with functionality in Stories 5.5-5.8. The layout includes a channel list panel (left), schedule panel (center), and details panel (right) over a diagonal gradient background.

**As a** user
**I want** a TV-style EPG interface with three panels over a cinematic background
**So that** I can browse channels in a lean-back, television-friendly experience

---

## Acceptance Criteria

1. **AC1: Three-Panel Layout with Gradient Background**
   - When EPG view loads
   - Then I see a three-panel layout:
     - Left panel (~30%): Channel list with now-playing info
     - Center panel (~30%): Schedule for selected channel
     - Right panel (~40%): Program details (when selected)
   - And a gradient background (purple to dark blue, diagonal)
   - And semi-transparent dark overlays on each panel

2. **AC2: Right Panel Empty State**
   - Given no program is selected
   - When viewing the EPG
   - Then the right panel shows only the gradient background
   - And left and center panels are visible

3. **AC3: Right Panel with Program Details**
   - Given a program is selected
   - When viewing the EPG
   - Then the right panel displays full program details

---

## Failing Tests Created (RED Phase)

### E2E Tests (5 tests)

**File:** `tests/e2e/epg-tv-layout.spec.ts` (160 lines)

All tests are currently failing because the implementation has not been created yet. This is the expected RED phase of TDD.

- ✅ **Test:** should display three-panel layout with gradient background
  - **Status:** RED - Element not found: `data-testid="epg-background"`
  - **Verifies:** AC1 - Three panels render with correct widths (~30%, ~30%, ~40%), gradient background is visible and applied, panels have semi-transparent dark backgrounds

- ✅ **Test:** should show only gradient background in right panel when no program selected
  - **Status:** RED - Element not found: `data-testid="epg-right-panel"`
  - **Verifies:** AC2 - Right panel visible but shows gradient only (no details content), left and center panels remain visible

- ✅ **Test:** should display program details in right panel when program is selected
  - **Status:** RED - Element not found: `data-testid="toggle-details-visibility"`
  - **Verifies:** AC3 - Right panel displays program details content when selectedProgram state is set, placeholder text "Program details" is visible

- ✅ **Test:** should render placeholder content in left and center panels
  - **Status:** RED - Element not found: `data-testid="epg-left-panel"`
  - **Verifies:** AC1, AC2 - Left panel shows "Channel list" placeholder, center panel shows "Schedule panel" placeholder

- ✅ **Test:** should maintain layout structure on window resize
  - **Status:** RED - Element not found: `data-testid="epg-left-panel"`
  - **Verifies:** AC1 - Layout remains proportional on window resize (flexbox responsiveness), all three panels and gradient background remain visible

---

## Data Factories Created

This story focuses on layout and visual structure, so no data factories are required. Future stories (5.5-5.8) will introduce channel, schedule, and program data factories.

**Note:** Existing factories in the project can be referenced for patterns:
- `tests/support/factories/channel.factory.ts` - Channel data (for Story 5.5)
- `tests/support/factories/program.factory.ts` - Program data (for Stories 5.6, 5.8)
- `tests/support/factories/epg-schedule.factory.ts` - Schedule data (for Story 5.6)

---

## Fixtures Created

No new fixtures are required for this foundation story. Tests verify static layout structure without data dependencies.

**Future Stories:** Fixtures will be needed when implementing:
- Story 5.5: Channel list rendering (epg-channel-list.fixture.ts)
- Story 5.6: Schedule panel (epg-schedule-panel.fixture.ts)
- Story 5.8: Program details (program-details.fixture.ts)

---

## Mock Requirements

No external services or API calls are required for this foundation story. All components render placeholder content without data dependencies.

**Future Stories:** Mock requirements will be added when integrating with Tauri backend:
- Story 5.5: Mock `get_channels` Tauri command
- Story 5.6: Mock `get_epg_schedule` Tauri command
- Story 5.7: Mock `search_programs` Tauri command

---

## Required data-testid Attributes

### EpgTv.tsx (Main View)

- `epg-tv-view` - Root container for the entire EPG TV view

### EpgBackground.tsx

- `epg-background` - Gradient background layer (fixed position, z-index: 0)

### EpgMainContent.tsx (Three-Panel Container)

- `epg-left-panel` - Left panel container (channel list, ~30% width)
- `epg-center-panel` - Center panel container (schedule, ~30% width)
- `epg-right-panel` - Right panel container (details, ~40% width)

### EpgDetailsPanelPlaceholder.tsx

- `epg-details-content` - Details content (visible only when program selected)

### Temporary Test Mechanism (Story 5.4 only)

- `toggle-details-visibility` - Button to toggle right panel visibility for testing AC3

**Implementation Example:**

```tsx
// EpgBackground.tsx
<div
  data-testid="epg-background"
  className="fixed inset-0 z-0"
  style={{
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
  }}
/>

// EpgMainContent.tsx
<div className="flex flex-1 gap-4 p-4 min-h-0">
  <div data-testid="epg-left-panel" className="w-[30%] bg-black/60 rounded-lg overflow-hidden">
    {/* Left panel content */}
  </div>
  <div data-testid="epg-center-panel" className="w-[30%] bg-black/50 rounded-lg overflow-hidden">
    {/* Center panel content */}
  </div>
  <div data-testid="epg-right-panel" className="w-[40%] bg-black/50 rounded-lg overflow-hidden">
    {/* Right panel content */}
  </div>
</div>

// EpgDetailsPanelPlaceholder.tsx
{isVisible && (
  <div data-testid="epg-details-content" className="p-4 text-white">
    Program details (Story 5.8)
  </div>
)}

// EpgTv.tsx (temporary test button)
<button
  data-testid="toggle-details-visibility"
  onClick={() => setSelectedProgram(selectedProgram ? null : { id: 'test' })}
  className="absolute top-4 right-4 z-20 bg-blue-500 px-4 py-2 rounded"
>
  Toggle Details
</button>
```

---

## Implementation Checklist

### Test: should display three-panel layout with gradient background

**File:** `tests/e2e/epg-tv-layout.spec.ts:11-83`

**Tasks to make this test pass:**

- [ ] Task 1: Create gradient background component
  - [ ] 1.1 Create `src/components/epg/tv-style/EpgBackground.tsx`
  - [ ] 1.2 Implement gradient: `linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)`
  - [ ] 1.3 Set fixed position, covers entire viewport, z-index: 0
  - [ ] 1.4 Add `data-testid="epg-background"`

- [ ] Task 2: Create three-panel layout container
  - [ ] 2.1 Create `src/components/epg/tv-style/EpgMainContent.tsx`
  - [ ] 2.2 Implement flex row layout with three children
  - [ ] 2.3 Left panel: ~30% width, `rgba(0, 0, 0, 0.6)` background, `data-testid="epg-left-panel"`
  - [ ] 2.4 Center panel: ~30% width, `rgba(0, 0, 0, 0.5)` background, `data-testid="epg-center-panel"`
  - [ ] 2.5 Right panel: ~40% width, `rgba(0, 0, 0, 0.5)` background, `data-testid="epg-right-panel"`
  - [ ] 2.6 Add proper padding and rounded corners

- [ ] Task 3: Create placeholder channel list panel
  - [ ] 3.1 Create `src/components/epg/tv-style/EpgChannelListPlaceholder.tsx`
  - [ ] 3.2 Display placeholder text: "Channel list (Story 5.5)"
  - [ ] 3.3 Apply semi-transparent dark background styling

- [ ] Run test: `pnpm test tests/e2e/epg-tv-layout.spec.ts --grep "should display three-panel layout"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: should show only gradient background in right panel when no program selected

**File:** `tests/e2e/epg-tv-layout.spec.ts:82-101`

**Tasks to make this test pass:**

- [ ] Task 4: Create placeholder details panel with visibility logic
  - [ ] 4.1 Create `src/components/epg/tv-style/EpgDetailsPanelPlaceholder.tsx`
  - [ ] 4.2 Accept `isVisible` prop to control display
  - [ ] 4.3 When `isVisible=false`: show gradient background only (no content)
  - [ ] 4.4 When `isVisible=true`: show placeholder content with `data-testid="epg-details-content"`

- [ ] Run test: `pnpm test tests/e2e/epg-tv-layout.spec.ts --grep "should show only gradient background"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: should display program details in right panel when program is selected

**File:** `tests/e2e/epg-tv-layout.spec.ts:101-121`

**Tasks to make this test pass:**

- [ ] Task 5: Create new EPG TV view page with state management
  - [ ] 5.1 Create `src/views/EpgTv.tsx`
  - [ ] 5.2 Compose all layout components: EpgBackground, EpgMainContent, three panels
  - [ ] 5.3 Add state for `selectedProgram` (null initially)
  - [ ] 5.4 Wire visibility logic: right panel visible only when selectedProgram is not null
  - [ ] 5.5 Add temporary toggle button with `data-testid="toggle-details-visibility"`
  - [ ] 5.6 Add `data-testid="epg-tv-view"` to root container

- [ ] Task 6: Add routing for new EPG TV view
  - [ ] 6.1 Update `src/App.tsx` to add route `/epg-tv` pointing to EpgTv view
  - [ ] 6.2 Keep existing `/epg` route unchanged (legacy grid view)

- [ ] Run test: `pnpm test tests/e2e/epg-tv-layout.spec.ts --grep "should display program details"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: should render placeholder content in left and center panels

**File:** `tests/e2e/epg-tv-layout.spec.ts:121-134`

**Tasks to make this test pass:**

- [ ] Task 7: Create placeholder schedule panel
  - [ ] 7.1 Create `src/components/epg/tv-style/EpgSchedulePanelPlaceholder.tsx`
  - [ ] 7.2 Display placeholder text: "Schedule panel (Story 5.6)"
  - [ ] 7.3 Apply semi-transparent dark background styling

- [ ] Task 8: Ensure placeholder text is visible in left panel
  - [ ] 8.1 Update EpgChannelListPlaceholder to ensure text "Channel list" is visible

- [ ] Run test: `pnpm test tests/e2e/epg-tv-layout.spec.ts --grep "should render placeholder content"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: should maintain layout structure on window resize

**File:** `tests/e2e/epg-tv-layout.spec.ts:135-159`

**Tasks to make this test pass:**

- [ ] Task 9: Verify flexbox responsiveness
  - [ ] 9.1 Ensure EpgMainContent uses flexbox with proper flex-1 classes
  - [ ] 9.2 Verify panels maintain proportions on resize (handled by flexbox)
  - [ ] 9.3 Test manually at 1600x900 and 1280x720 resolutions

- [ ] Run test: `pnpm test tests/e2e/epg-tv-layout.spec.ts --grep "should maintain layout structure"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Final Tasks: Component Structure and Build

**Tasks to complete the story:**

- [ ] Task 10: Create component exports and structure
  - [ ] 10.1 Create `src/components/epg/tv-style/index.ts` with all exports
  - [ ] 10.2 Update `src/components/epg/index.ts` to re-export tv-style components
  - [ ] 10.3 Ensure TypeScript compilation succeeds: `pnpm build`
  - [ ] 10.4 Ensure Vite build succeeds

- [ ] Task 11: Run all tests for Story 5.4
  - [ ] 11.1 Run full test suite: `pnpm test tests/e2e/epg-tv-layout.spec.ts`
  - [ ] 11.2 Verify all 5 tests pass
  - [ ] 11.3 Check test execution time (should be < 30 seconds for all 5 tests)

**Estimated Effort:** 0.5 hours

---

## Running Tests

```bash
# Run all failing tests for Story 5.4
pnpm test tests/e2e/epg-tv-layout.spec.ts

# Run specific test
pnpm test tests/e2e/epg-tv-layout.spec.ts --grep "should display three-panel layout"

# Run tests in headed mode (see browser)
pnpm test tests/e2e/epg-tv-layout.spec.ts --headed

# Debug specific test
pnpm test tests/e2e/epg-tv-layout.spec.ts --grep "should display three-panel layout" --debug

# Run tests with UI mode (interactive)
pnpm test tests/e2e/epg-tv-layout.spec.ts --ui

# Run tests with trace (full debugging)
pnpm test tests/e2e/epg-tv-layout.spec.ts --trace on
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All tests written and failing (5 E2E tests)
- ✅ Test structure follows Given-When-Then pattern
- ✅ data-testid requirements documented
- ✅ Implementation checklist created with clear tasks
- ✅ Acceptance criteria mapped to tests

**Verification:**

- All tests run and fail as expected
- Failure messages are clear: "element(s) not found" for missing data-testid attributes
- Tests fail due to missing implementation, not test bugs
- Tests use deterministic selectors (data-testid)

**Test Run Output:**
```
Running 5 tests using 4 workers

  ✘  1 [chromium] › should display program details in right panel when program is selected
  ✘  2 [chromium] › should display three-panel layout with gradient background
  ✘  3 [chromium] › should show only gradient background in right panel when no program selected
  ✘  4 [chromium] › should render placeholder content in left and center panels
  ✘  5 [chromium] › should maintain layout structure on window resize

  5 failed
```

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (recommend starting with "should display three-panel layout")
2. **Read the test** to understand expected behavior
3. **Implement minimal code** to make that specific test pass
4. **Run the test** to verify it now passes (green)
5. **Check off the task** in implementation checklist
6. **Move to next test** and repeat

**Key Principles:**

- One test at a time (don't try to fix all at once)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap
- Follow the existing component patterns in `src/components/epg/`
- Follow the UX design spec in `_bmad-output/planning-artifacts/ux-epg-tv-guide.md`

**Recommended Order:**

1. Test 1: should display three-panel layout (creates foundation)
2. Test 4: should render placeholder content (adds placeholder components)
3. Test 2: should show only gradient background (tests empty state)
4. Test 3: should display program details (tests visible state)
5. Test 5: should maintain layout structure (verifies responsiveness)

**Progress Tracking:**

- Check off tasks in this document as you complete them
- Update story status to IN PROGRESS in `sprint-status.yaml`
- Share progress in daily standup

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
2. **Review code for quality** (readability, maintainability, performance)
3. **Extract duplications** (DRY principle)
4. **Optimize performance** (if needed)
5. **Ensure tests still pass** after each refactor
6. **Update documentation** (if component APIs change)

**Key Principles:**

- Tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if tests fail)
- Run tests after each change
- Don't change test behavior (only implementation)

**Refactoring Opportunities:**

- Extract common styling patterns into Tailwind utilities
- Consolidate panel background opacity values into constants
- Create reusable layout hook for panel width calculations
- Extract gradient background CSS into a shared constant

**Completion:**

- All tests pass (5/5 tests green)
- Code quality meets team standards
- No duplications or code smells
- Ready for code review and story approval

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow (manual handoff)
2. **Review this checklist** with team in standup or planning
3. **Run failing tests** to confirm RED phase: `pnpm test tests/e2e/epg-tv-layout.spec.ts`
4. **Begin implementation** using implementation checklist as guide
5. **Work one test at a time** (red → green for each)
6. **Share progress** in daily standup
7. **When all tests pass**, refactor code for quality
8. **When refactoring complete**, manually update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **fixture-architecture.md** - Test fixture patterns with setup/teardown and auto-cleanup using Playwright's `test.extend()`
- **data-factories.md** - Factory patterns using `@faker-js/faker` for random test data generation with overrides support
- **test-quality.md** - Test design principles (Given-When-Then, one assertion per test, determinism, isolation)
- **selector-resilience.md** - Selector hierarchy (data-testid > ARIA roles > text content > CSS/IDs)
- **test-levels-framework.md** - Test level selection framework (E2E for UI layout validation)

**Note:** This story focuses on visual layout structure, so data factories and fixtures are not required. Component TDD and network-first patterns will be applied in future stories when implementing interactive functionality.

See `_bmad/bmm/testarch/tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm test tests/e2e/epg-tv-layout.spec.ts`

**Results:**

```
> streamforge@0.1.0 test /Users/javiersanchez/Development/iptv
> pnpm exec playwright test tests/e2e/epg-tv-layout.spec.ts

Running 5 tests using 4 workers

  ✘  1 [chromium] › should display program details in right panel when program is selected (5.5s)
  ✘  2 [chromium] › should display three-panel layout with gradient background (5.5s)
  ✘  3 [chromium] › should show only gradient background in right panel when no program selected (5.5s)
  ✘  4 [chromium] › should render placeholder content in left and center panels (5.5s)
  ✘  5 [chromium] › should maintain layout structure on window resize (5.2s)

  5 failed
```

**Summary:**

- Total tests: 5
- Passing: 0 (expected)
- Failing: 5 (expected)
- Status: ✅ RED phase verified

**Expected Failure Messages:**

1. **Test 1:** "element(s) not found" - Missing `data-testid="epg-background"`
2. **Test 2:** "element(s) not found" - Missing `data-testid="epg-right-panel"`
3. **Test 3:** "element(s) not found" - Missing `data-testid="toggle-details-visibility"`
4. **Test 4:** "element(s) not found" - Missing `data-testid="epg-left-panel"`
5. **Test 5:** "element(s) not found" - Missing `data-testid="epg-left-panel"`

All failures are due to missing implementation (no components created yet). This is the expected behavior for the RED phase of TDD.

---

## Notes

### Visual Design Requirements

From `ux-epg-tv-guide.md`:

**Background Gradient:**
```css
background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
```

**Panel Backgrounds:**
| Panel | Background | Purpose |
|-------|------------|---------|
| Left panel | `rgba(0, 0, 0, 0.6)` | Channel list - most prominent |
| Center panel | `rgba(0, 0, 0, 0.5)` | Schedule - slightly less opaque |
| Right panel | `rgba(0, 0, 0, 0.5)` | Details - same as center |

**Panel Widths:**
- Left panel: ~30% (channel list)
- Center panel: ~30% (schedule)
- Right panel: ~40% (details)

**Text Colors:**
- Primary text: `#ffffff` (white)
- Secondary text: `#a0a0a0` (light gray)
- Muted text: `#c0c0c0` (lighter gray for descriptions)

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

### What NOT to Do in This Story

- ❌ Do NOT fetch EPG data from Tauri backend
- ❌ Do NOT implement channel list rendering (Story 5.5)
- ❌ Do NOT implement schedule rendering (Story 5.6)
- ❌ Do NOT implement top bar with search/navigation (Story 5.7)
- ❌ Do NOT implement full details panel (Story 5.8)
- ❌ Do NOT modify existing EPG.tsx or its components
- ❌ Do NOT implement keyboard navigation
- ❌ Do NOT implement responsive tablet/mobile layouts

### Architecture Compliance

This story implements the foundation for **FR39** (User can browse EPG data) as redesigned per course correction 2026-01-22. It follows the TV-style EPG design from `ux-epg-tv-guide.md`.

**CRITICAL - This is a foundation story:**
- Creates layout structure and placeholder components
- Full functionality (data loading, interactions) comes in Stories 5.5-5.8
- Focus on CSS layout, visual styling, and component structure
- Do NOT integrate with Tauri commands or EPG data

### References

- [Source: _bmad-output/planning-artifacts/ux-epg-tv-guide.md - Complete UX specification]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.4-EPG-TV-Style-Layout-Foundation]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-Architecture]
- [Source: _bmad-output/implementation-artifacts/5-4-epg-tv-style-layout-foundation.md - Story details]
- [Source: tests/e2e/epg-tv-layout.spec.ts - Test implementation]

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Tag @tea-agent in Slack/Discord
- Refer to `_bmad/bmm/docs/tea-README.md` for workflow documentation
- Consult `_bmad/bmm/testarch/knowledge/` for testing best practices

---

**Generated by BMad TEA Agent** - 2026-01-22
