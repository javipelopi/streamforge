//! Test data seeding commands
//!
//! This module provides Tauri commands for seeding test data during integration tests.
//! These commands are only enabled when IPTV_TEST_MODE=1 is set.
//!
//! SECURITY NOTE: These commands are intended ONLY for testing and should never
//! be enabled in production builds.

use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::DbConnection;
use crate::db::schema::{
    accounts, channel_mappings, xmltv_channel_settings, xmltv_channels, xmltv_sources,
    xtream_channels,
};

/// Check if test mode is enabled
fn is_test_mode() -> bool {
    std::env::var("IPTV_TEST_MODE").unwrap_or_default() == "1"
}

/// Response for seed operation
#[derive(Debug, Serialize)]
pub struct SeedResponse {
    pub success: bool,
    pub message: String,
    pub records_created: usize,
}

/// Request to seed stream proxy test data
#[derive(Debug, Deserialize)]
pub struct SeedStreamProxyRequest {
    pub clear_existing: bool,
}

/// Seed test data for stream proxy integration tests (Story 4-4)
///
/// Creates the following test data:
/// - XMLTV source
/// - XMLTV channels (1-16) with various configurations
/// - XMLTV channel settings (enabled/disabled)
/// - Accounts (active, inactive, unreachable)
/// - Xtream channels with various qualities
/// - Channel mappings (primary and non-primary)
///
/// SECURITY: Only available when IPTV_TEST_MODE=1
#[tauri::command]
pub fn seed_stream_proxy_test_data(
    db: State<DbConnection>,
    request: SeedStreamProxyRequest,
) -> Result<SeedResponse, String> {
    if !is_test_mode() {
        return Err("Test data seeding is only available in test mode (IPTV_TEST_MODE=1)".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let mut records_created = 0;

    // Optionally clear existing test data
    if request.clear_existing {
        clear_test_data(&mut conn)?;
    }

    // Seed in order of dependencies
    records_created += seed_accounts(&mut conn)?;
    records_created += seed_xmltv_source(&mut conn)?;
    records_created += seed_xmltv_channels(&mut conn)?;
    records_created += seed_xmltv_channel_settings(&mut conn)?;
    records_created += seed_xtream_channels(&mut conn)?;
    records_created += seed_channel_mappings(&mut conn)?;

    Ok(SeedResponse {
        success: true,
        message: "Stream proxy test data seeded successfully".to_string(),
        records_created,
    })
}

/// Clear test data before seeding
fn clear_test_data(conn: &mut crate::db::DbPooledConnection) -> Result<(), String> {
    // Delete in reverse order of dependencies
    diesel::delete(channel_mappings::table.filter(channel_mappings::id.le(100)))
        .execute(conn)
        .map_err(|e| format!("Failed to clear channel_mappings: {}", e))?;

    diesel::delete(xmltv_channel_settings::table.filter(xmltv_channel_settings::xmltv_channel_id.le(100)))
        .execute(conn)
        .map_err(|e| format!("Failed to clear xmltv_channel_settings: {}", e))?;

    diesel::delete(xtream_channels::table.filter(xtream_channels::id.le(2000)))
        .execute(conn)
        .map_err(|e| format!("Failed to clear xtream_channels: {}", e))?;

    diesel::delete(xmltv_channels::table.filter(xmltv_channels::id.le(100)))
        .execute(conn)
        .map_err(|e| format!("Failed to clear xmltv_channels: {}", e))?;

    diesel::delete(xmltv_sources::table.filter(xmltv_sources::id.le(10)))
        .execute(conn)
        .map_err(|e| format!("Failed to clear xmltv_sources: {}", e))?;

    diesel::delete(accounts::table.filter(accounts::id.le(10)))
        .execute(conn)
        .map_err(|e| format!("Failed to clear accounts: {}", e))?;

    Ok(())
}

/// Seed test accounts
fn seed_accounts(conn: &mut crate::db::DbPooledConnection) -> Result<usize, String> {
    // Account 1: Active account with 2 connections
    diesel::sql_query(
        "INSERT OR REPLACE INTO accounts (id, name, server_url, username, password_encrypted, max_connections, is_active, created_at, updated_at)
         VALUES (1, 'Test IPTV Provider', 'http://test-xtream.local:8080', 'testuser', X'746573747061737377', 2, 1, datetime('now'), datetime('now'))"
    )
    .execute(conn)
    .map_err(|e| format!("Failed to seed account 1: {}", e))?;

    // Account 2: Inactive account
    diesel::sql_query(
        "INSERT OR REPLACE INTO accounts (id, name, server_url, username, password_encrypted, max_connections, is_active, created_at, updated_at)
         VALUES (2, 'Inactive Provider', 'http://inactive.local:8080', 'inactive', X'696e616374697665', 1, 0, datetime('now'), datetime('now'))"
    )
    .execute(conn)
    .map_err(|e| format!("Failed to seed account 2: {}", e))?;

    // Account 3: Account with unreachable server
    diesel::sql_query(
        "INSERT OR REPLACE INTO accounts (id, name, server_url, username, password_encrypted, max_connections, is_active, created_at, updated_at)
         VALUES (3, 'Unreachable Provider', 'http://192.0.2.1:9999', 'noreachuser', X'6e6f7265616368', 1, 1, datetime('now'), datetime('now'))"
    )
    .execute(conn)
    .map_err(|e| format!("Failed to seed account 3: {}", e))?;

    Ok(3)
}

/// Seed XMLTV source
fn seed_xmltv_source(conn: &mut crate::db::DbPooledConnection) -> Result<usize, String> {
    // format must be 'xml', 'xml_gz', or 'auto'
    diesel::sql_query(
        "INSERT OR REPLACE INTO xmltv_sources (id, name, url, format, is_active, last_refresh, refresh_hour, created_at, updated_at)
         VALUES (1, 'Test EPG Source', 'http://test-epg.local/epg.xml', 'xml', 1, datetime('now'), 3, datetime('now'), datetime('now'))"
    )
    .execute(conn)
    .map_err(|e| format!("Failed to seed xmltv_source: {}", e))?;

    Ok(1)
}

/// Seed XMLTV channels
fn seed_xmltv_channels(conn: &mut crate::db::DbPooledConnection) -> Result<usize, String> {
    let channels = vec![
        (1, "test.channel.1", "Test Channel 1", "http://icons.local/ch1.png"),
        (2, "test.channel.2", "Test Channel 2 (Disabled)", "http://icons.local/ch2.png"),
        (3, "test.channel.3", "Test Channel 3 (No Primary)", "http://icons.local/ch3.png"),
        (4, "test.channel.4", "Test Channel 4K", "http://icons.local/ch4.png"),
        (5, "test.channel.5", "Test Channel HD", "http://icons.local/ch5.png"),
        (6, "test.channel.6", "Test Channel SD", "http://icons.local/ch6.png"),
        (7, "test.channel.7", "Test Channel NoQuality", "http://icons.local/ch7.png"),
        (8, "test.channel.8", "Test Channel FHD", "http://icons.local/ch8.png"),
        (9, "test.channel.9", "Test Channel Unreachable", "http://icons.local/ch9.png"),
        (10, "test.channel.10", "Test Channel Inactive", "http://icons.local/ch10.png"),
        (11, "test.channel.11", "Test Channel Multi-Mapping", "http://icons.local/ch11.png"),
        (12, "test.channel.12", "Test Channel Failover", "http://icons.local/ch12.png"),
        (13, "test.channel.13", "Test Channel SpecialChars", "http://icons.local/ch13.png"),
        (14, "test.channel.14", "Test Channel HTTP", "http://icons.local/ch14.png"),
        (15, "test.channel.15", "Test Channel HTTPS", "http://icons.local/ch15.png"),
        (16, "test.channel.16", "Test Channel AES", "http://icons.local/ch16.png"),
    ];

    for (id, channel_id, display_name, icon) in &channels {
        diesel::sql_query(format!(
            "INSERT OR REPLACE INTO xmltv_channels (id, source_id, channel_id, display_name, icon, is_synthetic, created_at, updated_at)
             VALUES ({}, 1, '{}', '{}', '{}', 0, datetime('now'), datetime('now'))",
            id, channel_id, display_name, icon
        ))
        .execute(conn)
        .map_err(|e| format!("Failed to seed xmltv_channel {}: {}", id, e))?;
    }

    Ok(channels.len())
}

/// Seed XMLTV channel settings
fn seed_xmltv_channel_settings(conn: &mut crate::db::DbPooledConnection) -> Result<usize, String> {
    // Channel 2 is disabled, all others enabled
    let settings: Vec<(i32, i32, i32)> = vec![
        (1, 1, 1),   // Channel 1: enabled
        (2, 0, 2),   // Channel 2: disabled
        (3, 1, 3),   // Channel 3: enabled (no primary mapping)
        (4, 1, 4),   // Channel 4: enabled (4K)
        (5, 1, 5),   // Channel 5: enabled (HD)
        (6, 1, 6),   // Channel 6: enabled (SD)
        (7, 1, 7),   // Channel 7: enabled (no quality)
        (8, 1, 8),   // Channel 8: enabled (FHD)
        (9, 1, 9),   // Channel 9: enabled (unreachable)
        (10, 1, 10), // Channel 10: enabled (inactive account)
        (11, 1, 11), // Channel 11: enabled (multi-mapping)
        (12, 1, 12), // Channel 12: enabled (failover)
        (13, 1, 13), // Channel 13: enabled (special chars)
        (14, 1, 14), // Channel 14: enabled (HTTP)
        (15, 1, 15), // Channel 15: enabled (HTTPS)
        (16, 1, 16), // Channel 16: enabled (AES)
    ];

    for (channel_id, is_enabled, plex_order) in &settings {
        diesel::sql_query(format!(
            "INSERT OR REPLACE INTO xmltv_channel_settings (xmltv_channel_id, is_enabled, plex_display_order, created_at, updated_at)
             VALUES ({}, {}, {}, datetime('now'), datetime('now'))",
            channel_id, is_enabled, plex_order
        ))
        .execute(conn)
        .map_err(|e| format!("Failed to seed xmltv_channel_settings for {}: {}", channel_id, e))?;
    }

    Ok(settings.len())
}

/// Seed Xtream channels
fn seed_xtream_channels(conn: &mut crate::db::DbPooledConnection) -> Result<usize, String> {
    let xtream_channels_data = vec![
        (1001, 1, 1001, "Xtream Ch1", r#"["4K","HD","SD"]"#),
        (1004, 1, 1004, "Xtream Ch4 4K", r#"["4K","FHD","HD","SD"]"#),
        (1005, 1, 1005, "Xtream Ch5 HD", r#"["HD","SD"]"#),
        (1006, 1, 1006, "Xtream Ch6 SD", r#"["SD"]"#),
        (1008, 1, 1008, "Xtream Ch8 FHD", r#"["FHD","HD","SD"]"#),
        (1009, 3, 1009, "Xtream Ch9 Unreachable", r#"["HD"]"#),
        (1010, 2, 1010, "Xtream Ch10 Inactive", r#"["HD"]"#),
        (1011, 1, 1011, "Xtream Ch11 Primary", r#"["4K"]"#),
        (1012, 1, 1012, "Xtream Ch11 Alt", r#"["HD"]"#),
        (1013, 1, 1013, "Xtream Ch12 Primary", r#"["4K"]"#),
        (1014, 1, 1014, "Xtream Ch12 Failover", r#"["HD"]"#),
        (1015, 1, 1015, "Xtream Ch13 Special", r#"["HD"]"#),
        (1016, 1, 1016, "Xtream Ch14 HTTP", r#"["HD"]"#),
        (1017, 1, 1017, "Xtream Ch15 HTTPS", r#"["HD"]"#),
        (1018, 1, 1018, "Xtream Ch16 AES", r#"["HD"]"#),
    ];

    for (id, account_id, stream_id, name, qualities) in &xtream_channels_data {
        diesel::sql_query(format!(
            "INSERT OR REPLACE INTO xtream_channels (id, account_id, stream_id, name, stream_icon, qualities, category_id, added_at, updated_at)
             VALUES ({}, {}, {}, '{}', 'http://icons.local/x{}.png', '{}', 1, datetime('now'), datetime('now'))",
            id, account_id, stream_id, name, id, qualities
        ))
        .execute(conn)
        .map_err(|e| format!("Failed to seed xtream_channel {}: {}", id, e))?;
    }

    // Channel 7 has NULL qualities
    diesel::sql_query(
        "INSERT OR REPLACE INTO xtream_channels (id, account_id, stream_id, name, stream_icon, qualities, category_id, added_at, updated_at)
         VALUES (1007, 1, 1007, 'Xtream Ch7 NoQ', 'http://icons.local/x1007.png', NULL, 1, datetime('now'), datetime('now'))"
    )
    .execute(conn)
    .map_err(|e| format!("Failed to seed xtream_channel 1007: {}", e))?;

    Ok(xtream_channels_data.len() + 1)
}

/// Seed channel mappings
fn seed_channel_mappings(conn: &mut crate::db::DbPooledConnection) -> Result<usize, String> {
    // (id, xmltv_channel_id, xtream_channel_id, confidence, is_manual, is_primary, stream_priority)
    let mappings = vec![
        (1, 1, 1001, 0.95, 0, 1, 0),   // Ch1 → Xtream primary
        (3, 3, 1001, 0.85, 0, 0, 1),   // Ch3 → NO primary (is_primary = 0)
        (4, 4, 1004, 0.98, 0, 1, 0),   // Ch4 → 4K stream
        (5, 5, 1005, 0.97, 0, 1, 0),   // Ch5 → HD stream
        (6, 6, 1006, 0.96, 0, 1, 0),   // Ch6 → SD stream
        (7, 7, 1007, 0.95, 0, 1, 0),   // Ch7 → NoQ stream
        (8, 8, 1008, 0.94, 0, 1, 0),   // Ch8 → FHD stream
        (9, 9, 1009, 0.93, 0, 1, 0),   // Ch9 → Unreachable
        (10, 10, 1010, 0.92, 0, 1, 0), // Ch10 → Inactive account
        (11, 11, 1011, 0.99, 0, 1, 0), // Ch11 → Primary mapping
        (12, 11, 1012, 0.88, 0, 0, 1), // Ch11 → Alt mapping (non-primary)
        (13, 12, 1013, 0.99, 0, 1, 0), // Ch12 → Primary
        (14, 12, 1014, 0.85, 0, 0, 1), // Ch12 → Failover (non-primary)
        (15, 13, 1015, 0.95, 0, 1, 0), // Ch13 → Special chars
        (16, 14, 1016, 0.95, 0, 1, 0), // Ch14 → HTTP
        (17, 15, 1017, 0.95, 0, 1, 0), // Ch15 → HTTPS
        (18, 16, 1018, 0.95, 0, 1, 0), // Ch16 → AES test
    ];

    for (id, xmltv_id, xtream_id, confidence, is_manual, is_primary, priority) in &mappings {
        diesel::sql_query(format!(
            "INSERT OR REPLACE INTO channel_mappings (id, xmltv_channel_id, xtream_channel_id, match_confidence, is_manual, is_primary, stream_priority, created_at)
             VALUES ({}, {}, {}, {}, {}, {}, {}, datetime('now'))",
            id, xmltv_id, xtream_id, confidence, is_manual, is_primary, priority
        ))
        .execute(conn)
        .map_err(|e| format!("Failed to seed channel_mapping {}: {}", id, e))?;
    }

    Ok(mappings.len())
}

/// Clear all test data (for cleanup)
#[tauri::command]
pub fn clear_stream_proxy_test_data(db: State<DbConnection>) -> Result<SeedResponse, String> {
    if !is_test_mode() {
        return Err("Test data clearing is only available in test mode (IPTV_TEST_MODE=1)".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    clear_test_data(&mut conn)?;

    Ok(SeedResponse {
        success: true,
        message: "Stream proxy test data cleared successfully".to_string(),
        records_created: 0,
    })
}

// ============================================================================
// EPG Search Test Data Commands (Story 5.2)
// ============================================================================

use crate::db::schema::programs;

/// Create a test XMLTV channel
/// Used by epg-search.fixture.ts for test data setup
#[tauri::command]
pub fn create_test_xmltv_channel(
    db: State<DbConnection>,
    id: i32,
    display_name: String,
    icon: Option<String>,
) -> Result<SeedResponse, String> {
    if !is_test_mode() {
        return Err("Test data creation is only available in test mode (IPTV_TEST_MODE=1)".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    // Ensure a default source exists
    diesel::sql_query(
        "INSERT OR IGNORE INTO xmltv_sources (id, name, url, format, is_active, refresh_hour, created_at, updated_at)
         VALUES (1, 'Test EPG Source', 'http://test-epg.local/epg.xml', 'xml', 1, 3, datetime('now'), datetime('now'))"
    )
    .execute(&mut conn)
    .map_err(|e| format!("Failed to ensure xmltv_source: {}", e))?;

    // Create the channel
    let icon_value = icon.as_deref().unwrap_or("");
    diesel::sql_query(format!(
        "INSERT OR REPLACE INTO xmltv_channels (id, source_id, channel_id, display_name, icon, is_synthetic, created_at, updated_at)
         VALUES ({}, 1, 'test.channel.{}', '{}', '{}', 0, datetime('now'), datetime('now'))",
        id, id, display_name.replace('\'', "''"), icon_value
    ))
    .execute(&mut conn)
    .map_err(|e| format!("Failed to create test xmltv_channel: {}", e))?;

    Ok(SeedResponse {
        success: true,
        message: format!("Created test XMLTV channel: {}", display_name),
        records_created: 1,
    })
}

/// Set XMLTV channel enabled/disabled state and display order
/// Used by epg-search.fixture.ts for test data setup
#[tauri::command]
pub fn set_xmltv_channel_enabled(
    db: State<DbConnection>,
    channel_id: i32,
    enabled: bool,
    plex_display_order: i32,
) -> Result<SeedResponse, String> {
    if !is_test_mode() {
        return Err("Test data modification is only available in test mode (IPTV_TEST_MODE=1)".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let is_enabled = if enabled { 1 } else { 0 };

    diesel::sql_query(format!(
        "INSERT OR REPLACE INTO xmltv_channel_settings (xmltv_channel_id, is_enabled, plex_display_order, created_at, updated_at)
         VALUES ({}, {}, {}, datetime('now'), datetime('now'))",
        channel_id, is_enabled, plex_display_order
    ))
    .execute(&mut conn)
    .map_err(|e| format!("Failed to set channel settings: {}", e))?;

    Ok(SeedResponse {
        success: true,
        message: format!("Set channel {} enabled={}", channel_id, enabled),
        records_created: 1,
    })
}

/// Test program response with ID
/// Used to return created program data to tests
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestProgramResponse {
    pub id: i32,
    pub xmltv_channel_id: i32,
    pub title: String,
    pub description: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub category: Option<String>,
    pub episode_info: Option<String>,
}

/// Create a test program
/// Used by epg-search.fixture.ts and program-details.fixture.ts for test data setup
/// Returns the created program with its ID
#[tauri::command]
pub fn create_test_program(
    db: State<DbConnection>,
    id: Option<i32>,
    xmltv_channel_id: i32,
    title: String,
    start_time: String,
    end_time: String,
    category: Option<String>,
    description: Option<String>,
    episode_info: Option<String>,
) -> Result<TestProgramResponse, String> {
    if !is_test_mode() {
        return Err("Test data creation is only available in test mode (IPTV_TEST_MODE=1)".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let category_val = category.clone();
    let description_val = description.clone();
    let episode_info_val = episode_info.clone();

    // Build the SQL depending on whether id is provided
    let sql = if let Some(program_id) = id {
        format!(
            "INSERT OR REPLACE INTO programs (id, xmltv_channel_id, title, description, start_time, end_time, category, episode_info, created_at)
             VALUES ({}, {}, '{}', '{}', '{}', '{}', '{}', '{}', datetime('now'))",
            program_id,
            xmltv_channel_id,
            title.replace('\'', "''"),
            description_val.as_deref().unwrap_or("").replace('\'', "''"),
            start_time,
            end_time,
            category_val.as_deref().unwrap_or(""),
            episode_info_val.as_deref().unwrap_or("")
        )
    } else {
        format!(
            "INSERT INTO programs (xmltv_channel_id, title, description, start_time, end_time, category, episode_info, created_at)
             VALUES ({}, '{}', '{}', '{}', '{}', '{}', '{}', datetime('now'))",
            xmltv_channel_id,
            title.replace('\'', "''"),
            description_val.as_deref().unwrap_or("").replace('\'', "''"),
            start_time,
            end_time,
            category_val.as_deref().unwrap_or(""),
            episode_info_val.as_deref().unwrap_or("")
        )
    };

    diesel::sql_query(&sql)
        .execute(&mut conn)
        .map_err(|e| format!("Failed to create test program: {}", e))?;

    // Get the ID of the inserted program
    let program_id: i32 = if let Some(pid) = id {
        pid
    } else {
        // Get the last inserted ID
        diesel::sql_query("SELECT last_insert_rowid() as id")
            .get_result::<LastInsertRowId>(&mut conn)
            .map_err(|e| format!("Failed to get last insert id: {}", e))?
            .id
    };

    Ok(TestProgramResponse {
        id: program_id,
        xmltv_channel_id,
        title,
        description: description_val,
        start_time,
        end_time,
        category: category_val,
        episode_info: episode_info_val,
    })
}

/// Helper struct for getting last insert rowid
#[derive(diesel::QueryableByName)]
struct LastInsertRowId {
    #[diesel(sql_type = diesel::sql_types::Integer)]
    id: i32,
}

/// Delete all test data for a specific channel
/// Used by epg-search.fixture.ts for cleanup
#[tauri::command]
pub fn delete_test_channel_data(
    db: State<DbConnection>,
    channel_id: i32,
) -> Result<SeedResponse, String> {
    if !is_test_mode() {
        return Err("Test data deletion is only available in test mode (IPTV_TEST_MODE=1)".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let mut records_deleted = 0;

    // Delete programs for this channel
    let prog_deleted = diesel::delete(programs::table.filter(programs::xmltv_channel_id.eq(channel_id)))
        .execute(&mut conn)
        .map_err(|e| format!("Failed to delete programs: {}", e))?;
    records_deleted += prog_deleted;

    // Delete channel settings
    let settings_deleted = diesel::delete(
        xmltv_channel_settings::table.filter(xmltv_channel_settings::xmltv_channel_id.eq(channel_id))
    )
    .execute(&mut conn)
    .map_err(|e| format!("Failed to delete channel settings: {}", e))?;
    records_deleted += settings_deleted;

    // Delete channel mappings
    let mappings_deleted = diesel::delete(
        channel_mappings::table.filter(channel_mappings::xmltv_channel_id.eq(channel_id))
    )
    .execute(&mut conn)
    .map_err(|e| format!("Failed to delete channel mappings: {}", e))?;
    records_deleted += mappings_deleted;

    // Delete the channel
    let channel_deleted = diesel::delete(xmltv_channels::table.filter(xmltv_channels::id.eq(channel_id)))
        .execute(&mut conn)
        .map_err(|e| format!("Failed to delete channel: {}", e))?;
    records_deleted += channel_deleted;

    Ok(SeedResponse {
        success: true,
        message: format!("Deleted test data for channel {}", channel_id),
        records_created: records_deleted,
    })
}

// ============================================================================
// Program Details Test Data Commands (Story 5.3)
// ============================================================================

/// Create a test channel mapping with stream info
/// Used by program-details.fixture.ts for test data setup
#[tauri::command]
pub fn create_test_channel_mapping(
    db: State<DbConnection>,
    xmltv_channel_id: i32,
    stream_name: String,
    quality_tiers: Vec<String>,
    is_primary: bool,
    match_confidence: f32,
) -> Result<SeedResponse, String> {
    if !is_test_mode() {
        return Err("Test data creation is only available in test mode (IPTV_TEST_MODE=1)".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    // Ensure account exists (needed for xtream_channels FK)
    diesel::sql_query(
        "INSERT OR IGNORE INTO accounts (id, name, server_url, username, password_encrypted, max_connections, is_active, created_at, updated_at)
         VALUES (1, 'Test IPTV Provider', 'http://test-xtream.local:8080', 'testuser', X'746573747061737377', 2, 1, datetime('now'), datetime('now'))"
    )
    .execute(&mut conn)
    .map_err(|e| format!("Failed to ensure test account: {}", e))?;

    // Create xtream channel with qualities
    let qualities_json = serde_json::to_string(&quality_tiers).unwrap_or_else(|_| "[]".to_string());
    let xtream_id = 2000 + xmltv_channel_id; // Offset to avoid conflicts

    diesel::sql_query(format!(
        "INSERT OR REPLACE INTO xtream_channels (id, account_id, stream_id, name, stream_icon, qualities, category_id, added_at, updated_at)
         VALUES ({}, 1, {}, '{}', 'http://icons.local/x{}.png', '{}', 1, datetime('now'), datetime('now'))",
        xtream_id, xtream_id, stream_name.replace('\'', "''"), xtream_id, qualities_json.replace('\'', "''")
    ))
    .execute(&mut conn)
    .map_err(|e| format!("Failed to create xtream_channel: {}", e))?;

    // Create channel mapping
    let is_primary_int = if is_primary { 1 } else { 0 };
    diesel::sql_query(format!(
        "INSERT OR REPLACE INTO channel_mappings (xmltv_channel_id, xtream_channel_id, match_confidence, is_manual, is_primary, stream_priority, created_at)
         VALUES ({}, {}, {}, 0, {}, 0, datetime('now'))",
        xmltv_channel_id, xtream_id, match_confidence, is_primary_int
    ))
    .execute(&mut conn)
    .map_err(|e| format!("Failed to create channel_mapping: {}", e))?;

    Ok(SeedResponse {
        success: true,
        message: format!("Created test stream mapping for channel {} with {} qualities", xmltv_channel_id, quality_tiers.len()),
        records_created: 2,
    })
}

/// Delete test stream mapping for a channel
/// Used by program-details.fixture.ts for cleanup
#[tauri::command]
pub fn delete_test_stream_mapping(
    db: State<DbConnection>,
    xmltv_channel_id: i32,
) -> Result<SeedResponse, String> {
    if !is_test_mode() {
        return Err("Test data deletion is only available in test mode (IPTV_TEST_MODE=1)".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| format!("Database connection error: {}", e))?;

    let mut records_deleted = 0;

    // Delete channel mappings
    let mappings_deleted = diesel::delete(
        channel_mappings::table.filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
    )
    .execute(&mut conn)
    .map_err(|e| format!("Failed to delete channel mappings: {}", e))?;
    records_deleted += mappings_deleted;

    // Delete xtream channels for this xmltv channel
    let xtream_id = 2000 + xmltv_channel_id;
    let xtream_deleted = diesel::delete(
        xtream_channels::table.filter(xtream_channels::id.eq(xtream_id))
    )
    .execute(&mut conn)
    .map_err(|e| format!("Failed to delete xtream_channel: {}", e))?;
    records_deleted += xtream_deleted;

    Ok(SeedResponse {
        success: true,
        message: format!("Deleted test stream mapping for channel {}", xmltv_channel_id),
        records_created: records_deleted,
    })
}
