use axum::{handler::HandlerWithoutStateExt, routing::{get, post, delete}, Router};
use tower_http::services::ServeDir;

use super::api;
use super::browser_stream::{start_hls_stream, serve_hls_playlist, serve_hls_segment, stop_hls_stream, stop_hls_stream_options};
use super::handlers::{
    device_xml, discover_json, epg_xml, fallback_handler, health_check, lineup_json,
    lineup_status_json, playlist_m3u, stream_proxy, seed_test_data, clear_test_data_endpoint,
};
use super::state::AppState;

/// Resolve the directory containing pre-built frontend assets.
///
/// Checked in order:
/// 1. `STREAMFORGE_STATIC_DIR` environment variable
/// 2. `./dist` relative to the current working directory
/// 3. `/usr/share/streamforge/dist` (Linux package convention)
///
/// Returns `None` when no candidate directory exists on disk.
fn resolve_static_dir() -> Option<std::path::PathBuf> {
    if let Ok(env_dir) = std::env::var("STREAMFORGE_STATIC_DIR") {
        let p = std::path::PathBuf::from(env_dir);
        if p.is_dir() {
            return Some(p);
        }
    }

    let local = std::path::PathBuf::from("./dist");
    if local.is_dir() {
        return Some(local);
    }

    let system = std::path::PathBuf::from("/usr/share/streamforge/dist");
    if system.is_dir() {
        return Some(system);
    }

    None
}

/// Create the Axum router with all routes configured
///
/// # Arguments
/// * `state` - Application state to attach to the router
///
/// # Returns
/// * `Router` - Configured Axum router ready for serving
pub fn create_router(state: AppState) -> Router {
    let api_router = Router::new()
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
        .with_state(state);

    // If a static asset directory exists, serve it as a fallback so the Vite
    // frontend build is available at `/`.  Unmatched API routes still get the
    // 404 handler because API routes are matched first.
    if let Some(static_dir) = resolve_static_dir() {
        tracing::info!("Serving static files from {}", static_dir.display());
        let serve_dir = ServeDir::new(static_dir)
            .not_found_service(fallback_handler.into_service());
        api_router.fallback_service(serve_dir)
    } else {
        tracing::info!("No static asset directory found; frontend will not be served");
        api_router.fallback(fallback_handler)
    }
}
