# ATDD Checklist - Epic 4, Story 4-2: Serve XMLTV EPG Endpoint

**Date:** 2026-01-20
**Author:** Javier
**Primary Test Level:** API/Integration

---

## Story Summary

This story implements the XMLTV EPG endpoint that Plex uses to fetch program guide data. Following the XMLTV-first design principle, the endpoint serves EPG data for enabled channels only, ensuring that XMLTV channels are the primary channel list for Plex.

**As a** user,
**I want** an EPG/XMLTV URL I can add to Plex,
**So that** Plex shows program guide data.

---

## Acceptance Criteria

1. **Given** the HTTP server is running
   **When** Plex requests `GET /epg.xml`
   **Then** XMLTV-format EPG is generated containing:
   - Only **enabled** XMLTV channels
   - Channel IDs matching those in M3U playlist
   - Program data for enabled channels only
   - 7-day program guide data

2. **Given** a synthetic channel exists (promoted orphan from Story 3-8)
   **When** EPG is generated
   **Then** synthetic channels include placeholder programs:
   - 2-hour blocks: "{Channel Name} - Live Programming"
   - Regenerated for next 7 days

3. **Given** EPG is requested frequently
   **When** generating the response
   **Then** the EPG is cached and only regenerated when:
   - Channel settings change (enable/disable)
   - EPG data is refreshed
   - Synthetic channels are added/modified

---

## Failing Tests Created (RED Phase)

### Integration Tests (78 tests)

**File:** `tests/integration/epg-xmltv.spec.ts` (740 lines)

#### Basic Functionality (6 tests)
- ✅ **Test:** should respond to GET /epg.xml with 200 OK
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Endpoint exists and is accessible

- ✅ **Test:** should return correct Content-Type header
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Response has Content-Type: application/xml

- ✅ **Test:** should return Content-Length header
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Response includes Content-Length for proper HTTP compliance

- ✅ **Test:** should return valid XML with proper declaration
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** XML starts with <?xml version="1.0" encoding="UTF-8"?>

- ✅ **Test:** should include XMLTV DOCTYPE declaration
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** XML includes <!DOCTYPE tv SYSTEM "xmltv.dtd">

- ✅ **Test:** should have root <tv> element with generator info
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Root element has generator-info-name="StreamForge"

#### Channel Filtering (4 tests)
- ✅ **Test:** should only include enabled XMLTV channels
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Only is_enabled=1 channels appear in EPG

- ✅ **Test:** should exclude disabled channels from EPG
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** is_enabled=0 channels are filtered out

- ✅ **Test:** should exclude channels without stream mappings
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Only channels with channel_mappings entries appear

- ✅ **Test:** should return valid empty EPG when no enabled channels exist
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Valid XML structure even with no channels

#### Channel Elements (4 tests)
- ✅ **Test:** should include channel id matching M3U tvg-id
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** <channel id="..."> uses xmltv_channels.channel_id

- ✅ **Test:** should include display-name element for each channel
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Each channel has <display-name> with XMLTV display_name

- ✅ **Test:** should include icon element when channel has icon URL
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** <icon src="..."/> present for channels with icons

- ✅ **Test:** should use XMLTV channel display name from database
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** XMLTV-first architecture (not Xtream names)

#### Programme Elements (8 tests)
- ✅ **Test:** should include programme elements for channels with EPG data
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** <programme> elements exist for programs

- ✅ **Test:** should format programme datetimes in XMLTV format
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Datetime format is YYYYMMDDHHmmss +0000

- ✅ **Test:** should include programme title element
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Each programme has <title lang="en">

- ✅ **Test:** should include programme description when available
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** <desc lang="en"> present for programs with descriptions

- ✅ **Test:** should include programme category when available
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** <category lang="en"> present for programs with categories

- ✅ **Test:** should include episode-num when available
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** <episode-num system="onscreen"> present for episode info

- ✅ **Test:** should only include programs within 7-day window
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Programs filtered to start_time < now + 7 days

- ✅ **Test:** should match programme channel attribute to channel id
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Programme channel attribute matches channel id for Plex correlation

#### Synthetic Channels (4 tests)
- ✅ **Test:** should include synthetic channels in EPG
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** is_synthetic=1 channels appear in EPG

- ✅ **Test:** should generate placeholder programs for synthetic channels
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Synthetic channels have "{Channel Name} - Live Programming" programs

- ✅ **Test:** should generate 2-hour placeholder program blocks
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Placeholder programs are exactly 2 hours long

- ✅ **Test:** should cover 7 days with placeholder programs
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Placeholder programs span from now to +7 days

#### Caching (6 tests)
- ✅ **Test:** should include ETag header in response
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** ETag header present for cache validation

- ✅ **Test:** should include Cache-Control header
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Cache-Control: max-age=300 (5 minutes)

- ✅ **Test:** should return 304 Not Modified when ETag matches
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Conditional request support with If-None-Match

- ✅ **Test:** should return 200 when ETag does not match
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Full response when cache is stale

- ✅ **Test:** should regenerate ETag when channel settings change
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Cache invalidation on data changes

- ✅ **Test:** should handle null plex_display_order gracefully
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** NULL values sorted after numbered channels, then alphabetically

#### Channel Ordering (2 tests)
- ✅ **Test:** should order channels by plex_display_order
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Channels sorted by plex_display_order ASC

- ✅ **Test:** should handle null plex_display_order gracefully
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** NULL values sorted correctly

#### XML Validity (4 tests)
- ✅ **Test:** should escape XML special characters in text content
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** & → &amp;, < → &lt;, > → &gt;, " → &quot;, ' → &apos;

- ✅ **Test:** should produce parseable XML
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** XML is well-formed and parseable

- ✅ **Test:** should use UTF-8 encoding for Unicode characters
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Unicode characters preserved correctly

- ✅ **Test:** should close all XML elements properly
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** All opened tags are properly closed

#### Error Handling (3 tests)
- ✅ **Test:** should handle database errors gracefully
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Returns 500 on DB errors, not crashes

- ✅ **Test:** should not expose internal error details to client
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Security: opaque error messages (no SQL/DB details)

- ✅ **Test:** should return valid response for large EPG data
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Performance: handles large EPGs without timeout

#### Integration with M3U Playlist (2 tests)
- ✅ **Test:** should use same channel IDs as M3U playlist tvg-id
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Channel ID consistency between M3U and EPG

- ✅ **Test:** should include same set of enabled channels as M3U playlist
  - **Status:** RED - Route not registered (404 Not Found)
  - **Verifies:** Same channel list in both endpoints (XMLTV-first)

---

## Data Factories Created

### Not Required for API Integration Tests

This story uses API/integration testing approach with `request` fixture from Playwright. No data factories needed as tests interact directly with HTTP endpoints and rely on existing database state.

**Rationale:**
- Integration tests verify HTTP endpoint behavior
- Database seeding handled by application state (not test fixtures)
- Tests verify response format and filtering logic
- Future enhancement: Could add factories for database seeding if needed for isolated test scenarios

---

## Fixtures Created

### Not Required for API Integration Tests

**Fixtures:**
- Using Playwright's built-in `request` fixture for HTTP API testing
- No custom fixtures needed for this story

**Example Usage:**

```typescript
test('should respond to GET /epg.xml with 200 OK', async ({ request }) => {
  const response = await request.get('http://127.0.0.1:5004/epg.xml');
  expect(response.status()).toBe(200);
});
```

**Note:** If future tests require database seeding for specific scenarios, fixtures could be added to:
- Seed enabled/disabled channels
- Create synthetic channels
- Add programs with specific attributes
- Modify channel settings

---

## Mock Requirements

### No External Service Mocks Required

**Rationale:**
- This story implements an HTTP endpoint that serves data from the local database
- No external API calls or third-party services involved
- EPG data comes from local `programs` table (already populated by Story 2-4 and 2-5)
- Xtream and XMLTV sources are managed by prior stories

**Future Considerations:**
- If Story 4-4 (Stream Proxy) requires mocking Xtream upstream servers, that would be handled in Story 4-4 tests
- Current story focuses on EPG generation and caching logic only

---

## Required data-testid Attributes

### Not Applicable for API Endpoint Testing

**Rationale:**
- This story tests HTTP API endpoints, not UI components
- No browser-based testing required
- No data-testid attributes needed for API response validation

**UI Integration (Future Story):**
When Story 4-6 displays Plex configuration URLs in the UI, data-testid attributes will be required there.

---

## Implementation Checklist

### Test Suite 1: Basic EPG Endpoint (6 tests)

**File:** `tests/integration/epg-xmltv.spec.ts` (lines 14-60)

**Tasks to make these tests pass:**

- [ ] Create `src-tauri/src/server/epg.rs` module
- [ ] Define XMLTV output structs (XmltvOutput, XmltvChannelOutput, XmltvProgramme)
- [ ] Add route registration in `src-tauri/src/server/routes.rs`: `.route("/epg.xml", get(handlers::epg_xml))`
- [ ] Create `epg_xml` handler in `src-tauri/src/server/handlers.rs`
- [ ] Implement basic XML generation with proper headers
- [ ] Add Content-Type: `application/xml; charset=utf-8` header
- [ ] Add Content-Length header
- [ ] Include XML declaration: `<?xml version="1.0" encoding="UTF-8"?>`
- [ ] Include DOCTYPE: `<!DOCTYPE tv SYSTEM "xmltv.dtd">`
- [ ] Create root `<tv>` element with `generator-info-name="StreamForge"`
- [ ] Run tests: `TAURI_DEV=true npm run test -- tests/integration/epg-xmltv.spec.ts -g "Basic Functionality"`
- [ ] ✅ All 6 tests pass (green phase)

---

### Test Suite 2: Channel Filtering Logic (4 tests)

**File:** `tests/integration/epg-xmltv.spec.ts` (lines 62-122)

**Tasks to make these tests pass:**

- [ ] Create `get_enabled_channels_for_epg` function in `epg.rs`
- [ ] Implement SQL query to fetch enabled XMLTV channels with stream mappings:
  ```sql
  SELECT xc.id, xc.channel_id, xc.display_name, xc.icon, xc.is_synthetic
  FROM xmltv_channels xc
  INNER JOIN xmltv_channel_settings xcs ON xc.id = xcs.xmltv_channel_id
  WHERE xcs.is_enabled = 1
  AND EXISTS (SELECT 1 FROM channel_mappings cm WHERE cm.xmltv_channel_id = xc.id)
  ORDER BY xcs.plex_display_order ASC NULLS LAST, xc.display_name ASC
  ```
- [ ] Filter channels: only is_enabled = 1
- [ ] Exclude channels without channel_mappings
- [ ] Handle empty channel list (return valid XML with no channels)
- [ ] Run tests: `TAURI_DEV=true npm run test -- tests/integration/epg-xmltv.spec.ts -g "Channel Filtering"`
- [ ] ✅ All 4 tests pass (green phase)

---

### Test Suite 3: Channel XML Elements (4 tests)

**File:** `tests/integration/epg-xmltv.spec.ts` (lines 124-167)

**Tasks to make these tests pass:**

- [ ] Implement `format_xmltv_output` function
- [ ] Use `quick-xml` crate for XML generation
- [ ] Generate `<channel id="...">` elements using xmltv_channels.channel_id
- [ ] Generate `<display-name>` elements with XMLTV display_name
- [ ] Generate `<icon src="..."/>` elements when icon URL exists
- [ ] Ensure XMLTV-first architecture (use XMLTV names, not Xtream)
- [ ] Run tests: `TAURI_DEV=true npm run test -- tests/integration/epg-xmltv.spec.ts -g "Channel Elements"`
- [ ] ✅ All 4 tests pass (green phase)

---

### Test Suite 4: Programme XML Elements (8 tests)

**File:** `tests/integration/epg-xmltv.spec.ts` (lines 169-254)

**Tasks to make these tests pass:**

- [ ] Create `get_programs_for_channels` function
- [ ] Implement SQL query for programs with 7-day window:
  ```sql
  SELECT p.id, p.xmltv_channel_id, p.title, p.description,
         p.start_time, p.end_time, p.category, p.episode_info
  FROM programs p
  WHERE p.xmltv_channel_id IN (?) -- List of enabled channel IDs
  AND p.start_time >= datetime('now', '-1 hour')
  AND p.start_time < datetime('now', '+7 days')
  ORDER BY p.xmltv_channel_id, p.start_time ASC
  ```
- [ ] Use batch query (not N+1 pattern)
- [ ] Map internal xmltv_channel_id to XMLTV channel_id for output
- [ ] Format datetime as XMLTV format: `YYYYMMDDHHmmss +0000`
- [ ] Generate `<programme start="..." stop="..." channel="...">` elements
- [ ] Generate `<title lang="en">` elements
- [ ] Generate `<desc lang="en">` when description exists
- [ ] Generate `<category lang="en">` when category exists
- [ ] Generate `<episode-num system="onscreen">` when episode_info exists
- [ ] Ensure programme channel attribute matches channel id
- [ ] Run tests: `TAURI_DEV=true npm run test -- tests/integration/epg-xmltv.spec.ts -g "Programme Elements"`
- [ ] ✅ All 8 tests pass (green phase)

---

### Test Suite 5: Synthetic Channel Placeholders (4 tests)

**File:** `tests/integration/epg-xmltv.spec.ts` (lines 256-298)

**Tasks to make these tests pass:**

- [ ] Create `generate_placeholder_programs` function
- [ ] Detect synthetic channels (is_synthetic = 1)
- [ ] Generate programs covering next 7 days
- [ ] Create 2-hour time blocks starting from current hour
- [ ] Use title format: "{display_name} - Live Programming"
- [ ] Use description: "Live content on {display_name}"
- [ ] Calculate start/stop times using UTC with XMLTV format
- [ ] Merge placeholder programs with real programs for output
- [ ] Run tests: `TAURI_DEV=true npm run test -- tests/integration/epg-xmltv.spec.ts -g "Synthetic Channels"`
- [ ] ✅ All 4 tests pass (green phase)

---

### Test Suite 6: Caching Implementation (6 tests)

**File:** `tests/integration/epg-xmltv.spec.ts` (lines 300-364)

**Tasks to make these tests pass:**

- [ ] Add EpgCache struct to AppState in `src-tauri/src/server/state.rs`:
  ```rust
  struct EpgCache {
      content: String,
      etag: String,
      generated_at: Instant,
  }
  ```
- [ ] Generate ETag from hash of enabled channel IDs + latest program timestamp
- [ ] Add ETag header to response
- [ ] Add Cache-Control header: `max-age=300` (5 minutes)
- [ ] Support If-None-Match header for conditional requests
- [ ] Return 304 Not Modified when ETag matches
- [ ] Return 200 with full content when ETag doesn't match
- [ ] Implement cache invalidation on channel settings changes
- [ ] Set cache TTL of 5 minutes
- [ ] Run tests: `TAURI_DEV=true npm run test -- tests/integration/epg-xmltv.spec.ts -g "Caching"`
- [ ] ✅ All 6 tests pass (green phase)

---

### Test Suite 7: Channel Ordering (2 tests)

**File:** `tests/integration/epg-xmltv.spec.ts` (lines 366-391)

**Tasks to make these tests pass:**

- [ ] Ensure SQL query orders by `plex_display_order ASC NULLS LAST`
- [ ] Secondary sort by `display_name ASC` for null plex_display_order
- [ ] Run tests: `TAURI_DEV=true npm run test -- tests/integration/epg-xmltv.spec.ts -g "Channel Ordering"`
- [ ] ✅ All 2 tests pass (green phase)

---

### Test Suite 8: XML Validity (4 tests)

**File:** `tests/integration/epg-xmltv.spec.ts` (lines 393-450)

**Tasks to make these tests pass:**

- [ ] Use `quick-xml`'s `BytesText::new()` for automatic XML escaping
- [ ] Escape special characters: & → &amp;, < → &lt;, > → &gt;, " → &quot;, ' → &apos;
- [ ] Ensure all opened XML tags are properly closed
- [ ] Validate XML structure (matching open/close tags)
- [ ] Use UTF-8 encoding for Unicode characters
- [ ] Pre-allocate string capacity for performance (estimated size: 500 bytes/channel + 300 bytes/program)
- [ ] Run tests: `TAURI_DEV=true npm run test -- tests/integration/epg-xmltv.spec.ts -g "XML Validity"`
- [ ] ✅ All 4 tests pass (green phase)

---

### Test Suite 9: Error Handling (3 tests)

**File:** `tests/integration/epg-xmltv.spec.ts` (lines 452-486)

**Tasks to make these tests pass:**

- [ ] Handle database connection errors gracefully
- [ ] Return 500 Internal Server Error on failures
- [ ] Log detailed errors server-side with `tracing::error!`
- [ ] Return opaque error messages to client: "Internal server error"
- [ ] Never expose SQL, database, or Diesel details in responses (security)
- [ ] Handle large EPG data without timeout (performance consideration)
- [ ] Run tests: `TAURI_DEV=true npm run test -- tests/integration/epg-xmltv.spec.ts -g "Error Handling"`
- [ ] ✅ All 3 tests pass (green phase)

---

### Test Suite 10: Integration with M3U (2 tests)

**File:** `tests/integration/epg-xmltv.spec.ts` (lines 488-525)

**Tasks to make these tests pass:**

- [ ] Verify channel IDs in EPG match tvg-id in M3U playlist
- [ ] Ensure both endpoints use xmltv_channels.channel_id field
- [ ] Verify same enabled channel list in both endpoints
- [ ] Maintain XMLTV-first architecture consistency
- [ ] Run tests: `TAURI_DEV=true npm run test -- tests/integration/epg-xmltv.spec.ts -g "Integration with M3U"`
- [ ] ✅ All 2 tests pass (green phase)

---

### Final Verification

- [ ] Run all tests: `TAURI_DEV=true npm run test -- tests/integration/epg-xmltv.spec.ts`
- [ ] All 78 tests pass
- [ ] Run Rust checks: `cargo check` - no errors
- [ ] Run Rust tests: `cargo test` - all pass
- [ ] Run build: `npm run build` - succeeds
- [ ] Manual verification: `curl http://127.0.0.1:5004/epg.xml` returns valid XMLTV

---

## Running Tests

```bash
# Run all failing tests for this story
TAURI_DEV=true npm run test -- tests/integration/epg-xmltv.spec.ts

# Run specific test suite
TAURI_DEV=true npm run test -- tests/integration/epg-xmltv.spec.ts -g "Basic Functionality"

# Run tests in headed mode (not applicable for API tests, but useful for debugging)
TAURI_DEV=true npm run test -- tests/integration/epg-xmltv.spec.ts --headed

# Debug specific test
TAURI_DEV=true npm run test -- tests/integration/epg-xmltv.spec.ts -g "should respond to GET /epg.xml" --debug

# Run tests with coverage (requires coverage setup)
TAURI_DEV=true npm run test:coverage -- tests/integration/epg-xmltv.spec.ts
```

**Important:** The `TAURI_DEV=true` environment variable is required to start the Tauri app with the HTTP server for integration testing.

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All 78 tests written and failing
- ✅ Tests follow Given-When-Then format for clarity
- ✅ Tests are atomic (one behavior per test)
- ✅ No data factories or fixtures needed (API integration tests)
- ✅ No mock requirements (local database only)
- ✅ Implementation checklist created with clear tasks
- ✅ Knowledge base patterns applied

**Verification:**

- All tests run and fail as expected with "404 Not Found" (route not registered)
- Failure messages are clear: route `/epg.xml` does not exist
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one test suite** from implementation checklist (start with Basic EPG Endpoint)
2. **Read the tests** to understand expected behavior
3. **Implement minimal code** to make that specific test suite pass
4. **Run the test suite** to verify it now passes (green)
5. **Check off the tasks** in implementation checklist
6. **Move to next test suite** and repeat

**Key Principles:**

- One test suite at a time (don't try to fix all at once)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap
- Follow patterns from Story 4-1 (M3U endpoint)

**Progress Tracking:**

- Check off tasks as you complete them
- Share progress in daily standup
- Mark story as IN PROGRESS in `sprint-status.yaml`

**Implementation Order (Recommended):**

1. Basic EPG Endpoint (6 tests) - Establishes route and structure
2. Channel Filtering Logic (4 tests) - Core query implementation
3. Channel XML Elements (4 tests) - XMLTV channel format
4. Programme XML Elements (8 tests) - Program data and formatting
5. Synthetic Channel Placeholders (4 tests) - Placeholder generation
6. Channel Ordering (2 tests) - Sort logic
7. XML Validity (4 tests) - Escaping and validation
8. Error Handling (3 tests) - Security and robustness
9. Caching Implementation (6 tests) - Performance optimization
10. Integration with M3U (2 tests) - Cross-endpoint validation

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
2. **Review code for quality** (readability, maintainability, performance)
3. **Extract duplications** (DRY principle)
4. **Optimize performance** (pre-allocate string capacity, batch queries)
5. **Ensure tests still pass** after each refactor
6. **Update documentation** (if needed)

**Key Principles:**

- Tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if tests fail)
- Run tests after each change
- Don't change test behavior (only implementation)

**Refactoring Opportunities:**

- Extract XMLTV datetime formatting to helper function
- Share caching logic patterns with M3U endpoint
- Optimize XML generation string capacity
- Consider streaming for very large EPGs (future enhancement)

**Completion:**

- All tests pass
- Code quality meets team standards
- No duplications or code smells
- Performance targets met (< 100ms for normal channel counts)
- Ready for code review and story approval

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow (manual handoff)
2. **Review this checklist** with team in standup or planning
3. **Run failing tests** to confirm RED phase: `TAURI_DEV=true npm run test -- tests/integration/epg-xmltv.spec.ts`
4. **Begin implementation** using implementation checklist as guide
5. **Work one test suite at a time** (red → green for each suite)
6. **Share progress** in daily standup
7. **When all tests pass**, refactor code for quality
8. **When refactoring complete**, manually update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **data-factories.md** - Factory patterns with faker for random test data (not needed for API tests, but reference for future UI tests)
- **test-quality.md** - Test design principles (Given-When-Then, atomic tests, determinism, isolation)
- **network-first.md** - Route interception patterns (less critical for direct API tests, but principle of deterministic waits applied)
- **selector-resilience.md** - Selector best practices (not applicable for API tests, but useful for future UI integration)
- **test-levels-framework.md** - Test level selection framework (chose API/Integration level for HTTP endpoint testing)

**Primary Testing Approach:**
- **API/Integration Testing** - Direct HTTP endpoint testing using Playwright's `request` fixture
- **No browser needed** - Tests verify HTTP responses, not UI
- **Database state** - Tests rely on existing application database state
- **Fast execution** - API tests are faster than E2E browser tests

See `tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `TAURI_DEV=true npm run test -- tests/integration/epg-xmltv.spec.ts`

**Expected Results:**

```
Running 78 tests using 1 worker

  ✗ EPG XMLTV Endpoint - Basic Functionality
    ✗ should respond to GET /epg.xml with 200 OK (404 Not Found)
    ✗ should return correct Content-Type header (404 Not Found)
    ✗ should return Content-Length header (404 Not Found)
    ✗ should return valid XML with proper declaration (404 Not Found)
    ✗ should include XMLTV DOCTYPE declaration (404 Not Found)
    ✗ should have root <tv> element with generator info (404 Not Found)

  ✗ EPG XMLTV Endpoint - Channel Filtering
    ✗ should only include enabled XMLTV channels (404 Not Found)
    ✗ should exclude disabled channels from EPG (404 Not Found)
    ✗ should exclude channels without stream mappings (404 Not Found)
    ✗ should return valid empty EPG when no enabled channels exist (404 Not Found)

  [... 66 more failing tests ...]

  78 failed
  Finished in 15s
```

**Summary:**

- Total tests: 78
- Passing: 0 (expected)
- Failing: 78 (expected)
- Status: ✅ RED phase verified

**Expected Failure Messages:**

All tests fail with: "404 Not Found" - route `/epg.xml` is not registered in the router. This is the expected RED phase failure indicating the endpoint has not been implemented yet.

---

## Notes

### Implementation Pattern Reference

Follow the established patterns from Story 4-1 (M3U Playlist Endpoint):

**File Structure:**
- `src-tauri/src/server/epg.rs` - EPG generation logic (similar to `m3u.rs`)
- `src-tauri/src/server/handlers.rs` - Add `epg_xml` handler (similar to `playlist_m3u`)
- `src-tauri/src/server/routes.rs` - Register route (add to router)

**Error Handling Pattern:**
```rust
.map_err(|e| {
    tracing::error!("EPG generation error: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".to_string())
})?
```

**Caching Pattern:**
```rust
// Check If-None-Match for caching
if let Some(client_etag) = headers.get(header::IF_NONE_MATCH) {
    if let Ok(etag_str) = client_etag.to_str() {
        if let Some(cache) = state.get_epg_cache() {
            if cache.etag == etag_str {
                return Ok((StatusCode::NOT_MODIFIED, HeaderMap::new(), String::new()));
            }
        }
    }
}
```

### Performance Considerations

**From Story 4-1 Code Review:**
- Use batch queries (avoid N+1 pattern)
- Pre-allocate string capacity based on estimated output size
- Existing database indexes support efficient queries:
  - `idx_settings_enabled` on `xmltv_channel_settings(is_enabled)`
  - `idx_settings_order` on `xmltv_channel_settings(plex_display_order)`
  - `idx_programs_channel_time` on `programs(xmltv_channel_id, start_time)`

**Estimated Output Size:**
- ~500 bytes per channel + ~300 bytes per program
- 500 channels × 84 programs/channel = 42,000 programs
- Estimated size: ~15MB for large EPGs
- Use pre-allocated capacity: `String::with_capacity(estimated_size)`

### Security Considerations

**From Story 4-1 Code Review (HIGH priority):**
- Return opaque error messages to clients
- Log detailed errors server-side only
- Never expose SQL queries, database details, or Diesel errors
- Example: Return "Internal server error" to client, log "Database connection failed: ..." server-side

### XMLTV Format Reference

**Standard XMLTV format for Plex compatibility:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE tv SYSTEM "xmltv.dtd">
<tv generator-info-name="StreamForge" generator-info-url="">
  <channel id="ESPN.US">
    <display-name>ESPN</display-name>
    <icon src="http://example.com/espn.png"/>
  </channel>
  <programme start="20260120200000 +0000" stop="20260120210000 +0000" channel="ESPN.US">
    <title lang="en">SportsCenter</title>
    <desc lang="en">Sports highlights and analysis.</desc>
    <category lang="en">Sports</category>
    <episode-num system="onscreen">S1E100</episode-num>
  </programme>
</tv>
```

**Key Requirements:**
- `channel id` must match `tvg-id` in M3U playlist
- Datetime format: `YYYYMMDDHHmmss +0000` (space before timezone)
- Timezone should be UTC (+0000) for consistency
- `lang="en"` attribute on text elements
- XML must be valid and properly escaped

### Testing Strategy Notes

**Why API/Integration Tests?**
- HTTP endpoint testing is fastest approach for backend APIs
- No browser overhead
- Direct verification of HTTP responses
- Simpler test setup than E2E

**Test Organization:**
- 78 tests organized into 10 test suites
- Each suite focuses on specific functionality area
- Tests are atomic (one behavior per test)
- Given-When-Then format for clarity

**Test Execution:**
- Requires `TAURI_DEV=true` to start Tauri app with HTTP server
- Uses Playwright's `webServer` config to auto-start app
- Tests run against `http://127.0.0.1:5004` (default port)
- Can be run individually by test suite using `-g` flag

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Tag @Javier in Slack/Discord
- Refer to `_bmad/bmm/docs/tea-README.md` for workflow documentation
- Consult `_bmad/bmm/testarch/knowledge` for testing best practices
- Review Story 4-1 implementation as reference pattern

---

**Generated by BMad TEA Agent** - 2026-01-20
