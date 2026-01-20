//! Database Persistence for Channel Mappings
//!
//! Handles saving and loading channel mappings and XMLTV channel settings
//! from the database. Uses transactions for atomicity.

use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool};
use diesel::SqliteConnection;

use super::{MatchResult, MatchStats};
use crate::db::models::{
    ChannelMapping, NewChannelMapping, NewXmltvChannelSettings, XmltvChannelSettings,
};
use crate::db::schema::{channel_mappings, xmltv_channel_settings};

/// Save channel mappings to the database.
///
/// This function:
/// 1. Clears existing auto-generated mappings (preserves manual ones)
/// 2. Inserts new mappings from match results
/// 3. Creates/updates xmltv_channel_settings for each XMLTV channel
/// 4. Sets is_enabled = false for unmatched channels
///
/// All operations are wrapped in a transaction for atomicity.
///
/// # Arguments
///
/// * `conn` - Database connection
/// * `matches` - List of match results to save
/// * `xmltv_channel_ids` - All XMLTV channel IDs (to track unmatched ones)
///
/// # Returns
///
/// Result with number of mappings saved or error
pub fn save_channel_mappings(
    conn: &mut SqliteConnection,
    matches: &[MatchResult],
    xmltv_channel_ids: &[i32],
) -> Result<usize, diesel::result::Error> {
    conn.transaction(|conn| {
        // Step 1: Delete existing auto-generated mappings (preserve manual ones)
        diesel::delete(channel_mappings::table.filter(channel_mappings::is_manual.eq(0)))
            .execute(conn)
            .map_err(|e| {
                eprintln!("[save_channel_mappings] Failed to delete existing mappings: {}", e);
                e
            })?;

        // Step 2: Insert new mappings
        let new_mappings: Vec<NewChannelMapping> = matches
            .iter()
            .map(|m| {
                // Convert f64 confidence to f32, ensuring it's within valid range
                let confidence_f32 = if m.confidence.is_finite() {
                    Some(m.confidence as f32)
                } else {
                    None // Invalid confidence (NaN or Infinite)
                };

                NewChannelMapping::new(
                    m.xmltv_channel_id,
                    m.xtream_channel_id,
                    confidence_f32,
                    m.is_primary,
                    m.stream_priority,
                )
            })
            .collect();

        let inserted_count = diesel::insert_into(channel_mappings::table)
            .values(&new_mappings)
            .execute(conn)
            .map_err(|e| {
                eprintln!("[save_channel_mappings] Failed to insert {} mappings: {}", new_mappings.len(), e);
                e
            })?;

        // Step 3: Create set of matched XMLTV channel IDs
        let matched_ids: std::collections::HashSet<i32> =
            matches.iter().map(|m| m.xmltv_channel_id).collect();

        // Step 4: Ensure xmltv_channel_settings exists for ALL XMLTV channels
        for xmltv_id in xmltv_channel_ids {
            let has_matches = matched_ids.contains(xmltv_id);

            // Try to update existing settings, or insert new ones
            let existing: Option<XmltvChannelSettings> = xmltv_channel_settings::table
                .filter(xmltv_channel_settings::xmltv_channel_id.eq(xmltv_id))
                .first(conn)
                .optional()?;

            if existing.is_none() {
                // Insert new settings - is_enabled defaults to false for unmatched
                let new_settings = NewXmltvChannelSettings::new(*xmltv_id, false);
                diesel::insert_into(xmltv_channel_settings::table)
                    .values(&new_settings)
                    .execute(conn)?;
            }

            // For channels with no matches, ensure is_enabled = false
            if !has_matches {
                diesel::update(
                    xmltv_channel_settings::table
                        .filter(xmltv_channel_settings::xmltv_channel_id.eq(xmltv_id)),
                )
                .set(xmltv_channel_settings::is_enabled.eq(0))
                .execute(conn)?;
            }
        }

        Ok(inserted_count)
    })
}

/// Get all channel mappings for a specific XMLTV channel.
///
/// Returns mappings sorted by stream_priority (ascending).
pub fn get_channel_mappings(
    conn: &mut SqliteConnection,
    xmltv_channel_id: i32,
) -> Result<Vec<ChannelMapping>, diesel::result::Error> {
    channel_mappings::table
        .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
        .order(channel_mappings::stream_priority.asc())
        .load::<ChannelMapping>(conn)
}

/// Get all channel mappings in the database.
pub fn get_all_channel_mappings(
    conn: &mut SqliteConnection,
) -> Result<Vec<ChannelMapping>, diesel::result::Error> {
    channel_mappings::table
        .order((
            channel_mappings::xmltv_channel_id.asc(),
            channel_mappings::stream_priority.asc(),
        ))
        .load::<ChannelMapping>(conn)
}

/// Get XMLTV channel settings for a specific channel.
pub fn get_xmltv_channel_settings(
    conn: &mut SqliteConnection,
    xmltv_channel_id: i32,
) -> Result<Option<XmltvChannelSettings>, diesel::result::Error> {
    xmltv_channel_settings::table
        .filter(xmltv_channel_settings::xmltv_channel_id.eq(xmltv_channel_id))
        .first(conn)
        .optional()
}

/// Calculate match statistics from the database.
pub fn calculate_match_stats(
    pool: &Pool<ConnectionManager<SqliteConnection>>,
) -> Result<MatchStats, diesel::result::Error> {
    use crate::db::schema::{xmltv_channels, xtream_channels};

    let mut conn = pool.get().map_err(|e| {
        diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::Unknown,
            Box::new(e.to_string()),
        )
    })?;

    // Count total XMLTV channels
    let total_xmltv: i64 = xmltv_channels::table.count().get_result(&mut conn)?;

    // Count total Xtream channels
    let total_xtream: i64 = xtream_channels::table.count().get_result(&mut conn)?;

    // Count distinct XMLTV channels with at least one mapping
    // Use subquery approach to count unique xmltv_channel_ids
    let matched: i64 = channel_mappings::table
        .select(channel_mappings::xmltv_channel_id)
        .distinct()
        .count()
        .get_result(&mut conn)?;

    // Count XMLTV channels with multiple mappings (for failover stats)
    let mappings_per_channel: Vec<(i32, i64)> = channel_mappings::table
        .group_by(channel_mappings::xmltv_channel_id)
        .select((
            channel_mappings::xmltv_channel_id,
            diesel::dsl::count_star(),
        ))
        .load(&mut conn)?;

    let multiple_matches = mappings_per_channel.iter().filter(|(_, c)| *c > 1).count();

    Ok(MatchStats {
        total_xmltv: total_xmltv as usize,
        total_xtream: total_xtream as usize,
        matched: matched as usize,
        unmatched: (total_xmltv - matched) as usize,
        multiple_matches,
        duration_ms: 0, // Not applicable for db query
    })
}

#[cfg(test)]
mod tests {
    // Database persistence tests would require test database setup
    // These are covered in integration tests
}
