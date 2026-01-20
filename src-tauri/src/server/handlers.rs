use axum::{
    extract::State,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

use super::epg;
use super::hdhr;
use super::m3u;
use super::state::AppState;

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
