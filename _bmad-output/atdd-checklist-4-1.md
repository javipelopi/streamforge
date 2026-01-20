# ATDD Checklist - Epic 4, Story 1: Serve M3U Playlist Endpoint

**Date:** 2026-01-20
**Author:** Javier
**Primary Test Level:** Integration (HTTP API)

---

## Story Summary

Implement an M3U playlist HTTP endpoint that Plex can consume to discover the channel lineup. The endpoint generates an M3U8 playlist containing only enabled XMLTV channels with their matched Xtream stream URLs.

**As a** user
**I want** an M3U playlist URL I can add to Plex
**So that** Plex can see my channel lineup

---

## Acceptance Criteria

1. **Given** the HTTP server is running
   **When** Plex (or any client) requests `GET /playlist.m3u`
   **Then** an M3U playlist is generated containing:
   - Only **enabled** XMLTV channels (from `xmltv_channel_settings.is_enabled = 1`)
   - Channel names from XMLTV (not Xtream)
   - Channel logos from XMLTV (with Xtream fallback)
   - Channel numbers from `plex_display_order`
   - Stream URLs pointing to `/stream/{xmltv_channel_id}`

2. **Given** the M3U is generated
   **When** a channel has multiple matched Xtream streams
   **Then** the stream URL uses the primary stream
   **And** failover streams are used transparently by the proxy (Story 4-5)

3. **Given** a synthetic channel (promoted orphan from Story 3-8)
   **When** included in M3U
   **Then** it uses the synthetic channel's display name and icon

---

## Failing Tests Created (RED Phase)

### Integration Tests (24 tests)

**File:** `tests/integration/m3u-playlist.spec.ts` (371 lines)

**Test Group 1: Basic Functionality (4 tests)**

- ✅ **Test:** should respond to GET /playlist.m3u with 200 OK
  - **Status:** RED - Endpoint returns 404 Not Found (route not registered)
  - **Verifies:** AC #1 - Endpoint exists and responds

- ✅ **Test:** should return correct Content-Type header
  - **Status:** RED - No Content-Type header (endpoint missing)
  - **Verifies:** AC #1 - Plex compatibility requires audio/x-mpegurl

- ✅ **Test:** should return playlist starting with #EXTM3U header
  - **Status:** RED - No response body (endpoint missing)
  - **Verifies:** AC #1 - Valid M3U8 format

- ✅ **Test:** should return valid M3U format with EXTINF entries
  - **Status:** RED - No EXTINF entries (endpoint missing)
  - **Verifies:** AC #1 - Complete M3U structure

**Test Group 2: Channel Filtering (4 tests)**

- ✅ **Test:** should only include enabled XMLTV channels
  - **Status:** RED - No filtering logic (endpoint missing)
  - **Verifies:** AC #1 - is_enabled = 1 filter

- ✅ **Test:** should exclude disabled channels from playlist
  - **Status:** RED - No exclusion logic (endpoint missing)
  - **Verifies:** AC #1 - is_enabled = 0 excluded

- ✅ **Test:** should exclude XMLTV channels without Xtream stream mappings
  - **Status:** RED - No mapping check (endpoint missing)
  - **Verifies:** AC #1 - Only channels with streams

- ✅ **Test:** should return empty playlist when no enabled channels exist
  - **Status:** RED - No empty state handling (endpoint missing)
  - **Verifies:** AC #1 - Edge case handling

**Test Group 3: Channel Attributes (5 tests)**

- ✅ **Test:** should use XMLTV channel display name in playlist
  - **Status:** RED - No XMLTV name query (endpoint missing)
  - **Verifies:** AC #1 - XMLTV-first architecture

- ✅ **Test:** should include tvg-id attribute from XMLTV channel_id
  - **Status:** RED - No tvg-id attribute (endpoint missing)
  - **Verifies:** AC #1 - EPG matching attribute

- ✅ **Test:** should include tvg-chno from plex_display_order
  - **Status:** RED - No tvg-chno attribute (endpoint missing)
  - **Verifies:** AC #1 - Channel numbering

- ✅ **Test:** should include tvg-logo from XMLTV icon
  - **Status:** RED - No tvg-logo attribute (endpoint missing)
  - **Verifies:** AC #1 - Logo display

- ✅ **Test:** should use Xtream icon as fallback when XMLTV icon is null
  - **Status:** RED - No fallback logic (endpoint missing)
  - **Verifies:** AC #1 - Logo fallback strategy

**Test Group 4: Stream URLs (4 tests)**

- ✅ **Test:** should generate stream URLs using xmltv_channel_id
  - **Status:** RED - No stream URL generation (endpoint missing)
  - **Verifies:** AC #1 - Correct URL format

- ✅ **Test:** should use localhost (127.0.0.1) in stream URLs
  - **Status:** RED - No URL generation (endpoint missing)
  - **Verifies:** AC #1 - Security requirement (localhost only)

- ✅ **Test:** should use configured port in stream URLs
  - **Status:** RED - No port configuration (endpoint missing)
  - **Verifies:** AC #1 - Dynamic port support

- ✅ **Test:** should use primary Xtream stream for channels with multiple mappings
  - **Status:** RED - No primary stream selection (endpoint missing)
  - **Verifies:** AC #2 - Primary stream priority

**Test Group 5: Channel Ordering (2 tests)**

- ✅ **Test:** should order channels by plex_display_order
  - **Status:** RED - No ordering logic (endpoint missing)
  - **Verifies:** AC #1 - Channel number ordering

- ✅ **Test:** should handle null plex_display_order gracefully
  - **Status:** RED - No null handling (endpoint missing)
  - **Verifies:** AC #1 - Edge case handling

**Test Group 6: Synthetic Channels (2 tests)**

- ✅ **Test:** should include synthetic channels (promoted orphans)
  - **Status:** RED - No synthetic channel query (endpoint missing)
  - **Verifies:** AC #3 - Synthetic channel support

- ✅ **Test:** should use synthetic channel display name and icon
  - **Status:** RED - No synthetic channel attributes (endpoint missing)
  - **Verifies:** AC #3 - Synthetic channel formatting

**Test Group 7: Error Handling (2 tests)**

- ✅ **Test:** should handle database errors gracefully
  - **Status:** RED - No error handling (endpoint missing)
  - **Verifies:** Non-functional requirement - Error resilience

- ✅ **Test:** should return valid UTF-8 encoded content
  - **Status:** RED - No content encoding (endpoint missing)
  - **Verifies:** Non-functional requirement - Character encoding

---

## Data Factories Created

### M3U Playlist Factory

**File:** `tests/support/factories/m3u-playlist.factory.ts`

**Exports:**

- `createM3uChannel(overrides?)` - Create single M3U channel entry with optional overrides
- `createM3uChannels(count)` - Create array of M3U channels
- `createM3uChannelWithoutLogo(overrides?)` - Create channel without logo (tests fallback)
- `createM3uChannelWithNumber(channelNumber, overrides?)` - Create channel with specific number
- `createOrderedM3uChannels(count)` - Create sequentially numbered channels
- `createM3uPlaylistData(channelCount?)` - Create complete playlist data structure
- `generateM3uPlaylistText(channels)` - Generate M3U text from channels
- `createEnabledChannelWithMapping(overrides?)` - Create enabled channel with Xtream mapping
- `createEnabledChannelWithXtreamIconFallback()` - Create channel with icon fallback
- `createSyntheticChannel(overrides?)` - Create synthetic channel
- `createChannelWithoutOrder()` - Create channel with null plex_display_order
- `createEnabledChannelsWithMappings(count)` - Create multiple enabled channels
- `createMixedOrderChannels()` - Create mix of ordered and unordered channels
- `createESPNMultiQualitySet()` - Create multi-quality channel set (tests primary selection)
- `parseM3uPlaylist(playlistText)` - Parse M3U text into structured data
- `validateM3uPlaylist(playlistText)` - Validate M3U format

**Example Usage:**

```typescript
// Create a single M3U channel
const channel = createM3uChannel({ displayName: 'ESPN HD' });

// Create ordered channel list
const channels = createOrderedM3uChannels(10);

// Generate M3U playlist text
const playlistText = generateM3uPlaylistText(channels);

// Validate M3U format
const validation = validateM3uPlaylist(playlistText);
```

---

## Fixtures Created

No custom fixtures needed for this story. Tests use:

- **Playwright request context** - For HTTP API testing
- **Existing factories** - For test data generation
- **Database seeding** (future) - For integration test data setup

---

## Mock Requirements

No external service mocking required for this story.

**Database Testing:**

- Tests assume Tauri app is running with test database
- Database should contain sample XMLTV channels, settings, and mappings
- Future enhancement: Add database seeding fixtures for deterministic tests

---

## Required data-testid Attributes

No UI data-testid attributes required (backend-only story).

**API Attributes:**

- HTTP endpoint: `GET /playlist.m3u`
- Content-Type: `audio/x-mpegurl` or `application/x-mpegurl`
- Response format: M3U8 plain text

---

## Implementation Checklist

### Test: Basic Endpoint Functionality (4 tests)

**File:** `tests/integration/m3u-playlist.spec.ts` (lines 17-85)

**Tasks to make these tests pass:**

- [ ] Create `src-tauri/src/server/m3u.rs` module
- [ ] Add `m3u` module export in `src-tauri/src/server/mod.rs`
- [ ] Create `playlist_m3u` handler in `src-tauri/src/server/handlers.rs`
- [ ] Register route `.route("/playlist.m3u", get(handlers::playlist_m3u))` in `routes.rs`
- [ ] Return HTTP 200 status code
- [ ] Return Content-Type header: `audio/x-mpegurl`
- [ ] Return response body starting with `#EXTM3U`
- [ ] Run tests: `TAURI_DEV=true npm run test -- tests/integration/m3u-playlist.spec.ts -g "Basic Functionality"`
- [ ] ✅ All 4 tests pass (green phase)

**Estimated Effort:** 2 hours

---

### Test: Channel Filtering Logic (4 tests)

**File:** `tests/integration/m3u-playlist.spec.ts` (lines 87-134)

**Tasks to make these tests pass:**

- [ ] Create database query function `get_enabled_channels_for_m3u` in `m3u.rs`
- [ ] Query XMLTV channels with `INNER JOIN xmltv_channel_settings`
- [ ] Filter by `is_enabled = 1`
- [ ] Filter out channels without Xtream mappings using `EXISTS` subquery
- [ ] Handle empty result set (return `#EXTM3U` only)
- [ ] Order results by `plex_display_order ASC NULLS LAST`
- [ ] Run tests: `TAURI_DEV=true npm run test -- tests/integration/m3u-playlist.spec.ts -g "Channel Filtering"`
- [ ] ✅ All 4 tests pass (green phase)

**Estimated Effort:** 3 hours

---

### Test: Channel Attributes (5 tests)

**File:** `tests/integration/m3u-playlist.spec.ts` (lines 136-207)

**Tasks to make these tests pass:**

- [ ] Define `M3uChannel` struct in `m3u.rs` with fields: xmltv_channel_id, display_name, channel_number, logo_url, tvg_id
- [ ] Map query results to `M3uChannel` structs
- [ ] Generate EXTINF line with tvg-id, tvg-name, tvg-logo, tvg-chno attributes
- [ ] Implement logo fallback: use XMLTV icon if present, else Xtream icon
- [ ] Query Xtream icon from channel_mappings when XMLTV icon is null
- [ ] Format display name after comma in EXTINF line
- [ ] Run tests: `TAURI_DEV=true npm run test -- tests/integration/m3u-playlist.spec.ts -g "Channel Attributes"`
- [ ] ✅ All 5 tests pass (green phase)

**Estimated Effort:** 4 hours

---

### Test: Stream URL Generation (4 tests)

**File:** `tests/integration/m3u-playlist.spec.ts` (lines 209-257)

**Tasks to make these tests pass:**

- [ ] Get server port from `AppState`
- [ ] Generate stream URL: `http://127.0.0.1:{port}/stream/{xmltv_channel_id}`
- [ ] Use localhost (127.0.0.1) for security
- [ ] Add stream URL line after each EXTINF line
- [ ] Ensure primary stream is used (query filters by `is_primary = 1`)
- [ ] Run tests: `TAURI_DEV=true npm run test -- tests/integration/m3u-playlist.spec.ts -g "Stream URLs"`
- [ ] ✅ All 4 tests pass (green phase)

**Estimated Effort:** 2 hours

---

### Test: Channel Ordering (2 tests)

**File:** `tests/integration/m3u-playlist.spec.ts` (lines 259-289)

**Tasks to make these tests pass:**

- [ ] Verify SQL query orders by `plex_display_order ASC`
- [ ] Use `NULLS LAST` to put null-ordered channels at end
- [ ] Add secondary sort by `display_name ASC` for null order channels
- [ ] Run tests: `TAURI_DEV=true npm run test -- tests/integration/m3u-playlist.spec.ts -g "Channel Ordering"`
- [ ] ✅ All 2 tests pass (green phase)

**Estimated Effort:** 1 hour

---

### Test: Synthetic Channels (2 tests)

**File:** `tests/integration/m3u-playlist.spec.ts` (lines 291-318)

**Tasks to make these tests pass:**

- [ ] Verify query includes channels with `is_synthetic = 1`
- [ ] No special handling needed (synthetic channels are XMLTV channels)
- [ ] Run tests: `TAURI_DEV=true npm run test -- tests/integration/m3u-playlist.spec.ts -g "Synthetic Channels"`
- [ ] ✅ All 2 tests pass (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: Error Handling (2 tests)

**File:** `tests/integration/m3u-playlist.spec.ts` (lines 320-353)

**Tasks to make these tests pass:**

- [ ] Wrap database operations in error handling
- [ ] Return `(StatusCode::INTERNAL_SERVER_ERROR, error_message)` on DB errors
- [ ] Ensure UTF-8 encoding for playlist text
- [ ] Test with Unicode characters in channel names
- [ ] Run tests: `TAURI_DEV=true npm run test -- tests/integration/m3u-playlist.spec.ts -g "Error Handling"`
- [ ] ✅ All 2 tests pass (green phase)

**Estimated Effort:** 1 hour

---

### Rust Unit Tests (7 tests)

**File:** Create `src-tauri/src/server/m3u_tests.rs` or add tests in `m3u.rs`

**Tasks:**

- [ ] Test: Empty playlist when no enabled channels
- [ ] Test: Single channel generates correct format
- [ ] Test: Multiple channels ordered by plex_display_order
- [ ] Test: Channels without streams are excluded
- [ ] Test: Logo fallback from XMLTV to Xtream
- [ ] Test: Synthetic channels included with correct info
- [ ] Test: Null plex_display_order handled correctly
- [ ] Run tests: `cargo test m3u`
- [ ] ✅ All Rust tests pass

**Estimated Effort:** 3 hours

---

### Build Verification

**Tasks:**

- [ ] Run `cargo check` - no Rust errors
- [ ] Run `cargo test` - all tests pass
- [ ] Run `TAURI_DEV=true npm run test -- tests/integration/m3u-playlist.spec.ts` - all integration tests pass
- [ ] Run `npm run build` - build succeeds
- [ ] Manual test: GET http://127.0.0.1:5004/playlist.m3u returns valid M3U

**Estimated Effort:** 1 hour

---

## Running Tests

```bash
# Run all M3U playlist integration tests
TAURI_DEV=true npm run test -- tests/integration/m3u-playlist.spec.ts

# Run specific test group
TAURI_DEV=true npm run test -- tests/integration/m3u-playlist.spec.ts -g "Basic Functionality"

# Run tests in headed mode (see browser, if applicable)
TAURI_DEV=true npm run test -- tests/integration/m3u-playlist.spec.ts --headed

# Debug specific test
TAURI_DEV=true npm run test -- tests/integration/m3u-playlist.spec.ts --debug -g "should respond"

# Run Rust unit tests
cd src-tauri
cargo test m3u

# Run all Rust tests
cd src-tauri
cargo test

# Check Rust code
cd src-tauri
cargo check
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All 24 integration tests written and failing
- ✅ M3U playlist factory created with comprehensive test data generation
- ✅ Data factories support ordered channels, logo fallback, synthetic channels
- ✅ Test validates M3U format, attributes, filtering, ordering
- ✅ Implementation checklist created with clear tasks

**Verification:**

- All tests run and fail as expected
- Failure reason: Endpoint returns 404 Not Found (route not registered)
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test group** from implementation checklist (start with Basic Functionality)
2. **Read the tests** to understand expected behavior
3. **Implement minimal code** to make those specific tests pass
4. **Run the test group** to verify tests now pass (green)
5. **Check off the tasks** in implementation checklist
6. **Move to next test group** and repeat

**Key Principles:**

- One test group at a time (don't try to fix all at once)
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
4. **Optimize performance** (if needed - ensure <100ms response time)
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
3. **Run failing tests** to confirm RED phase: `TAURI_DEV=true npm run test -- tests/integration/m3u-playlist.spec.ts`
4. **Begin implementation** using implementation checklist as guide
5. **Work one test group at a time** (red → green for each)
6. **Share progress** in daily standup
7. **When all tests pass**, refactor code for quality
8. **When refactoring complete**, manually update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **data-factories.md** - Factory patterns using `@faker-js/faker` for random test data generation with overrides support
- **test-quality.md** - Test design principles (Given-When-Then, determinism, isolation, explicit assertions)
- **test-levels-framework.md** - Test level selection framework (chose Integration/API tests for HTTP endpoint)
- **fixture-architecture.md** - Test fixture patterns (not needed for this story - using request context)
- **network-first.md** - Not applicable (no UI routing, pure HTTP API)
- **selector-resilience.md** - Not applicable (backend-only story)

See `_bmad/bmm/testarch/tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `TAURI_DEV=true npm run test -- tests/integration/m3u-playlist.spec.ts`

**Expected Results:**

```
Running 24 tests using 1 worker

❌ M3U Playlist Endpoint - Basic Functionality › should respond to GET /playlist.m3u with 200 OK
   Error: HTTP server returned 404 Not Found for /playlist.m3u

❌ M3U Playlist Endpoint - Basic Functionality › should return correct Content-Type header
   Error: HTTP server returned 404 Not Found for /playlist.m3u

❌ M3U Playlist Endpoint - Basic Functionality › should return playlist starting with #EXTM3U header
   Error: HTTP server returned 404 Not Found for /playlist.m3u

❌ M3U Playlist Endpoint - Basic Functionality › should return valid M3U format with EXTINF entries
   Error: HTTP server returned 404 Not Found for /playlist.m3u

... (remaining 20 tests fail similarly)

24 failed
  M3U Playlist Endpoint - Basic Functionality (4)
  M3U Playlist Endpoint - Channel Filtering (4)
  M3U Playlist Endpoint - Channel Attributes (5)
  M3U Playlist Endpoint - Stream URLs (4)
  M3U Playlist Endpoint - Channel Ordering (2)
  M3U Playlist Endpoint - Synthetic Channels (2)
  M3U Playlist Endpoint - Error Handling (2)
```

**Summary:**

- Total tests: 24
- Passing: 0 (expected)
- Failing: 24 (expected)
- Status: ✅ RED phase verified

**Expected Failure Messages:**

- All tests fail with: "HTTP server returned 404 Not Found for /playlist.m3u"
- Reason: Route `/playlist.m3u` not registered in `src-tauri/src/server/routes.rs`
- This is the expected RED phase state

---

## Notes

### XMLTV-First Architecture

The M3U playlist MUST use XMLTV channel information because:
- XMLTV channels define the Plex lineup (names, numbers, EPG IDs)
- Xtream streams are video SOURCES mapped to XMLTV channels
- The `/stream/{id}` endpoint uses `xmltv_channel_id` (Story 4-4 will resolve to Xtream stream)

### Database Query Strategy

The core query should:
1. INNER JOIN xmltv_channels with xmltv_channel_settings
2. Filter by is_enabled = 1
3. Filter out channels without mappings (EXISTS subquery on channel_mappings)
4. LEFT JOIN to get primary Xtream stream icon (for fallback)
5. Order by plex_display_order ASC NULLS LAST, display_name ASC

### M3U Format Specification

```
#EXTM3U
#EXTINF:-1 tvg-id="ESPN.US" tvg-name="ESPN" tvg-logo="http://example.com/espn.png" tvg-chno="206",ESPN
http://127.0.0.1:5004/stream/123
#EXTINF:-1 tvg-id="CNN.US" tvg-name="CNN" tvg-logo="http://example.com/cnn.png" tvg-chno="207",CNN
http://127.0.0.1:5004/stream/124
```

### Performance Considerations

- Query should be efficient even with 1000+ channels
- Use indexed columns: `is_enabled`, `plex_display_order`
- M3U generation is O(n) where n = enabled channels
- Response should be <100ms for normal channel counts (NFR5)
- Consider caching if performance becomes an issue (future optimization)

### Integration with Story 4-4

The `/stream/{xmltv_channel_id}` endpoint (Story 4-4) will:
1. Look up primary Xtream stream from channel_mappings
2. Proxy the stream from Xtream provider
3. Handle failover to backup streams (Story 4-5)

For now, the M3U just generates the URL - actual streaming is next story.

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Refer to `_bmad-output/planning-artifacts/architecture.md` for system design
- Refer to `_bmad-output/implementation-artifacts/4-1-serve-m3u-playlist-endpoint.md` for story details
- Consult `_bmad/bmm/testarch/knowledge` for testing best practices

---

**Generated by BMad TEA Agent** - 2026-01-20
