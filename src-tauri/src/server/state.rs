use diesel::prelude::*;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::Instant;

use crate::db::{schema::settings, DbPool, DbPooledConnection};
use super::stream::StreamManager;

/// Default server port constant
const DEFAULT_SERVER_PORT: u16 = 5004;
const SERVER_PORT_KEY: &str = "server_port";
/// Default maximum concurrent stream connections
const DEFAULT_MAX_CONNECTIONS: u32 = 2;

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
/// the database connection pool, caches, stream manager, and app data directory.
#[derive(Clone)]
pub struct AppState {
    pool: DbPool,
    epg_cache: Arc<RwLock<Option<EpgCache>>>,
    /// Stream manager for tracking active sessions and enforcing connection limits
    stream_manager: Arc<StreamManager>,
    /// App data directory for credential retrieval
    app_data_dir: PathBuf,
}

impl AppState {
    /// Create new AppState from a database pool
    ///
    /// Initializes StreamManager with max_connections from active accounts
    /// or DEFAULT_MAX_CONNECTIONS if no accounts exist.
    ///
    /// NOTE: Uses default app data dir - prefer `with_app_data_dir` for production
    pub fn new(pool: DbPool) -> Self {
        // Calculate total max_connections from all active accounts
        let max_connections = Self::get_total_max_connections(&pool)
            .unwrap_or(DEFAULT_MAX_CONNECTIONS);

        // Use a default app_data_dir for backward compatibility
        // Stream proxy will fail to decrypt passwords without proper app_data_dir
        let app_data_dir = dirs::data_dir()
            .map(|d| d.join("streamforge"))
            .unwrap_or_else(|| PathBuf::from("."));

        Self {
            pool,
            epg_cache: Arc::new(RwLock::new(None)),
            stream_manager: Arc::new(StreamManager::new(max_connections)),
            app_data_dir,
        }
    }

    /// Create new AppState with explicit app data directory
    ///
    /// This is the preferred constructor for production use as it ensures
    /// the stream proxy can properly decrypt credentials.
    pub fn with_app_data_dir(pool: DbPool, app_data_dir: PathBuf) -> Self {
        let max_connections = Self::get_total_max_connections(&pool)
            .unwrap_or(DEFAULT_MAX_CONNECTIONS);

        Self {
            pool,
            epg_cache: Arc::new(RwLock::new(None)),
            stream_manager: Arc::new(StreamManager::new(max_connections)),
            app_data_dir,
        }
    }

    /// Get total max_connections from all active accounts
    fn get_total_max_connections(pool: &DbPool) -> Option<u32> {
        use crate::db::schema::accounts;

        let mut conn = pool.get().ok()?;
        let total: Option<i64> = accounts::table
            .filter(accounts::is_active.eq(1))
            .select(diesel::dsl::sum(accounts::max_connections))
            .first(&mut conn)
            .ok()?;

        total.map(|t| t as u32)
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

    /// Get reference to the stream manager
    pub fn stream_manager(&self) -> &Arc<StreamManager> {
        &self.stream_manager
    }

    /// Get reference to the app data directory
    pub fn app_data_dir(&self) -> &PathBuf {
        &self.app_data_dir
    }
}
