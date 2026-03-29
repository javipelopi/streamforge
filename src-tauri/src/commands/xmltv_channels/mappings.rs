//! Channel mapping CRUD commands: manual stream assignment, search, and multi-source mappings.

use diesel::prelude::*;
use serde::Serialize;
use tauri::State;

use crate::db::models::{ChannelMapping, XtreamChannel};
use crate::db::schema::{channel_mappings, xtream_channels};
use crate::db::DbConnection;
use crate::matcher::normalize_channel_name;
use strsim::jaro_winkler;

use super::{build_stream_match, parse_qualities, XtreamStreamMatch};

/// Set the primary stream for an XMLTV channel.
///
/// Updates the channel mappings so that:
/// - The specified stream becomes the primary (is_primary = true, stream_priority = 0)
/// - All other streams become backup (is_primary = false, stream_priority = 1+)
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

        // Find the mapping that should become primary (CR-5: handle Option<i32>)
        let new_primary_idx = all_mappings
            .iter()
            .position(|m| m.xtream_channel_id == Some(xtream_channel_id))
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
            .iter()
            .filter_map(|(mapping, stream)| build_stream_match(mapping, stream))
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
    /// Fuzzy match score against search query (0.0-1.0), None if no search query
    pub fuzzy_score: Option<f64>,
}

/// Minimum fuzzy score threshold for search results.
const SEARCH_SCORE_THRESHOLD: f64 = 0.3;

/// Maximum number of search results to return
const SEARCH_RESULTS_LIMIT: usize = 100;

/// Get all Xtream streams for the search dropdown.
///
/// **DEPRECATED**: Use `search_xtream_streams` instead for on-demand fuzzy search with pagination.
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
        // CR-5: xtream_channel_id is now Option<i32>
        if let Some(xtream_id) = mapping.xtream_channel_id {
            mappings_map
                .entry(xtream_id)
                .or_default()
                .push(mapping.xmltv_channel_id);
        }
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
                fuzzy_score: None,
            })
        })
        .collect();

    Ok(result)
}

/// Search Xtream streams by fuzzy matching against a query string.
///
/// Returns streams with fuzzy score >= 0.3, ordered by score descending.
#[tauri::command]
pub fn search_xtream_streams(
    db: State<DbConnection>,
    query: String,
) -> Result<Vec<XtreamStreamSearchResult>, String> {
    if query.trim().is_empty() {
        return Err("Search query cannot be empty".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    // Load all Xtream channels
    let streams: Vec<XtreamChannel> = xtream_channels::table
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
        // CR-5: xtream_channel_id is now Option<i32>
        if let Some(xtream_id) = mapping.xtream_channel_id {
            mappings_map
                .entry(xtream_id)
                .or_default()
                .push(mapping.xmltv_channel_id);
        }
    }

    // Normalize the query once
    let normalized_query = normalize_channel_name(&query);

    // Score and filter streams
    let mut scored_results: Vec<XtreamStreamSearchResult> = streams
        .into_iter()
        .filter_map(|stream| {
            let stream_id = stream.id?;
            let normalized_name = normalize_channel_name(&stream.name);
            let score = jaro_winkler(&normalized_query, &normalized_name);

            // Filter out low-scoring results
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

    // Sort by score descending (best matches first)
    scored_results.sort_by(|a, b| {
        b.fuzzy_score
            .unwrap_or(0.0)
            .partial_cmp(&a.fuzzy_score.unwrap_or(0.0))
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    // Limit results to prevent overwhelming the UI
    scored_results.truncate(SEARCH_RESULTS_LIMIT);

    Ok(scored_results)
}

/// Add a manual stream mapping between an XMLTV channel and an Xtream stream.
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

        // Get current max stream_priority AFTER shifting
        let max_priority: Option<i32> = channel_mappings::table
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .select(diesel::dsl::max(channel_mappings::stream_priority))
            .first::<Option<i32>>(conn)?;

        let new_priority = if set_as_primary {
            0
        } else {
            max_priority.unwrap_or(-1) + 1
        };

        // Insert the new mapping (CR-5: use factory method)
        let new_mapping = crate::db::models::NewChannelMapping::manual(xmltv_channel_id, xtream_channel_id)
            .with_primary(set_as_primary)
            .with_priority(new_priority);

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
            .iter()
            .filter_map(|(mapping, stream)| build_stream_match(mapping, stream))
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
        let remaining_mappings: Vec<ChannelMapping> = channel_mappings::table
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .order_by(channel_mappings::match_confidence.desc())
            .load::<ChannelMapping>(conn)?;

        let mut backup_priority = 1;
        for mapping in remaining_mappings.iter() {
            if let Some(mid) = mapping.id {
                let is_primary = mapping.is_primary.unwrap_or(0) != 0;
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

        // Load and return updated mappings
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

// ============================================================================
// Multi-Source Channel Mapping Commands
// ============================================================================

/// Response type for M3U stream mappings
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct M3uStreamMatch {
    pub id: i32,
    pub mapping_id: i32,
    pub name: String,
    pub stream_url: String,
    pub tvg_logo: Option<String>,
    pub group_title: Option<String>,
    pub is_primary: bool,
    pub stream_priority: i32,
}

/// Response type for Acestream mappings
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AcestreamMatch {
    pub id: i32,
    pub mapping_id: i32,
    pub name: String,
    pub content_id: String,
    pub is_primary: bool,
    pub stream_priority: i32,
}

/// Response type for all channel mappings across source types
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AllChannelMappings {
    pub xmltv_channel_id: i32,
    pub xtream_matches: Vec<XtreamStreamMatch>,
    pub m3u_matches: Vec<M3uStreamMatch>,
    pub acestream_matches: Vec<AcestreamMatch>,
}

/// Add a manual M3U channel mapping to an XMLTV channel.
#[tauri::command]
pub fn add_m3u_channel_mapping(
    db: State<DbConnection>,
    xmltv_channel_id: i32,
    m3u_channel_id: i32,
    set_as_primary: bool,
) -> Result<AllChannelMappings, String> {
    use crate::db::models::NewChannelMapping;
    use crate::db::schema::m3u_channels;

    if xmltv_channel_id <= 0 || m3u_channel_id <= 0 {
        return Err("Invalid channel ID".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    conn.transaction(|conn| {
        // Verify the M3U channel exists
        let _m3u_channel: crate::db::models::M3uChannel = m3u_channels::table
            .filter(m3u_channels::id.eq(m3u_channel_id))
            .first(conn)
            .map_err(|_| diesel::result::Error::NotFound)?;

        // If setting as primary, demote existing primaries
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

        // Get current max priority
        let max_priority: Option<i32> = channel_mappings::table
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .select(diesel::dsl::max(channel_mappings::stream_priority))
            .first::<Option<i32>>(conn)?;

        let new_priority = if set_as_primary {
            0
        } else {
            max_priority.unwrap_or(-1) + 1
        };

        // Insert the new mapping using CR-5 compliant factory method
        let new_mapping = NewChannelMapping::m3u(xmltv_channel_id, m3u_channel_id, new_priority)
            .with_primary(set_as_primary);

        diesel::insert_into(channel_mappings::table)
            .values(&new_mapping)
            .execute(conn)?;

        // Load and return all mappings
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
#[tauri::command]
pub fn add_acestream_channel_mapping(
    db: State<DbConnection>,
    xmltv_channel_id: i32,
    acestream_source_id: i32,
    set_as_primary: bool,
) -> Result<AllChannelMappings, String> {
    use crate::db::models::NewChannelMapping;
    use crate::db::schema::acestream_sources;

    if xmltv_channel_id <= 0 || acestream_source_id <= 0 {
        return Err("Invalid ID".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    conn.transaction(|conn| {
        // Verify the Acestream source exists
        let _acestream: crate::db::models::AcestreamSource = acestream_sources::table
            .filter(acestream_sources::id.eq(acestream_source_id))
            .first(conn)
            .map_err(|_| diesel::result::Error::NotFound)?;

        // If setting as primary, demote existing primaries
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

        // Get current max priority
        let max_priority: Option<i32> = channel_mappings::table
            .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
            .select(diesel::dsl::max(channel_mappings::stream_priority))
            .first::<Option<i32>>(conn)?;

        let new_priority = if set_as_primary {
            0
        } else {
            max_priority.unwrap_or(-1) + 1
        };

        // Insert the new mapping using CR-5 compliant factory method
        let new_mapping = NewChannelMapping::acestream(xmltv_channel_id, acestream_source_id, new_priority)
            .with_primary(set_as_primary);

        diesel::insert_into(channel_mappings::table)
            .values(&new_mapping)
            .execute(conn)?;

        // Load and return all mappings
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
#[tauri::command]
pub fn get_all_channel_mappings(
    db: State<DbConnection>,
    xmltv_channel_id: i32,
) -> Result<AllChannelMappings, String> {
    if xmltv_channel_id <= 0 {
        return Err("Invalid channel ID".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    load_all_channel_mappings(&mut conn, xmltv_channel_id)
        .map_err(|e| format!("Failed to load mappings: {}", e))
}

/// Internal function to load all mappings for a channel
pub(crate) fn load_all_channel_mappings(
    conn: &mut crate::db::DbPooledConnection,
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
    let m3u_mappings: Vec<(ChannelMapping, crate::db::models::M3uChannel)> = channel_mappings::table
        .inner_join(
            m3u_channels::table.on(channel_mappings::m3u_channel_id.eq(m3u_channels::id.nullable())),
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
                acestream_sources::table
                    .on(channel_mappings::acestream_source_id.eq(acestream_sources::id.nullable())),
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::matcher::normalize_channel_name;

    #[test]
    fn test_search_score_threshold_is_reasonable() {
        assert!(SEARCH_SCORE_THRESHOLD >= 0.2, "Threshold too low");
        assert!(SEARCH_SCORE_THRESHOLD <= 0.5, "Threshold too high");
    }

    #[test]
    fn test_search_results_limit_is_reasonable() {
        assert!(SEARCH_RESULTS_LIMIT >= 50, "Limit too low");
        assert!(SEARCH_RESULTS_LIMIT <= 200, "Limit too high");
    }

    #[test]
    fn test_empty_query_validation() {
        let empty_queries = ["", "   ", "\t\n", "  \t  "];
        for q in empty_queries {
            assert!(
                q.trim().is_empty(),
                "Query '{}' should be considered empty",
                q.escape_debug()
            );
        }

        let valid_queries = ["a", " ESPN ", "BBC One"];
        for q in valid_queries {
            assert!(
                !q.trim().is_empty(),
                "Query '{}' should NOT be considered empty",
                q
            );
        }
    }

    #[test]
    fn test_fuzzy_score_sorting_logic() {
        let mut scores = vec![0.5, 0.9, 0.3, 0.7, 0.8];
        scores.sort_by(|a, b| {
            b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal)
        });
        assert_eq!(scores, vec![0.9, 0.8, 0.7, 0.5, 0.3]);
    }

    #[test]
    fn test_fuzzy_matching_with_threshold() {
        let pairs_above_threshold = [
            ("CNN", "CNN International"),
            ("BBC One", "BBC 1"),
            ("ESPN", "ESPN2"),
        ];

        for (query, stream_name) in pairs_above_threshold {
            let norm_query = normalize_channel_name(query);
            let norm_stream = normalize_channel_name(stream_name);
            let score = jaro_winkler(&norm_query, &norm_stream);
            assert!(
                score >= SEARCH_SCORE_THRESHOLD,
                "Expected '{}' to match '{}' with score >= {}, got {}",
                query,
                stream_name,
                SEARCH_SCORE_THRESHOLD,
                score
            );
        }

        let unrelated_pairs = [
            ("ESPN", "Cartoon Network"),
            ("BBC", "Discovery Channel"),
        ];

        for (query, stream_name) in unrelated_pairs {
            let norm_query = normalize_channel_name(query);
            let norm_stream = normalize_channel_name(stream_name);
            let score = jaro_winkler(&norm_query, &norm_stream);
            assert!(
                score < 0.9,
                "Expected '{}' and '{}' to not be near-exact matches (score {})",
                query,
                stream_name,
                score
            );
        }
    }
}
