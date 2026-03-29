//! Shared EPG operations for preserving/restoring channel data during XMLTV refresh
//!
//! These are pure DB operations with no Tauri dependencies, usable from both
//! the Tauri command layer and the background scheduler.

use std::collections::HashMap;

use diesel::prelude::*;

use crate::db::{
    schema::{channel_mappings, xmltv_channel_settings, xmltv_channels},
    ChannelMapping, NewChannelMapping, NewXmltvChannelSettings, XmltvChannel, XmltvChannelSettings,
};

/// Preserved data from XMLTV channels before refresh
///
/// Stores mappings and settings by channel_id (string) so they can be restored
/// after channels are recreated with new database IDs.
///
/// # Usage
/// This struct is used internally by `preserve_channel_data` and `restore_channel_data`.
/// These functions must be called within a database transaction to ensure atomicity.
/// The typical pattern is:
/// 1. `preserve_channel_data()` - save mappings/settings before delete
/// 2. Delete existing channels
/// 3. Insert new channels and build channel_id_map
/// 4. `restore_channel_data()` - restore mappings/settings with new IDs
pub struct PreservedChannelData {
    /// Manual mappings: (channel_id, xtream_channel_id, is_primary, stream_priority)
    pub manual_mappings: Vec<(String, i32, i32, i32)>,
    /// Channel settings: (channel_id, is_enabled, plex_display_order)
    pub settings: Vec<(String, i32, Option<i32>)>,
}

/// Save manual mappings and channel settings before deleting XMLTV channels
pub fn preserve_channel_data(
    conn: &mut diesel::SqliteConnection,
    source_id: i32,
) -> Result<PreservedChannelData, diesel::result::Error> {
    // Get all existing channels for this source with their channel_id
    let existing_channels: Vec<XmltvChannel> = xmltv_channels::table
        .filter(xmltv_channels::source_id.eq(source_id))
        .load(conn)?;

    // Build a map of old db_id -> channel_id for lookup
    let old_id_to_channel_id: HashMap<i32, String> = existing_channels
        .iter()
        .filter_map(|c| c.id.map(|id| (id, c.channel_id.clone())))
        .collect();

    // Save manual mappings (is_manual = 1) with their channel_id
    let mappings: Vec<ChannelMapping> = channel_mappings::table
        .filter(channel_mappings::is_manual.eq(1))
        .load(conn)?;

    // CR-5: Only preserve Xtream manual mappings (xtream_channel_id is Some)
    let manual_mappings: Vec<(String, i32, i32, i32)> = mappings
        .into_iter()
        .filter_map(|m| {
            // Only preserve if xtream_channel_id is Some (Xtream mapping)
            let xtream_id = m.xtream_channel_id?;
            old_id_to_channel_id.get(&m.xmltv_channel_id).map(|channel_id| {
                (
                    channel_id.clone(),
                    xtream_id,
                    m.is_primary.unwrap_or(0),
                    m.stream_priority.unwrap_or(0),
                )
            })
        })
        .collect();

    // Save channel settings with their channel_id
    let all_settings: Vec<XmltvChannelSettings> = xmltv_channel_settings::table.load(conn)?;

    let settings: Vec<(String, i32, Option<i32>)> = all_settings
        .into_iter()
        .filter_map(|s| {
            old_id_to_channel_id.get(&s.xmltv_channel_id).map(|channel_id| {
                (
                    channel_id.clone(),
                    s.is_enabled.unwrap_or(0),
                    s.plex_display_order,
                )
            })
        })
        .collect();

    Ok(PreservedChannelData {
        manual_mappings,
        settings,
    })
}

/// Restore manual mappings and channel settings after inserting new XMLTV channels
pub fn restore_channel_data(
    conn: &mut diesel::SqliteConnection,
    preserved: &PreservedChannelData,
    channel_id_map: &HashMap<String, i32>,
) -> Result<(), diesel::result::Error> {
    // Restore manual mappings
    for (channel_id, xtream_channel_id, is_primary, stream_priority) in &preserved.manual_mappings {
        if let Some(&new_xmltv_id) = channel_id_map.get(channel_id) {
            let new_mapping = NewChannelMapping::manual(new_xmltv_id, *xtream_channel_id)
                .with_primary(*is_primary == 1)
                .with_priority(*stream_priority);

            diesel::insert_into(channel_mappings::table)
                .values(&new_mapping)
                .execute(conn)?;
        }
    }

    // Restore channel settings
    for (channel_id, is_enabled, plex_display_order) in &preserved.settings {
        if let Some(&new_xmltv_id) = channel_id_map.get(channel_id) {
            let mut new_settings = NewXmltvChannelSettings::new(new_xmltv_id, *is_enabled == 1);
            if let Some(order) = plex_display_order {
                new_settings = new_settings.with_display_order(*order);
            }

            diesel::insert_into(xmltv_channel_settings::table)
                .values(&new_settings)
                .execute(conn)?;
        }
    }

    Ok(())
}
