//! Settings service — key-value settings operations.
//!
//! Extracted from `commands/mod.rs` settings-related functions.

use diesel::prelude::*;

use crate::db::schema::settings;
use crate::db::Setting;
use crate::logging::log_event_internal;
use crate::server::failover::{FailoverStrictness, ResilienceConfig};

const DEFAULT_SERVER_PORT: u16 = 5004;
const SERVER_PORT_KEY: &str = "server_port";

/// Get a setting value by key.
pub fn get_setting(
    conn: &mut SqliteConnection,
    key: &str,
) -> Result<Option<String>, diesel::result::Error> {
    settings::table
        .filter(settings::key.eq(key))
        .select(settings::value)
        .first::<String>(conn)
        .optional()
}

/// Set a setting value by key (upsert).
pub fn set_setting(
    conn: &mut SqliteConnection,
    key: &str,
    value: &str,
) -> Result<(), diesel::result::Error> {
    let setting = Setting::new(key.to_string(), value.to_string());

    diesel::replace_into(settings::table)
        .values(&setting)
        .execute(conn)?;

    Ok(())
}

/// Get the configured server port (or default 5004).
pub fn get_server_port(conn: &mut SqliteConnection) -> Result<u16, diesel::result::Error> {
    let result = settings::table
        .filter(settings::key.eq(SERVER_PORT_KEY))
        .select(settings::value)
        .first::<String>(conn)
        .optional()?;

    match result {
        Some(port_str) => port_str
            .parse::<u16>()
            .map_err(|_| diesel::result::Error::NotFound),
        None => Ok(DEFAULT_SERVER_PORT),
    }
}

/// Set the server port. Returns an error string if validation fails.
pub fn set_server_port(conn: &mut SqliteConnection, port: u16) -> Result<(), String> {
    if port < 1024 {
        return Err("Port must be 1024 or higher (non-privileged ports)".to_string());
    }

    let old_port = get_server_port(conn).unwrap_or(DEFAULT_SERVER_PORT);

    let setting = Setting::new(SERVER_PORT_KEY.to_string(), port.to_string());

    diesel::replace_into(settings::table)
        .values(&setting)
        .execute(conn)
        .map_err(|e| format!("Insert error: {}", e))?;

    // Log configuration change
    let details = serde_json::json!({
        "setting": "server_port",
        "oldValue": old_port,
        "newValue": port
    });
    let _ = log_event_internal(
        conn,
        "info",
        "system",
        &format!("Configuration changed: Server port {} → {}", old_port, port),
        Some(&details.to_string()),
    );

    Ok(())
}

/// Get the current failover resilience configuration.
pub fn get_resilience_config(conn: &mut SqliteConnection) -> ResilienceConfig {
    ResilienceConfig::from_db(conn)
}

/// Set the failover strictness level.
pub fn set_failover_strictness(
    conn: &mut SqliteConnection,
    strictness: &str,
) -> Result<ResilienceConfig, String> {
    let parsed: FailoverStrictness = strictness.parse().map_err(|e: String| e)?;

    let setting = Setting::new("failover_strictness", parsed.to_string());
    diesel::replace_into(settings::table)
        .values(&setting)
        .execute(conn)
        .map_err(|e| format!("Save error: {}", e))?;

    // Log the change
    if let Err(e) = log_event_internal(
        conn,
        "info",
        "config",
        &format!("Failover strictness changed to {}", parsed),
        Some(
            &serde_json::json!({
                "setting": "failover_strictness",
                "value": parsed.to_string(),
            })
            .to_string(),
        ),
    ) {
        eprintln!("[WARN] Failed to log config change: {}", e);
    }

    Ok(ResilienceConfig::from_db(conn))
}
