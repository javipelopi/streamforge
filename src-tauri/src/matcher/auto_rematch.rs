//! Auto-Rematch Module
//!
//! Provides functionality for automatically detecting provider changes and
//! re-matching channels when Xtream providers update their stream list.
//!
//! # Architecture
//!
//! This module follows the XMLTV-first architecture where:
//! - XMLTV channels are the PRIMARY channel list for Plex
//! - Xtream streams are matched TO XMLTV channels as video sources
//! - Manual matches (is_manual = 1) are NEVER auto-changed or removed
//!
//! # Key Functions
//!
//! - `detect_provider_changes`: Compares current streams with database
//! - `auto_rematch_new_streams`: Matches new streams to XMLTV channels
//! - `handle_removed_streams`: Handles streams no longer in provider list
//! - `handle_changed_streams`: Updates changed stream metadata

use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

use super::{fuzzy::match_channels, MatchConfig};
use crate::db::models::{ChannelMapping, NewChannelMapping, XmltvChannel, XtreamChannel};
use crate::db::schema::{channel_mappings, xmltv_channels, xtream_channels};

/// Summary of changes detected in the provider's stream list
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderChanges {
    /// Streams that are new (not previously in database)
    pub new_streams: Vec<XtreamChannel>,
    /// Stream IDs that have been removed from provider
    pub removed_stream_ids: Vec<i32>,
    /// Streams that have changed (same stream_id, different metadata)
    /// Tuple of (old_stream, new_stream)
    pub changed_streams: Vec<ChangedStream>,
}

/// Represents a stream that has changed metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedStream {
    pub old_stream: XtreamChannel,
    pub new_stream: XtreamChannel,
}

/// Result of the auto-rematch operation
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RematchResult {
    /// Number of new mappings created
    pub new_matches_created: i32,
    /// Number of mappings removed (auto-generated only)
    pub mappings_removed: i32,
    /// Number of mappings updated (confidence recalculated)
    pub mappings_updated: i32,
    /// Number of manual matches preserved (not removed)
    pub manual_matches_preserved: i32,
    /// Number of XMLTV channels affected
    pub affected_xmltv_channels: i32,
}

/// Detect changes in the provider's stream list by comparing with database.
///
/// # Arguments
///
/// * `conn` - Database connection
/// * `account_id` - The Xtream account ID
/// * `current_streams` - List of streams from the current scan
///
/// # Returns
///
/// `ProviderChanges` containing new, removed, and changed streams
pub fn detect_provider_changes(
    conn: &mut SqliteConnection,
    account_id: i32,
    current_streams: &[XtreamChannel],
) -> Result<ProviderChanges, diesel::result::Error> {
    // Load existing streams from database
    let existing_streams: Vec<XtreamChannel> = xtream_channels::table
        .filter(xtream_channels::account_id.eq(account_id))
        .load::<XtreamChannel>(conn)?;

    // Build lookup maps
    let existing_by_stream_id: HashMap<i32, XtreamChannel> = existing_streams
        .into_iter()
        .map(|s| (s.stream_id, s))
        .collect();

    let current_stream_ids: HashSet<i32> = current_streams.iter().map(|s| s.stream_id).collect();

    let mut changes = ProviderChanges::default();

    // Detect new streams (in current but not in existing)
    for stream in current_streams {
        if !existing_by_stream_id.contains_key(&stream.stream_id) {
            changes.new_streams.push(stream.clone());
        }
    }

    // Detect removed streams (in existing but not in current)
    for (stream_id, _) in &existing_by_stream_id {
        if !current_stream_ids.contains(stream_id) {
            changes.removed_stream_ids.push(*stream_id);
        }
    }

    // Detect changed streams (same stream_id but different metadata)
    for stream in current_streams {
        if let Some(existing) = existing_by_stream_id.get(&stream.stream_id) {
            if has_stream_changed(existing, stream) {
                changes.changed_streams.push(ChangedStream {
                    old_stream: existing.clone(),
                    new_stream: stream.clone(),
                });
            }
        }
    }

    Ok(changes)
}

/// Check if a stream's metadata has changed
fn has_stream_changed(old: &XtreamChannel, new: &XtreamChannel) -> bool {
    old.name != new.name
        || old.stream_icon != new.stream_icon
        || old.qualities != new.qualities
}

/// Auto-match new streams to XMLTV channels using fuzzy algorithm.
///
/// New streams are matched as backup streams (not primary) unless the
/// XMLTV channel has no existing matches.
///
/// # Arguments
///
/// * `conn` - Database connection
/// * `new_streams` - List of new Xtream streams to match
/// * `config` - Matching configuration
///
/// # Returns
///
/// Number of new mappings created
pub fn auto_rematch_new_streams(
    conn: &mut SqliteConnection,
    new_streams: &[XtreamChannel],
    config: &MatchConfig,
) -> Result<i32, diesel::result::Error> {
    if new_streams.is_empty() {
        return Ok(0);
    }

    // Load all XMLTV channels
    let xmltv_channels: Vec<XmltvChannel> = xmltv_channels::table
        .load::<XmltvChannel>(conn)?;

    if xmltv_channels.is_empty() {
        return Ok(0);
    }

    // Run fuzzy matching for new streams against all XMLTV channels
    let (matches, _stats) = match_channels(&xmltv_channels, new_streams, config);

    // Load existing mappings to check what already exists
    let existing_mappings: Vec<ChannelMapping> = channel_mappings::table
        .load::<ChannelMapping>(conn)?;

    // Build set of existing (xmltv_id, xtream_id) pairs
    let existing_pairs: HashSet<(i32, i32)> = existing_mappings
        .iter()
        .map(|m| (m.xmltv_channel_id, m.xtream_channel_id))
        .collect();

    // Build map of xmltv_channel_id -> list of mappings
    let mut mappings_by_xmltv: HashMap<i32, Vec<&ChannelMapping>> = HashMap::new();
    for mapping in &existing_mappings {
        mappings_by_xmltv
            .entry(mapping.xmltv_channel_id)
            .or_default()
            .push(mapping);
    }

    let mut new_mappings_to_insert: Vec<NewChannelMapping> = Vec::new();

    for m in &matches {
        // Skip if mapping already exists
        if existing_pairs.contains(&(m.xmltv_channel_id, m.xtream_channel_id)) {
            continue;
        }

        // Determine if this should be primary
        let existing_for_channel = mappings_by_xmltv.get(&m.xmltv_channel_id);
        let has_existing_primary = existing_for_channel
            .map(|mappings| mappings.iter().any(|em| em.is_primary.unwrap_or(0) != 0))
            .unwrap_or(false);

        // Calculate priority
        let max_priority = existing_for_channel
            .map(|mappings| {
                mappings
                    .iter()
                    .filter_map(|em| em.stream_priority)
                    .max()
                    .unwrap_or(-1)
            })
            .unwrap_or(-1);

        let is_primary = !has_existing_primary;
        let stream_priority = if is_primary { 0 } else { max_priority + 1 };

        let new_mapping = NewChannelMapping {
            xmltv_channel_id: m.xmltv_channel_id,
            xtream_channel_id: m.xtream_channel_id,
            match_confidence: Some(m.confidence as f32),
            is_manual: 0, // Auto-generated
            is_primary: if is_primary { 1 } else { 0 },
            stream_priority,
        };

        new_mappings_to_insert.push(new_mapping);

        // Update in-memory tracking for subsequent iterations
        // (We need a new mapping struct to add to our tracking)
    }

    // Insert new mappings in bulk
    let count = new_mappings_to_insert.len() as i32;
    if !new_mappings_to_insert.is_empty() {
        diesel::insert_into(channel_mappings::table)
            .values(&new_mappings_to_insert)
            .execute(conn)?;
    }

    Ok(count)
}

/// Handle removed streams by deleting auto-generated mappings and promoting backups.
///
/// Manual matches (is_manual = 1) are NEVER deleted - only a warning is logged.
///
/// # Arguments
///
/// * `conn` - Database connection
/// * `account_id` - The Xtream account ID
/// * `removed_stream_ids` - List of stream IDs that are no longer available
///
/// # Returns
///
/// Tuple of (mappings_removed, manual_matches_preserved)
pub fn handle_removed_streams(
    conn: &mut SqliteConnection,
    account_id: i32,
    removed_stream_ids: &[i32],
) -> Result<(i32, i32), diesel::result::Error> {
    if removed_stream_ids.is_empty() {
        return Ok((0, 0));
    }

    // Get the database IDs of the removed Xtream channels
    let removed_xtream_ids: Vec<i32> = xtream_channels::table
        .filter(xtream_channels::account_id.eq(account_id))
        .filter(xtream_channels::stream_id.eq_any(removed_stream_ids))
        .select(xtream_channels::id)
        .load::<Option<i32>>(conn)?
        .into_iter()
        .flatten()
        .collect();

    if removed_xtream_ids.is_empty() {
        return Ok((0, 0));
    }

    // Find mappings for the removed streams
    let affected_mappings: Vec<ChannelMapping> = channel_mappings::table
        .filter(channel_mappings::xtream_channel_id.eq_any(&removed_xtream_ids))
        .load::<ChannelMapping>(conn)?;

    let mut mappings_removed = 0;
    let mut manual_matches_preserved = 0;

    // Group affected mappings by xmltv_channel_id
    let mut affected_by_xmltv: HashMap<i32, Vec<ChannelMapping>> = HashMap::new();
    for mapping in affected_mappings {
        affected_by_xmltv
            .entry(mapping.xmltv_channel_id)
            .or_default()
            .push(mapping);
    }

    // Process each affected XMLTV channel
    for (xmltv_id, mappings) in affected_by_xmltv {
        let mut primary_removed = false;

        for mapping in &mappings {
            let is_manual = mapping.is_manual.unwrap_or(0) != 0;
            let is_primary = mapping.is_primary.unwrap_or(0) != 0;

            if is_manual {
                // NEVER delete manual matches - just count them as preserved
                manual_matches_preserved += 1;
                eprintln!(
                    "[auto_rematch] WARNING: Manual match preserved for unavailable stream - \
                     xmltv_channel_id: {}, xtream_channel_id: {}",
                    mapping.xmltv_channel_id, mapping.xtream_channel_id
                );
            } else {
                // Delete auto-generated mapping
                if let Some(mapping_id) = mapping.id {
                    diesel::delete(
                        channel_mappings::table.filter(channel_mappings::id.eq(Some(mapping_id))),
                    )
                    .execute(conn)?;

                    mappings_removed += 1;
                    if is_primary {
                        primary_removed = true;
                    }
                }
            }
        }

        // If primary was removed, promote the next highest confidence backup
        if primary_removed {
            promote_next_primary(conn, xmltv_id)?;
        }
    }

    Ok((mappings_removed, manual_matches_preserved))
}

/// Promote the next highest confidence mapping to primary for an XMLTV channel.
fn promote_next_primary(
    conn: &mut SqliteConnection,
    xmltv_channel_id: i32,
) -> Result<(), diesel::result::Error> {
    // Find the mapping with highest confidence among remaining
    let next_primary: Option<ChannelMapping> = channel_mappings::table
        .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
        .order_by(channel_mappings::match_confidence.desc())
        .first::<ChannelMapping>(conn)
        .optional()?;

    if let Some(new_primary) = next_primary {
        if let Some(new_primary_id) = new_primary.id {
            // Set as primary
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

    // Recalculate priorities for remaining backups
    recalculate_priorities(conn, xmltv_channel_id)?;

    Ok(())
}

/// Recalculate stream priorities for an XMLTV channel.
fn recalculate_priorities(
    conn: &mut SqliteConnection,
    xmltv_channel_id: i32,
) -> Result<(), diesel::result::Error> {
    let remaining_mappings: Vec<ChannelMapping> = channel_mappings::table
        .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
        .order_by(channel_mappings::match_confidence.desc())
        .load::<ChannelMapping>(conn)?;

    let mut backup_priority = 1;
    for mapping in remaining_mappings {
        if let Some(mid) = mapping.id {
            let is_primary = mapping.is_primary.unwrap_or(0) != 0;
            let priority = if is_primary {
                0
            } else {
                let p = backup_priority;
                backup_priority += 1;
                p
            };
            diesel::update(channel_mappings::table.filter(channel_mappings::id.eq(Some(mid))))
                .set(channel_mappings::stream_priority.eq(priority))
                .execute(conn)?;
        }
    }

    Ok(())
}

/// Handle changed streams by updating metadata and recalculating match confidence.
///
/// # Arguments
///
/// * `conn` - Database connection
/// * `account_id` - The Xtream account ID
/// * `changed_streams` - List of changed streams
/// * `config` - Matching configuration
///
/// # Returns
///
/// Number of mappings updated
pub fn handle_changed_streams(
    conn: &mut SqliteConnection,
    account_id: i32,
    changed_streams: &[ChangedStream],
    config: &MatchConfig,
) -> Result<i32, diesel::result::Error> {
    use crate::db::models::XtreamChannelUpdate;

    if changed_streams.is_empty() {
        return Ok(0);
    }

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let mut mappings_updated = 0;

    // Load all XMLTV channels for re-matching
    let xmltv_channels: Vec<XmltvChannel> = xmltv_channels::table.load::<XmltvChannel>(conn)?;

    // Build normalized name lookup for XMLTV channels
    let xmltv_by_id: HashMap<i32, &XmltvChannel> = xmltv_channels
        .iter()
        .filter_map(|c| c.id.map(|id| (id, c)))
        .collect();

    for changed in changed_streams {
        // Update the Xtream channel record with new metadata
        let update = XtreamChannelUpdate {
            name: changed.new_stream.name.clone(),
            stream_icon: changed.new_stream.stream_icon.clone(),
            category_id: changed.new_stream.category_id,
            category_name: changed.new_stream.category_name.clone(),
            qualities: changed.new_stream.qualities.clone().unwrap_or_default(),
            epg_channel_id: changed.new_stream.epg_channel_id.clone(),
            tv_archive: changed.new_stream.tv_archive.unwrap_or(0),
            tv_archive_duration: changed.new_stream.tv_archive_duration.unwrap_or(0),
            updated_at: now.clone(),
        };

        diesel::update(
            xtream_channels::table
                .filter(xtream_channels::account_id.eq(account_id))
                .filter(xtream_channels::stream_id.eq(changed.new_stream.stream_id)),
        )
        .set(&update)
        .execute(conn)?;

        // Get the database ID for this Xtream channel
        let xtream_db_id: Option<i32> = xtream_channels::table
            .filter(xtream_channels::account_id.eq(account_id))
            .filter(xtream_channels::stream_id.eq(changed.new_stream.stream_id))
            .select(xtream_channels::id)
            .first::<Option<i32>>(conn)?;

        let xtream_db_id = match xtream_db_id {
            Some(id) => id,
            None => continue,
        };

        // Find all mappings for this stream and recalculate confidence
        let affected_mappings: Vec<ChannelMapping> = channel_mappings::table
            .filter(channel_mappings::xtream_channel_id.eq(xtream_db_id))
            .load::<ChannelMapping>(conn)?;

        for mapping in affected_mappings {
            // Skip manual matches - don't recalculate their confidence
            if mapping.is_manual.unwrap_or(0) != 0 {
                continue;
            }

            // Get the XMLTV channel for this mapping
            if let Some(xmltv) = xmltv_by_id.get(&mapping.xmltv_channel_id) {
                // Re-run matching to get new confidence
                let xmltv_vec = vec![(*xmltv).clone()];
                let xtream_vec = vec![changed.new_stream.clone()];
                let (matches, _) = match_channels(&xmltv_vec, &xtream_vec, config);

                if let Some(new_match) = matches.first() {
                    // Update the confidence score
                    if let Some(mapping_id) = mapping.id {
                        diesel::update(
                            channel_mappings::table
                                .filter(channel_mappings::id.eq(Some(mapping_id))),
                        )
                        .set(channel_mappings::match_confidence.eq(Some(new_match.confidence as f32)))
                        .execute(conn)?;

                        mappings_updated += 1;

                        // Log warning if confidence dropped below threshold
                        if new_match.confidence < config.threshold {
                            eprintln!(
                                "[auto_rematch] WARNING: Match confidence dropped below threshold \
                                 ({:.2} < {:.2}) for mapping {} - keeping mapping but may need review",
                                new_match.confidence, config.threshold, mapping_id
                            );
                        }
                    }
                }
            }
        }
    }

    Ok(mappings_updated)
}

/// Perform a complete auto-rematch operation for an account.
///
/// This function:
/// 1. Detects provider changes
/// 2. Auto-matches new streams
/// 3. Handles removed streams
/// 4. Handles changed streams
///
/// # Arguments
///
/// * `conn` - Database connection
/// * `account_id` - The Xtream account ID
/// * `current_streams` - List of streams from the current scan
/// * `config` - Matching configuration
///
/// # Returns
///
/// `RematchResult` with statistics about the operation
pub fn perform_auto_rematch(
    conn: &mut SqliteConnection,
    account_id: i32,
    current_streams: &[XtreamChannel],
    config: &MatchConfig,
) -> Result<(ProviderChanges, RematchResult), diesel::result::Error> {
    // Step 1: Detect changes
    let changes = detect_provider_changes(conn, account_id, current_streams)?;

    let mut result = RematchResult::default();

    // Track affected XMLTV channels
    let mut affected_xmltv_ids: HashSet<i32> = HashSet::new();

    // Step 2: Auto-match new streams
    if !changes.new_streams.is_empty() {
        result.new_matches_created = auto_rematch_new_streams(conn, &changes.new_streams, config)?;
    }

    // Step 3: Handle removed streams
    if !changes.removed_stream_ids.is_empty() {
        let (removed, preserved) =
            handle_removed_streams(conn, account_id, &changes.removed_stream_ids)?;
        result.mappings_removed = removed;
        result.manual_matches_preserved = preserved;
    }

    // Step 4: Handle changed streams
    if !changes.changed_streams.is_empty() {
        result.mappings_updated =
            handle_changed_streams(conn, account_id, &changes.changed_streams, config)?;
    }

    // Calculate affected XMLTV channels
    // Get mappings for new streams
    for stream in &changes.new_streams {
        if let Some(id) = stream.id {
            let mappings: Vec<ChannelMapping> = channel_mappings::table
                .filter(channel_mappings::xtream_channel_id.eq(id))
                .load::<ChannelMapping>(conn)
                .unwrap_or_default();
            for m in mappings {
                affected_xmltv_ids.insert(m.xmltv_channel_id);
            }
        }
    }

    result.affected_xmltv_channels = affected_xmltv_ids.len() as i32;

    Ok((changes, result))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_has_stream_changed_name() {
        let old = XtreamChannel {
            id: Some(1),
            account_id: 1,
            stream_id: 100,
            name: "ESPN".to_string(),
            stream_icon: None,
            category_id: None,
            category_name: None,
            qualities: None,
            epg_channel_id: None,
            tv_archive: None,
            tv_archive_duration: None,
            added_at: None,
            updated_at: None,
        };
        let mut new = old.clone();
        new.name = "ESPN HD".to_string();

        assert!(has_stream_changed(&old, &new));
    }

    #[test]
    fn test_has_stream_changed_icon() {
        let old = XtreamChannel {
            id: Some(1),
            account_id: 1,
            stream_id: 100,
            name: "ESPN".to_string(),
            stream_icon: Some("http://old.com/icon.png".to_string()),
            category_id: None,
            category_name: None,
            qualities: None,
            epg_channel_id: None,
            tv_archive: None,
            tv_archive_duration: None,
            added_at: None,
            updated_at: None,
        };
        let mut new = old.clone();
        new.stream_icon = Some("http://new.com/icon.png".to_string());

        assert!(has_stream_changed(&old, &new));
    }

    #[test]
    fn test_has_stream_changed_no_change() {
        let old = XtreamChannel {
            id: Some(1),
            account_id: 1,
            stream_id: 100,
            name: "ESPN".to_string(),
            stream_icon: None,
            category_id: None,
            category_name: None,
            qualities: None,
            epg_channel_id: None,
            tv_archive: None,
            tv_archive_duration: None,
            added_at: None,
            updated_at: None,
        };
        let new = old.clone();

        assert!(!has_stream_changed(&old, &new));
    }
}
