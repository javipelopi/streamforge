use axum::{http::StatusCode, Json};
use serde::Serialize;

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

// TODO: Epic 4, Story 4-1: M3U Playlist Endpoint
// Implement GET /lineup.m3u endpoint that:
// 1. Queries xmltv_channels JOIN xmltv_channel_settings WHERE is_enabled = 1
// 2. Only includes channels with matched streams (channel_mappings)
// 3. Returns M3U format playlist for Plex consumption
// See: AC #2 from Story 3-5 (channel enable/disable) requires M3U filtering by is_enabled
