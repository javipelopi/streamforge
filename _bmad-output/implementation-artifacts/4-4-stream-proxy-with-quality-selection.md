# Story 4.4: Stream Proxy with Quality Selection

Status: ready-for-dev

## Story

As a user,
I want streams to automatically use the best available quality,
So that I get the best viewing experience.

## Background

This is the **fourth story in Epic 4: Plex Integration & Streaming**. Epic 4 enables users to add StreamForge as a tuner in Plex and watch live TV. This story implements the core stream proxy that fetches streams from Xtream providers and serves them to Plex.

**XMLTV-First Design Principle:** Stream requests use XMLTV channel IDs. The proxy looks up the primary Xtream stream for each XMLTV channel and selects the highest available quality tier.

**Epic 4 Story Sequence:**
1. Story 4-1 (done): M3U playlist endpoint
2. Story 4-2 (done): XMLTV EPG endpoint
3. Story 4-3 (done): HDHomeRun emulation
4. **Story 4-4 (this):** Stream proxy with quality selection
5. Story 4-5: Automatic stream failover
6. Story 4-6: Display Plex configuration URLs

## Acceptance Criteria

1. **Given** Plex requests `GET /stream/{xmltv_channel_id}`
   **When** the stream proxy handles the request
   **Then** it looks up the primary Xtream stream for the XMLTV channel
   **And** selects the highest available quality tier (4K > HD > SD)
   **And** proxies the stream from Xtream to Plex

2. **Given** an active stream
   **When** the proxy is running
   **Then** stream data is passed through with minimal buffering
   **And** stream start time is < 3 seconds (NFR1)
   **And** CPU usage during streaming is < 15% (NFR7)

3. **Given** the tuner limit is reached
   **When** a new stream is requested
   **Then** an appropriate error is returned to Plex
   **And** an event is logged

## Tasks / Subtasks

### Backend - Stream Proxy Implementation

- [ ] Task 1: Create stream proxy module (AC: #1, #2)
  - [ ] 1.1 Create `src-tauri/src/server/stream.rs` module
  - [ ] 1.2 Define stream session tracking struct:
    ```rust
    pub struct StreamSession {
        xmltv_channel_id: i32,
        xtream_stream_id: i32,
        current_quality: String,
        started_at: std::time::Instant,
    }
    ```
  - [ ] 1.3 Create active sessions tracker using `DashMap`:
    ```rust
    pub struct StreamManager {
        active_sessions: DashMap<String, StreamSession>,
        max_connections: u32,
    }
    ```
  - [ ] 1.4 Add module export in `src-tauri/src/server/mod.rs`

- [ ] Task 2: Implement channel-to-stream lookup (AC: #1)
  - [ ] 2.1 Create `get_primary_stream_for_channel` function:
    ```sql
    SELECT
      xc.id,
      xc.stream_id,
      xc.name,
      xc.qualities,
      a.server_url,
      a.username,
      a.password_encrypted
    FROM channel_mappings cm
    INNER JOIN xtream_channels xc ON cm.xtream_channel_id = xc.id
    INNER JOIN accounts a ON xc.account_id = a.id
    WHERE cm.xmltv_channel_id = ?
    AND cm.is_primary = 1
    AND a.is_active = 1
    ```
  - [ ] 2.2 Handle case where no primary mapping exists (return 404)
  - [ ] 2.3 Handle case where account is inactive (return 503)
  - [ ] 2.4 Decrypt password using keyring or AES fallback

- [ ] Task 3: Implement quality selection logic (AC: #1)
  - [ ] 3.1 Create `select_best_quality` function
  - [ ] 3.2 Parse qualities from JSON column (e.g., `["4K", "HD", "SD"]`)
  - [ ] 3.3 Implement quality priority: 4K > FHD > HD > SD
  - [ ] 3.4 Return highest available quality from stream's quality list
  - [ ] 3.5 Default to SD if no quality information available

- [ ] Task 4: Implement Xtream stream URL generation (AC: #1)
  - [ ] 4.1 Add `get_stream_url` method to Xtream client:
    ```rust
    pub fn get_stream_url(&self, stream_id: i32, quality: &str) -> String {
        // Standard Xtream stream URL format:
        // {server_url}/{username}/{password}/{stream_id}.ts
        // Or with output format:
        // {server_url}/live/{username}/{password}/{stream_id}.ts
        format!(
            "{}/live/{}/{}/{}.ts",
            self.server_url,
            self.username,
            self.password,
            stream_id
        )
    }
    ```
  - [ ] 4.2 Handle HTTP vs HTTPS server URLs
  - [ ] 4.3 URL-encode username/password for special characters

- [ ] Task 5: Implement stream proxy handler (AC: #1, #2)
  - [ ] 5.1 Create HTTP endpoint handler:
    ```rust
    pub async fn stream_proxy(
        Path(xmltv_channel_id): Path<i32>,
        State(state): State<AppState>,
    ) -> Result<impl IntoResponse, (StatusCode, String)>
    ```
  - [ ] 5.2 Look up primary Xtream stream for XMLTV channel
  - [ ] 5.3 Select highest available quality
  - [ ] 5.4 Build Xtream stream URL
  - [ ] 5.5 Use reqwest to fetch stream with streaming response
  - [ ] 5.6 Proxy response body using Axum's StreamBody:
    ```rust
    use axum::body::StreamBody;
    use tokio_util::io::ReaderStream;

    let response = reqwest::Client::new()
        .get(&stream_url)
        .send()
        .await?;

    let stream = response.bytes_stream();
    let body = StreamBody::new(stream);
    ```
  - [ ] 5.7 Forward relevant headers (Content-Type, Content-Length if known)
  - [ ] 5.8 DO NOT buffer entire stream - use streaming response

- [ ] Task 6: Implement connection limit enforcement (AC: #3)
  - [ ] 6.1 Add stream session to `StreamManager` before proxy starts
  - [ ] 6.2 Check active connections vs max_connections:
    ```rust
    if manager.active_sessions.len() >= manager.max_connections as usize {
        return Err((StatusCode::SERVICE_UNAVAILABLE,
            "Tuner limit reached".to_string()));
    }
    ```
  - [ ] 6.3 Generate unique session ID (UUID or channel_id + timestamp)
  - [ ] 6.4 Remove session when stream ends (client disconnect or error)
  - [ ] 6.5 Log tuner limit events to event_log

- [ ] Task 7: Register stream route (AC: #1, #2, #3)
  - [ ] 7.1 Edit `src-tauri/src/server/routes.rs`
  - [ ] 7.2 Add route: `.route("/stream/:channel_id", get(handlers::stream_proxy))`
  - [ ] 7.3 Import handlers in routes.rs
  - [ ] 7.4 Add StreamManager to AppState

### Testing

- [ ] Task 8: Unit tests for stream proxy logic
  - [ ] 8.1 Create tests in `src-tauri/src/server/stream.rs` (mod tests)
  - [ ] 8.2 Test: Quality selection prefers 4K over HD over SD
  - [ ] 8.3 Test: Quality selection handles missing quality info
  - [ ] 8.4 Test: Stream URL generation with various server URLs
  - [ ] 8.5 Test: Stream URL encoding for special characters
  - [ ] 8.6 Test: Connection limit enforcement
  - [ ] 8.7 Test: Session cleanup on disconnect

- [ ] Task 9: E2E tests for stream endpoint
  - [ ] 9.1 Create `tests/integration/stream-proxy.spec.ts`
  - [ ] 9.2 Test: GET /stream/{valid_id} returns 200 with stream data
  - [ ] 9.3 Test: GET /stream/{invalid_id} returns 404
  - [ ] 9.4 Test: GET /stream/{unmapped_id} returns 404
  - [ ] 9.5 Test: Content-Type header is video/mp2t or application/octet-stream
  - [ ] 9.6 Test: Connection limit returns 503 when exceeded
  - [ ] 9.7 Test: Stream URL matches expected format in M3U/lineup

- [ ] Task 10: Build verification
  - [ ] 10.1 Run `cargo check` - no Rust errors
  - [ ] 10.2 Run `cargo test` - all tests pass
  - [ ] 10.3 Run `npm run build` - build succeeds

## Dev Notes

### CRITICAL: Stream URL Format

The HDHR lineup (Story 4-3) generates URLs like:
```
http://{local_ip}:{port}/stream/{xmltv_channel_id}
```

This story MUST implement `/stream/{xmltv_channel_id}` to match. The `xmltv_channel_id` is the integer primary key from `xmltv_channels` table.

[Source: src-tauri/src/server/hdhr.rs - LineupEntry URL generation]

### Xtream Stream URL Format

Standard Xtream Codes stream URL formats:
```
# Live stream (most common)
{server_url}/live/{username}/{password}/{stream_id}.ts

# Alternative format
{server_url}/{username}/{password}/{stream_id}

# With output format
{server_url}/live/{username}/{password}/{stream_id}.m3u8
```

Use `.ts` format for Plex compatibility (MPEG-TS is standard for live TV).

[Source: Xtream Codes API specification]

### Database Schema Reference

**channel_mappings (XMLTV → Xtream):**
```sql
CREATE TABLE channel_mappings (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER REFERENCES xmltv_channels(id),
    xtream_channel_id INTEGER REFERENCES xtream_channels(id),
    match_confidence REAL,
    is_manual INTEGER DEFAULT 0,
    is_primary INTEGER DEFAULT 0,  -- Use this for stream selection
    stream_priority INTEGER DEFAULT 0
);
```

**xtream_channels (stream info):**
```sql
CREATE TABLE xtream_channels (
    id INTEGER PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id),
    stream_id INTEGER NOT NULL,  -- Xtream's stream ID for URL
    name TEXT NOT NULL,
    stream_icon TEXT,
    qualities TEXT,  -- JSON: ["4K", "HD", "SD"]
    ...
);
```

**accounts (credentials):**
```sql
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY,
    server_url TEXT NOT NULL,
    username TEXT NOT NULL,
    password_encrypted BLOB NOT NULL,
    max_connections INTEGER DEFAULT 1,  -- Tuner limit
    is_active INTEGER DEFAULT 1
);
```

[Source: src-tauri/src/db/schema.rs]

### Quality Priority Implementation

Use the existing `quality.rs` module for parsing quality strings:

```rust
use crate::xtream::quality::qualities_from_json;

fn select_best_quality(qualities_json: Option<&str>) -> String {
    let qualities = qualities_json
        .map(qualities_from_json)
        .unwrap_or_else(|| vec!["SD".to_string()]);

    // Priority order
    for q in &["4K", "FHD", "HD", "SD"] {
        if qualities.contains(&q.to_string()) {
            return q.to_string();
        }
    }
    "SD".to_string()
}
```

[Source: src-tauri/src/xtream/quality.rs]

### Streaming Response Pattern

CRITICAL: Do NOT buffer the entire stream. Use Axum's streaming response:

```rust
use axum::{
    body::Body,
    http::{Response, StatusCode, header},
    response::IntoResponse,
};
use futures_util::StreamExt;
use reqwest::Client;

pub async fn stream_proxy(
    Path(channel_id): Path<i32>,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // ... lookup channel, build URL ...

    let client = Client::new();
    let upstream = client
        .get(&stream_url)
        .header("User-Agent", "Mozilla/5.0...")
        .send()
        .await
        .map_err(|e| {
            eprintln!("Stream error - upstream fetch failed: {}", e);
            (StatusCode::BAD_GATEWAY, "Stream unavailable".to_string())
        })?;

    if !upstream.status().is_success() {
        return Err((StatusCode::BAD_GATEWAY, "Stream source error".to_string()));
    }

    // Build streaming response
    let stream = upstream.bytes_stream().map(|result| {
        result.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
    });

    let body = Body::from_stream(stream);

    let mut response = Response::new(body);
    *response.status_mut() = StatusCode::OK;
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        "video/mp2t".parse().unwrap(),
    );

    Ok(response)
}
```

This approach:
- Passes data through as it arrives (minimal buffering)
- Handles backpressure automatically
- Closes upstream when client disconnects
- Meets NFR1 (< 3s start) and NFR7 (< 15% CPU)

### Password Decryption

The project uses keyring for credential storage. Existing pattern from Story 2-1:

```rust
use keyring::Entry;

fn decrypt_password(account_id: i32, encrypted: &[u8]) -> Result<String, Error> {
    // Try keyring first
    let entry = Entry::new("streamforge", &format!("account_{}", account_id))?;
    if let Ok(password) = entry.get_password() {
        return Ok(password);
    }

    // Fallback to AES decryption if keyring fails
    // ... AES-256-GCM decryption ...
}
```

[Source: src-tauri/src/db/accounts.rs - password handling patterns]

### Connection Limit Tracking

Use DashMap for thread-safe concurrent access:

```rust
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::watch;

pub struct StreamManager {
    active_sessions: DashMap<String, StreamSession>,
    max_connections: Arc<watch::Receiver<u32>>,
}

impl StreamManager {
    pub fn can_start_stream(&self) -> bool {
        self.active_sessions.len() < *self.max_connections.borrow() as usize
    }

    pub fn start_session(&self, session_id: String, session: StreamSession) {
        self.active_sessions.insert(session_id, session);
    }

    pub fn end_session(&self, session_id: &str) {
        self.active_sessions.remove(session_id);
    }

    pub fn active_count(&self) -> usize {
        self.active_sessions.len()
    }
}
```

Add DashMap to Cargo.toml if not present:
```toml
[dependencies]
dashmap = "5.5"
```

### Error Handling Pattern

Follow established patterns from Stories 4-1, 4-2, 4-3:

```rust
// Opaque errors to client, detailed logging server-side
.map_err(|e| {
    eprintln!("Stream proxy error - {}: {}", context, e);
    (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".to_string())
})?;
```

### HTTP Client Configuration

Configure reqwest for streaming with appropriate timeouts:

```rust
let client = reqwest::Client::builder()
    .timeout(Duration::from_secs(30))  // Initial connection timeout
    .connect_timeout(Duration::from_secs(5))  // NFR1: < 3s perceived
    .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
    .build()
    .expect("Failed to create HTTP client");
```

Note: Do NOT set read timeout - streams can be long-running.

### AppState Extension

Add StreamManager to AppState:

```rust
// In src-tauri/src/server/state.rs
pub struct AppState {
    pool: DbPool,
    epg_cache: Arc<RwLock<Option<EpgCache>>>,
    stream_manager: Arc<StreamManager>,  // Add this
}

impl AppState {
    pub fn new(pool: DbPool) -> Self {
        // Get max_connections from DB or default to 2
        let max_connections = get_max_connections(&pool).unwrap_or(2);

        Self {
            pool,
            epg_cache: Arc::new(RwLock::new(None)),
            stream_manager: Arc::new(StreamManager::new(max_connections)),
        }
    }

    pub fn stream_manager(&self) -> &Arc<StreamManager> {
        &self.stream_manager
    }
}
```

### Previous Story Learnings (Story 4-3 Code Review)

**Patterns to follow:**
1. Use `eprintln!` for server-side error logging (consistent with 4-1, 4-2, 4-3)
2. Return opaque errors to clients (e.g., "Internal server error")
3. Add comprehensive unit tests for serialization and business logic
4. Document security model for local-only access (NFR21)

**Code quality expectations:**
- Proper error handling with context
- Comprehensive unit tests
- Clear module documentation
- Follow existing patterns in handlers.rs

[Source: _bmad-output/implementation-artifacts/4-3-implement-hdhomerun-emulation.md - Code Review section]

### Project Structure Notes

**Files to Create:**
```
src-tauri/src/server/stream.rs (new - stream proxy module)
tests/integration/stream-proxy.spec.ts (new - E2E tests)
```

**Files to Modify:**
```
src-tauri/src/server/mod.rs (add stream module export)
src-tauri/src/server/state.rs (add StreamManager to AppState)
src-tauri/src/server/handlers.rs (add stream_proxy handler)
src-tauri/src/server/routes.rs (add /stream/:channel_id route)
src-tauri/src/xtream/client.rs (add get_stream_url method)
src-tauri/Cargo.toml (add dashmap if not present)
```

### Performance Requirements (NFRs)

- **NFR1:** Stream start time < 3 seconds from Plex play to video
- **NFR7:** CPU usage < 15% when streaming
- **NFR11:** > 99% of stream failures recovered via failover (Story 4-5)

This story focuses on NFR1 and NFR7. Failover (NFR11) is Story 4-5.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4]
- [Source: _bmad-output/planning-artifacts/architecture.md#Stream Proxy Module]
- [Source: _bmad-output/planning-artifacts/prd.md#FR27-FR32 - Stream handling requirements]
- [Source: src-tauri/src/server/hdhr.rs - LineupEntry URL format]
- [Source: src-tauri/src/server/handlers.rs - Handler patterns]
- [Source: src-tauri/src/server/state.rs - AppState patterns]
- [Source: src-tauri/src/xtream/client.rs - XtreamClient]
- [Source: src-tauri/src/xtream/quality.rs - Quality parsing]
- [Source: src-tauri/src/db/schema.rs - Database schema]
- [Source: _bmad-output/implementation-artifacts/4-3-implement-hdhomerun-emulation.md - Previous story patterns]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

