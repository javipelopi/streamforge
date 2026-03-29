//! Xtream Sources Commands
//!
//! Tauri commands for displaying Xtream streams grouped by account
//! with their XMLTV channel mapping status.
//! Story 3-11: Implement Sources View Xtream Tab

use diesel::prelude::*;
use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::credentials::CredentialManager;
use crate::db::models::{Account, ChannelMapping, XmltvChannel, XtreamChannel};
use crate::db::schema::{accounts, channel_mappings, xmltv_channels, xtream_channels};
use crate::db::DbConnection;
use crate::server::stream::build_stream_url;

// Re-export types from crate::types so existing consumers still work
pub use crate::types::{AccountStreamStats, LinkStatus, XtreamAccountStream};

// ============================================================================
// Helper Functions
// ============================================================================

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

// ============================================================================
// Commands
// ============================================================================

/// Get all Xtream streams for a specific account with their mapping status.
///
/// Story 3-11: AC #2 - Display streams grouped by account
///
/// Returns streams with:
/// - Stream info (name, icon, qualities, category)
/// - Link status: linked (mapped to XMLTV), orphan (unmapped), or promoted (synthetic)
/// - List of linked XMLTV channel IDs
///
/// # Arguments
///
/// * `account_id` - The Xtream account ID to get streams for
///
/// # Returns
///
/// List of streams for the account with mapping status
#[tauri::command]
pub fn get_xtream_streams_for_account(
    db: State<DbConnection>,
    account_id: i32,
) -> Result<Vec<XtreamAccountStream>, String> {
    // Validate input
    if account_id <= 0 {
        return Err("Invalid account ID".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    // Load all streams for this account
    let streams: Vec<XtreamChannel> = xtream_channels::table
        .filter(xtream_channels::account_id.eq(account_id))
        .order_by(xtream_channels::name.asc())
        .load::<XtreamChannel>(&mut conn)
        .map_err(|e| format!("Failed to load Xtream streams: {}", e))?;

    // Get stream IDs for mapping lookup
    let stream_ids: Vec<i32> = streams.iter().filter_map(|s| s.id).collect();

    // Load all mappings for these streams
    let mappings: Vec<ChannelMapping> = channel_mappings::table
        .filter(channel_mappings::xtream_channel_id.eq_any(&stream_ids))
        .load::<ChannelMapping>(&mut conn)
        .map_err(|e| format!("Failed to load channel mappings: {}", e))?;

    // Get all XMLTV channel IDs that are referenced by mappings
    let xmltv_channel_ids: Vec<i32> = mappings.iter().map(|m| m.xmltv_channel_id).collect();

    // Load XMLTV channels to check for synthetic status
    let xmltv_channels: Vec<XmltvChannel> = if !xmltv_channel_ids.is_empty() {
        xmltv_channels::table
            .filter(xmltv_channels::id.eq_any(&xmltv_channel_ids))
            .load::<XmltvChannel>(&mut conn)
            .map_err(|e| format!("Failed to load XMLTV channels: {}", e))?
    } else {
        vec![]
    };

    // Build map of XMLTV channel ID -> is_synthetic
    let synthetic_map: std::collections::HashMap<i32, bool> = xmltv_channels
        .into_iter()
        .filter_map(|ch| ch.id.map(|id| (id, ch.is_synthetic.unwrap_or(0) != 0)))
        .collect();

    // Build map of xtream_channel_id -> list of (xmltv_channel_id, is_synthetic)
    let mut mappings_map: std::collections::HashMap<i32, Vec<(i32, bool)>> =
        std::collections::HashMap::new();

    for mapping in mappings {
        // CR-5: xtream_channel_id is now Option<i32>
        // We only process Xtream mappings here, so xtream_channel_id should be Some
        if let Some(xtream_id) = mapping.xtream_channel_id {
            let xmltv_id = mapping.xmltv_channel_id;
            let is_synthetic = synthetic_map.get(&xmltv_id).copied().unwrap_or(false);
            mappings_map
                .entry(xtream_id)
                .or_default()
                .push((xmltv_id, is_synthetic));
        }
    }

    // Build result list
    let result: Vec<XtreamAccountStream> = streams
        .into_iter()
        .filter_map(|stream| {
            let stream_id = stream.id?;
            let linked_channels = mappings_map.get(&stream_id);

            // Determine link status and extract data
            let (link_status, linked_xmltv_ids, synthetic_channel_id) = match linked_channels {
                None => {
                    // No mappings = orphan
                    (LinkStatus::Orphan, vec![], None)
                }
                Some(channels) => {
                    let xmltv_ids: Vec<i32> = channels.iter().map(|(id, _)| *id).collect();

                    // Check if any linked channel is synthetic
                    let has_synthetic = channels.iter().any(|(_, is_syn)| *is_syn);

                    if has_synthetic {
                        // Find the synthetic channel ID
                        let syn_id = channels
                            .iter()
                            .find(|(_, is_syn)| *is_syn)
                            .map(|(id, _)| *id);
                        (LinkStatus::Promoted, xmltv_ids, syn_id)
                    } else {
                        (LinkStatus::Linked, xmltv_ids, None)
                    }
                }
            };

            Some(XtreamAccountStream {
                id: stream_id,
                stream_id: stream.stream_id,
                name: stream.name,
                stream_icon: stream.stream_icon,
                qualities: parse_qualities(&stream.qualities),
                category_name: stream.category_name,
                link_status,
                linked_xmltv_ids,
                synthetic_channel_id,
            })
        })
        .collect();

    Ok(result)
}

/// Get stream statistics for a specific account.
///
/// Story 3-11: AC #3 - Show statistics in accordion header
///
/// Returns counts of:
/// - Total streams
/// - Linked streams (mapped to XMLTV channels)
/// - Orphan streams (not mapped)
/// - Promoted streams (linked to synthetic channels)
///
/// # Arguments
///
/// * `account_id` - The Xtream account ID to get stats for
///
/// # Returns
///
/// Statistics for the account's streams
#[tauri::command]
pub fn get_account_stream_stats(
    db: State<DbConnection>,
    account_id: i32,
) -> Result<AccountStreamStats, String> {
    // Validate input
    if account_id <= 0 {
        return Err("Invalid account ID".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    // Count total streams for this account
    let stream_count: i64 = xtream_channels::table
        .filter(xtream_channels::account_id.eq(account_id))
        .count()
        .get_result(&mut conn)
        .map_err(|e| format!("Failed to count streams: {}", e))?;

    // Load all stream IDs for this account
    let stream_ids: Vec<i32> = xtream_channels::table
        .filter(xtream_channels::account_id.eq(account_id))
        .select(xtream_channels::id)
        .load::<Option<i32>>(&mut conn)
        .map_err(|e| format!("Failed to load stream IDs: {}", e))?
        .into_iter()
        .flatten()
        .collect();

    if stream_ids.is_empty() {
        return Ok(AccountStreamStats {
            stream_count: 0,
            linked_count: 0,
            orphan_count: 0,
            promoted_count: 0,
        });
    }

    // Load all mappings for these streams
    let mappings: Vec<ChannelMapping> = channel_mappings::table
        .filter(channel_mappings::xtream_channel_id.eq_any(&stream_ids))
        .load::<ChannelMapping>(&mut conn)
        .map_err(|e| format!("Failed to load channel mappings: {}", e))?;

    // Get unique mapped stream IDs (CR-5: filter_map for Option<i32>)
    let mapped_stream_ids: std::collections::HashSet<i32> = mappings
        .iter()
        .filter_map(|m| m.xtream_channel_id)
        .collect();

    // Get all XMLTV channel IDs that are referenced by mappings
    let xmltv_channel_ids: Vec<i32> = mappings.iter().map(|m| m.xmltv_channel_id).collect();

    // Load XMLTV channels to check for synthetic status
    let synthetic_channel_ids: std::collections::HashSet<i32> = if !xmltv_channel_ids.is_empty() {
        xmltv_channels::table
            .filter(xmltv_channels::id.eq_any(&xmltv_channel_ids))
            .filter(xmltv_channels::is_synthetic.eq(1))
            .select(xmltv_channels::id)
            .load::<Option<i32>>(&mut conn)
            .map_err(|e| format!("Failed to load synthetic channels: {}", e))?
            .into_iter()
            .flatten()
            .collect()
    } else {
        std::collections::HashSet::new()
    };

    // Count promoted streams (streams mapped to synthetic channels) (CR-5: filter_map for Option<i32>)
    let promoted_stream_ids: std::collections::HashSet<i32> = mappings
        .iter()
        .filter(|m| synthetic_channel_ids.contains(&m.xmltv_channel_id))
        .filter_map(|m| m.xtream_channel_id)
        .collect();

    let promoted_count = promoted_stream_ids.len() as i32;

    // Linked count = mapped streams - promoted streams
    let linked_count = (mapped_stream_ids.len() - promoted_stream_ids.len()) as i32;

    // Orphan count = total - mapped
    let orphan_count = stream_count as i32 - mapped_stream_ids.len() as i32;

    Ok(AccountStreamStats {
        stream_count: stream_count as i32,
        linked_count,
        orphan_count,
        promoted_count,
    })
}

/// Remove all mappings for a specific Xtream stream.
///
/// Story 3-11: AC #3 - Unlink stream from all XMLTV channels
///
/// Deletes all channel_mappings rows for the given xtream_channel_id.
/// This effectively orphans the stream so it can be re-linked or promoted.
///
/// # Arguments
///
/// * `xtream_channel_id` - The Xtream channel ID to unlink
///
/// # Returns
///
/// Number of mappings removed
#[tauri::command]
pub fn unlink_xtream_stream(
    db: State<DbConnection>,
    xtream_channel_id: i32,
) -> Result<i32, String> {
    // Validate input
    if xtream_channel_id <= 0 {
        return Err("Invalid Xtream channel ID".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    // Delete all mappings for this xtream channel
    let deleted_count = diesel::delete(
        channel_mappings::table.filter(channel_mappings::xtream_channel_id.eq(xtream_channel_id)),
    )
    .execute(&mut conn)
    .map_err(|e| format!("Failed to unlink stream: {}", e))?;

    Ok(deleted_count as i32)
}

/// Get the playback URL for an Xtream stream.
///
/// Builds the full stream URL with decrypted credentials for playback.
/// Used by the video player to play streams directly.
///
/// # Arguments
///
/// * `app` - Tauri app handle for accessing app data directory
/// * `xtream_channel_id` - The database ID of the Xtream channel/stream
///
/// # Returns
///
/// The full stream URL (e.g., http://server.com/live/user/pass/12345.ts)
#[tauri::command]
pub async fn get_xtream_stream_url(
    app: AppHandle,
    db: State<'_, DbConnection>,
    xtream_channel_id: i32,
) -> Result<String, String> {
    // Validate input
    if xtream_channel_id <= 0 {
        return Err("Invalid Xtream channel ID".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    // Load the Xtream channel
    let xtream_channel: XtreamChannel = xtream_channels::table
        .filter(xtream_channels::id.eq(xtream_channel_id))
        .first::<XtreamChannel>(&mut conn)
        .map_err(|e| format!("Xtream channel not found: {}", e))?;

    // Load the account for this channel
    let account: Account = accounts::table
        .filter(accounts::id.eq(xtream_channel.account_id))
        .first::<Account>(&mut conn)
        .map_err(|e| format!("Account not found: {}", e))?;

    // Get app data directory for credential manager
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // Decrypt the password
    let credential_manager = CredentialManager::new(app_data_dir);
    let account_id_str = account.id.map(|id| id.to_string()).unwrap_or_default();
    let password = credential_manager
        .retrieve_password(&account_id_str, &account.password_encrypted)
        .map_err(|e| format!("Failed to decrypt credentials: {}", e))?;

    // Build the stream URL
    let stream_url = build_stream_url(
        &account.server_url,
        &account.username,
        &password,
        xtream_channel.stream_id,
    );

    Ok(stream_url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_qualities_json() {
        let json_input = Some(r#"["HD", "SD", "4K"]"#.to_string());
        let result = parse_qualities(&json_input);
        assert_eq!(result, vec!["HD", "SD", "4K"]);
    }

    #[test]
    fn test_parse_qualities_comma_separated() {
        let csv_input = Some("HD, SD, 4K".to_string());
        let result = parse_qualities(&csv_input);
        assert_eq!(result, vec!["HD", "SD", "4K"]);
    }

    #[test]
    fn test_parse_qualities_empty() {
        assert_eq!(parse_qualities(&None), Vec::<String>::new());
        assert_eq!(parse_qualities(&Some("".to_string())), Vec::<String>::new());
    }

    #[test]
    fn test_link_status_serialization() {
        // Test that LinkStatus serializes correctly
        assert_eq!(
            serde_json::to_string(&LinkStatus::Linked).unwrap(),
            r#""linked""#
        );
        assert_eq!(
            serde_json::to_string(&LinkStatus::Orphan).unwrap(),
            r#""orphan""#
        );
        assert_eq!(
            serde_json::to_string(&LinkStatus::Promoted).unwrap(),
            r#""promoted""#
        );
    }
}
