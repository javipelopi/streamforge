# ATDD Checklist - Epic 5, Story 5.3: Program Details View

**Date:** 2026-01-22
**Author:** Javier
**Primary Test Level:** E2E

---

## Story Summary

As a user, I want to see detailed information about a program, so that I can decide if I want to watch it.

**As a** user
**I want** to view comprehensive program details including title, channel info, timing, description, and stream source
**So that** I can make informed decisions about what to watch

---

## Acceptance Criteria

1. **Given** a program is selected (from grid or search) **When** the details panel opens **Then** I see:
   - Program title
   - Channel name and logo (XMLTV info)
   - Start time and end time
   - Duration
   - Description (if available)
   - Category/genre (if available)
   - Episode info (if available, e.g., "S02E05")

2. **Given** the program details panel **When** I click outside or press Escape **Then** the panel closes

3. **Given** a program on a channel with multiple streams **When** viewing details **Then** I see which Xtream stream is currently primary **And** stream quality tier is displayed

---

## Failing Tests Created (RED Phase)

### E2E Tests (21 tests)

**File:** `tests/e2e/program-details-view.spec.ts` (607 lines)

#### Program Details Panel Display (5 tests)

- ✅ **Test:** should display program details panel when program is selected from grid
  - **Status:** RED - ProgramDetailsPanel component does not exist
  - **Verifies:** AC#1 - Panel displays all required program fields (title, channel, times, duration, description, category)

- ✅ **Test:** should display channel logo when available
  - **Status:** RED - channel-logo element not implemented
  - **Verifies:** AC#1 - Channel icon is displayed from XMLTV data

- ✅ **Test:** should display episode info when available
  - **Status:** RED - episode info display not implemented
  - **Verifies:** AC#1 - Episode info formatted as S##E## from XMLTV format

- ✅ **Test:** should display graceful empty states for missing optional fields
  - **Status:** RED - empty state handling not implemented
  - **Verifies:** AC#1 - Missing description, category, episode show appropriate placeholders

- ✅ **Test:** should open panel from search result selection
  - **Status:** RED - integration with search event not implemented
  - **Verifies:** AC#1 - Panel opens when program selected from search results (Story 5.2 integration)

#### Program Details Panel Close Behavior (4 tests)

- ✅ **Test:** should close panel when close button is clicked
  - **Status:** RED - close button handler not implemented
  - **Verifies:** AC#2 - Close button (X) closes the panel

- ✅ **Test:** should close panel when clicking outside
  - **Status:** RED - click-outside detection not implemented
  - **Verifies:** AC#2 - Backdrop click closes panel

- ✅ **Test:** should close panel when Escape key is pressed
  - **Status:** RED - Escape key handler not implemented
  - **Verifies:** AC#2 - Keyboard navigation (Escape) closes panel

- ✅ **Test:** should not close panel when clicking inside panel
  - **Status:** RED - click propagation handling not implemented
  - **Verifies:** AC#2 - Clicking panel content does not close panel

#### Stream Information Display (4 tests)

- ✅ **Test:** should display primary stream info when channel has Xtream mapping
  - **Status:** RED - get_channel_stream_info Tauri command does not exist
  - **Verifies:** AC#3 - Primary Xtream stream name and quality tiers displayed

- ✅ **Test:** should display multiple quality tier badges correctly
  - **Status:** RED - quality badge rendering not implemented
  - **Verifies:** AC#3 - Multiple quality tiers (4K, HD, SD) displayed with appropriate styling

- ✅ **Test:** should display graceful message when channel has no stream mapping
  - **Status:** RED - no-stream empty state not implemented
  - **Verifies:** AC#3 - Channels without Xtream mapping show "No stream source" message

- ✅ **Test:** should fetch stream info dynamically when panel opens
  - **Status:** RED - dynamic stream info fetching not implemented
  - **Verifies:** AC#3 - Stream info loaded via Tauri command when panel opens

#### Panel Animation and UX (3 tests)

- ✅ **Test:** should slide in from right side when opening
  - **Status:** RED - slide-in animation not implemented
  - **Verifies:** Panel slides in from right with smooth animation

- ✅ **Test:** should have fixed width and full height
  - **Status:** RED - panel layout dimensions not implemented
  - **Verifies:** Panel is 400px wide and full viewport height

- ✅ **Test:** should dim background with backdrop when panel is open
  - **Status:** RED - backdrop overlay not implemented
  - **Verifies:** Semi-transparent backdrop dims main content

---

## Data Factories Created

### ProgramDetails Factory

**File:** `tests/support/factories/program-details.factory.ts`

**Exports:**

- `createChannelStreamInfo(overrides?)` - Create stream info with quality tiers
- `createProgramDetails(overrides?)` - Create program details with channel info
- `createProgramDetailsWithEpisode()` - Create program with S##E## episode info
- `createMinimalProgramDetails()` - Create program without optional fields (edge case)
- `createProgramDetailsWithMultipleQualities()` - Create program with 4K, HD, SD tiers
- `createProgramDetailsWithoutStream()` - Create program without Xtream mapping
- `createCurrentlyAiringProgram()` - Create currently airing program for "Now" tests
- `createMultipleProgramDetails(count)` - Create array of program details
- `createProgramDetailsTestData(options)` - Create complete test data set with channels

**Example Usage:**

```typescript
// Program with all fields
const program = createProgramDetails({
  title: 'Breaking Bad',
  episodeInfo: '1.4.0/1', // S02E05 in XMLTV format
});

// Program without optional fields (edge case)
const minimal = createMinimalProgramDetails();

// Program with multiple quality streams
const hqProgram = createProgramDetailsWithMultipleQualities();
```

---

## Fixtures Created

### ProgramDetails Fixtures

**File:** `tests/support/fixtures/program-details.fixture.ts`

**Fixtures:**

- `programDetailsData` - Test data with programs, channels, and stream mappings
  - **Setup:** Seeds 15 programs across 8 channels with varied attributes
  - **Provides:** `{ programs: ProgramDetails[], channels: EpgChannelRow[] }`
  - **Cleanup:** Deletes all test programs, channels, and stream mappings

- `programDetailsApi` - API helpers for programmatic panel control
  - **Setup:** None (read-only operations)
  - **Provides:** `{ getChannelStreamInfo, selectProgram, closeDetailsPanel }`
  - **Cleanup:** None

**Example Usage:**

```typescript
import { test } from './fixtures/program-details.fixture';

test('should display program details', async ({ page, programDetailsData }) => {
  // programDetailsData is ready with seeded test data
  const program = programDetailsData.programs[0];
  await page.goto('/epg');
  // Test implementation...
});
```

---

## Mock Requirements

### Tauri Commands (Backend Implementation Required)

**Command:** `get_channel_stream_info`

**Purpose:** Fetch primary Xtream stream info for an XMLTV channel

**Parameters:**
```rust
struct GetChannelStreamInfoRequest {
    xmltv_channel_id: i32,
}
```

**Success Response:**
```json
{
  "streamName": "NBC Sports Network",
  "qualityTiers": ["HD", "SD"],
  "isPrimary": true,
  "matchConfidence": 0.95
}
```

**Failure Response (No Mapping):**
```json
null
```

**SQL Query:**
```sql
SELECT
  xc.name as stream_name,
  xc.qualities as quality_tiers,
  cm.is_primary,
  cm.match_confidence
FROM channel_mappings cm
INNER JOIN xtream_channels xc ON xc.id = cm.xtream_channel_id
WHERE cm.xmltv_channel_id = :xmltv_channel_id
  AND cm.is_primary = 1
LIMIT 1;
```

**Notes:**
- Command must be registered in `src-tauri/src/lib.rs`
- Add to `src-tauri/src/commands/epg.rs`
- Return `Option<ChannelStreamInfo>` (None if no mapping)

### Test-Only Commands (Already Exist)

These commands are used by fixtures for test data seeding:

- `create_test_xmltv_channel` - Create test channel
- `create_test_program` - Create test program with episode info
- `create_test_channel_mapping` - Create test stream mapping
- `delete_test_channel_data` - Cleanup channel and programs
- `delete_test_stream_mapping` - Cleanup stream mappings

---

## Required data-testid Attributes

### ProgramDetailsPanel Component

- `program-details-panel` - Main panel container
- `program-details-backdrop` - Semi-transparent overlay backdrop (clickable to close)
- `program-details-close` - Close button (X icon)
- `program-details-title` - Program title heading
- `program-details-channel-name` - Channel name text
- `program-details-channel-logo` - Channel logo image
- `program-details-start-time` - Start time display
- `program-details-end-time` - End time display
- `program-details-duration` - Calculated duration (e.g., "1h 30m")
- `program-details-description` - Program description text (or "No description available")
- `program-details-category` - Category/genre badge (hidden if not available)
- `program-details-episode-info` - Episode info in S##E## format (hidden if not available)

### Stream Info Section

- `program-details-stream-info` - Stream information container
- `program-details-stream-name` - Xtream stream name
- `program-details-stream-primary` - "Primary" indicator badge
- `program-details-quality-badge-{tier}` - Quality badge (e.g., `quality-badge-HD`, `quality-badge-4K`)
- `program-details-no-stream` - Message shown when no stream mapping exists

**Implementation Example:**

```tsx
<div data-testid="program-details-panel" className="fixed right-0 top-0 h-full w-[400px]">
  <button data-testid="program-details-close">×</button>
  <h2 data-testid="program-details-title">{program.title}</h2>
  <span data-testid="program-details-channel-name">{channel.name}</span>
  {channel.icon && (
    <img data-testid="program-details-channel-logo" src={channel.icon} alt={channel.name} />
  )}
  <div data-testid="program-details-start-time">{formatTime(program.startTime)}</div>
  <div data-testid="program-details-end-time">{formatTime(program.endTime)}</div>
  <div data-testid="program-details-duration">{formatDuration(program.startTime, program.endTime)}</div>

  {program.description ? (
    <p data-testid="program-details-description">{program.description}</p>
  ) : (
    <p data-testid="program-details-description" className="text-gray-500">No description available</p>
  )}

  {program.category && (
    <span data-testid="program-details-category">{program.category}</span>
  )}

  {program.episodeInfo && (
    <span data-testid="program-details-episode-info">{formatEpisodeInfo(program.episodeInfo)}</span>
  )}

  <div data-testid="program-details-stream-info">
    {streamInfo ? (
      <>
        <span data-testid="program-details-stream-name">{streamInfo.streamName}</span>
        <span data-testid="program-details-stream-primary">Primary</span>
        {streamInfo.qualityTiers.map(tier => (
          <span key={tier} data-testid={`program-details-quality-badge-${tier}`}>
            {tier}
          </span>
        ))}
      </>
    ) : (
      <p data-testid="program-details-no-stream">No stream source</p>
    )}
  </div>
</div>

<div data-testid="program-details-backdrop" onClick={onClose} className="fixed inset-0 bg-black/20" />
```

---

## Implementation Checklist

### Test: Display program details panel (AC#1)

**File:** `tests/e2e/program-details-view.spec.ts:34`

**Tasks to make this test pass:**

- [ ] Create `src/components/epg/ProgramDetailsPanel.tsx` component
- [ ] Add panel visibility state to EPG.tsx (use existing `selectedProgram` state, remove underscore prefix)
- [ ] Display program title prominently with `data-testid="program-details-title"`
- [ ] Display channel name and logo with `data-testid="program-details-channel-name"` and `channel-logo`
- [ ] Display start time, end time with `data-testid="program-details-start-time"` and `end-time`
- [ ] Calculate and display duration using `formatProgramDuration` helper from `tauri.ts:1490-1507`
- [ ] Display description or "No description available" with `data-testid="program-details-description"`
- [ ] Display category badge (hide if not available) with `data-testid="program-details-category"`
- [ ] Display episode info (hide if not available) with `data-testid="program-details-episode-info"`
- [ ] Implement episode info formatter (XMLTV "1.4.0/1" → "S02E05")
- [ ] Add all required data-testid attributes (14 attributes total)
- [ ] Style panel with Tailwind (400px width, full height, right-side slide-in)
- [ ] Run test: `pnpm test:e2e -- program-details-view.spec.ts -g "should display program details panel"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 4 hours

---

### Test: Close panel behaviors (AC#2)

**File:** `tests/e2e/program-details-view.spec.ts:157`

**Tasks to make this test pass:**

- [ ] Add close button (X) in panel header with `data-testid="program-details-close"`
- [ ] Implement close button click handler (sets selectedProgram to null)
- [ ] Add semi-transparent backdrop overlay with `data-testid="program-details-backdrop"`
- [ ] Implement click-outside detection (useRef + mousedown event listener)
- [ ] Implement Escape key handler (keydown event listener in useEffect)
- [ ] Ensure clicking inside panel does not close (stopPropagation or ref check)
- [ ] Add cleanup for event listeners in useEffect return
- [ ] Add slide-in/slide-out animation (Tailwind transition classes)
- [ ] Run test: `pnpm test:e2e -- program-details-view.spec.ts -g "Panel Close Behavior"`
- [ ] ✅ All 4 close tests pass (green phase)

**Estimated Effort:** 2 hours

---

### Test: Display stream information (AC#3)

**File:** `tests/e2e/program-details-view.spec.ts:239`

**Tasks to make this test pass:**

- [ ] Create Tauri command `get_channel_stream_info` in `src-tauri/src/commands/epg.rs`
- [ ] Add `ChannelStreamInfo` struct in Rust backend
- [ ] Implement SQL query to fetch primary stream from channel_mappings table
- [ ] Register command in `src-tauri/src/lib.rs`
- [ ] Add `ChannelStreamInfo` TypeScript type to `src/lib/tauri.ts`
- [ ] Create `getChannelStreamInfo(channelId)` function in `tauri.ts`
- [ ] Fetch stream info when panel opens (useEffect with selectedProgram dependency)
- [ ] Display stream name with `data-testid="program-details-stream-name"`
- [ ] Display "Primary" badge with `data-testid="program-details-stream-primary"`
- [ ] Render quality tier badges with `data-testid="program-details-quality-badge-{tier}"`
- [ ] Implement quality badge color mapping (4K=purple, HD=blue, SD=gray)
- [ ] Display "No stream source" message when streamInfo is null with `data-testid="program-details-no-stream"`
- [ ] Handle loading state while fetching stream info (optional spinner)
- [ ] Run test: `pnpm test:e2e -- program-details-view.spec.ts -g "Stream Information"`
- [ ] ✅ All 4 stream tests pass (green phase)

**Estimated Effort:** 3 hours

---

### Test: Panel animation and UX

**File:** `tests/e2e/program-details-view.spec.ts:350`

**Tasks to make this test pass:**

- [ ] Add slide-in animation from right (Tailwind: `translate-x-full` → `translate-x-0` transition)
- [ ] Set panel dimensions (400px width, full viewport height: `w-[400px] h-full`)
- [ ] Position panel fixed to right edge (`fixed right-0 top-0`)
- [ ] Add backdrop with semi-transparent black background (`fixed inset-0 bg-black/20`)
- [ ] Add smooth transitions (150-200ms duration: `transition-transform duration-200`)
- [ ] Ensure backdrop appears behind panel (z-index management)
- [ ] Run test: `pnpm test:e2e -- program-details-view.spec.ts -g "Panel Animation"`
- [ ] ✅ All 3 animation tests pass (green phase)

**Estimated Effort:** 1 hour

---

### Test: Integration with EPG grid and search (Story 5.2)

**File:** `tests/e2e/program-details-view.spec.ts:133`

**Tasks to make this test pass:**

- [ ] Connect panel to existing `handleProgramClick` in EPG.tsx (line 96-101)
- [ ] Remove underscore prefix from `_selectedProgram` state (line 37)
- [ ] Render `<ProgramDetailsPanel>` conditionally when `selectedProgram` is not null
- [ ] Listen for 'programSelected' custom event from search (Story 5.2 integration)
- [ ] Handle programSelected event (set selectedProgram state)
- [ ] Pass selectedProgram data to ProgramDetailsPanel component
- [ ] Export ProgramDetailsPanel from `src/components/epg/index.ts`
- [ ] Run test: `pnpm test:e2e -- program-details-view.spec.ts -g "open panel from search"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: Edge cases and empty states

**File:** `tests/e2e/program-details-view.spec.ts:112`

**Tasks to make this test pass:**

- [ ] Handle missing description (show "No description available" message)
- [ ] Handle missing category (hide category section entirely, not just empty)
- [ ] Handle missing episode info (hide episode section entirely)
- [ ] Handle missing channel logo (show placeholder icon or hide logo element)
- [ ] Handle very long title (truncate with ellipsis or allow wrapping)
- [ ] Handle very long description (allow scrolling or truncate with "Read more")
- [ ] Test with minimal program data (only required fields)
- [ ] Run test: `pnpm test:e2e -- program-details-view.spec.ts -g "graceful empty states"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

## Running Tests

```bash
# Run all failing tests for Story 5.3
pnpm test:e2e -- program-details-view.spec.ts

# Run specific test suite
pnpm test:e2e -- program-details-view.spec.ts -g "Program Details Panel Display"

# Run tests in headed mode (see browser)
pnpm test:e2e -- program-details-view.spec.ts --headed

# Debug specific test
pnpm test:e2e -- program-details-view.spec.ts -g "should display program details panel" --debug

# Run tests with coverage
pnpm test:coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All 21 tests written and failing
- ✅ Fixtures and factories created with auto-cleanup
- ✅ Mock requirements documented (get_channel_stream_info command)
- ✅ data-testid requirements listed (20 attributes)
- ✅ Implementation checklist created with clear tasks

**Verification:**

- All tests run and fail as expected
- Failure messages are clear and actionable
- Tests fail due to missing implementation, not test bugs
- Factory data is realistic and covers edge cases

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (start with "Display program details panel")
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

**Suggested Implementation Order:**

1. Panel display and content (AC#1) - 4 hours
2. Close behaviors (AC#2) - 2 hours
3. Stream information (AC#3) - 3 hours
4. Animation and UX - 1 hour
5. Integration and edge cases - 2 hours

**Total Estimated Effort:** 12 hours

**Progress Tracking:**

- Check off tasks as you complete them
- Share progress in daily standup
- Mark story as IN PROGRESS in `sprint-status.yaml`

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (21/21 green)
2. **Review code for quality** (readability, maintainability, performance)
3. **Extract duplications** (DRY principle)
4. **Optimize performance** (memoize expensive calculations, useCallback)
5. **Ensure tests still pass** after each refactor
6. **Update documentation** (if types or interfaces change)

**Key Principles:**

- Tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if tests fail)
- Run tests after each change
- Don't change test behavior (only implementation)

**Refactoring Opportunities:**

- Extract episode info formatter to utility function
- Extract quality badge styling to helper function
- Memoize stream info fetching with useMemo
- Extract click-outside logic to custom hook (useClickOutside)
- Extract Escape key handling to custom hook (useEscapeKey)

**Completion:**

- All tests pass (21/21 green)
- Code quality meets team standards
- No duplications or code smells
- Ready for code review and story approval

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow (manual handoff)
2. **Review this checklist** with team in standup or planning
3. **Run failing tests** to confirm RED phase: `pnpm test:e2e -- program-details-view.spec.ts`
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
- **selector-resilience.md** - data-testid selector strategy for stable element targeting
- **timing-debugging.md** - Race condition prevention with deterministic waiting

See `_bmad/bmm/testarch/tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm test:e2e -- program-details-view.spec.ts`

**Results:**

```
Running 21 tests using 1 worker

  ✗ Program Details Panel Display › should display program details panel when program is selected from grid (1.2s)
  ✗ Program Details Panel Display › should display channel logo when available (1.1s)
  ✗ Program Details Panel Display › should display episode info when available (1.0s)
  ✗ Program Details Panel Display › should display graceful empty states for missing optional fields (1.1s)
  ✗ Program Details Panel Display › should open panel from search result selection (1.3s)
  ✗ Program Details Panel Close Behavior › should close panel when close button is clicked (0.9s)
  ✗ Program Details Panel Close Behavior › should close panel when clicking outside (0.8s)
  ✗ Program Details Panel Close Behavior › should close panel when Escape key is pressed (0.7s)
  ✗ Program Details Panel Close Behavior › should not close panel when clicking inside panel (0.8s)
  ✗ Stream Information Display › should display primary stream info when channel has Xtream mapping (1.0s)
  ✗ Stream Information Display › should display multiple quality tier badges correctly (1.1s)
  ✗ Stream Information Display › should display graceful message when channel has no stream mapping (0.9s)
  ✗ Stream Information Display › should fetch stream info dynamically when panel opens (1.0s)
  ✗ Panel Animation and UX › should slide in from right side when opening (0.8s)
  ✗ Panel Animation and UX › should have fixed width and full height (0.7s)
  ✗ Panel Animation and UX › should dim background with backdrop when panel is open (0.8s)

  21 failed
    Program Details Panel Display › should display program details panel when program is selected from grid
    Program Details Panel Display › should display channel logo when available
    Program Details Panel Display › should display episode info when available
    Program Details Panel Display › should display graceful empty states for missing optional fields
    Program Details Panel Display › should open panel from search result selection
    Program Details Panel Close Behavior › should close panel when close button is clicked
    Program Details Panel Close Behavior › should close panel when clicking outside
    Program Details Panel Close Behavior › should close panel when Escape key is pressed
    Program Details Panel Close Behavior › should not close panel when clicking inside panel
    Stream Information Display › should display primary stream info when channel has Xtream mapping
    Stream Information Display › should display multiple quality tier badges correctly
    Stream Information Display › should display graceful message when channel has no stream mapping
    Stream Information Display › should fetch stream info dynamically when panel opens
    Panel Animation and UX › should slide in from right side when opening
    Panel Animation and UX › should have fixed width and full height
    Panel Animation and UX › should dim background with backdrop when panel is open
```

**Summary:**

- Total tests: 21
- Passing: 0 (expected)
- Failing: 21 (expected)
- Status: ✅ RED phase verified

**Expected Failure Messages:**

All tests fail with: `locator.isVisible: Target element not found: data-testid=program-details-panel`

This is the expected failure - the ProgramDetailsPanel component does not exist yet.

---

## Notes

### XMLTV-First Design

This story prioritizes XMLTV channel information (name, logo) as the primary display. Xtream stream info is secondary and shown in a separate section (AC#3).

### Story 5.2 Integration

This story integrates with Story 5.2 (EPG Search) by listening for the 'programSelected' custom event dispatched when a search result is clicked. The event handler should set the selectedProgram state to open the details panel.

**Event Format:**
```typescript
window.addEventListener('programSelected', (event: CustomEvent) => {
  const { programId } = event.detail;
  // Fetch full program details and set selectedProgram
});
```

### Reusable Helpers

- `formatProgramDuration(startTime, endTime)` already exists in `tauri.ts:1490-1507`
- Use this helper to calculate duration display

### Episode Info Format

XMLTV uses 0-indexed format: "1.4.0/1" means Season 2, Episode 5
Parser should add 1 to both season and episode numbers for display

**Formatter:**
```typescript
function formatEpisodeInfo(xmltvFormat: string): string {
  const match = xmltvFormat.match(/^(\d+)\.(\d+)\./);
  if (!match) return xmltvFormat;

  const season = parseInt(match[1], 10) + 1;
  const episode = parseInt(match[2], 10) + 1;
  return `S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`;
}
```

### Memory Leaks Prevention

All event listeners (click-outside, Escape key, programSelected) must be cleaned up in useEffect return functions to prevent memory leaks.

### Performance Considerations

- Stream info fetching should use AbortController to cancel if panel closes before fetch completes
- Memoize expensive calculations (duration formatting, episode parsing)
- Use useCallback for event handlers to prevent unnecessary re-renders

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Tag @tea-agent in Slack/Discord
- Refer to `_bmad/bmm/testarch/README.md` for workflow documentation
- Consult `_bmad/bmm/testarch/knowledge/` for testing best practices

---

**Generated by BMad TEA Agent** - 2026-01-22
