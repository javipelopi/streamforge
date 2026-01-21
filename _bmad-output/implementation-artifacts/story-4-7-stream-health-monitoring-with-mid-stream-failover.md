# Story 4.7: Stream Health Monitoring with Mid-Stream Failover

Status: ready-for-dev

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

- [ ] **Task 1: Extend BufferState with health tracking fields** (AC: 1)
  - [ ] Add `last_data_time: Instant` to track when data was last received
  - [ ] Add `stall_detected: bool` flag
  - [ ] Add `stall_start_time: Option<Instant>` to track stall duration
  - [ ] Update `reader_task` to update `last_data_time` on every successful read

- [ ] **Task 2: Implement health check mechanism in BufferedStream** (AC: 1)
  - [ ] Add public method `check_health() -> StreamHealth` that returns current status
  - [ ] Define `StreamHealth` enum: `Healthy`, `Stalled(Duration)`, `Failed`
  - [ ] Calculate stall duration from `last_data_time`
  - [ ] Expose method for handlers to query health status

- [ ] **Task 3: Create StreamHealthMonitor component** (AC: 1, 2)
  - [ ] Create new file `src-tauri/src/server/health.rs`
  - [ ] Implement health check loop using `tokio::time::interval` (1 second)
  - [ ] Monitor `BufferedStream` health via shared state
  - [ ] Configurable thresholds: `stall_detection_secs` (default: 3), `failover_trigger_secs` (default: 5)

- [ ] **Task 4: Add failover callback mechanism** (AC: 2)
  - [ ] Add `on_failover_needed` callback to `BufferedStream` or handler
  - [ ] When stall exceeds `failover_trigger_secs`, invoke callback
  - [ ] Callback receives: `session_id`, `current_stream_id`, `stall_duration`

- [ ] **Task 5: Implement mid-stream failover in handler** (AC: 2, 3)
  - [ ] Modify stream handler in `handlers.rs` to handle failover signal
  - [ ] Query database for next backup stream (by `stream_priority`)
  - [ ] Spawn new FFmpeg process with backup stream URL
  - [ ] Seamlessly switch output stream while buffer keeps feeding Plex
  - [ ] Update `StreamSession` with new stream ID and quality

- [ ] **Task 6: Update StreamSession for health tracking** (AC: 4)
  - [ ] Add `failed_over: bool` to `StreamSession` struct
  - [ ] Remove `can_upgrade()` logic (no retry during session per requirements)
  - [ ] Ensure `update_stream()` marks session as failed over

- [ ] **Task 7: Implement graceful exhaustion handling** (AC: 5)
  - [ ] When all backups fail, end stream gracefully
  - [ ] Return proper error response to Plex
  - [ ] Log comprehensive error with: channel info, all attempted streams, failure reasons

- [ ] **Task 8: Add event logging for failover events** (AC: 2, 5)
  - [ ] Log failover start: `[INFO] stream:{session_id} stall detected, initiating failover`
  - [ ] Log failover success: `[INFO] stream:{session_id} failover complete: {old_stream} -> {new_stream}`
  - [ ] Log failover failure: `[ERROR] stream:{session_id} all streams exhausted`
  - [ ] Include timing metrics in logs

- [ ] **Task 9: Add tests for health monitoring** (AC: 1-5)
  - [ ] Unit test: stall detection triggers at correct threshold
  - [ ] Unit test: failover callback invoked after stall duration
  - [ ] Unit test: session stays on backup after failover
  - [ ] Integration test: end-to-end failover scenario (if feasible)

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

_To be filled by dev agent_

### Debug Log References

_To be filled during implementation_

### Completion Notes List

_To be filled during implementation_

### Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | Bob (SM) | Story created via create-story workflow |

### File List

_To be filled during implementation_
