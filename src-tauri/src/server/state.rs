use crate::db::{DbPool, DbPooledConnection};

/// Application state for the HTTP server
///
/// Holds shared resources needed by request handlers, primarily
/// the database connection pool.
#[derive(Clone)]
pub struct AppState {
    pool: DbPool,
}

impl AppState {
    /// Create new AppState from a database pool
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// Get the configured server port
    ///
    /// Returns the port from settings table, defaulting to 5004.
    /// For now, returns the default - full implementation when settings
    /// CRUD is established in Epic 2.
    pub fn get_port(&self) -> u16 {
        // TODO: Read from settings table when available
        // For now, return default port 5004
        5004
    }

    /// Get a database connection from the pool
    pub fn get_connection(&self) -> Result<DbPooledConnection, r2d2::Error> {
        self.pool.get()
    }

    /// Get a reference to the database pool
    pub fn pool(&self) -> &DbPool {
        &self.pool
    }
}
