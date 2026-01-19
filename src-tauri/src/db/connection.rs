use std::path::PathBuf;

use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

/// Database connection wrapper for Tauri state management
pub struct DbConnection {
    pub database_url: String,
}

impl DbConnection {
    pub fn new(database_url: String) -> Self {
        Self { database_url }
    }

    /// Get a new connection to the database
    pub fn get_connection(&self) -> Result<SqliteConnection, diesel::ConnectionError> {
        establish_connection(&self.database_url)
    }
}

/// Get the database path using Tauri's app data directory API
pub fn get_db_path(app: &tauri::App) -> Result<PathBuf, Box<dyn std::error::Error>> {
    use tauri::Manager;

    let app_data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data_dir)?;
    Ok(app_data_dir.join("iptv.db"))
}

/// Establish a connection to the SQLite database
pub fn establish_connection(database_url: &str) -> Result<SqliteConnection, diesel::ConnectionError> {
    SqliteConnection::establish(database_url)
}

/// Run all pending migrations
pub fn run_migrations(
    conn: &mut SqliteConnection,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    conn.run_pending_migrations(MIGRATIONS)?;
    Ok(())
}
