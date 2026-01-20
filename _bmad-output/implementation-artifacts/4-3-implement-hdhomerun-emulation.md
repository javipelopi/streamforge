# Story 4.3: Implement HDHomeRun Emulation

Status: review

## Story

As a user,
I want Plex to auto-discover my tuner,
So that I don't have to manually enter URLs.

## Background

This is the **third story in Epic 4: Plex Integration & Streaming**. Epic 4 enables users to add StreamForge as a tuner in Plex and watch live TV. This story implements HDHomeRun device emulation that allows Plex to automatically discover StreamForge as a TV tuner.

**XMLTV-First Design Principle:** HDHomeRun endpoints serve enabled XMLTV channels only. Channel names and numbers come from XMLTV data, matching M3U and EPG endpoints.

**Epic 4 Story Sequence:**
1. Story 4-1 (done): M3U playlist endpoint
2. Story 4-2 (done): XMLTV EPG endpoint
3. **Story 4-3 (this):** HDHomeRun emulation
4. Story 4-4: Stream proxy with quality selection
5. Story 4-5: Automatic stream failover
6. Story 4-6: Display Plex configuration URLs

## Acceptance Criteria

1. **Given** the HTTP server is running
   **When** Plex requests `GET /discover.json`
   **Then** a valid HDHomeRun discovery response is returned with:
   - FriendlyName: "StreamForge"
   - ModelNumber: "HDHR5-4K"
   - TunerCount from Xtream account
   - BaseURL and LineupURL with local IP and port

2. **Given** the HTTP server is running
   **When** Plex requests `GET /lineup.json`
   **Then** a channel lineup is returned with enabled XMLTV channels:
   - GuideName uses XMLTV channel display_name
   - GuideNumber uses plex_display_order
   - URL points to stream endpoint `/stream/{xmltv_channel_id}`

3. **Given** the HTTP server is running
   **When** Plex requests `GET /lineup_status.json`
   **Then** a valid status response is returned indicating no scan in progress

## Tasks / Subtasks

### Backend - HDHomeRun Endpoint Implementation

- [x] Task 1: Create HDHomeRun handler module (AC: #1, #2, #3)
  - [x] 1.1 Create `src-tauri/src/server/hdhr.rs` module
  - [x] 1.2 Define structs for HDHomeRun JSON responses:
    ```rust
    #[derive(Serialize)]
    #[serde(rename_all = "PascalCase")]
    pub struct DiscoverResponse {
        friendly_name: String,
        model_number: String,
        firmware_name: String,
        firmware_version: String,
        device_id: String,
        device_auth: String,
        #[serde(rename = "BaseURL")]
        base_url: String,
        #[serde(rename = "LineupURL")]
        lineup_url: String,
        tuner_count: u32,
    }

    #[derive(Serialize)]
    #[serde(rename_all = "PascalCase")]
    pub struct LineupEntry {
        guide_number: String,
        guide_name: String,
        #[serde(rename = "URL")]
        url: String,
    }

    #[derive(Serialize)]
    #[serde(rename_all = "PascalCase")]
    pub struct LineupStatusResponse {
        scan_in_progress: u8,
        scan_possible: u8,
        source: String,
        source_list: Vec<String>,
    }
    ```
  - [x] 1.3 Add module export in `src-tauri/src/server/mod.rs`

- [x] Task 2: Implement /discover.json endpoint (AC: #1)
  - [x] 2.1 Create `generate_discover_response` function
  - [x] 2.2 Get tuner count from accounts table (max_connections):
    ```sql
    SELECT COALESCE(MAX(max_connections), 2) as tuner_count
    FROM accounts
    WHERE is_active = 1
    ```
  - [x] 2.3 Get server port from settings (via state.get_port())
  - [x] 2.4 Detect local IP address for BaseURL/LineupURL:
    - Use `local_ip_address` crate or similar
    - Fallback to 127.0.0.1 if detection fails
  - [x] 2.5 Generate unique DeviceID (use machine ID hash or generate/persist UUID)
  - [x] 2.6 Return hardcoded device info:
    - FriendlyName: "StreamForge"
    - ModelNumber: "HDHR5-4K"
    - FirmwareName: "hdhomerun5_atsc"
    - FirmwareVersion: "20200101"
    - DeviceAuth: Short random string (can be static for local trust model)

- [x] Task 3: Implement /lineup.json endpoint (AC: #2)
  - [x] 3.1 Create `generate_lineup` function
  - [x] 3.2 Reuse channel query pattern from M3U endpoint (enabled XMLTV channels with streams):
    ```sql
    SELECT
      xc.id,
      xc.channel_id,
      xc.display_name,
      xcs.plex_display_order
    FROM xmltv_channels xc
    INNER JOIN xmltv_channel_settings xcs ON xc.id = xcs.xmltv_channel_id
    WHERE xcs.is_enabled = 1
    AND EXISTS (
      SELECT 1 FROM channel_mappings cm WHERE cm.xmltv_channel_id = xc.id
    )
    ORDER BY xcs.plex_display_order ASC NULLS LAST, xc.display_name ASC
    ```
  - [x] 3.3 Map to LineupEntry:
    - GuideNumber: plex_display_order as string (or channel index if null)
    - GuideName: display_name from XMLTV
    - URL: `http://{local_ip}:{port}/stream/{xmltv_channel_id}`
  - [x] 3.4 Return empty array `[]` if no enabled channels (valid response)

- [x] Task 4: Implement /lineup_status.json endpoint (AC: #3)
  - [x] 4.1 Create `generate_lineup_status` function
  - [x] 4.2 Return static response (no channel scanning capability):
    ```json
    {
      "ScanInProgress": 0,
      "ScanPossible": 0,
      "Source": "Cable",
      "SourceList": ["Cable"]
    }
    ```

- [x] Task 5: Create HTTP endpoint handlers (AC: #1, #2, #3)
  - [x] 5.1 Add handlers in `src-tauri/src/server/handlers.rs`:
    ```rust
    pub async fn discover_json(
        State(state): State<AppState>,
    ) -> Result<impl IntoResponse, (StatusCode, String)>

    pub async fn lineup_json(
        State(state): State<AppState>,
    ) -> Result<impl IntoResponse, (StatusCode, String)>

    pub async fn lineup_status_json() -> impl IntoResponse
    ```
  - [x] 5.2 Return Content-Type: application/json for all endpoints
  - [x] 5.3 Handle database errors gracefully (return 500 with opaque message, log details)
  - [x] 5.4 Follow error handling patterns from Story 4-1/4-2

- [x] Task 6: Register routes in router (AC: #1, #2, #3)
  - [x] 6.1 Edit `src-tauri/src/server/routes.rs`
  - [x] 6.2 Add routes:
    ```rust
    .route("/discover.json", get(handlers::discover_json))
    .route("/lineup.json", get(handlers::lineup_json))
    .route("/lineup_status.json", get(handlers::lineup_status_json))
    ```
  - [x] 6.3 Import handlers in routes.rs

### Testing

- [x] Task 7: Unit tests for HDHomeRun generation
  - [x] 7.1 Create tests in `src-tauri/src/server/hdhr.rs` (mod tests)
  - [x] 7.2 Test: DiscoverResponse serializes with PascalCase
  - [x] 7.3 Test: LineupEntry serializes correctly
  - [x] 7.4 Test: LineupStatusResponse serializes correctly
  - [x] 7.5 Test: Empty lineup returns valid empty array
  - [x] 7.6 Test: Channel ordering matches M3U endpoint
  - [x] 7.7 Test: GuideNumber handles null plex_display_order

- [x] Task 8: E2E tests for HDHomeRun endpoints
  - [x] 8.1 Create `tests/e2e/hdhr.spec.ts` or add to existing integration tests
  - [x] 8.2 Test: GET /discover.json returns 200 OK
  - [x] 8.3 Test: /discover.json Content-Type is application/json
  - [x] 8.4 Test: /discover.json has required fields (FriendlyName, TunerCount, etc.)
  - [x] 8.5 Test: GET /lineup.json returns 200 OK
  - [x] 8.6 Test: /lineup.json Content-Type is application/json
  - [x] 8.7 Test: /lineup.json contains enabled channels only
  - [x] 8.8 Test: /lineup.json channel URLs match expected format
  - [x] 8.9 Test: GET /lineup_status.json returns 200 OK
  - [x] 8.10 Test: /lineup_status.json has required fields
  - [x] 8.11 Test: /lineup.json matches M3U playlist channels

- [x] Task 9: Build verification
  - [x] 9.1 Run `cargo check` - no Rust errors
  - [x] 9.2 Run `cargo test` - all tests pass
  - [x] 9.3 Run `npm run build` - build succeeds

## Dev Notes

### CRITICAL: XMLTV-First Architecture

The HDHomeRun lineup MUST serve enabled XMLTV channels only because:
- XMLTV channels define the Plex lineup (names, IDs, EPG data)
- Channel GuideName comes from XMLTV display_name
- GuideNumber comes from xmltv_channel_settings.plex_display_order
- Stream URLs use XMLTV channel ID for consistency with M3U/EPG

[Source: _bmad-output/planning-artifacts/architecture.md#Data Flow]

### Existing Server Infrastructure

The HTTP server foundation was built in Story 1-5. M3U (4-1) and EPG (4-2) endpoints follow established patterns.

**Key files:**
- `src-tauri/src/server/mod.rs` - Server module with `start_server()`
- `src-tauri/src/server/routes.rs` - Axum router configuration
- `src-tauri/src/server/handlers.rs` - Request handlers
- `src-tauri/src/server/state.rs` - AppState with DB pool and caching
- `src-tauri/src/server/m3u.rs` - M3U generation (pattern reference)
- `src-tauri/src/server/epg.rs` - EPG generation (pattern reference)

**Current routes (Story 4-2 complete):**
- `GET /health` - Health check (returns 200 OK)
- `GET /playlist.m3u` - M3U playlist (Story 4-1)
- `GET /epg.xml` - XMLTV EPG (Story 4-2)
- Fallback - 404 Not Found

[Source: src-tauri/src/server/routes.rs]

### Database Schema Reference

**accounts table (for tuner count):**
```sql
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    server_url TEXT NOT NULL,
    username TEXT NOT NULL,
    password_encrypted BLOB NOT NULL,
    max_connections INTEGER DEFAULT 1,  -- Tuner count source
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**xmltv_channels and xmltv_channel_settings (for lineup):**
```sql
CREATE TABLE xmltv_channels (
    id INTEGER PRIMARY KEY,
    source_id INTEGER REFERENCES xmltv_sources(id),
    channel_id TEXT NOT NULL,      -- XMLTV channel ID
    display_name TEXT NOT NULL,    -- GuideName source
    icon TEXT,
    is_synthetic INTEGER DEFAULT 0
);

CREATE TABLE xmltv_channel_settings (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER UNIQUE REFERENCES xmltv_channels(id),
    is_enabled INTEGER DEFAULT 0,       -- Filter: enabled only
    plex_display_order INTEGER          -- GuideNumber source
);
```

[Source: src-tauri/src/db/schema.rs]

### HDHomeRun Protocol Specification

Plex discovers tuners via SSDP or manual IP entry. Required endpoints:

**GET /discover.json**
```json
{
  "FriendlyName": "StreamForge",
  "ModelNumber": "HDHR5-4K",
  "FirmwareName": "hdhomerun5_atsc",
  "FirmwareVersion": "20200101",
  "DeviceID": "12345678",
  "DeviceAuth": "streamforge",
  "BaseURL": "http://192.168.1.100:5004",
  "LineupURL": "http://192.168.1.100:5004/lineup.json",
  "TunerCount": 2
}
```

**GET /lineup.json**
```json
[
  {
    "GuideNumber": "1",
    "GuideName": "ESPN",
    "URL": "http://192.168.1.100:5004/stream/123"
  },
  {
    "GuideNumber": "2",
    "GuideName": "CNN",
    "URL": "http://192.168.1.100:5004/stream/456"
  }
]
```

**GET /lineup_status.json**
```json
{
  "ScanInProgress": 0,
  "ScanPossible": 0,
  "Source": "Cable",
  "SourceList": ["Cable"]
}
```

[Source: _bmad-output/planning-artifacts/architecture.md#Appendix: Plex HDHomeRun Protocol]

### Serde JSON Serialization

Use `#[serde(rename_all = "PascalCase")]` for HDHomeRun compatibility:

```rust
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "PascalCase")]
pub struct DiscoverResponse {
    friendly_name: String,       // -> "FriendlyName"
    model_number: String,        // -> "ModelNumber"
    firmware_name: String,       // -> "FirmwareName"
    firmware_version: String,    // -> "FirmwareVersion"
    device_id: String,           // -> "DeviceID"
    device_auth: String,         // -> "DeviceAuth"
    #[serde(rename = "BaseURL")] // Explicit for URL fields
    base_url: String,
    #[serde(rename = "LineupURL")]
    lineup_url: String,
    tuner_count: u32,            // -> "TunerCount"
}
```

### Local IP Detection

Use `local_ip_address` crate (already available in Rust ecosystem):

```rust
use local_ip_address::local_ip;

fn get_base_url(port: u16) -> String {
    let ip = local_ip().unwrap_or_else(|_| "127.0.0.1".parse().unwrap());
    format!("http://{}:{}", ip, port)
}
```

Alternative: Check if `local_ip_address` is already in Cargo.toml. If not, add it:
```toml
[dependencies]
local_ip_address = "0.6"
```

If dependency issues arise, fallback to 127.0.0.1 which works for local Plex instances.

### DeviceID Generation

Generate a stable DeviceID based on machine identity:

```rust
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

fn generate_device_id() -> String {
    // Use machine-id or hostname for stable ID
    let hostname = hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_else(|| "streamforge".to_string());

    let mut hasher = DefaultHasher::new();
    hostname.hash(&mut hasher);
    "STREAMFORGE".to_string() + &format!("{:08X}", hasher.finish() as u32)
}
```

This gives a stable ID like "STREAMFORGE12AB34CD" that persists across restarts.

### Previous Story Learnings (Story 4-1 and 4-2 Code Reviews)

**CRITICAL patterns to follow from M3U/EPG endpoints:**

1. **Error handling pattern** - Return opaque errors to clients, log details server-side:
   ```rust
   .map_err(|e| {
       eprintln!("HDHR lineup error - database query failed: {}", e);
       (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".to_string())
   })?;
   ```

2. **Database connection pattern** - Use state.get_connection():
   ```rust
   let mut conn = state.get_connection().map_err(|e| {
       eprintln!("HDHR discover error - database connection failed: {}", e);
       (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".to_string())
   })?;
   ```

3. **Channel query pattern** - Use efficient batch queries (no N+1):
   - Reuse the channel query logic from M3U endpoint
   - Consider extracting shared query to common function

4. **Content-Type header** - Always set explicitly:
   ```rust
   headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("application/json"));
   ```

### Consistency with M3U/EPG Endpoints

**CRITICAL:** /lineup.json must return the SAME channels as /playlist.m3u and /epg.xml:
- Same enabled channel filter
- Same ordering (plex_display_order ASC NULLS LAST)
- Same channel ID (xmltv_channel_id) in stream URLs

Consider extracting shared query function:
```rust
// In a new file: src-tauri/src/server/channels.rs
pub fn get_enabled_channels(conn: &mut SqliteConnection) -> Result<Vec<EnabledChannel>> {
    // Shared query used by M3U, EPG, and HDHR
}
```

This prevents bugs from divergent channel queries.

### Stream Endpoint Placeholder

The stream URL format is `/stream/{xmltv_channel_id}`. This endpoint doesn't exist yet (Story 4-4), but HDHR must use this format now for forward compatibility.

Example: `http://192.168.1.100:5004/stream/123`

Where `123` is the xmltv_channels.id (integer primary key).

### Files to Create

```
src-tauri/src/server/hdhr.rs  (new - HDHomeRun response generation)
tests/e2e/hdhr.spec.ts  (new - E2E tests, or add to existing)
```

### Files to Modify

```
src-tauri/src/server/mod.rs (add hdhr module export)
src-tauri/src/server/routes.rs (add /discover.json, /lineup.json, /lineup_status.json routes)
src-tauri/src/server/handlers.rs (add discover_json, lineup_json, lineup_status_json handlers)
Cargo.toml (add local_ip_address = "0.6" if not present)
```

### Testing Strategy

**Unit Tests (Rust):**
- Test JSON serialization with PascalCase
- Test DeviceID generation stability
- Test empty lineup handling
- Test channel ordering

**E2E Tests (Playwright/Integration):**
- Test HTTP endpoints return correct Content-Type
- Test required JSON fields present
- Test lineup matches M3U channels
- Test empty lineup is valid JSON array

### Project Structure Notes

This story follows established patterns:
- Server modules in `src-tauri/src/server/`
- Database queries using Diesel ORM patterns
- E2E tests in `tests/e2e/` or `tests/integration/`
- Follow error handling patterns from Story 4-1/4-2

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3]
- [Source: _bmad-output/planning-artifacts/architecture.md#HTTP Server Endpoints]
- [Source: _bmad-output/planning-artifacts/architecture.md#Appendix: Plex HDHomeRun Protocol]
- [Source: _bmad-output/planning-artifacts/prd.md#FR36 - System can emulate HDHomeRun tuner]
- [Source: _bmad-output/planning-artifacts/prd.md#FR38 - System can report correct tuner count to Plex]
- [Source: src-tauri/src/server/routes.rs]
- [Source: src-tauri/src/server/handlers.rs]
- [Source: src-tauri/src/server/m3u.rs - Pattern reference]
- [Source: src-tauri/src/server/epg.rs - Pattern reference]
- [Source: _bmad-output/implementation-artifacts/4-1-serve-m3u-playlist-endpoint.md - Code review learnings]
- [Source: _bmad-output/implementation-artifacts/4-2-serve-xmltv-epg-endpoint.md - Code review learnings]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - clean implementation with no debugging required.

### Completion Notes List

- ✅ Implemented HDHomeRun emulation with 3 endpoints: /discover.json, /lineup.json, /lineup_status.json
- ✅ Added `local-ip-address` crate for network IP detection with 127.0.0.1 fallback
- ✅ DeviceID generated from hostname hash for stability across restarts (format: STREAMFORGE{8-hex-chars})
- ✅ TunerCount read from accounts.max_connections (defaults to 2 if no active accounts)
- ✅ Lineup uses XMLTV-first architecture: only enabled XMLTV channels with stream mappings
- ✅ Channel ordering consistent with M3U/EPG endpoints (plex_display_order ASC NULLS LAST)
- ✅ All serde serialization uses PascalCase with explicit renames for abbreviations (DeviceID, BaseURL, LineupURL, URL)
- ✅ Error handling follows Story 4-1/4-2 patterns: opaque client messages, server-side logging
- ✅ 12 unit tests pass (serialization, device ID, local IP, ordering logic)
- ✅ 28 E2E tests pass (all ATDD tests from hdhr-endpoints.spec.ts)
- ✅ 162 total Rust tests pass with no regressions
- ✅ 121 integration tests pass with no regressions
- ✅ Build succeeds (npm run build)

### File List

**New Files:**
- src-tauri/src/server/hdhr.rs (HDHomeRun response generation module with structs and functions)

**Modified Files:**
- src-tauri/Cargo.toml (added local-ip-address = "0.6" dependency)
- src-tauri/src/server/mod.rs (added hdhr module export)
- src-tauri/src/server/handlers.rs (added discover_json, lineup_json, lineup_status_json handlers)
- src-tauri/src/server/routes.rs (registered /discover.json, /lineup.json, /lineup_status.json routes)

**Pre-existing Test File (ATDD):**
- tests/integration/hdhr-endpoints.spec.ts (28 E2E tests - already existed from ATDD phase)

## Change Log

- 2026-01-20: Implemented HDHomeRun emulation (Story 4-3) - 3 endpoints for Plex auto-discovery
