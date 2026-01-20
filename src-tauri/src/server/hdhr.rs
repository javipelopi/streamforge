//! HDHomeRun Emulation Module
//!
//! This module implements HDHomeRun device emulation for Plex auto-discovery.
//! HDHomeRun endpoints follow the XMLTV-first architecture where XMLTV channels
//! define the Plex lineup and Xtream streams are video sources.
//!
//! ## Stream Endpoint Placeholder
//! The lineup URLs reference `/stream/{xmltv_channel_id}` which will be implemented
//! in Story 4-4. This forward-compatible URL format ensures consistency across
//! M3U, EPG, and HDHomeRun endpoints.
//!
//! ## Security: Local-Only Access Model
//! DeviceAuth uses a static value "streamforge" which is acceptable because:
//! - Server binds to 127.0.0.1 only (NFR21 - local-only access)
//! - No external network exposure
//! - HDHomeRun protocol expects DeviceAuth but doesn't enforce it for local access
//!
//! Story 4-3: Implement HDHomeRun Emulation

use diesel::prelude::*;
use diesel::sql_types::{Integer, Nullable, Text};
use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

use crate::db::DbPooledConnection;

/// HDHomeRun discovery response
///
/// Returned by GET /discover.json endpoint.
/// Uses PascalCase for HDHomeRun protocol compatibility.
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "PascalCase")]
pub struct DiscoverResponse {
    pub friendly_name: String,
    pub model_number: String,
    pub firmware_name: String,
    pub firmware_version: String,
    #[serde(rename = "DeviceID")]
    pub device_id: String,
    pub device_auth: String,
    #[serde(rename = "BaseURL")]
    pub base_url: String,
    #[serde(rename = "LineupURL")]
    pub lineup_url: String,
    pub tuner_count: u32,
}

/// HDHomeRun channel lineup entry
///
/// Returned by GET /lineup.json endpoint as array.
/// Uses PascalCase for HDHomeRun protocol compatibility.
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "PascalCase")]
pub struct LineupEntry {
    pub guide_number: String,
    pub guide_name: String,
    #[serde(rename = "URL")]
    pub url: String,
}

/// HDHomeRun lineup status response
///
/// Returned by GET /lineup_status.json endpoint.
/// Uses PascalCase for HDHomeRun protocol compatibility.
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "PascalCase")]
pub struct LineupStatusResponse {
    pub scan_in_progress: u8,
    pub scan_possible: u8,
    pub source: String,
    pub source_list: Vec<String>,
}

/// Query result for tuner count from accounts table
#[derive(QueryableByName, Debug)]
struct TunerCountRow {
    #[diesel(sql_type = Integer)]
    tuner_count: i32,
}

/// Query result for enabled channels (same query pattern as M3U)
#[derive(QueryableByName, Debug)]
struct EnabledChannelRow {
    #[diesel(sql_type = Integer)]
    id: i32,
    #[diesel(sql_type = Text)]
    display_name: String,
    #[diesel(sql_type = Nullable<Integer>)]
    plex_display_order: Option<i32>,
}

/// Generate a stable DeviceID based on machine hostname
///
/// Creates a consistent ID like "STREAMFORGE12AB34CD" that persists across restarts.
/// Uses hostname hash for stability across sessions.
pub fn generate_device_id() -> String {
    let hostname = hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_else(|| "streamforge".to_string());

    let mut hasher = DefaultHasher::new();
    hostname.hash(&mut hasher);
    format!("STREAMFORGE{:08X}", hasher.finish() as u32)
}

/// Get the local IP address for HDHomeRun URLs
///
/// Returns the local network IP address, falling back to 127.0.0.1 if detection fails.
pub fn get_local_ip() -> String {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string())
}

/// Get tuner count from active accounts
///
/// Returns the maximum max_connections value from active accounts,
/// defaulting to 2 if no accounts exist.
///
/// ## Why MAX and not SUM?
/// Uses MAX (not SUM) because:
/// - Plex treats this as total concurrent streams available
/// - All streams proxy through StreamForge regardless of source account
/// - The account with highest max_connections represents the bottleneck
/// - If Account A has 2 connections and Account B has 3, Plex can use up to 3
///   concurrent streams total (limited by the single account constraint)
pub fn get_tuner_count(conn: &mut DbPooledConnection) -> Result<u32, diesel::result::Error> {
    // Use max_connections_actual (from API) if available, otherwise fall back to max_connections
    let result = diesel::sql_query(
        r#"
        SELECT COALESCE(MAX(COALESCE(max_connections_actual, max_connections)), 2) as tuner_count
        FROM accounts
        WHERE is_active = 1
        "#,
    )
    .load::<TunerCountRow>(conn)?;

    Ok(result.first().map(|r| r.tuner_count as u32).unwrap_or(2))
}

/// Generate HDHomeRun discovery response
///
/// Creates a DiscoverResponse with:
/// - FriendlyName: "StreamForge"
/// - ModelNumber: "HDHR5-4K"
/// - TunerCount from active accounts
/// - BaseURL and LineupURL with local IP and port
pub fn generate_discover_response(
    conn: &mut DbPooledConnection,
    port: u16,
) -> Result<DiscoverResponse, diesel::result::Error> {
    let tuner_count = get_tuner_count(conn)?;
    let local_ip = get_local_ip();
    let base_url = format!("http://{}:{}", local_ip, port);
    let lineup_url = format!("{}/lineup.json", base_url);
    let device_id = generate_device_id();

    Ok(DiscoverResponse {
        friendly_name: "StreamForge".to_string(),
        model_number: "HDHR5-4K".to_string(),
        firmware_name: "hdhomerun5_atsc".to_string(),
        firmware_version: "20200101".to_string(),
        device_id,
        device_auth: "streamforge".to_string(),
        base_url,
        lineup_url,
        tuner_count,
    })
}

/// Get enabled channels for HDHomeRun lineup
///
/// Returns channels ordered by plex_display_order ASC NULLS LAST,
/// then by display_name ASC. Only enabled channels with stream mappings.
///
/// This query is consistent with M3U and EPG endpoints.
fn get_enabled_channels_for_lineup(
    conn: &mut DbPooledConnection,
) -> Result<Vec<EnabledChannelRow>, diesel::result::Error> {
    diesel::sql_query(
        r#"
        SELECT
            xc.id,
            xc.display_name,
            xcs.plex_display_order
        FROM xmltv_channels xc
        INNER JOIN xmltv_channel_settings xcs ON xc.id = xcs.xmltv_channel_id
        WHERE xcs.is_enabled = 1
        AND EXISTS (
            SELECT 1 FROM channel_mappings cm
            WHERE cm.xmltv_channel_id = xc.id
        )
        ORDER BY
            CASE WHEN xcs.plex_display_order IS NULL THEN 1 ELSE 0 END,
            xcs.plex_display_order ASC,
            xc.display_name ASC
        "#,
    )
    .load::<EnabledChannelRow>(conn)
}

/// Generate HDHomeRun lineup response
///
/// Returns array of LineupEntry objects with:
/// - GuideNumber: plex_display_order as string (or channel index if null)
/// - GuideName: XMLTV display_name
/// - URL: http://{local_ip}:{port}/stream/{xmltv_channel_id}
pub fn generate_lineup(
    conn: &mut DbPooledConnection,
    port: u16,
) -> Result<Vec<LineupEntry>, diesel::result::Error> {
    let channels = get_enabled_channels_for_lineup(conn)?;
    let local_ip = get_local_ip();

    let mut lineup = Vec::with_capacity(channels.len());
    let mut fallback_number = 1;

    for channel in channels {
        let guide_number = match channel.plex_display_order {
            Some(order) => order.to_string(),
            None => {
                let num = fallback_number.to_string();
                fallback_number += 1;
                num
            }
        };

        lineup.push(LineupEntry {
            guide_number,
            guide_name: channel.display_name,
            url: format!("http://{}:{}/stream/{}", local_ip, port, channel.id),
        });
    }

    Ok(lineup)
}

/// Generate HDHomeRun lineup status response
///
/// Returns a static status indicating no scan in progress
/// (scanning not supported for IPTV sources).
pub fn generate_lineup_status() -> LineupStatusResponse {
    LineupStatusResponse {
        scan_in_progress: 0,
        scan_possible: 0,
        source: "Cable".to_string(),
        source_list: vec!["Cable".to_string()],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ============================================================================
    // DiscoverResponse serialization tests
    // ============================================================================

    #[test]
    fn test_discover_response_serializes_with_pascal_case() {
        let response = DiscoverResponse {
            friendly_name: "StreamForge".to_string(),
            model_number: "HDHR5-4K".to_string(),
            firmware_name: "hdhomerun5_atsc".to_string(),
            firmware_version: "20200101".to_string(),
            device_id: "STREAMFORGE12345678".to_string(),
            device_auth: "streamforge".to_string(),
            base_url: "http://192.168.1.100:5004".to_string(),
            lineup_url: "http://192.168.1.100:5004/lineup.json".to_string(),
            tuner_count: 2,
        };

        let json = serde_json::to_string(&response).unwrap();

        // Verify PascalCase field names
        assert!(json.contains("\"FriendlyName\":\"StreamForge\""));
        assert!(json.contains("\"ModelNumber\":\"HDHR5-4K\""));
        assert!(json.contains("\"FirmwareName\":\"hdhomerun5_atsc\""));
        assert!(json.contains("\"FirmwareVersion\":\"20200101\""));
        assert!(json.contains("\"DeviceID\":\"STREAMFORGE12345678\""));
        assert!(json.contains("\"DeviceAuth\":\"streamforge\""));
        assert!(json.contains("\"BaseURL\":\"http://192.168.1.100:5004\""));
        assert!(json.contains("\"LineupURL\":\"http://192.168.1.100:5004/lineup.json\""));
        assert!(json.contains("\"TunerCount\":2"));
    }

    #[test]
    fn test_discover_response_base_url_format() {
        let response = DiscoverResponse {
            friendly_name: "StreamForge".to_string(),
            model_number: "HDHR5-4K".to_string(),
            firmware_name: "hdhomerun5_atsc".to_string(),
            firmware_version: "20200101".to_string(),
            device_id: "STREAMFORGE12345678".to_string(),
            device_auth: "streamforge".to_string(),
            base_url: "http://192.168.1.100:5004".to_string(),
            lineup_url: "http://192.168.1.100:5004/lineup.json".to_string(),
            tuner_count: 2,
        };

        let json = serde_json::to_string(&response).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

        // Verify BaseURL and LineupURL use the same base
        let base_url = parsed["BaseURL"].as_str().unwrap();
        let lineup_url = parsed["LineupURL"].as_str().unwrap();

        assert!(lineup_url.starts_with(base_url));
        assert!(lineup_url.ends_with("/lineup.json"));
    }

    // ============================================================================
    // LineupEntry serialization tests
    // ============================================================================

    #[test]
    fn test_lineup_entry_serializes_correctly() {
        let entry = LineupEntry {
            guide_number: "206".to_string(),
            guide_name: "ESPN HD".to_string(),
            url: "http://192.168.1.100:5004/stream/123".to_string(),
        };

        let json = serde_json::to_string(&entry).unwrap();

        // Verify PascalCase field names
        assert!(json.contains("\"GuideNumber\":\"206\""));
        assert!(json.contains("\"GuideName\":\"ESPN HD\""));
        assert!(json.contains("\"URL\":\"http://192.168.1.100:5004/stream/123\""));
    }

    #[test]
    fn test_lineup_entry_url_format() {
        let entry = LineupEntry {
            guide_number: "1".to_string(),
            guide_name: "Test Channel".to_string(),
            url: "http://127.0.0.1:5004/stream/456".to_string(),
        };

        let json = serde_json::to_string(&entry).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

        let url = parsed["URL"].as_str().unwrap();
        assert!(url.starts_with("http://"));
        assert!(url.contains("/stream/"));
    }

    #[test]
    fn test_empty_lineup_returns_valid_empty_array() {
        let lineup: Vec<LineupEntry> = vec![];
        let json = serde_json::to_string(&lineup).unwrap();

        assert_eq!(json, "[]");
    }

    // ============================================================================
    // LineupStatusResponse serialization tests
    // ============================================================================

    #[test]
    fn test_lineup_status_response_serializes_correctly() {
        let status = generate_lineup_status();
        let json = serde_json::to_string(&status).unwrap();

        // Verify PascalCase field names
        assert!(json.contains("\"ScanInProgress\":0"));
        assert!(json.contains("\"ScanPossible\":0"));
        assert!(json.contains("\"Source\":\"Cable\""));
        assert!(json.contains("\"SourceList\":[\"Cable\"]"));
    }

    #[test]
    fn test_lineup_status_values() {
        let status = generate_lineup_status();

        assert_eq!(status.scan_in_progress, 0);
        assert_eq!(status.scan_possible, 0);
        assert_eq!(status.source, "Cable");
        assert_eq!(status.source_list, vec!["Cable"]);
    }

    // ============================================================================
    // DeviceID generation tests
    // ============================================================================

    #[test]
    fn test_device_id_has_correct_prefix() {
        let device_id = generate_device_id();

        assert!(device_id.starts_with("STREAMFORGE"));
    }

    #[test]
    fn test_device_id_is_stable() {
        // Multiple calls should return the same ID (based on hostname)
        let id1 = generate_device_id();
        let id2 = generate_device_id();

        assert_eq!(id1, id2);
    }

    #[test]
    fn test_device_id_has_correct_length() {
        let device_id = generate_device_id();

        // "STREAMFORGE" (11 chars) + 8 hex chars = 19 total
        assert_eq!(device_id.len(), 19);
    }

    // ============================================================================
    // Local IP tests
    // ============================================================================

    #[test]
    fn test_local_ip_returns_valid_format() {
        let ip = get_local_ip();

        // Should either be a valid IP or localhost fallback
        assert!(ip == "127.0.0.1" || ip.split('.').count() == 4);
    }

    // ============================================================================
    // Channel ordering tests (logic tests, no DB)
    // ============================================================================

    #[test]
    fn test_guide_number_handles_null_plex_display_order() {
        // Simulate what would happen with null plex_display_order
        // Using fallback index numbering
        let channels_with_null_order = vec![
            (1, "Channel A", None),    // Should get "1"
            (2, "Channel B", Some(5)), // Should get "5"
            (3, "Channel C", None),    // Should get "2"
        ];

        let mut fallback_number = 1;
        let guide_numbers: Vec<String> = channels_with_null_order
            .into_iter()
            .map(|(_, _, order)| match order {
                Some(o) => o.to_string(),
                None => {
                    let num = fallback_number.to_string();
                    fallback_number += 1;
                    num
                }
            })
            .collect();

        assert_eq!(guide_numbers, vec!["1", "5", "2"]);
    }
}
