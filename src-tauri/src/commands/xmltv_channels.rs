//! XMLTV Channel Display Commands
//!
//! Tauri commands for displaying XMLTV channels with their matched Xtream streams.
//! Story 3-2: Display XMLTV Channel List with Match Status

use diesel::prelude::*;
use serde::Serialize;
use tauri::State;

use crate::db::models::{ChannelMapping, XmltvChannel, XmltvChannelSettings, XtreamChannel};
use crate::db::schema::{channel_mappings, xmltv_channel_settings, xmltv_channels, xtream_channels};
use crate::db::DbConnection;

/// Xtream stream match info for display
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct XtreamStreamMatch {
    pub id: i32,
    pub mapping_id: i32,
    pub name: String,
    pub stream_icon: Option<String>,
    pub qualities: Vec<String>,
    pub match_confidence: f64,
    pub is_primary: bool,
    pub is_manual: bool,
    pub stream_priority: i32,
}

/// XMLTV channel with all mapping info for display
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct XmltvChannelWithMappings {
    pub id: i32,
    pub source_id: i32,
    pub channel_id: String,
    pub display_name: String,
    pub icon: Option<String>,
    pub is_synthetic: bool,
    // Settings
    pub is_enabled: bool,
    pub plex_display_order: Option<i32>,
    // Matches
    pub match_count: i32,
    pub matches: Vec<XtreamStreamMatch>,
}

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

    // Load all mappings with their Xtream channel info
    let mappings_with_streams: Vec<(ChannelMapping, XtreamChannel)> = channel_mappings::table
        .inner_join(xtream_channels::table)
        .order_by((
            channel_mappings::xmltv_channel_id.asc(),
            channel_mappings::stream_priority.asc(),
        ))
        .load::<(ChannelMapping, XtreamChannel)>(&mut conn)
        .map_err(|e| format!("Failed to load channel mappings: {}", e))?;

    // Group mappings by XMLTV channel ID
    let mut mappings_map: std::collections::HashMap<i32, Vec<(ChannelMapping, XtreamChannel)>> =
        std::collections::HashMap::new();

    for (mapping, stream) in mappings_with_streams {
        mappings_map
            .entry(mapping.xmltv_channel_id)
            .or_default()
            .push((mapping, stream));
    }

    // Build result list
    let result: Vec<XmltvChannelWithMappings> = channels
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

            // Build matches list
            let matches: Vec<XtreamStreamMatch> = channel_mappings
                .map(|mappings| {
                    mappings
                        .iter()
                        .filter_map(|(mapping, stream)| {
                            Some(XtreamStreamMatch {
                                id: stream.id?,
                                mapping_id: mapping.id?,
                                name: stream.name.clone(),
                                stream_icon: stream.stream_icon.clone(),
                                qualities: parse_qualities(&stream.qualities),
                                match_confidence: mapping.match_confidence.unwrap_or(0.0) as f64,
                                is_primary: mapping.is_primary.unwrap_or(0) != 0,
                                is_manual: mapping.is_manual.unwrap_or(0) != 0,
                                stream_priority: mapping.stream_priority.unwrap_or(0),
                            })
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
                // TODO: is_synthetic field not in DB schema yet - defaults to false
                is_synthetic: false,
                is_enabled,
                plex_display_order,
                match_count: matches.len() as i32,
                matches,
            })
        })
        .collect();

    Ok(result)
}

/// Parse qualities string (JSON array or comma-separated) into Vec<String>
fn parse_qualities(qualities: &Option<String>) -> Vec<String> {
    match qualities {
        Some(q) if !q.is_empty() => {
            // Try parsing as JSON array first
            if let Ok(parsed) = serde_json::from_str::<Vec<String>>(q) {
                return parsed;
            }
            // Fall back to comma-separated
            q.split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        }
        _ => Vec::new(),
    }
}

/// Set the primary stream for an XMLTV channel.
///
/// Updates the channel mappings so that:
/// - The specified stream becomes the primary (is_primary = true, stream_priority = 0)
/// - All other streams become backup (is_primary = false, stream_priority = 1+)
///
/// # Arguments
///
/// * `xmltv_channel_id` - The XMLTV channel ID
/// * `xtream_channel_id` - The Xtream stream ID to make primary
///
/// # Returns
///
/// Updated list of matches for the XMLTV channel
#[tauri::command]
pub fn set_primary_stream(
    db: State<DbConnection>,
    xmltv_channel_id: i32,
    xtream_channel_id: i32,
) -> Result<Vec<XtreamStreamMatch>, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    // Run in transaction
    conn.transaction(|conn| {
        // Load all current mappings to preserve original priority order
        let mut all_mappings: Vec<ChannelMapping> = channel_mappings::table
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .order_by(channel_mappings::stream_priority.asc())
            .load::<ChannelMapping>(conn)?;

        // Find the mapping that should become primary
        let new_primary_idx = all_mappings
            .iter()
            .position(|m| m.xtream_channel_id == xtream_channel_id)
            .ok_or_else(|| diesel::result::Error::NotFound)?;

        // Update priorities: new primary gets 0, others shift by 1
        for (idx, mapping) in all_mappings.iter_mut().enumerate() {
            let mapping_id = mapping.id.ok_or(diesel::result::Error::NotFound)?;

            if idx == new_primary_idx {
                // Set as primary with priority 0
                diesel::update(
                    channel_mappings::table.filter(channel_mappings::id.eq(Some(mapping_id)))
                )
                .set((
                    channel_mappings::is_primary.eq(1),
                    channel_mappings::stream_priority.eq(0),
                ))
                .execute(conn)?;
            } else {
                // Set as backup with priority based on original order
                let new_priority = if idx < new_primary_idx { idx + 1 } else { idx };
                diesel::update(
                    channel_mappings::table.filter(channel_mappings::id.eq(Some(mapping_id)))
                )
                .set((
                    channel_mappings::is_primary.eq(0),
                    channel_mappings::stream_priority.eq(new_priority as i32),
                ))
                .execute(conn)?;
            }
        }

        // Load and return updated mappings
        let mappings: Vec<(ChannelMapping, XtreamChannel)> = channel_mappings::table
            .inner_join(xtream_channels::table)
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .order_by(channel_mappings::stream_priority.asc())
            .load::<(ChannelMapping, XtreamChannel)>(conn)?;

        let result: Vec<XtreamStreamMatch> = mappings
            .into_iter()
            .filter_map(|(mapping, stream)| {
                Some(XtreamStreamMatch {
                    id: stream.id?,
                    mapping_id: mapping.id?,
                    name: stream.name,
                    stream_icon: stream.stream_icon,
                    qualities: parse_qualities(&stream.qualities),
                    match_confidence: mapping.match_confidence.unwrap_or(0.0) as f64,
                    is_primary: mapping.is_primary.unwrap_or(0) != 0,
                    is_manual: mapping.is_manual.unwrap_or(0) != 0,
                    stream_priority: mapping.stream_priority.unwrap_or(0),
                })
            })
            .collect();

        Ok(result)
    })
    .map_err(|e: diesel::result::Error| format!("Failed to update primary stream: {}", e))
}

// ============================================================================
// Story 3-3: Manual Match Override via Search Dropdown
// ============================================================================

/// Xtream stream info for search dropdown
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct XtreamStreamSearchResult {
    pub id: i32,
    pub stream_id: i32,
    pub name: String,
    pub stream_icon: Option<String>,
    pub qualities: Vec<String>,
    pub category_name: Option<String>,
    /// List of XMLTV channel IDs this stream is already matched to
    pub matched_to_xmltv_ids: Vec<i32>,
}

/// Get all Xtream streams for the search dropdown.
///
/// Returns a list of all Xtream streams with:
/// - Stream info (name, icon, qualities, category)
/// - List of XMLTV channel IDs this stream is already matched to
///
/// # Returns
///
/// List of Xtream streams with their current mappings
#[tauri::command]
pub fn get_all_xtream_streams(
    db: State<DbConnection>,
) -> Result<Vec<XtreamStreamSearchResult>, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    // Load all Xtream channels
    let streams: Vec<XtreamChannel> = xtream_channels::table
        .order_by(xtream_channels::name.asc())
        .load::<XtreamChannel>(&mut conn)
        .map_err(|e| format!("Failed to load Xtream channels: {}", e))?;

    // Load all mappings to build the matched_to_xmltv_ids lookup
    let mappings: Vec<ChannelMapping> = channel_mappings::table
        .load::<ChannelMapping>(&mut conn)
        .map_err(|e| format!("Failed to load channel mappings: {}", e))?;

    // Build map of xtream_channel_id -> list of xmltv_channel_ids
    let mut mappings_map: std::collections::HashMap<i32, Vec<i32>> =
        std::collections::HashMap::new();

    for mapping in mappings {
        mappings_map
            .entry(mapping.xtream_channel_id)
            .or_default()
            .push(mapping.xmltv_channel_id);
    }

    // Build result list
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
            })
        })
        .collect();

    Ok(result)
}

/// Add a manual stream mapping between an XMLTV channel and an Xtream stream.
///
/// Creates a channel_mapping with:
/// - `is_manual` = true
/// - `match_confidence` = 1.0 (manual match)
///
/// # Arguments
///
/// * `xmltv_channel_id` - The XMLTV channel ID
/// * `xtream_channel_id` - The Xtream stream ID to map
/// * `set_as_primary` - Whether to set this stream as the primary stream
///
/// # Returns
///
/// The updated list of matches for the XMLTV channel
#[tauri::command]
pub fn add_manual_stream_mapping(
    db: State<DbConnection>,
    xmltv_channel_id: i32,
    xtream_channel_id: i32,
    set_as_primary: bool,
) -> Result<Vec<XtreamStreamMatch>, String> {
    // Validate input
    if xmltv_channel_id <= 0 {
        return Err("Invalid XMLTV channel ID".to_string());
    }
    if xtream_channel_id <= 0 {
        return Err("Invalid Xtream channel ID".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

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

        // If setting as primary, update all existing mappings to non-primary and shift priorities
        // This must be done BEFORE calculating new_priority to avoid race conditions
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

        // Get current max stream_priority AFTER shifting (prevents race condition)
        // This ensures we calculate the correct priority even if priorities were just shifted
        let max_priority: Option<i32> = channel_mappings::table
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .select(diesel::dsl::max(channel_mappings::stream_priority))
            .first::<Option<i32>>(conn)?;

        let new_priority = if set_as_primary {
            0  // Primary always gets priority 0
        } else {
            max_priority.unwrap_or(-1) + 1  // Backups get next available priority
        };

        // Insert the new mapping
        let new_mapping = crate::db::models::NewChannelMapping {
            xmltv_channel_id,
            xtream_channel_id,
            match_confidence: Some(1.0), // Manual match = 100% confidence
            is_manual: 1,
            is_primary: if set_as_primary { 1 } else { 0 },
            stream_priority: new_priority,  // Use calculated priority (already accounts for primary/backup)
        };

        diesel::insert_into(channel_mappings::table)
            .values(&new_mapping)
            .execute(conn)?;

        // Load and return updated mappings
        let mappings: Vec<(ChannelMapping, XtreamChannel)> = channel_mappings::table
            .inner_join(xtream_channels::table)
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .order_by(channel_mappings::stream_priority.asc())
            .load::<(ChannelMapping, XtreamChannel)>(conn)?;

        let result: Vec<XtreamStreamMatch> = mappings
            .into_iter()
            .filter_map(|(mapping, stream)| {
                Some(XtreamStreamMatch {
                    id: stream.id?,
                    mapping_id: mapping.id?,
                    name: stream.name,
                    stream_icon: stream.stream_icon,
                    qualities: parse_qualities(&stream.qualities),
                    match_confidence: mapping.match_confidence.unwrap_or(0.0) as f64,
                    is_primary: mapping.is_primary.unwrap_or(0) != 0,
                    is_manual: mapping.is_manual.unwrap_or(0) != 0,
                    stream_priority: mapping.stream_priority.unwrap_or(0),
                })
            })
            .collect();

        Ok(result)
    })
    .map_err(|e: diesel::result::Error| {
        if let diesel::result::Error::DatabaseError(diesel::result::DatabaseErrorKind::UniqueViolation, _) = e {
            "This stream is already mapped to this channel".to_string()
        } else {
            format!("Failed to add manual stream mapping: {}", e)
        }
    })
}

/// Remove a stream mapping.
///
/// If the deleted mapping was primary, promotes the next highest confidence match to primary.
///
/// # Arguments
///
/// * `mapping_id` - The mapping ID to remove
///
/// # Returns
///
/// The updated list of matches for the XMLTV channel (or empty if no matches remain)
#[tauri::command]
pub fn remove_stream_mapping(
    db: State<DbConnection>,
    mapping_id: i32,
) -> Result<Vec<XtreamStreamMatch>, String> {
    // Validate input
    if mapping_id <= 0 {
        return Err("Invalid mapping ID".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    conn.transaction(|conn| {
        // Find the mapping to delete
        let mapping: ChannelMapping = channel_mappings::table
            .filter(channel_mappings::id.eq(Some(mapping_id)))
            .first::<ChannelMapping>(conn)
            .map_err(|_| diesel::result::Error::NotFound)?;

        let xmltv_channel_id = mapping.xmltv_channel_id;
        let was_primary = mapping.is_primary.unwrap_or(0) != 0;

        // Delete the mapping
        diesel::delete(
            channel_mappings::table.filter(channel_mappings::id.eq(Some(mapping_id))),
        )
        .execute(conn)?;

        // If deleted mapping was primary, promote next highest confidence to primary
        if was_primary {
            // Find the mapping with highest confidence among remaining
            let next_primary: Option<ChannelMapping> = channel_mappings::table
                .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
                .order_by(channel_mappings::match_confidence.desc())
                .first::<ChannelMapping>(conn)
                .optional()?;

            if let Some(new_primary) = next_primary {
                if let Some(new_primary_id) = new_primary.id {
                    diesel::update(
                        channel_mappings::table.filter(channel_mappings::id.eq(Some(new_primary_id))),
                    )
                    .set((
                        channel_mappings::is_primary.eq(1),
                        channel_mappings::stream_priority.eq(0),
                    ))
                    .execute(conn)?;
                }
            }
        }

        // Recalculate priorities for remaining mappings
        // Primary gets 0, backups get sequential priorities 1, 2, 3...
        let remaining_mappings: Vec<ChannelMapping> = channel_mappings::table
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .order_by(channel_mappings::match_confidence.desc())
            .load::<ChannelMapping>(conn)?;

        let mut backup_priority = 1;  // Start backups at priority 1
        for mapping in remaining_mappings.iter() {
            if let Some(mid) = mapping.id {
                let is_primary = mapping.is_primary.unwrap_or(0) != 0;
                let priority = if is_primary {
                    0  // Primary always gets priority 0
                } else {
                    let p = backup_priority;
                    backup_priority += 1;  // Increment for next backup
                    p
                };
                diesel::update(
                    channel_mappings::table.filter(channel_mappings::id.eq(Some(mid))),
                )
                .set(channel_mappings::stream_priority.eq(priority))
                .execute(conn)?;
            }
        }

        // Load and return updated mappings
        let mappings: Vec<(ChannelMapping, XtreamChannel)> = channel_mappings::table
            .inner_join(xtream_channels::table)
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .order_by(channel_mappings::stream_priority.asc())
            .load::<(ChannelMapping, XtreamChannel)>(conn)?;

        let result: Vec<XtreamStreamMatch> = mappings
            .into_iter()
            .filter_map(|(mapping, stream)| {
                Some(XtreamStreamMatch {
                    id: stream.id?,
                    mapping_id: mapping.id?,
                    name: stream.name,
                    stream_icon: stream.stream_icon,
                    qualities: parse_qualities(&stream.qualities),
                    match_confidence: mapping.match_confidence.unwrap_or(0.0) as f64,
                    is_primary: mapping.is_primary.unwrap_or(0) != 0,
                    is_manual: mapping.is_manual.unwrap_or(0) != 0,
                    stream_priority: mapping.stream_priority.unwrap_or(0),
                })
            })
            .collect();

        Ok(result)
    })
    .map_err(|e: diesel::result::Error| format!("Failed to remove stream mapping: {}", e))
}

/// Toggle the enabled status of an XMLTV channel.
///
/// # Arguments
///
/// * `channel_id` - The XMLTV channel ID
///
/// # Returns
///
/// The updated channel with mappings
#[tauri::command]
pub fn toggle_xmltv_channel(
    db: State<DbConnection>,
    channel_id: i32,
) -> Result<XmltvChannelWithMappings, String> {
    use crate::db::models::NewXmltvChannelSettings;

    // Validate input
    if channel_id <= 0 {
        return Err("Invalid channel ID".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    conn.transaction::<_, diesel::result::Error, _>(|conn| {
        // Check if settings exist
        let existing_settings: Option<XmltvChannelSettings> = xmltv_channel_settings::table
            .filter(xmltv_channel_settings::xmltv_channel_id.eq(channel_id))
            .first::<XmltvChannelSettings>(conn)
            .optional()?;

        let new_enabled = match existing_settings {
            Some(settings) => {
                // Toggle the existing value
                let current = settings.is_enabled.unwrap_or(0);
                let new_value = if current != 0 { 0 } else { 1 };

                diesel::update(
                    xmltv_channel_settings::table
                        .filter(xmltv_channel_settings::xmltv_channel_id.eq(channel_id)),
                )
                .set(xmltv_channel_settings::is_enabled.eq(new_value))
                .execute(conn)?;

                new_value != 0
            }
            None => {
                // Create new settings (default to enabled since we're toggling from no-setting state)
                let new_settings = NewXmltvChannelSettings::enabled(channel_id);
                diesel::insert_into(xmltv_channel_settings::table)
                    .values(&new_settings)
                    .execute(conn)?;

                true
            }
        };

        // Load the channel with mappings
        let channel: XmltvChannel = xmltv_channels::table
            .filter(xmltv_channels::id.eq(channel_id))
            .first::<XmltvChannel>(conn)?;

        // Load mappings
        let mappings: Vec<(ChannelMapping, XtreamChannel)> = channel_mappings::table
            .inner_join(xtream_channels::table)
            .filter(channel_mappings::xmltv_channel_id.eq(channel_id))
            .order_by(channel_mappings::stream_priority.asc())
            .load::<(ChannelMapping, XtreamChannel)>(conn)?;

        // Load updated settings
        let settings: Option<XmltvChannelSettings> = xmltv_channel_settings::table
            .filter(xmltv_channel_settings::xmltv_channel_id.eq(channel_id))
            .first::<XmltvChannelSettings>(conn)
            .optional()?;

        let matches: Vec<XtreamStreamMatch> = mappings
            .into_iter()
            .filter_map(|(mapping, stream)| {
                Some(XtreamStreamMatch {
                    id: stream.id?,
                    mapping_id: mapping.id?,
                    name: stream.name,
                    stream_icon: stream.stream_icon,
                    qualities: parse_qualities(&stream.qualities),
                    match_confidence: mapping.match_confidence.unwrap_or(0.0) as f64,
                    is_primary: mapping.is_primary.unwrap_or(0) != 0,
                    is_manual: mapping.is_manual.unwrap_or(0) != 0,
                    stream_priority: mapping.stream_priority.unwrap_or(0),
                })
            })
            .collect();

        Ok(XmltvChannelWithMappings {
            id: channel.id.ok_or(diesel::result::Error::NotFound)?,
            source_id: channel.source_id,
            channel_id: channel.channel_id,
            display_name: channel.display_name,
            icon: channel.icon,
            // TODO: is_synthetic field not in DB schema yet - defaults to false
            is_synthetic: false,
            is_enabled: new_enabled,
            plex_display_order: settings.and_then(|s| s.plex_display_order),
            match_count: matches.len() as i32,
            matches,
        })
    })
    .map_err(|e| format!("Failed to toggle channel: {}", e))
}
