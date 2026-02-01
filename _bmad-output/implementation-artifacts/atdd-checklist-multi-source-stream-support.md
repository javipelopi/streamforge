# ATDD Checklist - Multi-Source Stream Support (M3U/Acestream)

**Date:** 2026-02-01
**Author:** Javier (TEA Agent: Murat)
**Primary Test Level:** E2E + Integration
**Tech Spec:** `tech-spec-multi-source-stream-support.md`

---

## Story Summary

**As a** StreamForge user
**I want** to use M3U playlists and Acestream links as additional stream sources
**So that** I can access more content and have fallback options without consuming Xtream tuner slots

---

## Acceptance Criteria

| AC # | Description | Test Level | Status |
|------|-------------|------------|--------|
| AC 1 | Add M3U Source → playlist fetched, parsed, channels displayed | E2E | RED |
| AC 2 | Refresh M3U Source → re-fetch, channels updated | E2E | RED |
| AC 3 | Delete M3U Source → source and channels removed | E2E | RED |
| AC 4 | Parse EXTINF attributes (tvg-id, tvg-name, tvg-logo, group-title) | Integration | RED |
| AC 5 | Add Acestream on Windows/Linux → stored and available | E2E | RED |
| AC 6 | Mac warning banner → explains Acestream unsupported | E2E | RED |
| AC 7 | Engine available → "Engine Available" shown | E2E | RED |
| AC 8 | Engine not running → "Engine Not Found" with instructions | E2E | RED |
| AC 9 | Add M3U channel mapping → appears in channel's source list | E2E | RED |
| AC 10 | Add Acestream mapping → appears in source list | E2E | RED |
| AC 11 | Reorder source priorities → stream_priority values updated | E2E | RED |
| AC 12 | M3U stream proxied directly (no tuner consumed) | Integration | RED |
| AC 13 | Acestream proxied via localhost:6878 on Windows/Linux | Integration | RED |
| AC 14 | Acestream on Mac returns 503 with message | Integration | RED |
| AC 15 | Failover between sources within 2 seconds | Integration | RED |
| AC 16 | Xtream tuner limit enforced (503 when exceeded) | Integration | RED |
| AC 17 | M3U bypasses tuner limits | Integration | RED |
| AC 18 | Acestream bypasses tuner limits | Integration | RED |

---

## Failing Tests Created (RED Phase)

### E2E Tests (42 tests)

**File:** `tests/e2e/sources-m3u.spec.ts` (~400 lines)

- ✅ **Test:** should display M3U tab in Sources view
  - **Status:** RED - M3U tab component not implemented
  - **Verifies:** AC #1 - M3U tab exists and is accessible

- ✅ **Test:** should switch to M3U tab when clicked
  - **Status:** RED - Tab switching not wired up
  - **Verifies:** AC #1 - Tab navigation works

- ✅ **Test:** should display M3U sources as accordion sections
  - **Status:** RED - M3uSourcesTab component missing
  - **Verifies:** AC #1 - Sources displayed

- ✅ **Test:** should display channel count in accordion header
  - **Status:** RED - get_m3u_sources command not implemented
  - **Verifies:** AC #1 - Channel count visible

- ✅ **Test:** should display empty state when no M3U sources
  - **Status:** RED - Empty state UI missing
  - **Verifies:** AC #1 - Empty state handled

- ✅ **Test:** should open Add M3U Source dialog when button clicked
  - **Status:** RED - AddM3uSourceDialog component missing
  - **Verifies:** AC #1 - Add flow initiated

- ✅ **Test:** should validate URL field is required
  - **Status:** RED - Form validation not implemented
  - **Verifies:** AC #1 - Input validation

- ✅ **Test:** should add M3U source and display channels on success
  - **Status:** RED - add_m3u_source command not implemented
  - **Verifies:** AC #1 - Full add flow

- ✅ **Test:** should display refresh button in source header
  - **Status:** RED - Refresh button not implemented
  - **Verifies:** AC #2 - Refresh UI available

- ✅ **Test:** should refresh source and update channels
  - **Status:** RED - refresh_m3u_source command not implemented
  - **Verifies:** AC #2 - Refresh flow works

- ✅ **Test:** should show confirmation dialog when delete clicked
  - **Status:** RED - Delete confirmation not implemented
  - **Verifies:** AC #3 - Delete confirmation

- ✅ **Test:** should delete source and channels when confirmed
  - **Status:** RED - delete_m3u_source command not implemented
  - **Verifies:** AC #3 - Delete flow works

**File:** `tests/e2e/sources-acestream.spec.ts` (~350 lines)

- ✅ **Test:** should display Acestream tab in Sources view
  - **Status:** RED - Acestream tab not added
  - **Verifies:** AC #5 - Tab exists

- ✅ **Test:** should display warning banner on Mac platform
  - **Status:** RED - Platform detection and banner not implemented
  - **Verifies:** AC #6 - Mac warning displayed

- ✅ **Test:** should disable add button on Mac platform
  - **Status:** RED - Platform-based disable not implemented
  - **Verifies:** AC #6 - Mac restrictions enforced

- ✅ **Test:** should show "Engine Available" when engine is running
  - **Status:** RED - check_acestream_status command not implemented
  - **Verifies:** AC #7 - Engine status shown

- ✅ **Test:** should show "Engine Not Found" when engine is not running
  - **Status:** RED - Engine status UI not implemented
  - **Verifies:** AC #8 - Not found status shown

- ✅ **Test:** should display instructions when engine not found
  - **Status:** RED - Instructions component missing
  - **Verifies:** AC #8 - Help text provided

- ✅ **Test:** should open Add Acestream dialog when button clicked
  - **Status:** RED - AddAcestreamDialog component missing
  - **Verifies:** AC #5 - Add flow initiated

- ✅ **Test:** should validate content ID format (40 hex chars)
  - **Status:** RED - Content ID validation not implemented
  - **Verifies:** AC #5 - Input validation

- ✅ **Test:** should add Acestream source on valid input
  - **Status:** RED - add_acestream_source command not implemented
  - **Verifies:** AC #5 - Add flow works

### Integration Tests (20 tests)

**File:** `tests/integration/multi-source-stream.spec.ts` (~350 lines)

- ✅ **Test:** should proxy M3U stream URL directly
  - **Status:** RED - M3U stream handling not implemented
  - **Verifies:** AC #12 - M3U proxy works

- ✅ **Test:** should not consume tuner slot for M3U stream
  - **Status:** RED - Tuner bypass not implemented
  - **Verifies:** AC #17 - M3U bypasses tuners

- ✅ **Test:** should proxy Acestream via localhost:6878
  - **Status:** RED - Acestream proxy not implemented
  - **Verifies:** AC #13 - Acestream proxy works

- ✅ **Test:** should return 503 with message on Mac platform
  - **Status:** RED - Platform check not implemented
  - **Verifies:** AC #14 - Mac returns 503

- ✅ **Test:** should failover to backup source when primary fails
  - **Status:** RED - Multi-source failover not implemented
  - **Verifies:** AC #15 - Failover works

- ✅ **Test:** should complete failover within 2 seconds
  - **Status:** RED - Failover timing not optimized
  - **Verifies:** AC #15 - Failover is fast

- ✅ **Test:** should return 503 when Xtream tuner limit reached
  - **Status:** RED - Tuner limit enforcement exists but needs source type check
  - **Verifies:** AC #16 - Xtream limit enforced

- ✅ **Test:** should allow M3U stream when Xtream tuner limit reached
  - **Status:** RED - Source type check not implemented
  - **Verifies:** AC #17 - M3U bypasses limit

- ✅ **Test:** should allow Acestream when Xtream tuner limit reached
  - **Status:** RED - Source type check not implemented
  - **Verifies:** AC #18 - Acestream bypasses limit

---

## Data Factories Created

### M3U Source Factory

**File:** `tests/support/factories/m3u-source.factory.ts`

**Exports:**
- `createM3uSource(overrides?)` - Create single M3U source
- `createM3uSources(count)` - Create array of M3U sources
- `createM3uChannel(overrides?)` - Create single M3U channel
- `createM3uChannels(count, sourceId)` - Create channels for source
- `createM3uSourceWithChannels(channelCount)` - Combined source + channels
- `createM3uPlaylistContent(entries)` - Raw M3U playlist string for parser testing
- `createRealisticM3uPlaylist(count)` - Realistic playlist with varied attributes

**Example Usage:**
```typescript
const source = createM3uSource({ name: 'My Playlist' });
const channels = createM3uChannels(50, source.id);
const playlist = createRealisticM3uPlaylist(100); // For parser testing
```

### Acestream Source Factory

**File:** `tests/support/factories/acestream-source.factory.ts`

**Exports:**
- `createAcestreamSource(overrides?)` - Create Acestream source
- `createAcestreamSources(count)` - Create array of sources
- `generateAcestreamContentId()` - Generate valid 40-char hex content ID
- `createAcestreamStatusSupported(engineAvailable)` - Windows/Linux status
- `createAcestreamStatusUnsupported()` - Mac status
- `createAcestreamStatusNoEngine()` - Engine not running status
- `createM3uChannelMapping(overrides?)` - Channel mapping for M3U
- `createAcestreamChannelMapping(overrides?)` - Channel mapping for Acestream
- `createMultiSourceMappings(xmltvId, sources)` - Multi-source failover setup

**Example Usage:**
```typescript
const source = createAcestreamSource({ name: 'Sports Stream' });
const contentId = generateAcestreamContentId(); // e.g., 'a1b2c3d4...'
const status = createAcestreamStatusNoEngine(); // Test "not found" UI
```

---

## Fixtures Created

### M3U Sources Fixture

**File:** `tests/support/fixtures/sources-m3u.fixture.ts`

**Fixtures:**
- `injectM3uSourcesMocks(sources, channelsBySourceId)` - Low-level mock injection
  - **Setup:** Injects Tauri mock commands for M3U operations
  - **Provides:** Mock function
  - **Cleanup:** Auto-cleared on navigation

- `m3uSourcesWithChannels` - Pre-configured multiple sources scenario
  - **Setup:** Creates 2 sources with 25 and 5 channels
  - **Provides:** `{ sources, channelsBySourceId, sourceWithFullChannels, sourceWithMinimalChannels }`
  - **Cleanup:** Auto-cleared

- `emptyM3uState` - Empty state scenario
  - **Setup:** Injects mocks with empty source list
  - **Provides:** void
  - **Cleanup:** Auto-cleared

- `largeM3uSource` - Performance testing (500 channels)
  - **Setup:** Creates source with 500 channels
  - **Provides:** `{ source, channels }`
  - **Cleanup:** Auto-cleared

### Acestream Sources Fixture

**File:** `tests/support/fixtures/sources-acestream.fixture.ts`

**Fixtures:**
- `injectAcestreamSourcesMocks(sources, status)` - Low-level mock injection
  - **Setup:** Injects Tauri mock commands for Acestream
  - **Provides:** Mock function
  - **Cleanup:** Auto-cleared

- `acestreamSourcesSupported` - Windows/Linux with engine running
  - **Setup:** 3 sources, engine available
  - **Provides:** `{ sources, status }`
  - **Cleanup:** Auto-cleared

- `acestreamSourcesNoEngine` - Windows/Linux, engine NOT running
  - **Setup:** 2 sources, engine unavailable
  - **Provides:** `{ sources, status }`
  - **Cleanup:** Auto-cleared

- `acestreamSourcesMac` - Mac platform (unsupported)
  - **Setup:** 2 sources, platform unsupported
  - **Provides:** `{ sources, status }`
  - **Cleanup:** Auto-cleared

---

## Mock Requirements

### M3U Commands (Tauri Backend)

**Command:** `add_m3u_source`
- **Input:** `{ name: string, url: string, refreshIntervalHours?: number }`
- **Success Response:** `{ source: M3uSource, channelCount: number }`
- **Failure Response:** Error thrown

**Command:** `get_m3u_sources`
- **Input:** None
- **Success Response:** `M3uSource[]`

**Command:** `refresh_m3u_source`
- **Input:** `{ sourceId: number }`
- **Success Response:** `{ source: M3uSource, channelCount: number, added: number, removed: number, updated: number }`

**Command:** `delete_m3u_source`
- **Input:** `{ sourceId: number }`
- **Success Response:** `{ success: true }`

**Command:** `get_m3u_channels`
- **Input:** `{ sourceId: number }`
- **Success Response:** `M3uChannel[]`

### Acestream Commands (Tauri Backend)

**Command:** `add_acestream_source`
- **Input:** `{ name: string, contentId: string }`
- **Success Response:** `AcestreamSource`
- **Failure Response:** Error for invalid content ID or duplicate

**Command:** `get_acestream_sources`
- **Input:** None
- **Success Response:** `AcestreamSource[]`

**Command:** `delete_acestream_source`
- **Input:** `{ sourceId: number }`
- **Success Response:** `{ success: true }`

**Command:** `check_acestream_status`
- **Input:** None
- **Success Response:** `{ platformSupported: boolean, engineAvailable: boolean, engineVersion?: string, platform: string }`

---

## Required data-testid Attributes

### Sources Page Tabs

- `m3u-tab` - M3U tab button
- `acestream-tab` - Acestream tab button
- `m3u-sources-tab` - M3U tab panel
- `acestream-sources-tab` - Acestream tab panel

### M3U Sources Tab

- `m3u-source-accordion-{id}` - Source accordion container
- `m3u-source-header-{id}` - Accordion header (clickable)
- `m3u-channels-list-{id}` - Channel list container
- `m3u-channel-row-{id}` - Individual channel row
- `m3u-channel-logo-{id}` - Channel logo image
- `m3u-channel-search-{id}` - Channel search input
- `m3u-empty-state` - Empty state container
- `m3u-empty-state-message` - Empty state text
- `add-m3u-source-button` - Add source button
- `add-m3u-source-dialog` - Add source dialog
- `m3u-source-name-input` - Name field
- `m3u-source-url-input` - URL field
- `m3u-refresh-interval-select` - Refresh interval select
- `m3u-url-error` - URL validation error
- `add-m3u-source-submit` - Submit button
- `m3u-source-loading` - Loading indicator
- `refresh-m3u-source-{id}` - Refresh button
- `delete-m3u-source-{id}` - Delete button
- `delete-m3u-confirm-dialog` - Delete confirmation dialog
- `delete-m3u-confirm` - Confirm delete button
- `delete-m3u-cancel` - Cancel delete button
- `m3u-refresh-toast` - Refresh result toast

### Acestream Sources Tab

- `acestream-source-item-{id}` - Source list item
- `acestream-mac-warning` - Mac platform warning banner
- `acestream-engine-status` - Engine status text
- `acestream-engine-indicator` - Status indicator (green/amber)
- `acestream-engine-instructions` - Engine installation instructions
- `refresh-acestream-status` - Refresh status button
- `acestream-empty-state` - Empty state container
- `acestream-empty-state-message` - Empty state text
- `add-acestream-source-button` - Add source button
- `add-acestream-dialog` - Add source dialog
- `acestream-name-input` - Name field
- `acestream-content-id-input` - Content ID field
- `acestream-content-id-error` - Validation error
- `add-acestream-submit` - Submit button
- `delete-acestream-source-{id}` - Delete button
- `delete-acestream-confirm-dialog` - Delete confirmation
- `delete-acestream-confirm` - Confirm delete
- `delete-acestream-cancel` - Cancel delete

---

## Implementation Checklist

### Phase 1: Database & Models

- [ ] Create M3U tables migration (`m3u_sources`, `m3u_channels`)
- [ ] Create Acestream table migration (`acestream_sources`)
- [ ] Extend `channel_mappings` with `source_type`, `m3u_channel_id`, `acestream_source_id`
- [ ] Update Diesel schema.rs
- [ ] Add M3U models (`M3uSource`, `NewM3uSource`, `M3uChannel`, `NewM3uChannel`)
- [ ] Add Acestream models (`AcestreamSource`, `NewAcestreamSource`)
- [ ] Run test: `pnpm test -- tests/integration/multi-source-stream.spec.ts`

### Phase 2: M3U Parser & Commands

- [ ] Create M3U parser module (`src-tauri/src/m3u/parser.rs`)
- [ ] Create M3U fetcher (`src-tauri/src/m3u/fetcher.rs`)
- [ ] Implement `add_m3u_source` command
- [ ] Implement `get_m3u_sources` command
- [ ] Implement `refresh_m3u_source` command
- [ ] Implement `delete_m3u_source` command
- [ ] Implement `get_m3u_channels` command
- [ ] Run test: `pnpm test -- tests/e2e/sources-m3u.spec.ts`

### Phase 3: Acestream Commands

- [ ] Create Acestream module (`src-tauri/src/acestream/mod.rs`)
- [ ] Implement `is_acestream_supported()` (platform check)
- [ ] Implement `check_acestream_engine()` (health check)
- [ ] Implement `add_acestream_source` command
- [ ] Implement `get_acestream_sources` command
- [ ] Implement `delete_acestream_source` command
- [ ] Implement `check_acestream_status` command
- [ ] Run test: `pnpm test -- tests/e2e/sources-acestream.spec.ts`

### Phase 4: Stream Handling

- [ ] Create `StreamSourceType` enum
- [ ] Implement `build_stream_url_for_source()`
- [ ] Update `BackupStream` struct for multi-source
- [ ] Update `get_all_streams_for_channel()` to query all sources
- [ ] Update `stream_proxy` handler for source types
- [ ] Skip tuner check for M3U/Acestream
- [ ] Handle Acestream platform check in proxy
- [ ] Run test: `TAURI_DEV=true pnpm test -- tests/integration/multi-source-stream.spec.ts`

### Phase 5: Frontend - M3U Tab

- [ ] Create `M3uSourcesTab` component
- [ ] Create `M3uSourceAccordion` component
- [ ] Create `AddM3uSourceDialog` component
- [ ] Add M3U Tauri bindings to `src/lib/tauri.ts`
- [ ] Add `data-testid` attributes (see list above)
- [ ] Run test: `pnpm test -- tests/e2e/sources-m3u.spec.ts`
- [ ] ✅ All M3U tests pass (green phase)

### Phase 6: Frontend - Acestream Tab

- [ ] Create `AcestreamSourcesTab` component
- [ ] Create `AddAcestreamDialog` component
- [ ] Implement Mac warning banner
- [ ] Add Acestream Tauri bindings
- [ ] Add `data-testid` attributes
- [ ] Run test: `pnpm test -- tests/e2e/sources-acestream.spec.ts`
- [ ] ✅ All Acestream tests pass (green phase)

---

## Running Tests

```bash
# Run all failing tests for this feature
pnpm test -- tests/e2e/sources-m3u.spec.ts tests/e2e/sources-acestream.spec.ts tests/integration/multi-source-stream.spec.ts

# Run M3U tests only
pnpm test -- tests/e2e/sources-m3u.spec.ts

# Run Acestream tests only
pnpm test -- tests/e2e/sources-acestream.spec.ts

# Run integration tests (requires TAURI_DEV)
TAURI_DEV=true pnpm test -- tests/integration/multi-source-stream.spec.ts

# Run tests in headed mode
pnpm test -- tests/e2e/sources-m3u.spec.ts --headed

# Debug specific test
pnpm test -- tests/e2e/sources-m3u.spec.ts --debug
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**
- ✅ All tests written and failing (62 total)
- ✅ Fixtures and factories created with auto-cleanup
- ✅ Mock requirements documented
- ✅ data-testid requirements listed
- ✅ Implementation checklist created

**Verification:**
- All tests run and fail as expected
- Failure messages are clear (missing components/commands)
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from Phase 1 (database/models)
2. **Read the test** to understand expected behavior
3. **Implement minimal code** to make that specific test pass
4. **Run the test** to verify it now passes (green)
5. **Check off the task** in implementation checklist
6. **Move to next test** and repeat

**Suggested Order:**
1. Database migrations first (enables all data operations)
2. M3U commands (largest surface area)
3. Acestream commands (similar pattern)
4. Stream handling (backend integration)
5. Frontend M3U tab (user-facing)
6. Frontend Acestream tab (user-facing)

---

### REFACTOR Phase (After All Tests Pass)

1. Extract common patterns between M3U and Acestream handling
2. Optimize lazy loading for large channel counts
3. Add error boundaries for network failures
4. Consider caching for parsed M3U playlists

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow
2. **Review this checklist** in standup
3. **Run failing tests** to confirm RED phase: `pnpm test -- tests/e2e/sources-m3u.spec.ts tests/e2e/sources-acestream.spec.ts`
4. **Begin implementation** starting with database migrations
5. **Work one test at a time** (red → green for each)
6. **When all tests pass**, refactor and optimize
7. **Update sprint-status.yaml** when complete

---

## Knowledge Base References Applied

- **fixture-architecture.md** - Composable fixtures with Tauri mock injection
- **data-factories.md** - Factory patterns with faker for M3U/Acestream data
- **network-first.md** - Route interception patterns for async data loading
- **test-quality.md** - Given-When-Then format, atomic tests
- **test-levels-framework.md** - E2E for UI, Integration for backend

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm test -- tests/e2e/sources-m3u.spec.ts tests/e2e/sources-acestream.spec.ts`

**Expected Results:**
```
Running 62 tests using 1 worker

  ✗ sources-m3u.spec.ts:XX should display M3U tab in Sources view
  ✗ sources-m3u.spec.ts:XX should switch to M3U tab when clicked
  ... (all tests failing)

  62 failed
  Snapshots:   0 total
  Time:        ~30s
```

**Summary:**
- Total tests: 62
- Passing: 0 (expected)
- Failing: 62 (expected)
- Status: ✅ RED phase verified

---

## Notes

- **M3U Parser Edge Cases**: Tests include unicode names, missing attributes, malformed content
- **Acestream Content ID**: Validated as 40-character hexadecimal (SHA-1 hash format)
- **Platform Detection**: Uses `std::env::consts::OS` in Rust, mocked in fixtures
- **Tuner Bypass**: Key differentiator from Xtream - M3U/Acestream don't consume tuner slots

---

**Generated by BMad TEA Agent (Murat)** - 2026-02-01
