use diesel::prelude::*;

use crate::db::{schema::settings, DbPool, DbPooledConnection};

/// Default server port constant
const DEFAULT_SERVER_PORT: u16 = 5004;
const SERVER_PORT_KEY: &str = "server_port";

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
    /// Reads actual value from database to honor user configuration.
    pub fn get_port(&self) -> u16 {
        // Try to read from settings table, fall back to default
        match self.pool.get() {
            Ok(mut conn) => {
                settings::table
                    .filter(settings::key.eq(SERVER_PORT_KEY))
                    .select(settings::value)
                    .first::<String>(&mut conn)
                    .ok()
                    .and_then(|port_str| port_str.parse::<u16>().ok())
                    .unwrap_or(DEFAULT_SERVER_PORT)
            }
            Err(_) => DEFAULT_SERVER_PORT,
        }
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
