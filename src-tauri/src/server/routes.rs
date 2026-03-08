use axum::{routing::{get, post, delete}, Router};

use super::browser_stream::{start_hls_stream, serve_hls_playlist, serve_hls_segment, stop_hls_stream, stop_hls_stream_options};
use super::handlers::{
    device_xml, discover_json, epg_xml, fallback_handler, health_check, lineup_json,
    lineup_status_json, playlist_m3u, stream_proxy, seed_test_data, clear_test_data_endpoint,
};
use super::state::AppState;

/// Create the Axum router with all routes configured
///
/// # Arguments
/// * `state` - Application state to attach to the router
///
/// # Returns
/// * `Router` - Configured Axum router ready for serving
pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/playlist.m3u", get(playlist_m3u))
        .route("/epg.xml", get(epg_xml))
        // HDHomeRun emulation endpoints (Story 4-3)
        .route("/discover.json", get(discover_json))
        .route("/lineup.json", get(lineup_json))
        .route("/lineup_status.json", get(lineup_status_json))
        .route("/device.xml", get(device_xml))
        // Stream proxy endpoint (Story 4-4)
        // Routes stream requests to Xtream providers with quality selection
        .route("/stream/{channel_id}", get(stream_proxy))
        // Browser-compatible HLS stream proxy
        // Uses FFmpeg to create local HLS stream for in-app playback
        .route("/hls/start", get(start_hls_stream))
        .route("/hls/{session_id}/stream.m3u8", get(serve_hls_playlist))
        .route("/hls/{session_id}/{segment}", get(serve_hls_segment))
        .route("/hls/{session_id}/stop", delete(stop_hls_stream).options(stop_hls_stream_options))
        // Test data endpoints (only functional when IPTV_TEST_MODE=1)
        .route("/test/seed", post(seed_test_data))
        .route("/test/seed", delete(clear_test_data_endpoint))
        .fallback(fallback_handler)
        .with_state(state)
}
