use std::path::PathBuf;

use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool, PooledConnection};
use diesel::sqlite::SqliteConnection;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

pub type DbPool = Pool<ConnectionManager<SqliteConnection>>;
pub type DbPooledConnection = PooledConnection<ConnectionManager<SqliteConnection>>;

/// Database connection pool wrapper for Tauri state management
pub struct DbConnection {
    pool: DbPool,
}

impl DbConnection {
    /// Create a new database connection pool
    pub fn new(database_url: String) -> Result<Self, Box<dyn std::error::Error>> {
        let manager = ConnectionManager::<SqliteConnection>::new(database_url);
        let pool = Pool::builder()
            .max_size(16) // Reasonable pool size for desktop app
            .build(manager)
            .map_err(|e| format!("Failed to create connection pool: {}", e))?;

        Ok(Self { pool })
    }

    /// Get a pooled connection from the pool
    pub fn get_connection(&self) -> Result<DbPooledConnection, Box<dyn std::error::Error>> {
        self.pool.get()
            .map_err(|e| format!("Failed to get connection from pool: {}", e).into())
    }
}

/// Get the database path using Tauri's app data directory API
pub fn get_db_path(app: &tauri::App) -> Result<PathBuf, Box<dyn std::error::Error>> {
    use tauri::Manager;

    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Cannot determine application data directory: {}", e))?;

    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!(
            "Cannot create database directory at '{}': {}. Please check folder permissions.",
            app_data_dir.display(),
            e
        ))?;

    Ok(app_data_dir.join("iptv.db"))
}

/// Establish a connection to the SQLite database with busy timeout
pub fn establish_connection(database_url: &str) -> Result<SqliteConnection, diesel::ConnectionError> {
    let mut conn = SqliteConnection::establish(database_url)?;

    // Set busy timeout to 5 seconds to handle concurrent access gracefully
    diesel::sql_query("PRAGMA busy_timeout = 5000")
        .execute(&mut conn)
        .map_err(|e| diesel::ConnectionError::BadConnection(format!("Failed to set busy_timeout: {}", e)))?;

    Ok(conn)
}

/// Run all pending migrations
pub fn run_migrations(
    conn: &mut SqliteConnection,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    conn.run_pending_migrations(MIGRATIONS)?;
    Ok(())
}
