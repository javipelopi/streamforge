# Story 4.1: Serve M3U Playlist Endpoint

Status: review

## Story

As a user,
I want an M3U playlist URL I can add to Plex,
So that Plex can see my channel lineup.

## Background

This is the **first story in Epic 4: Plex Integration & Streaming**. Epic 4 enables users to add StreamForge as a tuner in Plex and watch live TV. This story implements the M3U playlist endpoint that Plex uses to discover the channel lineup.

**XMLTV-First Design Principle:** The M3U playlist uses XMLTV channel information (names, IDs, icons) because XMLTV channels are the PRIMARY channel list for Plex. Xtream streams are matched TO XMLTV channels as video sources.

**Epic 4 Story Sequence:**
1. **Story 4-1 (this):** M3U playlist endpoint
2. Story 4-2: XMLTV EPG endpoint
3. Story 4-3: HDHomeRun emulation
4. Story 4-4: Stream proxy with quality selection
5. Story 4-5: Automatic stream failover
6. Story 4-6: Display Plex configuration URLs

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

## Tasks / Subtasks

### Backend - M3U Endpoint Implementation

- [x] Task 1: Create M3U handler module (AC: #1, #2, #3)
  - [x] 1.1 Create `src-tauri/src/server/m3u.rs` module
  - [x] 1.2 Define `M3uChannel` struct for internal representation:
    ```rust
    struct M3uChannel {
        xmltv_channel_id: i32,
        display_name: String,
        channel_number: i32,
        logo_url: Option<String>,
        tvg_id: String,
    }
    ```
  - [x] 1.3 Implement `generate_m3u_playlist` function
  - [x] 1.4 Add module export in `src-tauri/src/server/mod.rs`

- [x] Task 2: Implement M3U channel query (AC: #1, #3)
  - [x] 2.1 Create `get_enabled_channels_for_m3u` function in `m3u.rs`
  - [x] 2.2 Query enabled XMLTV channels with their settings:
    ```sql
    SELECT xc.id, xc.channel_id, xc.display_name, xc.icon, xc.is_synthetic,
           xcs.plex_display_order
    FROM xmltv_channels xc
    INNER JOIN xmltv_channel_settings xcs ON xc.id = xcs.xmltv_channel_id
    WHERE xcs.is_enabled = 1
    ORDER BY xcs.plex_display_order ASC NULLS LAST, xc.display_name ASC
    ```
  - [x] 2.3 Filter out channels without any mapped Xtream streams:
    ```sql
    AND EXISTS (
      SELECT 1 FROM channel_mappings cm
      WHERE cm.xmltv_channel_id = xc.id
    )
    ```
  - [x] 2.4 Handle synthetic channels (is_synthetic = 1) - same query, they have mappings

- [x] Task 3: Implement logo URL resolution (AC: #1)
  - [x] 3.1 Create `resolve_channel_logo` function
  - [x] 3.2 Priority order:
    1. XMLTV channel icon (if not null/empty)
    2. Primary Xtream stream icon (fallback)
    3. No logo (omit tvg-logo attribute)
  - [x] 3.3 Query primary Xtream stream icon if XMLTV icon is missing:
    ```sql
    SELECT xtc.stream_icon
    FROM channel_mappings cm
    INNER JOIN xtream_channels xtc ON cm.xtream_channel_id = xtc.id
    WHERE cm.xmltv_channel_id = ? AND cm.is_primary = 1
    LIMIT 1
    ```

- [x] Task 4: Generate M3U playlist format (AC: #1, #2)
  - [x] 4.1 Implement M3U header: `#EXTM3U`
  - [x] 4.2 For each enabled channel, generate entry:
    ```
    #EXTINF:-1 tvg-id="{channel_id}" tvg-name="{display_name}" tvg-logo="{logo_url}" tvg-chno="{channel_number}",{display_name}
    http://127.0.0.1:{port}/stream/{xmltv_channel_id}
    ```
  - [x] 4.3 Use server port from AppState
  - [x] 4.4 Generate local IP for URL (127.0.0.1)
  - [x] 4.5 Ensure channel_number uses plex_display_order (or row index if null)

- [x] Task 5: Create HTTP endpoint handler (AC: #1)
  - [x] 5.1 Add `playlist_m3u` handler function in `src-tauri/src/server/handlers.rs`:
    ```rust
    pub async fn playlist_m3u(
        State(state): State<AppState>,
    ) -> impl IntoResponse {
        // Generate M3U content
        // Return with Content-Type: audio/x-mpegurl
    }
    ```
  - [x] 5.2 Return proper Content-Type header: `audio/x-mpegurl` or `application/x-mpegurl`
  - [x] 5.3 Handle database errors gracefully (return 500 with error message)

- [x] Task 6: Register route in router (AC: #1)
  - [x] 6.1 Edit `src-tauri/src/server/routes.rs`
  - [x] 6.2 Add route: `.route("/playlist.m3u", get(handlers::playlist_m3u))`
  - [x] 6.3 Import handler in routes.rs

### Testing

- [x] Task 7: Unit tests for M3U generation
  - [x] 7.1 Create `src-tauri/src/server/m3u_tests.rs` or add tests in m3u.rs
  - [x] 7.2 Test: Empty playlist when no enabled channels
  - [x] 7.3 Test: Single channel generates correct format
  - [x] 7.4 Test: Multiple channels ordered by plex_display_order
  - [x] 7.5 Test: Channels without streams are excluded
  - [x] 7.6 Test: Logo fallback from XMLTV to Xtream
  - [x] 7.7 Test: Synthetic channels included with correct info

- [x] Task 8: E2E tests for M3U endpoint
  - [x] 8.1 Create `tests/e2e/m3u-playlist.spec.ts`
  - [x] 8.2 Test: GET /playlist.m3u returns 200 OK
  - [x] 8.3 Test: Response Content-Type is audio/x-mpegurl
  - [x] 8.4 Test: Playlist starts with #EXTM3U
  - [x] 8.5 Test: Only enabled channels appear in playlist
  - [x] 8.6 Test: Disabled channels are excluded
  - [x] 8.7 Test: Channel order matches plex_display_order
  - [x] 8.8 Test: Stream URLs use xmltv_channel_id

- [x] Task 9: Build verification
  - [x] 9.1 Run `cargo check` - no Rust errors
  - [x] 9.2 Run `cargo test` - all tests pass
  - [x] 9.3 Run `npm run build` - build succeeds

## Dev Notes

### CRITICAL: XMLTV-First Architecture

The M3U playlist MUST use XMLTV channel information because:
- XMLTV channels define the Plex lineup (names, numbers, EPG IDs)
- Xtream streams are video SOURCES mapped to XMLTV channels
- The `/stream/{id}` endpoint uses `xmltv_channel_id` (Story 4-4 will resolve to Xtream stream)

[Source: _bmad-output/planning-artifacts/architecture.md#Data Flow]

### Existing Server Infrastructure

The HTTP server foundation was built in Story 1-5. Key files:
- `src-tauri/src/server/mod.rs` - Server module with `start_server()`
- `src-tauri/src/server/routes.rs` - Axum router configuration
- `src-tauri/src/server/handlers.rs` - Request handlers
- `src-tauri/src/server/state.rs` - AppState with DB pool

Current routes:
- `GET /health` - Health check (returns 200 OK)
- Fallback - 404 Not Found

[Source: src-tauri/src/server/routes.rs:13-18]

### Database Schema Reference

**xmltv_channels table:**
```sql
CREATE TABLE xmltv_channels (
    id INTEGER PRIMARY KEY,
    source_id INTEGER REFERENCES xmltv_sources(id),
    channel_id TEXT NOT NULL,      -- XMLTV channel ID (tvg-id)
    display_name TEXT NOT NULL,    -- Channel name for Plex
    icon TEXT,                     -- Logo URL
    is_synthetic INTEGER DEFAULT 0 -- 1 if promoted orphan
);
```

**xmltv_channel_settings table:**
```sql
CREATE TABLE xmltv_channel_settings (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER UNIQUE REFERENCES xmltv_channels(id),
    is_enabled INTEGER DEFAULT 0,      -- 1 = appears in Plex
    plex_display_order INTEGER         -- Channel number
);
```

**channel_mappings table:**
```sql
CREATE TABLE channel_mappings (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER REFERENCES xmltv_channels(id),
    xtream_channel_id INTEGER REFERENCES xtream_channels(id),
    match_confidence REAL,
    is_manual INTEGER DEFAULT 0,
    is_primary INTEGER DEFAULT 0,  -- Use this stream for M3U
    stream_priority INTEGER DEFAULT 0
);
```

[Source: src-tauri/src/db/schema.rs]

### M3U Format Specification

Standard M3U8 format for Plex compatibility:

```
#EXTM3U
#EXTINF:-1 tvg-id="ESPN.US" tvg-name="ESPN" tvg-logo="http://example.com/espn.png" tvg-chno="206",ESPN
http://127.0.0.1:5004/stream/123
#EXTINF:-1 tvg-id="CNN.US" tvg-name="CNN" tvg-logo="http://example.com/cnn.png" tvg-chno="207",CNN
http://127.0.0.1:5004/stream/124
```

**Attributes:**
- `tvg-id`: XMLTV channel_id (matches EPG data)
- `tvg-name`: Display name (duplicated after comma)
- `tvg-logo`: Channel logo URL (optional)
- `tvg-chno`: Channel number in Plex (from plex_display_order)

[Source: _bmad-output/planning-artifacts/architecture.md#HTTP Server Endpoints]

### Plex Requirements

Plex expects:
1. Content-Type: `audio/x-mpegurl` or `application/x-mpegurl`
2. UTF-8 encoding
3. Valid M3U8 format with EXTINF tags
4. Stream URLs that resolve (will be implemented in Story 4-4)

### Performance Considerations

- Query should be efficient even with 1000+ channels
- Use indexed columns: `is_enabled`, `plex_display_order`
- M3U generation is O(n) where n = enabled channels
- Response should be <100ms for normal channel counts (NFR5)

### Previous Epic Learnings (Epic 3)

From Story 3-11 code review:
- Use proper error handling with descriptive messages
- Add data-testid attributes for E2E testing
- Follow existing patterns in handlers.rs
- Use `#[serde(rename_all = "camelCase")]` for JSON responses
- Clean up resources on error paths

From Story 3-5 (enable/disable for Plex):
- Channel enable state is in `xmltv_channel_settings.is_enabled`
- Channels without matched streams cannot be enabled (enforced in UI)
- The TODO comment in handlers.rs (lines 30-56) provides implementation hints

### Files to Create

```
src-tauri/src/server/m3u.rs  (new - M3U generation logic)
tests/e2e/m3u-playlist.spec.ts (new - E2E tests)
```

### Files to Modify

```
src-tauri/src/server/mod.rs (add m3u module export)
src-tauri/src/server/routes.rs (add /playlist.m3u route)
src-tauri/src/server/handlers.rs (add playlist_m3u handler, remove TODO comment)
```

### Axum Handler Pattern

Follow the existing pattern from health_check:

```rust
use axum::{
    extract::State,
    http::{header, StatusCode},
    response::IntoResponse,
};

pub async fn playlist_m3u(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let conn = state.get_connection()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let m3u_content = m3u::generate_m3u_playlist(&mut conn, state.get_port())
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((
        [(header::CONTENT_TYPE, "audio/x-mpegurl")],
        m3u_content
    ))
}
```

### Diesel Query Pattern

Use Diesel's query builder for type-safe queries:

```rust
use diesel::prelude::*;
use crate::db::schema::{xmltv_channels, xmltv_channel_settings, channel_mappings};

let enabled_channels = xmltv_channels::table
    .inner_join(xmltv_channel_settings::table)
    .filter(xmltv_channel_settings::is_enabled.eq(1))
    .order(xmltv_channel_settings::plex_display_order.asc())
    .select((
        xmltv_channels::id,
        xmltv_channels::channel_id,
        xmltv_channels::display_name,
        xmltv_channels::icon,
        xmltv_channel_settings::plex_display_order,
    ))
    .load::<(Option<i32>, String, String, Option<String>, Option<i32>)>(conn)?;
```

### Testing Strategy

**Unit Tests (Rust):**
- Test M3U format generation with mock data
- Test channel ordering logic
- Test logo fallback logic
- Test empty channel handling

**E2E Tests (Playwright):**
- Mock Tauri backend responses
- Test HTTP endpoint returns correct content
- Test only enabled channels appear
- Test proper Content-Type header

### Stream URL Format

The stream URL format is critical for Story 4-4 integration:

```
http://127.0.0.1:{port}/stream/{xmltv_channel_id}
```

- Use `127.0.0.1` (localhost) per NFR21 security requirement
- Port from settings (default 5004)
- ID is `xmltv_channel_id` (NOT xtream stream_id)

The `/stream` endpoint (Story 4-4) will:
1. Look up primary Xtream stream from channel_mappings
2. Proxy the stream from Xtream provider
3. Handle failover to backup streams (Story 4-5)

### Project Structure Notes

This story follows the established patterns:
- Server modules in `src-tauri/src/server/`
- Database models in `src-tauri/src/db/models.rs`
- E2E tests in `tests/e2e/`
- TypeScript types in `src/lib/tauri.ts` (not needed for this story - backend only)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#HTTP Server]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Flow]
- [Source: src-tauri/src/server/mod.rs]
- [Source: src-tauri/src/server/routes.rs]
- [Source: src-tauri/src/server/handlers.rs:30-56 - TODO comment with hints]
- [Source: src-tauri/src/db/schema.rs]
- [Source: src-tauri/src/db/models.rs]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Fixed pre-existing icon format issue (16x16.png not RGBA) during build verification

### Completion Notes List

- Implemented M3U playlist generation module following XMLTV-first architecture
- Created `M3uChannel` struct for internal channel representation
- Implemented `get_enabled_channels_for_m3u()` function with SQL query that:
  - Joins xmltv_channels with xmltv_channel_settings
  - Filters only enabled channels (is_enabled = 1)
  - Excludes channels without Xtream stream mappings
  - Orders by plex_display_order (nulls last), then display_name
- Implemented `resolve_channel_logo()` with priority: XMLTV icon → Xtream fallback → None
- Implemented `generate_m3u_from_channels()` for M3U format generation
- Created HTTP handler `playlist_m3u` returning Content-Type: audio/x-mpegurl
- Registered route `/playlist.m3u` in Axum router
- Added 18 unit tests covering:
  - Attribute escaping (quotes, newlines, unicode)
  - Empty playlist generation
  - Single/multiple channel formatting
  - Port configuration in URLs
  - Stream URL format (127.0.0.1, xmltv_channel_id)
  - M3U format structure validation
  - Synthetic channel handling
- E2E tests pre-written in tests/integration/m3u-playlist.spec.ts (ATDD)
- All 137 Rust tests pass (129 unit + 6 integration + 2 doc)
- Vite frontend build succeeds
- Cargo build succeeds

### File List

**New Files:**
- src-tauri/src/server/m3u.rs (M3U generation logic with 18 unit tests)

**Modified Files:**
- src-tauri/src/server/mod.rs (added m3u module export)
- src-tauri/src/server/handlers.rs (added playlist_m3u handler, removed TODO comment)
- src-tauri/src/server/routes.rs (added /playlist.m3u route)
- src-tauri/icons/16x16.png (converted to RGBA format to fix build error)

**Pre-existing Test Files (ATDD):**
- tests/integration/m3u-playlist.spec.ts (E2E tests written before implementation)

## Change Log

| Date | Change |
|------|--------|
| 2026-01-20 | Implemented M3U playlist endpoint (GET /playlist.m3u) with XMLTV-first architecture |
