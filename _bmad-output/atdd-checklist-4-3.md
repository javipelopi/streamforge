# ATDD Checklist - Epic 4, Story 4-3: Implement HDHomeRun Emulation

**Date:** 2026-01-20
**Author:** Javier
**Primary Test Level:** Integration (API)

---

## Story Summary

Implement HDHomeRun device emulation to enable Plex auto-discovery. This story adds three HTTP endpoints that make StreamForge appear as an HDHomeRun TV tuner, allowing Plex to automatically discover and add the device without manual URL configuration.

**As a** user
**I want** Plex to auto-discover my tuner
**So that** I don't have to manually enter URLs

---

## Acceptance Criteria

1. **GET /discover.json** returns valid HDHomeRun discovery response with:
   - FriendlyName: "StreamForge"
   - ModelNumber: "HDHR5-4K"
   - TunerCount from Xtream account
   - BaseURL and LineupURL with local IP and port

2. **GET /lineup.json** returns channel lineup with enabled XMLTV channels:
   - GuideName uses XMLTV channel display_name
   - GuideNumber uses plex_display_order
   - URL points to stream endpoint `/stream/{xmltv_channel_id}`

3. **GET /lineup_status.json** returns valid status response indicating no scan in progress

---

## Failing Tests Created (RED Phase)

### Integration Tests (28 tests)

**File:** `tests/integration/hdhr-endpoints.spec.ts` (489 lines)

- ✅ **Test:** should respond to GET /discover.json with 200 OK
  - **Status:** RED - Route not registered, returns 404
  - **Verifies:** AC #1 - Basic endpoint availability

- ✅ **Test:** should return correct Content-Type header for discover.json
  - **Status:** RED - Endpoint not implemented
  - **Verifies:** AC #1 - JSON content type

- ✅ **Test:** should return required HDHomeRun discovery fields
  - **Status:** RED - Response structure missing
  - **Verifies:** AC #1 - All required fields present (FriendlyName, ModelNumber, DeviceID, etc.)

- ✅ **Test:** should use FriendlyName "StreamForge"
  - **Status:** RED - Field not set
  - **Verifies:** AC #1 - Correct device name

- ✅ **Test:** should use ModelNumber "HDHR5-4K"
  - **Status:** RED - Field not set
  - **Verifies:** AC #1 - Correct model number for Plex compatibility

- ✅ **Test:** should return TunerCount from active account max_connections
  - **Status:** RED - Database query not implemented
  - **Verifies:** AC #1 - Dynamic tuner count from database

- ✅ **Test:** should include BaseURL and LineupURL with local IP and port
  - **Status:** RED - URL generation not implemented
  - **Verifies:** AC #1 - URLs use detected IP and configured port

- ✅ **Test:** should respond to GET /lineup.json with 200 OK
  - **Status:** RED - Route not registered, returns 404
  - **Verifies:** AC #2 - Basic endpoint availability

- ✅ **Test:** should return correct Content-Type header for lineup.json
  - **Status:** RED - Endpoint not implemented
  - **Verifies:** AC #2 - JSON content type

- ✅ **Test:** should return enabled XMLTV channels in lineup
  - **Status:** RED - Channel query not implemented
  - **Verifies:** AC #2 - Only enabled channels with streams included

- ✅ **Test:** should use XMLTV display_name for GuideName
  - **Status:** RED - Field mapping not implemented
  - **Verifies:** AC #2 - XMLTV-first architecture (channel names from XMLTV)

- ✅ **Test:** should use plex_display_order for GuideNumber
  - **Status:** RED - Field mapping not implemented
  - **Verifies:** AC #2 - Channel numbers from user configuration

- ✅ **Test:** should generate stream URLs with format /stream/{xmltv_channel_id}
  - **Status:** RED - URL generation not implemented
  - **Verifies:** AC #2 - Stream URL format

- ✅ **Test:** should order channels by plex_display_order ASC
  - **Status:** RED - Query ordering not implemented
  - **Verifies:** AC #2 - Correct channel ordering (matches M3U endpoint)

- ✅ **Test:** should return empty array when no enabled channels
  - **Status:** RED - Empty case not handled
  - **Verifies:** AC #2 - Valid response for empty lineup

- ✅ **Test:** should respond to GET /lineup_status.json with 200 OK
  - **Status:** RED - Route not registered, returns 404
  - **Verifies:** AC #3 - Basic endpoint availability

- ✅ **Test:** should return correct Content-Type header for lineup_status.json
  - **Status:** RED - Endpoint not implemented
  - **Verifies:** AC #3 - JSON content type

- ✅ **Test:** should return ScanInProgress=0 and ScanPossible=0
  - **Status:** RED - Response structure missing
  - **Verifies:** AC #3 - Correct status indicating no scanning capability

- ✅ **Test:** lineup.json should match M3U playlist channels
  - **Status:** RED - Channel query mismatch
  - **Verifies:** Consistency - Same enabled channels in HDHomeRun and M3U

---

## Data Factories Created

### None Required

This story tests HTTP endpoints that query the database but do not require creating test entities. Tests use existing database state from application setup.

**Rationale:** HDHomeRun endpoints are read-only. They query:
- accounts table (for tuner count)
- xmltv_channels + xmltv_channel_settings (for lineup)

Test fixtures from previous stories (accounts, XMLTV channels) provide sufficient data.

---

## Fixtures Created

### None Required

Tests use Playwright's built-in `request` fixture for HTTP API testing. No custom fixtures needed.

**Usage Pattern:**
```typescript
test('should respond to GET /discover.json', async ({ request }) => {
  const response = await request.get(`${BASE_URL}/discover.json`);
  expect(response.status()).toBe(200);
});
```

---

## Mock Requirements

### None Required

**Rationale:** This story implements HTTP endpoints that serve real database data. No external services are involved. Tests run against the actual Tauri app with SQLite database.

---

## Required data-testid Attributes

### None Required

**Rationale:** This story implements backend HTTP API endpoints only. No UI components are involved. Plex directly consumes the JSON endpoints programmatically.

---

## Implementation Checklist

### Test: Discover.json endpoint returns valid HDHomeRun response

**File:** `tests/integration/hdhr-endpoints.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src-tauri/src/server/hdhr.rs` module
- [ ] Define `DiscoverResponse` struct with PascalCase serde serialization
- [ ] Implement `generate_discover_response()` function
- [ ] Query accounts table for max_connections (tuner count)
- [ ] Detect local IP address (use local_ip_address crate or fallback to 127.0.0.1)
- [ ] Generate stable DeviceID based on hostname hash
- [ ] Set hardcoded device info (FriendlyName, ModelNumber, FirmwareVersion)
- [ ] Create `discover_json` handler in `src-tauri/src/server/handlers.rs`
- [ ] Register route: `.route("/discover.json", get(handlers::discover_json))`
- [ ] Add hdhr module export in `src-tauri/src/server/mod.rs`
- [ ] Run test: `TAURI_DEV=true npm run test -- tests/integration/hdhr-endpoints.spec.ts -g "discover"`
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 2-3 hours

---

### Test: Lineup.json endpoint returns enabled channels

**File:** `tests/integration/hdhr-endpoints.spec.ts`

**Tasks to make this test pass:**

- [ ] Define `LineupEntry` struct with PascalCase serde serialization
- [ ] Implement `generate_lineup()` function in `src-tauri/src/server/hdhr.rs`
- [ ] Reuse channel query from M3U endpoint (enabled XMLTV channels with streams)
- [ ] Query xmltv_channels + xmltv_channel_settings with JOIN
- [ ] Order by plex_display_order ASC NULLS LAST
- [ ] Map to LineupEntry: GuideNumber (plex_display_order as string), GuideName (display_name), URL (stream endpoint)
- [ ] Handle null plex_display_order (use channel index as fallback)
- [ ] Handle empty lineup (return empty JSON array `[]`)
- [ ] Create `lineup_json` handler in `src-tauri/src/server/handlers.rs`
- [ ] Register route: `.route("/lineup.json", get(handlers::lineup_json))`
- [ ] Run test: `TAURI_DEV=true npm run test -- tests/integration/hdhr-endpoints.spec.ts -g "lineup"`
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 2-3 hours

---

### Test: Lineup_status.json endpoint returns static status

**File:** `tests/integration/hdhr-endpoints.spec.ts`

**Tasks to make this test pass:**

- [ ] Define `LineupStatusResponse` struct with PascalCase serde serialization
- [ ] Implement `generate_lineup_status()` function (returns static response)
- [ ] Set ScanInProgress=0, ScanPossible=0, Source="Cable"
- [ ] Create `lineup_status_json` handler in `src-tauri/src/server/handlers.rs`
- [ ] Register route: `.route("/lineup_status.json", get(handlers::lineup_status_json))`
- [ ] Run test: `TAURI_DEV=true npm run test -- tests/integration/hdhr-endpoints.spec.ts -g "status"`
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 30 minutes - 1 hour

---

### Test: Consistency - lineup.json matches M3U playlist

**File:** `tests/integration/hdhr-endpoints.spec.ts`

**Tasks to make this test pass:**

- [ ] Verify both endpoints use the same channel query
- [ ] Consider extracting shared `get_enabled_channels()` function to avoid query divergence
- [ ] Run test: `TAURI_DEV=true npm run test -- tests/integration/hdhr-endpoints.spec.ts -g "match M3U"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

## Running Tests

```bash
# Run all HDHomeRun integration tests
TAURI_DEV=true npm run test -- tests/integration/hdhr-endpoints.spec.ts

# Run specific test group
TAURI_DEV=true npm run test -- tests/integration/hdhr-endpoints.spec.ts -g "discover"

# Run tests in headed mode (see browser, though no browser for API tests)
TAURI_DEV=true npm run test -- tests/integration/hdhr-endpoints.spec.ts --headed

# Debug specific test
TAURI_DEV=true npm run test -- tests/integration/hdhr-endpoints.spec.ts -g "lineup" --debug

# Run with Playwright Inspector
PWDEBUG=1 TAURI_DEV=true npm run test -- tests/integration/hdhr-endpoints.spec.ts
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All tests written and failing
- ✅ Test structure follows existing integration test patterns
- ✅ Given-When-Then format used throughout
- ✅ Tests verify JSON structure and field values
- ✅ Consistency tests ensure alignment with M3U/EPG endpoints

**Verification:**

- All 19 integration tests fail with 404 Not Found (routes not registered)
- Test failure messages are clear: "Expected 200, received 404"
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Start with discover.json endpoint** (simplest, no database queries yet)
   - Create hdhr.rs module with DiscoverResponse struct
   - Implement generate_discover_response function with hardcoded values
   - Add route and handler
   - Run tests to verify green

2. **Implement lineup_status.json** (second simplest, static response)
   - Add LineupStatusResponse struct
   - Implement generate_lineup_status function
   - Add route and handler
   - Run tests to verify green

3. **Implement lineup.json** (most complex, database queries)
   - Add LineupEntry struct
   - Implement generate_lineup function with database query
   - Reuse M3U channel query logic
   - Handle empty lineup case
   - Add route and handler
   - Run tests to verify green

4. **Verify consistency test passes**
   - Ensure lineup.json and M3U playlist return same channels
   - Consider refactoring shared query logic

**Key Principles:**

- One test at a time (immediate feedback from failing tests)
- Minimal implementation (don't over-engineer)
- Run tests frequently (verify green before moving on)
- Use implementation checklist as roadmap

**Progress Tracking:**

- Check off tasks as you complete them
- Share progress in daily standup
- Mark story as IN PROGRESS in sprint-status.yaml

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Review code for quality**
   - Consistent error handling across all three endpoints
   - Proper logging for debugging
   - Clear struct naming and field mapping

2. **Extract shared channel query** (if not done already)
   - Create `get_enabled_channels()` function shared by M3U, EPG, and HDHR
   - Prevents query divergence bugs

3. **Optimize performance** (if needed)
   - Database query performance (already optimized in M3U endpoint)
   - IP detection caching (avoid repeated lookups)

4. **Ensure tests still pass** after each refactor

5. **Update documentation**
   - Add HDHomeRun endpoints to API documentation
   - Document DeviceID generation strategy

**Key Principles:**

- Tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if tests fail)
- Run tests after each change
- Don't change test behavior (only implementation)

**Completion:**

- All 19 integration tests pass
- Code quality meets team standards
- Shared query logic extracted to prevent divergence
- Ready for code review and story approval

---

## Next Steps

1. **Review this checklist** with team in standup or planning
2. **Run failing tests** to confirm RED phase: `TAURI_DEV=true npm run test -- tests/integration/hdhr-endpoints.spec.ts`
3. **Begin implementation** using implementation checklist as guide
4. **Work one test group at a time** (discover → status → lineup → consistency)
5. **Share progress** in daily standup
6. **When all tests pass**, refactor code for quality
7. **When refactoring complete**, run `/bmad:bmm:workflows:code-review` for adversarial review
8. **After code review passes**, manually update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **fixture-architecture.md** - Pure function → fixture patterns (not needed for API-only tests)
- **data-factories.md** - Factory patterns with faker (not needed, using existing DB state)
- **test-quality.md** - Test design principles (Given-When-Then, deterministic, isolated)
- **network-first.md** - Route interception patterns (not applicable for direct API requests)
- **test-levels-framework.md** - Integration test level selected for HTTP API contracts

**Rationale for Integration Tests:**
- Tests validate HTTP endpoints (API contracts)
- No UI interaction required
- Fast execution (direct HTTP requests, no browser)
- Stable (no UI flakiness)
- Validates database integration

See `_bmad/bmm/testarch/tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `TAURI_DEV=true npm run test -- tests/integration/hdhr-endpoints.spec.ts`

**Results:**

```
Running 28 tests using 4 workers

  ✘ HDHomeRun Endpoints - Discover.json (8 tests)
    ✘ should respond to GET /discover.json with 200 OK
    ✘ should return correct Content-Type header for discover.json
    ✘ should return required HDHomeRun discovery fields
    ✘ should use FriendlyName "StreamForge"
    ✘ should use ModelNumber "HDHR5-4K"
    ✘ should return TunerCount from active account max_connections
    ✘ should include BaseURL and LineupURL with local IP and port
    ✘ should return stable DeviceID across requests

  ✘ HDHomeRun Endpoints - Lineup.json (10 tests)
    ✘ should respond to GET /lineup.json with 200 OK
    ✘ should return correct Content-Type header for lineup.json
    ✘ should return array of channel entries
    ✘ should return only enabled XMLTV channels in lineup
    ✘ should use XMLTV display_name for GuideName
    ✘ should use plex_display_order for GuideNumber
    ✘ should generate stream URLs with format /stream/{xmltv_channel_id}
    ✘ should order channels by plex_display_order ASC
    ✘ should return empty array when no enabled channels exist
    ✘ should handle null plex_display_order gracefully

  ✘ HDHomeRun Endpoints - Lineup_status.json (5 tests)
    ✘ should respond to GET /lineup_status.json with 200 OK
    ✘ should return correct Content-Type header for lineup_status.json
    ✘ should return required lineup status fields
    ✘ should return ScanInProgress=0 and ScanPossible=0
    ✘ should return Source="Cable" and SourceList=["Cable"]

  ✘ HDHomeRun Endpoints - Consistency (2 tests)
    ✘ lineup.json should match M3U playlist channels
    ✘ lineup.json channel order should match M3U playlist order

  ✘ HDHomeRun Endpoints - Error Handling (3 tests)
    ✘ discover.json should handle database errors gracefully
    ✘ lineup.json should handle database errors gracefully
    ✘ should return valid UTF-8 encoded JSON

  28 failed
  Finished in 12.1s
```

**Summary:**

- Total tests: 28
- Passing: 0 (expected)
- Failing: 28 (expected)
- Status: ✅ RED phase verified

**Expected Failure Messages:**
- All tests fail with: `Expected status 200, received 404`
- Root cause: Routes `/discover.json`, `/lineup.json`, `/lineup_status.json` not registered in Axum router
- This is expected RED phase behavior - tests fail due to missing implementation

---

## Notes

### XMLTV-First Architecture Consistency

**CRITICAL:** The HDHomeRun lineup MUST serve the same enabled XMLTV channels as the M3U playlist and EPG endpoints. This ensures Plex sees consistent channel data across all integration points.

**Channel Query Consistency:**
- Same enabled channel filter: `xmltv_channel_settings.is_enabled = 1`
- Same stream mapping requirement: `EXISTS (SELECT 1 FROM channel_mappings WHERE xmltv_channel_id = ...)`
- Same ordering: `plex_display_order ASC NULLS LAST, display_name ASC`

**Consider Shared Query Function:**
```rust
// src-tauri/src/server/channels.rs (new file)
pub fn get_enabled_channels(conn: &mut SqliteConnection) -> Result<Vec<EnabledChannel>> {
    // Shared query used by M3U, EPG, and HDHR
    // Prevents query divergence bugs
}
```

### Local IP Detection Strategy

The `local_ip_address` crate provides automatic IP detection. Fallback to 127.0.0.1 for local-only setups ensures the endpoint always returns valid URLs.

### DeviceID Stability

DeviceID should be stable across restarts so Plex doesn't treat the tuner as a new device each time. Use hostname hash or generate/persist a UUID on first launch.

### Stream Endpoint Forward Compatibility

Stream URLs use format `/stream/{xmltv_channel_id}`. This endpoint doesn't exist yet (Story 4-4) but using this format now ensures forward compatibility when the stream proxy is implemented.

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Tag @TEA Agent in Slack/Discord
- Refer to `_bmad/bmm/docs/tea-README.md` for workflow documentation
- Consult `_bmad/bmm/testarch/knowledge` for testing best practices

---

**Generated by BMad TEA Agent** - 2026-01-20
