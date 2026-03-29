//! Logs service — event log CRUD operations.
//!
//! Extracted from `commands/logs.rs`. The actual `log_event_internal` helper
//! already lives in `crate::logging` — this module provides the higher-level
//! query/mutation functions that were previously Tauri commands.

use diesel::prelude::*;

use crate::db::models::{EventLog, NewEventLog};
use crate::db::schema::{event_log, settings};
use crate::db::Setting;
use crate::logging::{
    get_log_verbosity_internal, DEFAULT_LOG_VERBOSITY, LOG_VERBOSITY_KEY,
};

// Re-export response type so commands and API can use it.
pub use crate::types::EventLogResponse;

/// Log an event, respecting verbosity settings.
///
/// Returns `Ok(Some(event))` if logged, `Ok(None)` if filtered by verbosity.
pub fn log_event(
    conn: &mut SqliteConnection,
    level: &str,
    category: &str,
    message: &str,
    details: Option<&str>,
) -> Result<Option<EventLog>, String> {
    let valid_levels = ["info", "warn", "error"];
    if !valid_levels.contains(&level) {
        return Err(format!(
            "Invalid log level: {}. Must be one of: {:?}",
            level, valid_levels
        ));
    }

    // Respect verbosity for info events
    if level == "info" {
        let verbosity = get_log_verbosity_internal(conn)
            .unwrap_or_else(|_| DEFAULT_LOG_VERBOSITY.to_string());
        if verbosity == "minimal" {
            return Ok(None);
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
        .execute(conn)
        .map_err(|e| format!("Failed to insert event: {}", e))?;

    let event = event_log::table
        .order(event_log::id.desc())
        .first::<EventLog>(conn)
        .map_err(|e| format!("Failed to retrieve event: {}", e))?;

    Ok(Some(event))
}

/// Get recent events with filtering and pagination.
pub fn get_events(
    conn: &mut SqliteConnection,
    limit: Option<i64>,
    offset: Option<i64>,
    level: Option<&str>,
    category: Option<&str>,
    unread_only: Option<bool>,
    created_after: Option<&str>,
    created_before: Option<&str>,
) -> Result<EventLogResponse, String> {
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);

    let mut query = event_log::table.into_boxed();

    if let Some(lvl) = level {
        query = query.filter(event_log::level.eq(lvl));
    }
    if let Some(cat) = category {
        query = query.filter(event_log::category.eq(cat));
    }
    if unread_only.unwrap_or(false) {
        query = query.filter(event_log::is_read.eq(0));
    }
    if let Some(after) = created_after {
        query = query.filter(event_log::timestamp.ge(after));
    }
    if let Some(before) = created_before {
        query = query.filter(event_log::timestamp.lt(before));
    }

    // Total count for this filter set
    let total_count: i64 = {
        let mut count_query = event_log::table.into_boxed();
        if let Some(lvl) = level {
            count_query = count_query.filter(event_log::level.eq(lvl));
        }
        if let Some(cat) = category {
            count_query = count_query.filter(event_log::category.eq(cat));
        }
        if unread_only.unwrap_or(false) {
            count_query = count_query.filter(event_log::is_read.eq(0));
        }
        if let Some(after) = created_after {
            count_query = count_query.filter(event_log::timestamp.ge(after));
        }
        if let Some(before) = created_before {
            count_query = count_query.filter(event_log::timestamp.lt(before));
        }
        count_query
            .count()
            .get_result(conn)
            .map_err(|e| format!("Failed to count events: {}", e))?
    };

    let unread_count: i64 = event_log::table
        .filter(event_log::is_read.eq(0))
        .count()
        .get_result(conn)
        .map_err(|e| format!("Failed to count unread events: {}", e))?;

    let events: Vec<EventLog> = query
        .order(event_log::timestamp.desc())
        .limit(limit)
        .offset(offset)
        .load::<EventLog>(conn)
        .map_err(|e| format!("Failed to load events: {}", e))?;

    Ok(EventLogResponse {
        events,
        total_count,
        unread_count,
    })
}

/// Get the count of unread events.
pub fn get_unread_event_count(conn: &mut SqliteConnection) -> Result<i64, String> {
    event_log::table
        .filter(event_log::is_read.eq(0))
        .count()
        .get_result(conn)
        .map_err(|e| format!("Failed to count unread events: {}", e))
}

/// Mark a single event as read.
pub fn mark_event_read(conn: &mut SqliteConnection, event_id: i32) -> Result<(), String> {
    diesel::update(event_log::table.filter(event_log::id.eq(Some(event_id))))
        .set(event_log::is_read.eq(1))
        .execute(conn)
        .map_err(|e| format!("Failed to mark event as read: {}", e))?;
    Ok(())
}

/// Mark all events as read. Returns number of events marked.
pub fn mark_all_events_read(conn: &mut SqliteConnection) -> Result<i64, String> {
    let count = diesel::update(event_log::table.filter(event_log::is_read.eq(0)))
        .set(event_log::is_read.eq(1))
        .execute(conn)
        .map_err(|e| format!("Failed to mark events as read: {}", e))?;
    Ok(count as i64)
}

/// Clear old events, keeping the most recent `keep_count`.
pub fn clear_old_events(conn: &mut SqliteConnection, keep_count: Option<i64>) -> Result<i64, String> {
    let keep_count = keep_count.unwrap_or(1000);

    let threshold_id: Option<i32> = event_log::table
        .order(event_log::id.desc())
        .offset(keep_count)
        .select(event_log::id)
        .first::<Option<i32>>(conn)
        .optional()
        .map_err(|e| format!("Failed to get threshold ID: {}", e))?
        .flatten();

    let count = match threshold_id {
        Some(tid) => {
            diesel::delete(event_log::table.filter(event_log::id.lt(Some(tid))))
                .execute(conn)
                .map_err(|e| format!("Failed to delete old events: {}", e))? as i64
        }
        None => 0,
    };

    Ok(count)
}

/// Get the current log verbosity setting.
pub fn get_log_verbosity(conn: &mut SqliteConnection) -> Result<String, String> {
    get_log_verbosity_internal(conn)
        .map_err(|e| format!("Failed to get log verbosity: {}", e))
}

/// Set the log verbosity setting ("verbose" or "minimal").
pub fn set_log_verbosity(conn: &mut SqliteConnection, verbosity: &str) -> Result<(), String> {
    let valid_values = ["minimal", "verbose"];
    if !valid_values.contains(&verbosity) {
        return Err(format!(
            "Invalid log verbosity: {}. Must be one of: {:?}",
            verbosity, valid_values
        ));
    }

    let setting = Setting::new(LOG_VERBOSITY_KEY.to_string(), verbosity.to_string());

    diesel::replace_into(settings::table)
        .values(&setting)
        .execute(conn)
        .map_err(|e| format!("Failed to set log verbosity: {}", e))?;

    Ok(())
}
