//! Configuration export/import service — framework-independent helpers.
//!
//! These functions operate on `&DbConnection` directly and carry no Tauri or
//! Axum dependency, so they compile in both GUI and headless builds.

use diesel::prelude::*;
use thiserror::Error;

use crate::db::{
    schema::{accounts, channel_mappings, settings, xmltv_channel_settings, xmltv_sources},
    Account, ChannelMapping, DbConnection, NewAccount, NewXmltvSource, Setting,
    XmltvChannelSettings, XmltvSource,
};
use crate::types::{
    ConfigExport, ExportData, ExportedAccount, ExportedChannelMapping, ExportedSettings,
    ExportedXmltvChannelSettings, ExportedXmltvSource, ImportResult,
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

    #[error("Unsupported configuration version: {0}. Minimum supported: {1}")]
    UnsupportedVersion(String, String),

    #[error("Import failed: {0}")]
    ImportFailed(String),
}

impl From<ConfigError> for String {
    fn from(err: ConfigError) -> Self {
        err.to_string()
    }
}

/// Check whether a version string is compatible with our minimum.
fn is_version_compatible(version: &str) -> bool {
    let parts: Vec<&str> = version.split('.').collect();
    let min_parts: Vec<&str> = MIN_SUPPORTED_VERSION.split('.').collect();

    if parts.len() < 2 || min_parts.len() < 2 {
        return false;
    }

    let major: u32 = parts[0].parse().unwrap_or(0);
    let min_major: u32 = min_parts[0].parse().unwrap_or(0);
    let minor: u32 = parts[1].parse().unwrap_or(0);
    let min_minor: u32 = min_parts[1].parse().unwrap_or(0);

    if major > min_major {
        return true;
    }
    if major < min_major {
        return false;
    }

    minor >= min_minor
}

/// Count non-None settings.
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
    if settings.failover_strictness.is_some() {
        count += 1;
    }
    count
}

/// Export configuration to JSON string using a `DbConnection` directly.
///
/// This is the CLI/headless-friendly version — no Tauri `State` required.
pub fn export_configuration_standalone(db: &DbConnection) -> Result<String, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| ConfigError::DatabaseError(e.to_string()))?;

    let settings_rows: Vec<Setting> = settings::table
        .load(&mut conn)
        .map_err(|e| ConfigError::DatabaseError(e.to_string()))?;

    let mut exported_settings = ExportedSettings {
        server_port: None,
        autostart_enabled: None,
        epg_schedule_hour: None,
        epg_schedule_minute: None,
        epg_schedule_enabled: None,
        match_threshold: None,
        failover_strictness: None,
    };

    for setting in settings_rows {
        match setting.key.as_str() {
            "server_port" => exported_settings.server_port = Some(setting.value),
            "autostart_enabled" => exported_settings.autostart_enabled = Some(setting.value),
            "epg_schedule_hour" => exported_settings.epg_schedule_hour = Some(setting.value),
            "epg_schedule_minute" => exported_settings.epg_schedule_minute = Some(setting.value),
            "epg_schedule_enabled" => {
                exported_settings.epg_schedule_enabled = Some(setting.value)
            }
            "match_threshold" => exported_settings.match_threshold = Some(setting.value),
            "failover_strictness" => exported_settings.failover_strictness = Some(setting.value),
            _ => {}
        }
    }

    let account_rows: Vec<Account> = accounts::table
        .load(&mut conn)
        .map_err(|e| ConfigError::DatabaseError(e.to_string()))?;

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
            refresh_interval_hours: s.refresh_interval_hours,
            is_active: s.is_active != 0,
        })
        .collect();

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
            source_type: m.source_type,
            m3u_channel_id: m.m3u_channel_id,
            acestream_source_id: m.acestream_source_id,
        })
        .collect();

    let channel_settings_rows: Vec<XmltvChannelSettings> = xmltv_channel_settings::table
        .load(&mut conn)
        .map_err(|e| ConfigError::DatabaseError(e.to_string()))?;

    let exported_channel_settings: Vec<ExportedXmltvChannelSettings> = channel_settings_rows
        .into_iter()
        .map(|s| ExportedXmltvChannelSettings {
            xmltv_channel_id: s.xmltv_channel_id,
            is_enabled: s.is_enabled.map(|v| v != 0).unwrap_or(false),
            plex_display_order: s.plex_display_order,
        })
        .collect();

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

    let json = serde_json::to_string_pretty(&export)
        .map_err(|e| ConfigError::SerializationError(e.to_string()))?;

    if json.to_lowercase().contains("password") {
        return Err(ConfigError::ImportFailed(
            "CRITICAL SECURITY VIOLATION: Password data detected in export. Export aborted."
                .to_string(),
        )
        .into());
    }

    Ok(json)
}

/// Import configuration from a JSON string using a `DbConnection` directly.
///
/// This is the CLI/headless-friendly version — no Tauri `State` required.
pub fn import_configuration_standalone(
    db: &DbConnection,
    content: &str,
) -> Result<ImportResult, String> {
    let config: ConfigExport =
        serde_json::from_str(content).map_err(|e| ConfigError::ParseError(e.to_string()))?;

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

    conn.transaction::<_, diesel::result::Error, _>(|conn| {
        diesel::delete(channel_mappings::table).execute(conn)?;
        diesel::delete(xmltv_channel_settings::table).execute(conn)?;
        diesel::delete(xmltv_sources::table).execute(conn)?;
        diesel::delete(accounts::table).execute(conn)?;
        diesel::delete(settings::table).execute(conn)?;

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
        if let Some(v) = &config.data.settings.failover_strictness {
            diesel::insert_into(settings::table)
                .values(&Setting::new("failover_strictness", v))
                .execute(conn)?;
        }

        for account in &config.data.accounts {
            if account.name.trim().is_empty()
                || account.server_url.trim().is_empty()
                || account.username.trim().is_empty()
            {
                return Err(diesel::result::Error::RollbackTransaction);
            }

            let new_account = NewAccount {
                name: account.name.clone(),
                server_url: account.server_url.clone(),
                username: account.username.clone(),
                password_encrypted: vec![],
                max_connections: account.max_connections,
                is_active: 0,
            };
            diesel::insert_into(accounts::table)
                .values(&new_account)
                .execute(conn)?;
        }

        for source in &config.data.xmltv_sources {
            if source.name.trim().is_empty() || source.url.trim().is_empty() {
                return Err(diesel::result::Error::RollbackTransaction);
            }

            let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
            let new_source = NewXmltvSource {
                name: source.name.clone(),
                url: source.url.clone(),
                format: source.format.clone(),
                refresh_interval_hours: source.refresh_interval_hours,
                is_active: if source.is_active { 1 } else { 0 },
                created_at: now.clone(),
                updated_at: now,
            };
            diesel::insert_into(xmltv_sources::table)
                .values(&new_source)
                .execute(conn)?;
        }

        Ok(())
    })
    .map_err(|e| {
        let error_str = e.to_string();
        if matches!(e, diesel::result::Error::RollbackTransaction) {
            ConfigError::ImportFailed(
                "Import validation failed: One or more records have empty required fields"
                    .to_string(),
            )
        } else {
            ConfigError::DatabaseError(error_str)
        }
    })?;

    let settings_count = count_settings(&config.data.settings);
    let accounts_count = config.data.accounts.len();
    let sources_count = config.data.xmltv_sources.len();

    Ok(ImportResult {
        success: true,
        accounts_imported: accounts_count,
        xmltv_sources_imported: sources_count,
        channel_mappings_imported: 0,
        settings_imported: settings_count,
        message: format!(
            "Configuration imported successfully. {} accounts need passwords re-entered.",
            accounts_count
        ),
    })
}
