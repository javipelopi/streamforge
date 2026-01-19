//! Matcher Commands
//!
//! Tauri commands for channel matching operations.

use diesel::prelude::*;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::db::models::{ChannelMapping, XmltvChannel, XmltvChannelSettings, XtreamChannel};
use crate::db::schema::{settings, xmltv_channels, xtream_channels};
use crate::db::{DbConnection, Setting};
use crate::matcher::{
    calculate_match_stats, get_channel_mappings as db_get_channel_mappings,
    get_xmltv_channel_settings as db_get_xmltv_channel_settings, match_channels,
    save_channel_mappings, MatchConfig, MatchStats,
};

/// Default match threshold
const DEFAULT_MATCH_THRESHOLD: f64 = 0.85;
const MATCH_THRESHOLD_KEY: &str = "match_threshold";

/// Response type for match operations
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchResponse {
    pub success: bool,
    pub matched_count: usize,
    pub unmatched_count: usize,
    pub total_xmltv: usize,
    pub total_xtream: usize,
    pub duration_ms: u64,
    pub message: String,
}

/// Run the channel matching algorithm.
///
/// Matches all XMLTV channels to Xtream streams using fuzzy matching.
/// Results are saved to the database with confidence scores and priorities.
///
/// # Arguments
///
/// * `threshold` - Optional confidence threshold (0.0 to 1.0). Defaults to 0.85.
///
/// # Returns
///
/// MatchResponse with statistics about the matching operation.
#[tauri::command]
pub async fn run_channel_matching(
    app: AppHandle,
    db: State<'_, DbConnection>,
    threshold: Option<f64>,
) -> Result<MatchResponse, String> {
    // Get threshold from parameter or settings or default
    let threshold = match threshold {
        Some(t) => t,
        None => get_match_threshold_internal(&db)?,
    };

    // Validate threshold
    if !(0.0..=1.0).contains(&threshold) {
        return Err("Threshold must be between 0.0 and 1.0".to_string());
    }

    let config = MatchConfig::default().with_threshold(threshold);

    // Get database connection
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    // Load all XMLTV channels
    let xmltv_channels: Vec<XmltvChannel> = xmltv_channels::table
        .load::<XmltvChannel>(&mut conn)
        .map_err(|e| format!("Failed to load XMLTV channels: {}", e))?;

    // Load all Xtream channels
    let xtream_channels: Vec<XtreamChannel> = xtream_channels::table
        .load::<XtreamChannel>(&mut conn)
        .map_err(|e| format!("Failed to load Xtream channels: {}", e))?;

    // Emit progress event: starting
    let _ = app.emit("match_progress", serde_json::json!({
        "status": "starting",
        "message": format!("Starting match: {} XMLTV channels, {} Xtream streams",
            xmltv_channels.len(), xtream_channels.len())
    }));

    // Run matching algorithm
    let (matches, stats) = match_channels(&xmltv_channels, &xtream_channels, &config);

    // Emit progress event: saving
    let _ = app.emit("match_progress", serde_json::json!({
        "status": "saving",
        "message": format!("Saving {} matches to database", matches.len())
    }));

    // Get all XMLTV channel IDs for settings creation
    let xmltv_ids: Vec<i32> = xmltv_channels
        .iter()
        .filter_map(|c| c.id)
        .collect();

    // Save to database
    let saved_count = save_channel_mappings(&mut conn, &matches, &xmltv_ids)
        .map_err(|e| format!("Failed to save channel mappings: {}", e))?;

    // Emit progress event: complete
    let _ = app.emit("match_progress", serde_json::json!({
        "status": "complete",
        "matched": stats.matched,
        "unmatched": stats.unmatched
    }));

    Ok(MatchResponse {
        success: true,
        matched_count: stats.matched,
        unmatched_count: stats.unmatched,
        total_xmltv: stats.total_xmltv,
        total_xtream: stats.total_xtream,
        duration_ms: stats.duration_ms,
        message: format!(
            "Matched {} of {} XMLTV channels ({} with multiple matches). {} mappings saved.",
            stats.matched,
            stats.total_xmltv,
            stats.multiple_matches,
            saved_count
        ),
    })
}

/// Get current match statistics from the database.
#[tauri::command]
pub fn get_match_stats(db: State<DbConnection>) -> Result<MatchStats, String> {
    let pool = db.clone_pool();
    calculate_match_stats(&pool)
        .map_err(|e| format!("Failed to calculate match stats: {}", e))
}

/// Get channel mappings for a specific XMLTV channel.
#[tauri::command]
pub fn get_channel_mappings_for_xmltv(
    db: State<DbConnection>,
    xmltv_channel_id: i32,
) -> Result<Vec<ChannelMapping>, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    db_get_channel_mappings(&mut conn, xmltv_channel_id)
        .map_err(|e| format!("Failed to get channel mappings: {}", e))
}

/// Get XMLTV channel settings.
#[tauri::command]
pub fn get_xmltv_channel_settings(
    db: State<DbConnection>,
    xmltv_channel_id: i32,
) -> Result<Option<XmltvChannelSettings>, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    db_get_xmltv_channel_settings(&mut conn, xmltv_channel_id)
        .map_err(|e| format!("Failed to get channel settings: {}", e))
}

/// Get the current matching threshold.
#[tauri::command]
pub fn get_match_threshold(db: State<DbConnection>) -> Result<f64, String> {
    get_match_threshold_internal(&db)
}

/// Set the matching threshold.
#[tauri::command]
pub fn set_match_threshold(db: State<DbConnection>, threshold: f64) -> Result<(), String> {
    // Validate threshold
    if !(0.0..=1.0).contains(&threshold) {
        return Err("Threshold must be between 0.0 and 1.0".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let setting = Setting::new(MATCH_THRESHOLD_KEY.to_string(), threshold.to_string());

    diesel::replace_into(settings::table)
        .values(&setting)
        .execute(&mut conn)
        .map_err(|e| format!("Failed to save threshold: {}", e))?;

    Ok(())
}

/// Normalize a channel name (exposed for testing/debugging).
#[tauri::command]
pub fn normalize_channel_name(name: String) -> String {
    crate::matcher::normalize_channel_name(&name)
}

/// Calculate match score between two channel names (exposed for testing/debugging).
#[tauri::command]
pub fn calculate_match_score(
    xmltv_name: String,
    xtream_name: String,
    epg_id_match: bool,
    exact_name_match: bool,
) -> f64 {
    let config = MatchConfig::default();
    crate::matcher::calculate_match_score(
        &xmltv_name,
        &xtream_name,
        epg_id_match,
        exact_name_match,
        &config,
    )
}

/// Internal helper to get threshold from settings
fn get_match_threshold_internal(db: &State<DbConnection>) -> Result<f64, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let result = settings::table
        .filter(settings::key.eq(MATCH_THRESHOLD_KEY))
        .select(settings::value)
        .first::<String>(&mut conn)
        .optional()
        .map_err(|e| format!("Query error: {}", e))?;

    match result {
        Some(threshold_str) => threshold_str
            .parse::<f64>()
            .map_err(|e| format!("Invalid threshold value: {}", e)),
        None => Ok(DEFAULT_MATCH_THRESHOLD),
    }
}
