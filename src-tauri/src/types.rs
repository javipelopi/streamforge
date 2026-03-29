//! Shared types used across commands, services, and server layers.
//!
//! These types were extracted from `commands/` so that `services/` and `server/`
//! can use them without depending on the `gui`-gated `commands` module.

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::db::models::{
    Account, ChannelMapping, EventLog, Program, XmltvChannel, XmltvSource, XtreamChannel,
};
use crate::xmltv::XmltvError;

// ============================================================================
// Account types (from commands/accounts.rs)
// ============================================================================

/// Error types for account operations
#[derive(Debug, Error)]
pub enum AccountError {
    #[error("Account name is required")]
    NameRequired,

    #[error("Server URL is required")]
    ServerUrlRequired,

    #[error("Server URL format is invalid - must start with http:// or https://")]
    InvalidServerUrl,

    #[error("Username is required")]
    UsernameRequired,

    #[error("Password is required")]
    PasswordRequired,

    #[error("Failed to store credentials securely")]
    CredentialStorageError,

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Account not found")]
    NotFound,

    #[error("Failed to get app data directory")]
    AppDataDirError,
}

impl From<AccountError> for String {
    fn from(err: AccountError) -> Self {
        err.to_string()
    }
}

/// Response type for account data (excludes password)
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AccountResponse {
    pub id: i32,
    pub name: String,
    pub server_url: String,
    pub username: String,
    pub max_connections: i32,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
    // Connection status fields
    pub connection_status: Option<String>,
    pub expiry_date: Option<String>,
    pub max_connections_actual: Option<i32>,
    pub active_connections: Option<i32>,
}

impl From<Account> for AccountResponse {
    fn from(account: Account) -> Self {
        Self {
            id: account.id.unwrap_or(0),
            name: account.name,
            server_url: account.server_url,
            username: account.username,
            max_connections: account.max_connections,
            is_active: account.is_active != 0,
            created_at: account.created_at,
            updated_at: account.updated_at,
            connection_status: account.connection_status,
            expiry_date: account.expiry_date,
            max_connections_actual: account.max_connections_actual,
            active_connections: account.active_connections,
        }
    }
}

/// Request type for adding a new account
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddAccountRequest {
    pub name: String,
    pub server_url: String,
    pub username: String,
    pub password: String,
}

/// Request type for updating an account
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAccountRequest {
    pub name: String,
    pub server_url: String,
    pub username: String,
    pub password: Option<String>,
}

/// Response type for test_connection command
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TestConnectionResponse {
    pub success: bool,
    pub status: Option<String>,
    pub expiry_date: Option<String>,
    pub max_connections: Option<i32>,
    pub active_connections: Option<i32>,
    pub error_message: Option<String>,
    pub suggestions: Option<Vec<String>>,
}

// ============================================================================
// Channel types (from commands/channels.rs)
// ============================================================================

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
        let qualities: Vec<String> = channel
            .qualities
            .as_deref()
            .map(|q| serde_json::from_str(q).unwrap_or_else(|_| vec!["SD".to_string()]))
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

/// Enhanced response type for scan_and_rematch command
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScanAndRematchResponse {
    pub success: bool,
    /// Total channels from provider
    pub total_channels: i32,
    /// New channels from provider (not auto-matched yet)
    pub new_channels: i32,
    /// Channels with updated metadata
    pub updated_channels: i32,
    /// Channels removed from provider
    pub removed_channels: i32,
    /// New XMLTV matches created by auto-rematch
    pub new_matches: i32,
    /// Mappings removed (due to removed streams)
    pub removed_matches: i32,
    /// Mappings with updated confidence
    pub updated_matches: i32,
    /// Manual matches preserved (not auto-removed)
    pub preserved_manual_matches: i32,
    /// Scan duration in milliseconds
    pub scan_duration_ms: u64,
    /// Error message if failed
    pub error_message: Option<String>,
}

// ============================================================================
// EPG types (from commands/epg.rs)
// ============================================================================

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

/// Response type for XMLTV source data
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct XmltvSourceResponse {
    pub id: i32,
    pub name: String,
    pub url: String,
    pub format: String,
    pub refresh_interval_hours: i32,
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
            refresh_interval_hours: source.refresh_interval_hours,
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

/// Response type for EPG schedule
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EpgScheduleResponse {
    pub hour: u8,
    pub minute: u8,
    pub enabled: bool,
    pub last_scheduled_refresh: Option<String>,
}

/// Program data for EPG grid display
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EpgGridProgram {
    pub id: i32,
    pub title: String,
    pub start_time: String,
    pub end_time: String,
    pub category: Option<String>,
    pub description: Option<String>,
    pub episode_info: Option<String>,
}

/// Match type for search result relevance
#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum SearchMatchType {
    Title,
    Channel,
    Description,
}

/// Result type for search results (program vs channel-only)
#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum SearchResultType {
    Program,
    Channel,
}

/// Search result for EPG program search
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EpgSearchResult {
    pub result_type: SearchResultType,
    pub program_id: Option<i32>,
    pub title: String,
    pub description: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub category: Option<String>,
    pub channel_id: i32,
    pub channel_name: String,
    pub channel_icon: Option<String>,
    pub match_type: SearchMatchType,
    pub relevance_score: f64,
}

/// Channel data with programs for EPG grid display
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EpgGridChannel {
    pub channel_id: i32,
    pub channel_name: String,
    pub channel_icon: Option<String>,
    pub plex_display_order: i32,
    pub programs: Vec<EpgGridProgram>,
}

/// Stream info for program details panel
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChannelStreamInfo {
    pub stream_name: String,
    pub quality_tiers: Vec<String>,
    pub is_primary: bool,
    pub match_confidence: f64,
}

/// Channel info for program details panel
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChannelInfo {
    pub id: i32,
    pub display_name: String,
    pub icon: Option<String>,
}

/// Program with associated channel information
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProgramWithChannel {
    pub program: ProgramResponse,
    pub channel: ChannelInfo,
}

// ============================================================================
// Log types (from commands/logs.rs)
// ============================================================================

/// Response type for event log queries
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EventLogResponse {
    pub events: Vec<EventLog>,
    pub total_count: i64,
    pub unread_count: i64,
}

/// Input parameters for log_event command
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LogEventInput {
    pub level: String,
    pub category: String,
    pub message: String,
    pub details: Option<String>,
}

// ============================================================================
// M3U types (from commands/m3u_sources.rs)
// ============================================================================

/// M3U source with channel count for display
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct M3uSourceWithStats {
    pub id: i32,
    pub name: String,
    pub url: String,
    pub refresh_interval_hours: i32,
    pub last_refresh: Option<String>,
    pub is_active: bool,
    pub is_local_file: bool,
    pub created_at: String,
    pub channel_count: i32,
}

/// M3U channel for frontend display
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct M3uChannelResponse {
    pub id: i32,
    pub source_id: i32,
    pub stream_url: String,
    pub name: String,
    pub tvg_id: Option<String>,
    pub tvg_name: Option<String>,
    pub tvg_logo: Option<String>,
    pub group_title: Option<String>,
    /// "linked" | "orphan" | "promoted"
    pub link_status: String,
    /// XMLTV channel IDs this channel is linked to
    pub linked_xmltv_ids: Vec<i32>,
}

/// Input for adding a new M3U source
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddM3uSourceInput {
    pub name: String,
    pub url: String,
    pub refresh_interval_hours: Option<i32>,
    #[serde(default)]
    pub is_local_file: bool,
    #[serde(default)]
    pub is_single_stream: bool,
}

/// Input for updating an existing M3U source
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateM3uSourceInput {
    pub name: Option<String>,
    pub url: Option<String>,
    pub refresh_interval_hours: Option<i32>,
}

/// Result of refreshing an M3U source
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshM3uResult {
    pub source_id: i32,
    pub channels_added: i32,
    pub channels_removed: i32,
    pub total_channels: i32,
}

// ============================================================================
// Acestream types (from commands/acestream_sources.rs)
// ============================================================================

/// Acestream source for frontend display
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcestreamSourceResponse {
    pub id: i32,
    pub name: String,
    pub content_id: String,
    pub is_active: bool,
    pub created_at: String,
    /// Pre-computed stream URL for display
    pub stream_url: Option<String>,
    /// "linked" | "orphan" | "promoted"
    pub link_status: String,
    /// XMLTV channel IDs this source is linked to
    pub linked_xmltv_ids: Vec<i32>,
}

/// Input for adding a new Acestream source
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddAcestreamSourceInput {
    pub name: String,
    /// Can be either content ID or acestream:// URL
    pub content_id_or_url: String,
}

/// Input for updating an existing Acestream source
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAcestreamSourceInput {
    pub name: Option<String>,
}

// ============================================================================
// Matcher types (from commands/matcher.rs)
// ============================================================================

/// Response type for match operations
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchResponse {
    pub success: bool,
    pub matched_count: usize,
    pub unmatched_count: usize,
    pub total_xmltv: usize,
    pub total_source_channels: usize,
    pub duration_ms: u64,
    pub message: String,
}

/// Response type for M3U auto-match operations
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct M3uAutoMatchResponse {
    pub success: bool,
    pub matched_count: usize,
    pub unmatched_count: usize,
    pub total_m3u_channels: usize,
    pub total_xmltv_channels: usize,
    pub duration_ms: u64,
    pub mappings_created: i32,
    pub message: String,
}

// ============================================================================
// XMLTV channel types (from commands/xmltv_channels/)
// ============================================================================

/// Source ID marker for synthetic XMLTV channels (promoted orphans)
pub const SYNTHETIC_SOURCE_ID: i32 = -1;

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
    /// True if this is a manual match pointing to a stream that no longer exists
    pub is_orphaned: bool,
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

/// Parse qualities string (JSON array or comma-separated) into Vec<String>
pub fn parse_qualities(qualities: &Option<String>) -> Vec<String> {
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

/// Build an XtreamStreamMatch from a mapping and stream.
/// Centralizes the construction to avoid code duplication across commands.
pub fn build_stream_match(mapping: &ChannelMapping, stream: &XtreamChannel) -> Option<XtreamStreamMatch> {
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
        is_orphaned: false,
    })
}

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

/// Target Lineup channel response (simplified for lineup view)
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TargetLineupChannel {
    pub id: i32,
    pub display_name: String,
    pub icon: Option<String>,
    pub is_enabled: bool,
    pub is_synthetic: bool,
    /// Number of Xtream streams mapped to this channel
    pub stream_count: i32,
    /// Display order in Plex lineup
    pub plex_display_order: Option<i32>,
}

/// XMLTV channel with mapping info for Sources view
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct XmltvSourceChannel {
    pub id: i32,
    pub source_id: i32,
    pub channel_id: String,
    pub display_name: String,
    pub icon: Option<String>,
    pub is_synthetic: bool,
    /// Whether channel is in the Plex lineup
    pub is_enabled: bool,
    /// Number of Xtream streams mapped to this channel
    pub match_count: i32,
}
