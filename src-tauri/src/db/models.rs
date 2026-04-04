use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::db::schema::{
    accounts, acestream_sources, channel_mappings, event_log, m3u_channels, m3u_sources,
    matching_profiles, programs, settings, xmltv_channel_settings, xmltv_channels, xmltv_sources,
    xtream_channels,
};

#[derive(Queryable, Selectable, Insertable, Debug, Clone)]
#[diesel(table_name = settings)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct Setting {
    pub key: String,
    pub value: String,
}

impl Setting {
    pub fn new(key: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            key: key.into(),
            value: value.into(),
        }
    }
}

/// Account model for querying existing accounts
#[derive(Queryable, Selectable, Identifiable, Debug, Clone)]
#[diesel(table_name = accounts)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct Account {
    pub id: Option<i32>,
    pub name: String,
    pub server_url: String,
    pub username: String,
    pub password_encrypted: Vec<u8>,
    pub max_connections: i32,
    pub is_active: i32,
    pub created_at: String,
    pub updated_at: String,
    // Connection status fields (added in migration)
    pub expiry_date: Option<String>,
    pub max_connections_actual: Option<i32>,
    pub active_connections: Option<i32>,
    pub last_check: Option<String>,
    pub connection_status: Option<String>,
}

/// Changeset for updating account status fields after connection test
#[derive(AsChangeset, Debug)]
#[diesel(table_name = accounts)]
pub struct AccountStatusUpdate {
    pub expiry_date: Option<String>,
    pub max_connections_actual: Option<i32>,
    pub active_connections: Option<i32>,
    pub last_check: Option<String>,
    pub connection_status: Option<String>,
}

/// New account model for inserting records
#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = accounts)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct NewAccount {
    pub name: String,
    pub server_url: String,
    pub username: String,
    pub password_encrypted: Vec<u8>,
    pub max_connections: i32,
    pub is_active: i32,
}

impl NewAccount {
    pub fn new(
        name: impl Into<String>,
        server_url: impl Into<String>,
        username: impl Into<String>,
        password_encrypted: Vec<u8>,
    ) -> Self {
        Self {
            name: name.into(),
            server_url: server_url.into(),
            username: username.into(),
            password_encrypted,
            max_connections: 1,
            is_active: 1,
        }
    }
}

/// Xtream channel model for querying existing channels
#[derive(Queryable, Selectable, Identifiable, Debug, Clone, Serialize, Deserialize)]
#[diesel(table_name = xtream_channels)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[serde(rename_all = "camelCase")]
pub struct XtreamChannel {
    pub id: Option<i32>,
    pub account_id: i32,
    pub stream_id: i32,
    pub name: String,
    pub stream_icon: Option<String>,
    pub category_id: Option<i32>,
    pub category_name: Option<String>,
    pub qualities: Option<String>,
    pub epg_channel_id: Option<String>,
    pub tv_archive: Option<i32>,
    pub tv_archive_duration: Option<i32>,
    pub added_at: Option<String>,
    pub updated_at: Option<String>,
}

/// New xtream channel model for inserting records
#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = xtream_channels)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct NewXtreamChannel {
    pub account_id: i32,
    pub stream_id: i32,
    pub name: String,
    pub stream_icon: Option<String>,
    pub category_id: Option<i32>,
    pub category_name: Option<String>,
    pub qualities: String,
    pub epg_channel_id: Option<String>,
    pub tv_archive: i32,
    pub tv_archive_duration: i32,
}

/// Changeset for updating xtream channel fields
#[derive(AsChangeset, Debug)]
#[diesel(table_name = xtream_channels)]
pub struct XtreamChannelUpdate {
    pub name: String,
    pub stream_icon: Option<String>,
    pub category_id: Option<i32>,
    pub category_name: Option<String>,
    pub qualities: String,
    pub epg_channel_id: Option<String>,
    pub tv_archive: i32,
    pub tv_archive_duration: i32,
    pub updated_at: String,
}

// ============================================================================
// XMLTV Source Models
// ============================================================================

/// XMLTV source model for querying existing sources
#[derive(Queryable, Selectable, Identifiable, Debug, Clone, Serialize)]
#[diesel(table_name = xmltv_sources)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[serde(rename_all = "camelCase")]
pub struct XmltvSource {
    pub id: Option<i32>,
    pub name: String,
    pub url: String,
    pub format: String,
    pub refresh_interval_hours: i32,
    pub last_refresh: Option<String>,
    pub is_active: i32,
    pub created_at: String,
    pub updated_at: String,
}

/// New XMLTV source for insertion
#[derive(Insertable, Debug, Clone, Deserialize)]
#[diesel(table_name = xmltv_sources)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[serde(rename_all = "camelCase")]
pub struct NewXmltvSource {
    pub name: String,
    pub url: String,
    pub format: String,
    #[serde(default = "default_xmltv_refresh_interval")]
    pub refresh_interval_hours: i32,
    #[serde(default = "default_is_active")]
    pub is_active: i32,
    #[serde(default = "default_now")]
    pub created_at: String,
    #[serde(default = "default_now")]
    pub updated_at: String,
}

fn default_now() -> String {
    chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

fn default_xmltv_refresh_interval() -> i32 {
    24
}

fn default_is_active() -> i32 {
    1
}

impl NewXmltvSource {
    pub fn new(name: impl Into<String>, url: impl Into<String>, format: impl Into<String>) -> Self {
        let now = default_now();
        Self {
            name: name.into(),
            url: url.into(),
            format: format.into(),
            refresh_interval_hours: default_xmltv_refresh_interval(),
            is_active: default_is_active(),
            created_at: now.clone(),
            updated_at: now,
        }
    }

    pub fn with_refresh_interval(mut self, hours: i32) -> Self {
        self.refresh_interval_hours = hours;
        self
    }
}

/// XMLTV source update changeset for partial updates
#[derive(AsChangeset, Debug, Clone, Deserialize)]
#[diesel(table_name = xmltv_sources)]
#[serde(rename_all = "camelCase")]
pub struct XmltvSourceUpdate {
    pub name: Option<String>,
    pub url: Option<String>,
    pub format: Option<String>,
    pub refresh_interval_hours: Option<i32>,
    pub is_active: Option<i32>,
    pub updated_at: Option<String>,
}

// ============================================================================
// XMLTV Channel Models
// ============================================================================

/// XMLTV channel model for querying existing channels
#[derive(Queryable, Selectable, Identifiable, Debug, Clone, Serialize)]
#[diesel(table_name = xmltv_channels)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[serde(rename_all = "camelCase")]
pub struct XmltvChannel {
    pub id: Option<i32>,
    pub source_id: i32,
    pub channel_id: String,
    pub display_name: String,
    pub icon: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    /// True if this is a synthetic channel created from an orphan Xtream stream (Story 3-8)
    pub is_synthetic: Option<i32>,
}

/// New XMLTV channel for insertion
#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = xmltv_channels)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct NewXmltvChannel {
    pub source_id: i32,
    pub channel_id: String,
    pub display_name: String,
    pub icon: Option<String>,
    /// True (1) if this is a synthetic channel created from an orphan Xtream stream
    pub is_synthetic: Option<i32>,
}

impl NewXmltvChannel {
    pub fn new(
        source_id: i32,
        channel_id: impl Into<String>,
        display_name: impl Into<String>,
        icon: Option<String>,
    ) -> Self {
        Self {
            source_id,
            channel_id: channel_id.into(),
            display_name: display_name.into(),
            icon,
            is_synthetic: Some(0), // Default: not synthetic (real XMLTV channel)
        }
    }

    /// Create a synthetic XMLTV channel (for orphan Xtream streams promoted to Plex)
    pub fn synthetic(
        source_id: i32,
        channel_id: impl Into<String>,
        display_name: impl Into<String>,
        icon: Option<String>,
    ) -> Self {
        Self {
            source_id,
            channel_id: channel_id.into(),
            display_name: display_name.into(),
            icon,
            is_synthetic: Some(1), // Synthetic channel
        }
    }
}

// ============================================================================
// Program Models
// ============================================================================

/// Program model for querying existing programs
#[derive(Queryable, Selectable, Identifiable, Debug, Clone, Serialize)]
#[diesel(table_name = programs)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[serde(rename_all = "camelCase")]
pub struct Program {
    pub id: Option<i32>,
    pub xmltv_channel_id: i32,
    pub title: String,
    pub description: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub category: Option<String>,
    pub episode_info: Option<String>,
    pub created_at: String,
}

/// New program for insertion
#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = programs)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct NewProgram {
    pub xmltv_channel_id: i32,
    pub title: String,
    pub description: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub category: Option<String>,
    pub episode_info: Option<String>,
}

impl NewProgram {
    pub fn new(
        xmltv_channel_id: i32,
        title: impl Into<String>,
        start_time: impl Into<String>,
        end_time: impl Into<String>,
    ) -> Self {
        Self {
            xmltv_channel_id,
            title: title.into(),
            description: None,
            start_time: start_time.into(),
            end_time: end_time.into(),
            category: None,
            episode_info: None,
        }
    }

    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn with_category(mut self, category: impl Into<String>) -> Self {
        self.category = Some(category.into());
        self
    }

    pub fn with_episode_info(mut self, episode_info: impl Into<String>) -> Self {
        self.episode_info = Some(episode_info.into());
        self
    }
}

// ============================================================================
// Channel Mapping Models (Story 3-1)
// ============================================================================

/// Channel mapping model for querying (XMLTV → Xtream/M3U/Acestream associations)
/// One XMLTV channel can have multiple streams mapped to it from different source types
#[derive(Queryable, Selectable, Identifiable, Debug, Clone, Serialize)]
#[diesel(table_name = channel_mappings)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[serde(rename_all = "camelCase")]
pub struct ChannelMapping {
    pub id: Option<i32>,
    pub xmltv_channel_id: i32,
    /// Xtream channel ID (if source_type = "xtream"), None for non-Xtream mappings (CR-5)
    pub xtream_channel_id: Option<i32>,
    pub match_confidence: Option<f32>,
    #[serde(serialize_with = "serialize_optional_bool")]
    pub is_manual: Option<i32>,
    #[serde(serialize_with = "serialize_optional_bool")]
    pub is_primary: Option<i32>,
    pub stream_priority: Option<i32>,
    pub created_at: String,
    /// Source type: "xtream", "m3u", or "acestream"
    pub source_type: String,
    /// M3U channel ID (if source_type = "m3u")
    pub m3u_channel_id: Option<i32>,
    /// Acestream source ID (if source_type = "acestream")
    pub acestream_source_id: Option<i32>,
}

/// Serialize SQLite INTEGER (0/1) to JSON boolean
fn serialize_optional_bool<S>(value: &Option<i32>, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    match value {
        Some(v) => serializer.serialize_bool(*v != 0),
        None => serializer.serialize_none(),
    }
}

/// New channel mapping for insertion (supports all source types)
/// CR-5: xtream_channel_id is now Option<i32> - set to Some(id) for Xtream, None for M3U/Acestream
#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = channel_mappings)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct NewChannelMapping {
    pub xmltv_channel_id: i32,
    /// Xtream channel ID - Some(id) for Xtream mappings, None for M3U/Acestream (CR-5)
    pub xtream_channel_id: Option<i32>,
    pub match_confidence: Option<f32>,
    pub is_manual: i32,
    pub is_primary: i32,
    pub stream_priority: i32,
    pub source_type: String,
    /// M3U channel ID - Some(id) for M3U mappings, None otherwise
    pub m3u_channel_id: Option<i32>,
    /// Acestream source ID - Some(id) for Acestream mappings, None otherwise
    pub acestream_source_id: Option<i32>,
}

impl NewChannelMapping {
    /// Create a new Xtream channel mapping
    pub fn new(
        xmltv_channel_id: i32,
        xtream_channel_id: i32,
        match_confidence: Option<f32>,
        is_primary: bool,
        stream_priority: i32,
    ) -> Self {
        Self {
            xmltv_channel_id,
            xtream_channel_id: Some(xtream_channel_id),
            match_confidence,
            is_manual: 0,
            is_primary: if is_primary { 1 } else { 0 },
            stream_priority,
            source_type: "xtream".to_string(),
            m3u_channel_id: None,
            acestream_source_id: None,
        }
    }

    /// Create a manual Xtream channel mapping
    pub fn manual(xmltv_channel_id: i32, xtream_channel_id: i32) -> Self {
        Self {
            xmltv_channel_id,
            xtream_channel_id: Some(xtream_channel_id),
            match_confidence: None,
            is_manual: 1,
            is_primary: 1,
            stream_priority: 0,
            source_type: "xtream".to_string(),
            m3u_channel_id: None,
            acestream_source_id: None,
        }
    }

    /// Create a new M3U channel mapping (CR-5: xtream_channel_id = None)
    pub fn m3u(xmltv_channel_id: i32, m3u_channel_id: i32, stream_priority: i32) -> Self {
        Self {
            xmltv_channel_id,
            xtream_channel_id: None,
            match_confidence: Some(1.0),
            is_manual: 1,
            is_primary: 0,
            stream_priority,
            source_type: "m3u".to_string(),
            m3u_channel_id: Some(m3u_channel_id),
            acestream_source_id: None,
        }
    }

    /// Create a new Acestream channel mapping (CR-5: xtream_channel_id = None)
    pub fn acestream(xmltv_channel_id: i32, acestream_source_id: i32, stream_priority: i32) -> Self {
        Self {
            xmltv_channel_id,
            xtream_channel_id: None,
            match_confidence: Some(1.0),
            is_manual: 1,
            is_primary: 0,
            stream_priority,
            source_type: "acestream".to_string(),
            m3u_channel_id: None,
            acestream_source_id: Some(acestream_source_id),
        }
    }

    /// Create a manual M3U channel mapping (for orphan promotion)
    pub fn m3u_manual(xmltv_channel_id: i32, m3u_channel_id: i32) -> Self {
        Self {
            xmltv_channel_id,
            xtream_channel_id: None,
            match_confidence: None,
            is_manual: 1,
            is_primary: 1,
            stream_priority: 0,
            source_type: "m3u".to_string(),
            m3u_channel_id: Some(m3u_channel_id),
            acestream_source_id: None,
        }
    }

    /// Create a manual Acestream channel mapping (for orphan promotion)
    pub fn acestream_manual(xmltv_channel_id: i32, acestream_source_id: i32) -> Self {
        Self {
            xmltv_channel_id,
            xtream_channel_id: None,
            match_confidence: None,
            is_manual: 1,
            is_primary: 1,
            stream_priority: 0,
            source_type: "acestream".to_string(),
            m3u_channel_id: None,
            acestream_source_id: Some(acestream_source_id),
        }
    }

    pub fn with_primary(mut self, is_primary: bool) -> Self {
        self.is_primary = if is_primary { 1 } else { 0 };
        self
    }

    pub fn with_priority(mut self, priority: i32) -> Self {
        self.stream_priority = priority;
        self
    }
}

// ============================================================================
// XMLTV Channel Settings Models (Story 3-1)
// ============================================================================

/// XMLTV channel settings for Plex lineup (one per XMLTV channel)
#[derive(Queryable, Selectable, Identifiable, Debug, Clone, Serialize)]
#[diesel(table_name = xmltv_channel_settings)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[serde(rename_all = "camelCase")]
pub struct XmltvChannelSettings {
    pub id: Option<i32>,
    pub xmltv_channel_id: i32,
    pub is_enabled: Option<i32>,
    pub plex_display_order: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
}

/// New XMLTV channel settings for insertion
#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = xmltv_channel_settings)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct NewXmltvChannelSettings {
    pub xmltv_channel_id: i32,
    pub is_enabled: i32,
    pub plex_display_order: Option<i32>,
}

impl NewXmltvChannelSettings {
    pub fn new(xmltv_channel_id: i32, is_enabled: bool) -> Self {
        Self {
            xmltv_channel_id,
            is_enabled: if is_enabled { 1 } else { 0 },
            plex_display_order: None,
        }
    }

    pub fn disabled(xmltv_channel_id: i32) -> Self {
        Self::new(xmltv_channel_id, false)
    }

    pub fn enabled(xmltv_channel_id: i32) -> Self {
        Self::new(xmltv_channel_id, true)
    }

    pub fn with_display_order(mut self, order: i32) -> Self {
        self.plex_display_order = Some(order);
        self
    }
}

/// Changeset for updating XMLTV channel settings
#[derive(AsChangeset, Debug, Clone)]
#[diesel(table_name = xmltv_channel_settings)]
pub struct XmltvChannelSettingsUpdate {
    pub is_enabled: Option<i32>,
    pub plex_display_order: Option<i32>,
    pub updated_at: Option<String>,
}

// ============================================================================
// Event Log Models (Story 3-4)
// ============================================================================

/// Event log entry model for querying
#[derive(Queryable, Selectable, Identifiable, Debug, Clone, Serialize)]
#[diesel(table_name = event_log)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[serde(rename_all = "camelCase")]
pub struct EventLog {
    pub id: Option<i32>,
    pub timestamp: String,
    pub level: String,
    pub category: String,
    pub message: String,
    pub details: Option<String>,
    #[serde(serialize_with = "serialize_bool")]
    pub is_read: i32,
}

/// Serialize SQLite INTEGER (0/1) to JSON boolean
fn serialize_bool<S>(value: &i32, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_bool(*value != 0)
}

/// New event log entry for insertion
#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = event_log)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct NewEventLog {
    pub level: String,
    pub category: String,
    pub message: String,
    pub details: Option<String>,
}

impl NewEventLog {
    pub fn new(level: impl Into<String>, category: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            level: level.into(),
            category: category.into(),
            message: message.into(),
            details: None,
        }
    }

    pub fn with_details(mut self, details: impl Into<String>) -> Self {
        self.details = Some(details.into());
        self
    }

    /// Create an info-level event
    pub fn info(category: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new("info", category, message)
    }

    /// Create a warn-level event
    pub fn warn(category: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new("warn", category, message)
    }

    /// Create an error-level event
    pub fn error(category: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new("error", category, message)
    }
}

/// Event level enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EventLevel {
    Info,
    Warn,
    Error,
}

impl std::fmt::Display for EventLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EventLevel::Info => write!(f, "info"),
            EventLevel::Warn => write!(f, "warn"),
            EventLevel::Error => write!(f, "error"),
        }
    }
}

/// Event category enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EventCategory {
    Connection,
    Stream,
    Match,
    Epg,
    System,
    Provider,
}

impl std::fmt::Display for EventCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EventCategory::Connection => write!(f, "connection"),
            EventCategory::Stream => write!(f, "stream"),
            EventCategory::Match => write!(f, "match"),
            EventCategory::Epg => write!(f, "epg"),
            EventCategory::System => write!(f, "system"),
            EventCategory::Provider => write!(f, "provider"),
        }
    }
}

// ============================================================================
// M3U Source Models
// ============================================================================

/// M3U source model for querying existing sources
#[derive(Queryable, Selectable, Identifiable, Debug, Clone, Serialize)]
#[diesel(table_name = m3u_sources)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[serde(rename_all = "camelCase")]
pub struct M3uSource {
    pub id: Option<i32>,
    pub name: String,
    pub url: String,
    pub refresh_interval_hours: i32,
    pub last_refresh: Option<String>,
    pub is_active: i32,
    pub created_at: String,
    pub updated_at: String,
    pub is_local_file: i32,
}

/// New M3U source for insertion
#[derive(Insertable, Debug, Clone, Deserialize)]
#[diesel(table_name = m3u_sources)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[serde(rename_all = "camelCase")]
pub struct NewM3uSource {
    pub name: String,
    pub url: String,
    #[serde(default = "default_m3u_refresh_interval")]
    pub refresh_interval_hours: i32,
    #[serde(default = "default_is_active")]
    pub is_active: i32,
    #[serde(default)]
    pub is_local_file: i32,
}

fn default_m3u_refresh_interval() -> i32 {
    24
}

impl NewM3uSource {
    pub fn new(name: impl Into<String>, url: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            url: url.into(),
            refresh_interval_hours: default_m3u_refresh_interval(),
            is_active: default_is_active(),
            is_local_file: 0,
        }
    }

    pub fn with_refresh_interval(mut self, hours: i32) -> Self {
        self.refresh_interval_hours = hours;
        self
    }

    pub fn with_local_file(mut self, is_local: bool) -> Self {
        self.is_local_file = if is_local { 1 } else { 0 };
        self
    }
}

/// M3U source update changeset
#[derive(AsChangeset, Debug, Clone, Deserialize)]
#[diesel(table_name = m3u_sources)]
#[serde(rename_all = "camelCase")]
pub struct M3uSourceUpdate {
    pub name: Option<String>,
    pub url: Option<String>,
    pub refresh_interval_hours: Option<i32>,
    pub is_active: Option<i32>,
    pub last_refresh: Option<String>,
    pub updated_at: Option<String>,
}

// ============================================================================
// M3U Channel Models
// ============================================================================

/// M3U channel model for querying parsed channels from M3U playlists
#[derive(Queryable, Selectable, Identifiable, Debug, Clone, Serialize, Deserialize)]
#[diesel(table_name = m3u_channels)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[serde(rename_all = "camelCase")]
pub struct M3uChannel {
    pub id: Option<i32>,
    pub source_id: i32,
    pub stream_url: String,
    pub name: String,
    pub tvg_id: Option<String>,
    pub tvg_name: Option<String>,
    pub tvg_logo: Option<String>,
    pub group_title: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// New M3U channel for insertion
#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = m3u_channels)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct NewM3uChannel {
    pub source_id: i32,
    pub stream_url: String,
    pub name: String,
    pub tvg_id: Option<String>,
    pub tvg_name: Option<String>,
    pub tvg_logo: Option<String>,
    pub group_title: Option<String>,
}

impl NewM3uChannel {
    pub fn new(source_id: i32, stream_url: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            source_id,
            stream_url: stream_url.into(),
            name: name.into(),
            tvg_id: None,
            tvg_name: None,
            tvg_logo: None,
            group_title: None,
        }
    }

    pub fn with_tvg_id(mut self, tvg_id: impl Into<String>) -> Self {
        self.tvg_id = Some(tvg_id.into());
        self
    }

    pub fn with_tvg_name(mut self, tvg_name: impl Into<String>) -> Self {
        self.tvg_name = Some(tvg_name.into());
        self
    }

    pub fn with_tvg_logo(mut self, tvg_logo: impl Into<String>) -> Self {
        self.tvg_logo = Some(tvg_logo.into());
        self
    }

    pub fn with_group_title(mut self, group_title: impl Into<String>) -> Self {
        self.group_title = Some(group_title.into());
        self
    }
}

// ============================================================================
// Acestream Source Models
// ============================================================================

/// Acestream source model for querying existing sources
#[derive(Queryable, Selectable, Identifiable, Debug, Clone, Serialize)]
#[diesel(table_name = acestream_sources)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[serde(rename_all = "camelCase")]
pub struct AcestreamSource {
    pub id: Option<i32>,
    pub name: String,
    pub content_id: String,
    pub is_active: i32,
    pub created_at: String,
    pub updated_at: String,
}

/// New Acestream source for insertion
#[derive(Insertable, Debug, Clone, Deserialize)]
#[diesel(table_name = acestream_sources)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[serde(rename_all = "camelCase")]
pub struct NewAcestreamSource {
    pub name: String,
    pub content_id: String,
    #[serde(default = "default_is_active")]
    pub is_active: i32,
}

impl NewAcestreamSource {
    pub fn new(name: impl Into<String>, content_id: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            content_id: content_id.into(),
            is_active: default_is_active(),
        }
    }

    /// Create from an acestream:// URL, extracting and validating the content ID
    /// Content ID must be exactly 40 hexadecimal characters
    pub fn from_url(name: impl Into<String>, url: &str) -> Option<Self> {
        let content_id = url
            .strip_prefix("acestream://")
            .map(|s| s.trim().to_lowercase())?;

        // Validate content ID format (40 hex characters)
        if content_id.len() != 40 || !content_id.chars().all(|c| c.is_ascii_hexdigit()) {
            return None;
        }

        Some(Self::new(name, content_id))
    }
}

/// Acestream source update changeset
#[derive(AsChangeset, Debug, Clone, Deserialize)]
#[diesel(table_name = acestream_sources)]
#[serde(rename_all = "camelCase")]
pub struct AcestreamSourceUpdate {
    pub name: Option<String>,
    pub content_id: Option<String>,
    pub is_active: Option<i32>,
    pub updated_at: Option<String>,
}

// ============================================================================
// Extended Channel Mapping Models (Multi-Source Support)
// ============================================================================

/// Source type enumeration for channel mappings
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SourceType {
    Xtream,
    M3u,
    Acestream,
}

impl std::fmt::Display for SourceType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SourceType::Xtream => write!(f, "xtream"),
            SourceType::M3u => write!(f, "m3u"),
            SourceType::Acestream => write!(f, "acestream"),
        }
    }
}

impl std::str::FromStr for SourceType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "xtream" => Ok(SourceType::Xtream),
            "m3u" => Ok(SourceType::M3u),
            "acestream" => Ok(SourceType::Acestream),
            _ => Err(format!("Unknown source type: {}", s)),
        }
    }
}

/// Extended channel mapping with multi-source support
#[derive(Queryable, Selectable, Identifiable, Debug, Clone, Serialize)]
#[diesel(table_name = channel_mappings)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[serde(rename_all = "camelCase")]
pub struct ChannelMappingExtended {
    pub id: Option<i32>,
    pub xmltv_channel_id: i32,
    /// Xtream channel ID - None for non-Xtream mappings (CR-5)
    pub xtream_channel_id: Option<i32>,
    pub match_confidence: Option<f32>,
    #[serde(serialize_with = "serialize_optional_bool")]
    pub is_manual: Option<i32>,
    #[serde(serialize_with = "serialize_optional_bool")]
    pub is_primary: Option<i32>,
    pub stream_priority: Option<i32>,
    pub created_at: String,
    pub source_type: String,
    pub m3u_channel_id: Option<i32>,
    pub acestream_source_id: Option<i32>,
}

/// New channel mapping for M3U sources (CR-5: xtream_channel_id is now None, not 0)
#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = channel_mappings)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct NewM3uChannelMapping {
    pub xmltv_channel_id: i32,
    pub xtream_channel_id: Option<i32>, // CR-5: None for non-Xtream mappings
    pub m3u_channel_id: Option<i32>,
    pub source_type: String,
    pub is_manual: i32,
    pub is_primary: i32,
    pub stream_priority: i32,
}

impl NewM3uChannelMapping {
    pub fn new(xmltv_channel_id: i32, m3u_channel_id: i32, stream_priority: i32) -> Self {
        Self {
            xmltv_channel_id,
            xtream_channel_id: None, // CR-5: None for non-Xtream mappings
            m3u_channel_id: Some(m3u_channel_id),
            source_type: "m3u".to_string(),
            is_manual: 1,
            is_primary: 0,
            stream_priority,
        }
    }

    pub fn with_primary(mut self) -> Self {
        self.is_primary = 1;
        self
    }
}

/// New channel mapping for M3U sources with match confidence (for auto-matching)
/// CR-5: xtream_channel_id is now None, not 0
#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = channel_mappings)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct NewM3uAutoMatchMapping {
    pub xmltv_channel_id: i32,
    pub xtream_channel_id: Option<i32>, // CR-5: None for non-Xtream mappings
    pub m3u_channel_id: Option<i32>,
    pub source_type: String,
    pub match_confidence: Option<f32>,
    pub is_manual: i32,
    pub is_primary: i32,
    pub stream_priority: i32,
}

impl NewM3uAutoMatchMapping {
    pub fn new(
        xmltv_channel_id: i32,
        m3u_channel_id: i32,
        confidence: f32,
        is_primary: bool,
        stream_priority: i32,
    ) -> Self {
        Self {
            xmltv_channel_id,
            xtream_channel_id: None, // CR-5: None for non-Xtream mappings
            m3u_channel_id: Some(m3u_channel_id),
            source_type: "m3u".to_string(),
            match_confidence: Some(confidence),
            is_manual: 0, // Auto-matched
            is_primary: if is_primary { 1 } else { 0 },
            stream_priority,
        }
    }
}

/// New channel mapping for Acestream sources (CR-5: xtream_channel_id is now None, not 0)
#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = channel_mappings)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct NewAcestreamChannelMapping {
    pub xmltv_channel_id: i32,
    pub xtream_channel_id: Option<i32>, // CR-5: None for non-Xtream mappings
    pub acestream_source_id: Option<i32>,
    pub source_type: String,
    pub is_manual: i32,
    pub is_primary: i32,
    pub stream_priority: i32,
}

impl NewAcestreamChannelMapping {
    pub fn new(xmltv_channel_id: i32, acestream_source_id: i32, stream_priority: i32) -> Self {
        Self {
            xmltv_channel_id,
            xtream_channel_id: None, // CR-5: None for non-Xtream mappings
            acestream_source_id: Some(acestream_source_id),
            source_type: "acestream".to_string(),
            is_manual: 1,
            is_primary: 0,
            stream_priority,
        }
    }

    pub fn with_primary(mut self) -> Self {
        self.is_primary = 1;
        self
    }
}

// ============================================================================
// Matching Profile Models (per-source-pair normalization rules)
// ============================================================================

/// A matching rule: prefix and suffix added to XMLTV names to match provider names.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizationRule {
    #[serde(default)]
    pub prefix: String,
    #[serde(default)]
    pub suffix: String,
}

/// Matching profile for querying existing profiles
#[derive(Queryable, Selectable, Identifiable, Debug, Clone, Serialize)]
#[diesel(table_name = matching_profiles)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[serde(rename_all = "camelCase")]
pub struct MatchingProfile {
    pub id: Option<i32>,
    pub xmltv_source_id: i32,
    pub stream_source_type: String,
    pub stream_source_id: i32,
    pub priority_order: i32,
    pub rules: String,
    pub is_active: i32,
    pub created_at: String,
    pub updated_at: String,
    pub require_prefix: i32,
    pub require_suffix: i32,
}

impl MatchingProfile {
    /// Parse the JSON rules column into structured normalization rules
    pub fn parsed_rules(&self) -> Vec<NormalizationRule> {
        serde_json::from_str(&self.rules).unwrap_or_default()
    }
}

/// New matching profile for insertion
#[derive(Insertable, Debug, Clone, Deserialize)]
#[diesel(table_name = matching_profiles)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[serde(rename_all = "camelCase")]
pub struct NewMatchingProfile {
    pub xmltv_source_id: i32,
    pub stream_source_type: String,
    pub stream_source_id: i32,
    pub priority_order: i32,
    pub rules: String,
    #[serde(default = "default_is_active")]
    pub is_active: i32,
    #[serde(default = "default_is_active")]
    pub require_prefix: i32,
    #[serde(default = "default_is_active")]
    pub require_suffix: i32,
}

/// Changeset for updating a matching profile
#[derive(AsChangeset, Debug, Clone, Deserialize)]
#[diesel(table_name = matching_profiles)]
#[serde(rename_all = "camelCase")]
pub struct MatchingProfileUpdate {
    pub priority_order: Option<i32>,
    pub rules: Option<String>,
    pub is_active: Option<i32>,
    pub updated_at: Option<String>,
    pub require_prefix: Option<i32>,
    pub require_suffix: Option<i32>,
}
