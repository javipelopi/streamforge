//! Channels service — channel scanning and retrieval.
//!
//! Extracted from `commands/channels.rs`. Network I/O (Xtream API) is async,
//! but all DB operations take `&mut SqliteConnection`.

use diesel::prelude::*;
use std::collections::HashMap;
use std::path::Path;
use std::time::Instant;

use crate::types::{ChannelResponse, ScanAndRematchResponse, ScanChannelsResponse};
use crate::credentials::CredentialManager;
use crate::db::schema::{accounts, xtream_channels};
use crate::db::{Account, AccountStatusUpdate, NewXtreamChannel, XtreamChannel, XtreamChannelUpdate};
use crate::logging::log_provider_event;
use crate::matcher::{perform_auto_rematch, MatchConfig, ProviderChanges, RematchResult};
use crate::xtream::{quality, XtreamClient};

/// Scan channels from an Xtream provider.
pub async fn scan_channels(
    conn: &mut SqliteConnection,
    app_data_dir: &Path,
    account_id: i32,
) -> Result<ScanChannelsResponse, String> {
    let start_time = Instant::now();

    let account: Account = accounts::table
        .filter(accounts::id.eq(account_id))
        .first(conn)
        .map_err(|_| "Account not found".to_string())?;

    let credential_manager = CredentialManager::new(app_data_dir.to_path_buf());
    let password = credential_manager
        .retrieve_password(&account_id.to_string(), &account.password_encrypted)
        .map_err(|_| "Failed to retrieve credentials".to_string())?;

    let client = XtreamClient::new(&account.server_url, &account.username, &password)
        .map_err(|e| e.user_message())?;

    // Refresh tuner limits
    if let Ok(account_info) = client.authenticate().await {
        let status_update = AccountStatusUpdate {
            expiry_date: account_info.expiry_date.map(|dt| dt.to_rfc3339()),
            max_connections_actual: Some(account_info.max_connections),
            active_connections: Some(account_info.active_connections),
            last_check: Some(chrono::Utc::now().to_rfc3339()),
            connection_status: Some("Active".to_string()),
        };
        let _ = diesel::update(accounts::table.filter(accounts::id.eq(account_id)))
            .set(&status_update)
            .execute(conn);
    }

    let categories = match client.get_live_categories().await {
        Ok(cats) => cats,
        Err(e) => {
            return Ok(ScanChannelsResponse {
                success: false,
                total_channels: 0,
                new_channels: 0,
                updated_channels: 0,
                removed_channels: 0,
                scan_duration_ms: start_time.elapsed().as_millis() as u64,
                error_message: Some(e.user_message()),
            });
        }
    };

    let category_map: HashMap<String, String> = categories
        .into_iter()
        .map(|c| (c.category_id, c.category_name))
        .collect();

    let streams = match client.get_live_streams().await {
        Ok(s) => s,
        Err(e) => {
            return Ok(ScanChannelsResponse {
                success: false,
                total_channels: 0,
                new_channels: 0,
                updated_channels: 0,
                removed_channels: 0,
                scan_duration_ms: start_time.elapsed().as_millis() as u64,
                error_message: Some(e.user_message()),
            });
        }
    };

    let total_channels = streams.len() as i32;

    let existing_channels: Vec<XtreamChannel> = xtream_channels::table
        .filter(xtream_channels::account_id.eq(account_id))
        .load(conn)
        .map_err(|e| format!("Failed to load existing channels: {}", e))?;

    let existing_map: HashMap<i32, XtreamChannel> = existing_channels
        .into_iter()
        .filter_map(|c| c.id.map(|_| (c.stream_id, c)))
        .collect();

    let mut new_channels = 0;
    let mut updated_channels = 0;

    let current_stream_ids: std::collections::HashSet<i32> =
        streams.iter().map(|s| s.stream_id).collect();

    let removed_stream_ids: Vec<i32> = existing_map
        .keys()
        .filter(|&stream_id| !current_stream_ids.contains(stream_id))
        .copied()
        .collect();

    let removed_channels = removed_stream_ids.len() as i32;
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.transaction::<_, diesel::result::Error, _>(|conn| {
        for stream in &streams {
            let qualities = quality::detect_qualities(&stream.name);
            let qualities_json = quality::qualities_to_json(&qualities);

            let category_name = stream
                .category_id
                .as_ref()
                .and_then(|cat_id| category_map.get(cat_id).cloned());

            let category_id = stream
                .category_id
                .as_ref()
                .and_then(|s| s.parse::<i32>().ok());

            if existing_map.contains_key(&stream.stream_id) {
                let update = XtreamChannelUpdate {
                    name: stream.name.clone(),
                    stream_icon: stream.stream_icon.clone(),
                    category_id,
                    category_name,
                    qualities: qualities_json,
                    epg_channel_id: stream.epg_channel_id.clone(),
                    tv_archive: stream.tv_archive.unwrap_or(0),
                    tv_archive_duration: stream.tv_archive_duration.unwrap_or(0),
                    updated_at: now.clone(),
                };

                diesel::update(
                    xtream_channels::table
                        .filter(xtream_channels::account_id.eq(account_id))
                        .filter(xtream_channels::stream_id.eq(stream.stream_id)),
                )
                .set(&update)
                .execute(conn)?;

                updated_channels += 1;
            } else {
                let new_channel = NewXtreamChannel {
                    account_id,
                    stream_id: stream.stream_id,
                    name: stream.name.clone(),
                    stream_icon: stream.stream_icon.clone(),
                    category_id,
                    category_name,
                    qualities: qualities_json,
                    epg_channel_id: stream.epg_channel_id.clone(),
                    tv_archive: stream.tv_archive.unwrap_or(0),
                    tv_archive_duration: stream.tv_archive_duration.unwrap_or(0),
                };

                diesel::insert_into(xtream_channels::table)
                    .values(&new_channel)
                    .execute(conn)?;

                new_channels += 1;
            }
        }

        if !removed_stream_ids.is_empty() {
            diesel::delete(
                xtream_channels::table
                    .filter(xtream_channels::account_id.eq(account_id))
                    .filter(xtream_channels::stream_id.eq_any(&removed_stream_ids)),
            )
            .execute(conn)?;
        }

        Ok(())
    })
    .map_err(|e| format!("Database transaction error: {}", e))?;

    Ok(ScanChannelsResponse {
        success: true,
        total_channels,
        new_channels,
        updated_channels,
        removed_channels,
        scan_duration_ms: start_time.elapsed().as_millis() as u64,
        error_message: None,
    })
}

/// Get channels for an account.
pub fn get_channels(
    conn: &mut SqliteConnection,
    account_id: i32,
) -> Result<Vec<ChannelResponse>, String> {
    let channels: Vec<XtreamChannel> = xtream_channels::table
        .filter(xtream_channels::account_id.eq(account_id))
        .order(xtream_channels::name.asc())
        .load(conn)
        .map_err(|e| format!("Failed to load channels: {}", e))?;

    Ok(channels.into_iter().map(ChannelResponse::from).collect())
}

/// Get channel count for an account.
pub fn get_channel_count(conn: &mut SqliteConnection, account_id: i32) -> Result<i64, String> {
    xtream_channels::table
        .filter(xtream_channels::account_id.eq(account_id))
        .count()
        .get_result(conn)
        .map_err(|e| format!("Failed to count channels: {}", e))
}

/// Scan channels and auto-rematch to XMLTV channels.
pub async fn scan_and_rematch(
    conn: &mut SqliteConnection,
    app_data_dir: &Path,
    account_id: i32,
) -> Result<ScanAndRematchResponse, String> {
    let start_time = Instant::now();

    let account: Account = accounts::table
        .filter(accounts::id.eq(account_id))
        .first(conn)
        .map_err(|_| "Account not found".to_string())?;

    let credential_manager = CredentialManager::new(app_data_dir.to_path_buf());
    let password = credential_manager
        .retrieve_password(&account_id.to_string(), &account.password_encrypted)
        .map_err(|_| "Failed to retrieve credentials".to_string())?;

    let client = XtreamClient::new(&account.server_url, &account.username, &password)
        .map_err(|e| e.user_message())?;

    // Refresh tuner limits
    if let Ok(account_info) = client.authenticate().await {
        let status_update = AccountStatusUpdate {
            expiry_date: account_info.expiry_date.map(|dt| dt.to_rfc3339()),
            max_connections_actual: Some(account_info.max_connections),
            active_connections: Some(account_info.active_connections),
            last_check: Some(chrono::Utc::now().to_rfc3339()),
            connection_status: Some("Active".to_string()),
        };
        let _ = diesel::update(accounts::table.filter(accounts::id.eq(account_id)))
            .set(&status_update)
            .execute(conn);
    }

    let categories = match client.get_live_categories().await {
        Ok(cats) => cats,
        Err(e) => {
            let error_details = serde_json::json!({
                "error": format!("{:?}", e),
                "account_id": account_id,
                "account_name": &account.name,
                "operation": "fetch_categories"
            });
            let _ = log_provider_event(
                conn,
                "error",
                &format!(
                    "Failed to fetch categories for account {}: {}",
                    account.name,
                    e.user_message()
                ),
                Some(error_details),
            );
            return Ok(ScanAndRematchResponse {
                success: false,
                total_channels: 0,
                new_channels: 0,
                updated_channels: 0,
                removed_channels: 0,
                new_matches: 0,
                removed_matches: 0,
                updated_matches: 0,
                preserved_manual_matches: 0,
                scan_duration_ms: start_time.elapsed().as_millis() as u64,
                error_message: Some(e.user_message()),
            });
        }
    };

    let category_map: HashMap<String, String> = categories
        .into_iter()
        .map(|c| (c.category_id, c.category_name))
        .collect();

    let streams = match client.get_live_streams().await {
        Ok(s) => s,
        Err(e) => {
            let error_details = serde_json::json!({
                "error": format!("{:?}", e),
                "account_id": account_id,
                "account_name": &account.name,
                "operation": "fetch_streams"
            });
            let _ = log_provider_event(
                conn,
                "error",
                &format!(
                    "Failed to fetch streams for account {}: {}",
                    account.name,
                    e.user_message()
                ),
                Some(error_details),
            );
            return Ok(ScanAndRematchResponse {
                success: false,
                total_channels: 0,
                new_channels: 0,
                updated_channels: 0,
                removed_channels: 0,
                new_matches: 0,
                removed_matches: 0,
                updated_matches: 0,
                preserved_manual_matches: 0,
                scan_duration_ms: start_time.elapsed().as_millis() as u64,
                error_message: Some(e.user_message()),
            });
        }
    };

    let total_channels = streams.len() as i32;

    let existing_channels: Vec<XtreamChannel> = xtream_channels::table
        .filter(xtream_channels::account_id.eq(account_id))
        .load(conn)
        .map_err(|e| format!("Failed to load existing channels: {}", e))?;

    let existing_map: HashMap<i32, XtreamChannel> = existing_channels
        .into_iter()
        .filter_map(|c| c.id.map(|_| (c.stream_id, c)))
        .collect();

    let mut new_channels = 0;
    let mut updated_channels = 0;

    let current_stream_ids: std::collections::HashSet<i32> =
        streams.iter().map(|s| s.stream_id).collect();

    let removed_stream_ids: Vec<i32> = existing_map
        .keys()
        .filter(|&stream_id| !current_stream_ids.contains(stream_id))
        .copied()
        .collect();

    let removed_channels = removed_stream_ids.len() as i32;
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let mut current_xtream_channels: Vec<XtreamChannel> = Vec::new();

    conn.transaction::<_, diesel::result::Error, _>(|conn| {
        for stream in &streams {
            let qualities = quality::detect_qualities(&stream.name);
            let qualities_json = quality::qualities_to_json(&qualities);

            let category_name = stream
                .category_id
                .as_ref()
                .and_then(|cat_id| category_map.get(cat_id).cloned());

            let category_id = stream
                .category_id
                .as_ref()
                .and_then(|s| s.parse::<i32>().ok());

            if let Some(existing) = existing_map.get(&stream.stream_id) {
                let update = XtreamChannelUpdate {
                    name: stream.name.clone(),
                    stream_icon: stream.stream_icon.clone(),
                    category_id,
                    category_name: category_name.clone(),
                    qualities: qualities_json.clone(),
                    epg_channel_id: stream.epg_channel_id.clone(),
                    tv_archive: stream.tv_archive.unwrap_or(0),
                    tv_archive_duration: stream.tv_archive_duration.unwrap_or(0),
                    updated_at: now.clone(),
                };

                diesel::update(
                    xtream_channels::table
                        .filter(xtream_channels::account_id.eq(account_id))
                        .filter(xtream_channels::stream_id.eq(stream.stream_id)),
                )
                .set(&update)
                .execute(conn)?;

                updated_channels += 1;

                current_xtream_channels.push(XtreamChannel {
                    id: existing.id,
                    account_id,
                    stream_id: stream.stream_id,
                    name: stream.name.clone(),
                    stream_icon: stream.stream_icon.clone(),
                    category_id,
                    category_name,
                    qualities: Some(qualities_json),
                    epg_channel_id: stream.epg_channel_id.clone(),
                    tv_archive: stream.tv_archive,
                    tv_archive_duration: stream.tv_archive_duration,
                    added_at: existing.added_at.clone(),
                    updated_at: Some(now.clone()),
                });
            } else {
                let new_channel = NewXtreamChannel {
                    account_id,
                    stream_id: stream.stream_id,
                    name: stream.name.clone(),
                    stream_icon: stream.stream_icon.clone(),
                    category_id,
                    category_name: category_name.clone(),
                    qualities: qualities_json.clone(),
                    epg_channel_id: stream.epg_channel_id.clone(),
                    tv_archive: stream.tv_archive.unwrap_or(0),
                    tv_archive_duration: stream.tv_archive_duration.unwrap_or(0),
                };

                diesel::insert_into(xtream_channels::table)
                    .values(&new_channel)
                    .execute(conn)?;

                let inserted_id: i32 = diesel::select(
                    diesel::dsl::sql::<diesel::sql_types::Integer>("last_insert_rowid()"),
                )
                .get_result(conn)?;

                new_channels += 1;

                current_xtream_channels.push(XtreamChannel {
                    id: Some(inserted_id),
                    account_id,
                    stream_id: stream.stream_id,
                    name: stream.name.clone(),
                    stream_icon: stream.stream_icon.clone(),
                    category_id,
                    category_name,
                    qualities: Some(qualities_json),
                    epg_channel_id: stream.epg_channel_id.clone(),
                    tv_archive: stream.tv_archive,
                    tv_archive_duration: stream.tv_archive_duration,
                    added_at: Some(now.clone()),
                    updated_at: None,
                });
            }
        }

        if !removed_stream_ids.is_empty() {
            diesel::delete(
                xtream_channels::table
                    .filter(xtream_channels::account_id.eq(account_id))
                    .filter(xtream_channels::stream_id.eq_any(&removed_stream_ids)),
            )
            .execute(conn)?;
        }

        Ok(())
    })
    .map_err(|e| format!("Database transaction error: {}", e))?;

    let config = MatchConfig::default();
    let (changes, rematch_result) =
        perform_auto_rematch(conn, account_id, &current_xtream_channels, &config)
            .map_err(|e| format!("Auto-rematch error: {}", e))?;

    log_provider_changes(conn, &account.name, &changes, &rematch_result);

    Ok(ScanAndRematchResponse {
        success: true,
        total_channels,
        new_channels,
        updated_channels,
        removed_channels,
        new_matches: rematch_result.new_matches_created,
        removed_matches: rematch_result.mappings_removed,
        updated_matches: rematch_result.mappings_updated,
        preserved_manual_matches: rematch_result.manual_matches_preserved,
        scan_duration_ms: start_time.elapsed().as_millis() as u64,
        error_message: None,
    })
}

/// Log provider changes to the event log.
fn log_provider_changes(
    conn: &mut SqliteConnection,
    account_name: &str,
    changes: &ProviderChanges,
    result: &RematchResult,
) {
    let new_count = changes.new_streams.len();
    let removed_count = changes.removed_stream_ids.len();
    let changed_count = changes.changed_streams.len();

    if new_count == 0 && removed_count == 0 && changed_count == 0 {
        return;
    }

    let level = if removed_count > 0 || result.manual_matches_preserved > 0 {
        "warn"
    } else {
        "info"
    };

    let message = format!(
        "Provider changes detected for {}: {} new, {} removed, {} changed. Matches: {} new, {} removed, {} updated.",
        account_name, new_count, removed_count, changed_count,
        result.new_matches_created, result.mappings_removed, result.mappings_updated
    );

    let details = serde_json::json!({
        "accountName": account_name,
        "newStreams": new_count,
        "removedStreams": removed_count,
        "changedStreams": changed_count,
        "newMatches": result.new_matches_created,
        "removedMatches": result.mappings_removed,
        "updatedMatches": result.mappings_updated,
        "preservedManualMatches": result.manual_matches_preserved,
    });

    let _ = log_provider_event(conn, level, &message, Some(details));
}
