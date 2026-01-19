use diesel::prelude::*;
use tauri::State;

use crate::db::{settings, DbConnection, Setting};

/// Default server port constant
const DEFAULT_SERVER_PORT: u16 = 5004;
const SERVER_PORT_KEY: &str = "server_port";

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
#[tauri::command]
pub fn get_server_port(db: State<DbConnection>) -> Result<u16, String> {
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
#[tauri::command]
pub fn set_server_port(db: State<DbConnection>, port: u16) -> Result<(), String> {
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
