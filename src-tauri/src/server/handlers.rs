use axum::{
    extract::State,
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Serialize;

use super::m3u;
use super::state::AppState;

/// Health check response structure
#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
}

/// Health check endpoint handler
///
/// Returns a 200 OK with JSON body indicating server health.
/// Used by Plex and monitoring tools to verify server is running.
pub async fn health_check() -> (StatusCode, Json<HealthResponse>) {
    (
        StatusCode::OK,
        Json(HealthResponse {
            status: "healthy".to_string(),
        }),
    )
}

/// Fallback handler for 404 responses
///
/// Returns 404 Not Found for any routes not explicitly defined.
pub async fn fallback_handler() -> StatusCode {
    StatusCode::NOT_FOUND
}

/// M3U Playlist endpoint handler (Story 4-1)
///
/// Generates an M3U playlist for Plex integration containing:
/// - Only enabled XMLTV channels with Xtream stream mappings
/// - XMLTV channel names, IDs, and icons (with Xtream fallback)
/// - Channel numbers from plex_display_order
/// - Stream URLs pointing to /stream/{xmltv_channel_id}
///
/// Returns Content-Type: audio/x-mpegurl
pub async fn playlist_m3u(State(state): State<AppState>) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut conn = state
        .get_connection()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database connection error: {}", e)))?;

    let port = state.get_port();
    let m3u_content = m3u::generate_m3u_playlist(&mut conn, port)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to generate M3U playlist: {}", e)))?;

    Ok(([(header::CONTENT_TYPE, "audio/x-mpegurl")], m3u_content))
}
