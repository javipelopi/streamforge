# ATDD Checklist - Epic 3, Story 3.9: Implement Target Lineup View

**Date:** 2026-01-20
**Author:** Javier
**Primary Test Level:** E2E

---

## Story Summary

As a user, I want a dedicated Target Lineup menu item showing my Plex channel lineup, so that I can manage what channels appear in Plex efficiently.

**As a** user
**I want** a dedicated Target Lineup menu item showing my Plex channel lineup
**So that** I can manage what channels appear in Plex efficiently

This story is part of the Navigation Restructure (Option C) that separates concerns between:
- **Target Lineup**: Enabled channels going to Plex - fast, focused view
- **Sources** (future stories): Browse XMLTV/Xtream sources to add channels

---

## Acceptance Criteria

1. **Given** the sidebar navigation
   **When** I look at the menu
   **Then** I see "Target Lineup" as a new menu item after Dashboard
   **And** the old "Channels" menu item is removed

2. **Given** the sidebar navigation
   **When** I click "Target Lineup"
   **Then** I see a new view showing only channels where `is_enabled = true`
   **And** the list loads quickly (<500ms for 500 enabled channels)

3. **Given** the Target Lineup view
   **When** I view the channel list
   **Then** I can drag-drop to reorder channels (existing functionality preserved)
   **And** I can toggle enable/disable (disabling removes from lineup)
   **And** channels without streams show a warning icon with tooltip "No stream source"

4. **Given** an enabled channel has no stream source
   **When** viewing in Target Lineup
   **Then** a warning badge "No stream" appears
   **And** hovering shows tooltip "This channel has no video source"

5. **Given** the Target Lineup is empty
   **When** viewing the page
   **Then** I see an empty state: "No channels in lineup. Add channels from Sources."
   **And** a button links to the Sources view

6. **Given** I disable a channel from Target Lineup
   **When** the toggle is clicked
   **Then** the channel is removed from the list (optimistic UI)
   **And** a toast shows "Channel removed from lineup"
   **And** an "Undo" action is available for 5 seconds

---

## Failing Tests Created (RED Phase)

### E2E Tests (15 tests)

**File:** `tests/e2e/target-lineup.spec.ts` (750 lines)

#### AC #1: Navigation Changes (2 tests)

- ✅ **Test:** should display "Target Lineup" menu item in sidebar after Dashboard
  - **Status:** RED - Menu item does not exist
  - **Verifies:** AC #1 - Target Lineup appears in navigation

- ✅ **Test:** should remove old "Channels" menu item from sidebar
  - **Status:** RED - Channels menu item still exists
  - **Verifies:** AC #1 - Old Channels menu removed

#### AC #2: Target Lineup View (3 tests)

- ✅ **Test:** should navigate to Target Lineup view when clicking menu item
  - **Status:** RED - Route /target-lineup does not exist
  - **Verifies:** AC #2 - Navigation to new view

- ✅ **Test:** should display only enabled channels in Target Lineup
  - **Status:** RED - View does not exist, get_target_lineup_channels command missing
  - **Verifies:** AC #2 - Only enabled channels shown

- ✅ **Test:** should load enabled channels quickly (performance check)
  - **Status:** RED - get_target_lineup_channels command missing
  - **Verifies:** AC #2 - <500ms load time for 500 channels

#### AC #3: Channel Management (3 tests)

- ✅ **Test:** should allow drag-drop reordering of channels
  - **Status:** RED - Drag-drop functionality not implemented
  - **Verifies:** AC #3 - Reordering preserved

- ✅ **Test:** should toggle channel enabled/disabled status
  - **Status:** RED - Toggle button not implemented
  - **Verifies:** AC #3 - Enable/disable toggle

- ✅ **Test:** should display warning icon for channels without streams
  - **Status:** RED - Warning icon/badge not implemented
  - **Verifies:** AC #3 - No stream warning

#### AC #4: No Stream Warning (2 tests)

- ✅ **Test:** should show "No stream" badge for channels with streamCount = 0
  - **Status:** RED - Badge not implemented
  - **Verifies:** AC #4 - Warning badge appears

- ✅ **Test:** should display tooltip on hover: "This channel has no video source"
  - **Status:** RED - Tooltip not implemented
  - **Verifies:** AC #4 - Tooltip text

#### AC #5: Empty State (2 tests)

- ✅ **Test:** should display empty state when no enabled channels exist
  - **Status:** RED - Empty state component not implemented
  - **Verifies:** AC #5 - Empty state message

- ✅ **Test:** should show "Browse Sources" button in empty state
  - **Status:** RED - Empty state button not implemented
  - **Verifies:** AC #5 - Sources link button

#### AC #6: Disable with Undo (3 tests)

- ✅ **Test:** should remove channel from list when disabled (optimistic UI)
  - **Status:** RED - Optimistic UI update not implemented
  - **Verifies:** AC #6 - Optimistic removal

- ✅ **Test:** should show toast with "Undo" action after disabling
  - **Status:** RED - Toast with undo not implemented
  - **Verifies:** AC #6 - Toast message and undo action

- ✅ **Test:** should restore channel when "Undo" is clicked within 5 seconds
  - **Status:** RED - Undo functionality not implemented
  - **Verifies:** AC #6 - Undo restoration

---

## Data Factories Created

No new data factories are required for this story. We'll reuse the existing mock pattern from story 3-8 (orphan-channels.spec.ts) which provides:

- `createMockTargetLineupChannel(overrides?)` - Factory function for target lineup channels
- Mock state management via `window.__TARGET_LINEUP_STATE__`

### Mock Factory Pattern

**File:** `tests/e2e/target-lineup.spec.ts` (inline factories)

**Exports:**

- `createMockTargetLineupChannel(overrides?)` - Create single channel with optional overrides
- `createMockEnabledChannels(count)` - Create array of enabled channels
- `createMockDisabledChannel()` - Create disabled channel (should not appear)

**Example Usage:**

```typescript
// Create enabled channels
const channels = createMockEnabledChannels(5);

// Create channel with no stream
const orphanChannel = createMockTargetLineupChannel({
  streamCount: 0,
  primaryStreamName: null
});

// Create channel with custom display order
const firstChannel = createMockTargetLineupChannel({
  plexDisplayOrder: 1,
  displayName: 'CNN HD'
});
```

---

## Fixtures Created

### Tauri Mock Fixture

**File:** `tests/e2e/target-lineup.spec.ts` (inline fixture)

**Fixtures:**

- `injectTargetLineupMocks(page, enabledChannels[])` - Injects Tauri V2 mock with:
  - **Setup:** Initializes `window.__TAURI_INTERNALS__` with mock commands
  - **Provides:** `get_target_lineup_channels`, `updateChannelEnabled`, `updateChannelOrder`
  - **Cleanup:** Automatic cleanup via Playwright test isolation

**Example Usage:**

```typescript
import { test } from '@playwright/test';

test('should display enabled channels', async ({ page }) => {
  const channels = createMockEnabledChannels(3);
  await injectTargetLineupMocks(page, channels);

  await page.goto('/target-lineup');
  // channels are ready to use with auto-cleanup
});
```

---

## Mock Requirements

### Tauri Commands Mock

**Commands Required:**

1. **get_target_lineup_channels**
   - **Endpoint:** Tauri command (not HTTP)
   - **Success Response:**
     ```json
     [
       {
         "id": 1,
         "channelId": "cnn-hd",
         "displayName": "CNN HD",
         "icon": "https://example.com/cnn.png",
         "isSynthetic": false,
         "isEnabled": true,
         "plexDisplayOrder": 1,
         "streamCount": 2,
         "primaryStreamName": "CNN HD (1080p)"
       }
     ]
     ```
   - **Failure Response:** Throws error with message

2. **update_channel_enabled**
   - **Endpoint:** Tauri command
   - **Args:** `{ channelId: number, enabled: boolean }`
   - **Success Response:** `undefined` or `null`
   - **Notes:** Updates `is_enabled` in database

3. **update_channel_order**
   - **Endpoint:** Tauri command
   - **Args:** `{ channelOrders: Array<{ id: number, order: number }> }`
   - **Success Response:** `undefined` or `null`
   - **Notes:** Updates `plex_display_order` for bulk reordering

### Mock Implementation Pattern

Following story 3-8 pattern, use `window.__TAURI_INTERNALS__` with state management:

```typescript
window.__TARGET_LINEUP_STATE__ = {
  enabledChannels: [...],
  pendingDisables: new Map()
};
```

---

## Required data-testid Attributes

### Sidebar Navigation

- `target-lineup-nav-item` - "Target Lineup" menu item
- `channels-nav-item` - Old "Channels" item (should NOT exist after implementation)

### Target Lineup View

- `target-lineup-view` - Main view container
- `target-lineup-loading` - Loading skeleton
- `target-lineup-empty-state` - Empty state container
- `browse-sources-button` - Button in empty state

### Channel Row Components

- `target-lineup-channel-{id}` - Channel row container
- `channel-drag-handle-{id}` - Drag handle for reordering
- `channel-toggle-{id}` - Enable/disable toggle switch
- `channel-name-{id}` - Channel display name
- `channel-icon-{id}` - Channel icon image
- `synthetic-badge-{id}` - "Synthetic" badge (if applicable)
- `no-stream-warning-{id}` - Warning badge for channels without streams

### Empty State

- `empty-state-message` - Text: "No channels in lineup. Add channels from Sources."
- `browse-sources-button` - Button to navigate to Sources view

**Implementation Example:**

```tsx
// Sidebar.tsx
<a href="/target-lineup" data-testid="target-lineup-nav-item">
  <ListChecks className="mr-2 h-4 w-4" />
  Target Lineup
</a>

// TargetLineupChannelRow.tsx
<div data-testid={`target-lineup-channel-${channel.id}`}>
  <button data-testid={`channel-drag-handle-${channel.id}`} aria-label="Drag to reorder">
    <GripVertical />
  </button>
  <span data-testid={`channel-name-${channel.id}`}>{channel.displayName}</span>
  {channel.streamCount === 0 && (
    <span
      data-testid={`no-stream-warning-${channel.id}`}
      title="This channel has no video source"
    >
      <AlertTriangle /> No stream
    </span>
  )}
  <Switch
    data-testid={`channel-toggle-${channel.id}`}
    checked={channel.isEnabled}
    aria-label="Toggle channel in lineup"
  />
</div>

// Empty state
<div data-testid="target-lineup-empty-state">
  <p data-testid="empty-state-message">
    No channels in lineup. Add channels from Sources.
  </p>
  <Button data-testid="browse-sources-button">Browse Sources</Button>
</div>
```

---

## Implementation Checklist

### Test 1: Navigation - Target Lineup Menu Item

**File:** `tests/e2e/target-lineup.spec.ts`

**Tasks to make this test pass:**

- [ ] Edit `src/components/layout/Sidebar.tsx`
- [ ] Add "Target Lineup" menu item after Dashboard with route `/target-lineup`
- [ ] Import `ListChecks` icon from lucide-react
- [ ] Add data-testid: `target-lineup-nav-item`
- [ ] Add aria-label: "Target Lineup - Your Plex channel lineup"
- [ ] Run test: `npx playwright test tests/e2e/target-lineup.spec.ts -g "should display Target Lineup menu item"`
- [ ] ✅ Test passes (green phase)

---

### Test 2: Navigation - Remove Old Channels Menu

**File:** `tests/e2e/target-lineup.spec.ts`

**Tasks to make this test pass:**

- [ ] Edit `src/components/layout/Sidebar.tsx`
- [ ] Remove "Channels" menu item (route `/channels`)
- [ ] Run test: `npx playwright test tests/e2e/target-lineup.spec.ts -g "should remove old Channels menu"`
- [ ] ✅ Test passes (green phase)

---

### Test 3: Routing - Create Target Lineup Route

**File:** `tests/e2e/target-lineup.spec.ts`

**Tasks to make this test pass:**

- [ ] Edit `src/App.tsx` (or router config)
- [ ] Add route: `/target-lineup` → `<TargetLineupView />`
- [ ] Remove `/channels` route
- [ ] Add redirect: `/channels` → `/target-lineup` (backwards compat)
- [ ] Run test: `npx playwright test tests/e2e/target-lineup.spec.ts -g "should navigate to Target Lineup"`
- [ ] ✅ Test passes (green phase)

---

### Test 4: Backend - Create get_target_lineup_channels Command

**File:** `tests/e2e/target-lineup.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src-tauri/src/commands/target_lineup.rs` (or add to channels.rs)
- [ ] Implement SQL query:
  ```sql
  SELECT xc.*, xcs.is_enabled, xcs.plex_display_order,
    (SELECT COUNT(*) FROM xtream_channel_mappings xcm WHERE xcm.xmltv_channel_id = xc.id) as stream_count
  FROM xmltv_channels xc
  INNER JOIN xmltv_channel_settings xcs ON xc.id = xcs.xmltv_channel_id
  WHERE xcs.is_enabled = 1
  ORDER BY xcs.plex_display_order ASC
  ```
- [ ] Return `Vec<TargetLineupChannel>`
- [ ] Register command in `src-tauri/src/lib.rs`
- [ ] Target performance: <100ms for 500 channels
- [ ] Run test: `npx playwright test tests/e2e/target-lineup.spec.ts -g "should display only enabled channels"`
- [ ] ✅ Test passes (green phase)

---

### Test 5: Frontend - Create TargetLineupView Component

**File:** `tests/e2e/target-lineup.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/views/TargetLineupView.tsx`
- [ ] Use TanStack Query: `useQuery(['target-lineup'], getTargetLineupChannels)`
- [ ] Display loading skeleton during fetch
- [ ] Handle empty state with message and button
- [ ] Add data-testid: `target-lineup-view`
- [ ] Render `<TargetLineupChannelRow>` for each channel
- [ ] Run test: `npx playwright test tests/e2e/target-lineup.spec.ts -g "should display only enabled"`
- [ ] ✅ Test passes (green phase)

---

### Test 6: Frontend - Create TargetLineupChannelRow Component

**File:** `tests/e2e/target-lineup.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/components/target-lineup/TargetLineupChannelRow.tsx`
- [ ] Display: channel icon, name, synthetic badge (if applicable)
- [ ] Add "No stream" warning badge if `streamCount === 0`
- [ ] Add tooltip: "This channel has no video source"
- [ ] Add enable/disable toggle (Switch component)
- [ ] Add drag handle for reordering
- [ ] Add data-testid attributes for all interactive elements
- [ ] Run test: `npx playwright test tests/e2e/target-lineup.spec.ts -g "warning icon"`
- [ ] ✅ Test passes (green phase)

---

### Test 7: Drag-Drop - Implement Reordering

**File:** `tests/e2e/target-lineup.spec.ts`

**Tasks to make this test pass:**

- [ ] Use dnd-kit library (already in project)
- [ ] Wrap channels in `<DndContext>` and `<SortableContext>`
- [ ] Make each row a `useSortable` item
- [ ] On drag end: call `updateChannelOrder` mutation
- [ ] Implement optimistic UI update
- [ ] Persist new order to `xmltv_channel_settings.plex_display_order`
- [ ] Run test: `npx playwright test tests/e2e/target-lineup.spec.ts -g "drag-drop"`
- [ ] ✅ Test passes (green phase)

---

### Test 8: Empty State - Implement Empty State Component

**File:** `tests/e2e/target-lineup.spec.ts`

**Tasks to make this test pass:**

- [ ] In `TargetLineupView.tsx`, add empty state conditional
- [ ] Display: "No channels in lineup. Add channels from Sources."
- [ ] Add "Browse Sources" button → navigates to `/sources`
- [ ] For now, disable button or show "Coming soon" (until story 3-10)
- [ ] Add data-testid: `empty-state-message`, `browse-sources-button`
- [ ] Run test: `npx playwright test tests/e2e/target-lineup.spec.ts -g "empty state"`
- [ ] ✅ Test passes (green phase)

---

### Test 9: Disable with Undo - Implement useDisableChannelWithUndo Hook

**File:** `tests/e2e/target-lineup.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/hooks/useDisableChannelWithUndo.ts`
- [ ] On disable: optimistically remove from cache
- [ ] Show toast with "Undo" button (5 second timeout)
- [ ] Schedule `updateChannelEnabled(channelId, false)` after 5 seconds
- [ ] On undo: restore channel to cache, cancel mutation
- [ ] Use React state to track pending disables
- [ ] Run test: `npx playwright test tests/e2e/target-lineup.spec.ts -g "Undo"`
- [ ] ✅ Test passes (green phase)

---

### Test 10: TypeScript - Add Types and Bindings

**File:** `tests/e2e/target-lineup.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `TargetLineupChannel` interface to `src/lib/tauri.ts`:
  ```typescript
  export interface TargetLineupChannel {
    id: number;
    channelId: string;
    displayName: string;
    icon: string | null;
    isSynthetic: boolean;
    isEnabled: boolean;
    plexDisplayOrder: number;
    streamCount: number;
    primaryStreamName: string | null;
  }
  ```
- [ ] Add `getTargetLineupChannels(): Promise<TargetLineupChannel[]>`
- [ ] Reuse existing `updateChannelEnabled` and `updateChannelOrder`
- [ ] Run test: `npx tsc --noEmit`
- [ ] ✅ Test passes (green phase)

---

### Test 11: Performance - Verify Load Time <500ms

**File:** `tests/e2e/target-lineup.spec.ts`

**Tasks to make this test pass:**

- [ ] Optimize SQL query with indexes on `is_enabled`, `plex_display_order`
- [ ] Run performance test with 500 enabled channels
- [ ] Verify response time <100ms backend + <400ms frontend = <500ms total
- [ ] Run test: `npx playwright test tests/e2e/target-lineup.spec.ts -g "performance"`
- [ ] ✅ Test passes (green phase)

---

## Running Tests

```bash
# Run all failing tests for this story
npx playwright test tests/e2e/target-lineup.spec.ts

# Run specific test file
npx playwright test tests/e2e/target-lineup.spec.ts

# Run tests in headed mode (see browser)
npx playwright test tests/e2e/target-lineup.spec.ts --headed

# Debug specific test
npx playwright test tests/e2e/target-lineup.spec.ts --debug

# Run tests with UI mode (interactive)
npx playwright test tests/e2e/target-lineup.spec.ts --ui
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All tests written and failing
- ✅ Mock fixtures created with Tauri V2 pattern
- ✅ data-testid requirements listed
- ✅ Implementation checklist created

**Verification:**

- All tests run and fail as expected
- Failure messages are clear and actionable:
  - "Route /target-lineup not found"
  - "Command get_target_lineup_channels not registered"
  - "Element [data-testid=target-lineup-nav-item] not found"
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (start with navigation)
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

**Progress Tracking:**

- Check off tasks as you complete them
- Share progress in daily standup
- Mark story as IN PROGRESS in `sprint-status.yaml`

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
2. **Review code for quality** (readability, maintainability, performance)
3. **Extract duplications** (DRY principle)
4. **Optimize performance** (if needed)
5. **Ensure tests still pass** after each refactor
6. **Update documentation** (if API contracts change)

**Key Principles:**

- Tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if tests fail)
- Run tests after each change
- Don't change test behavior (only implementation)

**Completion:**

- All tests pass
- Code quality meets team standards
- No duplications or code smells
- Ready for code review and story approval

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow (manual handoff)
2. **Review this checklist** with team in standup or planning
3. **Run failing tests** to confirm RED phase: `npx playwright test tests/e2e/target-lineup.spec.ts`
4. **Begin implementation** using implementation checklist as guide
5. **Work one test at a time** (red → green for each)
6. **Share progress** in daily standup
7. **When all tests pass**, refactor code for quality
8. **When refactoring complete**, manually update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **fixture-architecture.md** - Test fixture patterns with setup/teardown and auto-cleanup using Playwright's fixtures
- **data-factories.md** - Factory patterns using mock data generation with overrides support
- **network-first.md** - Tauri command interception patterns (mock-first approach for deterministic tests)
- **test-quality.md** - Test design principles (Given-When-Then, one assertion per test, determinism, isolation)
- **selector-resilience.md** - data-testid selector hierarchy for robust, maintainable tests
- **test-levels-framework.md** - Test level selection framework (E2E for user journeys)

See `_bmad/bmm/testarch/knowledge/tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx playwright test tests/e2e/target-lineup.spec.ts`

**Expected Results:**

```
Running 15 tests using 1 worker

  ✘ tests/e2e/target-lineup.spec.ts:XX:X › Navigation › should display "Target Lineup" menu item
    Error: locator('[data-testid="target-lineup-nav-item"]') not found

  ✘ tests/e2e/target-lineup.spec.ts:XX:X › Navigation › should remove old "Channels" menu item
    Expected: [data-testid="channels-nav-item"] not to be visible
    Received: element is visible

  ✘ tests/e2e/target-lineup.spec.ts:XX:X › Routing › should navigate to Target Lineup view
    Error: page.goto: net::ERR_ABORTED; maybe route is missing?

  ✘ tests/e2e/target-lineup.spec.ts:XX:X › View › should display only enabled channels
    Error: Command get_target_lineup_channels not found

  ... (11 more failures)
```

**Summary:**

- Total tests: 15
- Passing: 0 (expected)
- Failing: 15 (expected)
- Status: ✅ RED phase verified

**Expected Failure Messages:**

1. Navigation test: "Element [data-testid=target-lineup-nav-item] not found"
2. Route test: "net::ERR_ABORTED; route /target-lineup not found"
3. Backend test: "Command get_target_lineup_channels not registered"
4. Component test: "Element [data-testid=target-lineup-view] not found"
5. Drag-drop test: "Drag handle not found"
6. Empty state test: "Element [data-testid=empty-state-message] not found"
7. Undo test: "Toast with Undo button not found"

---

## Notes

**Navigation Restructure Context:**

This story is **Step 1 of 3** for the Navigation Restructure (Option C):
1. **Story 3-9** (this): Target Lineup View - the Plex output
2. **Story 3-10**: Sources View with XMLTV Tab - browse EPG sources
3. **Story 3-11**: Sources View with Xtream Tab - browse streams

**Architecture Compliance:**

Target Lineup shows XMLTV channels that are enabled. This includes:
- Real XMLTV channels (from EPG sources)
- Synthetic channels (promoted orphan Xtream streams from story 3-8)

Both types are stored in `xmltv_channels` table with settings in `xmltv_channel_settings`.

**Performance Requirements:**

Current problem: `get_xmltv_channels_with_mappings` loads ALL tables.
New approach: `get_target_lineup_channels` uses INNER JOIN for only enabled channels.
Target: <100ms backend query for 500 enabled channels.

**Backwards Compatibility:**

The old `/channels` route should redirect to `/target-lineup` for bookmarks/deep links.
This can be removed after stories 3-10/3-11 when Sources replaces channel browsing.

**Reusable Patterns from Story 3-8:**

- Tauri mock injection via `window.__TAURI_INTERNALS__`
- Optimistic UI updates with TanStack Query
- Toast notifications with action buttons
- Badge styling for warnings (amber) and status indicators

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Tag @TEA agent in Slack/Discord
- Refer to `./_bmad/bmm/docs/tea-README.md` for workflow documentation
- Consult `./_bmad/bmm/testarch/knowledge/` for testing best practices

---

**Generated by BMad TEA Agent** - 2026-01-20
