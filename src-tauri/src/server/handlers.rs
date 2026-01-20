use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, HeaderMap, HeaderValue, Response, StatusCode},
    response::IntoResponse,
    Json,
};
use diesel::prelude::*;
use futures_util::StreamExt;
use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::time::Duration;

use super::epg;
use super::hdhr;
use super::m3u;
use super::state::AppState;
use super::stream::{build_stream_url, select_best_quality, StreamSession};
use crate::credentials::CredentialManager;
use crate::db::models::NewEventLog;
use crate::db::schema::{accounts, channel_mappings, event_log, xmltv_channel_settings, xtream_channels};

/// Health check response structure
#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
}

/// Health check endpoint handler
///
/// Returns a 200 OK with JSON body indicating server health.
/// Used by Plex and monitoring tools to verify server is running.
pub async fn health_check() -> (StatusCode, Json<HealthResponse>) {
    (
        StatusCode::OK,
        Json(HealthResponse {
            status: "healthy".to_string(),
        }),
    )
}

/// Fallback handler for 404 responses
///
/// Returns 404 Not Found for any routes not explicitly defined.
pub async fn fallback_handler() -> StatusCode {
    StatusCode::NOT_FOUND
}

/// M3U Playlist endpoint handler (Story 4-1)
///
/// Generates an M3U playlist for Plex integration containing:
/// - Only enabled XMLTV channels with Xtream stream mappings
/// - XMLTV channel names, IDs, and icons (with Xtream fallback)
/// - Channel numbers from plex_display_order
/// - Stream URLs pointing to /stream/{xmltv_channel_id}
///
/// Returns Content-Type: audio/x-mpegurl with ETag for caching
pub async fn playlist_m3u(State(state): State<AppState>) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut conn = state
        .get_connection()
        .map_err(|e| {
            eprintln!("M3U playlist error - database connection failed: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Service temporarily unavailable".to_string())
        })?;

    let port = state.get_port();
    let m3u_content = m3u::generate_m3u_playlist(&mut conn, port)
        .map_err(|e| {
            eprintln!("M3U playlist error - generation failed: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Unable to generate playlist".to_string())
        })?;

    // Generate ETag from content hash for cache validation
    // Plex can use this to avoid re-downloading unchanged playlists
    let etag = generate_etag(&m3u_content);

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("audio/x-mpegurl"));
    headers.insert(
        header::CONTENT_LENGTH,
        HeaderValue::from_str(&m3u_content.len().to_string()).unwrap(),
    );
    headers.insert(
        header::ETAG,
        HeaderValue::from_str(&format!("\"{}\"", etag)).unwrap(),
    );
    // Cache for 5 minutes - Plex polls frequently but playlist rarely changes
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=300"),
    );

    Ok((headers, m3u_content))
}

/// Generate ETag from content hash
///
/// Uses fast non-cryptographic hash (DefaultHasher) since we only need
/// cache validation, not security.
fn generate_etag(content: &str) -> String {
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// XMLTV EPG endpoint handler (Story 4-2)
///
/// Generates an XMLTV-format EPG for Plex integration containing:
/// - Only enabled XMLTV channels with Xtream stream mappings
/// - Channel IDs matching M3U playlist tvg-id values
/// - Program data for enabled channels (7-day window)
/// - Placeholder programs for synthetic channels (2-hour blocks)
///
/// Returns Content-Type: application/xml with ETag for caching
/// Supports If-None-Match for 304 Not Modified responses
/// Implements server-side caching with 5-minute TTL
pub async fn epg_xml(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Check server-side cache first
    if let Some(cached) = state.get_epg_cache() {
        let etag = format!("\"{}\"", cached.etag);

        // Check If-None-Match for 304 response
        if let Some(client_etag) = headers.get(header::IF_NONE_MATCH) {
            if let Ok(etag_str) = client_etag.to_str() {
                if etag_str == etag {
                    // Return 304 Not Modified
                    let mut response_headers = HeaderMap::new();
                    response_headers.insert(header::ETAG, HeaderValue::from_str(&etag).unwrap());
                    response_headers.insert(
                        header::CACHE_CONTROL,
                        HeaderValue::from_static("public, max-age=300"),
                    );
                    return Ok((StatusCode::NOT_MODIFIED, response_headers, String::new()));
                }
            }
        }

        // Return cached content
        let content_length = cached.content.len();
        let mut response_headers = HeaderMap::new();
        response_headers.insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static("application/xml; charset=utf-8"),
        );
        response_headers.insert(
            header::CONTENT_LENGTH,
            HeaderValue::from_str(&content_length.to_string()).unwrap(),
        );
        response_headers.insert(header::ETAG, HeaderValue::from_str(&etag).unwrap());
        response_headers.insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("public, max-age=300"),
        );
        return Ok((StatusCode::OK, response_headers, cached.content));
    }

    // Cache miss - generate fresh EPG
    let mut conn = state.get_connection().map_err(|e| {
        eprintln!("EPG endpoint error - database connection failed: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;

    let xml_content = epg::generate_xmltv_epg(&mut conn).map_err(|e| {
        eprintln!("EPG endpoint error - generation failed: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;

    // Generate ETag and store in cache
    let etag_hash = generate_etag(&xml_content);
    let etag = format!("\"{}\"", etag_hash);
    state.set_epg_cache(xml_content.clone(), etag_hash);

    // Check If-None-Match for conditional request
    if let Some(client_etag) = headers.get(header::IF_NONE_MATCH) {
        if let Ok(etag_str) = client_etag.to_str() {
            if etag_str == etag {
                let mut response_headers = HeaderMap::new();
                response_headers.insert(header::ETAG, HeaderValue::from_str(&etag).unwrap());
                response_headers.insert(
                    header::CACHE_CONTROL,
                    HeaderValue::from_static("public, max-age=300"),
                );
                return Ok((StatusCode::NOT_MODIFIED, response_headers, String::new()));
            }
        }
    }

    let content_length = xml_content.len();
    let mut response_headers = HeaderMap::new();
    response_headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/xml; charset=utf-8"),
    );
    response_headers.insert(
        header::CONTENT_LENGTH,
        HeaderValue::from_str(&content_length.to_string()).unwrap(),
    );
    response_headers.insert(header::ETAG, HeaderValue::from_str(&etag).unwrap());
    response_headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=300"),
    );

    Ok((StatusCode::OK, response_headers, xml_content))
}

/// HDHomeRun discovery endpoint handler (Story 4-3)
///
/// Returns HDHomeRun-compatible device discovery information:
/// - FriendlyName: "StreamForge"
/// - ModelNumber: "HDHR5-4K"
/// - TunerCount from active Xtream accounts
/// - BaseURL and LineupURL with local IP and port
///
/// Plex uses this to auto-discover the tuner on the network.
pub async fn discover_json(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut conn = state.get_connection().map_err(|e| {
        eprintln!("HDHR discover error - database connection failed: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;

    let port = state.get_port();
    let response = hdhr::generate_discover_response(&mut conn, port).map_err(|e| {
        eprintln!("HDHR discover error - generation failed: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/json"),
    );

    Ok((headers, Json(response)))
}

/// HDHomeRun lineup endpoint handler (Story 4-3)
///
/// Returns channel lineup for HDHomeRun/Plex integration:
/// - Only enabled XMLTV channels with Xtream stream mappings
/// - GuideName from XMLTV display_name
/// - GuideNumber from plex_display_order
/// - URL pointing to /stream/{xmltv_channel_id}
///
/// Lineup is consistent with M3U playlist and EPG endpoints.
pub async fn lineup_json(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut conn = state.get_connection().map_err(|e| {
        eprintln!("HDHR lineup error - database connection failed: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;

    let port = state.get_port();
    let lineup = hdhr::generate_lineup(&mut conn, port).map_err(|e| {
        eprintln!("HDHR lineup error - generation failed: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/json"),
    );

    Ok((headers, Json(lineup)))
}

/// HDHomeRun lineup status endpoint handler (Story 4-3)
///
/// Returns static status indicating no scan in progress.
/// HDHomeRun protocol requires this endpoint, but StreamForge
/// doesn't support channel scanning (IPTV sources are pre-configured).
pub async fn lineup_status_json() -> impl IntoResponse {
    let status = hdhr::generate_lineup_status();

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/json"),
    );

    (headers, Json(status))
}

/// Stream information retrieved from database for proxying
#[derive(Debug)]
struct StreamInfo {
    xtream_stream_id: i32,
    qualities: Option<String>,
    server_url: String,
    username: String,
    password_encrypted: Vec<u8>,
    account_id: i32,
    account_is_active: i32,
}

/// Stream proxy endpoint handler (Story 4-4)
///
/// Proxies live streams from Xtream providers to Plex:
/// - Accepts XMLTV channel ID in URL path
/// - Looks up primary Xtream stream mapping for the channel
/// - Selects highest available quality (4K > FHD > HD > SD)
/// - Enforces connection limits (tuner limit from account settings)
/// - Proxies stream data with minimal buffering (streaming response)
///
/// Returns:
/// - 200 OK with video/mp2t stream data on success
/// - 404 Not Found if channel doesn't exist, is disabled, or has no mapping
/// - 503 Service Unavailable if tuner limit reached or Xtream server unavailable
pub async fn stream_proxy(
    Path(channel_id): Path<i32>,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Step 1: Get database connection
    let mut conn = state.get_connection().map_err(|e| {
        eprintln!("Stream proxy error - database connection failed: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;

    // Step 2: Look up primary Xtream stream for XMLTV channel
    let stream_info = get_primary_stream_for_channel(&mut conn, channel_id).map_err(|e| {
        eprintln!(
            "Stream proxy error - channel lookup failed for channel {}: {}",
            channel_id, e.1
        );
        e
    })?;

    // Step 3: Verify account is active
    if stream_info.account_is_active != 1 {
        eprintln!(
            "Stream proxy error - account {} is inactive for channel {}",
            stream_info.account_id, channel_id
        );
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            "Stream unavailable".to_string(),
        ));
    }

    // Step 4: Check connection limit
    let stream_manager = state.stream_manager();
    if !stream_manager.can_start_stream() {
        // Log tuner limit event
        log_tuner_limit_event(&mut conn, channel_id);
        eprintln!(
            "Stream proxy error - tuner limit reached ({}/{}) for channel {}",
            stream_manager.active_count(),
            stream_manager.max_connections(),
            channel_id
        );
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            "Tuner limit reached".to_string(),
        ));
    }

    // Step 5: Decrypt password
    let credential_manager = CredentialManager::new(state.app_data_dir().clone());
    let password = credential_manager
        .retrieve_password(
            &stream_info.account_id.to_string(),
            &stream_info.password_encrypted,
        )
        .map_err(|e| {
            eprintln!(
                "Stream proxy error - credential retrieval failed for account {}: {}",
                stream_info.account_id, e
            );
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error".to_string(),
            )
        })?;

    // Step 6: Select best quality
    let quality = select_best_quality(stream_info.qualities.as_deref());

    // Step 7: Build Xtream stream URL
    let stream_url = build_stream_url(
        &stream_info.server_url,
        &stream_info.username,
        &password,
        stream_info.xtream_stream_id,
    );

    // Step 8: Start session tracking
    let session = StreamSession::new(
        channel_id,
        stream_info.xtream_stream_id,
        quality.clone(),
    );
    let session_id = stream_manager.start_session(session).ok_or_else(|| {
        eprintln!(
            "Stream proxy error - failed to start session (limit reached) for channel {}",
            channel_id
        );
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "Tuner limit reached".to_string(),
        )
    })?;

    // Step 9: Fetch stream from Xtream provider
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| {
            stream_manager.end_session(&session_id);
            eprintln!("Stream proxy error - HTTP client creation failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error".to_string(),
            )
        })?;

    let upstream_response = client.get(&stream_url).send().await.map_err(|e| {
        stream_manager.end_session(&session_id);
        eprintln!(
            "Stream proxy error - upstream fetch failed for {}: {}",
            stream_url.split('/').take(4).collect::<Vec<_>>().join("/"), // Log URL without credentials
            e
        );
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "Stream unavailable".to_string(),
        )
    })?;

    // Check upstream response status
    if !upstream_response.status().is_success() {
        stream_manager.end_session(&session_id);
        eprintln!(
            "Stream proxy error - upstream returned status {} for channel {}",
            upstream_response.status(),
            channel_id
        );
        return Err((
            StatusCode::BAD_GATEWAY,
            "Stream source error".to_string(),
        ));
    }

    // Step 10: Build streaming response
    // Clone session_id for the cleanup closure
    let cleanup_session_id = session_id.clone();
    let cleanup_manager = stream_manager.clone();

    // Create a stream that will clean up the session when dropped
    let bytes_stream = upstream_response.bytes_stream();
    let stream_with_cleanup = bytes_stream.map(move |result| {
        result.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
    });

    // Wrap in a stream that cleans up session on drop
    let body = Body::from_stream(SessionCleanupStream {
        inner: Box::pin(stream_with_cleanup),
        session_id: cleanup_session_id,
        stream_manager: cleanup_manager,
    });

    let mut response = Response::new(body);
    *response.status_mut() = StatusCode::OK;
    response
        .headers_mut()
        .insert(header::CONTENT_TYPE, HeaderValue::from_static("video/mp2t"));

    Ok(response)
}

/// Get primary Xtream stream information for an XMLTV channel
///
/// Queries database for:
/// - Enabled XMLTV channel with valid primary mapping
/// - Active Xtream account credentials
///
/// Returns 404 if channel not found, disabled, or no primary mapping exists.
fn get_primary_stream_for_channel(
    conn: &mut crate::db::DbPooledConnection,
    xmltv_channel_id: i32,
) -> Result<StreamInfo, (StatusCode, String)> {
    // Check if channel is enabled
    let is_enabled: Option<i32> = xmltv_channel_settings::table
        .filter(xmltv_channel_settings::xmltv_channel_id.eq(xmltv_channel_id))
        .select(xmltv_channel_settings::is_enabled)
        .first(conn)
        .optional()
        .map_err(|e| {
            eprintln!("Stream lookup error - settings query failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error".to_string(),
            )
        })?
        .flatten();

    // Channel must be explicitly enabled (is_enabled = 1)
    if is_enabled != Some(1) {
        return Err((StatusCode::NOT_FOUND, "Channel not found".to_string()));
    }

    // Query for primary stream mapping with account info
    let result: Option<(i32, Option<String>, String, String, Vec<u8>, i32, i32)> = channel_mappings::table
        .inner_join(xtream_channels::table.on(
            channel_mappings::xtream_channel_id.eq(xtream_channels::id.assume_not_null())
        ))
        .inner_join(accounts::table.on(
            xtream_channels::account_id.eq(accounts::id.assume_not_null())
        ))
        .filter(channel_mappings::xmltv_channel_id.eq(xmltv_channel_id))
        .filter(channel_mappings::is_primary.eq(Some(1)))
        .select((
            xtream_channels::stream_id,
            xtream_channels::qualities,
            accounts::server_url,
            accounts::username,
            accounts::password_encrypted,
            accounts::id.assume_not_null(),
            accounts::is_active,
        ))
        .first(conn)
        .optional()
        .map_err(|e| {
            eprintln!("Stream lookup error - mapping query failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error".to_string(),
            )
        })?;

    match result {
        Some((stream_id, qualities, server_url, username, password_encrypted, account_id, is_active)) => {
            Ok(StreamInfo {
                xtream_stream_id: stream_id,
                qualities,
                server_url,
                username,
                password_encrypted,
                account_id,
                account_is_active: is_active,
            })
        }
        None => Err((StatusCode::NOT_FOUND, "Channel not found".to_string())),
    }
}

/// Log tuner limit event to event_log table
fn log_tuner_limit_event(conn: &mut crate::db::DbPooledConnection, channel_id: i32) {
    let event = NewEventLog::warn(
        "stream",
        format!("Tuner limit reached - rejected stream request for channel {}", channel_id),
    );

    if let Err(e) = diesel::insert_into(event_log::table)
        .values(&event)
        .execute(conn)
    {
        eprintln!("Failed to log tuner limit event: {}", e);
    }
}

/// Stream wrapper that cleans up session when dropped
///
/// This ensures the stream session is ended when:
/// - Client disconnects
/// - Stream ends naturally
/// - Any error occurs
use std::pin::Pin;
use std::task::{Context, Poll};
use futures_util::Stream;
use std::sync::Arc;

struct SessionCleanupStream<S> {
    inner: Pin<Box<S>>,
    session_id: String,
    stream_manager: Arc<super::stream::StreamManager>,
}

impl<S, T, E> Stream for SessionCleanupStream<S>
where
    S: Stream<Item = Result<T, E>> + Unpin,
{
    type Item = Result<T, E>;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        self.inner.as_mut().poll_next(cx)
    }
}

impl<S> Drop for SessionCleanupStream<S> {
    fn drop(&mut self) {
        self.stream_manager.end_session(&self.session_id);
    }
}

/// Test data seeding endpoint (only available when IPTV_TEST_MODE=1)
///
/// Seeds the database with test data for integration testing.
/// This endpoint is disabled in production builds.
///
/// POST /test/seed?clear=true - Seed test data (optionally clear existing first)
/// DELETE /test/seed - Clear test data
pub async fn seed_test_data(
    State(state): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<SeedParams>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Security: Only allow in test mode
    if std::env::var("IPTV_TEST_MODE").unwrap_or_default() != "1" {
        return Err((
            StatusCode::FORBIDDEN,
            "Test endpoints only available in test mode".to_string(),
        ));
    }

    let mut conn = state.get_connection().map_err(|e| {
        eprintln!("Test seed error - database connection failed: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database connection failed".to_string(),
        )
    })?;

    // Optionally clear existing test data
    if params.clear.unwrap_or(false) {
        clear_test_data(&mut conn).map_err(|e| {
            (StatusCode::INTERNAL_SERVER_ERROR, e)
        })?;
    }

    // Seed test data
    let records = seed_stream_proxy_data(&mut conn).map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, e)
    })?;

    Ok(Json(SeedResponse {
        success: true,
        message: format!("Seeded {} records", records),
        records_created: records,
    }))
}

/// Clear test data endpoint (only available when IPTV_TEST_MODE=1)
pub async fn clear_test_data_endpoint(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Security: Only allow in test mode
    if std::env::var("IPTV_TEST_MODE").unwrap_or_default() != "1" {
        return Err((
            StatusCode::FORBIDDEN,
            "Test endpoints only available in test mode".to_string(),
        ));
    }

    let mut conn = state.get_connection().map_err(|e| {
        eprintln!("Test clear error - database connection failed: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database connection failed".to_string(),
        )
    })?;

    clear_test_data(&mut conn).map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, e)
    })?;

    Ok(Json(SeedResponse {
        success: true,
        message: "Test data cleared".to_string(),
        records_created: 0,
    }))
}

#[derive(serde::Deserialize)]
pub struct SeedParams {
    clear: Option<bool>,
}

#[derive(Serialize)]
pub struct SeedResponse {
    success: bool,
    message: String,
    records_created: usize,
}

/// Clear test data from database
fn clear_test_data(conn: &mut crate::db::DbPooledConnection) -> Result<(), String> {
    use crate::db::schema::{xmltv_sources, xmltv_channels as xmltv_ch};

    // Delete in reverse dependency order
    diesel::delete(channel_mappings::table.filter(channel_mappings::id.le(100)))
        .execute(conn)
        .map_err(|e| format!("Failed to clear channel_mappings: {}", e))?;

    diesel::delete(xmltv_channel_settings::table.filter(xmltv_channel_settings::xmltv_channel_id.le(100)))
        .execute(conn)
        .map_err(|e| format!("Failed to clear xmltv_channel_settings: {}", e))?;

    diesel::delete(xtream_channels::table.filter(xtream_channels::id.le(2000)))
        .execute(conn)
        .map_err(|e| format!("Failed to clear xtream_channels: {}", e))?;

    diesel::delete(xmltv_ch::table.filter(xmltv_ch::id.le(100)))
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

/// Seed stream proxy test data
fn seed_stream_proxy_data(conn: &mut crate::db::DbPooledConnection) -> Result<usize, String> {
    let mut records = 0;

    // Seed accounts
    // Use keychain placeholder format: "keychain:{account_id}" which the credential manager recognizes
    // Account 1: Active account - password_encrypted = "keychain:1" as bytes
    diesel::sql_query(
        "INSERT OR REPLACE INTO accounts (id, name, server_url, username, password_encrypted, max_connections, is_active, created_at, updated_at)
         VALUES (1, 'Test IPTV Provider', 'http://test-xtream.local:8080', 'testuser', X'6b6579636861696e3a31', 2, 1, datetime('now'), datetime('now'))"
    )
    .execute(conn)
    .map_err(|e| format!("Failed to seed account 1: {}", e))?;
    records += 1;

    // Account 2: Inactive account - password_encrypted = "keychain:2" as bytes
    diesel::sql_query(
        "INSERT OR REPLACE INTO accounts (id, name, server_url, username, password_encrypted, max_connections, is_active, created_at, updated_at)
         VALUES (2, 'Inactive Provider', 'http://inactive.local:8080', 'inactive', X'6b6579636861696e3a32', 1, 0, datetime('now'), datetime('now'))"
    )
    .execute(conn)
    .map_err(|e| format!("Failed to seed account 2: {}", e))?;
    records += 1;

    // Account 3: Unreachable server - password_encrypted = "keychain:3" as bytes
    diesel::sql_query(
        "INSERT OR REPLACE INTO accounts (id, name, server_url, username, password_encrypted, max_connections, is_active, created_at, updated_at)
         VALUES (3, 'Unreachable Provider', 'http://192.0.2.1:9999', 'noreachuser', X'6b6579636861696e3a33', 1, 1, datetime('now'), datetime('now'))"
    )
    .execute(conn)
    .map_err(|e| format!("Failed to seed account 3: {}", e))?;
    records += 1;

    // Seed XMLTV source (format must be 'xml', 'xml_gz', or 'auto')
    diesel::sql_query(
        "INSERT OR REPLACE INTO xmltv_sources (id, name, url, format, is_active, last_refresh, refresh_hour, created_at, updated_at)
         VALUES (1, 'Test EPG Source', 'http://test-epg.local/epg.xml', 'xml', 1, datetime('now'), 3, datetime('now'), datetime('now'))"
    )
    .execute(conn)
    .map_err(|e| format!("Failed to seed xmltv_source: {}", e))?;
    records += 1;

    // Seed XMLTV channels
    let channels = [
        (1, "test.channel.1", "Test Channel 1"),
        (2, "test.channel.2", "Test Channel 2 (Disabled)"),
        (3, "test.channel.3", "Test Channel 3 (No Primary)"),
        (4, "test.channel.4", "Test Channel 4K"),
        (5, "test.channel.5", "Test Channel HD"),
        (6, "test.channel.6", "Test Channel SD"),
        (7, "test.channel.7", "Test Channel NoQuality"),
        (8, "test.channel.8", "Test Channel FHD"),
        (9, "test.channel.9", "Test Channel Unreachable"),
        (10, "test.channel.10", "Test Channel Inactive"),
    ];

    for (id, channel_id, display_name) in &channels {
        diesel::sql_query(format!(
            "INSERT OR REPLACE INTO xmltv_channels (id, source_id, channel_id, display_name, icon, is_synthetic, created_at, updated_at)
             VALUES ({}, 1, '{}', '{}', 'http://icons.local/ch{}.png', 0, datetime('now'), datetime('now'))",
            id, channel_id, display_name, id
        ))
        .execute(conn)
        .map_err(|e| format!("Failed to seed xmltv_channel {}: {}", id, e))?;
        records += 1;
    }

    // Seed XMLTV channel settings (channel 2 is disabled)
    let settings: [(i32, i32, i32); 10] = [
        (1, 1, 1), (2, 0, 2), (3, 1, 3), (4, 1, 4), (5, 1, 5),
        (6, 1, 6), (7, 1, 7), (8, 1, 8), (9, 1, 9), (10, 1, 10),
    ];

    for (channel_id, is_enabled, plex_order) in &settings {
        diesel::sql_query(format!(
            "INSERT OR REPLACE INTO xmltv_channel_settings (xmltv_channel_id, is_enabled, plex_display_order, created_at, updated_at)
             VALUES ({}, {}, {}, datetime('now'), datetime('now'))",
            channel_id, is_enabled, plex_order
        ))
        .execute(conn)
        .map_err(|e| format!("Failed to seed settings for {}: {}", channel_id, e))?;
        records += 1;
    }

    // Seed Xtream channels with various qualities
    let xtream_data = [
        (1001, 1, 1001, "Xtream Ch1", r#"["4K","HD","SD"]"#),
        (1004, 1, 1004, "Xtream Ch4 4K", r#"["4K","FHD","HD","SD"]"#),
        (1005, 1, 1005, "Xtream Ch5 HD", r#"["HD","SD"]"#),
        (1006, 1, 1006, "Xtream Ch6 SD", r#"["SD"]"#),
        (1008, 1, 1008, "Xtream Ch8 FHD", r#"["FHD","HD","SD"]"#),
        (1009, 3, 1009, "Xtream Ch9 Unreachable", r#"["HD"]"#),
        (1010, 2, 1010, "Xtream Ch10 Inactive", r#"["HD"]"#),
    ];

    for (id, account_id, stream_id, name, qualities) in &xtream_data {
        diesel::sql_query(format!(
            "INSERT OR REPLACE INTO xtream_channels (id, account_id, stream_id, name, stream_icon, qualities, category_id, added_at, updated_at)
             VALUES ({}, {}, {}, '{}', 'http://icons.local/x{}.png', '{}', 1, datetime('now'), datetime('now'))",
            id, account_id, stream_id, name, id, qualities
        ))
        .execute(conn)
        .map_err(|e| format!("Failed to seed xtream_channel {}: {}", id, e))?;
        records += 1;
    }

    // Channel 7 with NULL qualities
    diesel::sql_query(
        "INSERT OR REPLACE INTO xtream_channels (id, account_id, stream_id, name, stream_icon, qualities, category_id, added_at, updated_at)
         VALUES (1007, 1, 1007, 'Xtream Ch7 NoQ', 'http://icons.local/x1007.png', NULL, 1, datetime('now'), datetime('now'))"
    )
    .execute(conn)
    .map_err(|e| format!("Failed to seed xtream_channel 1007: {}", e))?;
    records += 1;

    // Seed channel mappings
    let mappings: [(i32, i32, i32, f64, i32, i32, i32); 9] = [
        (1, 1, 1001, 0.95, 0, 1, 0),   // Ch1 → primary
        (3, 3, 1001, 0.85, 0, 0, 1),   // Ch3 → NOT primary
        (4, 4, 1004, 0.98, 0, 1, 0),   // Ch4 → 4K
        (5, 5, 1005, 0.97, 0, 1, 0),   // Ch5 → HD
        (6, 6, 1006, 0.96, 0, 1, 0),   // Ch6 → SD
        (7, 7, 1007, 0.95, 0, 1, 0),   // Ch7 → NoQ
        (8, 8, 1008, 0.94, 0, 1, 0),   // Ch8 → FHD
        (9, 9, 1009, 0.93, 0, 1, 0),   // Ch9 → Unreachable
        (10, 10, 1010, 0.92, 0, 1, 0), // Ch10 → Inactive
    ];

    for (id, xmltv_id, xtream_id, confidence, is_manual, is_primary, priority) in &mappings {
        diesel::sql_query(format!(
            "INSERT OR REPLACE INTO channel_mappings (id, xmltv_channel_id, xtream_channel_id, match_confidence, is_manual, is_primary, stream_priority, created_at)
             VALUES ({}, {}, {}, {}, {}, {}, {}, datetime('now'))",
            id, xmltv_id, xtream_id, confidence, is_manual, is_primary, priority
        ))
        .execute(conn)
        .map_err(|e| format!("Failed to seed mapping {}: {}", id, e))?;
        records += 1;
    }

    Ok(records)
}
