use axum::{
    extract::State,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

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
/// Returns Content-Type: audio/x-mpegurl with ETag for caching
pub async fn playlist_m3u(State(state): State<AppState>) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut conn = state
        .get_connection()
        .map_err(|e| {
            eprintln!("M3U playlist error - database connection failed: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Service temporarily unavailable".to_string())
        })?;

    let port = state.get_port();
    let m3u_content = m3u::generate_m3u_playlist(&mut conn, port)
        .map_err(|e| {
            eprintln!("M3U playlist error - generation failed: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Unable to generate playlist".to_string())
        })?;

    // Generate ETag from content hash for cache validation
    // Plex can use this to avoid re-downloading unchanged playlists
    let etag = generate_etag(&m3u_content);

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("audio/x-mpegurl"));
    headers.insert(
        header::CONTENT_LENGTH,
        HeaderValue::from_str(&m3u_content.len().to_string()).unwrap(),
    );
    headers.insert(
        header::ETAG,
        HeaderValue::from_str(&format!("\"{}\"", etag)).unwrap(),
    );
    // Cache for 5 minutes - Plex polls frequently but playlist rarely changes
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=300"),
    );

    Ok((headers, m3u_content))
}

/// Generate ETag from content hash
///
/// Uses fast non-cryptographic hash (DefaultHasher) since we only need
/// cache validation, not security.
fn generate_etag(content: &str) -> String {
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}
