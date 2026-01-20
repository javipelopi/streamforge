//! XMLTV EPG Source management Tauri commands
//!
//! This module provides commands for adding, retrieving, updating, and deleting
//! XMLTV source URLs for EPG data, as well as refreshing EPG data from sources.

use std::collections::HashMap;

use diesel::prelude::*;
use serde::Serialize;
use tauri::State;
use thiserror::Error;

use crate::db::{
    schema::{channel_mappings, programs, xmltv_channel_settings, xmltv_channels, xmltv_sources},
    ChannelMapping, DbConnection, NewChannelMapping, NewProgram, NewXmltvChannel,
    NewXmltvChannelSettings, NewXmltvSource, Program, XmltvChannel, XmltvChannelSettings,
    XmltvSource, XmltvSourceUpdate,
};
use crate::xmltv::{fetch_xmltv, parse_xmltv_data, XmltvError};

/// Error types for EPG source operations
#[derive(Debug, Error)]
pub enum EpgSourceError {
    #[error("Source name is required")]
    NameRequired,

    #[error("URL is required")]
    UrlRequired,

    #[error("Invalid URL format")]
    InvalidUrl,

    #[error("URL must use http or https")]
    InvalidUrlScheme,

    #[error("Invalid format. Must be one of: xml, xml_gz, auto")]
    InvalidFormat,

    #[error("An EPG source with this URL already exists")]
    DuplicateUrl,

    #[error("EPG source not found")]
    NotFound,

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("URL not allowed: {0}")]
    UrlNotAllowed(String),

    #[error("Failed to download EPG: {0}")]
    DownloadError(String),

    #[error("Failed to parse EPG: {0}")]
    ParseError(String),
}

impl From<XmltvError> for EpgSourceError {
    fn from(err: XmltvError) -> Self {
        match err {
            XmltvError::DownloadError(msg) => EpgSourceError::DownloadError(msg),
            XmltvError::DecompressError(msg) => EpgSourceError::ParseError(msg),
            XmltvError::ParseError(msg) => EpgSourceError::ParseError(msg),
            XmltvError::TimestampError(msg) => EpgSourceError::ParseError(msg),
            XmltvError::DatabaseError(e) => EpgSourceError::DatabaseError(e.to_string()),
            XmltvError::UrlNotAllowed(msg) => EpgSourceError::UrlNotAllowed(msg),
        }
    }
}

impl From<diesel::result::Error> for EpgSourceError {
    fn from(err: diesel::result::Error) -> Self {
        EpgSourceError::DatabaseError(err.to_string())
    }
}

impl From<EpgSourceError> for String {
    fn from(err: EpgSourceError) -> Self {
        err.to_string()
    }
}

// ============================================================================
// Helper types and functions for preserving data during XMLTV refresh
// ============================================================================

/// Preserved data from XMLTV channels before refresh
/// Stores mappings and settings by channel_id (string) so they can be restored
/// after channels are recreated with new database IDs
struct PreservedChannelData {
    /// Manual mappings: (channel_id, xtream_channel_id, is_primary, stream_priority)
    manual_mappings: Vec<(String, i32, i32, i32)>,
    /// Channel settings: (channel_id, is_enabled, plex_display_order)
    settings: Vec<(String, i32, Option<i32>)>,
}

/// Save manual mappings and channel settings before deleting XMLTV channels
fn preserve_channel_data(
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

    let manual_mappings: Vec<(String, i32, i32, i32)> = mappings
        .into_iter()
        .filter_map(|m| {
            old_id_to_channel_id.get(&m.xmltv_channel_id).map(|channel_id| {
                (
                    channel_id.clone(),
                    m.xtream_channel_id,
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
fn restore_channel_data(
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

/// Response type for XMLTV source data
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct XmltvSourceResponse {
    pub id: i32,
    pub name: String,
    pub url: String,
    pub format: String,
    pub refresh_hour: i32,
    pub last_refresh: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<XmltvSource> for XmltvSourceResponse {
    fn from(source: XmltvSource) -> Self {
        Self {
            id: source.id.unwrap_or(0),
            name: source.name,
            url: source.url,
            format: source.format,
            refresh_hour: source.refresh_hour,
            last_refresh: source.last_refresh,
            is_active: source.is_active != 0,
            created_at: source.created_at,
            updated_at: source.updated_at,
        }
    }
}

/// Response type for EPG statistics
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EpgStatsResponse {
    pub channel_count: i64,
    pub program_count: i64,
    pub last_refresh: Option<String>,
}

/// Response type for XMLTV channel data
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct XmltvChannelResponse {
    pub id: i32,
    pub source_id: i32,
    pub channel_id: String,
    pub display_name: String,
    pub icon: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<XmltvChannel> for XmltvChannelResponse {
    fn from(channel: XmltvChannel) -> Self {
        Self {
            id: channel.id.unwrap_or(0),
            source_id: channel.source_id,
            channel_id: channel.channel_id,
            display_name: channel.display_name,
            icon: channel.icon,
            created_at: channel.created_at,
            updated_at: channel.updated_at,
        }
    }
}

/// Response type for Program data
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProgramResponse {
    pub id: i32,
    pub xmltv_channel_id: i32,
    pub title: String,
    pub description: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub category: Option<String>,
    pub episode_info: Option<String>,
    pub created_at: String,
}

impl From<Program> for ProgramResponse {
    fn from(program: Program) -> Self {
        Self {
            id: program.id.unwrap_or(0),
            xmltv_channel_id: program.xmltv_channel_id,
            title: program.title,
            description: program.description,
            start_time: program.start_time,
            end_time: program.end_time,
            category: program.category,
            episode_info: program.episode_info,
            created_at: program.created_at,
        }
    }
}

/// Validate URL format and check for SSRF risks
fn validate_url(url_str: &str) -> Result<(), EpgSourceError> {
    if url_str.trim().is_empty() {
        return Err(EpgSourceError::UrlRequired);
    }

    let parsed = url::Url::parse(url_str.trim()).map_err(|_| EpgSourceError::InvalidUrl)?;

    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(EpgSourceError::InvalidUrlScheme);
    }

    // Check for SSRF - block localhost and private IPs
    if let Some(host) = parsed.host_str() {
        let host_lower = host.to_lowercase();

        // Block localhost variants
        if host_lower == "localhost"
            || host_lower == "127.0.0.1"
            || host_lower.starts_with("127.")
            || host_lower == "::1"
            || host_lower == "0.0.0.0" {
            return Err(EpgSourceError::InvalidUrl);
        }

        // Block private IP ranges
        if host_lower.starts_with("10.")
            || host_lower.starts_with("192.168.")
            || is_172_private(&host_lower)
            || host_lower.starts_with("169.254.") {
            return Err(EpgSourceError::InvalidUrl);
        }
    }

    Ok(())
}

/// Check if host is in the 172.16.0.0/12 private range
fn is_172_private(host: &str) -> bool {
    if !host.starts_with("172.") {
        return false;
    }

    // Parse the second octet
    let parts: Vec<&str> = host.split('.').collect();
    if parts.len() < 2 {
        return false;
    }

    if let Ok(second_octet) = parts[1].parse::<u8>() {
        // 172.16.0.0 - 172.31.255.255 is private
        return (16..=31).contains(&second_octet);
    }

    false
}

/// Validate format value
fn validate_format(format: &str) -> Result<(), EpgSourceError> {
    let valid_formats = ["xml", "xml_gz", "auto"];
    if !valid_formats.contains(&format) {
        return Err(EpgSourceError::InvalidFormat);
    }
    Ok(())
}

/// Add a new XMLTV source
#[tauri::command]
pub async fn add_xmltv_source(
    db: State<'_, DbConnection>,
    name: String,
    url: String,
    format: String,
) -> Result<XmltvSourceResponse, String> {
    // Validate inputs
    if name.trim().is_empty() {
        return Err(EpgSourceError::NameRequired.into());
    }

    validate_url(&url)?;
    validate_format(&format)?;

    let new_source = NewXmltvSource::new(name.trim(), url.trim(), &format);

    let mut conn = db
        .get_connection()
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    // Insert and return in single operation to avoid race condition
    let inserted: XmltvSource = diesel::insert_into(xmltv_sources::table)
        .values(&new_source)
        .get_result(&mut conn)
        .map_err(|e| {
            if e.to_string().contains("UNIQUE constraint failed") {
                EpgSourceError::DuplicateUrl
            } else {
                EpgSourceError::DatabaseError(e.to_string())
            }
        })?;

    Ok(XmltvSourceResponse::from(inserted))
}

/// Get all XMLTV sources
#[tauri::command]
pub async fn get_xmltv_sources(
    db: State<'_, DbConnection>,
) -> Result<Vec<XmltvSourceResponse>, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    let sources: Vec<XmltvSource> = xmltv_sources::table
        .order(xmltv_sources::name.asc())
        .load(&mut conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    Ok(sources.into_iter().map(XmltvSourceResponse::from).collect())
}

/// Update an existing XMLTV source
#[tauri::command]
pub async fn update_xmltv_source(
    db: State<'_, DbConnection>,
    source_id: i32,
    updates: XmltvSourceUpdate,
) -> Result<XmltvSourceResponse, String> {
    // Validate URL if provided
    if let Some(ref new_url) = updates.url {
        validate_url(new_url)?;
    }

    // Validate format if provided
    if let Some(ref new_format) = updates.format {
        validate_format(new_format)?;
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    // Get current timestamp for updated_at
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Create update with updated_at timestamp
    let updates_with_timestamp = XmltvSourceUpdate {
        updated_at: Some(now),
        ..updates
    };

    // Update and check affected rows - no separate existence check (avoids TOCTOU)
    let affected = diesel::update(xmltv_sources::table.filter(xmltv_sources::id.eq(source_id)))
        .set(&updates_with_timestamp)
        .execute(&mut conn)
        .map_err(|e| {
            if e.to_string().contains("UNIQUE constraint failed") {
                EpgSourceError::DuplicateUrl
            } else {
                EpgSourceError::DatabaseError(e.to_string())
            }
        })?;

    if affected == 0 {
        return Err(EpgSourceError::NotFound.into());
    }

    let updated: XmltvSource = xmltv_sources::table
        .filter(xmltv_sources::id.eq(source_id))
        .first(&mut conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    Ok(XmltvSourceResponse::from(updated))
}

/// Delete an XMLTV source
#[tauri::command]
pub async fn delete_xmltv_source(
    db: State<'_, DbConnection>,
    source_id: i32,
) -> Result<(), String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    let deleted = diesel::delete(xmltv_sources::table.filter(xmltv_sources::id.eq(source_id)))
        .execute(&mut conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    if deleted == 0 {
        return Err(EpgSourceError::NotFound.into());
    }

    Ok(())
}

/// Toggle XMLTV source active state
#[tauri::command]
pub async fn toggle_xmltv_source(
    db: State<'_, DbConnection>,
    source_id: i32,
    active: bool,
) -> Result<XmltvSourceResponse, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    let is_active_int = if active { 1 } else { 0 };
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Update and check affected rows - no separate existence check (avoids TOCTOU)
    let affected = diesel::update(xmltv_sources::table.filter(xmltv_sources::id.eq(source_id)))
        .set((
            xmltv_sources::is_active.eq(is_active_int),
            xmltv_sources::updated_at.eq(&now),
        ))
        .execute(&mut conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    if affected == 0 {
        return Err(EpgSourceError::NotFound.into());
    }

    let updated: XmltvSource = xmltv_sources::table
        .filter(xmltv_sources::id.eq(source_id))
        .first(&mut conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    Ok(XmltvSourceResponse::from(updated))
}

// ============================================================================
// EPG Refresh Commands
// ============================================================================

/// Batch size for inserting programs
const BATCH_SIZE: usize = 500;

/// Refresh EPG data for a single source
///
/// Downloads, parses, and stores XMLTV data from the source URL.
/// Clears existing data before inserting new data.
#[tauri::command]
pub async fn refresh_epg_source(
    db: State<'_, DbConnection>,
    source_id: i32,
) -> Result<(), String> {
    // Get the source from DB
    let mut conn = db
        .get_connection()
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    let source: XmltvSource = xmltv_sources::table
        .filter(xmltv_sources::id.eq(source_id))
        .first(&mut conn)
        .map_err(|e| {
            if e == diesel::NotFound {
                EpgSourceError::NotFound
            } else {
                EpgSourceError::DatabaseError(e.to_string())
            }
        })?;

    // Fetch and parse XMLTV data
    let data = fetch_xmltv(&source.url, &source.format)
        .await
        .map_err(EpgSourceError::from)?;

    let (parsed_channels, parsed_programs) =
        parse_xmltv_data(&data).map_err(EpgSourceError::from)?;

    // Wrap all database operations in a transaction for atomicity
    conn.transaction::<_, EpgSourceError, _>(|conn| {
        // Preserve manual mappings and channel settings before deletion
        let preserved = preserve_channel_data(conn, source_id)
            .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

        // Clear existing data for this source (cascade deletes mappings)
        diesel::delete(xmltv_channels::table.filter(xmltv_channels::source_id.eq(source_id)))
            .execute(conn)
            .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

        // Insert new channels and build mapping from channel_id to db id
        let mut channel_id_map: HashMap<String, i32> = HashMap::new();

        for parsed_channel in &parsed_channels {
        let new_channel = NewXmltvChannel::new(
            source_id,
            &parsed_channel.channel_id,
            &parsed_channel.display_name,
            parsed_channel.icon.clone(),
        );

            let inserted: XmltvChannel = diesel::insert_into(xmltv_channels::table)
                .values(&new_channel)
                .get_result(conn)
                .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

            if let Some(id) = inserted.id {
                channel_id_map.insert(parsed_channel.channel_id.clone(), id);
            }
        }

        // Insert programs in batches for performance
        let mut programs_to_insert: Vec<NewProgram> = Vec::with_capacity(BATCH_SIZE);

        for parsed_program in &parsed_programs {
            // Look up the db id for this program's channel
            if let Some(&channel_db_id) = channel_id_map.get(&parsed_program.channel_id) {
                let mut new_program = NewProgram::new(
                    channel_db_id,
                    &parsed_program.title,
                    &parsed_program.start_time,
                    &parsed_program.end_time,
                );

                if let Some(ref desc) = parsed_program.description {
                    new_program = new_program.with_description(desc);
                }
                if let Some(ref cat) = parsed_program.category {
                    new_program = new_program.with_category(cat);
                }
                if let Some(ref ep) = parsed_program.episode_info {
                    new_program = new_program.with_episode_info(ep);
                }

                programs_to_insert.push(new_program);

                // Insert in batches
                if programs_to_insert.len() >= BATCH_SIZE {
                    diesel::insert_into(programs::table)
                        .values(&programs_to_insert)
                        .execute(conn)
                        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;
                    programs_to_insert.clear();
                }
            }
        }

        // Insert remaining programs
        if !programs_to_insert.is_empty() {
            diesel::insert_into(programs::table)
                .values(&programs_to_insert)
                .execute(conn)
                .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;
        }

        // Restore manual mappings and channel settings
        restore_channel_data(conn, &preserved, &channel_id_map)
            .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

        // Update last_refresh timestamp on the source
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        diesel::update(xmltv_sources::table.filter(xmltv_sources::id.eq(source_id)))
            .set(xmltv_sources::last_refresh.eq(&now))
            .execute(conn)
            .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

        Ok(())
    }).map_err(|e: EpgSourceError| e.to_string())?;

    Ok(())
}

/// Refresh EPG data for all active sources
#[tauri::command]
pub async fn refresh_all_epg_sources(db: State<'_, DbConnection>) -> Result<(), String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    // Get all active sources
    let sources: Vec<XmltvSource> = xmltv_sources::table
        .filter(xmltv_sources::is_active.eq(1))
        .load(&mut conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    // Track errors for reporting
    let mut failed_sources: Vec<String> = Vec::new();
    let mut success_count = 0;

    // Refresh each source
    // Note: We can't use refresh_epg_source directly due to State ownership
    // So we implement the refresh logic inline
    for source in sources {
        let source_id = source.id.unwrap_or(0);

        // Fetch and parse XMLTV data (outside transaction - network I/O)
        let data = match fetch_xmltv(&source.url, &source.format).await {
            Ok(d) => d,
            Err(e) => {
                eprintln!("Failed to fetch source {}: {}", source.name, e);
                failed_sources.push(format!("{}: {}", source.name, e));
                continue; // Skip this source but continue with others
            }
        };

        let (parsed_channels, parsed_programs) = match parse_xmltv_data(&data) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("Failed to parse source {}: {}", source.name, e);
                failed_sources.push(format!("{}: {}", source.name, e));
                continue;
            }
        };

        // Wrap all database operations in a transaction for atomicity
        let result = conn.transaction::<_, diesel::result::Error, _>(|conn| {
            // Preserve manual mappings and channel settings before deletion
            let preserved = preserve_channel_data(conn, source_id)?;

            // Clear existing data for this source
            diesel::delete(xmltv_channels::table.filter(xmltv_channels::source_id.eq(source_id)))
                .execute(conn)?;

            // Insert channels
            let mut channel_id_map: HashMap<String, i32> = HashMap::new();

            for parsed_channel in &parsed_channels {
                let new_channel = NewXmltvChannel::new(
                    source_id,
                    &parsed_channel.channel_id,
                    &parsed_channel.display_name,
                    parsed_channel.icon.clone(),
                );

                let inserted: XmltvChannel = diesel::insert_into(xmltv_channels::table)
                    .values(&new_channel)
                    .get_result(conn)?;

                if let Some(id) = inserted.id {
                    channel_id_map.insert(parsed_channel.channel_id.clone(), id);
                }
            }

            // Insert programs in batches
            let mut programs_to_insert: Vec<NewProgram> = Vec::with_capacity(BATCH_SIZE);

            for parsed_program in &parsed_programs {
                if let Some(&channel_db_id) = channel_id_map.get(&parsed_program.channel_id) {
                    let mut new_program = NewProgram::new(
                        channel_db_id,
                        &parsed_program.title,
                        &parsed_program.start_time,
                        &parsed_program.end_time,
                    );

                    if let Some(ref desc) = parsed_program.description {
                        new_program = new_program.with_description(desc);
                    }
                    if let Some(ref cat) = parsed_program.category {
                        new_program = new_program.with_category(cat);
                    }
                    if let Some(ref ep) = parsed_program.episode_info {
                        new_program = new_program.with_episode_info(ep);
                    }

                    programs_to_insert.push(new_program);

                    if programs_to_insert.len() >= BATCH_SIZE {
                        diesel::insert_into(programs::table)
                            .values(&programs_to_insert)
                            .execute(conn)?;
                        programs_to_insert.clear();
                    }
                }
            }

            // Insert remaining programs
            if !programs_to_insert.is_empty() {
                diesel::insert_into(programs::table)
                    .values(&programs_to_insert)
                    .execute(conn)?;
            }

            // Restore manual mappings and channel settings
            restore_channel_data(conn, &preserved, &channel_id_map)?;

            // Update last_refresh timestamp
            let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
            diesel::update(xmltv_sources::table.filter(xmltv_sources::id.eq(source_id)))
                .set(xmltv_sources::last_refresh.eq(&now))
                .execute(conn)?;

            Ok(())
        });

        match result {
            Ok(()) => {
                success_count += 1;
            }
            Err(e) => {
                eprintln!("Failed to refresh source {}: {}", source.name, e);
                failed_sources.push(format!("{}: {}", source.name, e));
            }
        }
    }

    // Return error if all sources failed
    if !failed_sources.is_empty() && success_count == 0 {
        return Err(format!(
            "All EPG sources failed to refresh: {}",
            failed_sources.join("; ")
        ));
    }

    // Return partial success message if some failed
    if !failed_sources.is_empty() {
        return Err(format!(
            "Some EPG sources failed: {}. {} source(s) refreshed successfully.",
            failed_sources.join("; "),
            success_count
        ));
    }

    Ok(())
}

/// Get EPG statistics for a source
#[tauri::command]
pub async fn get_epg_stats(
    db: State<'_, DbConnection>,
    source_id: i32,
) -> Result<EpgStatsResponse, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    // Get the source (for last_refresh)
    let source: XmltvSource = xmltv_sources::table
        .filter(xmltv_sources::id.eq(source_id))
        .first(&mut conn)
        .map_err(|e| {
            if e == diesel::NotFound {
                EpgSourceError::NotFound
            } else {
                EpgSourceError::DatabaseError(e.to_string())
            }
        })?;

    // Count channels for this source
    let channel_count: i64 = xmltv_channels::table
        .filter(xmltv_channels::source_id.eq(source_id))
        .count()
        .get_result(&mut conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    // Count programs for channels in this source
    let program_count: i64 = programs::table
        .inner_join(xmltv_channels::table)
        .filter(xmltv_channels::source_id.eq(source_id))
        .count()
        .get_result(&mut conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    Ok(EpgStatsResponse {
        channel_count,
        program_count,
        last_refresh: source.last_refresh,
    })
}

/// Get all XMLTV channels for a source
#[tauri::command]
pub async fn get_xmltv_channels(
    db: State<'_, DbConnection>,
    source_id: i32,
) -> Result<Vec<XmltvChannelResponse>, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    let channels: Vec<XmltvChannel> = xmltv_channels::table
        .filter(xmltv_channels::source_id.eq(source_id))
        .order(xmltv_channels::display_name.asc())
        .load(&mut conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    Ok(channels
        .into_iter()
        .map(XmltvChannelResponse::from)
        .collect())
}

/// Get programs for a source (through channels)
#[tauri::command]
pub async fn get_programs(
    db: State<'_, DbConnection>,
    source_id: i32,
) -> Result<Vec<ProgramResponse>, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    let progs: Vec<Program> = programs::table
        .inner_join(xmltv_channels::table)
        .filter(xmltv_channels::source_id.eq(source_id))
        .select(programs::all_columns)
        .order(programs::start_time.asc())
        .load(&mut conn)
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    Ok(progs.into_iter().map(ProgramResponse::from).collect())
}

// ============================================================================
// EPG Schedule Commands
// ============================================================================

use crate::scheduler::{EpgScheduleConfig, EpgScheduler};

/// Response type for EPG schedule
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EpgScheduleResponse {
    pub hour: u8,
    pub minute: u8,
    pub enabled: bool,
    pub last_scheduled_refresh: Option<String>,
}

/// Get the current EPG schedule settings
#[tauri::command]
pub async fn get_epg_schedule(
    db: State<'_, DbConnection>,
) -> Result<EpgScheduleResponse, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    let config = crate::scheduler::get_epg_schedule(&mut conn);
    let last_refresh = crate::scheduler::get_last_scheduled_refresh(&mut conn);

    Ok(EpgScheduleResponse {
        hour: config.hour,
        minute: config.minute,
        enabled: config.enabled,
        last_scheduled_refresh: last_refresh.map(|dt| dt.to_rfc3339()),
    })
}

/// Set the EPG schedule settings
///
/// Updates the schedule in the database and updates the scheduler if running.
#[tauri::command]
pub async fn set_epg_schedule(
    db: State<'_, DbConnection>,
    scheduler: State<'_, EpgScheduler>,
    hour: u8,
    minute: u8,
    enabled: bool,
) -> Result<EpgScheduleResponse, String> {
    // Validate inputs
    if hour > 23 {
        return Err("Hour must be between 0 and 23".to_string());
    }
    if minute > 59 {
        return Err("Minute must be between 0 and 59".to_string());
    }

    let config = EpgScheduleConfig {
        hour,
        minute,
        enabled,
    };

    // Save to database
    {
        let mut conn = db
            .get_connection()
            .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

        crate::scheduler::set_epg_schedule(&mut conn, &config)
            .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;
    }

    // Update the running scheduler
    scheduler
        .set_enabled(enabled)
        .await
        .map_err(|e| format!("Failed to update scheduler enabled state: {}", e))?;

    if enabled {
        scheduler
            .update_schedule(hour, minute)
            .await
            .map_err(|e| format!("Failed to update schedule: {}", e))?;
    }

    // Return updated schedule
    let mut conn = db
        .get_connection()
        .map_err(|e| EpgSourceError::DatabaseError(e.to_string()))?;

    let last_refresh = crate::scheduler::get_last_scheduled_refresh(&mut conn);

    Ok(EpgScheduleResponse {
        hour: config.hour,
        minute: config.minute,
        enabled: config.enabled,
        last_scheduled_refresh: last_refresh.map(|dt| dt.to_rfc3339()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_url_valid() {
        assert!(validate_url("https://example.com/epg.xml").is_ok());
        assert!(validate_url("http://example.com/epg.xml").is_ok());
        assert!(validate_url("https://example.com/epg.xml.gz").is_ok());
    }

    #[test]
    fn test_validate_url_invalid() {
        assert!(validate_url("").is_err());
        assert!(validate_url("not-a-url").is_err());
        assert!(validate_url("ftp://example.com/epg.xml").is_err());
        assert!(validate_url("file:///etc/passwd").is_err());

        // SSRF protection - localhost and private IPs should be blocked
        assert!(validate_url("http://localhost/epg.xml").is_err());
        assert!(validate_url("http://127.0.0.1/epg.xml").is_err());
        assert!(validate_url("http://0.0.0.0/epg.xml").is_err());
        assert!(validate_url("http://10.0.0.1/epg.xml").is_err());
        assert!(validate_url("http://192.168.1.1/epg.xml").is_err());
        assert!(validate_url("http://172.16.0.1/epg.xml").is_err());
        assert!(validate_url("http://169.254.1.1/epg.xml").is_err());
    }

    #[test]
    fn test_validate_format_valid() {
        assert!(validate_format("xml").is_ok());
        assert!(validate_format("xml_gz").is_ok());
        assert!(validate_format("auto").is_ok());
    }

    #[test]
    fn test_validate_format_invalid() {
        assert!(validate_format("json").is_err());
        assert!(validate_format("xml.gz").is_err()); // Note: underscores, not dots
        assert!(validate_format("").is_err());
    }
}
