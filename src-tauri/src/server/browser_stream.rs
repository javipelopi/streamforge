//! Browser-compatible HLS stream proxy using FFmpeg
//!
//! Creates a local HLS stream from any input URL using FFmpeg.
//! This solves codec/container compatibility issues that browsers have with IPTV streams.
//!
//! Key design: When given a channel_id, resolves the upstream URL server-side
//! to avoid self-looping through localhost (which would deadlock the server).
//! Includes failover monitoring that restarts FFmpeg with backup streams
//! when segments stop arriving.

use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::Response,
};
use serde::Deserialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tokio::fs;
use tokio::process::Command;
use tokio::sync::{watch, RwLock};
use uuid::Uuid;

use super::buffer::check_ffmpeg_available;
use super::failover::{get_all_streams_for_channel, BackupStream};
use super::state::AppState;
use super::stream::build_stream_url_for_source;
use crate::credentials::CredentialManager;

/// How long to wait for new .ts segments before triggering failover (seconds)
const SEGMENT_STALL_TIMEOUT_SECS: u64 = 15;

/// Active HLS sessions
static HLS_SESSIONS: once_cell::sync::Lazy<Arc<RwLock<HashMap<String, HlsSession>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));

/// Represents an active HLS streaming session
struct HlsSession {
    /// Temp directory containing HLS segments
    temp_dir: PathBuf,
    /// Shutdown signal sender — dropping or sending triggers cleanup
    _shutdown_tx: watch::Sender<bool>,
    /// FFmpeg + monitor task handle
    _task_handle: tokio::task::JoinHandle<()>,
}

impl Drop for HlsSession {
    fn drop(&mut self) {
        // Signal shutdown to monitor/ffmpeg tasks
        let _ = self._shutdown_tx.send(true);
        // Clean up temp directory when session is dropped
        let temp_dir = self.temp_dir.clone();
        tokio::spawn(async move {
            let _ = fs::remove_dir_all(&temp_dir).await;
        });
    }
}

#[derive(Deserialize)]
pub struct StartStreamQuery {
    /// The stream URL to proxy (legacy — causes self-loop for channel streams)
    pub url: Option<String>,
    /// XMLTV channel ID — server resolves upstream URL directly (preferred)
    pub channel_id: Option<i32>,
}

/// Resolve the upstream URL for a channel, returning the URL and backup streams
fn resolve_channel_streams(
    state: &AppState,
    channel_id: i32,
) -> Result<(String, Vec<BackupStream>), (StatusCode, String)> {
    let mut conn = state.get_connection().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database connection failed: {}", e),
        )
    })?;

    let available_streams = get_all_streams_for_channel(&mut conn, channel_id).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Stream lookup failed for channel {}: {}", channel_id, e),
        )
    })?;

    if available_streams.is_empty() {
        return Err((
            StatusCode::NOT_FOUND,
            format!("No streams found for channel {}", channel_id),
        ));
    }

    let credential_manager = CredentialManager::new(state.app_data_dir().clone());

    // Build URL for the first (highest priority) stream
    let url = build_stream_url_for_source(
        &available_streams[0].source_type,
        Some(&credential_manager),
    )
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to build stream URL: {}", e),
        )
    })?;

    Ok((url, available_streams))
}

/// Build the upstream URL for a specific backup stream index
fn build_url_for_stream(
    state: &AppState,
    stream: &BackupStream,
) -> Option<String> {
    let credential_manager = CredentialManager::new(state.app_data_dir().clone());
    build_stream_url_for_source(&stream.source_type, Some(&credential_manager)).ok()
}

/// Start a new HLS stream session
/// Accepts either channel_id (preferred, avoids self-loop) or url (legacy)
/// Returns a session ID that can be used to access the HLS manifest and segments
pub async fn start_hls_stream(
    Query(query): Query<StartStreamQuery>,
    State(state): State<AppState>,
) -> Result<Response, (StatusCode, String)> {
    // Resolve the upstream URL — either from channel_id or direct url
    let (upstream_url, backup_streams) = match (query.channel_id, query.url) {
        (Some(channel_id), _) => {
            // Preferred: resolve server-side, no self-loop
            state.log_stream_event(
                "info",
                &format!("Starting HLS stream for channel {} (server-side resolution)", channel_id),
                None,
            );
            resolve_channel_streams(&state, channel_id)?
        }
        (None, Some(url)) => {
            // Legacy: direct URL (used for individual source playback)
            state.log_stream_event(
                "info",
                &format!("Starting HLS stream for URL: {}", &url[..url.len().min(100)]),
                None,
            );
            (url, Vec::new())
        }
        (None, None) => {
            return Err((
                StatusCode::BAD_REQUEST,
                "Either channel_id or url parameter is required".to_string(),
            ));
        }
    };

    // Check FFmpeg availability
    check_ffmpeg_available().map_err(|e| {
        let error_msg = format!("FFmpeg not found: {}", e);
        state.log_stream_event("error", &error_msg, None);
        (StatusCode::INTERNAL_SERVER_ERROR, error_msg)
    })?;

    // Create a unique session ID and temp directory
    let session_id = Uuid::new_v4().to_string();
    let temp_dir = std::env::temp_dir().join(format!("streamforge-hls-{}", &session_id));

    fs::create_dir_all(&temp_dir).await.map_err(|e| {
        let error_msg = format!("Failed to create temp directory: {}", e);
        state.log_stream_event("error", &error_msg, None);
        (StatusCode::INTERNAL_SERVER_ERROR, error_msg)
    })?;

    // Shutdown signal for coordinating FFmpeg + monitor tasks
    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let num_streams = backup_streams.len().max(1);

    // Spawn the FFmpeg + failover monitor on a dedicated task
    // This prevents blocking the main server request handling pool
    let task_temp_dir = temp_dir.clone();
    let task_state = state.clone();
    let task_session_id = session_id.clone();
    let task_handle = tokio::spawn(async move {
        run_hls_session(
            task_temp_dir,
            upstream_url,
            backup_streams,
            shutdown_rx,
            task_state,
            task_session_id,
        )
        .await;
    });

    // Wait for FFmpeg to create the initial playlist (poll with timeout)
    // Allow enough time for failover: each stream gets SEGMENT_STALL_TIMEOUT_SECS before
    // the monitor triggers failover to the next stream, plus some buffer for FFmpeg startup
    let max_wait_secs = (SEGMENT_STALL_TIMEOUT_SECS + 5) * num_streams as u64;
    let playlist_path = temp_dir.join("stream.m3u8");
    let max_wait = std::time::Duration::from_secs(max_wait_secs);
    let start = std::time::Instant::now();

    eprintln!(
        "[HLS Session {}] Waiting for playlist at {:?}",
        &session_id[..8],
        playlist_path
    );

    loop {
        if playlist_path.exists() {
            if let Ok(content) = fs::read_to_string(&playlist_path).await {
                if content.contains(".ts") {
                    eprintln!(
                        "[HLS Session {}] Playlist ready with segments!",
                        &session_id[..8]
                    );
                    break;
                }
            }
        } else if !temp_dir.exists() {
            eprintln!(
                "[HLS Session {}] ERROR: Temp dir was deleted! FFmpeg may have crashed.",
                &session_id[..8]
            );
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                "Stream failed to start - FFmpeg may have crashed.".to_string(),
            ));
        }

        if start.elapsed() > max_wait {
            eprintln!(
                "[HLS Session {}] Timeout waiting for playlist",
                &session_id[..8]
            );
            return Err((
                StatusCode::GATEWAY_TIMEOUT,
                "Timeout waiting for stream to start. The stream may be offline.".to_string(),
            ));
        }

        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    }

    // Store the session
    {
        let mut sessions = HLS_SESSIONS.write().await;
        sessions.insert(
            session_id.clone(),
            HlsSession {
                temp_dir,
                _shutdown_tx: shutdown_tx,
                _task_handle: task_handle,
            },
        );
    }

    // Return the session ID as JSON
    let response_body = serde_json::json!({
        "session_id": session_id,
    });

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Body::from(response_body.to_string()))
        .unwrap())
}

/// Run an HLS session: spawn FFmpeg, monitor segments, failover on stall.
///
/// Runs entirely on a dedicated tokio task so it cannot starve the main
/// server's request handling pool.
async fn run_hls_session(
    temp_dir: PathBuf,
    initial_url: String,
    backup_streams: Vec<BackupStream>,
    mut shutdown_rx: watch::Receiver<bool>,
    state: AppState,
    session_id: String,
) {
    let sid = &session_id[..8.min(session_id.len())];
    let mut current_url = initial_url;
    let mut current_stream_idx: usize = 0;

    loop {
        let playlist_path = temp_dir.join("stream.m3u8");
        let segment_pattern = temp_dir.join("segment%03d.ts");

        eprintln!("[HLS Session {}] Starting FFmpeg with URL: {}",
            sid, &current_url[..current_url.len().min(80)]);

        // Spawn FFmpeg process
        let ffmpeg_result = Command::new("ffmpeg")
            .args([
                "-hide_banner",
                "-loglevel", "warning",
                // Input buffering - generous for network streams
                "-thread_queue_size", "8192",
                "-probesize", "32M",
                "-analyzeduration", "20M",
                // Tolerate problematic streams
                "-fflags", "+genpts+discardcorrupt+igndts",
                "-err_detect", "ignore_err",
                // Network reconnection
                "-reconnect", "1",
                "-reconnect_streamed", "1",
                "-reconnect_delay_max", "5",
                "-reconnect_on_network_error", "1",
                "-i", &current_url,
                // Video: COPY directly - no transcoding for speed
                "-c:v", "copy",
                // Audio: transcode to AAC for browser compatibility
                "-c:a", "aac",
                "-b:a", "128k",
                "-ar", "48000",
                "-ac", "2",
                // Output settings
                "-movflags", "+faststart",
                "-f", "hls",
                "-hls_time", "4",
                "-hls_list_size", "10",
                "-hls_flags", "append_list+omit_endlist+split_by_time",
                "-hls_segment_type", "mpegts",
                "-hls_segment_filename", segment_pattern.to_str().unwrap(),
                playlist_path.to_str().unwrap(),
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn();

        let mut child = match ffmpeg_result {
            Ok(child) => {
                eprintln!("[HLS Session {}] FFmpeg started (pid {:?})", sid, child.id());
                child
            }
            Err(e) => {
                eprintln!("[HLS Session {}] FFmpeg failed to start: {}", sid, e);
                return;
            }
        };

        // Spawn stderr logger
        if let Some(stderr) = child.stderr.take() {
            tokio::spawn(async move {
                use tokio::io::AsyncBufReadExt;
                let reader = tokio::io::BufReader::new(stderr);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    eprintln!("[HLS FFmpeg] {}", line);
                }
            });
        }

        // Monitor loop: watch for segment stalls or shutdown signal
        let stall_detected = monitor_segments(
            &temp_dir,
            &mut child,
            &mut shutdown_rx,
            sid,
        )
        .await;

        // Kill FFmpeg if still running
        let _ = child.kill().await;
        let _ = child.wait().await;

        if !stall_detected {
            // Normal exit or shutdown requested
            eprintln!("[HLS Session {}] FFmpeg session ended normally", sid);
            return;
        }

        // Stall detected — attempt failover to next stream
        if backup_streams.is_empty() {
            eprintln!("[HLS Session {}] Stall detected but no backup streams available", sid);
            return;
        }

        current_stream_idx += 1;
        if current_stream_idx >= backup_streams.len() {
            eprintln!(
                "[HLS Session {}] All {} backup streams exhausted",
                sid,
                backup_streams.len()
            );
            return;
        }

        let next_stream = &backup_streams[current_stream_idx];
        match build_url_for_stream(&state, next_stream) {
            Some(url) => {
                eprintln!(
                    "[HLS Session {}] Failover to stream {} (idx {})",
                    sid, next_stream.stream_id, current_stream_idx
                );
                state.log_stream_event(
                    "info",
                    &format!(
                        "HLS failover: switching to backup stream {} (idx {})",
                        next_stream.stream_id, current_stream_idx
                    ),
                    None,
                );
                current_url = url;
                // Loop back to spawn new FFmpeg with the new URL
            }
            None => {
                eprintln!(
                    "[HLS Session {}] Failed to build URL for backup stream {}",
                    sid, next_stream.stream_id
                );
                // Try next stream
                continue;
            }
        }
    }
}

/// Monitor the HLS temp directory for new .ts segments.
/// Returns true if a stall was detected (failover needed), false for normal exit or shutdown.
async fn monitor_segments(
    temp_dir: &PathBuf,
    child: &mut tokio::process::Child,
    shutdown_rx: &mut watch::Receiver<bool>,
    sid: &str,
) -> bool {
    let mut last_segment_time = std::time::Instant::now();
    let mut last_segment_count: usize = 0;

    loop {
        tokio::select! {
            // Check shutdown signal
            _ = shutdown_rx.changed() => {
                eprintln!("[HLS Monitor {}] Shutdown signal received", sid);
                return false;
            }
            // Check if FFmpeg exited on its own
            exit_status = child.wait() => {
                eprintln!("[HLS Monitor {}] FFmpeg exited: {:?}", sid, exit_status);
                // FFmpeg died — treat as stall (trigger failover)
                return true;
            }
            // Periodic segment check
            _ = tokio::time::sleep(tokio::time::Duration::from_secs(2)) => {
                // Count .ts segment files
                let segment_count = count_segments(temp_dir).await;

                if segment_count > last_segment_count {
                    // New segments arrived — stream is healthy
                    last_segment_count = segment_count;
                    last_segment_time = std::time::Instant::now();
                } else if last_segment_time.elapsed().as_secs() >= SEGMENT_STALL_TIMEOUT_SECS {
                    // No new segments for too long — stall detected
                    eprintln!(
                        "[HLS Monitor {}] Stall detected: no new segments for {}s (count: {})",
                        sid, SEGMENT_STALL_TIMEOUT_SECS, segment_count
                    );
                    return true;
                }
            }
        }
    }
}

/// Count .ts segment files in the temp directory
async fn count_segments(temp_dir: &PathBuf) -> usize {
    let mut count = 0;
    if let Ok(mut entries) = fs::read_dir(temp_dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            if let Some(name) = entry.file_name().to_str() {
                if name.ends_with(".ts") {
                    count += 1;
                }
            }
        }
    }
    count
}

/// Serve HLS playlist for a session
pub async fn serve_hls_playlist(
    Path(session_id): Path<String>,
    State(state): State<AppState>,
) -> Response {
    let sessions = HLS_SESSIONS.read().await;

    let Some(session) = sessions.get(&session_id) else {
        return Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(Body::from("Session not found"))
            .unwrap();
    };

    let playlist_path = session.temp_dir.join("stream.m3u8");

    // Read the playlist file
    match fs::read_to_string(&playlist_path).await {
        Ok(content) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")
            .header(header::CACHE_CONTROL, "no-cache, no-store")
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(Body::from(content))
            .unwrap(),
        Err(e) => {
            state.log_stream_event(
                "warning",
                &format!("Playlist not available: {}", e),
                None,
            );
            // Stream likely ended - return 410 Gone with CORS headers
            Response::builder()
                .status(StatusCode::GONE)
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(Body::from("Stream ended"))
                .unwrap()
        }
    }
}

/// Serve HLS segment for a session
pub async fn serve_hls_segment(
    Path((session_id, segment_name)): Path<(String, String)>,
    State(state): State<AppState>,
) -> Response {
    let sessions = HLS_SESSIONS.read().await;

    let Some(session) = sessions.get(&session_id) else {
        return Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(Body::from("Session not found"))
            .unwrap();
    };

    let segment_path = session.temp_dir.join(&segment_name);

    // Read the segment file
    match fs::read(&segment_path).await {
        Ok(content) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "video/mp2t")
            .header(header::CACHE_CONTROL, "no-cache")
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(Body::from(content))
            .unwrap(),
        Err(e) => {
            state.log_stream_event(
                "warning",
                &format!("Segment {} not available: {}", segment_name, e),
                None,
            );
            Response::builder()
                .status(StatusCode::NOT_FOUND)
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(Body::from("Segment not found"))
                .unwrap()
        }
    }
}

/// Stop an HLS stream session
pub async fn stop_hls_stream(
    Path(session_id): Path<String>,
    State(_state): State<AppState>,
) -> Response {
    let mut sessions = HLS_SESSIONS.write().await;

    let status = if sessions.remove(&session_id).is_some() {
        StatusCode::OK
    } else {
        StatusCode::NOT_FOUND
    };

    Response::builder()
        .status(status)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, DELETE, OPTIONS")
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "Content-Type")
        .body(Body::from(if status == StatusCode::OK {
            "Session stopped"
        } else {
            "Session not found"
        }))
        .unwrap()
}

/// CORS preflight handler for stop endpoint
pub async fn stop_hls_stream_options(Path(_session_id): Path<String>) -> Response {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, DELETE, OPTIONS")
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "Content-Type")
        .body(Body::empty())
        .unwrap()
}

/// Cleanup old sessions (called periodically or on shutdown)
pub async fn cleanup_sessions() {
    let mut sessions = HLS_SESSIONS.write().await;
    sessions.clear();
}
