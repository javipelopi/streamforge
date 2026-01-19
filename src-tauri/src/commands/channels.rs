//! Channel scanning Tauri commands
//!
//! This module provides commands for scanning channels from Xtream providers
//! and storing them in the database.

use diesel::prelude::*;
use serde::Serialize;
use std::collections::HashMap;
use std::time::Instant;
use tauri::{AppHandle, Manager, State};

use crate::credentials::CredentialManager;
use crate::db::{
    schema::{accounts, xtream_channels},
    Account, DbConnection, NewXtreamChannel, XtreamChannel, XtreamChannelUpdate,
};
use crate::xtream::{quality, XtreamClient};

/// Response type for scan_channels command
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScanChannelsResponse {
    pub success: bool,
    pub total_channels: i32,
    pub new_channels: i32,
    pub updated_channels: i32,
    pub removed_channels: i32,
    pub scan_duration_ms: u64,
    pub error_message: Option<String>,
}

/// Response type for channel data
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChannelResponse {
    pub id: i32,
    pub account_id: i32,
    pub stream_id: i32,
    pub name: String,
    pub stream_icon: Option<String>,
    pub category_id: Option<i32>,
    pub category_name: Option<String>,
    pub qualities: Vec<String>,
    pub epg_channel_id: Option<String>,
    pub tv_archive: bool,
    pub tv_archive_duration: i32,
    pub added_at: Option<String>,
}

impl From<XtreamChannel> for ChannelResponse {
    fn from(channel: XtreamChannel) -> Self {
        let qualities = channel
            .qualities
            .as_deref()
            .map(quality::qualities_from_json)
            .unwrap_or_else(|| vec!["SD".to_string()]);

        Self {
            id: channel.id.unwrap_or(0),
            account_id: channel.account_id,
            stream_id: channel.stream_id,
            name: channel.name,
            stream_icon: channel.stream_icon,
            category_id: channel.category_id,
            category_name: channel.category_name,
            qualities,
            epg_channel_id: channel.epg_channel_id,
            tv_archive: channel.tv_archive.unwrap_or(0) != 0,
            tv_archive_duration: channel.tv_archive_duration.unwrap_or(0),
            added_at: channel.added_at,
        }
    }
}

/// Scan channels from an Xtream provider
///
/// Retrieves live streams from the Xtream API, detects quality tiers,
/// and stores/updates channels in the database.
#[tauri::command]
pub async fn scan_channels(
    app: AppHandle,
    db: State<'_, DbConnection>,
    account_id: i32,
) -> Result<ScanChannelsResponse, String> {
    let start_time = Instant::now();

    // Get app data directory for credential retrieval
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "Failed to get app data directory".to_string())?;

    // Get database connection
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    // Load account from database
    let account: Account = accounts::table
        .filter(accounts::id.eq(account_id))
        .first(&mut conn)
        .map_err(|_| "Account not found".to_string())?;

    // Retrieve password from keyring/fallback (password is NEVER logged)
    let credential_manager = CredentialManager::new(app_data_dir);
    let password = credential_manager
        .retrieve_password(&account_id.to_string(), &account.password_encrypted)
        .map_err(|_| "Failed to retrieve credentials".to_string())?;

    // Create Xtream client
    let client = XtreamClient::new(&account.server_url, &account.username, &password)
        .map_err(|e| e.user_message())?;

    // Fetch account info to refresh tuner limits (FR6 requirement)
    if let Ok(account_info) = client.authenticate().await {
        use crate::db::AccountStatusUpdate;
        let status_update = AccountStatusUpdate {
            expiry_date: account_info.expiry_date.map(|dt| dt.to_rfc3339()),
            max_connections_actual: Some(account_info.max_connections),
            active_connections: Some(account_info.active_connections),
            last_check: Some(chrono::Utc::now().to_rfc3339()),
            connection_status: Some("Active".to_string()),
        };
        let _ = diesel::update(accounts::table.filter(accounts::id.eq(account_id)))
            .set(&status_update)
            .execute(&mut conn);
    }

    // Fetch categories first (for category name lookup)
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

    // Build category name lookup map
    let category_map: HashMap<String, String> = categories
        .into_iter()
        .map(|c| (c.category_id, c.category_name))
        .collect();

    // Fetch live streams
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

    // Get existing channels for this account
    let existing_channels: Vec<XtreamChannel> = xtream_channels::table
        .filter(xtream_channels::account_id.eq(account_id))
        .load(&mut conn)
        .map_err(|e| format!("Failed to load existing channels: {}", e))?;

    // Build lookup map for existing channels by stream_id
    let existing_map: HashMap<i32, XtreamChannel> = existing_channels
        .into_iter()
        .filter_map(|c| c.id.map(|_| (c.stream_id, c)))
        .collect();

    let mut new_channels = 0;
    let mut updated_channels = 0;

    // Build set of current stream_ids from fetched streams
    let current_stream_ids: std::collections::HashSet<i32> =
        streams.iter().map(|s| s.stream_id).collect();

    // Calculate removed channels (exist in DB but not in fetched streams)
    let removed_stream_ids: Vec<i32> = existing_map
        .keys()
        .filter(|&stream_id| !current_stream_ids.contains(stream_id))
        .copied()
        .collect();

    let removed_channels = removed_stream_ids.len() as i32;

    // Process streams in batches for performance
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Use a transaction for all database operations
    conn.transaction::<_, diesel::result::Error, _>(|conn| {
        for stream in &streams {
            // Detect quality tiers from channel name
            let qualities = quality::detect_qualities(&stream.name);
            let qualities_json = quality::qualities_to_json(&qualities);

            // Get category name from lookup
            let category_name = stream
                .category_id
                .as_ref()
                .and_then(|cat_id| category_map.get(cat_id).cloned());

            // Parse category_id to i32
            let category_id = stream
                .category_id
                .as_ref()
                .and_then(|s| s.parse::<i32>().ok());

            if existing_map.contains_key(&stream.stream_id) {
                // Update existing channel
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
                // Insert new channel
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

        // Delete removed channels from database
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

    let scan_duration_ms = start_time.elapsed().as_millis() as u64;

    Ok(ScanChannelsResponse {
        success: true,
        total_channels,
        new_channels,
        updated_channels,
        removed_channels,
        scan_duration_ms,
        error_message: None,
    })
}

/// Get channels for an account
#[tauri::command]
pub async fn get_channels(
    db: State<'_, DbConnection>,
    account_id: i32,
) -> Result<Vec<ChannelResponse>, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let channels: Vec<XtreamChannel> = xtream_channels::table
        .filter(xtream_channels::account_id.eq(account_id))
        .order(xtream_channels::name.asc())
        .load(&mut conn)
        .map_err(|e| format!("Failed to load channels: {}", e))?;

    Ok(channels.into_iter().map(ChannelResponse::from).collect())
}

/// Get channel count for an account
#[tauri::command]
pub async fn get_channel_count(
    db: State<'_, DbConnection>,
    account_id: i32,
) -> Result<i64, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let count: i64 = xtream_channels::table
        .filter(xtream_channels::account_id.eq(account_id))
        .count()
        .get_result(&mut conn)
        .map_err(|e| format!("Failed to count channels: {}", e))?;

    Ok(count)
}
