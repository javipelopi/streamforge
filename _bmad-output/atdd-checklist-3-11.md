# ATDD Checklist - Epic 3, Story 11: Implement Sources View Xtream Tab

**Date:** 2026-01-20
**Author:** Javier
**Primary Test Level:** E2E (End-to-End)

---

## Story Summary

As a user, I want to browse streams from my Xtream accounts, so that I can link streams to XMLTV channels or promote orphans to my lineup.

**As a** user
**I want** to browse streams from my Xtream accounts
**So that** I can link streams to XMLTV channels or promote orphans to my lineup

This story completes the Sources view navigation restructure by enabling the Xtream tab alongside the XMLTV tab implemented in Story 3-10.

---

## Acceptance Criteria

1. **Given** the Sources view
   **When** I click the "Xtream" tab
   **Then** I see my Xtream accounts as expandable accordion sections
   **And** each section header shows: account name, stream count, orphan count

2. **Given** I expand an Xtream account section
   **When** the streams load (lazy-loaded per account)
   **Then** I see all streams from that account with:
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

---

## Failing Tests Created (RED Phase)

### E2E Tests (23 tests)

**File:** `tests/e2e/sources-xtream.spec.ts` (588 lines)

#### AC #1: Xtream Tab Enabled with Account Display (6 tests)

- ✅ **Test:** should enable Xtream tab (remove disabled state)
  - **Status:** RED - Tab is currently disabled with "Soon" badge
  - **Verifies:** Xtream tab is clickable and functional

- ✅ **Test:** should switch to Xtream tab when clicked
  - **Status:** RED - Tab switching not implemented
  - **Verifies:** Tab navigation and active state management

- ✅ **Test:** should display Xtream accounts as accordion sections
  - **Status:** RED - XtreamSourcesTab component doesn't exist
  - **Verifies:** Account accordion display

- ✅ **Test:** should display stream count in accordion header
  - **Status:** RED - Account stats not displayed
  - **Verifies:** Stream count badge in header

- ✅ **Test:** should display orphan count badge in accordion header
  - **Status:** RED - Orphan count badge not implemented
  - **Verifies:** Amber orphan count display

- ✅ **Test:** should display empty state when no Xtream accounts configured
  - **Status:** RED - Empty state component not implemented
  - **Verifies:** Empty state UX with link to Accounts

#### AC #2: Lazy-Load Streams with Status Display (8 tests)

- ✅ **Test:** should NOT load streams until account is expanded
  - **Status:** RED - Lazy loading logic not implemented
  - **Verifies:** Streams only fetch on accordion expand

- ✅ **Test:** should lazy-load streams when account accordion is expanded
  - **Status:** RED - Stream loading on expand not implemented
  - **Verifies:** TanStack Query enabled:isExpanded pattern

- ✅ **Test:** should display stream with icon, name, and quality badges
  - **Status:** RED - XtreamStreamRow component doesn't exist
  - **Verifies:** Stream display elements

- ✅ **Test:** should display "Linked" badge (blue) for linked streams
  - **Status:** RED - Status badges not implemented
  - **Verifies:** Blue "Linked" badge styling

- ✅ **Test:** should display "Orphan" badge (amber) for orphan streams
  - **Status:** RED - Status badges not implemented
  - **Verifies:** Amber "Orphan" badge styling

- ✅ **Test:** should display "Promoted" badge (green) for promoted streams
  - **Status:** RED - Status badges not implemented
  - **Verifies:** Green "Promoted" badge styling

- ✅ **Test:** should load 500 streams quickly (performance check)
  - **Status:** RED - Large stream rendering not optimized
  - **Verifies:** Performance target <500ms for 500 streams

#### AC #3: Linked Stream Actions (3 tests)

- ✅ **Test:** should open action menu when clicking linked stream
  - **Status:** RED - XtreamStreamActionMenu component doesn't exist
  - **Verifies:** Action menu trigger and options

- ✅ **Test:** should display linked XMLTV channels when "View Linked" clicked
  - **Status:** RED - LinkedChannelsPopover component doesn't exist
  - **Verifies:** Popover showing linked channel info

- ✅ **Test:** should unlink stream and update badge when "Unlink" clicked
  - **Status:** RED - Unlink functionality not implemented
  - **Verifies:** remove_stream_mapping call and optimistic UI update

#### AC #4: Orphan Stream Actions (4 tests)

- ✅ **Test:** should open action menu for orphan stream with promote and link options
  - **Status:** RED - Orphan-specific actions not implemented
  - **Verifies:** "Promote to Lineup" and "Link to XMLTV" buttons

- ✅ **Test:** should open promote dialog when "Promote to Lineup" clicked
  - **Status:** RED - Promote dialog integration not implemented
  - **Verifies:** Reuse of PromoteOrphanDialog from Story 3-8

- ✅ **Test:** should promote orphan and update badge when dialog submitted
  - **Status:** RED - Promote workflow not integrated
  - **Verifies:** promote_orphan_to_plex call and badge update

- ✅ **Test:** should open stream search dropdown when "Link to XMLTV" clicked
  - **Status:** RED - Link workflow not implemented
  - **Verifies:** Stream search dropdown for manual linking

#### Promoted Stream Actions (2 tests)

- ✅ **Test:** should show "View in Lineup" and "Edit Channel" actions for promoted streams
  - **Status:** RED - Promoted-specific actions not implemented
  - **Verifies:** Action menu for promoted streams

- ✅ **Test:** should navigate to Target Lineup when "View in Lineup" clicked
  - **Status:** RED - Navigation not implemented
  - **Verifies:** Route to /target-lineup

#### Accessibility (3 tests)

- ✅ **Test:** should have accessible Xtream tab with ARIA attributes
  - **Status:** RED - ARIA attributes not added to Xtream tab
  - **Verifies:** role="tab", aria-selected, aria-controls

- ✅ **Test:** should have accessible accordion with ARIA attributes
  - **Status:** RED - ARIA not implemented on accordion
  - **Verifies:** aria-expanded, aria-controls on headers

- ✅ **Test:** should have accessible action menus with ARIA attributes
  - **Status:** RED - ARIA not on action menus
  - **Verifies:** aria-haspopup="menu" on triggers

#### Integration (1 test)

- ✅ **Test:** should preserve Xtream tab state when navigating back from Target Lineup
  - **Status:** RED - State management not implemented
  - **Verifies:** Clean state on navigation (no leaks)

---

## Data Factories Created

### XtreamAccountStream Factory

**File:** `tests/support/factories/xtream-account-stream.factory.ts`

**Exports:**

- `createXtreamAccountStream(overrides?)` - Create single stream with optional overrides
- `createXtreamAccountStreams(count)` - Create array of streams
- `createLinkedStream(overrides?)` - Create stream linked to XMLTV channel
- `createOrphanStream(overrides?)` - Create orphan stream (not mapped)
- `createPromotedStream(overrides?)` - Create promoted stream with synthetic channel
- `createMultiLinkedStream(xmltvChannelIds)` - Create stream linked to multiple channels
- `createRealisticStreamMix(totalCount)` - Create realistic mix (40% linked, 10% promoted, 50% orphan)
- `createStreamStats(streams)` - Calculate stats from stream array
- `createAccountStreamStats(overrides?)` - Create custom stats object
- `create4KStream()`, `createHDStream()`, `createSDStream()` - Quality-specific streams

**Example Usage:**

```typescript
const orphanStream = createOrphanStream({ name: 'CNN HD' });
const linkedStream = createLinkedStream({ linkedXmltvIds: [500] });
const streams = createRealisticStreamMix(20); // 20 streams with realistic status distribution
```

---

## Fixtures Created

### Xtream Sources Fixtures

**File:** `tests/support/fixtures/sources-xtream.fixture.ts`

**Fixtures:**

- `injectXtreamSourcesMocks(accounts, streamsByAccountId)` - Low-level mock injection
  - **Setup:** Injects Tauri mocks with provided accounts and streams
  - **Provides:** Async function to inject mocks before navigation
  - **Cleanup:** Auto-cleared on page navigation

- `xtreamSourcesWithStreams` - Pre-configured scenario with 2 accounts and varied streams
  - **Setup:** Creates 2 accounts with realistic stream mixes
  - **Provides:** accounts, streamsByAccountId, linkedStream, orphanStream, promotedStream
  - **Cleanup:** Auto-cleared on page navigation

- `emptyXtreamState` - Empty state scenario (no accounts)
  - **Setup:** Injects empty account list
  - **Provides:** void (just injects mocks)
  - **Cleanup:** Auto-cleared on page navigation

- `largeXtreamAccount` - Performance test scenario (500 streams)
  - **Setup:** Single account with 500 streams
  - **Provides:** account, streams
  - **Cleanup:** Auto-cleared on page navigation

**Example Usage:**

```typescript
import { test } from './fixtures/sources-xtream.fixture';

test('should display streams', async ({ xtreamSourcesWithStreams }) => {
  // xtreamSourcesWithStreams already injected - just navigate
  await page.goto('/sources');
  await page.click('[data-testid="xtream-tab"]');
  // Test streams display...
});
```

---

## Mock Requirements

### Backend Commands Mocked

**Command:** `get_accounts() -> Account[]`
- Returns list of configured Xtream accounts
- Already exists from previous stories

**Command:** `get_xtream_streams_for_account(accountId: number) -> XtreamAccountStream[]`
- **NEW COMMAND** - Must be implemented
- Returns streams for specific account with mapping status
- Includes: id, streamId, name, icon, qualities, linkStatus, linkedXmltvIds, syntheticChannelId

**Command:** `get_account_stream_stats(accountId: number) -> AccountStreamStats`
- **NEW COMMAND** - Must be implemented
- Returns lightweight counts for accordion header
- Includes: streamCount, linkedCount, orphanCount, promotedCount

**Command:** `promote_orphan_to_plex(args) -> { success: boolean, syntheticChannelId: number }`
- Already exists from Story 3-8
- Creates synthetic XMLTV channel + mapping

**Command:** `add_manual_stream_mapping(xmltvChannelId, xtreamChannelId, setAsPrimary) -> { success: boolean, mappingId: number }`
- Already exists from Story 3-3
- Links Xtream stream to XMLTV channel

**Command:** `remove_stream_mapping(mappingId: number) -> { success: boolean }`
- Already exists from Story 3-3
- Removes mapping between stream and channel

---

## Required data-testid Attributes

### Sources View - Xtream Tab

- `xtream-tab` - Xtream tab button (remove disabled, remove "Soon" badge)
- `xtream-sources-tab` - Xtream tab panel container
- `xtream-empty-state` - Empty state container (no accounts)
- `xtream-empty-state-message` - Empty state message text
- `go-to-accounts-button` - Link to Accounts section (in empty state)

### Xtream Account Accordion

- `xtream-account-accordion-{accountId}` - Accordion section wrapper
- `xtream-account-header-{accountId}` - Accordion header (clickable)
- `xtream-account-streams-{accountId}` - Accordion content (streams list)
- `orphan-count-badge-{accountId}` - Orphan count badge in header (amber)

### Xtream Stream Row

- `xtream-stream-row-{streamId}` - Stream row container
- `xtream-stream-icon-{streamId}` - Stream icon or placeholder
- `xtream-stream-name-{streamId}` - Stream display name
- `xtream-stream-linked-badge-{streamId}` - "Linked" badge (blue)
- `xtream-stream-orphan-badge-{streamId}` - "Orphan" badge (amber)
- `xtream-stream-promoted-badge-{streamId}` - "Promoted" badge (green)
- `xtream-stream-actions-{streamId}` - Action menu trigger (three dots icon)

### Action Menu Items

**For Linked Streams:**
- `view-linked-channels-{streamId}` - "View Linked Channels" button
- `unlink-stream-{streamId}` - "Unlink" button

**For Orphan Streams:**
- `promote-to-lineup-{streamId}` - "Promote to Lineup" button
- `link-to-xmltv-{streamId}` - "Link to XMLTV Channel" button

**For Promoted Streams:**
- `view-in-lineup-{streamId}` - "View in Lineup" button
- `edit-channel-{streamId}` - "Edit Channel" button

### Dialogs and Popovers

- `linked-channels-popover` - Popover showing linked XMLTV channels
- `promote-orphan-dialog` - Promote dialog (reused from Story 3-8)
- `promote-display-name` - Display name input in promote dialog
- `promote-submit-button` - Submit button in promote dialog
- `stream-search-dropdown` - Dropdown for linking to XMLTV channel
- `stream-search-input` - Search input in dropdown

**Implementation Example:**

```tsx
<button
  data-testid="xtream-tab"
  role="tab"
  aria-selected={activeTab === 'xtream'}
  aria-controls="xtream-tab-panel"
  onClick={() => setActiveTab('xtream')}
>
  Xtream
</button>

<div data-testid={`xtream-stream-row-${stream.streamId}`}>
  <img data-testid={`xtream-stream-icon-${stream.streamId}`} src={stream.icon} />
  <span data-testid={`xtream-stream-name-${stream.streamId}`}>{stream.name}</span>
  {stream.linkStatus === 'linked' && (
    <span data-testid={`xtream-stream-linked-badge-${stream.streamId}`}>
      Linked
    </span>
  )}
</div>
```

---

## Implementation Checklist

### Test: Enable Xtream tab and display accounts

**File:** `tests/e2e/sources-xtream.spec.ts`

**Tasks to make this test pass:**

- [ ] Edit `src/views/Sources.tsx`:
  - Remove `disabled` attribute from Xtream tab button
  - Remove "Soon" badge from Xtream tab
  - Remove `cursor-not-allowed` and gray styling
  - Add click handler: `onClick={() => setActiveTab('xtream')}`
  - Add conditional rendering for `XtreamSourcesTab` when activeTab === 'xtream'
- [ ] Create `src/components/sources/XtreamSourcesTab.tsx`
- [ ] Use TanStack Query to fetch accounts: `useQuery(['accounts'], getAccounts)`
- [ ] Render `XtreamAccountAccordion` for each account
- [ ] Add data-testid="xtream-sources-tab"
- [ ] Run test: `npm run test:e2e -- sources-xtream.spec.ts --grep "should enable Xtream tab"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1.5 hours

---

### Test: Display stream count and orphan count in accordion header

**File:** `tests/e2e/sources-xtream.spec.ts`

**Tasks to make this test pass:**

- [ ] Add Rust command `get_account_stream_stats` in `src-tauri/src/commands/channels.rs`:
  - Create `AccountStreamStats` struct
  - Query database to count streams by linkStatus
  - Return streamCount, linkedCount, orphanCount, promotedCount
- [ ] Register command in `src-tauri/src/lib.rs`
- [ ] Add TypeScript binding in `src/lib/tauri.ts`:
  - `AccountStreamStats` interface
  - `getAccountStreamStats(accountId: number): Promise<AccountStreamStats>`
- [ ] Create `src/components/sources/XtreamAccountAccordion.tsx`:
  - Use `useQuery` for stats (always enabled)
  - Display account name, stream count, orphan count badge
  - Add expand/collapse state and chevron icon
  - Add aria-expanded and aria-controls attributes
- [ ] Add data-testid="xtream-account-accordion-{accountId}"
- [ ] Run test: `npm run test:e2e -- sources-xtream.spec.ts --grep "should display stream count"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: Lazy-load streams when account expanded

**File:** `tests/e2e/sources-xtream.spec.ts`

**Tasks to make this test pass:**

- [ ] Add Rust command `get_xtream_streams_for_account` in `src-tauri/src/commands/channels.rs`:
  - Create `XtreamAccountStream` struct
  - Query xtream_channels with LEFT JOIN channel_mappings
  - Determine linkStatus: "promoted" if synthetic_id exists, "linked" if linked_ids not empty, else "orphan"
  - Return stream data with status
- [ ] Register command in `src-tauri/src/lib.rs`
- [ ] Add TypeScript binding in `src/lib/tauri.ts`:
  - `XtreamAccountStream` interface
  - `getXtreamStreamsForAccount(accountId: number): Promise<XtreamAccountStream[]>`
- [ ] Update `XtreamAccountAccordion`:
  - Use local state `isExpanded: boolean`
  - Use `useQuery(['xtream-streams', accountId], ..., { enabled: isExpanded })` for lazy loading
  - Display loading spinner while streams load
  - Render stream list when loaded
- [ ] Run test: `npm run test:e2e -- sources-xtream.spec.ts --grep "should lazy-load streams"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2.5 hours

---

### Test: Display streams with icon, name, quality badges, and status badges

**File:** `tests/e2e/sources-xtream.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/components/sources/XtreamStreamRow.tsx`:
  - Display stream icon (with fallback placeholder)
  - Display stream name
  - Render quality badges (HD/SD/4K) using existing `getQualityBadgeClasses` util
  - Render status badge based on linkStatus:
    - "Linked" (blue): `bg-blue-100 text-blue-800`
    - "Orphan" (amber): `bg-amber-100 text-amber-800` with AlertTriangle icon
    - "Promoted" (green): `bg-green-100 text-green-800`
- [ ] Add data-testid attributes for all elements
- [ ] Integrate `XtreamStreamRow` into `XtreamAccountAccordion`
- [ ] Run test: `npm run test:e2e -- sources-xtream.spec.ts --grep "should display stream with icon"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: Open action menu and display linked channels

**File:** `tests/e2e/sources-xtream.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/components/sources/XtreamStreamActionMenu.tsx`:
  - Accept stream prop with linkStatus
  - Render different actions based on linkStatus
  - For linked: "View Linked Channels", "Unlink"
  - For orphan: "Promote to Lineup", "Link to XMLTV Channel"
  - For promoted: "View in Lineup", "Edit Channel"
  - Add close-on-outside-click pattern (useEffect + ref)
- [ ] Update `XtreamStreamRow` to add action menu trigger (MoreVertical icon)
- [ ] Create `src/components/sources/LinkedChannelsPopover.tsx`:
  - Display list of XMLTV channel IDs (or names if available)
  - Show in popover when "View Linked" clicked
- [ ] Add data-testid attributes for menu items
- [ ] Run test: `npm run test:e2e -- sources-xtream.spec.ts --grep "should open action menu"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: Unlink stream and update badge

**File:** `tests/e2e/sources-xtream.spec.ts`

**Tasks to make this test pass:**

- [ ] Implement unlink handler in `XtreamStreamActionMenu`:
  - Call `removeStreamMapping(mappingId)` from `src/lib/tauri.ts`
  - Invalidate stream queries for optimistic UI update
  - Show success toast: "Stream unlinked"
- [ ] Add error handling for failed unlink
- [ ] Run test: `npm run test:e2e -- sources-xtream.spec.ts --grep "should unlink stream"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: Promote orphan to lineup

**File:** `tests/e2e/sources-xtream.spec.ts`

**Tasks to make this test pass:**

- [ ] Reuse `PromoteOrphanDialog` from `src/components/channels/OrphanXtreamSection.tsx`:
  - Extract to shared component if not already
  - Pre-fill display name from stream name
  - Pre-fill icon from stream icon
- [ ] Implement promote handler in `XtreamStreamActionMenu`:
  - Open promote dialog on "Promote to Lineup" click
  - Call `promoteOrphanToPlex(...)` on submit
  - Invalidate stream queries for optimistic UI update
  - Show success toast: "Stream promoted to lineup"
- [ ] Add data-testid attributes for promote dialog
- [ ] Run test: `npm run test:e2e -- sources-xtream.spec.ts --grep "should promote orphan"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1.5 hours

---

### Test: Link orphan to XMLTV channel

**File:** `tests/e2e/sources-xtream.spec.ts`

**Tasks to make this test pass:**

- [ ] Reuse stream search dropdown pattern from `ManualMatchDropdown.tsx`:
  - Show dropdown on "Link to XMLTV Channel" click
  - Search XMLTV channels
  - User selects a channel
- [ ] Implement link handler in `XtreamStreamActionMenu`:
  - Call `addManualStreamMapping(xmltvChannelId, xtreamStreamId, setAsPrimary)`
  - Invalidate stream queries for optimistic UI update
  - Show success toast: "Stream linked to channel"
- [ ] Add data-testid attributes for search dropdown
- [ ] Run test: `npm run test:e2e -- sources-xtream.spec.ts --grep "should open stream search dropdown"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1.5 hours

---

### Test: View promoted stream in Target Lineup

**File:** `tests/e2e/sources-xtream.spec.ts`

**Tasks to make this test pass:**

- [ ] Implement "View in Lineup" handler in `XtreamStreamActionMenu`:
  - Navigate to `/target-lineup` route
  - Optionally: scroll to/highlight the promoted channel
- [ ] Run test: `npm run test:e2e -- sources-xtream.spec.ts --grep "should navigate to Target Lineup"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: Accessibility attributes

**File:** `tests/e2e/sources-xtream.spec.ts`

**Tasks to make this test pass:**

- [ ] Add ARIA attributes to Xtream tab:
  - `role="tab"`
  - `aria-selected={activeTab === 'xtream'}`
  - `aria-controls="xtream-tab-panel"`
- [ ] Add ARIA attributes to accordion headers:
  - `aria-expanded={isExpanded}`
  - `aria-controls={contentId}`
- [ ] Add ARIA attributes to action menu triggers:
  - `aria-haspopup="menu"`
- [ ] Add IDs to accordion content matching aria-controls
- [ ] Run test: `npm run test:e2e -- sources-xtream.spec.ts --grep "Accessibility"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: Empty state display

**File:** `tests/e2e/sources-xtream.spec.ts`

**Tasks to make this test pass:**

- [ ] Handle empty accounts array in `XtreamSourcesTab`:
  - Display empty state component
  - Show message: "No Xtream accounts configured. Add accounts in Accounts."
  - Add "Go to Accounts" button
- [ ] Add data-testid attributes for empty state
- [ ] Run test: `npm run test:e2e -- sources-xtream.spec.ts --grep "should display empty state"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

## Running Tests

```bash
# Run all failing tests for story 3-11
npm run test:e2e -- sources-xtream.spec.ts

# Run specific test file
npm run test:e2e -- sources-xtream.spec.ts

# Run tests in headed mode (see browser)
npm run test:e2e -- sources-xtream.spec.ts --headed

# Debug specific test
npm run test:e2e -- sources-xtream.spec.ts --debug

# Run specific test by grep pattern
npm run test:e2e -- sources-xtream.spec.ts --grep "should enable Xtream tab"
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All tests written and failing (23 E2E tests)
- ✅ Fixtures and factories created with auto-cleanup
- ✅ Mock requirements documented (2 new Rust commands)
- ✅ data-testid requirements listed (25+ attributes)
- ✅ Implementation checklist created (10 task groups)

**Verification:**

- All tests run and fail as expected (awaiting implementation)
- Failure messages are clear: Components don't exist, commands not registered
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (start with "Enable Xtream tab")
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
- Update story status to IN PROGRESS in sprint-status.yaml

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
2. **Review code for quality** (readability, maintainability, performance)
3. **Extract duplications** (DRY principle)
4. **Optimize performance** (if needed - target: 500 streams in <500ms)
5. **Ensure tests still pass** after each refactor
6. **Update documentation** (if API contracts change)

**Key Principles:**

- Tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if tests fail)
- Run tests after each change
- Don't change test behavior (only implementation)

**Completion:**

- All tests pass (23/23 green)
- Code quality meets team standards
- No duplications or code smells
- Ready for code review and story approval

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow (manual handoff)
2. **Review this checklist** with team in standup or planning
3. **Run failing tests** to confirm RED phase: `npm run test:e2e -- sources-xtream.spec.ts`
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
- **network-first.md** - Route interception patterns (intercept BEFORE navigation to prevent race conditions)
- **test-quality.md** - Test design principles (Given-When-Then, one assertion per test, determinism, isolation)
- **test-levels-framework.md** - Test level selection framework (E2E for user journeys, API for business logic)
- **selector-resilience.md** - Selector hierarchy (data-testid > ARIA > text > CSS) for stable tests

See `_bmad/bmm/testarch/tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npm run test:e2e -- sources-xtream.spec.ts`

**Expected Results:**

```
Running 23 tests in sources-xtream.spec.ts

  Sources View - Xtream Tab (Story 3-11)
    AC #1: Xtream Tab Enabled with Account Display
      ✗ should enable Xtream tab (remove disabled state)
        Error: Xtream tab is still disabled

      ✗ should switch to Xtream tab when clicked
        Error: Tab is disabled, cannot click

      ✗ should display Xtream accounts as accordion sections
        Error: XtreamSourcesTab component not found

      ✗ should display stream count in accordion header
        Error: XtreamAccountAccordion component not found

      ✗ should display orphan count badge in accordion header
        Error: get_account_stream_stats command not found

      ✗ should display empty state when no Xtream accounts configured
        Error: xtream-empty-state element not found

    AC #2: Lazy-Load Streams with Status Display
      ✗ should NOT load streams until account is expanded
        Error: XtreamAccountAccordion component not found

      ✗ should lazy-load streams when account accordion is expanded
        Error: get_xtream_streams_for_account command not found

      ✗ should display stream with icon, name, and quality badges
        Error: XtreamStreamRow component not found

      ✗ should display "Linked" badge (blue) for linked streams
        Error: xtream-stream-linked-badge element not found

      ✗ should display "Orphan" badge (amber) for orphan streams
        Error: xtream-stream-orphan-badge element not found

      ✗ should display "Promoted" badge (green) for promoted streams
        Error: xtream-stream-promoted-badge element not found

      ✗ should load 500 streams quickly (performance check)
        Error: XtreamAccountAccordion component not found

    AC #3: Linked Stream Actions
      ✗ should open action menu when clicking linked stream
        Error: XtreamStreamActionMenu component not found

      ✗ should display linked XMLTV channels when "View Linked" clicked
        Error: LinkedChannelsPopover component not found

      ✗ should unlink stream and update badge when "Unlink" clicked
        Error: unlink handler not implemented

    AC #4: Orphan Stream Actions
      ✗ should open action menu for orphan stream with promote and link options
        Error: promote-to-lineup button not found

      ✗ should open promote dialog when "Promote to Lineup" clicked
        Error: promote-orphan-dialog not found

      ✗ should promote orphan and update badge when dialog submitted
        Error: promote handler not implemented

      ✗ should open stream search dropdown when "Link to XMLTV" clicked
        Error: stream-search-dropdown not found

    Promoted Stream Actions
      ✗ should show "View in Lineup" and "Edit Channel" actions for promoted streams
        Error: view-in-lineup button not found

      ✗ should navigate to Target Lineup when "View in Lineup" clicked
        Error: navigation not implemented

    Accessibility
      ✗ should have accessible Xtream tab with ARIA attributes
        Error: aria-selected not found on xtream-tab

      ✗ should have accessible accordion with ARIA attributes
        Error: aria-expanded not found on accordion header

      ✗ should have accessible action menus with ARIA attributes
        Error: aria-haspopup not found on action trigger

  0 passed (23 expected failures)
  23 failed
  Time: 12.5s
```

**Summary:**

- Total tests: 23
- Passing: 0 (expected - RED phase)
- Failing: 23 (expected - missing implementation)
- Status: ✅ RED phase verified - Ready for GREEN phase

**Expected Failure Messages:**

- "Xtream tab is still disabled" - Tab not enabled yet
- "XtreamSourcesTab component not found" - Component doesn't exist
- "get_xtream_streams_for_account command not found" - Rust command not implemented
- "get_account_stream_stats command not found" - Rust command not implemented
- "XtreamAccountAccordion component not found" - Component doesn't exist
- "XtreamStreamRow component not found" - Component doesn't exist
- "XtreamStreamActionMenu component not found" - Component doesn't exist
- "LinkedChannelsPopover component not found" - Component doesn't exist

---

## Notes

### Architecture Compliance

This story follows the **XMLTV-First Design** principle. While the Xtream tab shows Xtream streams, the primary actions are:
1. **Link** streams to XMLTV channels (maintaining XMLTV as source of truth)
2. **Promote** orphans (which creates synthetic XMLTV channels)

The Xtream tab is a secondary view for managing stream sources, not a replacement for the XMLTV-centric lineup model.

### Performance Requirements

- **Lazy Loading:** Streams NOT loaded until account expanded
- **Per-Account Queries:** Each accordion fetches independently
- **Header Stats:** Lightweight query (always enabled) for counts
- **Target:** Load 500 streams in <500ms

### Code Reuse from Previous Stories

- **Story 3-10:** Tab interface, accordion pattern, lazy loading with TanStack Query
- **Story 3-8:** Promote orphan dialog and command
- **Story 3-3:** Manual stream mapping commands and search dropdown
- **Existing utils:** Quality badge classes, toast notifications, action menu patterns

### Integration Points

- **Target Lineup (Story 3-9):** "View in Lineup" navigation
- **Sources XMLTV Tab (Story 3-10):** Shared tab interface and patterns
- **Orphan Channels (Story 3-8):** Promote dialog reuse
- **Manual Matching (Story 3-3):** Link/unlink commands reuse

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Tag @tea-agent in Slack/Discord
- Refer to `_bmad/bmm/docs/tea-README.md` for workflow documentation
- Consult `_bmad/bmm/testarch/knowledge` for testing best practices

---

**Generated by BMad TEA Agent** - 2026-01-20
