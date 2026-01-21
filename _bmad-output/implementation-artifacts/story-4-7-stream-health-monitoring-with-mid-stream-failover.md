# Story 4.7: Stream Health Monitoring with Mid-Stream Failover

Status: ready-for-review

## Story

As a **user**,
I want **active streams to be monitored for health and automatically recovered**,
so that **stream interruptions are handled transparently without manual intervention**.

## Context

**Sprint Change Proposal:** 2026-01-21 — Mid-Stream Failover

The initial failover implementation (Story 4.5) only handles connection-time failures. Once a stream is established and playing, there is no active health monitoring. When an upstream source dies mid-playback:

- StreamForge continues forwarding nothing or closes connection
- Plex shows "Playback stopped"
- User must manually restart the channel
- Backup streams exist but are never tried

**Issue #1 (Buffering)** was fixed in commit `1948a1f` with FFmpeg-based buffering. This story builds on that foundation to add continuous health monitoring.

## Acceptance Criteria

### AC1: Stall Detection
**Given** an active stream is being proxied through FFmpeg
**When** the upstream source stops sending data
**Then** a stall is detected within 3 seconds (configurable)
**And** the stream health status is updated to "stalled"

### AC2: Mid-Stream Failover Trigger
**Given** a stream has been stalled for >5 seconds (configurable)
**When** backup streams are available
**Then** the proxy switches to the next backup stream
**And** the FFmpeg buffer continues feeding Plex (hiding the switch)
**And** a failover event is logged

### AC3: Transparent Failover
**Given** a mid-stream failover occurs
**When** the switch completes
**Then** Plex playback continues without interruption (FR33)
**And** total failover time is <2 seconds (NFR2)

### AC4: Stay on Backup
**Given** a stream has failed over to a backup source
**When** the stream session continues
**Then** the proxy remains on the backup source for the duration of this session
**And** the next stream request will attempt primary source fresh

### AC5: All Backups Exhausted
**Given** all backup streams fail
**When** no sources remain
**Then** the stream ends gracefully
**And** an error event is logged with full context

## Tasks / Subtasks

- [x] **Task 1: Extend BufferState with health tracking fields** (AC: 1)
  - [x] Add `last_data_time: Instant` to track when data was last received
  - [x] Add `stall_detected: bool` flag
  - [x] Add `stall_start_time: Option<Instant>` to track stall duration
  - [x] Update `reader_task` to update `last_data_time` on every successful read

- [x] **Task 2: Implement health check mechanism in BufferedStream** (AC: 1)
  - [x] Add public method `check_health() -> StreamHealth` that returns current status
  - [x] Define `StreamHealth` enum: `Healthy`, `Stalled(Duration)`, `Failed`
  - [x] Calculate stall duration from `last_data_time`
  - [x] Expose method for handlers to query health status

- [x] **Task 3: Create StreamHealthMonitor component** (AC: 1, 2)
  - [x] Create new file `src-tauri/src/server/health.rs`
  - [x] Implement health check loop using `tokio::time::interval` (1 second)
  - [x] Monitor `BufferedStream` health via shared state
  - [x] Configurable thresholds: `stall_detection_secs` (default: 3), `failover_trigger_secs` (default: 5)

- [x] **Task 4: Add failover callback mechanism** (AC: 2)
  - [x] Add `on_failover_needed` callback to `BufferedStream` or handler
  - [x] When stall exceeds `failover_trigger_secs`, invoke callback
  - [x] Callback receives: `session_id`, `current_stream_id`, `stall_duration`

- [x] **Task 5: Implement mid-stream failover in handler** (AC: 2, 3)
  - [x] Modify stream handler in `handlers.rs` to handle failover signal
  - [x] Query database for next backup stream (by `stream_priority`)
  - [x] Spawn new FFmpeg process with backup stream URL
  - [x] Seamlessly switch output stream while buffer keeps feeding Plex
  - [x] Update `StreamSession` with new stream ID and quality

- [x] **Task 6: Update StreamSession for health tracking** (AC: 4)
  - [x] Add `health_status: Option<StreamHealth>` to `StreamSession` struct
  - [x] Add `last_failover_at: Option<Instant>` to track failover timing
  - [x] Add `update_health()` method for health status updates
  - [x] Add `record_failover()` method for mid-stream failover recording

- [x] **Task 7: Implement graceful exhaustion handling** (AC: 5)
  - [x] When all backups fail, drain remaining buffer gracefully
  - [x] Log `AllStreamsExhausted` event with session details
  - [x] End stream cleanly rather than abrupt termination

- [x] **Task 8: Add event logging for failover events** (AC: 2, 5)
  - [x] Add `log_mid_stream_failover_event()` function to failover.rs
  - [x] Log: session_id, channel_id, from_stream, to_stream, stall_duration
  - [x] Include `failover_type: "mid_stream"` to distinguish from initial failover

- [x] **Task 9: Add tests for health monitoring** (AC: 1-5)
  - [x] Test stall detection after configurable threshold
  - [x] Test failover trigger at correct threshold
  - [x] Test `FailoverContext` stream advancement
  - [x] Test graceful exhaustion behavior

## Dev Notes

### Existing Code Analysis

**`src-tauri/src/server/buffer.rs`** — FFmpeg buffering (commit `1948a1f`)
- `BufferedStream` wraps FFmpeg process with 2MB prefill buffer
- `BufferState` already tracks: `bytes_received`, `bytes_sent`, `start_time`, `finished`, `error`
- `reader_task` is the hot path where data flows from FFmpeg → buffer
- **Key insight:** Add `last_data_time` update inside the `Ok(n)` branch of `reader_task`

**`src-tauri/src/server/stream.rs`** — Session management
- `StreamSession` tracks: `xmltv_channel_id`, `xtream_stream_id`, `current_quality`, `failover_count`
- `StreamManager` handles connection limits and session lifecycle
- **Key insight:** `StreamSession::update_stream()` already exists for failover, just need to remove upgrade logic

**`src-tauri/src/server/handlers.rs`** — HTTP handlers
- `handle_stream` creates `BufferedStream` and returns it
- **Key insight:** Need to wrap stream in health-monitoring layer or add monitoring task

### Architecture Constraints

| Constraint | Implementation |
|------------|----------------|
| Tokio async runtime | Use `tokio::time::interval` for health loop |
| Thread-safe state | Use `Arc<Mutex<BufferState>>` (already in place) |
| Minimal latency | Health check runs in parallel, doesn't block data flow |
| Memory efficiency | No additional buffering, just state tracking |

### Recommended Approach

**Option A: Health check inside BufferedStream (Recommended)**
- Add health state to existing `BufferState`
- Spawn health monitor task alongside reader task
- Health monitor uses `tokio::select!` to race timeout vs data notification
- Cleaner encapsulation, all stream logic in one place

**Option B: External health monitor**
- Separate `StreamHealthMonitor` that polls multiple streams
- More complex, requires additional synchronization
- Better for monitoring many streams from single location

### Key Implementation Details

1. **Stall Detection Timing:**
   ```rust
   // In BufferState, add:
   last_data_time: Instant,

   // In reader_task, update on every read:
   guard.last_data_time = Instant::now();

   // In health check:
   let stall_duration = guard.last_data_time.elapsed();
   if stall_duration > Duration::from_secs(3) {
       // Stall detected
   }
   ```

2. **Failover Signal Pattern:**
   ```rust
   // Use tokio::sync::watch for signaling
   let (failover_tx, failover_rx) = tokio::sync::watch::channel(false);

   // Health monitor sets:
   failover_tx.send(true).ok();

   // Handler listens:
   tokio::select! {
       chunk = stream.next() => { /* normal flow */ }
       _ = failover_rx.changed() => { /* trigger failover */ }
   }
   ```

3. **Seamless Stream Switch:**
   - Keep old FFmpeg process running briefly while new one starts
   - New FFmpeg does its own prefill
   - Once new stream is ready, drop old stream
   - Buffer continuity hides the switch

### Configuration Values

| Config | Default | Description |
|--------|---------|-------------|
| `stall_detection_secs` | 3 | Seconds of no data before marking stalled |
| `failover_trigger_secs` | 5 | Seconds of stall before triggering failover |
| `health_check_interval_ms` | 1000 | How often to check health |

### Project Structure Notes

**New file to create:**
- `src-tauri/src/server/health.rs` — Health monitoring types and logic

**Files to modify:**
- `src-tauri/src/server/buffer.rs` — Add health tracking to BufferState
- `src-tauri/src/server/stream.rs` — Remove upgrade logic, add `failed_over` flag
- `src-tauri/src/server/handlers.rs` — Integrate health monitoring and failover
- `src-tauri/src/server/mod.rs` — Export health module

### References

- [Source: architecture.md#Stream-Proxy] — Failover strategy steps 6-8
- [Source: prd.md#Stream-Handling] — FR29, FR30, FR31 (updated for mid-stream)
- [Source: prd.md#Reliability] — NFR2 (<2s failover), NFR11 (>99% recovery)
- [Source: epics.md#Story-4.7] — Full acceptance criteria
- [Source: sprint-change-proposal-2026-01-21.md] — Change rationale and analysis
- [Commit: 1948a1f] — FFmpeg buffering implementation (Issue #1 fix)

### Testing Standards

- Unit tests for health state transitions
- Unit tests for stall detection timing
- Unit tests for failover callback triggering
- Mock FFmpeg process for controlled testing
- Integration test with actual stream (manual verification acceptable)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101) via Claude Code CLI

### Debug Log References

N/A - Implementation proceeded without significant debugging issues.

### Completion Notes List

1. **Task 1**: Extended `BufferState` with `last_data_time`, `stall_detected`, and `stall_start_time` fields. Updated `reader_task` to track last data time on every successful read.

2. **Task 2**: Added `StreamHealth` enum (`Healthy`, `Stalled(Duration)`, `Failed`) and `check_health()` method to `BufferedStream`. Made `BufferState` fields `pub(crate)` for health monitoring access.

3. **Task 3**: Created `health.rs` with `StreamHealthMonitor` component featuring configurable `HealthConfig` (stall_detection_secs: 3, failover_trigger_secs: 5, health_check_interval_ms: 1000). Implements async monitoring loop with proper state checking.

4. **Task 4**: Integrated health monitoring into `BufferedStream` via `tokio::sync::watch` channel. Added `failover_receiver()` method for handlers to listen for failover signals. Health monitor automatically starts when BufferedStream is created.

5. **Task 5**: Created `FailoverStream` wrapper using mpsc channel pattern for seamless mid-stream failover. Modified `stream_proxy` handler to wrap streams with backup availability in `FailoverStream`. Producer task monitors failover signals and switches to backup streams when triggered.

6. **Task 6**: Extended `StreamSession` with `health_status: Option<StreamHealth>` and `last_failover_at: Option<Instant>`. Added `update_health()` and `record_failover()` methods for tracking session health state.

7. **Task 7**: Implemented graceful exhaustion handling in `create_failover_stream`. When all backups exhausted, drains remaining buffer before termination and logs comprehensive error event.

8. **Task 8**: Added `log_mid_stream_failover_event()` function with detailed JSON logging including `failover_type: "mid_stream"`, stall duration, success status, and all stream identifiers.

9. **Task 9**: Added 10 new unit tests covering health monitoring, failover context, failover events, and stream session health methods. Total test count increased from 220 to 230.

### Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | Bob (SM) | Story created via create-story workflow |
| 2026-01-21 | Amelia (Dev) | Implementation complete - all 9 tasks done, 230 tests passing |

### File List

**New files created:**
- `src-tauri/src/server/health.rs` — Health monitoring types and StreamHealthMonitor

**Files modified:**
- `src-tauri/src/server/buffer.rs` — Added health tracking fields to BufferState, failover signaling to BufferedStream
- `src-tauri/src/server/stream.rs` — Added health status and failover tracking to StreamSession
- `src-tauri/src/server/handlers.rs` — Integrated FailoverStream wrapper for mid-stream failover
- `src-tauri/src/server/failover.rs` — Added FailoverStream, FailoverContext, FailoverEvent, create_failover_stream, log_mid_stream_failover_event
- `src-tauri/src/server/mod.rs` — Exported health module
