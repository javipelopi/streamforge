pub mod epg;
pub mod handlers;
pub mod hdhr;
pub mod m3u;
pub mod routes;
pub mod state;
pub mod stream;

use std::net::SocketAddr;
use std::path::PathBuf;

use crate::db::DbPool;

pub use state::AppState;

/// Server error types for proper error handling
#[derive(Debug, thiserror::Error)]
pub enum ServerError {
    #[error("Failed to bind to address: {0}")]
    BindError(#[from] std::io::Error),

    #[error("Server runtime error: {0}")]
    RuntimeError(String),

    #[error("Database error: {0}")]
    DatabaseError(String),
}

/// Start the HTTP server on the specified port
///
/// # Arguments
/// * `state` - Application state containing database pool
///
/// # Returns
/// * `Result<(), ServerError>` - Ok if server runs successfully, Err on failure
pub async fn start_server(state: AppState) -> Result<(), ServerError> {
    let port = state.get_port();
    let app = routes::create_router(state);

    // CRITICAL: Bind to 127.0.0.1 only - not 0.0.0.0 for security (NFR21)
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    println!("HTTP server listening on http://{}", addr);
    axum::serve(listener, app)
        .await
        .map_err(|e| ServerError::RuntimeError(e.to_string()))?;

    Ok(())
}

/// Create AppState from database pool for server initialization
///
/// Uses default app data directory. For production, prefer `create_app_state_with_dir`.
pub fn create_app_state(pool: DbPool) -> AppState {
    AppState::new(pool)
}

/// Create AppState with explicit app data directory
///
/// This is the preferred constructor for production use as it ensures
/// the stream proxy can properly decrypt credentials stored in keyring/AES.
pub fn create_app_state_with_dir(pool: DbPool, app_data_dir: PathBuf) -> AppState {
    AppState::with_app_data_dir(pool, app_data_dir)
}
