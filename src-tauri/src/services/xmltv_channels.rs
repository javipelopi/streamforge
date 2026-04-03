//! XMLTV channels service — channel display, mapping CRUD, and lineup operations.
//!
//! Extracted from `commands/xmltv_channels/`. All functions take
//! `&mut SqliteConnection` so they can be called from both Tauri commands
//! and Axum REST handlers.

use diesel::prelude::*;
use std::collections::HashMap;
use strsim::jaro_winkler;

use crate::types::{
    build_stream_match, parse_qualities, AcestreamMatch, AllChannelMappings, M3uStreamMatch,
    TargetLineupChannel, XmltvChannelWithMappings, XmltvSourceChannel, XtreamStreamMatch,
    XtreamStreamSearchResult, SYNTHETIC_SOURCE_ID,
};
use crate::db::models::{
    ChannelMapping, NewChannelMapping, NewXmltvChannel, NewXmltvChannelSettings,
    XmltvChannel, XmltvChannelSettings, XtreamChannel,
};
use crate::db::schema::{channel_mappings, xmltv_channel_settings, xmltv_channels, xtream_channels};
use crate::matcher::normalize_channel_name;

/// Minimum fuzzy score threshold for search results.
const SEARCH_SCORE_THRESHOLD: f64 = 0.3;

/// Maximum number of search results to return.
const SEARCH_RESULTS_LIMIT: usize = 100;

// ============================================================================
// Query operations
// ============================================================================

/// Get all XMLTV channels with their mapped streams and settings.
///
/// Returns channels sorted by `plex_display_order` (nulls last), then by
/// `display_name`. Each channel includes its full list of mapped streams
/// (including orphaned manual matches).
pub fn get_xmltv_channels_with_mappings(
    conn: &mut SqliteConnection,
) -> Result<Vec<XmltvChannelWithMappings>, String> {
    // Load all XMLTV channels
    let channels: Vec<XmltvChannel> = xmltv_channels::table
        .order_by(xmltv_channels::display_name.asc())
        .load::<XmltvChannel>(conn)
        .map_err(|e| format!("Failed to load XMLTV channels: {}", e))?;

    // Load all settings into a map for efficient lookup
    let settings: Vec<XmltvChannelSettings> = xmltv_channel_settings::table
        .load::<XmltvChannelSettings>(conn)
        .map_err(|e| format!("Failed to load channel settings: {}", e))?;

    let settings_map: HashMap<i32, XmltvChannelSettings> = settings
        .into_iter()
        .map(|s| (s.xmltv_channel_id, s))
        .collect();

    // Load all mappings (including potentially orphaned ones)
    let all_mappings: Vec<ChannelMapping> = channel_mappings::table
        .order_by((
            channel_mappings::xmltv_channel_id.asc(),
            channel_mappings::stream_priority.asc(),
        ))
        .load::<ChannelMapping>(conn)
        .map_err(|e| format!("Failed to load channel mappings: {}", e))?;

    // Load all Xtream channels into a map for lookup
    let all_xtream_channels: Vec<XtreamChannel> = xtream_channels::table
        .load::<XtreamChannel>(conn)
        .map_err(|e| format!("Failed to load Xtream channels: {}", e))?;

    let xtream_map: HashMap<i32, XtreamChannel> = all_xtream_channels
        .into_iter()
        .filter_map(|s| s.id.map(|id| (id, s)))
        .collect();

    // Group mappings by XMLTV channel ID, pairing with stream info (or None if orphaned)
    let mut mappings_map: HashMap<i32, Vec<(ChannelMapping, Option<XtreamChannel>)>> =
        HashMap::new();

    for mapping in all_mappings {
        let stream = mapping
            .xtream_channel_id
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

            let settings = settings_map.get(&channel_id);
            let channel_mappings_list = mappings_map.get(&channel_id);

            // AC #3: Unmatched channels disabled by default
            let is_enabled = settings
                .map(|s| s.is_enabled.unwrap_or(0) != 0)
                .unwrap_or(false);

            let plex_display_order = settings.and_then(|s| s.plex_display_order);

            // Build matches list (including orphaned manual matches)
            let matches: Vec<XtreamStreamMatch> = channel_mappings_list
                .map(|mappings| {
                    mappings
                        .iter()
                        .filter_map(|(mapping, stream_opt)| {
                            let mapping_id = mapping.id?;
                            let is_manual = mapping.is_manual.unwrap_or(0) != 0;

                            match stream_opt {
                                Some(stream) => Some(XtreamStreamMatch {
                                    id: stream.id?,
                                    mapping_id,
                                    name: stream.name.clone(),
                                    stream_icon: stream.stream_icon.clone(),
                                    qualities: parse_qualities(&stream.qualities),
                                    match_confidence: mapping.match_confidence.unwrap_or(0.0)
                                        as f64,
                                    is_primary: mapping.is_primary.unwrap_or(0) != 0,
                                    is_manual,
                                    stream_priority: mapping.stream_priority.unwrap_or(0),
                                    is_orphaned: false,
                                }),
                                None if is_manual => Some(XtreamStreamMatch {
                                    id: mapping.xtream_channel_id.unwrap_or(0),
                                    mapping_id,
                                    name: "[Stream no longer available]".to_string(),
                                    stream_icon: None,
                                    qualities: vec![],
                                    match_confidence: mapping.match_confidence.unwrap_or(0.0)
                                        as f64,
                                    is_primary: mapping.is_primary.unwrap_or(0) != 0,
                                    is_manual: true,
                                    stream_priority: mapping.stream_priority.unwrap_or(0),
                                    is_orphaned: true,
                                }),
                                None => None,
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
                is_synthetic: channel.is_synthetic.unwrap_or(0) != 0,
                is_enabled,
                plex_display_order,
                match_count: matches.len() as i32,
                matches,
            })
        })
        .collect();

    // Sort by plex_display_order (nulls last), then by display_name
    result.sort_by(|a, b| match (a.plex_display_order, b.plex_display_order) {
        (Some(a_order), Some(b_order)) => a_order.cmp(&b_order),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => a.display_name.cmp(&b.display_name),
    });

    Ok(result)
}

/// Get all ENABLED channels for the Target Lineup view.
///
/// Returns channels sorted by `plex_display_order` (nulls last). Only fields
/// needed for the lineup view are included.
pub fn get_target_lineup_channels(
    conn: &mut SqliteConnection,
) -> Result<Vec<TargetLineupChannel>, String> {
    let mut enabled_channels: Vec<(XmltvChannel, XmltvChannelSettings)> = xmltv_channels::table
        .inner_join(xmltv_channel_settings::table)
        .filter(xmltv_channel_settings::is_enabled.eq(1))
        .select((
            xmltv_channels::all_columns,
            xmltv_channel_settings::all_columns,
        ))
        .load::<(XmltvChannel, XmltvChannelSettings)>(conn)
        .map_err(|e| format!("Failed to load enabled channels: {}", e))?;

    // Sort in Rust: nulls last, then by display_name
    enabled_channels.sort_by(|a, b| match (a.1.plex_display_order, b.1.plex_display_order) {
        (Some(a_order), Some(b_order)) => a_order.cmp(&b_order),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => a.0.display_name.cmp(&b.0.display_name),
    });

    let channel_ids: Vec<i32> = enabled_channels
        .iter()
        .filter_map(|(ch, _)| ch.id)
        .collect();

    let mapping_counts: Vec<(i32, i64)> = channel_mappings::table
        .filter(channel_mappings::xmltv_channel_id.eq_any(&channel_ids))
        .group_by(channel_mappings::xmltv_channel_id)
        .select((
            channel_mappings::xmltv_channel_id,
            diesel::dsl::count(channel_mappings::id),
        ))
        .load::<(i32, i64)>(conn)
        .map_err(|e| format!("Failed to load mapping counts: {}", e))?;

    let counts_map: HashMap<i32, i32> = mapping_counts
        .into_iter()
        .map(|(id, count)| (id, count as i32))
        .collect();

    let result: Vec<TargetLineupChannel> = enabled_channels
        .into_iter()
        .filter_map(|(channel, settings)| {
            let channel_id = channel.id?;
            let stream_count = counts_map.get(&channel_id).copied().unwrap_or(0);

            Some(TargetLineupChannel {
                id: channel_id,
                display_name: channel.display_name,
                icon: channel.icon,
                is_enabled: true,
                is_synthetic: channel.is_synthetic.unwrap_or(0) != 0,
                stream_count,
                plex_display_order: settings.plex_display_order,
            })
        })
        .collect();

    Ok(result)
}

/// Get all XMLTV channels for a specific source.
///
/// Returns channels with enabled status and match counts for display
/// in the Sources view accordion.
pub fn get_xmltv_channels_for_source(
    conn: &mut SqliteConnection,
    source_id: i32,
) -> Result<Vec<XmltvSourceChannel>, String> {
    if source_id <= 0 {
        return Err("Invalid source ID".to_string());
    }

    let channels: Vec<XmltvChannel> = xmltv_channels::table
        .filter(xmltv_channels::source_id.eq(source_id))
        .order_by(xmltv_channels::display_name.asc())
        .load::<XmltvChannel>(conn)
        .map_err(|e| format!("Failed to load XMLTV channels: {}", e))?;

    let channel_ids: Vec<i32> = channels.iter().filter_map(|c| c.id).collect();

    let settings: Vec<XmltvChannelSettings> = xmltv_channel_settings::table
        .filter(xmltv_channel_settings::xmltv_channel_id.eq_any(&channel_ids))
        .load::<XmltvChannelSettings>(conn)
        .map_err(|e| format!("Failed to load channel settings: {}", e))?;

    let settings_map: HashMap<i32, XmltvChannelSettings> = settings
        .into_iter()
        .map(|s| (s.xmltv_channel_id, s))
        .collect();

    let mapping_counts: Vec<(i32, i64)> = channel_mappings::table
        .filter(channel_mappings::xmltv_channel_id.eq_any(&channel_ids))
        .group_by(channel_mappings::xmltv_channel_id)
        .select((
            channel_mappings::xmltv_channel_id,
            diesel::dsl::count(channel_mappings::id),
        ))
        .load::<(i32, i64)>(conn)
        .map_err(|e| format!("Failed to load mapping counts: {}", e))?;

    let counts_map: HashMap<i32, i32> = mapping_counts
        .into_iter()
        .map(|(id, count)| (id, count as i32))
        .collect();

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

// ============================================================================
// Toggle / bulk operations
// ============================================================================

/// Read the current enabled state of an XMLTV channel (defaults to false).
pub fn get_xmltv_channel_enabled(
    conn: &mut SqliteConnection,
    xmltv_channel_id: i32,
) -> Result<bool, String> {
    use crate::db::schema::xmltv_channel_settings;

    let row = xmltv_channel_settings::table
        .filter(xmltv_channel_settings::xmltv_channel_id.eq(xmltv_channel_id))
        .select(xmltv_channel_settings::is_enabled)
        .first::<Option<i32>>(conn)
        .optional()
        .map_err(|e| format!("Failed to read channel enabled state: {}", e))?;

    Ok(row.flatten().unwrap_or(0) != 0)
}

/// Toggle an XMLTV channel's enabled state.
///
/// Creates or updates the channel settings row. Returns the new enabled state.
pub fn toggle_xmltv_channel(
    conn: &mut SqliteConnection,
    xmltv_channel_id: i32,
    enabled: bool,
) -> Result<bool, String> {
    if xmltv_channel_id <= 0 {
        return Err("Invalid XMLTV channel ID".to_string());
    }

    let enabled_int = if enabled { 1 } else { 0 };

    // Upsert: try update first, insert if no row exists
    let updated = diesel::update(
        xmltv_channel_settings::table
            .filter(xmltv_channel_settings::xmltv_channel_id.eq(xmltv_channel_id)),
    )
    .set(xmltv_channel_settings::is_enabled.eq(enabled_int))
    .execute(conn)
    .map_err(|e| format!("Failed to update channel settings: {}", e))?;

    if updated == 0 {
        // No existing settings row — insert one
        diesel::insert_into(xmltv_channel_settings::table)
            .values((
                xmltv_channel_settings::xmltv_channel_id.eq(xmltv_channel_id),
                xmltv_channel_settings::is_enabled.eq(enabled_int),
            ))
            .execute(conn)
            .map_err(|e| format!("Failed to create channel settings: {}", e))?;
    }

    Ok(enabled)
}

/// Bulk-toggle multiple XMLTV channels at once.
///
/// Returns the number of channels affected.
pub fn bulk_toggle_channels(
    conn: &mut SqliteConnection,
    channel_ids: &[i32],
    enabled: bool,
) -> Result<usize, String> {
    if channel_ids.is_empty() {
        return Ok(0);
    }

    let enabled_int = if enabled { 1 } else { 0 };

    conn.transaction(|conn| {
        let mut affected = 0usize;

        for &channel_id in channel_ids {
            let updated = diesel::update(
                xmltv_channel_settings::table
                    .filter(xmltv_channel_settings::xmltv_channel_id.eq(channel_id)),
            )
            .set(xmltv_channel_settings::is_enabled.eq(enabled_int))
            .execute(conn)?;

            if updated == 0 {
                diesel::insert_into(xmltv_channel_settings::table)
                    .values((
                        xmltv_channel_settings::xmltv_channel_id.eq(channel_id),
                        xmltv_channel_settings::is_enabled.eq(enabled_int),
                    ))
                    .execute(conn)?;
            }
            affected += 1;
        }

        Ok(affected)
    })
    .map_err(|e: diesel::result::Error| format!("Failed to bulk-toggle channels: {}", e))
}

/// Update the display order for a channel.
pub fn update_channel_order(
    conn: &mut SqliteConnection,
    xmltv_channel_id: i32,
    plex_display_order: Option<i32>,
) -> Result<(), String> {
    if xmltv_channel_id <= 0 {
        return Err("Invalid XMLTV channel ID".to_string());
    }

    let updated = diesel::update(
        xmltv_channel_settings::table
            .filter(xmltv_channel_settings::xmltv_channel_id.eq(xmltv_channel_id)),
    )
    .set(xmltv_channel_settings::plex_display_order.eq(plex_display_order))
    .execute(conn)
    .map_err(|e| format!("Failed to update channel order: {}", e))?;

    if updated == 0 {
        // No existing settings row — insert one
        diesel::insert_into(xmltv_channel_settings::table)
            .values((
                xmltv_channel_settings::xmltv_channel_id.eq(xmltv_channel_id),
                xmltv_channel_settings::plex_display_order.eq(plex_display_order),
            ))
            .execute(conn)
            .map_err(|e| format!("Failed to create channel settings: {}", e))?;
    }

    Ok(())
}

// ============================================================================
// Mapping CRUD
// ============================================================================

/// Set the primary stream for an XMLTV channel.
///
/// The specified stream becomes primary (`is_primary = true`, `stream_priority = 0`).
/// All other streams become backup.
pub fn set_primary_stream(
    conn: &mut SqliteConnection,
    xmltv_channel_id: i32,
    xtream_channel_id: i32,
) -> Result<Vec<XtreamStreamMatch>, String> {
    conn.transaction(|conn| {
        let mut all_mappings: Vec<ChannelMapping> = channel_mappings::table
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .order_by(channel_mappings::stream_priority.asc())
            .load::<ChannelMapping>(conn)?;

        let new_primary_idx = all_mappings
            .iter()
            .position(|m| m.xtream_channel_id == Some(xtream_channel_id))
            .ok_or(diesel::result::Error::NotFound)?;

        for (idx, mapping) in all_mappings.iter_mut().enumerate() {
            let mapping_id = mapping.id.ok_or(diesel::result::Error::NotFound)?;

            if idx == new_primary_idx {
                diesel::update(
                    channel_mappings::table.filter(channel_mappings::id.eq(Some(mapping_id))),
                )
                .set((
                    channel_mappings::is_primary.eq(1),
                    channel_mappings::stream_priority.eq(0),
                ))
                .execute(conn)?;
            } else {
                let new_priority = if idx < new_primary_idx { idx + 1 } else { idx };
                diesel::update(
                    channel_mappings::table.filter(channel_mappings::id.eq(Some(mapping_id))),
                )
                .set((
                    channel_mappings::is_primary.eq(0),
                    channel_mappings::stream_priority.eq(new_priority as i32),
                ))
                .execute(conn)?;
            }
        }

        let mappings: Vec<(ChannelMapping, XtreamChannel)> = channel_mappings::table
            .inner_join(xtream_channels::table)
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .order_by(channel_mappings::stream_priority.asc())
            .load::<(ChannelMapping, XtreamChannel)>(conn)?;

        let result: Vec<XtreamStreamMatch> = mappings
            .iter()
            .filter_map(|(mapping, stream)| build_stream_match(mapping, stream))
            .collect();

        Ok(result)
    })
    .map_err(|e: diesel::result::Error| format!("Failed to update primary stream: {}", e))
}

/// Add a manual Xtream stream mapping to an XMLTV channel.
pub fn add_manual_stream_mapping(
    conn: &mut SqliteConnection,
    xmltv_channel_id: i32,
    xtream_channel_id: i32,
    set_as_primary: bool,
) -> Result<Vec<XtreamStreamMatch>, String> {
    if xmltv_channel_id <= 0 {
        return Err("Invalid XMLTV channel ID".to_string());
    }
    if xtream_channel_id <= 0 {
        return Err("Invalid Xtream channel ID".to_string());
    }

    conn.transaction(|conn| {
        // Check if mapping already exists
        let existing: Option<ChannelMapping> = channel_mappings::table
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .filter(channel_mappings::xtream_channel_id.eq(xtream_channel_id))
            .first::<ChannelMapping>(conn)
            .optional()?;

        if existing.is_some() {
            return Err(diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::UniqueViolation,
                Box::new("Mapping already exists".to_string()),
            ));
        }

        if set_as_primary {
            diesel::update(
                channel_mappings::table
                    .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id)),
            )
            .set((
                channel_mappings::is_primary.eq(0),
                channel_mappings::stream_priority.eq(channel_mappings::stream_priority + 1),
            ))
            .execute(conn)?;
        }

        let max_priority: Option<i32> = channel_mappings::table
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .select(diesel::dsl::max(channel_mappings::stream_priority))
            .first::<Option<i32>>(conn)?;

        let new_priority = if set_as_primary {
            0
        } else {
            max_priority.unwrap_or(-1) + 1
        };

        let new_mapping =
            crate::db::models::NewChannelMapping::manual(xmltv_channel_id, xtream_channel_id)
                .with_primary(set_as_primary)
                .with_priority(new_priority);

        diesel::insert_into(channel_mappings::table)
            .values(&new_mapping)
            .execute(conn)?;

        let mappings: Vec<(ChannelMapping, XtreamChannel)> = channel_mappings::table
            .inner_join(xtream_channels::table)
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .order_by(channel_mappings::stream_priority.asc())
            .load::<(ChannelMapping, XtreamChannel)>(conn)?;

        let result: Vec<XtreamStreamMatch> = mappings
            .iter()
            .filter_map(|(mapping, stream)| build_stream_match(mapping, stream))
            .collect();

        Ok(result)
    })
    .map_err(|e: diesel::result::Error| {
        if let diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UniqueViolation,
            _,
        ) = e
        {
            "This stream is already mapped to this channel".to_string()
        } else {
            format!("Failed to add manual stream mapping: {}", e)
        }
    })
}

/// Remove a stream mapping.
///
/// If the deleted mapping was primary, promotes the next highest confidence
/// match to primary.
pub fn remove_stream_mapping(
    conn: &mut SqliteConnection,
    mapping_id: i32,
) -> Result<Vec<XtreamStreamMatch>, String> {
    if mapping_id <= 0 {
        return Err("Invalid mapping ID".to_string());
    }

    conn.transaction(|conn| {
        let mapping: ChannelMapping = channel_mappings::table
            .filter(channel_mappings::id.eq(Some(mapping_id)))
            .first::<ChannelMapping>(conn)
            .map_err(|_| diesel::result::Error::NotFound)?;

        let xmltv_channel_id = mapping.xmltv_channel_id;
        let was_primary = mapping.is_primary.unwrap_or(0) != 0;

        diesel::delete(
            channel_mappings::table.filter(channel_mappings::id.eq(Some(mapping_id))),
        )
        .execute(conn)?;

        // If deleted mapping was primary, promote next highest confidence
        if was_primary {
            let next_primary: Option<ChannelMapping> = channel_mappings::table
                .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
                .order_by(channel_mappings::match_confidence.desc())
                .first::<ChannelMapping>(conn)
                .optional()?;

            if let Some(new_primary) = next_primary {
                if let Some(new_primary_id) = new_primary.id {
                    diesel::update(
                        channel_mappings::table
                            .filter(channel_mappings::id.eq(Some(new_primary_id))),
                    )
                    .set((
                        channel_mappings::is_primary.eq(1),
                        channel_mappings::stream_priority.eq(0),
                    ))
                    .execute(conn)?;
                }
            }
        }

        // Recalculate priorities
        let remaining_mappings: Vec<ChannelMapping> = channel_mappings::table
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .order_by(channel_mappings::match_confidence.desc())
            .load::<ChannelMapping>(conn)?;

        let mut backup_priority = 1;
        for m in remaining_mappings.iter() {
            if let Some(mid) = m.id {
                let is_primary = m.is_primary.unwrap_or(0) != 0;
                let priority = if is_primary {
                    0
                } else {
                    let p = backup_priority;
                    backup_priority += 1;
                    p
                };
                diesel::update(
                    channel_mappings::table.filter(channel_mappings::id.eq(Some(mid))),
                )
                .set(channel_mappings::stream_priority.eq(priority))
                .execute(conn)?;
            }
        }

        let mappings: Vec<(ChannelMapping, XtreamChannel)> = channel_mappings::table
            .inner_join(xtream_channels::table)
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .order_by(channel_mappings::stream_priority.asc())
            .load::<(ChannelMapping, XtreamChannel)>(conn)?;

        let result: Vec<XtreamStreamMatch> = mappings
            .iter()
            .filter_map(|(mapping, stream)| build_stream_match(mapping, stream))
            .collect();

        Ok(result)
    })
    .map_err(|e: diesel::result::Error| format!("Failed to remove stream mapping: {}", e))
}

/// Add a manual M3U channel mapping to an XMLTV channel.
pub fn add_m3u_channel_mapping(
    conn: &mut SqliteConnection,
    xmltv_channel_id: i32,
    m3u_channel_id: i32,
    set_as_primary: bool,
) -> Result<AllChannelMappings, String> {
    use crate::db::models::NewChannelMapping;
    use crate::db::schema::m3u_channels;

    if xmltv_channel_id <= 0 || m3u_channel_id <= 0 {
        return Err("Invalid channel ID".to_string());
    }

    conn.transaction(|conn| {
        // Verify the M3U channel exists
        let _m3u_channel: crate::db::models::M3uChannel = m3u_channels::table
            .filter(m3u_channels::id.eq(m3u_channel_id))
            .first(conn)
            .map_err(|_| diesel::result::Error::NotFound)?;

        if set_as_primary {
            diesel::update(
                channel_mappings::table
                    .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id)),
            )
            .set((
                channel_mappings::is_primary.eq(0),
                channel_mappings::stream_priority.eq(channel_mappings::stream_priority + 1),
            ))
            .execute(conn)?;
        }

        let max_priority: Option<i32> = channel_mappings::table
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .select(diesel::dsl::max(channel_mappings::stream_priority))
            .first::<Option<i32>>(conn)?;

        let new_priority = if set_as_primary {
            0
        } else {
            max_priority.unwrap_or(-1) + 1
        };

        let new_mapping = NewChannelMapping::m3u(xmltv_channel_id, m3u_channel_id, new_priority)
            .with_primary(set_as_primary);

        diesel::insert_into(channel_mappings::table)
            .values(&new_mapping)
            .execute(conn)?;

        load_all_channel_mappings(conn, xmltv_channel_id)
    })
    .map_err(|e: diesel::result::Error| {
        if let diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UniqueViolation,
            _,
        ) = e
        {
            "This M3U channel is already mapped".to_string()
        } else if matches!(e, diesel::result::Error::NotFound) {
            "M3U channel not found".to_string()
        } else {
            format!("Failed to add M3U mapping: {}", e)
        }
    })
}

/// Add a manual Acestream source mapping to an XMLTV channel.
pub fn add_acestream_channel_mapping(
    conn: &mut SqliteConnection,
    xmltv_channel_id: i32,
    acestream_source_id: i32,
    set_as_primary: bool,
) -> Result<AllChannelMappings, String> {
    use crate::db::models::NewChannelMapping;
    use crate::db::schema::acestream_sources;

    if xmltv_channel_id <= 0 || acestream_source_id <= 0 {
        return Err("Invalid ID".to_string());
    }

    conn.transaction(|conn| {
        let _acestream: crate::db::models::AcestreamSource = acestream_sources::table
            .filter(acestream_sources::id.eq(acestream_source_id))
            .first(conn)
            .map_err(|_| diesel::result::Error::NotFound)?;

        if set_as_primary {
            diesel::update(
                channel_mappings::table
                    .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id)),
            )
            .set((
                channel_mappings::is_primary.eq(0),
                channel_mappings::stream_priority.eq(channel_mappings::stream_priority + 1),
            ))
            .execute(conn)?;
        }

        let max_priority: Option<i32> = channel_mappings::table
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .select(diesel::dsl::max(channel_mappings::stream_priority))
            .first::<Option<i32>>(conn)?;

        let new_priority = if set_as_primary {
            0
        } else {
            max_priority.unwrap_or(-1) + 1
        };

        let new_mapping =
            NewChannelMapping::acestream(xmltv_channel_id, acestream_source_id, new_priority)
                .with_primary(set_as_primary);

        diesel::insert_into(channel_mappings::table)
            .values(&new_mapping)
            .execute(conn)?;

        load_all_channel_mappings(conn, xmltv_channel_id)
    })
    .map_err(|e: diesel::result::Error| {
        if let diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UniqueViolation,
            _,
        ) = e
        {
            "This Acestream source is already mapped".to_string()
        } else if matches!(e, diesel::result::Error::NotFound) {
            "Acestream source not found".to_string()
        } else {
            format!("Failed to add Acestream mapping: {}", e)
        }
    })
}

/// Get all channel mappings for an XMLTV channel (all source types).
pub fn get_all_channel_mappings(
    conn: &mut SqliteConnection,
    xmltv_channel_id: i32,
) -> Result<AllChannelMappings, String> {
    if xmltv_channel_id <= 0 {
        return Err("Invalid channel ID".to_string());
    }

    load_all_channel_mappings(conn, xmltv_channel_id)
        .map_err(|e| format!("Failed to load mappings: {}", e))
}

// ============================================================================
// Search
// ============================================================================

/// Get all Xtream streams (deprecated — use `search_xtream_streams` instead).
pub fn get_all_xtream_streams(
    conn: &mut SqliteConnection,
) -> Result<Vec<XtreamStreamSearchResult>, String> {
    let streams: Vec<XtreamChannel> = xtream_channels::table
        .order_by(xtream_channels::name.asc())
        .load::<XtreamChannel>(conn)
        .map_err(|e| format!("Failed to load Xtream channels: {}", e))?;

    let mappings: Vec<ChannelMapping> = channel_mappings::table
        .load::<ChannelMapping>(conn)
        .map_err(|e| format!("Failed to load channel mappings: {}", e))?;

    let mut mappings_map: HashMap<i32, Vec<i32>> = HashMap::new();
    for mapping in mappings {
        if let Some(xtream_id) = mapping.xtream_channel_id {
            mappings_map
                .entry(xtream_id)
                .or_default()
                .push(mapping.xmltv_channel_id);
        }
    }

    let result: Vec<XtreamStreamSearchResult> = streams
        .into_iter()
        .filter_map(|stream| {
            let stream_id = stream.id?;
            Some(XtreamStreamSearchResult {
                id: stream_id,
                stream_id: stream.stream_id,
                name: stream.name,
                stream_icon: stream.stream_icon,
                qualities: parse_qualities(&stream.qualities),
                category_name: stream.category_name,
                matched_to_xmltv_ids: mappings_map.get(&stream_id).cloned().unwrap_or_default(),
                fuzzy_score: None,
            })
        })
        .collect();

    Ok(result)
}

/// Search Xtream streams by fuzzy matching against a query string.
///
/// Returns streams with fuzzy score >= threshold, ordered by score descending,
/// limited to 100 results.
pub fn search_xtream_streams(
    conn: &mut SqliteConnection,
    query: &str,
) -> Result<Vec<XtreamStreamSearchResult>, String> {
    if query.trim().is_empty() {
        return Err("Search query cannot be empty".to_string());
    }

    let streams: Vec<XtreamChannel> = xtream_channels::table
        .load::<XtreamChannel>(conn)
        .map_err(|e| format!("Failed to load Xtream channels: {}", e))?;

    let mappings: Vec<ChannelMapping> = channel_mappings::table
        .load::<ChannelMapping>(conn)
        .map_err(|e| format!("Failed to load channel mappings: {}", e))?;

    let mut mappings_map: HashMap<i32, Vec<i32>> = HashMap::new();
    for mapping in mappings {
        if let Some(xtream_id) = mapping.xtream_channel_id {
            mappings_map
                .entry(xtream_id)
                .or_default()
                .push(mapping.xmltv_channel_id);
        }
    }

    let normalized_query = normalize_channel_name(query);

    let mut scored_results: Vec<XtreamStreamSearchResult> = streams
        .into_iter()
        .filter_map(|stream| {
            let stream_id = stream.id?;
            let normalized_name = normalize_channel_name(&stream.name);
            let score = jaro_winkler(&normalized_query, &normalized_name);

            if score < SEARCH_SCORE_THRESHOLD {
                return None;
            }

            Some(XtreamStreamSearchResult {
                id: stream_id,
                stream_id: stream.stream_id,
                name: stream.name,
                stream_icon: stream.stream_icon,
                qualities: parse_qualities(&stream.qualities),
                category_name: stream.category_name,
                matched_to_xmltv_ids: mappings_map.get(&stream_id).cloned().unwrap_or_default(),
                fuzzy_score: Some(score),
            })
        })
        .collect();

    scored_results.sort_by(|a, b| {
        b.fuzzy_score
            .unwrap_or(0.0)
            .partial_cmp(&a.fuzzy_score.unwrap_or(0.0))
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    scored_results.truncate(SEARCH_RESULTS_LIMIT);

    Ok(scored_results)
}

// ============================================================================
// Orphan detection
// ============================================================================

/// Get Xtream streams that have no mapping to any XMLTV channel.
pub fn get_orphan_xtream_streams(
    conn: &mut SqliteConnection,
) -> Result<Vec<XtreamStreamSearchResult>, String> {
    // All xtream channel IDs that appear in mappings
    let mapped_ids: Vec<Option<i32>> = channel_mappings::table
        .select(channel_mappings::xtream_channel_id)
        .filter(channel_mappings::xtream_channel_id.is_not_null())
        .distinct()
        .load::<Option<i32>>(conn)
        .map_err(|e| format!("Failed to load mapped IDs: {}", e))?;

    let mapped_ids: Vec<i32> = mapped_ids.into_iter().flatten().collect();

    let mapped_ids_nullable: Vec<Option<i32>> = mapped_ids.into_iter().map(Some).collect();

    let orphans: Vec<XtreamChannel> = if mapped_ids_nullable.is_empty() {
        xtream_channels::table
            .order_by(xtream_channels::name.asc())
            .load::<XtreamChannel>(conn)
            .map_err(|e| format!("Failed to load Xtream channels: {}", e))?
    } else {
        xtream_channels::table
            .filter(
                xtream_channels::id
                    .is_not_null()
                    .and(diesel::dsl::not(xtream_channels::id.eq_any(&mapped_ids_nullable))),
            )
            .order_by(xtream_channels::name.asc())
            .load::<XtreamChannel>(conn)
            .map_err(|e| format!("Failed to load orphan Xtream channels: {}", e))?
    };

    let result = orphans
        .into_iter()
        .filter_map(|stream| {
            let stream_id = stream.id?;
            Some(XtreamStreamSearchResult {
                id: stream_id,
                stream_id: stream.stream_id,
                name: stream.name,
                stream_icon: stream.stream_icon,
                qualities: parse_qualities(&stream.qualities),
                category_name: stream.category_name,
                matched_to_xmltv_ids: vec![],
                fuzzy_score: None,
            })
        })
        .collect();

    Ok(result)
}

/// Orphan M3U channel info.
#[derive(serde::Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OrphanM3uChannel {
    pub id: i32,
    pub name: String,
    pub stream_url: String,
    pub tvg_logo: Option<String>,
    pub group_title: Option<String>,
}

/// Get M3U channels that have no mapping to any XMLTV channel.
pub fn get_orphan_m3u_channels(
    conn: &mut SqliteConnection,
) -> Result<Vec<OrphanM3uChannel>, String> {
    use crate::db::schema::m3u_channels;

    let mapped_ids: Vec<Option<i32>> = channel_mappings::table
        .select(channel_mappings::m3u_channel_id)
        .filter(channel_mappings::m3u_channel_id.is_not_null())
        .distinct()
        .load::<Option<i32>>(conn)
        .map_err(|e| format!("Failed to load mapped M3U IDs: {}", e))?;

    let mapped_ids: Vec<i32> = mapped_ids.into_iter().flatten().collect();

    let mapped_ids_nullable: Vec<Option<i32>> = mapped_ids.into_iter().map(Some).collect();

    let orphans: Vec<crate::db::models::M3uChannel> = if mapped_ids_nullable.is_empty() {
        m3u_channels::table
            .order_by(m3u_channels::name.asc())
            .load(conn)
            .map_err(|e| format!("Failed to load M3U channels: {}", e))?
    } else {
        m3u_channels::table
            .filter(
                m3u_channels::id
                    .is_not_null()
                    .and(diesel::dsl::not(m3u_channels::id.eq_any(&mapped_ids_nullable))),
            )
            .order_by(m3u_channels::name.asc())
            .load(conn)
            .map_err(|e| format!("Failed to load orphan M3U channels: {}", e))?
    };

    let result = orphans
        .into_iter()
        .filter_map(|ch| {
            Some(OrphanM3uChannel {
                id: ch.id?,
                name: ch.name,
                stream_url: ch.stream_url,
                tvg_logo: ch.tvg_logo,
                group_title: ch.group_title,
            })
        })
        .collect();

    Ok(result)
}

/// Orphan Acestream source info.
#[derive(serde::Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OrphanAcestreamSource {
    pub id: i32,
    pub name: String,
    pub content_id: String,
}

/// Get Acestream sources that have no mapping to any XMLTV channel.
pub fn get_orphan_acestream_sources(
    conn: &mut SqliteConnection,
) -> Result<Vec<OrphanAcestreamSource>, String> {
    use crate::db::schema::acestream_sources;

    let mapped_ids: Vec<Option<i32>> = channel_mappings::table
        .select(channel_mappings::acestream_source_id)
        .filter(channel_mappings::acestream_source_id.is_not_null())
        .distinct()
        .load::<Option<i32>>(conn)
        .map_err(|e| format!("Failed to load mapped Acestream IDs: {}", e))?;

    let mapped_ids: Vec<i32> = mapped_ids.into_iter().flatten().collect();

    let mapped_ids_nullable: Vec<Option<i32>> = mapped_ids.into_iter().map(Some).collect();

    let orphans: Vec<crate::db::models::AcestreamSource> = if mapped_ids_nullable.is_empty() {
        acestream_sources::table
            .order_by(acestream_sources::name.asc())
            .load(conn)
            .map_err(|e| format!("Failed to load Acestream sources: {}", e))?
    } else {
        acestream_sources::table
            .filter(
                acestream_sources::id
                    .is_not_null()
                    .and(diesel::dsl::not(acestream_sources::id.eq_any(&mapped_ids_nullable))),
            )
            .order_by(acestream_sources::name.asc())
            .load(conn)
            .map_err(|e| format!("Failed to load orphan Acestream sources: {}", e))?
    };

    let result = orphans
        .into_iter()
        .filter_map(|src| {
            Some(OrphanAcestreamSource {
                id: src.id?,
                name: src.name,
                content_id: src.content_id,
            })
        })
        .collect();

    Ok(result)
}

// ============================================================================
// Promote orphans to synthetic channels
// ============================================================================

/// Promote an orphan Xtream stream to a synthetic XMLTV channel.
///
/// Creates a synthetic XMLTV channel, enables it, and maps the Xtream stream
/// as the primary source.
pub fn promote_orphan_to_plex(
    conn: &mut SqliteConnection,
    xtream_channel_id: i32,
    display_name: &str,
    icon_url: Option<&str>,
) -> Result<XmltvChannelWithMappings, String> {
    if xtream_channel_id <= 0 {
        return Err("Invalid Xtream channel ID".to_string());
    }
    if display_name.trim().is_empty() {
        return Err("Display name is required".to_string());
    }

    conn.transaction(|conn| {
        // Create synthetic XMLTV channel
        let channel_id_str = format!("synthetic-xtream-{}", xtream_channel_id);
        let new_channel = NewXmltvChannel::synthetic(
            SYNTHETIC_SOURCE_ID,
            &channel_id_str,
            display_name,
            icon_url.map(|s| s.to_string()),
        );

        diesel::insert_into(xmltv_channels::table)
            .values(&new_channel)
            .execute(conn)?;

        let channel: XmltvChannel = xmltv_channels::table
            .filter(xmltv_channels::channel_id.eq(&channel_id_str))
            .first::<XmltvChannel>(conn)?;

        let xmltv_id = channel.id.ok_or_else(|| {
            diesel::result::Error::NotFound
        })?;

        // Create settings (enabled by default for promoted channels)
        let settings = NewXmltvChannelSettings::enabled(xmltv_id);
        diesel::insert_into(xmltv_channel_settings::table)
            .values(&settings)
            .execute(conn)?;

        // Create mapping to the Xtream stream as primary
        let mapping = NewChannelMapping::manual(xmltv_id, xtream_channel_id)
            .with_primary(true)
            .with_priority(0);
        diesel::insert_into(channel_mappings::table)
            .values(&mapping)
            .execute(conn)?;

        Ok(XmltvChannelWithMappings {
            id: xmltv_id,
            source_id: SYNTHETIC_SOURCE_ID,
            channel_id: channel_id_str,
            display_name: display_name.to_string(),
            icon: icon_url.map(|s| s.to_string()),
            is_synthetic: true,
            is_enabled: true,
            plex_display_order: None,
            match_count: 1,
            matches: vec![],  // Caller can reload if needed
        })
    })
    .map_err(|e: diesel::result::Error| format!("Failed to promote orphan Xtream stream: {}", e))
}

/// Promote an orphan M3U channel to a synthetic XMLTV channel.
pub fn promote_m3u_orphan_to_plex(
    conn: &mut SqliteConnection,
    m3u_channel_id: i32,
    display_name: &str,
    icon_url: Option<&str>,
) -> Result<XmltvChannelWithMappings, String> {
    if m3u_channel_id <= 0 {
        return Err("Invalid M3U channel ID".to_string());
    }
    if display_name.trim().is_empty() {
        return Err("Display name is required".to_string());
    }

    conn.transaction(|conn| {
        let channel_id_str = format!("synthetic-m3u-{}", m3u_channel_id);
        let new_channel = NewXmltvChannel::synthetic(
            SYNTHETIC_SOURCE_ID,
            &channel_id_str,
            display_name,
            icon_url.map(|s| s.to_string()),
        );

        diesel::insert_into(xmltv_channels::table)
            .values(&new_channel)
            .execute(conn)?;

        let channel: XmltvChannel = xmltv_channels::table
            .filter(xmltv_channels::channel_id.eq(&channel_id_str))
            .first::<XmltvChannel>(conn)?;

        let xmltv_id = channel.id.ok_or_else(|| diesel::result::Error::NotFound)?;

        let settings = NewXmltvChannelSettings::enabled(xmltv_id);
        diesel::insert_into(xmltv_channel_settings::table)
            .values(&settings)
            .execute(conn)?;

        let mapping = NewChannelMapping::m3u_manual(xmltv_id, m3u_channel_id)
            .with_primary(true)
            .with_priority(0);
        diesel::insert_into(channel_mappings::table)
            .values(&mapping)
            .execute(conn)?;

        Ok(XmltvChannelWithMappings {
            id: xmltv_id,
            source_id: SYNTHETIC_SOURCE_ID,
            channel_id: channel_id_str,
            display_name: display_name.to_string(),
            icon: icon_url.map(|s| s.to_string()),
            is_synthetic: true,
            is_enabled: true,
            plex_display_order: None,
            match_count: 1,
            matches: vec![],
        })
    })
    .map_err(|e: diesel::result::Error| format!("Failed to promote orphan M3U channel: {}", e))
}

/// Promote an orphan Acestream source to a synthetic XMLTV channel.
pub fn promote_acestream_orphan_to_plex(
    conn: &mut SqliteConnection,
    acestream_source_id: i32,
    display_name: &str,
    icon_url: Option<&str>,
) -> Result<XmltvChannelWithMappings, String> {
    if acestream_source_id <= 0 {
        return Err("Invalid Acestream source ID".to_string());
    }
    if display_name.trim().is_empty() {
        return Err("Display name is required".to_string());
    }

    conn.transaction(|conn| {
        let channel_id_str = format!("synthetic-acestream-{}", acestream_source_id);
        let new_channel = NewXmltvChannel::synthetic(
            SYNTHETIC_SOURCE_ID,
            &channel_id_str,
            display_name,
            icon_url.map(|s| s.to_string()),
        );

        diesel::insert_into(xmltv_channels::table)
            .values(&new_channel)
            .execute(conn)?;

        let channel: XmltvChannel = xmltv_channels::table
            .filter(xmltv_channels::channel_id.eq(&channel_id_str))
            .first::<XmltvChannel>(conn)?;

        let xmltv_id = channel.id.ok_or_else(|| diesel::result::Error::NotFound)?;

        let settings = NewXmltvChannelSettings::enabled(xmltv_id);
        diesel::insert_into(xmltv_channel_settings::table)
            .values(&settings)
            .execute(conn)?;

        let mapping = NewChannelMapping::acestream_manual(xmltv_id, acestream_source_id)
            .with_primary(true)
            .with_priority(0);
        diesel::insert_into(channel_mappings::table)
            .values(&mapping)
            .execute(conn)?;

        Ok(XmltvChannelWithMappings {
            id: xmltv_id,
            source_id: SYNTHETIC_SOURCE_ID,
            channel_id: channel_id_str,
            display_name: display_name.to_string(),
            icon: icon_url.map(|s| s.to_string()),
            is_synthetic: true,
            is_enabled: true,
            plex_display_order: None,
            match_count: 1,
            matches: vec![],
        })
    })
    .map_err(|e: diesel::result::Error| format!("Failed to promote orphan Acestream source: {}", e))
}

/// Update a synthetic channel's display name and icon.
///
/// Only works for channels where `is_synthetic = 1`.
pub fn update_synthetic_channel(
    conn: &mut SqliteConnection,
    channel_id: i32,
    display_name: &str,
    icon_url: Option<&str>,
) -> Result<XmltvChannelWithMappings, String> {
    if channel_id <= 0 {
        return Err("Invalid channel ID".to_string());
    }
    if display_name.trim().is_empty() {
        return Err("Display name is required".to_string());
    }

    // Verify the channel exists and is synthetic
    let channel: XmltvChannel = xmltv_channels::table
        .filter(xmltv_channels::id.eq(channel_id))
        .first::<XmltvChannel>(conn)
        .map_err(|_| format!("Channel {} not found", channel_id))?;

    if channel.is_synthetic.unwrap_or(0) != 1 {
        return Err("Only synthetic channels can be updated via this endpoint".to_string());
    }

    // Update the channel
    diesel::update(xmltv_channels::table.filter(xmltv_channels::id.eq(channel_id)))
        .set((
            xmltv_channels::display_name.eq(display_name),
            xmltv_channels::icon.eq(icon_url),
        ))
        .execute(conn)
        .map_err(|e| format!("Failed to update synthetic channel: {}", e))?;

    // Load settings
    let settings: Option<XmltvChannelSettings> = xmltv_channel_settings::table
        .filter(xmltv_channel_settings::xmltv_channel_id.eq(channel_id))
        .first::<XmltvChannelSettings>(conn)
        .optional()
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    let is_enabled = settings
        .as_ref()
        .map(|s| s.is_enabled.unwrap_or(0) != 0)
        .unwrap_or(false);
    let plex_display_order = settings.as_ref().and_then(|s| s.plex_display_order);

    Ok(XmltvChannelWithMappings {
        id: channel_id,
        source_id: channel.source_id,
        channel_id: channel.channel_id,
        display_name: display_name.to_string(),
        icon: icon_url.map(|s| s.to_string()),
        is_synthetic: true,
        is_enabled,
        plex_display_order,
        match_count: 0,
        matches: vec![],
    })
}

// ============================================================================
// Internal helpers
// ============================================================================

/// Load all mappings (xtream, m3u, acestream) for a channel.
fn load_all_channel_mappings(
    conn: &mut SqliteConnection,
    xmltv_channel_id: i32,
) -> Result<AllChannelMappings, diesel::result::Error> {
    use crate::db::schema::{acestream_sources, m3u_channels};

    // Load Xtream mappings
    let xtream_mappings: Vec<(ChannelMapping, XtreamChannel)> = channel_mappings::table
        .inner_join(xtream_channels::table)
        .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
        .filter(channel_mappings::source_type.eq("xtream"))
        .order_by(channel_mappings::stream_priority.asc())
        .load::<(ChannelMapping, XtreamChannel)>(conn)?;

    let xtream_matches: Vec<XtreamStreamMatch> = xtream_mappings
        .iter()
        .filter_map(|(mapping, stream)| build_stream_match(mapping, stream))
        .collect();

    // Load M3U mappings
    let m3u_mappings: Vec<(ChannelMapping, crate::db::models::M3uChannel)> =
        channel_mappings::table
            .inner_join(
                m3u_channels::table
                    .on(channel_mappings::m3u_channel_id.eq(m3u_channels::id.nullable())),
            )
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .filter(channel_mappings::source_type.eq("m3u"))
            .filter(channel_mappings::m3u_channel_id.is_not_null())
            .order_by(channel_mappings::stream_priority.asc())
            .load::<(ChannelMapping, crate::db::models::M3uChannel)>(conn)?;

    let m3u_matches: Vec<M3uStreamMatch> = m3u_mappings
        .iter()
        .filter_map(|(mapping, channel)| {
            Some(M3uStreamMatch {
                id: channel.id?,
                mapping_id: mapping.id?,
                name: channel.name.clone(),
                stream_url: channel.stream_url.clone(),
                tvg_logo: channel.tvg_logo.clone(),
                group_title: channel.group_title.clone(),
                is_primary: mapping.is_primary.unwrap_or(0) != 0,
                stream_priority: mapping.stream_priority.unwrap_or(0),
            })
        })
        .collect();

    // Load Acestream mappings
    let acestream_mappings: Vec<(ChannelMapping, crate::db::models::AcestreamSource)> =
        channel_mappings::table
            .inner_join(
                acestream_sources::table.on(
                    channel_mappings::acestream_source_id.eq(acestream_sources::id.nullable()),
                ),
            )
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .filter(channel_mappings::source_type.eq("acestream"))
            .filter(channel_mappings::acestream_source_id.is_not_null())
            .order_by(channel_mappings::stream_priority.asc())
            .load::<(ChannelMapping, crate::db::models::AcestreamSource)>(conn)?;

    let acestream_matches: Vec<AcestreamMatch> = acestream_mappings
        .iter()
        .filter_map(|(mapping, source)| {
            Some(AcestreamMatch {
                id: source.id?,
                mapping_id: mapping.id?,
                name: source.name.clone(),
                content_id: source.content_id.clone(),
                is_primary: mapping.is_primary.unwrap_or(0) != 0,
                stream_priority: mapping.stream_priority.unwrap_or(0),
            })
        })
        .collect();

    Ok(AllChannelMappings {
        xmltv_channel_id,
        xtream_matches,
        m3u_matches,
        acestream_matches,
    })
}
