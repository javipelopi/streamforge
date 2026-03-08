//! Browser-compatible HLS stream proxy using FFmpeg
//!
//! Creates a local HLS stream from any input URL using FFmpeg.
//! This solves codec/container compatibility issues that browsers have with IPTV streams.

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
use tokio::sync::RwLock;
use uuid::Uuid;

use super::buffer::check_ffmpeg_available;
use super::state::AppState;

/// Active HLS sessions
static HLS_SESSIONS: once_cell::sync::Lazy<Arc<RwLock<HashMap<String, HlsSession>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));

/// Represents an active HLS streaming session
struct HlsSession {
    /// Temp directory containing HLS segments
    temp_dir: PathBuf,
    /// FFmpeg process handle
    _ffmpeg_handle: tokio::task::JoinHandle<()>,
    /// Source URL
    #[allow(dead_code)]
    source_url: String,
}

impl Drop for HlsSession {
    fn drop(&mut self) {
        // Clean up temp directory when session is dropped
        let temp_dir = self.temp_dir.clone();
        tokio::spawn(async move {
            let _ = fs::remove_dir_all(&temp_dir).await;
        });
    }
}

#[derive(Deserialize)]
pub struct StartStreamQuery {
    /// The stream URL to proxy
    pub url: String,
}

/// Start a new HLS stream session
/// Returns a session ID that can be used to access the HLS manifest and segments
pub async fn start_hls_stream(
    Query(query): Query<StartStreamQuery>,
    State(state): State<AppState>,
) -> Result<Response, (StatusCode, String)> {
    let url = query.url.clone();

    state.log_stream_event(
        "info",
        &format!("Starting HLS stream for URL: {}", &url[..url.len().min(100)]),
        None,
    );

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

    let playlist_path = temp_dir.join("stream.m3u8");
    let segment_pattern = temp_dir.join("segment%03d.ts");

    // Start FFmpeg to create HLS segments
    let ffmpeg_temp_dir = temp_dir.clone();
    let ffmpeg_url = url.clone();
    let ffmpeg_handle = tokio::spawn(async move {
        let result = Command::new("ffmpeg")
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
                "-i", &ffmpeg_url,
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

        match result {
            Ok(mut child) => {
                eprintln!("[HLS FFmpeg] Started for session in {:?}", ffmpeg_temp_dir);

                // Log stderr in a separate task so we don't block
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

                let exit_status = child.wait().await;
                eprintln!("[HLS FFmpeg] Exited with status: {:?}", exit_status);
            }
            Err(e) => {
                eprintln!("[HLS FFmpeg] Failed to start: {}", e);
            }
        }

        // NOTE: Don't cleanup temp directory here!
        // The session's Drop impl handles cleanup when the session is removed from HLS_SESSIONS.
        // Cleaning up here would delete files while they're still being served.
        eprintln!("[HLS FFmpeg] Task ended (temp dir NOT cleaned - session Drop handles this)");
    });

    // Create session object (we'll store it after confirming playlist is ready)
    let session = HlsSession {
        temp_dir: temp_dir.clone(),
        _ffmpeg_handle: ffmpeg_handle,
        source_url: url,
    };

    // Wait for FFmpeg to create the initial playlist (poll with timeout)
    let playlist_path = temp_dir.join("stream.m3u8");
    let max_wait = std::time::Duration::from_secs(15);
    let start = std::time::Instant::now();

    eprintln!("[HLS Session {}] Waiting for playlist at {:?}", &session_id[..8], playlist_path);

    loop {
        if playlist_path.exists() {
            // Also check that there's at least one segment
            if let Ok(content) = fs::read_to_string(&playlist_path).await {
                eprintln!("[HLS Session {}] Playlist content: {}", &session_id[..8], content.replace('\n', " | "));
                if content.contains(".ts") {
                    eprintln!("[HLS Session {}] Playlist ready with segments!", &session_id[..8]);
                    break;
                }
            }
        } else {
            // Check if temp dir still exists
            if !temp_dir.exists() {
                eprintln!("[HLS Session {}] ERROR: Temp dir was deleted! FFmpeg may have crashed.", &session_id[..8]);
                return Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Stream failed to start - FFmpeg may have crashed.".to_string(),
                ));
            }
        }

        if start.elapsed() > max_wait {
            eprintln!("[HLS Session {}] Timeout waiting for playlist", &session_id[..8]);
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
        sessions.insert(session_id.clone(), session);
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
        Ok(content) => {
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")
                .header(header::CACHE_CONTROL, "no-cache, no-store")
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(Body::from(content))
                .unwrap()
        }
        Err(e) => {
            state.log_stream_event("warning", &format!("Playlist not available: {}", e), None);
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
        Ok(content) => {
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "video/mp2t")
                .header(header::CACHE_CONTROL, "no-cache")
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(Body::from(content))
                .unwrap()
        }
        Err(e) => {
            state.log_stream_event("warning", &format!("Segment {} not available: {}", segment_name, e), None);
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
        .body(Body::from(if status == StatusCode::OK { "Session stopped" } else { "Session not found" }))
        .unwrap()
}

/// CORS preflight handler for stop endpoint
pub async fn stop_hls_stream_options(
    Path(_session_id): Path<String>,
) -> Response {
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
