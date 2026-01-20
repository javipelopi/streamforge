use axum::{routing::get, Router};

use super::handlers::{fallback_handler, health_check, playlist_m3u};
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
        .fallback(fallback_handler)
        .with_state(state)
}
