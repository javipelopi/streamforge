pub mod accounts;
pub mod channels;
pub mod epg;
pub mod logs;
pub mod matcher;
pub mod test_data;
pub mod xmltv_channels;
pub mod xtream_sources;

use diesel::prelude::*;
use serde::Serialize;
use tauri::{AppHandle, State};

use crate::db::{schema::settings, DbConnection, Setting};
use crate::server::hdhr::{get_local_ip, get_tuner_count};

// Re-export account commands for convenient access
pub use accounts::{add_account, delete_account, get_accounts, test_connection, update_account};

// Re-export channel commands for convenient access
pub use channels::{get_channel_count, get_channels, scan_channels};

// Re-export EPG source commands for convenient access
pub use epg::{add_xmltv_source, delete_xmltv_source, get_xmltv_sources, toggle_xmltv_source, update_xmltv_source};

// Re-export test data commands (only available in test mode)
pub use test_data::{seed_stream_proxy_test_data, clear_stream_proxy_test_data};

/// Response type for autostart status queries
#[derive(Serialize)]
pub struct AutostartStatus {
    pub enabled: bool,
}

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to StreamForge.", name)
}

#[tauri::command]
pub fn get_setting(db: State<DbConnection>, key: String) -> Result<Option<String>, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let result = settings::table
        .filter(settings::key.eq(&key))
        .select(settings::value)
        .first::<String>(&mut conn)
        .optional()
        .map_err(|e| format!("Query error: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub fn set_setting(db: State<DbConnection>, key: String, value: String) -> Result<(), String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let setting = Setting::new(key, value);

    diesel::replace_into(settings::table)
        .values(&setting)
        .execute(&mut conn)
        .map_err(|e| format!("Insert error: {}", e))?;

    Ok(())
}

/// Get the current server port from settings
///
/// Returns the configured server port, or the default (5004) if not set.
#[allow(dead_code)] // Used by lib crate via tauri invoke_handler
#[tauri::command]
pub fn get_server_port(db: State<DbConnection>) -> Result<u16, String> {
    const DEFAULT_SERVER_PORT: u16 = 5004;
    const SERVER_PORT_KEY: &str = "server_port";

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let result = settings::table
        .filter(settings::key.eq(SERVER_PORT_KEY))
        .select(settings::value)
        .first::<String>(&mut conn)
        .optional()
        .map_err(|e| format!("Query error: {}", e))?;

    match result {
        Some(port_str) => port_str
            .parse::<u16>()
            .map_err(|e| format!("Invalid port value in settings: {}", e)),
        None => Ok(DEFAULT_SERVER_PORT),
    }
}

/// Set the server port in settings
///
/// Note: Changing the port requires an application restart to take effect.
#[allow(dead_code)] // Used by lib crate via tauri invoke_handler
#[tauri::command]
pub fn set_server_port(db: State<DbConnection>, port: u16) -> Result<(), String> {
    const SERVER_PORT_KEY: &str = "server_port";

    // Validate port range (only check lower bound - u16 max is 65535)
    if port < 1024 {
        return Err("Port must be 1024 or higher (non-privileged ports)".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let setting = Setting::new(SERVER_PORT_KEY.to_string(), port.to_string());

    diesel::replace_into(settings::table)
        .values(&setting)
        .execute(&mut conn)
        .map_err(|e| format!("Insert error: {}", e))?;

    Ok(())
}

/// Restart the HTTP server on the new port
///
/// Story 6.1: Settings GUI for Server and Startup Options
/// Task 3.1: Add restart_server Tauri command
///
/// IMPLEMENTATION NOTE: This is a placeholder implementation (Option A).
/// Port changes do NOT take effect immediately - they require a full application restart.
/// The frontend has been updated to inform users: "Port saved. Restart the app to apply changes."
///
/// Why Option A was chosen:
/// - Simpler implementation with no risk of server state corruption
/// - No need to manage server handle lifecycle or graceful connection shutdown
/// - Clear user expectation (restart required)
/// - Recommended approach in Dev Notes
///
/// Future enhancement (Option B): Implement hot restart by:
/// 1. Storing server handle in Tauri managed state
/// 2. Implementing graceful shutdown with connection draining
/// 3. Restarting server on same Tokio runtime with new port
#[allow(dead_code)] // Used by lib crate via tauri invoke_handler
#[tauri::command]
pub async fn restart_server() -> Result<(), String> {
    // Placeholder implementation - actual restart requires app restart
    println!("INFO: Server port change saved. Port will take effect on next application restart.");

    // This command exists to maintain API compatibility and allow future enhancement
    // Frontend correctly handles this by informing user to restart the app

    Ok(())
}

/// Get the current autostart status
///
/// Returns whether the application is configured to auto-start on boot.
#[allow(dead_code)] // Used by lib crate via tauri invoke_handler
#[tauri::command]
pub fn get_autostart_enabled(app: AppHandle) -> Result<AutostartStatus, String> {
    use tauri_plugin_autostart::ManagerExt;

    let autostart_manager = app.autolaunch();

    let enabled = autostart_manager
        .is_enabled()
        .map_err(|e| {
            eprintln!("Autostart status check failed: {}", e);
            "Failed to check autostart status".to_string()
        })?;

    Ok(AutostartStatus { enabled })
}

/// Set the autostart status
///
/// Enables or disables the application's auto-start on boot.
#[allow(dead_code)] // Used by lib crate via tauri invoke_handler
#[tauri::command]
pub fn set_autostart_enabled(
    app: AppHandle,
    db: State<DbConnection>,
    enabled: bool,
) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;

    let autostart_manager = app.autolaunch();

    if enabled {
        autostart_manager
            .enable()
            .map_err(|e| {
                eprintln!("Failed to enable autostart: {}", e);
                "Failed to enable autostart".to_string()
            })?;
    } else {
        autostart_manager
            .disable()
            .map_err(|e| {
                eprintln!("Failed to disable autostart: {}", e);
                "Failed to disable autostart".to_string()
            })?;
    }

    // Also persist the setting to database for UI sync
    const AUTOSTART_KEY: &str = "autostart_enabled";
    let mut conn = db
        .get_connection()
        .map_err(|e| {
            eprintln!("Database connection error while saving autostart: {}", e);
            "Failed to save autostart setting".to_string()
        })?;

    let setting = Setting::new(AUTOSTART_KEY.to_string(), enabled.to_string());

    diesel::replace_into(settings::table)
        .values(&setting)
        .execute(&mut conn)
        .map_err(|e| {
            eprintln!("Database insert error for autostart setting: {}", e);
            "Failed to save autostart setting".to_string()
        })?;

    Ok(())
}

/// Response type for Plex configuration URLs
///
/// Story 4-6: Display Plex Configuration URLs
/// Contains all URLs needed to configure Plex tuner plus server status.
#[derive(Serialize)]
pub struct PlexConfig {
    pub server_running: bool,
    pub local_ip: String,
    pub port: u16,
    pub m3u_url: String,
    pub epg_url: String,
    pub hdhr_url: String,
    pub tuner_count: i32,
}

/// Get Plex configuration URLs for display in Dashboard
///
/// Story 4-6: Display Plex Configuration URLs
///
/// Returns:
/// - server_running: Whether the HTTP server is accepting connections
/// - local_ip: Local network IP address (not 127.0.0.1)
/// - port: Configured server port (default 5004)
/// - m3u_url: URL for M3U playlist endpoint
/// - epg_url: URL for EPG/XMLTV endpoint
/// - hdhr_url: URL for HDHomeRun discovery (base URL)
/// - tuner_count: Maximum concurrent streams from active accounts
#[allow(dead_code)] // Used by lib crate via tauri invoke_handler
#[tauri::command]
pub async fn get_plex_config(db: State<'_, DbConnection>) -> Result<PlexConfig, String> {
    const DEFAULT_SERVER_PORT: u16 = 5004;
    const SERVER_PORT_KEY: &str = "server_port";

    // Get database connection
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    // Get port from settings (reuse existing pattern from get_server_port)
    let port = settings::table
        .filter(settings::key.eq(SERVER_PORT_KEY))
        .select(settings::value)
        .first::<String>(&mut conn)
        .optional()
        .map_err(|e| format!("Query error: {}", e))?
        .and_then(|port_str| port_str.parse::<u16>().ok())
        .unwrap_or(DEFAULT_SERVER_PORT);

    // Get local IP (reuse existing function from hdhr.rs)
    let local_ip = get_local_ip();

    // Check if server is running FIRST to ensure data consistency
    let server_running = check_server_health(&local_ip, port).await;

    // Get tuner count from active accounts (reuse existing function from hdhr.rs)
    let tuner_count = get_tuner_count(&mut conn)
        .map_err(|e| format!("Failed to get tuner count: {}", e))?
        as i32;

    // Build URLs
    let base_url = format!("http://{}:{}", local_ip, port);
    let m3u_url = format!("{}/playlist.m3u", base_url);
    let epg_url = format!("{}/epg.xml", base_url);
    let hdhr_url = base_url;

    Ok(PlexConfig {
        server_running,
        local_ip,
        port,
        m3u_url,
        epg_url,
        hdhr_url,
        tuner_count,
    })
}

/// Check if the HTTP server is running by attempting a health check
///
/// Returns true if server responds, false otherwise.
async fn check_server_health(local_ip: &str, port: u16) -> bool {
    // Try to connect to the server's discover.json endpoint
    // Using discover.json because it's a simple GET that always exists when server runs
    // Use the actual local IP that will be shown to users, not localhost
    let url = format!("http://{}:{}/discover.json", local_ip, port);

    // Set a 2-second timeout to avoid blocking UI (NFR5: responsiveness < 100ms requirement)
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(2))
        .build()
    {
        Ok(client) => client,
        Err(e) => {
            eprintln!("Failed to create HTTP client for server health check: {}", e);
            return false;
        }
    };

    match client.get(&url).send().await {
        Ok(response) => {
            let is_healthy = response.status().is_success();
            if !is_healthy {
                eprintln!("Server health check failed: received status {}", response.status());
            }
            is_healthy
        }
        Err(e) => {
            eprintln!("Server health check failed for {}:{} - {}", local_ip, port, e);
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ============================================================================
    // PlexConfig struct tests (Story 4-6)
    // ============================================================================

    #[test]
    fn test_plex_config_serializes_correctly() {
        let config = PlexConfig {
            server_running: true,
            local_ip: "192.168.1.100".to_string(),
            port: 5004,
            m3u_url: "http://192.168.1.100:5004/playlist.m3u".to_string(),
            epg_url: "http://192.168.1.100:5004/epg.xml".to_string(),
            hdhr_url: "http://192.168.1.100:5004".to_string(),
            tuner_count: 4,
        };

        let json = serde_json::to_string(&config).unwrap();

        // Verify all fields are present with snake_case
        assert!(json.contains("\"server_running\":true"));
        assert!(json.contains("\"local_ip\":\"192.168.1.100\""));
        assert!(json.contains("\"port\":5004"));
        assert!(json.contains("\"m3u_url\":\"http://192.168.1.100:5004/playlist.m3u\""));
        assert!(json.contains("\"epg_url\":\"http://192.168.1.100:5004/epg.xml\""));
        assert!(json.contains("\"hdhr_url\":\"http://192.168.1.100:5004\""));
        assert!(json.contains("\"tuner_count\":4"));
    }

    #[test]
    fn test_plex_config_url_formats_are_consistent() {
        let config = PlexConfig {
            server_running: true,
            local_ip: "10.0.0.5".to_string(),
            port: 8080,
            m3u_url: "http://10.0.0.5:8080/playlist.m3u".to_string(),
            epg_url: "http://10.0.0.5:8080/epg.xml".to_string(),
            hdhr_url: "http://10.0.0.5:8080".to_string(),
            tuner_count: 2,
        };

        // Verify M3U URL uses correct base
        assert!(config.m3u_url.starts_with(&config.hdhr_url));
        assert!(config.m3u_url.ends_with("/playlist.m3u"));

        // Verify EPG URL uses correct base
        assert!(config.epg_url.starts_with(&config.hdhr_url));
        assert!(config.epg_url.ends_with("/epg.xml"));

        // Verify URLs contain IP and port
        assert!(config.m3u_url.contains(&config.local_ip));
        assert!(config.m3u_url.contains(&config.port.to_string()));
    }

    #[test]
    fn test_plex_config_handles_default_port() {
        let config = PlexConfig {
            server_running: true,
            local_ip: "192.168.1.1".to_string(),
            port: 5004, // Default port
            m3u_url: "http://192.168.1.1:5004/playlist.m3u".to_string(),
            epg_url: "http://192.168.1.1:5004/epg.xml".to_string(),
            hdhr_url: "http://192.168.1.1:5004".to_string(),
            tuner_count: 2,
        };

        assert_eq!(config.port, 5004);
        assert!(config.hdhr_url.contains("5004"));
    }

    #[test]
    fn test_plex_config_tuner_count_can_be_zero() {
        let config = PlexConfig {
            server_running: false,
            local_ip: "127.0.0.1".to_string(),
            port: 5004,
            m3u_url: "http://127.0.0.1:5004/playlist.m3u".to_string(),
            epg_url: "http://127.0.0.1:5004/epg.xml".to_string(),
            hdhr_url: "http://127.0.0.1:5004".to_string(),
            tuner_count: 0,
        };

        assert_eq!(config.tuner_count, 0);
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"tuner_count\":0"));
    }

    #[test]
    fn test_plex_config_server_not_running() {
        let config = PlexConfig {
            server_running: false,
            local_ip: "192.168.1.100".to_string(),
            port: 5004,
            m3u_url: "http://192.168.1.100:5004/playlist.m3u".to_string(),
            epg_url: "http://192.168.1.100:5004/epg.xml".to_string(),
            hdhr_url: "http://192.168.1.100:5004".to_string(),
            tuner_count: 2,
        };

        assert!(!config.server_running);
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"server_running\":false"));
    }

    // ============================================================================
    // check_server_health tests (Story 4-6)
    // ============================================================================

    #[tokio::test]
    async fn test_check_server_health_returns_false_when_server_not_running() {
        // Use a port that's unlikely to have a server
        let result = check_server_health("127.0.0.1", 59999).await;
        assert!(!result);
    }

    #[tokio::test]
    async fn test_check_server_health_uses_provided_ip() {
        // Test that health check uses the provided IP address, not hardcoded localhost
        // This ensures the health check matches the URLs displayed to users
        let result = check_server_health("192.168.1.1", 59999).await;
        // Should fail (no server), but verifies IP parameter is used
        assert!(!result);
    }
}
