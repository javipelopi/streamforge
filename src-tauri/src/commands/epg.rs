//! XMLTV EPG Source management Tauri commands
//!
//! This module provides commands for adding, retrieving, updating, and deleting
//! XMLTV source URLs for EPG data.

use diesel::prelude::*;
use serde::Serialize;
use tauri::State;
use thiserror::Error;

use crate::db::{
    schema::xmltv_sources, DbConnection, NewXmltvSource, XmltvSource, XmltvSourceUpdate,
};

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

        // Block private IP ranges (rough check)
        if host_lower.starts_with("10.")
            || host_lower.starts_with("192.168.")
            || host_lower.starts_with("172.16.")
            || host_lower.starts_with("172.17.")
            || host_lower.starts_with("172.18.")
            || host_lower.starts_with("172.19.")
            || host_lower.starts_with("172.20.")
            || host_lower.starts_with("172.21.")
            || host_lower.starts_with("172.22.")
            || host_lower.starts_with("172.23.")
            || host_lower.starts_with("172.24.")
            || host_lower.starts_with("172.25.")
            || host_lower.starts_with("172.26.")
            || host_lower.starts_with("172.27.")
            || host_lower.starts_with("172.28.")
            || host_lower.starts_with("172.29.")
            || host_lower.starts_with("172.30.")
            || host_lower.starts_with("172.31.")
            || host_lower.starts_with("169.254.") {
            return Err(EpgSourceError::InvalidUrl);
        }
    }

    Ok(())
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
