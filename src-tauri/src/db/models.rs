use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::db::schema::{
    accounts, channel_mappings, event_log, programs, settings, xmltv_channel_settings, xmltv_channels,
    xmltv_sources, xtream_channels,
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
    pub refresh_hour: i32,
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
    #[serde(default = "default_refresh_hour")]
    pub refresh_hour: i32,
    #[serde(default = "default_is_active")]
    pub is_active: i32,
}

fn default_refresh_hour() -> i32 {
    4
}

fn default_is_active() -> i32 {
    1
}

impl NewXmltvSource {
    pub fn new(name: impl Into<String>, url: impl Into<String>, format: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            url: url.into(),
            format: format.into(),
            refresh_hour: default_refresh_hour(),
            is_active: default_is_active(),
        }
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
    pub refresh_hour: Option<i32>,
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

/// Channel mapping model for querying (XMLTV → Xtream associations)
/// One XMLTV channel can have multiple Xtream streams mapped to it
#[derive(Queryable, Selectable, Identifiable, Debug, Clone, Serialize)]
#[diesel(table_name = channel_mappings)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[serde(rename_all = "camelCase")]
pub struct ChannelMapping {
    pub id: Option<i32>,
    pub xmltv_channel_id: i32,
    pub xtream_channel_id: i32,
    pub match_confidence: Option<f32>,
    #[serde(serialize_with = "serialize_optional_bool")]
    pub is_manual: Option<i32>,
    #[serde(serialize_with = "serialize_optional_bool")]
    pub is_primary: Option<i32>,
    pub stream_priority: Option<i32>,
    pub created_at: String,
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

/// New channel mapping for insertion
#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = channel_mappings)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct NewChannelMapping {
    pub xmltv_channel_id: i32,
    pub xtream_channel_id: i32,
    pub match_confidence: Option<f32>,
    pub is_manual: i32,
    pub is_primary: i32,
    pub stream_priority: i32,
}

impl NewChannelMapping {
    pub fn new(
        xmltv_channel_id: i32,
        xtream_channel_id: i32,
        match_confidence: Option<f32>,
        is_primary: bool,
        stream_priority: i32,
    ) -> Self {
        Self {
            xmltv_channel_id,
            xtream_channel_id,
            match_confidence,
            is_manual: 0,
            is_primary: if is_primary { 1 } else { 0 },
            stream_priority,
        }
    }

    pub fn manual(xmltv_channel_id: i32, xtream_channel_id: i32) -> Self {
        Self {
            xmltv_channel_id,
            xtream_channel_id,
            match_confidence: None,
            is_manual: 1,
            is_primary: 1,
            stream_priority: 0,
        }
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
