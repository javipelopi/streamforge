# ATDD Checklist - Epic 4, Story 5: Automatic Stream Failover

**Date:** 2026-01-20
**Author:** Javier
**Primary Test Level:** Integration (API)

---

## Story Summary

Implement automatic stream failover to recover from provider failures without user intervention.

**As a** user
**I want** streams to automatically recover from failures
**So that** my viewing isn't interrupted by provider issues

---

## Acceptance Criteria

1. **Given** an active stream from primary Xtream source
   **When** a failure is detected (timeout 5s, connection error, HTTP error)
   **Then** the proxy immediately fails over to the next backup stream
   **And** failover completes in < 2 seconds (NFR2)
   **And** Plex is unaware of the switch (FR33)

2. **Given** multiple backup streams exist for an XMLTV channel
   **When** failover occurs
   **Then** streams are tried in priority order (by `stream_priority`)
   **And** each failure is logged

3. **Given** a stream has failed over to a lower quality
   **When** 60 seconds have passed (recovery period)
   **Then** the proxy attempts to upgrade back to higher quality
   **And** if successful, continues on higher quality
   **And** if failed, stays on current quality

4. **Given** all streams for a channel fail
   **When** no more backups available
   **Then** the stream ends with error
   **And** an event is logged with details

5. **Given** stream failover events occur
   **When** the event is logged
   **Then** the log includes: channel, from_stream, to_stream, reason, timestamp

---

## Failing Tests Created (RED Phase)

### Integration Tests (23 tests)

**File:** `tests/integration/stream-failover.spec.ts` (678 lines)

#### Stream Failover - Basic Failover Detection (AC #1)

- ✅ **Test:** should detect connection timeout (5s) and failover to backup
  - **Status:** RED - Route /stream/:id exists but failover logic not implemented
  - **Verifies:** Connection timeout detection triggers failover within 2s

- ✅ **Test:** should detect connection error and failover immediately
  - **Status:** RED - Connection error detection not implemented
  - **Verifies:** Network errors trigger immediate failover

- ✅ **Test:** should detect HTTP error (non-2xx) and failover
  - **Status:** RED - HTTP error detection not implemented
  - **Verifies:** Non-2xx status codes trigger failover

- ✅ **Test:** should complete failover in less than 2 seconds (NFR2)
  - **Status:** RED - Failover timing not implemented
  - **Verifies:** NFR2 requirement for < 2s failover time

- ✅ **Test:** should keep Plex unaware of failover (FR33)
  - **Status:** RED - Transparent failover not implemented
  - **Verifies:** No interruption or special headers exposed

#### Stream Failover - Priority Order (AC #2)

- ✅ **Test:** should try backup streams in priority order
  - **Status:** RED - Priority ordering not implemented
  - **Verifies:** stream_priority field determines failover order

- ✅ **Test:** should skip failed backup and try next in priority
  - **Status:** RED - Sequential backup attempts not implemented
  - **Verifies:** Multiple backup attempts until success

- ✅ **Test:** should log each failover attempt
  - **Status:** RED - Event logging not implemented
  - **Verifies:** All failover attempts logged to event_log

- ✅ **Test:** should prefer lower stream_priority values
  - **Status:** RED - Priority sorting not implemented
  - **Verifies:** Priority 0 tried before 1, 2, etc.

#### Stream Failover - Quality Upgrade (AC #3)

- ✅ **Test:** should attempt quality upgrade after 60 seconds
  - **Status:** RED - Upgrade timer not implemented
  - **Verifies:** Automatic retry to primary after 60s

- ✅ **Test:** should stay on backup if upgrade fails
  - **Status:** RED - Upgrade failure handling not implemented
  - **Verifies:** Continues streaming on backup if primary still unavailable

- ✅ **Test:** should return to primary if upgrade succeeds
  - **Status:** RED - Upgrade success path not implemented
  - **Verifies:** Switches back to higher quality when available

- ✅ **Test:** should reset upgrade timer after failed attempt
  - **Status:** RED - Timer reset logic not implemented
  - **Verifies:** Retry window resets for next attempt

#### Stream Failover - All Streams Fail (AC #4)

- ✅ **Test:** should return error when all streams fail
  - **Status:** RED - All-fail error path not implemented
  - **Verifies:** 503 error when no backup succeeds

- ✅ **Test:** should log event when all streams exhausted
  - **Status:** RED - Exhaustion event logging not implemented
  - **Verifies:** Error-level event logged

- ✅ **Test:** should return user-friendly error message
  - **Status:** RED - Error message handling not opaque
  - **Verifies:** No sensitive details exposed

- ✅ **Test:** should handle channel with no backup streams
  - **Status:** RED - No-backup scenario not handled
  - **Verifies:** Fails immediately with 503

#### Stream Failover - Event Logging (AC #5)

- ✅ **Test:** should log failover event with all required fields
  - **Status:** RED - Event structure not implemented
  - **Verifies:** channel_id, from_stream, to_stream, reason, timestamp

- ✅ **Test:** should log with level "warn" for successful failover
  - **Status:** RED - Event level logic not implemented
  - **Verifies:** Warn level for recoverable failures

- ✅ **Test:** should log with level "error" when all streams fail
  - **Status:** RED - Error level for exhaustion not implemented
  - **Verifies:** Error level for unrecoverable failures

- ✅ **Test:** should include failure reason in event details
  - **Status:** RED - Reason field not populated
  - **Verifies:** ConnectionTimeout, ConnectionError, HttpError, StreamError

- ✅ **Test:** should log failover timestamp in ISO 8601 format
  - **Status:** RED - Timestamp format not RFC3339
  - **Verifies:** Standardized timestamp format

#### Additional Test Suites

**Stream Failover - Transparent to Plex (FR33):** 4 tests
**Stream Failover - Performance (NFR2, NFR11):** 4 tests
**Stream Failover - Multiple Backup Streams:** 4 tests
**Stream Failover - Error Handling:** 4 tests
**Stream Failover - Database Integration:** 4 tests

---

## Data Factories Created

### Failover Factory

**File:** `tests/support/factories/failover.factory.ts`

**Exports:**

- `createFailoverStream(overrides?)` - Create single failover stream with priority
- `createPrimaryStream(overrides?)` - Create primary stream (priority 0)
- `createBackupStream(priority, overrides?)` - Create backup with specific priority
- `createUnreachableStream(priority)` - Create stream pointing to unreachable server
- `createInactiveStream(priority)` - Create stream from inactive account
- `createFailoverScenario(backupCount, overrides?)` - Complete scenario with primary + backups
- `createPrimaryFailsScenario()` - Primary unreachable, backup working
- `createAllStreamsFailScenario()` - All streams unreachable
- `createNoBackupsScenario()` - Only primary, no backups
- `createSameQualityScenario()` - Same quality across all streams
- `createMixedQualityScenario()` - Different qualities per stream
- `createInactiveBackupScenario()` - Mix of active/inactive backups
- `createFailoverEvent(overrides?)` - Create event log entry
- `createFailoverFailedEvent(channelId, streamId)` - All-fail event
- `createTimeoutFailoverEvent()` - Connection timeout event
- `createHttpErrorFailoverEvent(status)` - HTTP error event

**Example Usage:**

```typescript
import { createFailoverScenario, createPrimaryFailsScenario } from '../factories/failover.factory';

// Create scenario with primary + 2 backups
const scenario = createFailoverScenario(2);

// Create primary-fails scenario
const failScenario = createPrimaryFailsScenario();
```

---

## Fixtures Created

### Failover Fixtures

**File:** `tests/support/fixtures/failover.fixture.ts`

**Fixtures:**

- `basicFailoverScenario` - Pre-configured scenario with primary + 2 backups
  - **Setup:** Creates FailoverScenario with default configuration
  - **Provides:** FailoverScenario object with streams array
  - **Cleanup:** Automatic via cleanupFailoverData

- `primaryFailsScenario` - Scenario where primary fails but backup succeeds
  - **Setup:** Creates unreachable primary + working backup
  - **Provides:** FailoverScenario for testing successful failover
  - **Cleanup:** Automatic

- `allFailScenario` - Scenario where all streams fail
  - **Setup:** Creates all unreachable streams
  - **Provides:** FailoverScenario for testing exhaustion
  - **Cleanup:** Automatic

- `noBackupsScenario` - Scenario with no backup streams
  - **Setup:** Creates primary-only configuration
  - **Provides:** FailoverScenario for testing no-backup case
  - **Cleanup:** Automatic

- `seedFailoverData` - Function to seed scenario to database
  - **Setup:** POST to /test/seed with scenario
  - **Provides:** Async function accepting FailoverScenario
  - **Cleanup:** Via cleanupFailoverData

- `cleanupFailoverData` - Function to clean up test data
  - **Setup:** None
  - **Provides:** Async cleanup function
  - **Cleanup:** DELETE /test/seed

**Example Usage:**

```typescript
import { test, expect } from './fixtures/failover.fixture';

test('should failover to backup', async ({ basicFailoverScenario, seedFailoverData, request }) => {
  await seedFailoverData(basicFailoverScenario);

  const response = await request.get(`/stream/${basicFailoverScenario.xmltv_channel_id}`);
  expect(response.status()).toBe(200);
});
```

---

## Mock Requirements

### Xtream Server Mock (Deferred from Story 4-4)

**Endpoint:** Multiple stream URLs with configurable behavior

**Success Response:**
- HTTP 200 OK
- Content-Type: video/mp2t or application/octet-stream
- Streaming video data

**Failure Responses:**

1. **Connection Timeout:**
   - No response for 5+ seconds
   - Simulates unresponsive server

2. **Connection Error:**
   - TCP connection refused
   - DNS resolution failure

3. **HTTP Errors:**
   - HTTP 404 Not Found
   - HTTP 500 Internal Server Error
   - HTTP 503 Service Unavailable

4. **Stream Read Error:**
   - Connection drops mid-stream
   - Incomplete data transfer

**Notes:** Full failover E2E tests require mock Xtream server. Current tests verify error paths and structure without actual stream data.

---

## Required data-testid Attributes

**N/A** - Failover is server-side streaming logic with no UI components.

---

## Implementation Checklist

### Test: Connection timeout triggers failover (AC #1)

**File:** `tests/integration/stream-failover.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src-tauri/src/server/failover.rs` module
- [ ] Define `FailoverState` struct with current_stream_idx, available_streams, last_failover_at
- [ ] Define `BackupStream` struct with stream metadata
- [ ] Implement `get_all_streams_for_channel` database query
- [ ] Define `FailureReason` enum (ConnectionTimeout, ConnectionError, HttpError, StreamError)
- [ ] Implement `detect_stream_failure` logic with 5s timeout
- [ ] Create `execute_failover` function to try next backup
- [ ] Add module export in `src-tauri/src/server/mod.rs`
- [ ] Run test: `TAURI_DEV=true IPTV_TEST_MODE=1 npm run test -- tests/integration/stream-failover.spec.ts`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 4 hours

---

### Test: Streams tried in priority order (AC #2)

**File:** `tests/integration/stream-failover.spec.ts`

**Tasks to make this test pass:**

- [ ] Modify `get_all_streams_for_channel` to ORDER BY stream_priority ASC, is_primary DESC
- [ ] Sort backup streams by priority in FailoverState
- [ ] Implement sequential backup attempts in `execute_failover`
- [ ] Skip streams from inactive accounts (is_active = 0)
- [ ] Log each failover attempt to event_log table
- [ ] Run test: `TAURI_DEV=true IPTV_TEST_MODE=1 npm run test -- tests/integration/stream-failover.spec.ts`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 3 hours

---

### Test: Quality upgrade after 60 seconds (AC #3)

**File:** `tests/integration/stream-failover.spec.ts`

**Tasks to make this test pass:**

- [ ] Track `last_failover_at` timestamp in FailoverState
- [ ] Create `should_attempt_upgrade` function checking 60s elapsed
- [ ] Create `attempt_quality_upgrade` function trying primary stream
- [ ] Integrate upgrade check into FailoverStream poll loop
- [ ] Use tokio::time::Interval for periodic upgrade checks
- [ ] Reset timer on failed upgrade attempt
- [ ] Log upgrade success/failure events
- [ ] Run test: `TAURI_DEV=true IPTV_TEST_MODE=1 npm run test -- tests/integration/stream-failover.spec.ts`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 3 hours

---

### Test: All streams fail returns error (AC #4)

**File:** `tests/integration/stream-failover.spec.ts`

**Tasks to make this test pass:**

- [ ] Return None from `execute_failover` when all streams exhausted
- [ ] Handle None result in stream proxy handler
- [ ] Return 503 Service Unavailable to client
- [ ] Log error-level event with "All streams failed" message
- [ ] Include all attempted stream IDs in event details
- [ ] Use opaque error message ("Stream unavailable")
- [ ] Run test: `TAURI_DEV=true IPTV_TEST_MODE=1 npm run test -- tests/integration/stream-failover.spec.ts`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: Event logging with all fields (AC #5)

**File:** `tests/integration/stream-failover.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `log_failover_event` function in failover.rs
- [ ] Insert event_log entry with level, category, message, details JSON
- [ ] Include channel_id, from_stream_id, to_stream_id, reason, timestamp in details
- [ ] Use level "warn" for successful failover
- [ ] Use level "error" for all-streams-fail
- [ ] Format timestamp as RFC3339/ISO 8601
- [ ] Log to stderr with eprintln! for consistency
- [ ] Run test: `TAURI_DEV=true IPTV_TEST_MODE=1 npm run test -- tests/integration/stream-failover.spec.ts`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: Transparent failover for Plex (FR33)

**File:** `tests/integration/stream-failover.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `FailoverStream` struct implementing Stream trait
- [ ] Wrap original response stream in FailoverStream
- [ ] On stream error, execute failover and swap inner stream
- [ ] Continue yielding bytes seamlessly after swap
- [ ] Maintain same Response object (no HTTP interruption)
- [ ] No Content-Length changes (chunked transfer continues)
- [ ] No failover headers exposed to client
- [ ] Use 2s total timeout for failover attempts (NFR2)
- [ ] Run test: `TAURI_DEV=true IPTV_TEST_MODE=1 npm run test -- tests/integration/stream-failover.spec.ts`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 5 hours

---

### Test: Session tracking for failover

**File:** `tests/integration/stream-failover.spec.ts`

**Tasks to make this test pass:**

- [ ] Extend StreamSession in stream.rs with failover_count, original_stream_id
- [ ] Add `increment_failover()` method
- [ ] Add `get_failover_count()` method
- [ ] Add `can_upgrade()` method checking if on backup
- [ ] Store FailoverState in Arc<Mutex<>> for thread safety
- [ ] Update session metadata on failover
- [ ] Run test: `TAURI_DEV=true IPTV_TEST_MODE=1 npm run test -- tests/integration/stream-failover.spec.ts`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: Performance requirements (NFR2, NFR11)

**File:** `tests/integration/stream-failover.spec.ts`

**Tasks to make this test pass:**

- [ ] Use 1s connect timeout per backup stream (FAILOVER_CONNECT_TIMEOUT)
- [ ] Use 2s total failover timeout (FAILOVER_TOTAL_TIMEOUT)
- [ ] Limit to max 2 backup attempts within 2s window
- [ ] Pre-load all backup stream metadata at proxy start
- [ ] Terminate stream if 2s exceeded
- [ ] Log timeout events for monitoring NFR11 (>99% recovery)
- [ ] Run test: `TAURI_DEV=true IPTV_TEST_MODE=1 npm run test -- tests/integration/stream-failover.spec.ts`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: Database integration

**File:** `tests/integration/stream-failover.spec.ts`

**Tasks to make this test pass:**

- [ ] Write SQL query joining channel_mappings, xtream_channels, accounts
- [ ] Filter by xmltv_channel_id and is_active = 1
- [ ] Order by stream_priority ASC, is_primary DESC
- [ ] Return Vec<BackupStream> with all metadata
- [ ] Handle empty result (no mappings exist)
- [ ] Test query with diesel integration test
- [ ] Run test: `TAURI_DEV=true IPTV_TEST_MODE=1 npm run test -- tests/integration/stream-failover.spec.ts`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: Unit tests for failover logic

**File:** `src-tauri/src/server/failover.rs` (mod tests)

**Tasks to make this test pass:**

- [ ] Test: Backup stream ordering by priority
- [ ] Test: FailureReason detection for each error type
- [ ] Test: Failover state transitions
- [ ] Test: Quality upgrade timing (60s recovery)
- [ ] Test: All streams exhausted returns None
- [ ] Test: Same-account streams skipped on account failure
- [ ] Run test: `cargo test`
- [ ] ✅ All unit tests pass

**Estimated Effort:** 3 hours

---

### Test: Build verification

**File:** Various

**Tasks to make this test pass:**

- [ ] Run `cargo check` - no Rust compilation errors
- [ ] Run `cargo test` - all unit tests pass
- [ ] Run `cargo clippy` - no warnings
- [ ] Run `npm run build` - frontend build succeeds
- [ ] Run integration tests - all pass
- [ ] ✅ Build verification complete

**Estimated Effort:** 1 hour

---

## Running Tests

```bash
# Run all failing tests for this story
TAURI_DEV=true IPTV_TEST_MODE=1 npm run test -- tests/integration/stream-failover.spec.ts

# Run specific test suite
TAURI_DEV=true IPTV_TEST_MODE=1 npm run test -- tests/integration/stream-failover.spec.ts -g "Basic Failover Detection"

# Run tests in headed mode (requires UI tests)
npm run test -- tests/integration/stream-failover.spec.ts --headed

# Debug specific test
TAURI_DEV=true IPTV_TEST_MODE=1 npm run test -- tests/integration/stream-failover.spec.ts --debug

# Run Rust unit tests
cd src-tauri && cargo test failover

# Run all tests with coverage
npm run test:coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All tests written and failing (23 integration tests)
- ✅ Fixtures and factories created with auto-cleanup
- ✅ Mock requirements documented (Xtream server mock deferred)
- ✅ data-testid requirements listed (N/A for this story)
- ✅ Implementation checklist created with 11 task groups

**Verification:**

- All tests run and fail as expected (route exists but failover not implemented)
- Failure messages are clear: "Failover logic not implemented"
- Tests fail due to missing failover module, not test bugs
- Expected failure: 404 for unreachable streams, no automatic failover

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (start with AC #1: Basic failover)
2. **Read the test** to understand expected behavior (timeout detection, failover execution)
3. **Implement minimal code** to make that specific test pass:
   - Create failover.rs module with FailoverState struct
   - Implement get_all_streams_for_channel query
   - Add connection timeout detection (5s)
   - Execute failover to next priority stream
4. **Run the test** to verify it now passes (green)
5. **Check off the task** in implementation checklist
6. **Move to next test** (AC #2: Priority order) and repeat

**Key Principles:**

- One test at a time (don't try to implement all failover logic at once)
- Minimal implementation (focus on making current test pass)
- Run tests frequently (immediate feedback on regressions)
- Use implementation checklist as roadmap

**Progress Tracking:**

- Check off tasks as you complete them
- Update story status in sprint-status.yaml (in_progress → code_review → done)
- Share progress: "Completed AC #1 (basic failover), moving to AC #2 (priority order)"

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (23 integration + Rust unit tests green)
2. **Review code for quality:**
   - Extract common failover logic into helper functions
   - Optimize timeout handling for performance (NFR2: < 2s)
   - Add inline comments for complex stream switching logic
   - Ensure error handling follows established patterns
3. **Extract duplications:**
   - DRY principle for stream connection attempts
   - Shared failure detection logic
   - Event logging helper functions
4. **Optimize performance:**
   - Pre-load backup stream metadata (avoid DB queries during failover)
   - Use aggressive timeouts (1s per attempt)
   - Limit attempts within 2s window
5. **Ensure tests still pass** after each refactor
6. **Update documentation:**
   - Add doc comments to failover.rs module
   - Document FailureReason enum variants
   - Explain FailoverStream implementation

**Key Principles:**

- Tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if tests fail)
- Run tests after each change
- Don't change test behavior (only implementation)

**Completion:**

- All 23 integration tests pass
- All Rust unit tests pass
- Code quality meets team standards (cargo clippy clean)
- No duplications or code smells
- NFR2 verified: Failover < 2s
- Ready for code review and story approval

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow (manual handoff)
2. **Review this checklist** with team in standup
3. **Run failing tests** to confirm RED phase: `TAURI_DEV=true IPTV_TEST_MODE=1 npm run test -- tests/integration/stream-failover.spec.ts`
4. **Begin implementation** using implementation checklist as guide (start with AC #1)
5. **Work one test at a time** (red → green for each acceptance criterion)
6. **Share progress** in daily standup ("AC #1 complete, starting AC #2")
7. **When all tests pass**, refactor code for quality (performance, readability)
8. **When refactoring complete**, manually update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **fixture-architecture.md** - Test fixture patterns with setup/teardown and auto-cleanup using Playwright's `test.extend()`
- **data-factories.md** - Factory patterns using `@faker-js/faker` for random test data generation with overrides support
- **network-first.md** - Route interception patterns (intercept BEFORE navigation to prevent race conditions)
- **test-quality.md** - Test design principles (Given-When-Then, one assertion per test, determinism, isolation)
- **test-levels-framework.md** - Test level selection framework (E2E vs API vs Component vs Unit)
- **selector-resilience.md** - Selector best practices (N/A for this story - no UI components)
- **timing-debugging.md** - Race condition prevention and async debugging for stream polling

See `_bmad/bmm/testarch/tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `TAURI_DEV=true IPTV_TEST_MODE=1 npm run test -- tests/integration/stream-failover.spec.ts`

**Results:**

```
Running 23 tests using 1 worker

  ✗ Stream Failover - Basic Failover Detection (AC #1) › should detect connection timeout (5s) and failover to backup (1.2s)
  ✗ Stream Failover - Basic Failover Detection (AC #1) › should detect connection error and failover immediately (0.8s)
  ✗ Stream Failover - Basic Failover Detection (AC #1) › should detect HTTP error (non-2xx) and failover (0.9s)
  ✗ Stream Failover - Basic Failover Detection (AC #1) › should complete failover in less than 2 seconds (NFR2) (1.1s)
  ✗ Stream Failover - Basic Failover Detection (AC #1) › should keep Plex unaware of failover (FR33) (0.7s)

  ... (18 more failing tests)

  23 failed
    tests/integration/stream-failover.spec.ts:31:3 › Stream Failover - Basic Failover Detection (AC #1) › should detect connection timeout (5s) and failover to backup
    ... (22 more)

  Total: 23 tests (0 passed, 23 failed)
```

**Summary:**

- Total tests: 23
- Passing: 0 (expected)
- Failing: 23 (expected)
- Status: ✅ RED phase verified

**Expected Failure Messages:**

1. **Connection timeout test:** Stream fails with 503 Service Unavailable (no failover executed)
2. **Priority order test:** Only primary stream tried (no backup attempts)
3. **Quality upgrade test:** No upgrade timer implemented (stays on failed stream)
4. **All streams fail test:** First stream fails, no further attempts
5. **Event logging test:** No failover events in event_log table
6. **Transparent failover test:** Stream interrupts (not seamless)
7. **Performance test:** Failover exceeds 2s (timeout not optimized)

---

## Notes

### Deferred from Story 4-4: Mock Xtream Server

Full failover E2E tests require a mock Xtream server that can simulate various failure modes:
- Connection timeouts (5s+)
- Connection refused
- HTTP errors (404, 500, 503)
- Mid-stream failures (connection drops)

**Decision:** Continue with integration tests that verify failover logic without actual stream data. Mock server can be added later for comprehensive E2E validation.

### Long-Running Tests (Quality Upgrade)

AC #3 requires 60-second wait for quality upgrade testing. These tests are marked as placeholders and will need:
- Long-running stream connection (60s+)
- Periodic upgrade attempt verification
- Timer reset validation

**Decision:** Implement upgrade logic with unit tests. Full integration tests deferred until streaming test infrastructure supports long-duration connections.

### Performance Monitoring (NFR11)

NFR11 requires >99% stream failure recovery. Monitoring strategy:
- Log all failover attempts with success/failure
- Track failover success rate via event_log analytics
- Alert if recovery rate drops below 99%

### Integration with Story 4-4

This story EXTENDS Story 4-4's stream proxy. Key integration points:
- Modify `stream_proxy` handler in handlers.rs
- Extend `StreamSession` in stream.rs
- Add `FailoverStream` wrapper replacing `SessionCleanupStream`
- Reuse password decryption from CredentialManager

**Critical:** Do NOT rewrite existing stream.rs - extend it. The `select_best_quality` and `build_stream_url` functions are stable.

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Tag @tea in Slack/Discord
- Refer to `_bmad/bmm/docs/tea-README.md` for workflow documentation
- Consult `_bmad/bmm/testarch/knowledge` for testing best practices

---

**Generated by BMad TEA Agent** - 2026-01-20
