# Sprint Change Proposal - Stream Health Monitoring & Mid-Stream Failover

**Date:** 2026-01-21
**Author:** Bob (Scrum Master)
**Triggered By:** Implementation gap discovered in Epic 4 streaming
**Scope Classification:** Moderate

---

## 1. Issue Summary

### Problem Statement

The current stream proxy implementation (Story 4.5) handles failover **only at initial connection**. Once a stream is established, there is no active health monitoring. When an upstream source dies mid-playback:

- StreamForge continues forwarding nothing or closes connection
- Plex shows "Playback stopped"
- User must manually restart the channel
- Backup streams exist but are never tried

### Context

- **Discovered during:** Epic 4 implementation testing
- **Related Story:** 4.5 (Automatic Stream Failover) — marked `done` but incomplete
- **Issue #1 (Buffering):** ✅ Already fixed with FFmpeg-based stream buffering (commit `1948a1f`)

### Evidence

| Symptom | Root Cause |
|---------|------------|
| Stream dies mid-playback | No watchdog on active streams |
| Must manually restart channel | No mid-stream failover trigger |
| Choppy playback during network jitter | No throughput smoothing (addressed by FFmpeg) |
| Backup streams never tried | Failover logic only runs at connection time |

### Fixes Needed

1. **Throughput monitor** — Track bytes/sec, detect stalls (0 bytes flowing)
2. **Mid-stream failover** — If stream stalls >X seconds, switch to backup transparently
3. **Graceful handoff** — Use existing FFmpeg buffer to hide the switch from Plex
4. **Stay on backup** — Once failed over, remain on backup for the session duration

---

## 2. Impact Analysis

### Epic Impact

| Epic | Status | Impact |
|------|--------|--------|
| **Epic 4** | `in-progress` | Direct — needs new story added |
| Epic 5 | `backlog` | None |
| Epic 6 | `backlog` | None |

**Epic 4 Assessment:**
- All 6 stories marked `done`, but Story 4.5 acceptance criteria don't cover mid-stream monitoring
- Epic cannot be marked `done` until stream reliability is production-ready
- **Recommendation:** Add Story 4.7 for stream health monitoring

### Story Impact

| Story | Current Status | Impact |
|-------|----------------|--------|
| 4.4 Stream Proxy with Quality Selection | `done` | None — proxy foundation is solid |
| 4.5 Automatic Stream Failover | `done` | **Incomplete** — needs mid-stream enhancement |
| **4.7 (NEW)** | N/A | New story for health monitoring + mid-stream failover |

### Artifact Conflicts

#### PRD Requirements (Affected)

| FR/NFR | Current Text | Gap |
|--------|--------------|-----|
| FR29 | "System can detect stream failures (connection drops, errors)" | Only at connection time, not mid-stream |
| FR30 | "System can automatically failover to next quality tier on failure" | Only triggers at initial connection |
| FR33 | "Plex remains unaware of quality switches and failovers" | ✅ FFmpeg buffer supports this |
| NFR2 | "Failover time < 2 seconds to switch quality tiers" | Not applicable mid-stream currently |
| NFR11 | ">99% of stream failures recovered" | Cannot recover mid-stream failures |

**PRD Update Needed:** Clarify FR29/FR30 apply to both initial connection AND active streams.

#### Architecture (Affected)

| Component | Current State | Gap |
|-----------|---------------|-----|
| `proxy/metrics.rs` | File exists in design | Not fully implemented |
| `StreamSession` struct | Tracks `failover_count` | Missing throughput metrics, stall detection |
| Failover Strategy | Steps 1-5 defined | Steps execute only at connection, not continuously |

**Architecture Update Needed:** Add stream health monitoring loop to failover strategy.

#### Epics Document (Affected)

Story 4.5 acceptance criteria:

```
Given an active stream from primary Xtream source
When a failure is detected (timeout 5s, connection error, HTTP error)
Then the proxy immediately fails over to the next backup stream
```

**Gap:** "Failure detected" implies continuous monitoring, but implementation only checks at connection.

---

## 3. Recommended Approach

### Selected Path: **Option 1 — Direct Adjustment**

Add a new Story 4.7 to Epic 4 that implements stream health monitoring and mid-stream failover.

### Rationale

| Factor | Assessment |
|--------|------------|
| **Implementation effort** | Medium — builds on existing FFmpeg buffer and failover logic |
| **Technical risk** | Low — additive change, doesn't require rewriting existing code |
| **Timeline impact** | +1 story to Epic 4 |
| **Team morale** | Positive — addresses real user pain point |
| **Long-term sustainability** | Essential for production reliability |

### Why Not Other Options

- **Option 2 (Rollback):** Not needed — FFmpeg buffering (Issue #1) is correctly implemented
- **Option 3 (MVP Review):** Stream reliability is a core PRD requirement, cannot defer

---

## 4. Detailed Change Proposals

### 4.1 New Story: 4.7 — Stream Health Monitoring with Mid-Stream Failover

```markdown
### Story 4.7: Stream Health Monitoring with Mid-Stream Failover

As a user,
I want active streams to be monitored for health and automatically recovered,
So that stream interruptions are handled transparently without manual intervention.

**Acceptance Criteria:**

**Given** an active stream is being proxied through FFmpeg
**When** the upstream source stops sending data
**Then** a stall is detected within 3 seconds (configurable)
**And** the stream health status is updated to "stalled"

**Given** a stream has been stalled for >5 seconds (configurable)
**When** backup streams are available
**Then** the proxy switches to the next backup stream
**And** the FFmpeg buffer continues feeding Plex (hiding the switch)
**And** a failover event is logged

**Given** a mid-stream failover occurs
**When** the switch completes
**Then** Plex playback continues without interruption (FR33)
**And** total failover time is <2 seconds (NFR2)

**Given** a stream has failed over to a backup source
**When** the stream session continues
**Then** the proxy remains on the backup source for the duration of this session
**And** the next stream request will attempt primary source fresh

**Given** all backup streams fail
**When** no sources remain
**Then** the stream ends gracefully
**And** an error event is logged with full context

**Technical Notes:**
- Integrate with existing FFmpeg buffer process
- Use tokio interval for health check loop (every 1 second)
- Track bytes_received, last_data_time, current_throughput
- Leverage existing failover logic from Story 4.5
- Health metrics stored in StreamSession struct

**Implementation Hints:**
- Add `StreamHealthMonitor` component to `proxy/` module
- Extend `StreamSession` with: `last_byte_time`, `bytes_per_second`, `stall_count`
- Health check loop runs parallel to stream proxy task
- Use tokio::select! to race health timeout vs data received
```

### 4.2 PRD Update

**Section:** Functional Requirements — Stream Handling

```diff
- FR29: System can detect stream failures (connection drops, errors)
+ FR29: System can detect stream failures at connection time AND during active streaming (connection drops, errors, stalls, zero throughput)

- FR30: System can automatically failover to next quality tier on failure
+ FR30: System can automatically failover to next quality tier on failure, both at connection and mid-stream
```

**Section:** Non-Functional Requirements — Reliability

```diff
- NFR11: > 99% of stream failures recovered via failover
+ NFR11: > 99% of stream failures recovered via failover (including mid-stream failures)
```

### 4.3 Architecture Update

**Section:** Stream Proxy — Failover Strategy

```diff
**Failover Strategy:**
1. Attempt highest available quality
2. On failure (timeout 5s, connection error, HTTP error), try next quality tier
3. Track failures per quality tier
4. Once failed over, remain on backup for session duration
5. Log all failover events
+ 6. **Mid-stream monitoring:** Health check loop tracks bytes/sec every 1s
+ 7. **Stall detection:** If 0 bytes for >3s, trigger failover (reuse steps 2-4)
+ 8. **Graceful handoff:** FFmpeg buffer (2-5s) hides switch from Plex
```

**Section:** Stream Proxy — Key Types

```diff
pub struct StreamSession {
    channel_id: i32,
    current_quality: Quality,
    started_at: Instant,
    failover_count: u32,
+   last_byte_time: Instant,
+   bytes_per_second: f64,
+   stall_detected: bool,
}
```

### 4.4 Epics Document Update

**Section:** Epic 4 — Story List

```diff
### Epic 4: Plex Integration & Streaming

**Scope:**
...
- Automatic failover to next quality tier
+ - Automatic failover to next quality tier (connection and mid-stream)
+ - Stream health monitoring with stall detection
...

**Stories:**
- 4.1: Serve M3U Playlist Endpoint
- 4.2: Serve XMLTV EPG Endpoint
- 4.3: Implement HDHomeRun Emulation
- 4.4: Stream Proxy with Quality Selection
- 4.5: Automatic Stream Failover
- 4.6: Display Plex Configuration URLs
+ - 4.7: Stream Health Monitoring with Mid-Stream Failover
```

### 4.5 Sprint Status Update

```diff
# Epic 4: Plex Integration & Streaming
- epic-4: in-progress
+ epic-4: in-progress
4-1-serve-m3u-playlist-endpoint: done
4-2-serve-xmltv-epg-endpoint: done
4-3-implement-hdhomerun-emulation: done
4-4-stream-proxy-with-quality-selection: done
4-5-automatic-stream-failover: done
4-6-display-plex-configuration-urls: done
+ 4-7-stream-health-monitoring-with-mid-stream-failover: backlog
epic-4-retrospective: optional
```

---

## 5. Implementation Handoff

### Change Scope: **Moderate**

Requires backlog reorganization (new story) and artifact updates.

### Handoff Recipients

| Role | Responsibility |
|------|----------------|
| **Scrum Master (Bob)** | Update sprint-status.yaml, create Story 4.7 file |
| **Developer** | Implement Story 4.7 using existing FFmpeg + failover foundation |
| **Product Owner** | Approve PRD clarifications (FR29, FR30, NFR11) |

### Implementation Sequence

1. ✅ SM: Update `sprint-status.yaml` with Story 4.7
2. ✅ SM: Update `epics.md` with Story 4.7
3. ⏳ SM: Create `story-4-7.md` via create-story workflow
4. ⏳ Dev: Implement Story 4.7
5. ⏳ SM: Update PRD (FR29, FR30, NFR11)
6. ⏳ SM: Update Architecture (failover strategy, StreamSession)

### Success Criteria

- [ ] Stream health monitor detects stalls within 3 seconds
- [ ] Mid-stream failover completes in <2 seconds
- [ ] Plex playback continues uninterrupted during failover
- [ ] Stream remains on backup source for session duration after failover
- [ ] All failover events logged with context

---

## 6. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-21 | Bob (SM) | Initial Sprint Change Proposal |
