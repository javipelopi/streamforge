pub mod accounts;
pub mod channels;

use diesel::prelude::*;
use serde::Serialize;
use tauri::{AppHandle, State};

use crate::db::{schema::settings, DbConnection, Setting};

// Re-export account commands for convenient access
pub use accounts::{add_account, delete_account, get_accounts, test_connection, update_account};

// Re-export channel commands for convenient access
pub use channels::{get_channel_count, get_channels, scan_channels};

/// Response type for autostart status queries
#[derive(Serialize)]
pub struct AutostartStatus {
    pub enabled: bool,
}

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to iptv.", name)
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
