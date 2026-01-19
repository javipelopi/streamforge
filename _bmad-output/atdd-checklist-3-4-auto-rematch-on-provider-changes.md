# ATDD Checklist - Epic 3, Story 4: Auto-Rematch on Provider Changes

**Date:** 2026-01-19
**Author:** Javier
**Primary Test Level:** Integration

---

## Story Summary

Automatically detect and re-match channels when IPTV provider updates their stream list, preserving manual matches and promoting backup streams when primary streams are removed.

**As a** user
**I want** the app to detect provider changes and re-match automatically
**So that** I don't lose my channel mappings when my provider updates their list

---

## Acceptance Criteria

1. **Provider Change Detection**: System detects new, removed, and changed Xtream streams when comparing scan results to database
2. **Auto-Rematch New Streams**: New streams are matched to XMLTV channels using fuzzy algorithm and added as additional options
3. **Handle Removed Streams**: Removed streams mark mappings unavailable, promote backup to primary if needed
4. **Preserve Manual Matches**: Manual matches are NEVER auto-changed or removed during rematch
5. **Event Logging**: All rematch events are logged with change summary and trigger UI notification badge

---

## Failing Tests Created (RED Phase)

### Integration Tests (8 tests)

**File:** `tests/integration/auto-rematch.spec.ts` (492 lines)

- ✅ **Test:** AC1.1 - should detect new Xtream streams not in database
  - **Status:** RED - Command `detect_provider_changes` does not exist
  - **Verifies:** Detection of new streams by comparing stream_id with database

- ✅ **Test:** AC1.2 - should detect removed Xtream streams missing from provider
  - **Status:** RED - Command `detect_provider_changes` does not exist
  - **Verifies:** Detection of streams that exist in DB but not in provider list

- ✅ **Test:** AC1.3 - should detect changed Xtream streams (name/icon/qualities)
  - **Status:** RED - Command `detect_provider_changes` does not exist
  - **Verifies:** Detection of streams with same stream_id but different metadata

- ✅ **Test:** AC2.1 - should auto-match new streams to XMLTV channels
  - **Status:** RED - Command `scan_and_rematch_channels` does not exist
  - **Verifies:** New streams are fuzzy-matched and added as backup streams

- ✅ **Test:** AC2.2 - should add new matches as backups not primary
  - **Status:** RED - Command `scan_and_rematch_channels` does not exist
  - **Verifies:** New matches have is_primary=false unless channel has no matches

- ✅ **Test:** AC3.1 - should remove auto-generated mappings for deleted streams
  - **Status:** RED - Command `scan_and_rematch_channels` does not exist
  - **Verifies:** Mappings with is_manual=0 are deleted when stream removed

- ✅ **Test:** AC3.2 - should promote backup stream when primary removed
  - **Status:** RED - Command `scan_and_rematch_channels` does not exist
  - **Verifies:** Next highest confidence backup becomes primary when primary removed

- ✅ **Test:** AC4 - should NEVER remove or change manual matches
  - **Status:** RED - Command `scan_and_rematch_channels` does not exist
  - **Verifies:** Mappings with is_manual=1 are preserved during rematch

### Integration Tests - Event Logging (4 tests)

**File:** `tests/integration/event-log.spec.ts` (318 lines)

- ✅ **Test:** AC5.1 - should log provider change events with details
  - **Status:** RED - Event log table does not exist
  - **Verifies:** Events logged with category='provider' and change summary

- ✅ **Test:** AC5.2 - should retrieve events with pagination
  - **Status:** RED - Command `get_events` does not exist
  - **Verifies:** Events can be fetched with filters and pagination

- ✅ **Test:** AC5.3 - should track unread event count
  - **Status:** RED - Command `get_unread_event_count` does not exist
  - **Verifies:** Unread count increments with new events

- ✅ **Test:** AC5.4 - should mark events as read
  - **Status:** RED - Command `mark_events_read` does not exist
  - **Verifies:** Events can be marked read individually or in bulk

### E2E Tests (2 tests)

**File:** `tests/e2e/rematch-notification.spec.ts` (186 lines)

- ✅ **Test:** AC5.5 - should display notification badge when events occur
  - **Status:** RED - Notification badge component does not exist
  - **Verifies:** Badge appears on Logs nav item with unread count

- ✅ **Test:** AC5.6 - should show change summary in scan toast
  - **Status:** RED - Enhanced scan response not implemented
  - **Verifies:** Toast displays new matches, removed, updated counts

---

## Data Factories Created

### Provider Changes Factory

**File:** `tests/support/factories/provider-changes.factory.ts`

**Exports:**
- `createProviderChanges(overrides?)` - Create provider change summary
- `createNewStream(overrides?)` - Create new Xtream stream not in DB
- `createRemovedStreamMapping(overrides?)` - Create mapping for removed stream
- `createChangedStream(overrides?)` - Create stream with changed metadata

**Example Usage:**

```typescript
const changes = createProviderChanges({
  newStreams: [createNewStream({ name: 'CNN HD' })],
  removedStreamIds: [101, 102],
  changedStreams: [createChangedStream({ oldName: 'ESPN', newName: 'ESPN Sports' })]
});
```

### Event Log Factory

**File:** `tests/support/factories/event-log.factory.ts`

**Exports:**
- `createEventLog(overrides?)` - Create event log entry
- `createProviderEvent(overrides?)` - Create provider category event
- `createInfoEvent(overrides?)` - Create info level event
- `createWarnEvent(overrides?)` - Create warning level event

**Example Usage:**

```typescript
const event = createProviderEvent({
  message: 'Provider changes detected: 5 new, 2 removed',
  details: JSON.stringify({ newStreams: 5, removedStreams: 2 })
});
```

---

## Fixtures Created

### Database Seeding Fixture

**File:** `tests/support/fixtures/database.fixture.ts`

**Fixtures:**
- `seedChannels` - Seeds XMLTV and Xtream channels with mappings
  - **Setup:** Creates test channels and mappings in database
  - **Provides:** Channel IDs and mapping IDs for test assertions
  - **Cleanup:** Deletes all created channels and mappings

**Example Usage:**

```typescript
import { test } from './fixtures/database.fixture';

test('should handle provider changes', async ({ seedChannels }) => {
  const { xmltvIds, xtreamIds, mappingIds } = await seedChannels({
    xmltv: [createXmltvChannel({ displayName: 'ESPN' })],
    xtream: [createChannel({ name: 'ESPN HD' })],
    mappings: [createChannelMapping({ is_manual: false })]
  });
  // Test auto-rematch with seeded data
});
```

---

## Mock Requirements

### Xtream API Mock

**Endpoint:** `GET {server_url}/player_api.php?action=get_live_streams`

**Success Response:**

```json
[
  {
    "num": 1,
    "name": "ESPN HD",
    "stream_id": 12345,
    "stream_icon": "http://example.com/espn.png",
    "epg_channel_id": "ESPN.us",
    "category_id": "1",
    "tv_archive": 1,
    "tv_archive_duration": 7
  }
]
```

**Failure Response:**

```json
{
  "error": "Authentication failed"
}
```

**Notes:** Mock should support returning different channel lists on subsequent calls to simulate provider changes

---

## Required data-testid Attributes

### Accounts View

- `scan-channels-button` - Button to trigger scan and rematch
- `scan-result-toast` - Toast showing scan results
- `change-summary-text` - Text showing new/removed/updated counts

### Sidebar Navigation

- `logs-nav-item` - Logs navigation link
- `notification-badge` - Badge showing unread event count
- `badge-count` - Text element showing numeric count

### Logs View

- `event-list` - Container for event log entries
- `event-item-{id}` - Individual event log item
- `event-level-{level}` - Event level indicator (info/warn/error)
- `event-message` - Event message text
- `mark-all-read-button` - Button to mark all events as read

**Implementation Example:**

```tsx
<button data-testid="scan-channels-button">Scan Channels</button>
<div data-testid="notification-badge">{unreadCount}</div>
<div data-testid="event-item-123">
  <span data-testid="event-level-info">INFO</span>
  <span data-testid="event-message">Provider changes detected</span>
</div>
```

---

## Implementation Checklist

### Test: AC1.1-1.3 - Provider Change Detection

**File:** `tests/integration/auto-rematch.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src-tauri/src/matcher/auto_rematch.rs` module
- [ ] Implement `detect_provider_changes()` function
- [ ] Create `ProviderChanges` struct with new/removed/changed fields
- [ ] Compare current streams with database by stream_id
- [ ] Detect name/icon/qualities changes for existing streams
- [ ] Export module in `src-tauri/src/matcher/mod.rs`
- [ ] Run test: `pnpm test -- tests/integration/auto-rematch.spec.ts -g "AC1"`
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 3 hours

---

### Test: AC2.1-2.2 - Auto-Match New Streams

**File:** `tests/integration/auto-rematch.spec.ts`

**Tasks to make this test pass:**

- [ ] Implement `auto_rematch_new_streams()` in auto_rematch.rs
- [ ] Reuse fuzzy matching algorithm from existing matcher
- [ ] Create mappings with is_manual=false
- [ ] Set is_primary=true only if XMLTV channel has no matches
- [ ] Set stream_priority for backup streams
- [ ] Use existing `save_channel_mappings()` from persistence.rs
- [ ] Add required data-testid attributes: none (backend only)
- [ ] Run test: `pnpm test -- tests/integration/auto-rematch.spec.ts -g "AC2"`
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 2 hours

---

### Test: AC3.1-3.2 - Handle Removed Streams

**File:** `tests/integration/auto-rematch.spec.ts`

**Tasks to make this test pass:**

- [ ] Implement `handle_removed_streams()` in auto_rematch.rs
- [ ] Delete mappings where is_manual=0 and stream removed
- [ ] Preserve mappings where is_manual=1 (log warning)
- [ ] Reuse primary promotion logic from `remove_stream_mapping()`
- [ ] Recalculate stream_priority for remaining backups
- [ ] Add required data-testid attributes: none (backend only)
- [ ] Run test: `pnpm test -- tests/integration/auto-rematch.spec.ts -g "AC3"`
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 2 hours

---

### Test: AC4 - Preserve Manual Matches

**File:** `tests/integration/auto-rematch.spec.ts`

**Tasks to make this test pass:**

- [ ] Verify `handle_removed_streams()` checks is_manual flag
- [ ] Ensure manual matches never deleted in rematch process
- [ ] Add test assertion for manual match preservation
- [ ] Add required data-testid attributes: none (backend only)
- [ ] Run test: `pnpm test -- tests/integration/auto-rematch.spec.ts -g "AC4"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: AC5.1-5.4 - Event Logging System

**File:** `tests/integration/event-log.spec.ts`

**Tasks to make this test pass:**

- [ ] Create database migration for event_log table
- [ ] Create `src-tauri/src/db/models/event_log.rs` with structs
- [ ] Create `src-tauri/src/commands/logs.rs` with commands
- [ ] Implement `log_event()` helper function
- [ ] Implement `get_events()` with pagination and filters
- [ ] Implement `get_unread_event_count()` command
- [ ] Implement `mark_events_read()` command
- [ ] Register log commands in `lib.rs`
- [ ] Add required data-testid attributes: none (backend only)
- [ ] Run test: `pnpm test -- tests/integration/event-log.spec.ts`
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 3 hours

---

### Test: AC2-5 - Scan and Rematch Command

**File:** `tests/integration/auto-rematch.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `scan_and_rematch_channels()` in commands/channels.rs
- [ ] Combine existing scan with auto-rematch logic
- [ ] Call detect_provider_changes() after scan
- [ ] Call auto_rematch_new_streams() for new streams
- [ ] Call handle_removed_streams() for removed streams
- [ ] Log event with change summary
- [ ] Create `ScanAndRematchResponse` type
- [ ] Register command in `lib.rs`
- [ ] Add TypeScript types in `tauri.ts`
- [ ] Add `scanAndRematchChannels()` function
- [ ] Add required data-testid attributes: scan-channels-button
- [ ] Run test: `pnpm test -- tests/integration/auto-rematch.spec.ts`
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 3 hours

---

### Test: AC5.5 - Notification Badge

**File:** `tests/e2e/rematch-notification.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `useUnreadEventCount` hook with TanStack Query
- [ ] Add notification badge to Sidebar Logs nav item
- [ ] Display unread count in badge
- [ ] Style badge with Tailwind CSS
- [ ] Invalidate query on event emission
- [ ] Add required data-testid attributes: logs-nav-item, notification-badge, badge-count
- [ ] Run test: `pnpm test -- tests/e2e/rematch-notification.spec.ts -g "AC5.5"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: AC5.6 - Enhanced Scan Toast

**File:** `tests/e2e/rematch-notification.spec.ts`

**Tasks to make this test pass:**

- [ ] Update Accounts view to call `scanAndRematchChannels()`
- [ ] Update scan result toast to show change summary
- [ ] Display: "Scanned X channels. Y new matches, Z removed, W updated."
- [ ] Add required data-testid attributes: scan-result-toast, change-summary-text
- [ ] Run test: `pnpm test -- tests/e2e/rematch-notification.spec.ts -g "AC5.6"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

## Running Tests

```bash
# Run all failing tests for this story
pnpm test -- tests/integration/auto-rematch.spec.ts tests/integration/event-log.spec.ts tests/e2e/rematch-notification.spec.ts

# Run specific test file
pnpm test -- tests/integration/auto-rematch.spec.ts

# Run specific acceptance criteria
pnpm test -- tests/integration/auto-rematch.spec.ts -g "AC1"

# Run with Tauri backend (for integration tests)
TAURI_DEV=true pnpm test -- tests/integration/auto-rematch.spec.ts

# Debug specific test
pnpm test -- tests/integration/auto-rematch.spec.ts --debug

# Run with headed browser
pnpm test -- tests/e2e/rematch-notification.spec.ts --headed
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All tests written and failing
- ✅ Fixtures and factories created with auto-cleanup
- ✅ Mock requirements documented
- ✅ data-testid requirements listed
- ✅ Implementation checklist created

**Verification:**

- All tests run and fail as expected
- Failure messages are clear and actionable
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (start with AC1: Provider Change Detection)
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
- Mark story as IN PROGRESS in sprint status

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
2. **Review code for quality** (readability, maintainability, performance)
3. **Extract duplications** (DRY principle)
4. **Optimize performance** (batch database operations, reduce N+1 queries)
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

1. **Review this checklist** with team in standup or planning
2. **Run failing tests** to confirm RED phase: `pnpm test -- tests/integration/auto-rematch.spec.ts`
3. **Begin implementation** using implementation checklist as guide
4. **Work one test at a time** (red → green for each)
5. **Share progress** in daily standup
6. **When all tests pass**, refactor code for quality
7. **When refactoring complete**, run code review workflow
8. **After code review**, manually update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **fixture-architecture.md** - Test fixture patterns with setup/teardown and auto-cleanup using Playwright's `test.extend()`
- **data-factories.md** - Factory patterns using `@faker-js/faker` for random test data generation with overrides support
- **network-first.md** - Route interception patterns (intercept BEFORE navigation to prevent race conditions)
- **test-quality.md** - Test design principles (Given-When-Then, one assertion per test, determinism, isolation)
- **test-levels-framework.md** - Test level selection framework (E2E vs API vs Component vs Unit)

See `tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm test -- tests/integration/auto-rematch.spec.ts tests/integration/event-log.spec.ts tests/e2e/rematch-notification.spec.ts`

**Results:**

```
Expected: All 14 tests failing with clear error messages

Integration Tests (8):
- ❌ AC1.1: Command 'detect_provider_changes' not found
- ❌ AC1.2: Command 'detect_provider_changes' not found
- ❌ AC1.3: Command 'detect_provider_changes' not found
- ❌ AC2.1: Command 'scan_and_rematch_channels' not found
- ❌ AC2.2: Command 'scan_and_rematch_channels' not found
- ❌ AC3.1: Command 'scan_and_rematch_channels' not found
- ❌ AC3.2: Command 'scan_and_rematch_channels' not found
- ❌ AC4: Command 'scan_and_rematch_channels' not found

Event Log Tests (4):
- ❌ AC5.1: Table 'event_log' does not exist
- ❌ AC5.2: Command 'get_events' not found
- ❌ AC5.3: Command 'get_unread_event_count' not found
- ❌ AC5.4: Command 'mark_events_read' not found

E2E Tests (2):
- ❌ AC5.5: Element [data-testid="notification-badge"] not found
- ❌ AC5.6: Enhanced scan response not implemented
```

**Summary:**

- Total tests: 14
- Passing: 0 (expected)
- Failing: 14 (expected)
- Status: ✅ RED phase verified

**Expected Failure Messages:**

- Backend: "Unknown command: {command_name}" or "no such table: event_log"
- Frontend: "Element not found" or "Expected property not in response"

---

## Notes

- **Architecture Compliance**: XMLTV channels remain primary; Xtream streams are matched TO XMLTV channels
- **Manual Match Protection**: Critical requirement - manual matches (is_manual=1) are NEVER modified during auto-rematch
- **Event Log Design**: Uses SQLite with indexes for performance; supports pagination for large event histories
- **Performance**: Batch database operations in transactions; avoid N+1 queries with bulk loads
- **Testing Strategy**: Integration tests for business logic; E2E tests only for UI notification features
- **Reuse Existing Code**: Leverages scan_channels(), match_channels(), save_channel_mappings(), remove_stream_mapping()

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Refer to `_bmad-output/implementation-artifacts/3-4-auto-rematch-on-provider-changes.md` for story details
- Consult `_bmad/bmm/testarch/knowledge` for testing best practices

---

**Generated by BMad TEA Agent** - 2026-01-19
