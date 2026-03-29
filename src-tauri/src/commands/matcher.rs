//! Matcher Commands
//!
//! Tauri commands for channel matching operations.
//! Business logic is delegated to `services::matcher`.

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::db::models::{ChannelMapping, XmltvChannelSettings, XtreamChannel};
use crate::db::DbConnection;
use crate::matcher::{ChangedStream, M3uMatchResult, MatchStats, ProviderChanges};
use crate::services::matcher as svc;
use crate::services::matcher::MatchProgress;

/// Response type for match operations
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchResponse {
    pub success: bool,
    pub matched_count: usize,
    pub unmatched_count: usize,
    pub total_xmltv: usize,
    pub total_source_channels: usize,
    pub duration_ms: u64,
    pub message: String,
}

/// Response type for M3U auto-match operations
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct M3uAutoMatchResponse {
    pub success: bool,
    pub matched_count: usize,
    pub unmatched_count: usize,
    pub total_m3u_channels: usize,
    pub total_xmltv_channels: usize,
    pub duration_ms: u64,
    pub mappings_created: i32,
    pub message: String,
}

/// Run the channel matching algorithm.
#[tauri::command]
pub async fn run_channel_matching(
    app: AppHandle,
    db: State<'_, DbConnection>,
    threshold: Option<f64>,
) -> Result<MatchResponse, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let result = svc::run_channel_matching(&mut conn, threshold, |progress| {
        match &progress {
            MatchProgress::Starting { message } => {
                let _ = app.emit("match_progress", serde_json::json!({
                    "status": "starting", "message": message
                }));
            }
            MatchProgress::Saving { message } => {
                let _ = app.emit("match_progress", serde_json::json!({
                    "status": "saving", "message": message
                }));
            }
            MatchProgress::Complete { matched, unmatched } => {
                let _ = app.emit("match_progress", serde_json::json!({
                    "status": "complete", "matched": matched, "unmatched": unmatched
                }));
            }
        }
    })?;

    Ok(MatchResponse {
        success: true,
        matched_count: result.matched_count,
        unmatched_count: result.unmatched_count,
        total_xmltv: result.total_xmltv,
        total_source_channels: result.total_source_channels,
        duration_ms: result.duration_ms,
        message: format!(
            "Matched {} of {} XMLTV channels ({} with multiple matches). {} mappings saved.",
            result.matched_count,
            result.total_xmltv,
            result.multiple_matches,
            result.mappings_saved
        ),
    })
}

/// Get current match statistics from the database.
#[tauri::command]
pub fn get_match_stats(db: State<DbConnection>) -> Result<MatchStats, String> {
    let pool = db.clone_pool();
    crate::matcher::calculate_match_stats(&pool)
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

    svc::get_channel_mappings_for_xmltv(&mut conn, xmltv_channel_id)
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

    svc::get_xmltv_channel_settings(&mut conn, xmltv_channel_id)
}

/// Get the current matching threshold.
#[tauri::command]
pub fn get_match_threshold(db: State<DbConnection>) -> Result<f64, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    svc::get_match_threshold(&mut conn)
}

/// Set the matching threshold.
#[tauri::command]
pub fn set_match_threshold(db: State<DbConnection>, threshold: f64) -> Result<(), String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    svc::set_match_threshold(&mut conn, threshold)
}

/// Normalize a channel name (exposed for testing/debugging).
#[tauri::command]
pub fn normalize_channel_name(name: String) -> String {
    svc::normalize_channel_name(&name)
}

/// Calculate match score between two channel names (exposed for testing/debugging).
#[tauri::command]
pub fn calculate_match_score(
    xmltv_name: String,
    xtream_name: String,
    epg_id_match: bool,
    exact_name_match: bool,
) -> f64 {
    svc::calculate_match_score(&xmltv_name, &xtream_name, epg_id_match, exact_name_match)
}

/// Detect changes in the provider's stream list by comparing with database.
#[tauri::command]
pub fn detect_provider_changes(
    db: State<DbConnection>,
    account_id: i32,
    current_streams: Vec<XtreamChannel>,
) -> Result<ProviderChanges, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    svc::detect_provider_changes(&mut conn, account_id, &current_streams)
}

/// Auto-match new streams to XMLTV channels using fuzzy algorithm.
#[tauri::command]
pub fn auto_rematch_new_streams(
    db: State<DbConnection>,
    new_streams: Vec<XtreamChannel>,
    threshold: Option<f64>,
) -> Result<i32, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    svc::auto_rematch_new_streams(&mut conn, &new_streams, threshold)
}

/// Handle removed streams by deleting auto-generated mappings and promoting backups.
#[tauri::command]
pub fn handle_removed_streams(
    db: State<DbConnection>,
    account_id: i32,
    removed_stream_ids: Vec<i32>,
) -> Result<(i32, i32), String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    svc::handle_removed_streams(&mut conn, account_id, &removed_stream_ids)
}

/// Handle changed streams by updating metadata and recalculating match confidence.
#[tauri::command]
pub fn handle_changed_streams(
    db: State<DbConnection>,
    account_id: i32,
    changed_streams: Vec<ChangedStream>,
    threshold: Option<f64>,
) -> Result<i32, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    svc::handle_changed_streams(&mut conn, account_id, &changed_streams, threshold)
}

/// Auto-match M3U channels to XMLTV channels using fuzzy matching.
#[tauri::command]
pub async fn auto_match_m3u_channels(
    app: AppHandle,
    db: State<'_, DbConnection>,
    source_id: Option<i32>,
    threshold: Option<f64>,
) -> Result<M3uAutoMatchResponse, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let result = svc::auto_match_m3u_channels(&mut conn, source_id, threshold, |progress| {
        match &progress {
            MatchProgress::Starting { message } => {
                let _ = app.emit("m3u_match_progress", serde_json::json!({
                    "status": "starting", "message": message
                }));
            }
            MatchProgress::Saving { message } => {
                let _ = app.emit("m3u_match_progress", serde_json::json!({
                    "status": "saving", "message": message
                }));
            }
            MatchProgress::Complete { matched, unmatched } => {
                let _ = app.emit("m3u_match_progress", serde_json::json!({
                    "status": "complete", "matched": matched, "unmatched": unmatched
                }));
            }
        }
    })?;

    Ok(M3uAutoMatchResponse {
        success: true,
        matched_count: result.matched_count,
        unmatched_count: result.unmatched_count,
        total_m3u_channels: result.total_m3u_channels,
        total_xmltv_channels: result.total_xmltv_channels,
        duration_ms: result.duration_ms,
        mappings_created: result.mappings_created,
        message: format!(
            "Matched {} M3U channels to {} XMLTV channels. {} mappings created.",
            result.matched_count, result.total_xmltv_channels, result.mappings_created
        ),
    })
}

/// Get M3U auto-match results for display.
#[tauri::command]
pub fn get_m3u_auto_match_results(
    db: State<DbConnection>,
    source_id: Option<i32>,
) -> Result<Vec<M3uMatchResult>, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    svc::get_m3u_auto_match_results(&mut conn, source_id)
}
