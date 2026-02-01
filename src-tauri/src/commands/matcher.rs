//! Matcher Commands
//!
//! Tauri commands for channel matching operations.
//! Story 6-3: Channel matching event logging

use diesel::prelude::*;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::commands::logs::log_event_internal;
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
    pub total_source_channels: usize,
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

    // Story 6-3: Log channel matching event (AC #1)
    let details = serde_json::json!({
        "matchedCount": stats.matched,
        "unmatchedCount": stats.unmatched,
        "totalXmltv": stats.total_xmltv,
        "totalSourceChannels": stats.total_source_channels,
        "threshold": threshold,
        "durationMs": stats.duration_ms,
        "mappingsSaved": saved_count,
    });
    let _ = log_event_internal(
        &mut conn,
        "info",
        "match",
        &format!(
            "Channel matching completed: {} of {} channels matched (threshold: {:.0}%)",
            stats.matched, stats.total_xmltv, threshold * 100.0
        ),
        Some(&details.to_string()),
    );

    Ok(MatchResponse {
        success: true,
        matched_count: stats.matched,
        unmatched_count: stats.unmatched,
        total_xmltv: stats.total_xmltv,
        total_source_channels: stats.total_source_channels,
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
    // Validate threshold range
    if !(0.0..=1.0).contains(&threshold) {
        return Err("Threshold must be between 0.0 and 1.0".to_string());
    }

    // Warn about impractical thresholds
    if threshold < 0.6 {
        eprintln!("[WARNING] Match threshold {} is very low - will match almost everything", threshold);
    } else if threshold > 0.95 {
        eprintln!("[WARNING] Match threshold {} is very high - will match almost nothing", threshold);
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

// ============================================================================
// Story 3-4: Auto-Rematch Commands
// ============================================================================

use crate::db::schema::m3u_channels;
use crate::db::models::M3uChannel;
use crate::matcher::{
    detect_provider_changes as core_detect_provider_changes,
    auto_rematch_new_streams as core_auto_rematch_new_streams,
    handle_removed_streams as core_handle_removed_streams,
    handle_changed_streams as core_handle_changed_streams,
    match_m3u_channels, M3uMatchResult,
    ProviderChanges, ChangedStream,
};

/// Detect changes in the provider's stream list by comparing with database.
///
/// # Arguments
///
/// * `account_id` - The Xtream account ID
/// * `current_streams` - List of streams from the current scan
///
/// # Returns
///
/// `ProviderChanges` containing new, removed, and changed streams
#[tauri::command]
pub fn detect_provider_changes(
    db: State<DbConnection>,
    account_id: i32,
    current_streams: Vec<XtreamChannel>,
) -> Result<ProviderChanges, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    core_detect_provider_changes(&mut conn, account_id, &current_streams)
        .map_err(|e| format!("Failed to detect provider changes: {}", e))
}

/// Auto-match new streams to XMLTV channels using fuzzy algorithm.
///
/// # Arguments
///
/// * `new_streams` - List of new Xtream streams to match
/// * `threshold` - Optional confidence threshold (uses settings if not provided)
///
/// # Returns
///
/// Number of new mappings created
#[tauri::command]
pub fn auto_rematch_new_streams(
    db: State<DbConnection>,
    new_streams: Vec<XtreamChannel>,
    threshold: Option<f64>,
) -> Result<i32, String> {
    let threshold = threshold.unwrap_or(get_match_threshold_internal(&db)?);
    let config = MatchConfig::default().with_threshold(threshold);

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    core_auto_rematch_new_streams(&mut conn, &new_streams, &config)
        .map_err(|e| format!("Failed to auto-rematch new streams: {}", e))
}

/// Handle removed streams by deleting auto-generated mappings and promoting backups.
///
/// Manual matches (is_manual = 1) are NEVER deleted.
///
/// # Arguments
///
/// * `account_id` - The Xtream account ID
/// * `removed_stream_ids` - List of stream IDs that are no longer available
///
/// # Returns
///
/// Tuple of (mappings_removed, manual_matches_preserved)
#[tauri::command]
pub fn handle_removed_streams(
    db: State<DbConnection>,
    account_id: i32,
    removed_stream_ids: Vec<i32>,
) -> Result<(i32, i32), String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    core_handle_removed_streams(&mut conn, account_id, &removed_stream_ids)
        .map_err(|e| format!("Failed to handle removed streams: {}", e))
}

/// Handle changed streams by updating metadata and recalculating match confidence.
///
/// # Arguments
///
/// * `account_id` - The Xtream account ID
/// * `changed_streams` - List of changed streams
/// * `threshold` - Optional confidence threshold (uses settings if not provided)
///
/// # Returns
///
/// Number of mappings updated
#[tauri::command]
pub fn handle_changed_streams(
    db: State<DbConnection>,
    account_id: i32,
    changed_streams: Vec<ChangedStream>,
    threshold: Option<f64>,
) -> Result<i32, String> {
    let threshold = threshold.unwrap_or(get_match_threshold_internal(&db)?);
    let config = MatchConfig::default().with_threshold(threshold);

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    core_handle_changed_streams(&mut conn, account_id, &changed_streams, &config)
        .map_err(|e| format!("Failed to handle changed streams: {}", e))
}

// ============================================================================
// Multi-Source Stream Support: M3U Auto-Match
// ============================================================================

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

/// Auto-match M3U channels to XMLTV channels using fuzzy matching.
///
/// This command matches M3U channels from a specific source (or all sources)
/// to XMLTV channels using:
/// - `tvg_id` attribute matching XMLTV `channel_id` (EPG ID match)
/// - `tvg_name` or channel `name` for fuzzy name matching
///
/// # Arguments
///
/// * `source_id` - Optional M3U source ID to match. If None, matches all M3U sources.
/// * `threshold` - Optional confidence threshold (0.0 to 1.0). Defaults to 0.85.
///
/// # Returns
///
/// M3uAutoMatchResponse with statistics about the matching operation.
#[tauri::command]
pub async fn auto_match_m3u_channels(
    app: AppHandle,
    db: State<'_, DbConnection>,
    source_id: Option<i32>,
    threshold: Option<f64>,
) -> Result<M3uAutoMatchResponse, String> {
    use crate::db::models::NewM3uAutoMatchMapping;
    use crate::db::schema::{channel_mappings, xmltv_channel_settings};
    use diesel::Connection;
    use std::collections::HashSet;

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
    let xmltv_channels_data: Vec<XmltvChannel> = xmltv_channels::table
        .load::<XmltvChannel>(&mut conn)
        .map_err(|e| format!("Failed to load XMLTV channels: {}", e))?;

    // Load M3U channels (optionally filtered by source)
    let m3u_channels_data: Vec<M3uChannel> = match source_id {
        Some(sid) => m3u_channels::table
            .filter(m3u_channels::source_id.eq(sid))
            .load::<M3uChannel>(&mut conn)
            .map_err(|e| format!("Failed to load M3U channels: {}", e))?,
        None => m3u_channels::table
            .load::<M3uChannel>(&mut conn)
            .map_err(|e| format!("Failed to load M3U channels: {}", e))?,
    };

    // Emit progress event: starting
    let _ = app.emit(
        "m3u_match_progress",
        serde_json::json!({
            "status": "starting",
            "message": format!("Starting M3U match: {} XMLTV channels, {} M3U channels",
                xmltv_channels_data.len(), m3u_channels_data.len())
        }),
    );

    // Run matching algorithm
    let (matches, stats) = match_m3u_channels(&xmltv_channels_data, &m3u_channels_data, &config);

    // Emit progress event: saving
    let _ = app.emit(
        "m3u_match_progress",
        serde_json::json!({
            "status": "saving",
            "message": format!("Saving {} M3U matches to database", matches.len())
        }),
    );

    // CR-7: Wrap all DB operations in a transaction for atomicity
    let mappings_created = conn
        .transaction::<i32, diesel::result::Error, _>(|conn| {
            // CR-16: Query existing mappings to prevent duplicates
            let existing_mappings: Vec<(i32, Option<i32>)> = channel_mappings::table
                .filter(channel_mappings::source_type.eq("m3u"))
                .filter(channel_mappings::m3u_channel_id.is_not_null())
                .select((
                    channel_mappings::xmltv_channel_id,
                    channel_mappings::m3u_channel_id,
                ))
                .load(conn)?;

            let existing_pairs: HashSet<(i32, i32)> = existing_mappings
                .into_iter()
                .filter_map(|(xmltv_id, m3u_id)| m3u_id.map(|mid| (xmltv_id, mid)))
                .collect();

            // CR-6: Collect all mappings into a Vec for batch insert
            let mut new_mappings: Vec<NewM3uAutoMatchMapping> = Vec::new();
            let mut xmltv_ids_to_enable: Vec<i32> = Vec::new();
            let mut skipped_duplicates = 0;

            for m in &matches {
                // Only save primary matches (highest confidence per XMLTV channel)
                if !m.is_primary {
                    continue;
                }

                // CR-16: Skip if mapping already exists
                if existing_pairs.contains(&(m.xmltv_channel_id, m.m3u_channel_id)) {
                    skipped_duplicates += 1;
                    tracing::debug!(
                        xmltv_channel_id = m.xmltv_channel_id,
                        m3u_channel_id = m.m3u_channel_id,
                        "Skipping duplicate M3U mapping"
                    );
                    continue;
                }

                // Find the M3U channel to verify it exists
                let m3u_channel = m3u_channels_data
                    .iter()
                    .find(|c| c.id == Some(m.m3u_channel_id));

                if m3u_channel.is_some() {
                    new_mappings.push(NewM3uAutoMatchMapping::new(
                        m.xmltv_channel_id,
                        m.m3u_channel_id,
                        m.confidence as f32,
                        m.is_primary,
                        m.stream_priority,
                    ));
                    xmltv_ids_to_enable.push(m.xmltv_channel_id);
                }
            }

            if skipped_duplicates > 0 {
                tracing::info!(
                    skipped = skipped_duplicates,
                    "Skipped duplicate M3U mappings"
                );
            }

            // CR-6: Batch insert all mappings at once
            let created_count = if !new_mappings.is_empty() {
                let result = diesel::insert_into(channel_mappings::table)
                    .values(&new_mappings)
                    .execute(conn);

                match result {
                    Ok(count) => count as i32,
                    Err(e) => {
                        // CR-34: Log failed batch insert
                        tracing::error!(
                            error = %e,
                            mapping_count = new_mappings.len(),
                            "Failed to batch insert M3U channel mappings"
                        );
                        return Err(e);
                    }
                }
            } else {
                0
            };

            // Batch insert XMLTV channel settings (ensure they exist)
            for xmltv_id in &xmltv_ids_to_enable {
                let settings_result = diesel::insert_or_ignore_into(xmltv_channel_settings::table)
                    .values((
                        xmltv_channel_settings::xmltv_channel_id.eq(*xmltv_id),
                        xmltv_channel_settings::is_enabled.eq(1),
                    ))
                    .execute(conn);

                if let Err(e) = settings_result {
                    // CR-34: Log settings insert failures (non-fatal)
                    tracing::warn!(
                        xmltv_channel_id = xmltv_id,
                        error = %e,
                        "Failed to create XMLTV channel settings"
                    );
                }
            }

            Ok(created_count)
        })
        .map_err(|e| format!("Transaction failed: {}", e))?;

    // Emit progress event: complete
    let _ = app.emit(
        "m3u_match_progress",
        serde_json::json!({
            "status": "complete",
            "matched": stats.matched,
            "unmatched": stats.unmatched
        }),
    );

    // Log the operation
    let details = serde_json::json!({
        "matchedCount": stats.matched,
        "unmatchedCount": stats.unmatched,
        "totalM3uChannels": m3u_channels_data.len(),
        "totalXmltvChannels": xmltv_channels_data.len(),
        "threshold": threshold,
        "durationMs": stats.duration_ms,
        "mappingsCreated": mappings_created,
        "sourceId": source_id,
    });
    let _ = log_event_internal(
        &mut conn,
        "info",
        "m3u_match",
        &format!(
            "M3U auto-match completed: {} of {} channels matched (threshold: {:.0}%)",
            stats.matched,
            xmltv_channels_data.len(),
            threshold * 100.0
        ),
        Some(&details.to_string()),
    );

    Ok(M3uAutoMatchResponse {
        success: true,
        matched_count: stats.matched,
        unmatched_count: stats.unmatched,
        total_m3u_channels: m3u_channels_data.len(),
        total_xmltv_channels: xmltv_channels_data.len(),
        duration_ms: stats.duration_ms,
        mappings_created,
        message: format!(
            "Matched {} M3U channels to {} XMLTV channels. {} mappings created.",
            stats.matched,
            xmltv_channels_data.len(),
            mappings_created
        ),
    })
}

/// Get M3U auto-match results for display.
///
/// Returns all M3U match results with channel details.
/// CR-33: Infers match type from confidence score:
/// - confidence >= 0.95 (with EPG ID boost) -> ExactEpgId
/// - confidence >= 0.90 (with exact name boost) -> ExactName
/// - otherwise -> Fuzzy
#[tauri::command]
pub fn get_m3u_auto_match_results(
    db: State<DbConnection>,
    source_id: Option<i32>,
) -> Result<Vec<M3uMatchResult>, String> {
    use crate::db::schema::channel_mappings;
    use crate::matcher::MatchType;

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    // Query channel_mappings where source_type = "m3u" and m3u_channel_id is not null
    let base_query = channel_mappings::table
        .filter(channel_mappings::source_type.eq("m3u"))
        .filter(channel_mappings::m3u_channel_id.is_not_null())
        .into_boxed();

    // Optionally filter by M3U source via join with m3u_channels
    // Note: Float in SQLite/Diesel maps to f32
    let matches: Vec<(i32, Option<i32>, Option<f32>, Option<i32>, Option<i32>)> = if let Some(sid) =
        source_id
    {
        // Join with m3u_channels to filter by source_id
        use crate::db::schema::m3u_channels;
        channel_mappings::table
            .inner_join(m3u_channels::table.on(
                m3u_channels::id.nullable().eq(channel_mappings::m3u_channel_id),
            ))
            .filter(channel_mappings::source_type.eq("m3u"))
            .filter(m3u_channels::source_id.eq(sid))
            .select((
                channel_mappings::xmltv_channel_id,
                channel_mappings::m3u_channel_id,
                channel_mappings::match_confidence,
                channel_mappings::is_primary,
                channel_mappings::stream_priority,
            ))
            .load(&mut conn)
            .map_err(|e| format!("Failed to load M3U matches: {}", e))?
    } else {
        base_query
            .select((
                channel_mappings::xmltv_channel_id,
                channel_mappings::m3u_channel_id,
                channel_mappings::match_confidence,
                channel_mappings::is_primary,
                channel_mappings::stream_priority,
            ))
            .load(&mut conn)
            .map_err(|e| format!("Failed to load M3U matches: {}", e))?
    };

    Ok(matches
        .into_iter()
        .filter_map(|(xmltv_id, m3u_id, confidence, is_primary, priority)| {
            // Only include entries with valid m3u_channel_id
            m3u_id.map(|m3u_channel_id| {
                let conf = confidence.unwrap_or(0.0) as f64;
                // CR-33: Infer match type from confidence score
                // EPG ID matches get 0.15 boost, exact name matches get 0.10 boost
                let match_type = if conf >= 0.95 {
                    MatchType::ExactEpgId
                } else if conf >= 0.90 {
                    MatchType::ExactName
                } else {
                    MatchType::Fuzzy
                };
                M3uMatchResult {
                    xmltv_channel_id: xmltv_id,
                    m3u_channel_id,
                    confidence: conf,
                    is_primary: is_primary.unwrap_or(0) == 1,
                    stream_priority: priority.unwrap_or(0),
                    match_type,
                }
            })
        })
        .collect())
}
