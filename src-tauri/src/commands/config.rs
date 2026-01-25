//! Configuration export/import Tauri commands
//!
//! Story 6-2: Configuration Export/Import
//! Story 6-3: Configuration change event logging
//!
//! This module provides commands for exporting and importing application configuration,
//! enabling backup/restore and migration between machines.
//!
//! SECURITY: Passwords are NEVER exported. Accounts are imported with empty passwords
//! and users must re-enter credentials after import.

use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use tauri::State;
use thiserror::Error;

use crate::commands::logs::log_event_internal;
use crate::db::{
    schema::{accounts, channel_mappings, settings, xmltv_channel_settings, xmltv_sources},
    Account, ChannelMapping, DbConnection, NewAccount, NewXmltvSource, Setting,
    XmltvChannelSettings, XmltvSource,
};

/// Current configuration export format version
const CONFIG_VERSION: &str = "1.0";

/// Minimum supported import version
const MIN_SUPPORTED_VERSION: &str = "1.0";

/// Error types for configuration operations
#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Failed to serialize configuration: {0}")]
    SerializationError(String),

    #[error("Failed to parse configuration file: {0}")]
    ParseError(String),

    #[error("Invalid configuration file format")]
    InvalidFormat,

    #[error("Unsupported configuration version: {0}. Minimum supported: {1}")]
    UnsupportedVersion(String, String),

    #[error("Missing required field: {0}")]
    MissingField(String),

    #[error("Import failed: {0}")]
    ImportFailed(String),

    #[error("File operation failed: {0}")]
    FileError(String),
}

impl From<ConfigError> for String {
    fn from(err: ConfigError) -> Self {
        err.to_string()
    }
}

// ============================================================================
// Export Data Structures (Task 1.1)
// ============================================================================

/// Exported settings (key-value pairs)
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExportedSettings {
    pub server_port: Option<String>,
    pub autostart_enabled: Option<String>,
    pub epg_schedule_hour: Option<String>,
    pub epg_schedule_minute: Option<String>,
    pub epg_schedule_enabled: Option<String>,
    pub match_threshold: Option<String>,
}

/// Exported account (excludes password_encrypted for security)
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExportedAccount {
    pub id: i32,
    pub name: String,
    pub server_url: String,
    pub username: String,
    pub max_connections: i32,
    pub is_active: bool,
}

/// Exported XMLTV source
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExportedXmltvSource {
    pub id: i32,
    pub name: String,
    pub url: String,
    pub format: String,
    pub refresh_hour: i32,
    pub is_active: bool,
}

/// Exported channel mapping
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExportedChannelMapping {
    pub xmltv_channel_id: i32,
    pub xtream_channel_id: i32,
    pub match_confidence: Option<f32>,
    pub is_manual: bool,
    pub is_primary: bool,
    pub stream_priority: i32,
}

/// Exported XMLTV channel settings
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExportedXmltvChannelSettings {
    pub xmltv_channel_id: i32,
    pub is_enabled: bool,
    pub plex_display_order: Option<i32>,
}

/// Data section of the export file
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExportData {
    pub settings: ExportedSettings,
    pub accounts: Vec<ExportedAccount>,
    pub xmltv_sources: Vec<ExportedXmltvSource>,
    pub channel_mappings: Vec<ExportedChannelMapping>,
    pub xmltv_channel_settings: Vec<ExportedXmltvChannelSettings>,
}

/// Complete configuration export structure
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConfigExport {
    pub version: String,
    pub export_date: String,
    pub app_version: String,
    pub data: ExportData,
}

// ============================================================================
// Import Preview Structures (Task 2.1)
// ============================================================================

/// Preview of what will be imported (for user confirmation dialog)
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub valid: bool,
    pub version: String,
    pub export_date: String,
    pub account_count: usize,
    pub xmltv_source_count: usize,
    pub channel_mapping_count: usize,
    pub xmltv_channel_settings_count: usize,
    pub settings_summary: Vec<String>,
    pub error_message: Option<String>,
}

/// Result of import operation
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub success: bool,
    pub accounts_imported: usize,
    pub xmltv_sources_imported: usize,
    pub channel_mappings_imported: usize,
    pub settings_imported: usize,
    pub message: String,
}

// ============================================================================
// Export Command (Task 1.2 - 1.9)
// ============================================================================

/// Export all configuration data to JSON
///
/// Story 6-2: AC #1, #2
///
/// Returns the complete configuration as a JSON string.
/// The frontend will use Tauri's file dialog to save to user-selected location.
#[tauri::command]
pub fn export_configuration(db: State<DbConnection>) -> Result<String, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| ConfigError::DatabaseError(e.to_string()))?;

    // Query all settings (Task 1.3)
    let settings_rows: Vec<Setting> = settings::table
        .load(&mut conn)
        .map_err(|e| {
            eprintln!("Export failed: Could not query settings - {}", e);
            ConfigError::DatabaseError(e.to_string())
        })?;

    let mut exported_settings = ExportedSettings {
        server_port: None,
        autostart_enabled: None,
        epg_schedule_hour: None,
        epg_schedule_minute: None,
        epg_schedule_enabled: None,
        match_threshold: None,
    };

    for setting in settings_rows {
        match setting.key.as_str() {
            "server_port" => exported_settings.server_port = Some(setting.value),
            "autostart_enabled" => exported_settings.autostart_enabled = Some(setting.value),
            "epg_schedule_hour" => exported_settings.epg_schedule_hour = Some(setting.value),
            "epg_schedule_minute" => exported_settings.epg_schedule_minute = Some(setting.value),
            "epg_schedule_enabled" => exported_settings.epg_schedule_enabled = Some(setting.value),
            "match_threshold" => exported_settings.match_threshold = Some(setting.value),
            _ => {} // Skip other settings
        }
    }

    // Query all accounts - EXCLUDE password_encrypted (Task 1.4)
    let account_rows: Vec<Account> = accounts::table
        .load(&mut conn)
        .map_err(|e| {
            eprintln!("Export failed: Could not query accounts - {}", e);
            ConfigError::DatabaseError(e.to_string())
        })?;

    let exported_accounts: Vec<ExportedAccount> = account_rows
        .into_iter()
        .map(|a| ExportedAccount {
            id: a.id.unwrap_or(0),
            name: a.name,
            server_url: a.server_url,
            username: a.username,
            max_connections: a.max_connections,
            is_active: a.is_active != 0,
        })
        .collect();

    // Query all XMLTV sources (Task 1.5)
    let source_rows: Vec<XmltvSource> = xmltv_sources::table
        .load(&mut conn)
        .map_err(|e| ConfigError::DatabaseError(e.to_string()))?;

    let exported_sources: Vec<ExportedXmltvSource> = source_rows
        .into_iter()
        .map(|s| ExportedXmltvSource {
            id: s.id.unwrap_or(0),
            name: s.name,
            url: s.url,
            format: s.format,
            refresh_hour: s.refresh_hour,
            is_active: s.is_active != 0,
        })
        .collect();

    // Query all channel mappings (Task 1.6)
    let mapping_rows: Vec<ChannelMapping> = channel_mappings::table
        .load(&mut conn)
        .map_err(|e| ConfigError::DatabaseError(e.to_string()))?;

    let exported_mappings: Vec<ExportedChannelMapping> = mapping_rows
        .into_iter()
        .map(|m| ExportedChannelMapping {
            xmltv_channel_id: m.xmltv_channel_id,
            xtream_channel_id: m.xtream_channel_id,
            match_confidence: m.match_confidence,
            is_manual: m.is_manual.map(|v| v != 0).unwrap_or(false),
            is_primary: m.is_primary.map(|v| v != 0).unwrap_or(false),
            stream_priority: m.stream_priority.unwrap_or(0),
        })
        .collect();

    // Query all XMLTV channel settings (Task 1.7)
    let settings_rows: Vec<XmltvChannelSettings> = xmltv_channel_settings::table
        .load(&mut conn)
        .map_err(|e| ConfigError::DatabaseError(e.to_string()))?;

    let exported_channel_settings: Vec<ExportedXmltvChannelSettings> = settings_rows
        .into_iter()
        .map(|s| ExportedXmltvChannelSettings {
            xmltv_channel_id: s.xmltv_channel_id,
            is_enabled: s.is_enabled.map(|v| v != 0).unwrap_or(false),
            plex_display_order: s.plex_display_order,
        })
        .collect();

    // Build export structure with metadata (Task 1.8)
    let export = ConfigExport {
        version: CONFIG_VERSION.to_string(),
        export_date: chrono::Utc::now().to_rfc3339(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        data: ExportData {
            settings: exported_settings,
            accounts: exported_accounts,
            xmltv_sources: exported_sources,
            channel_mappings: exported_mappings,
            xmltv_channel_settings: exported_channel_settings,
        },
    };

    // Serialize to JSON
    let json = serde_json::to_string_pretty(&export)
        .map_err(|e| {
            eprintln!("Export failed: JSON serialization error - {}", e);
            ConfigError::SerializationError(e.to_string())
        })?;

    // SECURITY ASSERTION: Verify passwords are NEVER in the export
    if json.to_lowercase().contains("password") {
        return Err(ConfigError::ImportFailed(
            "CRITICAL SECURITY VIOLATION: Password data detected in export. Export aborted.".to_string()
        ).into());
    }

    // Story 6-3: Log configuration export event (AC #1)
    let details = serde_json::json!({
        "accountsExported": export.data.accounts.len(),
        "xmltvSourcesExported": export.data.xmltv_sources.len(),
        "channelMappingsExported": export.data.channel_mappings.len(),
        "version": CONFIG_VERSION,
    });
    let _ = log_event_internal(
        &mut conn,
        "info",
        "system",
        &format!(
            "Configuration exported: {} accounts, {} EPG sources",
            export.data.accounts.len(),
            export.data.xmltv_sources.len()
        ),
        Some(&details.to_string()),
    );

    Ok(json)
}

// ============================================================================
// Import Commands (Task 2.2 - 2.13)
// ============================================================================

/// Validate an import file and return preview (Task 2.2)
///
/// Story 6-2: AC #3, #4
///
/// Parses the JSON content and returns a preview of what will be imported.
#[tauri::command]
pub fn validate_import_file(content: String) -> Result<ImportPreview, String> {
    // Parse JSON (Task 2.4)
    let config: ConfigExport = match serde_json::from_str(&content) {
        Ok(c) => c,
        Err(e) => {
            return Ok(ImportPreview {
                valid: false,
                version: String::new(),
                export_date: String::new(),
                account_count: 0,
                xmltv_source_count: 0,
                channel_mapping_count: 0,
                xmltv_channel_settings_count: 0,
                settings_summary: vec![],
                error_message: Some(format!("Invalid JSON format: {}", e)),
            });
        }
    };

    // Validate version compatibility (Task 2.4)
    if !is_version_compatible(&config.version) {
        return Ok(ImportPreview {
            valid: false,
            version: config.version.clone(),
            export_date: config.export_date,
            account_count: 0,
            xmltv_source_count: 0,
            channel_mapping_count: 0,
            xmltv_channel_settings_count: 0,
            settings_summary: vec![],
            error_message: Some(format!(
                "Unsupported configuration version: {}. Minimum supported: {}",
                config.version, MIN_SUPPORTED_VERSION
            )),
        });
    }

    // Build settings summary
    let mut settings_summary = vec![];
    if config.data.settings.server_port.is_some() {
        settings_summary.push(format!(
            "Server port: {}",
            config.data.settings.server_port.as_ref().unwrap()
        ));
    }
    if let Some(autostart) = &config.data.settings.autostart_enabled {
        settings_summary.push(format!(
            "Autostart: {}",
            if autostart == "true" { "enabled" } else { "disabled" }
        ));
    }
    if config.data.settings.epg_schedule_enabled.is_some() {
        let hour = config.data.settings.epg_schedule_hour.as_deref().unwrap_or("4");
        let minute = config.data.settings.epg_schedule_minute.as_deref().unwrap_or("0");
        settings_summary.push(format!("EPG refresh: {}:{:0>2}", hour, minute));
    }

    Ok(ImportPreview {
        valid: true,
        version: config.version,
        export_date: config.export_date,
        account_count: config.data.accounts.len(),
        xmltv_source_count: config.data.xmltv_sources.len(),
        channel_mapping_count: config.data.channel_mappings.len(),
        xmltv_channel_settings_count: config.data.xmltv_channel_settings.len(),
        settings_summary,
        error_message: None,
    })
}

/// Import configuration from JSON content (Task 2.3)
///
/// Story 6-2: AC #5, #6
///
/// Performs atomic import: all data is replaced (not merged).
/// Accounts are imported with empty passwords - user must re-enter.
#[tauri::command]
pub fn import_configuration(
    db: State<DbConnection>,
    content: String,
) -> Result<ImportResult, String> {
    // Parse JSON
    let config: ConfigExport = serde_json::from_str(&content)
        .map_err(|e| ConfigError::ParseError(e.to_string()))?;

    // Validate version
    if !is_version_compatible(&config.version) {
        return Err(ConfigError::UnsupportedVersion(
            config.version,
            MIN_SUPPORTED_VERSION.to_string(),
        )
        .into());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| ConfigError::DatabaseError(e.to_string()))?;

    // Begin transaction for atomic import (Task 2.6)
    conn.transaction::<_, diesel::result::Error, _>(|conn| {
        // Clear existing data (Task 2.7)
        // Order matters due to foreign key constraints
        diesel::delete(channel_mappings::table).execute(conn)?;
        diesel::delete(xmltv_channel_settings::table).execute(conn)?;
        diesel::delete(xmltv_sources::table).execute(conn)?;
        diesel::delete(accounts::table).execute(conn)?;
        // Clear settings (but keep them - they're just key-value pairs)
        diesel::delete(settings::table).execute(conn)?;

        // Insert settings (Task 2.8)
        if let Some(v) = &config.data.settings.server_port {
            diesel::insert_into(settings::table)
                .values(&Setting::new("server_port", v))
                .execute(conn)?;
        }
        if let Some(v) = &config.data.settings.autostart_enabled {
            diesel::insert_into(settings::table)
                .values(&Setting::new("autostart_enabled", v))
                .execute(conn)?;
        }
        if let Some(v) = &config.data.settings.epg_schedule_hour {
            diesel::insert_into(settings::table)
                .values(&Setting::new("epg_schedule_hour", v))
                .execute(conn)?;
        }
        if let Some(v) = &config.data.settings.epg_schedule_minute {
            diesel::insert_into(settings::table)
                .values(&Setting::new("epg_schedule_minute", v))
                .execute(conn)?;
        }
        if let Some(v) = &config.data.settings.epg_schedule_enabled {
            diesel::insert_into(settings::table)
                .values(&Setting::new("epg_schedule_enabled", v))
                .execute(conn)?;
        }
        if let Some(v) = &config.data.settings.match_threshold {
            diesel::insert_into(settings::table)
                .values(&Setting::new("match_threshold", v))
                .execute(conn)?;
        }

        // Insert accounts with empty passwords (Task 2.9)
        // SECURITY: Passwords are NOT exported, so we insert with empty placeholder
        for account in &config.data.accounts {
            // Validate required fields are non-empty
            if account.name.trim().is_empty() {
                return Err(diesel::result::Error::RollbackTransaction);
            }
            if account.server_url.trim().is_empty() {
                return Err(diesel::result::Error::RollbackTransaction);
            }
            if account.username.trim().is_empty() {
                return Err(diesel::result::Error::RollbackTransaction);
            }

            let new_account = NewAccount {
                name: account.name.clone(),
                server_url: account.server_url.clone(),
                username: account.username.clone(),
                password_encrypted: vec![], // Empty - user must re-enter
                max_connections: account.max_connections,
                is_active: 0, // Mark as inactive until password is set
            };
            diesel::insert_into(accounts::table)
                .values(&new_account)
                .execute(conn)?;
        }

        // Insert XMLTV sources (Task 2.10)
        for source in &config.data.xmltv_sources {
            // Validate required fields are non-empty
            if source.name.trim().is_empty() {
                return Err(diesel::result::Error::RollbackTransaction);
            }
            if source.url.trim().is_empty() {
                return Err(diesel::result::Error::RollbackTransaction);
            }

            let new_source = NewXmltvSource {
                name: source.name.clone(),
                url: source.url.clone(),
                format: source.format.clone(),
                refresh_hour: source.refresh_hour,
                is_active: if source.is_active { 1 } else { 0 },
            };
            diesel::insert_into(xmltv_sources::table)
                .values(&new_source)
                .execute(conn)?;
        }

        // NOTE: Channel mappings and settings are NOT imported here because:
        // 1. They reference xmltv_channels and xtream_channels which are re-fetched from providers
        // 2. The database IDs won't match after provider data is refreshed
        // 3. Importing stale IDs would create foreign key constraint violations or point to wrong channels
        // 4. User will need to re-run channel matching after import to regenerate mappings
        //
        // TECHNICAL EXPLANATION: The exported mappings contain database primary keys (integers)
        // that are auto-incremented. After importing accounts and sources, when the user fetches
        // channels from providers, new xmltv_channels and xtream_channels records will be created
        // with DIFFERENT IDs. The old mapping IDs would either:
        //   - Fail foreign key constraints (if IDs don't exist)
        //   - Map to completely wrong channels (if IDs happen to exist but point elsewhere)
        //
        // To preserve mappings across import, we would need to:
        // - Export channel identifiers (channel_id strings, not database IDs)
        // - After import, wait for user to fetch channels from providers
        // - Re-resolve mappings by looking up new database IDs for the channel_id strings
        // - This is complex and out of scope for current story requirements

        Ok(())
    })
    .map_err(|e| {
        // Provide more specific error messages for common constraint violations
        let error_str = e.to_string();
        if matches!(e, diesel::result::Error::RollbackTransaction) {
            ConfigError::ImportFailed(
                "Import validation failed: One or more records have empty required fields (name, URL, username, etc.)".to_string()
            )
        } else if error_str.to_lowercase().contains("unique") {
            ConfigError::ImportFailed(format!(
                "Duplicate data detected in import file. Each item must be unique. Details: {}",
                error_str
            ))
        } else if error_str.to_lowercase().contains("foreign key") {
            ConfigError::ImportFailed(format!(
                "Invalid references in import data. Some items reference non-existent records. Details: {}",
                error_str
            ))
        } else if error_str.to_lowercase().contains("not null") {
            ConfigError::ImportFailed(format!(
                "Missing required data in import file. All mandatory fields must be provided. Details: {}",
                error_str
            ))
        } else {
            ConfigError::DatabaseError(error_str)
        }
    })?;

    // Count what was actually imported
    let settings_count = count_settings(&config.data.settings);
    let accounts_count = config.data.accounts.len();
    let sources_count = config.data.xmltv_sources.len();

    // Story 6-3: Log configuration import event (AC #1)
    // Need a fresh connection after the transaction
    if let Ok(mut log_conn) = db.get_connection() {
        let details = serde_json::json!({
            "accountsImported": accounts_count,
            "xmltvSourcesImported": sources_count,
            "settingsImported": settings_count,
            "version": config.version,
        });
        let _ = log_event_internal(
            &mut log_conn,
            "info",
            "system",
            &format!(
                "Configuration imported: {} accounts, {} EPG sources, {} settings",
                accounts_count, sources_count, settings_count
            ),
            Some(&details.to_string()),
        );
    }

    Ok(ImportResult {
        success: true,
        accounts_imported: accounts_count,
        xmltv_sources_imported: sources_count,
        channel_mappings_imported: 0, // Not imported - see note above
        settings_imported: settings_count,
        message: format!(
            "Configuration imported successfully. {} accounts need passwords re-entered.",
            accounts_count
        ),
    })
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Check if the import version is compatible
fn is_version_compatible(version: &str) -> bool {
    // Version comparison - check major.minor
    let parts: Vec<&str> = version.split('.').collect();
    let min_parts: Vec<&str> = MIN_SUPPORTED_VERSION.split('.').collect();

    if parts.len() < 2 || min_parts.len() < 2 {
        return false;
    }

    // Parse major and minor versions
    let major: u32 = parts[0].parse().unwrap_or(0);
    let min_major: u32 = min_parts[0].parse().unwrap_or(0);
    let minor: u32 = parts[1].parse().unwrap_or(0);
    let min_minor: u32 = min_parts[1].parse().unwrap_or(0);

    // Check major version first
    if major > min_major {
        return true;
    }
    if major < min_major {
        return false;
    }

    // Major versions match, check minor
    minor >= min_minor
}

/// Count non-None settings
fn count_settings(settings: &ExportedSettings) -> usize {
    let mut count = 0;
    if settings.server_port.is_some() {
        count += 1;
    }
    if settings.autostart_enabled.is_some() {
        count += 1;
    }
    if settings.epg_schedule_hour.is_some() {
        count += 1;
    }
    if settings.epg_schedule_minute.is_some() {
        count += 1;
    }
    if settings.epg_schedule_enabled.is_some() {
        count += 1;
    }
    if settings.match_threshold.is_some() {
        count += 1;
    }
    count
}

// ============================================================================
// Unit Tests (Task 7.1, 7.2)
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_export_serialization() {
        let export = ConfigExport {
            version: "1.0".to_string(),
            export_date: "2026-01-23T12:00:00Z".to_string(),
            app_version: "0.1.0".to_string(),
            data: ExportData {
                settings: ExportedSettings {
                    server_port: Some("5004".to_string()),
                    autostart_enabled: Some("true".to_string()),
                    epg_schedule_hour: Some("4".to_string()),
                    epg_schedule_minute: Some("0".to_string()),
                    epg_schedule_enabled: Some("true".to_string()),
                    match_threshold: Some("0.85".to_string()),
                },
                accounts: vec![ExportedAccount {
                    id: 1,
                    name: "Test Provider".to_string(),
                    server_url: "http://provider.example.com".to_string(),
                    username: "testuser".to_string(),
                    max_connections: 2,
                    is_active: true,
                }],
                xmltv_sources: vec![ExportedXmltvSource {
                    id: 1,
                    name: "EPG Source".to_string(),
                    url: "http://epg.example.com/guide.xml".to_string(),
                    format: "xml".to_string(),
                    refresh_hour: 4,
                    is_active: true,
                }],
                channel_mappings: vec![ExportedChannelMapping {
                    xmltv_channel_id: 1,
                    xtream_channel_id: 42,
                    match_confidence: Some(0.95),
                    is_manual: false,
                    is_primary: true,
                    stream_priority: 0,
                }],
                xmltv_channel_settings: vec![ExportedXmltvChannelSettings {
                    xmltv_channel_id: 1,
                    is_enabled: true,
                    plex_display_order: Some(1),
                }],
            },
        };

        let json = serde_json::to_string_pretty(&export).unwrap();

        // Verify structure - All structs now use camelCase for consistency
        assert!(json.contains("\"version\": \"1.0\""));
        assert!(json.contains("\"exportDate\"")); // ConfigExport camelCase
        assert!(json.contains("\"appVersion\"")); // ConfigExport camelCase
        // ExportedSettings uses camelCase
        assert!(json.contains("\"serverPort\": \"5004\""));
        assert!(json.contains("\"autostartEnabled\": \"true\""));
        // ExportData now also uses camelCase (consistency fix)
        assert!(json.contains("\"accounts\""));
        assert!(json.contains("\"xmltvSources\""));
        assert!(json.contains("\"channelMappings\""));
        assert!(json.contains("\"xmltvChannelSettings\""));

        // Verify no password field
        assert!(!json.contains("password"));
        assert!(!json.contains("passwordEncrypted"));
    }

    #[test]
    fn test_config_export_deserialization() {
        let json = r#"{
            "version": "1.0",
            "exportDate": "2026-01-23T12:00:00Z",
            "appVersion": "0.1.0",
            "data": {
                "settings": {
                    "serverPort": "5004",
                    "autostartEnabled": "true",
                    "epgScheduleHour": "4",
                    "epgScheduleMinute": "0",
                    "epgScheduleEnabled": "true",
                    "matchThreshold": null
                },
                "accounts": [],
                "xmltvSources": [],
                "channelMappings": [],
                "xmltvChannelSettings": []
            }
        }"#;

        let config: ConfigExport = serde_json::from_str(json).unwrap();
        assert_eq!(config.version, "1.0");
        assert_eq!(config.data.settings.server_port, Some("5004".to_string()));
        assert!(config.data.settings.match_threshold.is_none());
    }

    #[test]
    fn test_version_compatibility() {
        // Valid versions
        assert!(is_version_compatible("1.0")); // exact match
        assert!(is_version_compatible("1.1")); // same major, higher minor
        assert!(is_version_compatible("2.0")); // higher major
        assert!(is_version_compatible("1.999")); // same major, much higher minor

        // Invalid versions
        assert!(!is_version_compatible("0.9")); // lower major
        assert!(!is_version_compatible("0.999")); // lower major, even with high minor
        assert!(!is_version_compatible("")); // empty string
        assert!(!is_version_compatible("invalid")); // not a number
        assert!(!is_version_compatible("1")); // missing minor version
    }

    #[test]
    fn test_import_preview_invalid_json() {
        let result = validate_import_file("not valid json".to_string()).unwrap();
        assert!(!result.valid);
        assert!(result.error_message.is_some());
        assert!(result.error_message.unwrap().contains("Invalid JSON"));
    }

    #[test]
    fn test_import_preview_unsupported_version() {
        let json = r#"{
            "version": "0.5",
            "exportDate": "2026-01-23T12:00:00Z",
            "appVersion": "0.1.0",
            "data": {
                "settings": {},
                "accounts": [],
                "xmltvSources": [],
                "channelMappings": [],
                "xmltvChannelSettings": []
            }
        }"#;

        let result = validate_import_file(json.to_string()).unwrap();
        assert!(!result.valid);
        assert!(result.error_message.unwrap().contains("Unsupported"));
    }

    #[test]
    fn test_import_preview_valid() {
        let json = r#"{
            "version": "1.0",
            "exportDate": "2026-01-23T12:00:00Z",
            "appVersion": "0.1.0",
            "data": {
                "settings": {
                    "serverPort": "5004"
                },
                "accounts": [
                    {
                        "id": 1,
                        "name": "Test",
                        "serverUrl": "http://test.com",
                        "username": "user",
                        "maxConnections": 1,
                        "isActive": true
                    }
                ],
                "xmltvSources": [
                    {
                        "id": 1,
                        "name": "Source",
                        "url": "http://epg.com",
                        "format": "xml",
                        "refreshHour": 4,
                        "isActive": true
                    }
                ],
                "channelMappings": [],
                "xmltvChannelSettings": []
            }
        }"#;

        let result = validate_import_file(json.to_string()).unwrap();
        assert!(result.valid);
        assert_eq!(result.account_count, 1);
        assert_eq!(result.xmltv_source_count, 1);
        assert!(result.error_message.is_none());
    }

    #[test]
    fn test_count_settings() {
        let settings = ExportedSettings {
            server_port: Some("5004".to_string()),
            autostart_enabled: Some("true".to_string()),
            epg_schedule_hour: None,
            epg_schedule_minute: None,
            epg_schedule_enabled: None,
            match_threshold: None,
        };

        assert_eq!(count_settings(&settings), 2);
    }
}
