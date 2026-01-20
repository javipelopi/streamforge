use diesel::prelude::*;
use std::sync::{Arc, RwLock};
use std::time::Instant;

use crate::db::{schema::settings, DbPool, DbPooledConnection};

/// Default server port constant
const DEFAULT_SERVER_PORT: u16 = 5004;
const SERVER_PORT_KEY: &str = "server_port";

/// Cache for EPG XMLTV content
#[derive(Clone, Debug)]
pub struct EpgCache {
    pub content: String,
    pub etag: String,
    pub generated_at: Instant,
}

/// Application state for the HTTP server
///
/// Holds shared resources needed by request handlers, primarily
/// the database connection pool and caches for expensive operations.
#[derive(Clone)]
pub struct AppState {
    pool: DbPool,
    epg_cache: Arc<RwLock<Option<EpgCache>>>,
}

impl AppState {
    /// Create new AppState from a database pool
    pub fn new(pool: DbPool) -> Self {
        Self {
            pool,
            epg_cache: Arc::new(RwLock::new(None)),
        }
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

    /// Get cached EPG content if valid (not expired)
    ///
    /// Cache TTL is 5 minutes per Story 4-2 requirements
    pub fn get_epg_cache(&self) -> Option<EpgCache> {
        if let Ok(cache_lock) = self.epg_cache.read() {
            if let Some(ref cache) = *cache_lock {
                // Check if cache is still valid (5 minute TTL)
                if cache.generated_at.elapsed().as_secs() < 300 {
                    return Some(cache.clone());
                }
            }
        }
        None
    }

    /// Store EPG content in cache
    pub fn set_epg_cache(&self, content: String, etag: String) {
        if let Ok(mut cache_lock) = self.epg_cache.write() {
            *cache_lock = Some(EpgCache {
                content,
                etag,
                generated_at: Instant::now(),
            });
        }
    }

    /// Invalidate EPG cache (called when channel settings or programs change)
    pub fn invalidate_epg_cache(&self) {
        if let Ok(mut cache_lock) = self.epg_cache.write() {
            *cache_lock = None;
        }
    }
}
