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

use super::epg;
use super::failover::{
    get_all_streams_for_channel, log_failover_event, BackupStream, FailoverState, FailureReason,
    FAILOVER_CONNECT_TIMEOUT, FAILOVER_TOTAL_TIMEOUT,
};
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

/// Stream proxy endpoint handler (Story 4-4 + Story 4-5 Failover)
///
/// Proxies live streams from Xtream providers to Plex with automatic failover:
/// - Accepts XMLTV channel ID in URL path
/// - Loads ALL available streams for the channel (primary + backups)
/// - Tries streams in priority order until one works
/// - Failover completes in <2 seconds (NFR2)
/// - Selects highest available quality for each stream (4K > FHD > HD > SD)
/// - Enforces connection limits (tuner limit from account settings)
/// - Logs failover events to event_log table
///
/// Returns:
/// - 200 OK with video/mp2t stream data on success
/// - 404 Not Found if channel doesn't exist, is disabled, or has no mapping
/// - 503 Service Unavailable if tuner limit reached or all streams fail
pub async fn stream_proxy(
    Path(channel_id): Path<i32>,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Step 1: Check connection limit FIRST (before expensive DB/crypto operations)
    let stream_manager = state.stream_manager();
    if !stream_manager.can_start_stream() {
        eprintln!(
            "Stream proxy error - tuner limit reached ({}/{}) for channel {}",
            stream_manager.active_count(),
            stream_manager.max_connections(),
            channel_id
        );

        // Log tuner limit event (requires DB connection)
        if let Ok(mut conn) = state.get_connection() {
            log_tuner_limit_event(&mut conn, channel_id);
        }

        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            "Tuner limit reached".to_string(),
        ));
    }

    // Step 2: Get database connection
    let mut conn = state.get_connection().map_err(|e| {
        eprintln!("Stream proxy error - database connection failed: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;

    // Step 3: Check if channel is enabled
    let is_enabled: Option<i32> = xmltv_channel_settings::table
        .filter(xmltv_channel_settings::xmltv_channel_id.eq(channel_id))
        .select(xmltv_channel_settings::is_enabled)
        .first(&mut conn)
        .optional()
        .map_err(|e| {
            eprintln!("Stream lookup error - settings query failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error".to_string(),
            )
        })?
        .flatten();

    if is_enabled != Some(1) {
        return Err((StatusCode::NOT_FOUND, "Channel not found".to_string()));
    }

    // Step 4: Load ALL available streams for failover (Story 4-5)
    let available_streams = get_all_streams_for_channel(&mut conn, channel_id).map_err(|e| {
        eprintln!(
            "Stream proxy error - stream lookup failed for channel {}: {}",
            channel_id, e
        );
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;

    if available_streams.is_empty() {
        return Err((StatusCode::NOT_FOUND, "Channel not found".to_string()));
    }

    // Step 5: Initialize failover state
    let mut failover_state = FailoverState::new(channel_id, available_streams);
    let credential_manager = CredentialManager::new(state.app_data_dir().clone());

    // Step 6: Create HTTP client with aggressive failover timeouts
    let client = reqwest::Client::builder()
        .connect_timeout(FAILOVER_CONNECT_TIMEOUT)
        .timeout(FAILOVER_TOTAL_TIMEOUT)
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| {
            eprintln!("Stream proxy error - HTTP client creation failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error".to_string(),
            )
        })?;

    // Step 7: Try streams in order until one works
    let failover_start = std::time::Instant::now();
    let mut last_failure_reason: Option<FailureReason> = None;
    let mut successful_stream: Option<(BackupStream, String, reqwest::Response)> = None;

    loop {
        // Check total failover timeout
        if failover_start.elapsed() > FAILOVER_TOTAL_TIMEOUT {
            eprintln!(
                "Stream proxy error - failover timeout exceeded for channel {}",
                channel_id
            );
            break;
        }

        let current_stream = match failover_state.current_stream() {
            Some(s) => s.clone(),
            None => break,
        };

        // Try to connect to current stream
        match try_connect_stream(&client, &credential_manager, &current_stream).await {
            Ok((url, response)) => {
                // Success! Log failover if we're not on the first stream
                if failover_state.is_on_backup() {
                    if let Some(reason) = &last_failure_reason {
                        let from_stream_id = failover_state.original_stream_id;
                        let _ = log_failover_event(
                            &mut conn,
                            channel_id,
                            from_stream_id,
                            Some(current_stream.stream_id),
                            reason,
                        );
                    }
                }

                successful_stream = Some((current_stream, url, response));
                break;
            }
            Err(reason) => {
                eprintln!(
                    "Stream proxy - stream {} failed for channel {}: {}",
                    current_stream.stream_id, channel_id, reason
                );
                last_failure_reason = Some(reason);

                // Try next stream
                if !failover_state.advance_to_next_stream() {
                    break; // No more streams
                }
            }
        }
    }

    // Step 8: Handle result
    let (stream_info, _stream_url, upstream_response) = match successful_stream {
        Some(s) => s,
        None => {
            // All streams failed - log error event
            if let Some(reason) = &last_failure_reason {
                let from_stream_id = failover_state.original_stream_id;
                let _ = log_failover_event(&mut conn, channel_id, from_stream_id, None, reason);
            }

            eprintln!(
                "Stream proxy error - all {} streams failed for channel {}",
                failover_state.stream_count(),
                channel_id
            );
            return Err((
                StatusCode::SERVICE_UNAVAILABLE,
                "Stream unavailable".to_string(),
            ));
        }
    };

    // Step 9: Select quality and start session tracking
    let qualities_json = if stream_info.qualities.is_empty() {
        None
    } else {
        serde_json::to_string(&stream_info.qualities).ok()
    };
    let quality = select_best_quality(qualities_json.as_deref());

    let session = StreamSession::new(channel_id, stream_info.stream_id, quality.clone());
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

    // Step 10: Build streaming response
    let cleanup_session_id = session_id.clone();
    let cleanup_manager = stream_manager.clone();

    let bytes_stream = upstream_response.bytes_stream();
    let stream_with_cleanup = bytes_stream.map(move |result| {
        result.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
    });

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

/// Try to connect to a stream and return the response if successful
async fn try_connect_stream(
    client: &reqwest::Client,
    credential_manager: &CredentialManager,
    stream: &BackupStream,
) -> Result<(String, reqwest::Response), FailureReason> {
    // Decrypt password
    let password = credential_manager
        .retrieve_password(&stream.account_id.to_string(), &stream.password_encrypted)
        .map_err(|e| {
            eprintln!(
                "Stream failover - credential decryption failed for account {}: {}",
                stream.account_id, e
            );
            FailureReason::ConnectionError(format!("Credential error: {}", e))
        })?;

    // Select quality
    let qualities_json = if stream.qualities.is_empty() {
        None
    } else {
        serde_json::to_string(&stream.qualities).ok()
    };
    let quality = select_best_quality(qualities_json.as_deref());

    // Build URL
    let stream_url = build_stream_url(
        &stream.server_url,
        &stream.username,
        &password,
        stream.stream_id,
    );

    eprintln!(
        "Stream failover - trying stream {} (priority {}, quality {})",
        stream.stream_id, stream.stream_priority, quality
    );

    // Attempt connection
    let response = client
        .get(&stream_url)
        .send()
        .await
        .map_err(|e| FailureReason::from_reqwest_error(&e))?;

    // Check HTTP status
    if !response.status().is_success() {
        return Err(FailureReason::from_http_status(response.status()));
    }

    Ok((stream_url, response))
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

    // Seed Xtream channels with various qualities for failover testing
    // Story 4-5 test data:
    // - Channel 1: Enabled with primary + 2 backup streams (priority 0, 1, 2)
    // - Channel 2: Enabled with primary + 1 backup (priority 0, 1)
    // - Channel 3: Enabled with 3 backups, all same quality
    // - Channel 4: Enabled with primary only (no backups)
    // - Channel 5: Enabled with primary (unreachable) + working backup
    // - Channel 6: Enabled with all streams unreachable
    let xtream_data = [
        // Channel 1 streams (multiple backups with different priorities)
        (1001, 1, 1001, "Ch1 Primary", r#"["4K","HD","SD"]"#),
        (1002, 1, 1002, "Ch1 Backup 1", r#"["HD","SD"]"#),
        (1003, 1, 1003, "Ch1 Backup 2", r#"["SD"]"#),
        // Channel 2 streams
        (1011, 1, 1011, "Ch2 Primary", r#"["HD","SD"]"#),
        (1012, 1, 1012, "Ch2 Backup", r#"["SD"]"#),
        // Channel 3 streams (same quality)
        (1021, 1, 1021, "Ch3 Stream 1", r#"["HD"]"#),
        (1022, 1, 1022, "Ch3 Stream 2", r#"["HD"]"#),
        (1023, 1, 1023, "Ch3 Stream 3", r#"["HD"]"#),
        // Channel 4 - single stream (from account 1)
        (1031, 1, 1031, "Ch4 Primary Only", r#"["4K","FHD","HD","SD"]"#),
        // Channel 5 - primary unreachable (account 3), backup working (account 1)
        (1041, 3, 1041, "Ch5 Primary Unreachable", r#"["HD"]"#),
        (1042, 1, 1042, "Ch5 Backup Working", r#"["HD","SD"]"#),
        // Channel 6 - all unreachable (account 3)
        (1051, 3, 1051, "Ch6 Stream 1 Unreachable", r#"["HD"]"#),
        (1052, 3, 1052, "Ch6 Stream 2 Unreachable", r#"["HD"]"#),
        // Additional channels for backward compatibility
        (1007, 1, 1007, "Xtream Ch7 NoQ", r#"["SD"]"#),
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

    // Seed channel mappings for failover testing
    // (id, xmltv_id, xtream_id, confidence, is_manual, is_primary, stream_priority)
    let mappings: [(i32, i32, i32, f64, i32, i32, i32); 18] = [
        // Channel 1: primary + 2 backups
        (1, 1, 1001, 0.95, 0, 1, 0),   // Primary
        (2, 1, 1002, 0.90, 0, 0, 1),   // Backup 1
        (3, 1, 1003, 0.85, 0, 0, 2),   // Backup 2
        // Channel 2: primary + 1 backup
        (4, 2, 1011, 0.95, 0, 1, 0),   // Primary
        (5, 2, 1012, 0.90, 0, 0, 1),   // Backup
        // Channel 3: 3 streams same quality
        (6, 3, 1021, 0.95, 0, 1, 0),   // Primary
        (7, 3, 1022, 0.90, 0, 0, 1),   // Backup 1
        (8, 3, 1023, 0.85, 0, 0, 2),   // Backup 2
        // Channel 4: single stream only
        (9, 4, 1031, 0.98, 0, 1, 0),   // Primary only
        // Channel 5: unreachable primary, working backup
        (10, 5, 1041, 0.95, 0, 1, 0),  // Primary (unreachable - account 3)
        (11, 5, 1042, 0.90, 0, 0, 1),  // Backup (working - account 1)
        // Channel 6: all unreachable
        (12, 6, 1051, 0.95, 0, 1, 0),  // Primary (unreachable)
        (13, 6, 1052, 0.90, 0, 0, 1),  // Backup (also unreachable)
        // Additional channels for backward compatibility
        (14, 7, 1007, 0.95, 0, 1, 0),  // Ch7 → NoQ
        (15, 8, 1008, 0.94, 0, 1, 0),  // Ch8 → FHD
        (16, 9, 1009, 0.93, 0, 1, 0),  // Ch9 → Unreachable
        (17, 10, 1010, 0.92, 0, 1, 0), // Ch10 → Inactive
        (18, 3, 1001, 0.85, 0, 0, 3),  // Legacy Ch3 → NOT primary (old mapping)
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
