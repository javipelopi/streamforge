use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::db::schema::{accounts, settings, xmltv_sources, xtream_channels};

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
#[derive(Queryable, Selectable, Identifiable, Debug, Clone, Serialize)]
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
