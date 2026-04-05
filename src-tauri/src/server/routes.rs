use axum::{routing::{get, post, delete}, Router};

use super::api;
use super::handlers::{
    device_xml, discover_json, epg_xml, health_check, lineup_json,
    lineup_status_json, playlist_m3u, stream_proxy, seed_test_data, clear_test_data_endpoint,
};
use super::state::AppState;
use super::static_files::static_handler;

/// Create the Axum router with all routes configured
///
/// # Arguments
/// * `state` - Application state to attach to the router
///
/// # Returns
/// * `Router` - Configured Axum router ready for serving
pub fn create_router(state: AppState) -> Router {
    Router::new()
        // Management REST API (ip-wps)
        .nest("/api", api::api_router())
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
        // Used directly by mpegts.js player for in-app playback
        .route("/stream/{channel_id}", get(stream_proxy))
        // Test data endpoints (only functional when IPTV_TEST_MODE=1)
        .route("/test/seed", post(seed_test_data))
        .route("/test/seed", delete(clear_test_data_endpoint))
        .with_state(state)
        // Embedded static files as fallback (SPA frontend)
        .fallback(static_handler)
}
