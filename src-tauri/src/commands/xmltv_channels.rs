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

            // Get settings (default to disabled if no matches)
            let settings = settings_map.get(&channel_id);
            let channel_mappings = mappings_map.get(&channel_id);
            let has_matches = channel_mappings.map(|m| !m.is_empty()).unwrap_or(false);

            // Default is_enabled based on whether channel has matches
            let is_enabled = settings
                .map(|s| s.is_enabled.unwrap_or(0) != 0)
                .unwrap_or(has_matches);

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
                is_synthetic: false, // XMLTV channels from sources are not synthetic
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
        // First, set all mappings for this XMLTV channel to non-primary
        diesel::update(
            channel_mappings::table
                .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id)),
        )
        .set((
            channel_mappings::is_primary.eq(0),
            channel_mappings::stream_priority.eq(channel_mappings::stream_priority + 1),
        ))
        .execute(conn)?;

        // Then, set the specified stream as primary
        diesel::update(
            channel_mappings::table
                .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
                .filter(channel_mappings::xtream_channel_id.eq(xtream_channel_id)),
        )
        .set((
            channel_mappings::is_primary.eq(1),
            channel_mappings::stream_priority.eq(0),
        ))
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
                    stream_priority: mapping.stream_priority.unwrap_or(0),
                })
            })
            .collect();

        Ok(result)
    })
    .map_err(|e: diesel::result::Error| format!("Failed to update primary stream: {}", e))
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
            is_synthetic: false,
            is_enabled: new_enabled,
            plex_display_order: settings.and_then(|s| s.plex_display_order),
            match_count: matches.len() as i32,
            matches,
        })
    })
    .map_err(|e| format!("Failed to toggle channel: {}", e))
}
