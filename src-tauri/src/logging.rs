//! Shared logging module (Tauri-independent)
//!
//! Contains event logging functions that operate directly on SqliteConnection,
//! enabling use from both Tauri commands and the standalone server/scheduler.

use diesel::prelude::*;

use crate::db::models::NewEventLog;
use crate::db::schema::{event_log, settings};

/// Log verbosity setting key
pub const LOG_VERBOSITY_KEY: &str = "log_verbosity";

/// Default log verbosity (verbose = log all events including info)
pub const DEFAULT_LOG_VERBOSITY: &str = "verbose";

/// Get the current log verbosity setting from the database.
///
/// Story 6-3: Log verbosity setting
///
/// Returns "verbose" (default) or "minimal".
/// - "verbose": All events (info, warn, error) are logged
/// - "minimal": Only warn and error events are logged (info filtered out)
pub fn get_log_verbosity_internal(
    conn: &mut diesel::SqliteConnection,
) -> Result<String, diesel::result::Error> {
    let result = settings::table
        .filter(settings::key.eq(LOG_VERBOSITY_KEY))
        .select(settings::value)
        .first::<String>(conn)
        .optional()?;

    Ok(result.unwrap_or_else(|| DEFAULT_LOG_VERBOSITY.to_string()))
}

/// Internal function to log an event (for use by other Rust code).
/// Does not require Tauri state, takes a connection directly.
///
/// Story 6-3: Respects log verbosity setting.
/// - In "minimal" mode, info events are filtered out (not logged)
/// - In "verbose" mode (default), all events are logged
/// - warn and error events are ALWAYS logged regardless of verbosity
pub fn log_event_internal(
    conn: &mut diesel::SqliteConnection,
    level: &str,
    category: &str,
    message: &str,
    details: Option<&str>,
) -> Result<(), diesel::result::Error> {
    // Story 6-3: Check verbosity setting for info level events
    if level == "info" {
        // Fail open: if we can't read verbosity, default to verbose (log everything)
        // This ensures critical info events are not lost due to database errors
        let verbosity = get_log_verbosity_internal(conn)
            .unwrap_or_else(|_| DEFAULT_LOG_VERBOSITY.to_string());
        if verbosity == "minimal" {
            // Skip info events in minimal mode
            return Ok(());
        }
    }

    let new_event = NewEventLog {
        level: level.to_string(),
        category: category.to_string(),
        message: message.to_string(),
        details: details.map(|s| s.to_string()),
    };

    diesel::insert_into(event_log::table)
        .values(&new_event)
        .execute(conn)?;

    Ok(())
}

/// Helper to log a provider change event
pub fn log_provider_event(
    conn: &mut diesel::SqliteConnection,
    level: &str,
    message: &str,
    details: Option<serde_json::Value>,
) -> Result<(), diesel::result::Error> {
    let details_str = details.map(|v| v.to_string());
    log_event_internal(conn, level, "provider", message, details_str.as_deref())
}
