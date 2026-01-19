# Story 1.5: Create Axum HTTP Server Foundation

Status: review

## Story

As a developer,
I want an embedded Axum HTTP server,
So that the app can serve endpoints for Plex integration.

## Acceptance Criteria

1. **Given** the application starts
   **When** initialization completes
   **Then** an Axum HTTP server is running on `127.0.0.1:{configured_port}`
   **And** the default port is 5004
   **And** a health check endpoint at `/health` returns 200 OK
   **And** the server only binds to localhost (not accessible externally)
   **And** the server runs on the Tokio async runtime
   **And** the server port is stored in the settings table

## Tasks / Subtasks

- [x] Task 1: Add Axum and tower dependencies to Cargo.toml (AC: #1)
  - [x] 1.1 Add `axum = "0.8"` to dependencies
  - [x] 1.2 Add `tower = "0.5"` for middleware support
  - [x] 1.3 Add `tower-http = { version = "0.6", features = ["cors", "trace"] }` for HTTP utilities
  - [x] 1.4 Verify `tokio = { version = "1", features = ["full"] }` already includes `rt-multi-thread` and `macros`
  - [x] 1.5 Run `cargo check` to verify dependencies resolve

- [x] Task 2: Create server module structure (AC: #1)
  - [x] 2.1 Create `src-tauri/src/server/` directory
  - [x] 2.2 Create `src-tauri/src/server/mod.rs` with module exports
  - [x] 2.3 Create `src-tauri/src/server/routes.rs` for route definitions
  - [x] 2.4 Create `src-tauri/src/server/handlers.rs` for handler functions
  - [x] 2.5 Create `src-tauri/src/server/state.rs` for server state management
  - [x] 2.6 Add `pub mod server;` to `src-tauri/src/lib.rs`

- [x] Task 3: Implement server state with database access (AC: #1)
  - [x] 3.1 In `state.rs`, create `AppState` struct holding `DbPool` reference
  - [x] 3.2 Implement `Clone` for `AppState` (required for Axum state)
  - [x] 3.3 Add method to get port from settings (default 5004)
  - [x] 3.4 Add method to create `AppState` from `DbConnection`

- [x] Task 4: Implement health check endpoint (AC: #1)
  - [x] 4.1 In `handlers.rs`, create `health_check` async handler function
  - [x] 4.2 Handler returns `StatusCode::OK` with JSON body `{"status": "healthy"}`
  - [x] 4.3 Optionally include server uptime or version in response

- [x] Task 5: Create Axum router with routes (AC: #1)
  - [x] 5.1 In `routes.rs`, create `create_router(state: AppState) -> Router` function
  - [x] 5.2 Add `/health` GET route pointing to `health_check` handler
  - [x] 5.3 Add fallback handler for 404 responses
  - [x] 5.4 Attach `AppState` to router using `.with_state()`

- [x] Task 6: Implement server startup function (AC: #1)
  - [x] 6.1 In `mod.rs`, create `start_server(state: AppState) -> Result<(), ServerError>` async function
  - [x] 6.2 Get port from `AppState` (read from settings, default 5004)
  - [x] 6.3 Create `TcpListener` binding to `127.0.0.1:{port}`
  - [x] 6.4 Log server startup with port number
  - [x] 6.5 Call `axum::serve(listener, router).await`
  - [x] 6.6 Implement proper error handling with custom `ServerError` type

- [x] Task 7: Integrate server with Tauri application lifecycle (AC: #1)
  - [x] 7.1 In `lib.rs` setup closure, after database initialization, create `AppState`
  - [x] 7.2 Spawn server task using `tauri::async_runtime::spawn()`
  - [x] 7.3 Server runs in background, does not block Tauri GUI thread
  - [x] 7.4 Store server handle if needed for graceful shutdown later

- [x] Task 8: Add default port setting to database (AC: #1)
  - [x] 8.1 In `commands.rs` or setup, ensure `server_port` setting exists with default "5004"
  - [x] 8.2 Create Tauri command `get_server_port()` to retrieve current port
  - [x] 8.3 Create Tauri command `set_server_port(port: u16)` to update port (requires restart)

- [x] Task 9: Testing and verification (AC: #1)
  - [x] 9.1 Run `cargo check` to verify Rust compilation
  - [x] 9.2 Run `cargo clippy` to catch common issues
  - [x] 9.3 Verify server functionality via automated tests:
    - Health endpoint returns 200 OK with JSON `{"status":"healthy"}` (verified by Rust integration test)
    - Server binds to localhost only (verified by Rust integration test)
    - Server handles concurrent requests on Tokio async runtime (verified by Rust integration test)
    - Server 404 fallback handler works (verified by Rust integration test)
    - Manual GUI verification requires `pnpm tauri dev` with display environment
  - [x] 9.4 Run `pnpm tauri build` and verify production build works
  - [x] 9.5 Port configuration commands implemented and default port verified:
    - `get_server_port` command returns port from settings (default 5004)
    - `set_server_port` command updates port (requires app restart)
    - Default port 5004 verified by Rust integration test

## Dev Notes

### Architecture Compliance

This story implements the HTTP server foundation specified in the Architecture document:

**From Architecture - Technology Stack:**
> **HTTP Server:** Axum - Modern, ergonomic, built on Tokio/Tower

[Source: architecture.md#Technology Stack]

**From Architecture - System Architecture:**
> HTTP Server module (m3u, epg, stream, hdhr endpoints)

[Source: architecture.md#Core Modules]

**From Architecture - HTTP Server Module Structure:**
```
server/
├── mod.rs           # Module exports, Axum router
├── m3u.rs           # M3U playlist generation
├── epg.rs           # XMLTV EPG endpoint
├── stream.rs        # Stream proxy endpoint
└── hdhr.rs          # HDHomeRun discovery/status
```

[Source: architecture.md#5. HTTP Server]

**From Architecture - Endpoints (Future):**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/playlist.m3u` | GET | M3U playlist for Plex |
| `/epg.xml` | GET | XMLTV EPG data |
| `/stream/{channel_id}` | GET | Proxied stream with failover |
| `/discover.json` | GET | HDHomeRun device discovery |
| `/lineup.json` | GET | HDHomeRun channel lineup |
| `/lineup_status.json` | GET | HDHomeRun lineup status |

[Source: architecture.md#HTTP Server Endpoints]

**NOTE:** This story only implements `/health` - other endpoints will be added in Epic 4 stories.

### Critical Technical Requirements

**Axum 0.8 Server Setup Pattern:**

```rust
use axum::{
    routing::get,
    Router,
    Json,
    http::StatusCode,
    extract::State,
};
use serde::Serialize;
use std::net::SocketAddr;

#[derive(Clone)]
pub struct AppState {
    pub db_pool: DbPool,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
}

async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
    })
}

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .with_state(state)
}

pub async fn start_server(state: AppState, port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let app = create_router(state);

    // CRITICAL: Bind to 127.0.0.1 only - not 0.0.0.0
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    println!("HTTP server listening on http://{}", addr);
    axum::serve(listener, app).await?;

    Ok(())
}
```

**Integration with Tauri (in lib.rs setup):**

```rust
// After database initialization in setup closure
let state = server::state::AppState::new(db_connection.clone_pool());
let port = state.get_port();

// Spawn server in background - MUST use tauri::async_runtime
tauri::async_runtime::spawn(async move {
    if let Err(e) = server::start_server(state, port).await {
        eprintln!("HTTP server error: {}", e);
    }
});
```

**Key Points:**
1. Use `tauri::async_runtime::spawn()` NOT `tokio::spawn()` directly
2. Bind to `127.0.0.1` NOT `0.0.0.0` for security (NFR21)
3. Default port 5004 (configurable via settings)
4. Server runs independently of GUI - can serve requests while window hidden

### Security Requirements

**From Architecture - Network Security:**
> HTTP server binds to `127.0.0.1` only (localhost)

[Source: architecture.md#Security Considerations]

**From PRD - NFR21:**
> Local-only endpoints (no external exposure by default)

[Source: prd.md#Security]

The server MUST only bind to localhost. This prevents exposure to the network and aligns with the security model where Plex runs on the same machine or accesses via SSH tunnel.

### Database Integration

The server needs access to the database pool for future endpoints (reading channels, EPG data, settings). The `AppState` struct should hold a reference to the pool:

```rust
pub struct AppState {
    pool: DbPool,
}

impl AppState {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub fn get_port(&self) -> u16 {
        // Read from settings table, default 5004
        // For now, return default - full implementation in Epic 2
        5004
    }

    pub fn get_connection(&self) -> Result<DbPooledConnection, r2d2::Error> {
        self.pool.get()
    }
}
```

### Previous Story Intelligence

**From Story 1-4 (System Tray Integration):**
- App now runs in background with system tray
- Window hides on close, app continues running
- This is perfect for HTTP server - it keeps running when GUI is hidden
- Used `tauri::async_runtime` for background tasks

**From Story 1-2 (Database Setup):**
- `DbConnection` is managed state with connection pool
- Pool size is 16 connections - plenty for server handlers
- `DbPool` type is `Pool<ConnectionManager<SqliteConnection>>`
- Access via `app.state::<DbConnection>()`

**From Story 1-1 (Project Setup):**
- Tokio already configured with `features = ["full"]`
- Project structure follows architecture guidelines

**Learnings Applied:**
- Always log errors with context (not just `let _ =`)
- Use proper error types with `thiserror`
- Graceful degradation - if server fails to start, log error but don't crash app

### Git Intelligence

**Recent commit patterns (from story 1-4):**
- Commit message format: "Implement story X-Y: Description"
- Files changed: Cargo.toml, lib.rs, new module files
- Story file updated with completion status

**File patterns established:**
- New Rust modules in `src-tauri/src/{module_name}/`
- Module exports in `mod.rs`
- Types/state in separate files within module

### Web Research Intelligence

**Axum 0.8 Key Points (2026):**

1. **TcpListener Binding:** Use `tokio::net::TcpListener::bind()` with `axum::serve()`
2. **Router State:** Use `.with_state()` to attach application state
3. **Clone Requirement:** `AppState` must implement `Clone` for Axum
4. **Handlers:** Async functions that return types implementing `IntoResponse`
5. **Extractors:** Use `State<AppState>` to access state in handlers

**Sources:**
- [Axum Documentation](https://docs.rs/axum/latest/axum/)
- [Axum Router](https://docs.rs/axum/latest/axum/struct.Router.html)
- [Axum GitHub](https://github.com/tokio-rs/axum)

### Project Structure Notes

**New files to create:**
```
src-tauri/src/server/
├── mod.rs           # Module exports, start_server function
├── routes.rs        # Router creation with route definitions
├── handlers.rs      # Handler functions (health_check)
└── state.rs         # AppState struct and methods
```

**Files to modify:**
- `src-tauri/Cargo.toml` - Add axum, tower dependencies
- `src-tauri/src/lib.rs` - Add `pub mod server;`, spawn server in setup

### Testing Approach

**Automated Verification:**
```bash
# Rust compilation
cargo check
cargo clippy

# Build verification
pnpm tauri build
```

**Manual Verification:**
```bash
# Start app in dev mode
pnpm tauri dev

# In another terminal, test health endpoint
curl -v http://127.0.0.1:5004/health
# Expected: 200 OK, {"status":"healthy"}

# Verify localhost-only binding
# From another machine on the network, the connection should FAIL
curl http://<this-machine-ip>:5004/health
# Expected: Connection refused
```

**E2E Test Considerations:**
The HTTP server can be tested via E2E by making HTTP requests to localhost during test runs. Consider adding a Playwright test that verifies the health endpoint responds.

### Error Handling

Create a custom error type for server errors:

```rust
#[derive(Debug, thiserror::Error)]
pub enum ServerError {
    #[error("Failed to bind to address: {0}")]
    BindError(#[from] std::io::Error),

    #[error("Server runtime error: {0}")]
    RuntimeError(String),

    #[error("Database error: {0}")]
    DatabaseError(#[from] r2d2::Error),
}
```

### Performance Targets

**From Architecture - Performance:**
> CPU Idle: <5% - Tokio async, event-driven

[Source: architecture.md#Performance Targets]

The Axum server should add minimal overhead when idle. Axum is built on Tokio and hyper, known for excellent performance characteristics.

### References

- [Source: architecture.md#Technology Stack] - Axum as HTTP server
- [Source: architecture.md#Core Modules] - HTTP Server module structure
- [Source: architecture.md#Security Considerations] - localhost-only binding
- [Source: prd.md#Desktop Application Requirements] - Local server endpoints
- [Source: epics.md#Story 1.5] - Original acceptance criteria

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- Implemented Axum 0.8 HTTP server with health check endpoint at `/health`
- Server binds to `127.0.0.1:5004` (localhost only) for security per NFR21
- Created modular server structure: mod.rs, routes.rs, handlers.rs, state.rs
- Integrated with Tauri using `tauri::async_runtime::spawn()` for background execution
- Added `get_server_port` and `set_server_port` Tauri commands for port configuration
- Custom `ServerError` type with thiserror for proper error handling
- All Rust compilation checks pass (`cargo check`, `cargo clippy`, `cargo build`)
- Production build (`pnpm tauri build`) completes successfully
- **Rust Integration Tests Added (6 tests, all passing):**
  - `test_health_endpoint_returns_200_ok` - Verifies health endpoint returns 200 OK
  - `test_health_endpoint_returns_json` - Verifies JSON response with `{"status":"healthy"}`
  - `test_unknown_route_returns_404` - Verifies 404 fallback handler
  - `test_server_handles_concurrent_requests` - Verifies async runtime handles 10 concurrent requests
  - `test_server_binds_to_localhost_only` - Verifies server binds to 127.0.0.1
  - `test_default_port_is_5004` - Verifies default port configuration
- Updated Playwright config to support Tauri integration tests (`TAURI_DEV=true`)
- Added `pnpm test:rust` script for running Rust tests
- Added `pnpm test:integration` script for Playwright integration tests with Tauri

### Change Log

- 2026-01-19: Initial implementation of Axum HTTP server foundation
- 2026-01-19: Added Rust integration tests for HTTP server (6 tests, all passing)
- 2026-01-19: Updated Playwright config for Tauri integration testing
- 2026-01-19: Added test scripts (test:rust, test:integration) to package.json

### File List

**New Files:**
- src-tauri/src/server/mod.rs - Server module exports and `start_server` function
- src-tauri/src/server/routes.rs - Axum router configuration
- src-tauri/src/server/handlers.rs - Health check and fallback handlers
- src-tauri/src/server/state.rs - AppState struct for server state management
- src-tauri/tests/http_server_test.rs - Rust integration tests for HTTP server (6 tests)
- tests/integration/http-server.spec.ts - Playwright integration tests for HTTP server
- tests/support/fixtures/server.fixture.ts - Server test fixtures for Playwright

**Modified Files:**
- src-tauri/Cargo.toml - Added axum, tower, tower-http dependencies; added reqwest and futures as dev dependencies
- src-tauri/src/lib.rs - Added server module, spawning HTTP server on startup
- src-tauri/src/db/mod.rs - Exported DbPool and DbPooledConnection types
- src-tauri/src/db/connection.rs - Added `clone_pool()` method to DbConnection
- src-tauri/src/commands/mod.rs - Added `get_server_port` and `set_server_port` commands
- package.json - Added test:rust and test:integration scripts
- playwright.config.ts - Added TAURI_DEV mode for integration testing

