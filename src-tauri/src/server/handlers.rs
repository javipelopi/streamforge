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
// ============================================================================
// CRITICAL: Implement GET /lineup.m3u endpoint
//
// ACCEPTANCE CRITERIA (AC #2 from Story 3-5):
// "Given an XMLTV channel is disabled, when the M3U playlist is generated for Plex,
//  then the disabled channel is excluded"
//
// IMPLEMENTATION REQUIREMENTS:
// 1. Query ONLY enabled channels with matched streams:
//    SELECT xc.*, xcs.plex_display_order
//    FROM xmltv_channels xc
//    INNER JOIN xmltv_channel_settings xcs ON xc.id = xcs.xmltv_channel_id
//    WHERE xcs.is_enabled = 1
//    ORDER BY xcs.plex_display_order ASC NULLS LAST;
//
// 2. Verify each channel has at least one matched stream (channel_mappings table)
//
// 3. Return M3U8 format playlist:
//    #EXTM3U
//    #EXTINF:-1 tvg-id="..." tvg-logo="...", Channel Name
//    http://localhost:5004/stream/{xmltv_channel_id}
//
// 4. Stream URL must use xmltv_channel_id (not xtream stream_id)
//
// See: _bmad-output/planning-artifacts/epics.md Story 3.5 AC #2
// See: Architecture.md "M3U Playlist Generation" section
