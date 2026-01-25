//! Event Logging Tauri Commands
//!
//! Story 3-4: Event logging system for provider changes, connection issues, etc.
//! Story 6-3: Log verbosity setting (minimal/verbose modes)
//! These commands allow the frontend to log events, query event history, and manage read state.

use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::models::{EventLog, NewEventLog};
use crate::db::schema::{event_log, settings};
use crate::db::{DbConnection, Setting};

/// Response type for event log queries
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EventLogResponse {
    pub events: Vec<EventLog>,
    pub total_count: i64,
    pub unread_count: i64,
}

/// Input parameters for log_event command
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LogEventInput {
    pub level: String,
    pub category: String,
    pub message: String,
    pub details: Option<String>,
}

/// Log an event to the database.
///
/// Story 6-3: Respects log verbosity setting.
/// - In "minimal" mode, info events are filtered out (not logged)
/// - In "verbose" mode (default), all events are logged
///
/// # Arguments
///
/// * `level` - Event level: "info", "warn", or "error"
/// * `category` - Event category: "connection", "stream", "match", "epg", "system", "provider"
/// * `message` - Human-readable message describing the event
/// * `details` - Optional JSON string with additional details
///
/// # Returns
///
/// The created event log entry, or None if event was filtered by verbosity
#[tauri::command]
pub fn log_event(
    db: State<DbConnection>,
    level: String,
    category: String,
    message: String,
    details: Option<String>,
) -> Result<Option<EventLog>, String> {
    // Validate level
    let valid_levels = ["info", "warn", "error"];
    if !valid_levels.contains(&level.as_str()) {
        return Err(format!(
            "Invalid log level: {}. Must be one of: {:?}",
            level, valid_levels
        ));
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    // Story 6-3: Check verbosity setting for info level events
    if level == "info" {
        // Fail open: if we can't read verbosity, default to verbose (log everything)
        // This ensures critical info events are not lost due to database errors
        let verbosity = get_log_verbosity_internal(&mut conn)
            .unwrap_or_else(|_| DEFAULT_LOG_VERBOSITY.to_string());
        if verbosity == "minimal" {
            // Skip info events in minimal mode - return None to indicate event was filtered
            return Ok(None);
        }
    }

    let new_event = NewEventLog {
        level,
        category,
        message,
        details,
    };

    diesel::insert_into(event_log::table)
        .values(&new_event)
        .execute(&mut conn)
        .map_err(|e| format!("Failed to insert event: {}", e))?;

    // Get the last inserted event
    let event = event_log::table
        .order(event_log::id.desc())
        .first::<EventLog>(&mut conn)
        .map_err(|e| format!("Failed to retrieve event: {}", e))?;

    Ok(Some(event))
}

/// Get recent events from the event log.
///
/// # Arguments
///
/// * `limit` - Maximum number of events to return (default 50)
/// * `offset` - Number of events to skip (for pagination)
/// * `level` - Optional filter by level
/// * `category` - Optional filter by category
/// * `unread_only` - If true, only return unread events
/// * `created_after` - Optional filter: only events created after this date (ISO 8601)
/// * `created_before` - Optional filter: only events created before this date (ISO 8601)
///
/// # Returns
///
/// EventLogResponse with events, total count, and unread count
#[tauri::command]
pub fn get_events(
    db: State<DbConnection>,
    limit: Option<i64>,
    offset: Option<i64>,
    level: Option<String>,
    category: Option<String>,
    unread_only: Option<bool>,
    created_after: Option<String>,
    created_before: Option<String>,
) -> Result<EventLogResponse, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);

    // Build query with filters
    let mut query = event_log::table.into_boxed();

    if let Some(ref lvl) = level {
        query = query.filter(event_log::level.eq(lvl));
    }

    if let Some(ref cat) = category {
        query = query.filter(event_log::category.eq(cat));
    }

    if unread_only.unwrap_or(false) {
        query = query.filter(event_log::is_read.eq(0));
    }

    // Story 6-4 AC #5: Date range filtering
    if let Some(ref after) = created_after {
        query = query.filter(event_log::timestamp.ge(after));
    }

    if let Some(ref before) = created_before {
        // FIXED: Use < (less than) the NEXT day to include the entire end date
        // This ensures events on the end date are included up to 23:59:59
        // Frontend should pass end date as YYYY-MM-DD, we filter < YYYY-MM-DD+1
        query = query.filter(event_log::timestamp.lt(before));
    }

    // Get total count for this filter
    let total_count: i64 = {
        let mut count_query = event_log::table.into_boxed();
        if let Some(ref lvl) = level {
            count_query = count_query.filter(event_log::level.eq(lvl));
        }
        if let Some(ref cat) = category {
            count_query = count_query.filter(event_log::category.eq(cat));
        }
        if unread_only.unwrap_or(false) {
            count_query = count_query.filter(event_log::is_read.eq(0));
        }
        // Story 6-4 AC #5: Date range filtering for count
        if let Some(ref after) = created_after {
            count_query = count_query.filter(event_log::timestamp.ge(after));
        }
        if let Some(ref before) = created_before {
            count_query = count_query.filter(event_log::timestamp.lt(before));
        }
        count_query
            .count()
            .get_result(&mut conn)
            .map_err(|e| format!("Failed to count events: {}", e))?
    };

    // Get unread count (always without filters)
    let unread_count: i64 = event_log::table
        .filter(event_log::is_read.eq(0))
        .count()
        .get_result(&mut conn)
        .map_err(|e| format!("Failed to count unread events: {}", e))?;

    // Execute query with pagination
    let events: Vec<EventLog> = query
        .order(event_log::timestamp.desc())
        .limit(limit)
        .offset(offset)
        .load::<EventLog>(&mut conn)
        .map_err(|e| format!("Failed to load events: {}", e))?;

    Ok(EventLogResponse {
        events,
        total_count,
        unread_count,
    })
}

/// Get the count of unread events.
///
/// # Returns
///
/// The number of unread events
#[tauri::command]
pub fn get_unread_event_count(db: State<DbConnection>) -> Result<i64, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let count: i64 = event_log::table
        .filter(event_log::is_read.eq(0))
        .count()
        .get_result(&mut conn)
        .map_err(|e| format!("Failed to count unread events: {}", e))?;

    Ok(count)
}

/// Mark an event as read.
///
/// # Arguments
///
/// * `event_id` - The ID of the event to mark as read
///
/// # Returns
///
/// Success status
#[tauri::command]
pub fn mark_event_read(db: State<DbConnection>, event_id: i32) -> Result<(), String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    diesel::update(event_log::table.filter(event_log::id.eq(Some(event_id))))
        .set(event_log::is_read.eq(1))
        .execute(&mut conn)
        .map_err(|e| format!("Failed to mark event as read: {}", e))?;

    Ok(())
}

/// Mark all events as read.
///
/// # Returns
///
/// Number of events marked as read
#[tauri::command]
pub fn mark_all_events_read(db: State<DbConnection>) -> Result<i64, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let count = diesel::update(event_log::table.filter(event_log::is_read.eq(0)))
        .set(event_log::is_read.eq(1))
        .execute(&mut conn)
        .map_err(|e| format!("Failed to mark events as read: {}", e))?;

    Ok(count as i64)
}

/// Clear old events from the log.
///
/// Keeps the most recent `keep_count` events and deletes the rest.
///
/// # Arguments
///
/// * `keep_count` - Number of recent events to keep (default 1000)
///
/// # Returns
///
/// Number of events deleted
#[tauri::command]
pub fn clear_old_events(db: State<DbConnection>, keep_count: Option<i64>) -> Result<i64, String> {
    let keep_count = keep_count.unwrap_or(1000);

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    // Get the ID threshold for keeping events
    let threshold_id: Option<i32> = event_log::table
        .order(event_log::id.desc())
        .offset(keep_count)
        .select(event_log::id)
        .first::<Option<i32>>(&mut conn)
        .optional()
        .map_err(|e| format!("Failed to get threshold ID: {}", e))?
        .flatten();

    let count = match threshold_id {
        Some(tid) => {
            diesel::delete(event_log::table.filter(event_log::id.lt(Some(tid))))
                .execute(&mut conn)
                .map_err(|e| format!("Failed to delete old events: {}", e))? as i64
        }
        None => 0,
    };

    Ok(count)
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

// ============================================================================
// Log Verbosity Commands (Story 6-3)
// ============================================================================

/// Log verbosity setting key
const LOG_VERBOSITY_KEY: &str = "log_verbosity";

/// Default log verbosity (verbose = log all events including info)
const DEFAULT_LOG_VERBOSITY: &str = "verbose";

/// Get the current log verbosity setting from the database.
///
/// Story 6-3: Log verbosity setting
///
/// Returns "verbose" (default) or "minimal".
/// - "verbose": All events (info, warn, error) are logged
/// - "minimal": Only warn and error events are logged (info filtered out)
fn get_log_verbosity_internal(
    conn: &mut diesel::SqliteConnection,
) -> Result<String, diesel::result::Error> {
    let result = settings::table
        .filter(settings::key.eq(LOG_VERBOSITY_KEY))
        .select(settings::value)
        .first::<String>(conn)
        .optional()?;

    Ok(result.unwrap_or_else(|| DEFAULT_LOG_VERBOSITY.to_string()))
}

/// Get the current log verbosity setting.
///
/// Story 6-3: Log Verbosity Setting (AC #3, #4, #5)
///
/// # Returns
///
/// "verbose" (default) or "minimal"
#[tauri::command]
pub fn get_log_verbosity(db: State<DbConnection>) -> Result<String, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    get_log_verbosity_internal(&mut conn)
        .map_err(|e| format!("Failed to get log verbosity: {}", e))
}

/// Set the log verbosity setting.
///
/// Story 6-3: Log Verbosity Setting (AC #3, #4, #5)
///
/// # Arguments
///
/// * `verbosity` - "verbose" or "minimal"
///
/// # Returns
///
/// Success or error
#[tauri::command]
pub fn set_log_verbosity(db: State<DbConnection>, verbosity: String) -> Result<(), String> {
    // Validate verbosity value
    let valid_values = ["minimal", "verbose"];
    if !valid_values.contains(&verbosity.as_str()) {
        return Err(format!(
            "Invalid log verbosity: {}. Must be one of: {:?}",
            verbosity, valid_values
        ));
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let setting = Setting::new(LOG_VERBOSITY_KEY.to_string(), verbosity);

    diesel::replace_into(settings::table)
        .values(&setting)
        .execute(&mut conn)
        .map_err(|e| format!("Failed to set log verbosity: {}", e))?;

    Ok(())
}
