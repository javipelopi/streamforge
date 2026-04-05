//! Matcher service — channel matching business logic.
//!
//! Extracted from `commands/matcher.rs`. All functions take `&mut SqliteConnection`
//! as their first argument — no Tauri or Axum dependencies.

use diesel::prelude::*;
use std::collections::HashSet;

use crate::db::models::{
    ChannelMapping, M3uChannel, NewM3uAutoMatchMapping, XmltvChannel, XmltvChannelSettings,
    XtreamChannel,
};
use crate::db::schema::{
    channel_mappings, m3u_channels, settings, xmltv_channel_settings, xmltv_channels,
    xtream_channels,
};
use crate::db::Setting;
use crate::logging::log_event_internal;
use crate::matcher::{
    get_channel_mappings as db_get_channel_mappings,
    get_xmltv_channel_settings as db_get_xmltv_channel_settings, match_channels,
    match_channels_with_rules, match_m3u_channels,
    save_channel_mappings, ChangedStream, M3uMatchResult, MatchConfig, MatchStats, MatchType,
    ProviderChanges,
};
use crate::services::matching_profiles;

/// Default match threshold
const DEFAULT_MATCH_THRESHOLD: f64 = 0.95;
const MATCH_THRESHOLD_KEY: &str = "match_threshold";

/// Result of running the channel matching algorithm.
pub struct MatchResult {
    pub matched_count: usize,
    pub unmatched_count: usize,
    pub total_xmltv: usize,
    pub total_source_channels: usize,
    pub duration_ms: u64,
    pub multiple_matches: usize,
    pub mappings_saved: usize,
}

/// Result of running M3U auto-match.
pub struct M3uMatchServiceResult {
    pub matched_count: usize,
    pub unmatched_count: usize,
    pub total_m3u_channels: usize,
    pub total_xmltv_channels: usize,
    pub duration_ms: u64,
    pub mappings_created: i32,
}

/// Progress callback for matching operations.
pub enum MatchProgress {
    Starting { message: String },
    Saving { message: String },
    Complete { matched: usize, unmatched: usize },
}

/// Run the channel matching algorithm.
///
/// Matches all XMLTV channels to Xtream streams using fuzzy matching.
/// Results are saved to the database with confidence scores and priorities.
pub fn run_channel_matching(
    conn: &mut SqliteConnection,
    threshold: Option<f64>,
    mut on_progress: impl FnMut(MatchProgress),
) -> Result<MatchResult, String> {
    // Get threshold from parameter or settings or default
    let threshold = match threshold {
        Some(t) => t,
        None => get_match_threshold(conn)?,
    };

    // Validate threshold
    if !(0.0..=1.0).contains(&threshold) {
        return Err("Threshold must be between 0.0 and 1.0".to_string());
    }

    let config = MatchConfig::default().with_threshold(threshold);

    // Load all XMLTV channels
    let xmltv_data: Vec<XmltvChannel> = xmltv_channels::table
        .load::<XmltvChannel>(conn)
        .map_err(|e| format!("Failed to load XMLTV channels: {}", e))?;

    // Load all Xtream channels
    let xtream_data: Vec<XtreamChannel> = xtream_channels::table
        .load::<XtreamChannel>(conn)
        .map_err(|e| format!("Failed to load Xtream channels: {}", e))?;

    on_progress(MatchProgress::Starting {
        message: format!(
            "Starting match: {} XMLTV channels, {} Xtream streams",
            xmltv_data.len(),
            xtream_data.len()
        ),
    });

    // Load matching profiles and group XMLTV channels by source_id.
    // For each XMLTV source that has an active profile targeting an Xtream account,
    // use the profile's prefix/suffix rules when matching.
    use std::collections::HashMap;

    // Group XMLTV channels by source_id
    let mut xmltv_by_source: HashMap<i32, Vec<&XmltvChannel>> = HashMap::new();
    for ch in &xmltv_data {
        xmltv_by_source.entry(ch.source_id).or_default().push(ch);
    }

    // Group Xtream channels by account_id
    let mut xtream_by_account: HashMap<i32, Vec<&XtreamChannel>> = HashMap::new();
    for ch in &xtream_data {
        xtream_by_account.entry(ch.account_id).or_default().push(ch);
    }

    // Collect all unique XMLTV source IDs
    let xmltv_source_ids: Vec<i32> = xmltv_by_source.keys().copied().collect();

    // Load active profiles for each XMLTV source
    let mut all_matches: Vec<crate::matcher::MatchResult> = Vec::new();
    let mut combined_stats = MatchStats::default();
    let mut matched_xmltv_sources: std::collections::HashSet<i32> = std::collections::HashSet::new();

    for xmltv_sid in &xmltv_source_ids {
        let profiles = matching_profiles::get_active_profiles_for_xmltv_source(conn, *xmltv_sid)
            .unwrap_or_default();

        for profile in &profiles {
            if profile.stream_source_type != "xtream" {
                continue;
            }

            let xmltv_subset: Vec<XmltvChannel> = xmltv_by_source
                .get(xmltv_sid)
                .map(|chs| chs.iter().map(|c| (*c).clone()).collect())
                .unwrap_or_default();

            let xtream_subset: Vec<XtreamChannel> = xtream_by_account
                .get(&profile.stream_source_id)
                .map(|chs| chs.iter().map(|c| (*c).clone()).collect())
                .unwrap_or_default();

            if xmltv_subset.is_empty() || xtream_subset.is_empty() {
                continue;
            }

            let rules = profile.parsed_rules();
            let (matches_for_pair, stats_for_pair) = match_channels_with_rules(
                &xmltv_subset,
                &xtream_subset,
                &config,
                &rules,
                profile.require_prefix != 0,
                profile.require_suffix != 0,
            );

            all_matches.extend(matches_for_pair);
            combined_stats.matched += stats_for_pair.matched;
            combined_stats.unmatched += stats_for_pair.unmatched;
            combined_stats.multiple_matches += stats_for_pair.multiple_matches;
            combined_stats.total_xmltv += stats_for_pair.total_xmltv;
            combined_stats.total_source_channels += stats_for_pair.total_source_channels;
            matched_xmltv_sources.insert(*xmltv_sid);
        }
    }

    // For any XMLTV source without a profile, run matching without rules against all Xtream channels
    for xmltv_sid in &xmltv_source_ids {
        if matched_xmltv_sources.contains(xmltv_sid) {
            continue;
        }

        let xmltv_subset: Vec<XmltvChannel> = xmltv_by_source
            .get(xmltv_sid)
            .map(|chs| chs.iter().map(|c| (*c).clone()).collect())
            .unwrap_or_default();

        if xmltv_subset.is_empty() {
            continue;
        }

        let (matches_for_source, stats_for_source) =
            match_channels(&xmltv_subset, &xtream_data, &config);

        all_matches.extend(matches_for_source);
        combined_stats.matched += stats_for_source.matched;
        combined_stats.unmatched += stats_for_source.unmatched;
        combined_stats.multiple_matches += stats_for_source.multiple_matches;
        combined_stats.total_xmltv += stats_for_source.total_xmltv;
        combined_stats.total_source_channels += stats_for_source.total_source_channels;
    }

    // Post-process: when multiple profiles match the same XMLTV channel,
    // only the first profile's match (highest priority, iterated first) should be primary.
    // Re-assign is_primary and stream_priority globally per XMLTV channel.
    {
        use std::collections::HashMap as HM;

        // Group match indices by xmltv_channel_id, preserving insertion order (profile priority)
        let mut indices_by_xmltv: HM<i32, Vec<usize>> = HM::new();
        for (i, m) in all_matches.iter().enumerate() {
            indices_by_xmltv
                .entry(m.xmltv_channel_id)
                .or_default()
                .push(i);
        }

        // Indices are in insertion order which reflects profile priority_order
        // (ascending — lower number = higher priority). First profile's match
        // for each XMLTV channel is primary; subsequent profiles are failovers.
        for indices in indices_by_xmltv.values() {
            for (rank, &idx) in indices.iter().enumerate() {
                all_matches[idx].is_primary = rank == 0;
                all_matches[idx].stream_priority = rank as i32;
            }
        }
    }

    let matches = all_matches;
    let stats = combined_stats;

    on_progress(MatchProgress::Saving {
        message: format!("Saving {} matches to database", matches.len()),
    });

    // Get all XMLTV channel IDs for settings creation
    let xmltv_ids: Vec<i32> = xmltv_data.iter().filter_map(|c| c.id).collect();

    // Clear existing auto-matched mappings before saving new ones
    use crate::db::schema::{channel_mappings, match_exclusions};
    // (manual mappings with is_manual=1 are preserved)
    diesel::delete(
        channel_mappings::table.filter(channel_mappings::is_manual.eq(0)),
    )
    .execute(conn)
    .map_err(|e| format!("Failed to clear old auto-matched mappings: {}", e))?;

    // Load exclusions so we skip user-removed pairings
    let excluded_pairs: std::collections::HashSet<(i32, i32)> = match_exclusions::table
        .select((
            match_exclusions::xmltv_channel_id,
            match_exclusions::xtream_channel_id,
        ))
        .load::<(i32, i32)>(conn)
        .unwrap_or_default()
        .into_iter()
        .collect();

    // Filter out excluded pairings before saving
    let filtered_matches: Vec<_> = matches
        .into_iter()
        .filter(|m| !excluded_pairs.contains(&(m.xmltv_channel_id, m.xtream_channel_id)))
        .collect();

    // Save to database
    let saved_count = save_channel_mappings(conn, &filtered_matches, &xmltv_ids)
        .map_err(|e| format!("Failed to save channel mappings: {}", e))?;

    on_progress(MatchProgress::Complete {
        matched: stats.matched,
        unmatched: stats.unmatched,
    });

    // Log channel matching event
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
        conn,
        "info",
        "match",
        &format!(
            "Channel matching completed: {} of {} channels matched (threshold: {:.0}%)",
            stats.matched,
            stats.total_xmltv,
            threshold * 100.0
        ),
        Some(&details.to_string()),
    );

    Ok(MatchResult {
        matched_count: stats.matched,
        unmatched_count: stats.unmatched,
        total_xmltv: stats.total_xmltv,
        total_source_channels: stats.total_source_channels,
        duration_ms: stats.duration_ms,
        multiple_matches: stats.multiple_matches,
        mappings_saved: saved_count,
    })
}

/// Get current match statistics from the database.
pub fn get_match_stats(conn: &mut SqliteConnection) -> Result<MatchStats, String> {
    // calculate_match_stats currently takes a pool reference; delegate through it.
    // For now, we query the stats directly.
    use crate::db::schema::channel_mappings;

    let _total_mappings: i64 = channel_mappings::table
        .count()
        .get_result(conn)
        .map_err(|e| format!("Failed to count mappings: {}", e))?;

    let total_xmltv: i64 = xmltv_channels::table
        .count()
        .get_result(conn)
        .map_err(|e| format!("Failed to count XMLTV channels: {}", e))?;

    let total_xtream: i64 = xtream_channels::table
        .count()
        .get_result(conn)
        .map_err(|e| format!("Failed to count Xtream channels: {}", e))?;

    // Count distinct matched XMLTV channels
    let matched: i64 = channel_mappings::table
        .select(diesel::dsl::sql::<diesel::sql_types::BigInt>(
            "COUNT(DISTINCT xmltv_channel_id)",
        ))
        .first(conn)
        .map_err(|e| format!("Failed to count matched channels: {}", e))?;

    Ok(MatchStats {
        matched: matched as usize,
        unmatched: (total_xmltv - matched) as usize,
        total_xmltv: total_xmltv as usize,
        total_source_channels: total_xtream as usize,
        multiple_matches: 0, // Not tracked in DB
        duration_ms: 0,      // Not applicable for stored stats
    })
}

/// Get channel mappings for a specific XMLTV channel.
pub fn get_channel_mappings_for_xmltv(
    conn: &mut SqliteConnection,
    xmltv_channel_id: i32,
) -> Result<Vec<ChannelMapping>, String> {
    db_get_channel_mappings(conn, xmltv_channel_id)
        .map_err(|e| format!("Failed to get channel mappings: {}", e))
}

/// Get XMLTV channel settings.
pub fn get_xmltv_channel_settings(
    conn: &mut SqliteConnection,
    xmltv_channel_id: i32,
) -> Result<Option<XmltvChannelSettings>, String> {
    db_get_xmltv_channel_settings(conn, xmltv_channel_id)
        .map_err(|e| format!("Failed to get channel settings: {}", e))
}

/// Get the current matching threshold from settings.
pub fn get_match_threshold(conn: &mut SqliteConnection) -> Result<f64, String> {
    let result = settings::table
        .filter(settings::key.eq(MATCH_THRESHOLD_KEY))
        .select(settings::value)
        .first::<String>(conn)
        .optional()
        .map_err(|e| format!("Query error: {}", e))?;

    match result {
        Some(threshold_str) => threshold_str
            .parse::<f64>()
            .map_err(|e| format!("Invalid threshold value: {}", e)),
        None => Ok(DEFAULT_MATCH_THRESHOLD),
    }
}

/// Set the matching threshold.
pub fn set_match_threshold(conn: &mut SqliteConnection, threshold: f64) -> Result<(), String> {
    // Validate threshold range
    if !(0.0..=1.0).contains(&threshold) {
        return Err("Threshold must be between 0.0 and 1.0".to_string());
    }

    // Warn about impractical thresholds
    if threshold < 0.6 {
        eprintln!(
            "[WARNING] Match threshold {} is very low - will match almost everything",
            threshold
        );
    } else if threshold > 0.95 {
        eprintln!(
            "[WARNING] Match threshold {} is very high - will match almost nothing",
            threshold
        );
    }

    let setting = Setting::new(MATCH_THRESHOLD_KEY.to_string(), threshold.to_string());

    diesel::replace_into(settings::table)
        .values(&setting)
        .execute(conn)
        .map_err(|e| format!("Failed to save threshold: {}", e))?;

    Ok(())
}

/// Normalize a channel name (delegates to core matcher).
pub fn normalize_channel_name(name: &str) -> String {
    crate::matcher::normalize_channel_name(name)
}

/// Calculate match score between two channel names.
pub fn calculate_match_score(
    xmltv_name: &str,
    xtream_name: &str,
    epg_id_match: bool,
    exact_name_match: bool,
) -> f64 {
    let config = MatchConfig::default();
    crate::matcher::calculate_match_score(xmltv_name, xtream_name, epg_id_match, exact_name_match, &config)
}

/// Detect changes in the provider's stream list by comparing with database.
pub fn detect_provider_changes(
    conn: &mut SqliteConnection,
    account_id: i32,
    current_streams: &[XtreamChannel],
) -> Result<ProviderChanges, String> {
    crate::matcher::detect_provider_changes(conn, account_id, current_streams)
        .map_err(|e| format!("Failed to detect provider changes: {}", e))
}

/// Auto-match new streams to XMLTV channels using fuzzy algorithm.
pub fn auto_rematch_new_streams(
    conn: &mut SqliteConnection,
    new_streams: &[XtreamChannel],
    threshold: Option<f64>,
) -> Result<i32, String> {
    let threshold = match threshold {
        Some(t) => t,
        None => get_match_threshold(conn)?,
    };
    let config = MatchConfig::default().with_threshold(threshold);

    crate::matcher::auto_rematch_new_streams(conn, new_streams, &config)
        .map_err(|e| format!("Failed to auto-rematch new streams: {}", e))
}

/// Handle removed streams by deleting auto-generated mappings and promoting backups.
///
/// Manual matches (is_manual = 1) are NEVER deleted.
pub fn handle_removed_streams(
    conn: &mut SqliteConnection,
    account_id: i32,
    removed_stream_ids: &[i32],
) -> Result<(i32, i32), String> {
    crate::matcher::handle_removed_streams(conn, account_id, removed_stream_ids)
        .map_err(|e| format!("Failed to handle removed streams: {}", e))
}

/// Handle changed streams by updating metadata and recalculating match confidence.
pub fn handle_changed_streams(
    conn: &mut SqliteConnection,
    account_id: i32,
    changed_streams: &[ChangedStream],
    threshold: Option<f64>,
) -> Result<i32, String> {
    let threshold = match threshold {
        Some(t) => t,
        None => get_match_threshold(conn)?,
    };
    let config = MatchConfig::default().with_threshold(threshold);

    crate::matcher::handle_changed_streams(conn, account_id, changed_streams, &config)
        .map_err(|e| format!("Failed to handle changed streams: {}", e))
}

/// Auto-match M3U channels to XMLTV channels using fuzzy matching.
pub fn auto_match_m3u_channels(
    conn: &mut SqliteConnection,
    source_id: Option<i32>,
    threshold: Option<f64>,
    mut on_progress: impl FnMut(MatchProgress),
) -> Result<M3uMatchServiceResult, String> {
    // Get threshold from parameter or settings or default
    let threshold = match threshold {
        Some(t) => t,
        None => get_match_threshold(conn)?,
    };

    // Validate threshold
    if !(0.0..=1.0).contains(&threshold) {
        return Err("Threshold must be between 0.0 and 1.0".to_string());
    }

    let config = MatchConfig::default().with_threshold(threshold);

    // Load all XMLTV channels
    let xmltv_data: Vec<XmltvChannel> = xmltv_channels::table
        .load::<XmltvChannel>(conn)
        .map_err(|e| format!("Failed to load XMLTV channels: {}", e))?;

    // Load M3U channels (optionally filtered by source)
    let m3u_data: Vec<M3uChannel> = match source_id {
        Some(sid) => m3u_channels::table
            .filter(m3u_channels::source_id.eq(sid))
            .load::<M3uChannel>(conn)
            .map_err(|e| format!("Failed to load M3U channels: {}", e))?,
        None => m3u_channels::table
            .load::<M3uChannel>(conn)
            .map_err(|e| format!("Failed to load M3U channels: {}", e))?,
    };

    on_progress(MatchProgress::Starting {
        message: format!(
            "Starting M3U match: {} XMLTV channels, {} M3U channels",
            xmltv_data.len(),
            m3u_data.len()
        ),
    });

    // Run matching algorithm
    let (matches, stats) = match_m3u_channels(&xmltv_data, &m3u_data, &config);

    on_progress(MatchProgress::Saving {
        message: format!("Saving {} M3U matches to database", matches.len()),
    });

    // Wrap all DB operations in a transaction for atomicity
    let mappings_created = conn
        .transaction::<i32, diesel::result::Error, _>(|conn| {
            // Query existing mappings to prevent duplicates
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

            let mut new_mappings: Vec<NewM3uAutoMatchMapping> = Vec::new();
            let mut xmltv_ids_to_enable: Vec<i32> = Vec::new();
            let mut skipped_duplicates = 0;

            for m in &matches {
                // Only save primary matches (highest confidence per XMLTV channel)
                if !m.is_primary {
                    continue;
                }

                // Skip if mapping already exists
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
                let m3u_channel = m3u_data.iter().find(|c| c.id == Some(m.m3u_channel_id));

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
                tracing::info!(skipped = skipped_duplicates, "Skipped duplicate M3U mappings");
            }

            // Batch insert all mappings at once
            let created_count = if !new_mappings.is_empty() {
                let result = diesel::insert_into(channel_mappings::table)
                    .values(&new_mappings)
                    .execute(conn);

                match result {
                    Ok(count) => count as i32,
                    Err(e) => {
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

    on_progress(MatchProgress::Complete {
        matched: stats.matched,
        unmatched: stats.unmatched,
    });

    // Log the operation
    let details = serde_json::json!({
        "matchedCount": stats.matched,
        "unmatchedCount": stats.unmatched,
        "totalM3uChannels": m3u_data.len(),
        "totalXmltvChannels": xmltv_data.len(),
        "threshold": threshold,
        "durationMs": stats.duration_ms,
        "mappingsCreated": mappings_created,
        "sourceId": source_id,
    });
    let _ = log_event_internal(
        conn,
        "info",
        "m3u_match",
        &format!(
            "M3U auto-match completed: {} of {} channels matched (threshold: {:.0}%)",
            stats.matched,
            xmltv_data.len(),
            threshold * 100.0
        ),
        Some(&details.to_string()),
    );

    Ok(M3uMatchServiceResult {
        matched_count: stats.matched,
        unmatched_count: stats.unmatched,
        total_m3u_channels: m3u_data.len(),
        total_xmltv_channels: xmltv_data.len(),
        duration_ms: stats.duration_ms,
        mappings_created,
    })
}

/// Get M3U auto-match results for display.
///
/// Returns all M3U match results with channel details.
/// Infers match type from confidence score:
/// - confidence >= 0.95 (with EPG ID boost) -> ExactEpgId
/// - confidence >= 0.90 (with exact name boost) -> ExactName
/// - otherwise -> Fuzzy
pub fn get_m3u_auto_match_results(
    conn: &mut SqliteConnection,
    source_id: Option<i32>,
) -> Result<Vec<M3uMatchResult>, String> {
    // Query channel_mappings where source_type = "m3u" and m3u_channel_id is not null
    #[allow(clippy::type_complexity)]
    let matches: Vec<(i32, Option<i32>, Option<f32>, Option<i32>, Option<i32>)> =
        if let Some(sid) = source_id {
            // Join with m3u_channels to filter by source_id
            channel_mappings::table
                .inner_join(
                    m3u_channels::table
                        .on(m3u_channels::id.nullable().eq(channel_mappings::m3u_channel_id)),
                )
                .filter(channel_mappings::source_type.eq("m3u"))
                .filter(m3u_channels::source_id.eq(sid))
                .select((
                    channel_mappings::xmltv_channel_id,
                    channel_mappings::m3u_channel_id,
                    channel_mappings::match_confidence,
                    channel_mappings::is_primary,
                    channel_mappings::stream_priority,
                ))
                .load(conn)
                .map_err(|e| format!("Failed to load M3U matches: {}", e))?
        } else {
            channel_mappings::table
                .filter(channel_mappings::source_type.eq("m3u"))
                .filter(channel_mappings::m3u_channel_id.is_not_null())
                .select((
                    channel_mappings::xmltv_channel_id,
                    channel_mappings::m3u_channel_id,
                    channel_mappings::match_confidence,
                    channel_mappings::is_primary,
                    channel_mappings::stream_priority,
                ))
                .load(conn)
                .map_err(|e| format!("Failed to load M3U matches: {}", e))?
        };

    Ok(matches
        .into_iter()
        .filter_map(|(xmltv_id, m3u_id, confidence, is_primary, priority)| {
            m3u_id.map(|m3u_channel_id| {
                let conf = confidence.unwrap_or(0.0) as f64;
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
