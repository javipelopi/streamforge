//! Query commands for retrieving XMLTV channels with mappings, target lineup, and source channels.

use diesel::prelude::*;
use tauri::State;

use crate::db::models::{ChannelMapping, XmltvChannel, XmltvChannelSettings, XtreamChannel};
use crate::db::schema::{channel_mappings, xmltv_channel_settings, xmltv_channels, xtream_channels};
use crate::db::DbConnection;

use super::{
    parse_qualities, TargetLineupChannel, XmltvChannelWithMappings,
    XmltvSourceChannel, XtreamStreamMatch,
};

/// Get all XMLTV channels with their mapped Xtream streams.
///
/// Returns a list of all XMLTV channels with:
/// - Channel info (name, icon, etc.)
/// - Settings (enabled, display order)
/// - All matched Xtream streams with confidence and priority
#[tauri::command]
pub fn get_xmltv_channels_with_mappings(
    db: State<DbConnection>,
) -> Result<Vec<XmltvChannelWithMappings>, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    // Load all XMLTV channels
    let channels: Vec<XmltvChannel> = xmltv_channels::table
        .order_by(xmltv_channels::display_name.asc())
        .load::<XmltvChannel>(&mut conn)
        .map_err(|e| format!("Failed to load XMLTV channels: {}", e))?;

    // Load all settings into a map for efficient lookup
    let settings: Vec<XmltvChannelSettings> = xmltv_channel_settings::table
        .load::<XmltvChannelSettings>(&mut conn)
        .map_err(|e| format!("Failed to load channel settings: {}", e))?;

    let settings_map: std::collections::HashMap<i32, XmltvChannelSettings> = settings
        .into_iter()
        .filter_map(|s| Some((s.xmltv_channel_id, s)))
        .collect();

    // Load all mappings (including potentially orphaned ones)
    let all_mappings: Vec<ChannelMapping> = channel_mappings::table
        .order_by((
            channel_mappings::xmltv_channel_id.asc(),
            channel_mappings::stream_priority.asc(),
        ))
        .load::<ChannelMapping>(&mut conn)
        .map_err(|e| format!("Failed to load channel mappings: {}", e))?;

    // Load all Xtream channels into a map for lookup
    let all_xtream_channels: Vec<XtreamChannel> = xtream_channels::table
        .load::<XtreamChannel>(&mut conn)
        .map_err(|e| format!("Failed to load Xtream channels: {}", e))?;

    let xtream_map: std::collections::HashMap<i32, XtreamChannel> = all_xtream_channels
        .into_iter()
        .filter_map(|s| s.id.map(|id| (id, s)))
        .collect();

    // Group mappings by XMLTV channel ID, pairing with stream info (or None if orphaned)
    let mut mappings_map: std::collections::HashMap<i32, Vec<(ChannelMapping, Option<XtreamChannel>)>> =
        std::collections::HashMap::new();

    for mapping in all_mappings {
        // CR-5: xtream_channel_id is now Option<i32>
        let stream = mapping.xtream_channel_id
            .and_then(|id| xtream_map.get(&id).cloned());
        mappings_map
            .entry(mapping.xmltv_channel_id)
            .or_default()
            .push((mapping, stream));
    }

    // Build result list
    let mut result: Vec<XmltvChannelWithMappings> = channels
        .into_iter()
        .filter_map(|channel| {
            let channel_id = channel.id?;

            // Get settings (default to disabled if no matches per AC #3)
            let settings = settings_map.get(&channel_id);
            let channel_mappings = mappings_map.get(&channel_id);

            // Default is_enabled: if settings exist, use them; otherwise default to false (disabled)
            // AC #3: Unmatched channels should be disabled by default
            let is_enabled = settings
                .map(|s| s.is_enabled.unwrap_or(0) != 0)
                .unwrap_or(false);

            let plex_display_order = settings.and_then(|s| s.plex_display_order);

            // Build matches list (including orphaned manual matches)
            let matches: Vec<XtreamStreamMatch> = channel_mappings
                .map(|mappings| {
                    mappings
                        .iter()
                        .filter_map(|(mapping, stream_opt)| {
                            let mapping_id = mapping.id?;
                            let is_manual = mapping.is_manual.unwrap_or(0) != 0;

                            match stream_opt {
                                Some(stream) => {
                                    // Normal case: stream exists
                                    Some(XtreamStreamMatch {
                                        id: stream.id?,
                                        mapping_id,
                                        name: stream.name.clone(),
                                        stream_icon: stream.stream_icon.clone(),
                                        qualities: parse_qualities(&stream.qualities),
                                        match_confidence: mapping.match_confidence.unwrap_or(0.0) as f64,
                                        is_primary: mapping.is_primary.unwrap_or(0) != 0,
                                        is_manual,
                                        stream_priority: mapping.stream_priority.unwrap_or(0),
                                        is_orphaned: false,
                                    })
                                }
                                None if is_manual => {
                                    // Orphaned manual match: stream no longer exists
                                    // Include it so user can see and remove it
                                    // CR-5: xtream_channel_id is now Option<i32>
                                    Some(XtreamStreamMatch {
                                        id: mapping.xtream_channel_id.unwrap_or(0), // Use the old ID for reference
                                        mapping_id,
                                        name: "[Stream no longer available]".to_string(),
                                        stream_icon: None,
                                        qualities: vec![],
                                        match_confidence: mapping.match_confidence.unwrap_or(0.0) as f64,
                                        is_primary: mapping.is_primary.unwrap_or(0) != 0,
                                        is_manual: true,
                                        stream_priority: mapping.stream_priority.unwrap_or(0),
                                        is_orphaned: true,
                                    })
                                }
                                None => {
                                    // Orphaned auto-match: silently skip (shouldn't happen normally)
                                    None
                                }
                            }
                        })
                        .collect()
                })
                .unwrap_or_default();

            Some(XmltvChannelWithMappings {
                id: channel_id,
                source_id: channel.source_id,
                channel_id: channel.channel_id,
                display_name: channel.display_name,
                icon: channel.icon,
                // Story 3-8: Read is_synthetic from DB (NULL/0 = false, 1 = true)
                is_synthetic: channel.is_synthetic.unwrap_or(0) != 0,
                is_enabled,
                plex_display_order,
                match_count: matches.len() as i32,
                matches,
                tags: vec![],
            })
        })
        .collect();

    // Batch-load tags for all channels
    let channel_ids: Vec<i32> = result.iter().map(|c| c.id).collect();
    let tags_map = crate::services::channel_tags::get_tags_for_channels(&mut conn, &channel_ids)
        .unwrap_or_default();
    for channel in &mut result {
        if let Some(tags) = tags_map.get(&channel.id) {
            channel.tags = tags.clone();
        }
    }

    // Story 3-6: Sort by plex_display_order (nulls last), then by display_name as fallback
    result.sort_by(|a, b| {
        match (a.plex_display_order, b.plex_display_order) {
            (Some(a_order), Some(b_order)) => a_order.cmp(&b_order),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => a.display_name.cmp(&b.display_name),
        }
    });

    Ok(result)
}

// ============================================================================
// Story 3-9: Target Lineup View
// ============================================================================

/// Get all ENABLED channels for the Target Lineup view.
///
/// Story 3-9: AC #2 - Display only enabled channels
///
/// Returns channels sorted by plex_display_order (nulls last).
/// This is an optimized query that only returns fields needed for the lineup view.
///
/// # Returns
///
/// List of enabled channels for the Target Lineup
#[tauri::command]
pub fn get_target_lineup_channels(
    db: State<DbConnection>,
) -> Result<Vec<TargetLineupChannel>, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    // OPTIMIZED QUERY: Only load enabled channels via INNER JOIN
    // This matches the SQL spec from Task 3.2 in the story
    let mut enabled_channels: Vec<(XmltvChannel, XmltvChannelSettings)> = xmltv_channels::table
        .inner_join(xmltv_channel_settings::table)
        .filter(xmltv_channel_settings::is_enabled.eq(1))
        .select((xmltv_channels::all_columns, xmltv_channel_settings::all_columns))
        .load::<(XmltvChannel, XmltvChannelSettings)>(&mut conn)
        .map_err(|e| format!("Failed to load enabled channels: {}", e))?;

    // Sort in Rust: nulls last, then by display_name
    enabled_channels.sort_by(|a, b| {
        match (a.1.plex_display_order, b.1.plex_display_order) {
            (Some(a_order), Some(b_order)) => a_order.cmp(&b_order),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => a.0.display_name.cmp(&b.0.display_name),
        }
    });

    // Get channel IDs for mapping count query
    let channel_ids: Vec<i32> = enabled_channels
        .iter()
        .filter_map(|(ch, _)| ch.id)
        .collect();

    // Load mapping counts only for enabled channels
    let mapping_counts: Vec<(i32, i64)> = channel_mappings::table
        .filter(channel_mappings::xmltv_channel_id.eq_any(&channel_ids))
        .group_by(channel_mappings::xmltv_channel_id)
        .select((
            channel_mappings::xmltv_channel_id,
            diesel::dsl::count(channel_mappings::id),
        ))
        .load::<(i32, i64)>(&mut conn)
        .map_err(|e| format!("Failed to load mapping counts: {}", e))?;

    let counts_map: std::collections::HashMap<i32, i32> = mapping_counts
        .into_iter()
        .map(|(id, count)| (id, count as i32))
        .collect();

    // Batch-load tags
    let tags_map = crate::services::channel_tags::get_tags_for_channels(&mut conn, &channel_ids)
        .unwrap_or_default();

    // Build result from pre-filtered enabled channels
    let result: Vec<TargetLineupChannel> = enabled_channels
        .into_iter()
        .filter_map(|(channel, settings)| {
            let channel_id = channel.id?;
            let stream_count = counts_map.get(&channel_id).copied().unwrap_or(0);
            let tags = tags_map.get(&channel_id).cloned().unwrap_or_default();

            Some(TargetLineupChannel {
                id: channel_id,
                display_name: channel.display_name,
                icon: channel.icon,
                is_enabled: true,
                is_synthetic: channel.is_synthetic.unwrap_or(0) != 0,
                stream_count,
                plex_display_order: settings.plex_display_order,
                tags,
            })
        })
        .collect();

    // Result is already sorted by plex_display_order from SQL query
    Ok(result)
}

// ============================================================================
// Story 3-10: XMLTV Source Channel Display
// ============================================================================

/// Get all XMLTV channels for a specific source.
///
/// Story 3-10: AC #2 - Get channels for source
///
/// Returns channels with enabled status and match counts for display
/// in the Sources view accordion.
///
/// # Arguments
///
/// * `source_id` - Source ID to get channels for
///
/// # Returns
///
/// List of XMLTV channels for the source
#[tauri::command]
pub fn get_xmltv_channels_for_source(
    db: State<DbConnection>,
    source_id: i32,
) -> Result<Vec<XmltvSourceChannel>, String> {
    // Validate input
    if source_id <= 0 {
        return Err("Invalid source ID".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    // Load channels for this source
    let channels: Vec<XmltvChannel> = xmltv_channels::table
        .filter(xmltv_channels::source_id.eq(source_id))
        .order_by(xmltv_channels::display_name.asc())
        .load::<XmltvChannel>(&mut conn)
        .map_err(|e| format!("Failed to load XMLTV channels: {}", e))?;

    // Load settings for all channels
    let channel_ids: Vec<i32> = channels.iter().filter_map(|c| c.id).collect();

    let settings: Vec<XmltvChannelSettings> = xmltv_channel_settings::table
        .filter(xmltv_channel_settings::xmltv_channel_id.eq_any(&channel_ids))
        .load::<XmltvChannelSettings>(&mut conn)
        .map_err(|e| format!("Failed to load channel settings: {}", e))?;

    let settings_map: std::collections::HashMap<i32, XmltvChannelSettings> = settings
        .into_iter()
        .map(|s| (s.xmltv_channel_id, s))
        .collect();

    // Load mapping counts for all channels
    let mapping_counts: Vec<(i32, i64)> = channel_mappings::table
        .filter(channel_mappings::xmltv_channel_id.eq_any(&channel_ids))
        .group_by(channel_mappings::xmltv_channel_id)
        .select((
            channel_mappings::xmltv_channel_id,
            diesel::dsl::count(channel_mappings::id),
        ))
        .load::<(i32, i64)>(&mut conn)
        .map_err(|e| format!("Failed to load mapping counts: {}", e))?;

    let counts_map: std::collections::HashMap<i32, i32> = mapping_counts
        .into_iter()
        .map(|(id, count)| (id, count as i32))
        .collect();

    // Build result
    let result: Vec<XmltvSourceChannel> = channels
        .into_iter()
        .filter_map(|channel| {
            let channel_id = channel.id?;
            let settings = settings_map.get(&channel_id);
            let match_count = counts_map.get(&channel_id).copied().unwrap_or(0);

            Some(XmltvSourceChannel {
                id: channel_id,
                source_id: channel.source_id,
                channel_id: channel.channel_id,
                display_name: channel.display_name,
                icon: channel.icon,
                is_synthetic: channel.is_synthetic.unwrap_or(0) != 0,
                is_enabled: settings
                    .map(|s| s.is_enabled.unwrap_or(0) != 0)
                    .unwrap_or(false),
                match_count,
            })
        })
        .collect();

    Ok(result)
}
