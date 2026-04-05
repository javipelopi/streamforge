//! Management REST API
//!
//! Axum HTTP/JSON routes that expose the same operations as Tauri commands,
//! allowing the frontend to communicate via fetch() instead of tauri.invoke().
//!
//! Issue: ip-wps

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::types::{
    AccountError, AccountResponse, AddAccountRequest, UpdateAccountRequest,
    ChannelResponse, EpgSourceError, XmltvSourceResponse, EventLogResponse,
    // M3U types
    AddM3uSourceInput, M3uChannelResponse, M3uSourceWithStats, RefreshM3uResult,
    UpdateM3uSourceInput,
    // Acestream types
    AcestreamSourceResponse, AddAcestreamSourceInput, UpdateAcestreamSourceInput,
    // XMLTV channel types
    XmltvChannelWithMappings, AllChannelMappings, XtreamStreamSearchResult,
    TargetLineupChannel, XmltvSourceChannel,
    // EPG types
    XmltvChannelResponse, ProgramResponse, EpgScheduleResponse,
    EpgSearchResult, EpgGridChannel, ChannelStreamInfo, ProgramWithChannel,
    // Matcher types
    MatchResponse, M3uAutoMatchResponse,
    // Config types (from commands::config)
    LogEventInput,
};
use crate::db::models::XmltvSourceUpdate;
use crate::db::schema::{accounts, settings, xmltv_sources};
use crate::db::{Account, Setting, XmltvSource};
use crate::matcher::{MatchStats, M3uMatchResult};
use crate::services;

use super::state::AppState;

// ---------------------------------------------------------------------------
// Shared error helper
// ---------------------------------------------------------------------------

type ApiResult<T> = Result<Json<T>, (StatusCode, Json<ApiError>)>;

#[derive(Serialize)]
pub struct ApiError {
    pub error: String,
}

fn api_err(status: StatusCode, msg: impl Into<String>) -> (StatusCode, Json<ApiError>) {
    (status, Json(ApiError { error: msg.into() }))
}

fn internal(msg: impl Into<String>) -> (StatusCode, Json<ApiError>) {
    api_err(StatusCode::INTERNAL_SERVER_ERROR, msg)
}

fn not_found(msg: impl Into<String>) -> (StatusCode, Json<ApiError>) {
    api_err(StatusCode::NOT_FOUND, msg)
}

fn bad_request(msg: impl Into<String>) -> (StatusCode, Json<ApiError>) {
    api_err(StatusCode::BAD_REQUEST, msg)
}

/// Map `AccountError` to an appropriate HTTP status + JSON error body.
fn account_err(e: AccountError) -> (StatusCode, Json<ApiError>) {
    let status = match &e {
        AccountError::NotFound => StatusCode::NOT_FOUND,
        AccountError::NameRequired
        | AccountError::ServerUrlRequired
        | AccountError::InvalidServerUrl
        | AccountError::UsernameRequired
        | AccountError::PasswordRequired => StatusCode::BAD_REQUEST,
        AccountError::CredentialStorageError
        | AccountError::DatabaseError(_)
        | AccountError::AppDataDirError => {
            StatusCode::INTERNAL_SERVER_ERROR
        }
    };
    api_err(status, e.to_string())
}

/// Map `EpgSourceError` to an appropriate HTTP status + JSON error body.
fn epg_err(e: EpgSourceError) -> (StatusCode, Json<ApiError>) {
    let status = match &e {
        EpgSourceError::NotFound => StatusCode::NOT_FOUND,
        EpgSourceError::NameRequired
        | EpgSourceError::UrlRequired
        | EpgSourceError::InvalidUrl
        | EpgSourceError::InvalidUrlScheme
        | EpgSourceError::InvalidFormat
        | EpgSourceError::DuplicateUrl => StatusCode::BAD_REQUEST,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    };
    api_err(status, e.to_string())
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn api_router() -> Router<AppState> {
    Router::new()
        // Accounts
        .route("/accounts", get(list_accounts).post(create_account))
        .route("/accounts/{id}", get(get_account).put(update_account).delete(delete_account))
        .route("/accounts/{id}/toggle", post(toggle_account))
        .route("/accounts/{id}/test", post(test_account_connection))
        // M3U Sources
        .route("/m3u-sources", get(list_m3u_sources).post(create_m3u_source))
        .route("/m3u-sources/{id}", put(update_m3u_source_handler).delete(delete_m3u_source))
        .route("/m3u-sources/{id}/refresh", post(refresh_m3u_source))
        .route("/m3u-sources/{id}/toggle", post(toggle_m3u_source))
        .route("/m3u-sources/{id}/channels", get(get_m3u_channels))
        // Acestream Sources
        .route("/acestream/status", get(check_acestream_status))
        .route("/acestream-sources", get(list_acestream_sources).post(create_acestream_source))
        .route("/acestream-sources/{id}", put(update_acestream_source_handler).delete(delete_acestream_source))
        .route("/acestream-sources/{id}/toggle", post(toggle_acestream_source))
        // XMLTV sources
        .route("/xmltv-sources", get(list_xmltv_sources).post(create_xmltv_source))
        .route("/xmltv-sources/{id}", get(get_xmltv_source).put(update_xmltv_source).delete(delete_xmltv_source))
        .route("/xmltv-sources/{id}/toggle", post(toggle_xmltv_source))
        // XMLTV Channels (display/mappings)
        .route("/xmltv-channels/with-mappings", get(get_xmltv_channels_with_mappings))
        .route("/xmltv-channels/{id}/primary-stream", post(set_primary_stream))
        .route("/xmltv-channels/{id}/toggle", post(toggle_xmltv_channel))
        .route("/xmltv-channels/{id}/order", put(update_channel_order))
        .route("/xmltv-channels/order", put(bulk_update_channel_order))
        .route("/xmltv-channels/{id}/mappings", get(get_all_channel_mappings))
        .route("/xmltv-channels/{id}/mappings/xtream", post(add_manual_stream_mapping))
        .route("/xmltv-channels/{id}/mappings/m3u", post(add_m3u_channel_mapping))
        .route("/xmltv-channels/{id}/mappings/acestream", post(add_acestream_channel_mapping))
        .route("/xmltv-channels/bulk-toggle", post(bulk_toggle_channels))
        .route("/xmltv-channels/for-source/{source_id}", get(get_xmltv_channels_for_source))
        .route("/xmltv-channels/target-lineup", get(get_target_lineup_channels))
        // Xtream streams
        .route("/xtream-streams", get(get_all_xtream_streams))
        .route("/xtream-streams/search", get(search_xtream_streams))
        .route("/xtream-streams/orphans", get(get_orphan_xtream_streams))
        .route("/xtream-streams/account/{account_id}", get(get_xtream_streams_for_account))
        .route("/xtream-streams/account/{account_id}/stats", get(get_account_stream_stats))
        .route("/xtream-streams/{id}/unlink", post(unlink_xtream_stream))
        .route("/xtream-streams/{id}/url", get(get_xtream_stream_url))
        // Orphan promote endpoints
        .route("/xmltv-channels/orphans/xtream/{id}/promote", post(promote_orphan_to_plex))
        .route("/xmltv-channels/orphans/m3u/{id}/promote", post(promote_m3u_orphan_to_plex))
        .route("/xmltv-channels/orphans/acestream/{id}/promote", post(promote_acestream_orphan_to_plex))
        // Synthetic channel update
        .route("/xmltv-channels/synthetic/{id}", put(update_synthetic_channel))
        // Channel tags
        .route("/tags", get(get_all_tags))
        .route("/xmltv-channels/{id}/tags", get(get_channel_tags).put(set_channel_tags))
        // Orphan M3U and Acestream
        .route("/orphans/m3u", get(get_orphan_m3u_channels))
        .route("/orphans/acestream", get(get_orphan_acestream_sources))
        // Mappings
        .route("/mappings/{id}", delete(remove_stream_mapping))
        // EPG
        .route("/epg/refresh", post(refresh_all_epg))
        .route("/epg/refresh/{source_id}", post(refresh_epg_source))
        .route("/epg/stats", get(get_epg_stats))
        .route("/epg/channels/{source_id}", get(get_xmltv_channels_for_epg))
        .route("/epg/programs/{source_id}", get(get_programs))
        .route("/epg/programs/by-id/{program_id}", get(get_program_by_id))
        .route("/epg/schedule", get(get_epg_schedule).put(set_epg_schedule))
        .route("/epg/grid", get(get_enabled_channels_with_programs))
        .route("/epg/search", get(search_epg_programs))
        .route("/epg/channel-stream-info/{channel_id}", get(get_channel_stream_info))
        // Settings
        .route("/settings", get(get_all_settings))
        .route("/settings/{key}", get(get_setting).put(set_setting))
        .route("/settings/plex-config", get(get_plex_config))
        .route("/settings/resilience-config", get(get_resilience_config))
        .route("/settings/failover-strictness", put(set_failover_strictness))
        .route("/settings/restart-server", post(restart_server))
        // Channels
        .route("/channels/{account_id}", get(list_channels))
        .route("/channels/{account_id}/scan", post(scan_channels))
        .route("/channels/{account_id}/count", get(get_channel_count))
        .route("/channels/{account_id}/scan-and-rematch", post(scan_and_rematch))
        // Events / logs
        .route("/events", get(list_events).post(log_event))
        .route("/events/unread-count", get(get_unread_count))
        .route("/events/{id}/read", post(mark_event_read))
        .route("/events/read-all", post(mark_all_events_read))
        .route("/events/clear-old", post(clear_old_events))
        // Matcher
        .route("/matcher/stats", get(get_matcher_stats))
        .route("/matcher/run", post(run_matching))
        .route("/matcher/threshold", get(get_match_threshold).put(set_match_threshold))
        .route("/matcher/normalize", get(normalize_channel_name))
        .route("/matcher/score", get(calculate_match_score))
        .route("/matcher/channel-mappings/{xmltv_channel_id}", get(get_channel_mappings_for_xmltv))
        .route("/matcher/channel-settings/{xmltv_channel_id}", get(get_xmltv_channel_settings))
        .route("/matcher/auto-match-m3u", post(auto_match_m3u_channels))
        .route("/matcher/m3u-match-results", get(get_m3u_auto_match_results))
        // Config
        .route("/config/export", get(export_configuration))
        .route("/config/import", post(import_configuration))
        .route("/config/validate-import", post(validate_import_file))
        // Matching Profiles
        .route("/matching-profiles", get(list_matching_profiles).post(create_matching_profile))
        .route("/matching-profiles/{id}", get(get_matching_profile).put(update_matching_profile).delete(delete_matching_profile))
        .route("/matching-profiles/reorder", post(reorder_matching_profiles))
        .route("/matching-profiles/preview", post(preview_matching_normalization))
        // Updates
        .route("/updates/version", get(get_current_version))
        .route("/updates/settings", get(get_update_settings_handler))
        .route("/updates/auto-check", put(set_auto_check_updates_handler))
        .route("/updates/check", post(check_for_update_handler))
}

// ===========================================================================
// Accounts
// ===========================================================================

async fn list_accounts(State(state): State<AppState>) -> ApiResult<Vec<AccountResponse>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let accounts = services::accounts::get_accounts(&mut conn).map_err(account_err)?;
    Ok(Json(accounts))
}

async fn get_account(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> ApiResult<AccountResponse> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let account: Account = accounts::table
        .filter(accounts::id.eq(id))
        .first(&mut conn)
        .optional()
        .map_err(|e| internal(e.to_string()))?
        .ok_or_else(|| not_found("Account not found"))?;

    Ok(Json(AccountResponse::from(account)))
}

async fn create_account(
    State(state): State<AppState>,
    Json(req): Json<AddAccountRequest>,
) -> Result<(StatusCode, Json<AccountResponse>), (StatusCode, Json<ApiError>)> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let account = services::accounts::add_account(&mut conn, state.app_data_dir(), &req)
        .map_err(account_err)?;
    Ok((StatusCode::CREATED, Json(account)))
}

async fn update_account(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(req): Json<UpdateAccountRequest>,
) -> ApiResult<AccountResponse> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let account = services::accounts::update_account(&mut conn, state.app_data_dir(), id, &req)
        .map_err(account_err)?;
    Ok(Json(account))
}

async fn delete_account(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    services::accounts::delete_account(&mut conn, state.app_data_dir(), id)
        .map_err(account_err)?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToggleRequest {
    pub is_active: bool,
}

async fn toggle_account(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(req): Json<ToggleRequest>,
) -> ApiResult<AccountResponse> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let account = services::accounts::toggle_account(&mut conn, id, req.is_active)
        .map_err(account_err)?;
    Ok(Json(account))
}

async fn test_account_connection(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> ApiResult<crate::types::TestConnectionResponse> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let response = services::accounts::test_connection(&mut conn, state.app_data_dir(), id)
        .await
        .map_err(account_err)?;
    Ok(Json(response))
}

// ===========================================================================
// M3U Sources
// ===========================================================================

async fn list_m3u_sources(State(state): State<AppState>) -> ApiResult<Vec<M3uSourceWithStats>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let sources = services::m3u::get_m3u_sources(&mut conn)
        .map_err(internal)?;
    Ok(Json(sources))
}

async fn create_m3u_source(
    State(state): State<AppState>,
    Json(req): Json<AddM3uSourceInput>,
) -> Result<(StatusCode, Json<M3uSourceWithStats>), (StatusCode, Json<ApiError>)> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let source = services::m3u::add_m3u_source(&mut conn, &req)
        .await
        .map_err(bad_request)?;
    Ok((StatusCode::CREATED, Json(source)))
}

async fn refresh_m3u_source(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> ApiResult<RefreshM3uResult> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let result = services::m3u::refresh_m3u_source(&mut conn, id)
        .await
        .map_err(internal)?;
    Ok(Json(result))
}

async fn delete_m3u_source(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    services::m3u::delete_m3u_source(&mut conn, id)
        .map_err(internal)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn get_m3u_channels(
    State(state): State<AppState>,
    Path(source_id): Path<i32>,
) -> ApiResult<Vec<M3uChannelResponse>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let channels = services::m3u::get_m3u_channels(&mut conn, source_id)
        .map_err(internal)?;
    Ok(Json(channels))
}

async fn toggle_m3u_source(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(req): Json<ToggleRequest>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    services::m3u::toggle_m3u_source(&mut conn, id, req.is_active)
        .map_err(internal)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn update_m3u_source_handler(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(req): Json<UpdateM3uSourceInput>,
) -> ApiResult<M3uSourceWithStats> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let source = services::m3u::update_m3u_source(&mut conn, id, &req)
        .map_err(internal)?;
    Ok(Json(source))
}

// ===========================================================================
// Acestream Sources
// ===========================================================================

async fn check_acestream_status() -> ApiResult<crate::acestream::AcestreamStatus> {
    let status = crate::acestream::get_acestream_status().await;
    Ok(Json(status))
}

async fn list_acestream_sources(State(state): State<AppState>) -> ApiResult<Vec<AcestreamSourceResponse>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let sources = services::acestream::get_acestream_sources(&mut conn)
        .map_err(internal)?;
    Ok(Json(sources))
}

async fn create_acestream_source(
    State(state): State<AppState>,
    Json(req): Json<AddAcestreamSourceInput>,
) -> Result<(StatusCode, Json<AcestreamSourceResponse>), (StatusCode, Json<ApiError>)> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let source = services::acestream::add_acestream_source(&mut conn, &req)
        .map_err(bad_request)?;
    Ok((StatusCode::CREATED, Json(source)))
}

async fn delete_acestream_source(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    services::acestream::delete_acestream_source(&mut conn, id)
        .map_err(internal)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn toggle_acestream_source(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(req): Json<ToggleRequest>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    services::acestream::toggle_acestream_source(&mut conn, id, req.is_active)
        .map_err(internal)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn update_acestream_source_handler(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(req): Json<UpdateAcestreamSourceInput>,
) -> ApiResult<AcestreamSourceResponse> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let source = services::acestream::update_acestream_source(&mut conn, id, &req)
        .map_err(internal)?;
    Ok(Json(source))
}

// ===========================================================================
// XMLTV Sources
// ===========================================================================

async fn list_xmltv_sources(State(state): State<AppState>) -> ApiResult<Vec<XmltvSourceResponse>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let sources = services::epg::get_xmltv_sources(&mut conn)
        .map_err(epg_err)?;
    Ok(Json(sources))
}

async fn get_xmltv_source(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> ApiResult<XmltvSourceResponse> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let source: XmltvSource = xmltv_sources::table
        .filter(xmltv_sources::id.eq(id))
        .first(&mut conn)
        .optional()
        .map_err(|e| internal(e.to_string()))?
        .ok_or_else(|| not_found("XMLTV source not found"))?;

    Ok(Json(XmltvSourceResponse::from(source)))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateXmltvSourceRequest {
    pub name: String,
    pub url: String,
    #[serde(default = "default_format")]
    pub format: String,
    #[serde(default = "default_refresh_hours")]
    pub refresh_interval_hours: i32,
}

fn default_format() -> String { "auto".to_string() }
fn default_refresh_hours() -> i32 { 24 }

async fn create_xmltv_source(
    State(state): State<AppState>,
    Json(req): Json<CreateXmltvSourceRequest>,
) -> Result<(StatusCode, Json<XmltvSourceResponse>), (StatusCode, Json<ApiError>)> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let source = services::epg::add_xmltv_source(&mut conn, &req.name, &req.url, &req.format)
        .map_err(epg_err)?;
    Ok((StatusCode::CREATED, Json(source)))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateXmltvSourceRequest {
    pub name: Option<String>,
    pub url: Option<String>,
    pub format: Option<String>,
    pub refresh_interval_hours: Option<i32>,
}

async fn update_xmltv_source(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(req): Json<UpdateXmltvSourceRequest>,
) -> ApiResult<XmltvSourceResponse> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let updates = XmltvSourceUpdate {
        name: req.name,
        url: req.url,
        format: req.format,
        refresh_interval_hours: req.refresh_interval_hours,
        is_active: None,
        updated_at: None, // service sets this
    };

    let source = services::epg::update_xmltv_source(&mut conn, id, updates)
        .map_err(epg_err)?;
    Ok(Json(source))
}

async fn delete_xmltv_source(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    services::epg::delete_xmltv_source(&mut conn, id)
        .map_err(epg_err)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn toggle_xmltv_source(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(req): Json<ToggleRequest>,
) -> ApiResult<XmltvSourceResponse> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let source = services::epg::toggle_xmltv_source(&mut conn, id, req.is_active)
        .map_err(epg_err)?;
    Ok(Json(source))
}

// ===========================================================================
// XMLTV Channels (display/mappings)
// ===========================================================================

async fn get_xmltv_channels_with_mappings(
    State(state): State<AppState>,
) -> ApiResult<Vec<XmltvChannelWithMappings>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let channels = services::xmltv_channels::get_xmltv_channels_with_mappings(&mut conn)
        .map_err(internal)?;
    Ok(Json(channels))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetPrimaryStreamRequest {
    pub xtream_channel_id: i32,
}

async fn set_primary_stream(
    State(state): State<AppState>,
    Path(xmltv_channel_id): Path<i32>,
    Json(req): Json<SetPrimaryStreamRequest>,
) -> ApiResult<Vec<crate::types::XtreamStreamMatch>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let result = services::xmltv_channels::set_primary_stream(
        &mut conn,
        xmltv_channel_id,
        req.xtream_channel_id,
    )
    .map_err(internal)?;
    Ok(Json(result))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToggleChannelRequest {
    pub enabled: Option<bool>,
}

async fn toggle_xmltv_channel(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    body: Option<Json<ToggleChannelRequest>>,
) -> ApiResult<serde_json::Value> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let new_enabled = match body.and_then(|b| b.enabled) {
        Some(explicit) => explicit,
        None => {
            // Toggle: read current state and flip
            let current = services::xmltv_channels::get_xmltv_channel_enabled(&mut conn, id)
                .map_err(internal)?;
            !current
        }
    };

    let enabled = services::xmltv_channels::toggle_xmltv_channel(&mut conn, id, new_enabled)
        .map_err(internal)?;
    state.invalidate_epg_cache();
    Ok(Json(serde_json::json!({ "enabled": enabled })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateChannelOrderRequest {
    pub plex_display_order: Option<i32>,
}

async fn update_channel_order(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(req): Json<UpdateChannelOrderRequest>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    services::xmltv_channels::update_channel_order(&mut conn, id, req.plex_display_order)
        .map_err(internal)?;
    state.invalidate_epg_cache();
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkUpdateChannelOrderRequest {
    pub channel_ids: Vec<i32>,
}

async fn bulk_update_channel_order(
    State(state): State<AppState>,
    Json(req): Json<BulkUpdateChannelOrderRequest>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    for (index, channel_id) in req.channel_ids.iter().enumerate() {
        services::xmltv_channels::update_channel_order(
            &mut conn,
            *channel_id,
            Some(index as i32),
        )
        .map_err(internal)?;
    }
    state.invalidate_epg_cache();
    Ok(StatusCode::NO_CONTENT)
}

async fn get_all_xtream_streams(
    State(state): State<AppState>,
) -> ApiResult<Vec<XtreamStreamSearchResult>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let streams = services::xmltv_channels::get_all_xtream_streams(&mut conn)
        .map_err(internal)?;
    Ok(Json(streams))
}

#[derive(Deserialize)]
pub struct SearchQuery {
    pub query: String,
}

async fn search_xtream_streams(
    State(state): State<AppState>,
    Query(q): Query<SearchQuery>,
) -> ApiResult<Vec<XtreamStreamSearchResult>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let streams = services::xmltv_channels::search_xtream_streams(&mut conn, &q.query)
        .map_err(internal)?;
    Ok(Json(streams))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddManualStreamRequest {
    pub xtream_channel_id: i32,
    #[serde(default)]
    pub set_as_primary: bool,
}

async fn add_manual_stream_mapping(
    State(state): State<AppState>,
    Path(xmltv_channel_id): Path<i32>,
    Json(req): Json<AddManualStreamRequest>,
) -> ApiResult<Vec<crate::types::XtreamStreamMatch>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let result = services::xmltv_channels::add_manual_stream_mapping(
        &mut conn,
        xmltv_channel_id,
        req.xtream_channel_id,
        req.set_as_primary,
    )
    .map_err(internal)?;
    Ok(Json(result))
}

async fn remove_stream_mapping(
    State(state): State<AppState>,
    Path(mapping_id): Path<i32>,
) -> ApiResult<Vec<crate::types::XtreamStreamMatch>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let result = services::xmltv_channels::remove_stream_mapping(&mut conn, mapping_id)
        .map_err(internal)?;
    Ok(Json(result))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddM3uMappingRequest {
    pub m3u_channel_id: i32,
    #[serde(default)]
    pub set_as_primary: bool,
}

async fn add_m3u_channel_mapping(
    State(state): State<AppState>,
    Path(xmltv_channel_id): Path<i32>,
    Json(req): Json<AddM3uMappingRequest>,
) -> ApiResult<AllChannelMappings> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let result = services::xmltv_channels::add_m3u_channel_mapping(
        &mut conn,
        xmltv_channel_id,
        req.m3u_channel_id,
        req.set_as_primary,
    )
    .map_err(internal)?;
    Ok(Json(result))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddAcestreamMappingRequest {
    pub acestream_source_id: i32,
    #[serde(default)]
    pub set_as_primary: bool,
}

async fn add_acestream_channel_mapping(
    State(state): State<AppState>,
    Path(xmltv_channel_id): Path<i32>,
    Json(req): Json<AddAcestreamMappingRequest>,
) -> ApiResult<AllChannelMappings> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let result = services::xmltv_channels::add_acestream_channel_mapping(
        &mut conn,
        xmltv_channel_id,
        req.acestream_source_id,
        req.set_as_primary,
    )
    .map_err(internal)?;
    Ok(Json(result))
}

async fn get_all_channel_mappings(
    State(state): State<AppState>,
    Path(xmltv_channel_id): Path<i32>,
) -> ApiResult<AllChannelMappings> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let result = services::xmltv_channels::get_all_channel_mappings(&mut conn, xmltv_channel_id)
        .map_err(internal)?;
    Ok(Json(result))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkToggleRequest {
    pub channel_ids: Vec<i32>,
    pub enabled: bool,
}

async fn bulk_toggle_channels(
    State(state): State<AppState>,
    Json(req): Json<BulkToggleRequest>,
) -> ApiResult<serde_json::Value> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let affected = services::xmltv_channels::bulk_toggle_channels(
        &mut conn,
        &req.channel_ids,
        req.enabled,
    )
    .map_err(internal)?;
    state.invalidate_epg_cache();
    Ok(Json(serde_json::json!({ "affected": affected })))
}

async fn get_orphan_xtream_streams(
    State(state): State<AppState>,
) -> ApiResult<Vec<XtreamStreamSearchResult>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let streams = services::xmltv_channels::get_orphan_xtream_streams(&mut conn)
        .map_err(internal)?;
    Ok(Json(streams))
}

async fn get_orphan_m3u_channels(
    State(state): State<AppState>,
) -> ApiResult<Vec<services::xmltv_channels::OrphanM3uChannel>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let channels = services::xmltv_channels::get_orphan_m3u_channels(&mut conn)
        .map_err(internal)?;
    Ok(Json(channels))
}

async fn get_orphan_acestream_sources(
    State(state): State<AppState>,
) -> ApiResult<Vec<services::xmltv_channels::OrphanAcestreamSource>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let sources = services::xmltv_channels::get_orphan_acestream_sources(&mut conn)
        .map_err(internal)?;
    Ok(Json(sources))
}

// ---------------------------------------------------------------------------
// Promote orphans to synthetic channels
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromoteOrphanRequest {
    pub display_name: String,
    pub icon_url: Option<String>,
}

async fn promote_orphan_to_plex(
    State(state): State<AppState>,
    Path(xtream_channel_id): Path<i32>,
    Json(req): Json<PromoteOrphanRequest>,
) -> ApiResult<XmltvChannelWithMappings> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let result = services::xmltv_channels::promote_orphan_to_plex(
        &mut conn,
        xtream_channel_id,
        &req.display_name,
        req.icon_url.as_deref(),
    )
    .map_err(internal)?;
    state.invalidate_epg_cache();
    Ok(Json(result))
}

async fn promote_m3u_orphan_to_plex(
    State(state): State<AppState>,
    Path(m3u_channel_id): Path<i32>,
    Json(req): Json<PromoteOrphanRequest>,
) -> ApiResult<XmltvChannelWithMappings> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let result = services::xmltv_channels::promote_m3u_orphan_to_plex(
        &mut conn,
        m3u_channel_id,
        &req.display_name,
        req.icon_url.as_deref(),
    )
    .map_err(internal)?;
    state.invalidate_epg_cache();
    Ok(Json(result))
}

async fn promote_acestream_orphan_to_plex(
    State(state): State<AppState>,
    Path(acestream_source_id): Path<i32>,
    Json(req): Json<PromoteOrphanRequest>,
) -> ApiResult<XmltvChannelWithMappings> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let result = services::xmltv_channels::promote_acestream_orphan_to_plex(
        &mut conn,
        acestream_source_id,
        &req.display_name,
        req.icon_url.as_deref(),
    )
    .map_err(internal)?;
    state.invalidate_epg_cache();
    Ok(Json(result))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSyntheticChannelRequest {
    pub display_name: String,
    pub icon_url: Option<String>,
}

async fn update_synthetic_channel(
    State(state): State<AppState>,
    Path(channel_id): Path<i32>,
    Json(req): Json<UpdateSyntheticChannelRequest>,
) -> ApiResult<XmltvChannelWithMappings> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let result = services::xmltv_channels::update_synthetic_channel(
        &mut conn,
        channel_id,
        &req.display_name,
        req.icon_url.as_deref(),
    )
    .map_err(internal)?;
    state.invalidate_epg_cache();
    Ok(Json(result))
}

async fn get_target_lineup_channels(
    State(state): State<AppState>,
) -> ApiResult<Vec<TargetLineupChannel>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let channels = services::xmltv_channels::get_target_lineup_channels(&mut conn)
        .map_err(internal)?;
    Ok(Json(channels))
}

async fn get_xmltv_channels_for_source(
    State(state): State<AppState>,
    Path(source_id): Path<i32>,
) -> ApiResult<Vec<XmltvSourceChannel>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let channels = services::xmltv_channels::get_xmltv_channels_for_source(&mut conn, source_id)
        .map_err(internal)?;
    Ok(Json(channels))
}

// ===========================================================================
// Xtream Sources
// ===========================================================================

async fn get_xtream_streams_for_account(
    State(state): State<AppState>,
    Path(account_id): Path<i32>,
) -> ApiResult<Vec<crate::types::XtreamAccountStream>> {
    use crate::db::models::{ChannelMapping, XmltvChannel, XtreamChannel};
    use crate::db::schema::{channel_mappings, xmltv_channels, xtream_channels};

    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    if account_id <= 0 {
        return Err(bad_request("Invalid account ID"));
    }

    // Load all streams for this account
    let streams: Vec<XtreamChannel> = xtream_channels::table
        .filter(xtream_channels::account_id.eq(account_id))
        .order_by(xtream_channels::name.asc())
        .load::<XtreamChannel>(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let stream_ids: Vec<i32> = streams.iter().filter_map(|s| s.id).collect();

    let mappings: Vec<ChannelMapping> = channel_mappings::table
        .filter(channel_mappings::xtream_channel_id.eq_any(&stream_ids))
        .load::<ChannelMapping>(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let xmltv_channel_ids: Vec<i32> = mappings.iter().map(|m| m.xmltv_channel_id).collect();

    let xmltv_channels_list: Vec<XmltvChannel> = if !xmltv_channel_ids.is_empty() {
        xmltv_channels::table
            .filter(xmltv_channels::id.eq_any(&xmltv_channel_ids))
            .load::<XmltvChannel>(&mut conn)
            .map_err(|e| internal(e.to_string()))?
    } else {
        vec![]
    };

    let synthetic_map: std::collections::HashMap<i32, bool> = xmltv_channels_list
        .into_iter()
        .filter_map(|ch| ch.id.map(|id| (id, ch.is_synthetic.unwrap_or(0) != 0)))
        .collect();

    let mut mappings_map: std::collections::HashMap<i32, Vec<(i32, bool)>> =
        std::collections::HashMap::new();

    for mapping in mappings {
        if let Some(xtream_id) = mapping.xtream_channel_id {
            let xmltv_id = mapping.xmltv_channel_id;
            let is_synthetic = synthetic_map.get(&xmltv_id).copied().unwrap_or(false);
            mappings_map
                .entry(xtream_id)
                .or_default()
                .push((xmltv_id, is_synthetic));
        }
    }

    use crate::types::{LinkStatus, XtreamAccountStream};

    fn parse_qualities_local(qualities: &Option<String>) -> Vec<String> {
        match qualities {
            Some(q) if !q.is_empty() => {
                if let Ok(parsed) = serde_json::from_str::<Vec<String>>(q) {
                    return parsed;
                }
                q.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            }
            _ => Vec::new(),
        }
    }

    let result: Vec<XtreamAccountStream> = streams
        .into_iter()
        .filter_map(|stream| {
            let stream_id = stream.id?;
            let linked_channels = mappings_map.get(&stream_id);

            let (link_status, linked_xmltv_ids, synthetic_channel_id) = match linked_channels {
                None => (LinkStatus::Orphan, vec![], None),
                Some(channels) => {
                    let xmltv_ids: Vec<i32> = channels.iter().map(|(id, _)| *id).collect();
                    let has_synthetic = channels.iter().any(|(_, is_syn)| *is_syn);
                    if has_synthetic {
                        let syn_id = channels.iter().find(|(_, is_syn)| *is_syn).map(|(id, _)| *id);
                        (LinkStatus::Promoted, xmltv_ids, syn_id)
                    } else {
                        (LinkStatus::Linked, xmltv_ids, None)
                    }
                }
            };

            Some(XtreamAccountStream {
                id: stream_id,
                stream_id: stream.stream_id,
                name: stream.name,
                stream_icon: stream.stream_icon,
                qualities: parse_qualities_local(&stream.qualities),
                category_name: stream.category_name,
                link_status,
                linked_xmltv_ids,
                synthetic_channel_id,
            })
        })
        .collect();

    Ok(Json(result))
}

async fn get_account_stream_stats(
    State(state): State<AppState>,
    Path(account_id): Path<i32>,
) -> ApiResult<crate::types::AccountStreamStats> {
    use crate::db::models::ChannelMapping;
    use crate::db::schema::{channel_mappings, xmltv_channels, xtream_channels};
    use crate::types::AccountStreamStats;

    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    if account_id <= 0 {
        return Err(bad_request("Invalid account ID"));
    }

    let stream_count: i64 = xtream_channels::table
        .filter(xtream_channels::account_id.eq(account_id))
        .count()
        .get_result(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let stream_ids: Vec<i32> = xtream_channels::table
        .filter(xtream_channels::account_id.eq(account_id))
        .select(xtream_channels::id)
        .load::<Option<i32>>(&mut conn)
        .map_err(|e| internal(e.to_string()))?
        .into_iter()
        .flatten()
        .collect();

    if stream_ids.is_empty() {
        return Ok(Json(AccountStreamStats {
            stream_count: 0,
            linked_count: 0,
            orphan_count: 0,
            promoted_count: 0,
        }));
    }

    let mappings: Vec<ChannelMapping> = channel_mappings::table
        .filter(channel_mappings::xtream_channel_id.eq_any(&stream_ids))
        .load::<ChannelMapping>(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let mapped_stream_ids: std::collections::HashSet<i32> = mappings
        .iter()
        .filter_map(|m| m.xtream_channel_id)
        .collect();

    let xmltv_channel_ids: Vec<i32> = mappings.iter().map(|m| m.xmltv_channel_id).collect();

    let synthetic_channel_ids: std::collections::HashSet<i32> = if !xmltv_channel_ids.is_empty() {
        xmltv_channels::table
            .filter(xmltv_channels::id.eq_any(&xmltv_channel_ids))
            .filter(xmltv_channels::is_synthetic.eq(1))
            .select(xmltv_channels::id)
            .load::<Option<i32>>(&mut conn)
            .map_err(|e| internal(e.to_string()))?
            .into_iter()
            .flatten()
            .collect()
    } else {
        std::collections::HashSet::new()
    };

    let promoted_stream_ids: std::collections::HashSet<i32> = mappings
        .iter()
        .filter(|m| synthetic_channel_ids.contains(&m.xmltv_channel_id))
        .filter_map(|m| m.xtream_channel_id)
        .collect();

    let promoted_count = promoted_stream_ids.len() as i32;
    let linked_count = (mapped_stream_ids.len() - promoted_stream_ids.len()) as i32;
    let orphan_count = stream_count as i32 - mapped_stream_ids.len() as i32;

    Ok(Json(AccountStreamStats {
        stream_count: stream_count as i32,
        linked_count,
        orphan_count,
        promoted_count,
    }))
}

async fn unlink_xtream_stream(
    State(state): State<AppState>,
    Path(xtream_channel_id): Path<i32>,
) -> ApiResult<serde_json::Value> {
    use crate::db::schema::channel_mappings;

    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    if xtream_channel_id <= 0 {
        return Err(bad_request("Invalid Xtream channel ID"));
    }

    let deleted = diesel::delete(
        channel_mappings::table.filter(channel_mappings::xtream_channel_id.eq(xtream_channel_id)),
    )
    .execute(&mut conn)
    .map_err(|e| internal(e.to_string()))?;

    Ok(Json(serde_json::json!({ "deleted": deleted })))
}

async fn get_xtream_stream_url(
    State(state): State<AppState>,
    Path(xtream_channel_id): Path<i32>,
) -> ApiResult<serde_json::Value> {
    use crate::credentials::CredentialManager;
    use crate::db::models::{Account, XtreamChannel};
    use crate::db::schema::{accounts as accounts_table, xtream_channels};
    use crate::server::stream::build_stream_url;

    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    if xtream_channel_id <= 0 {
        return Err(bad_request("Invalid Xtream channel ID"));
    }

    let xtream_channel: XtreamChannel = xtream_channels::table
        .filter(xtream_channels::id.eq(xtream_channel_id))
        .first::<XtreamChannel>(&mut conn)
        .map_err(|e| not_found(format!("Xtream channel not found: {}", e)))?;

    let account: Account = accounts_table::table
        .filter(accounts_table::id.eq(xtream_channel.account_id))
        .first::<Account>(&mut conn)
        .map_err(|e| not_found(format!("Account not found: {}", e)))?;

    let credential_manager = CredentialManager::new(state.app_data_dir().clone());
    let account_id_str = account.id.map(|id| id.to_string()).unwrap_or_default();
    let password = credential_manager
        .retrieve_password(&account_id_str, &account.password_encrypted)
        .map_err(|e| internal(format!("Failed to decrypt credentials: {}", e)))?;

    let stream_url = build_stream_url(
        &account.server_url,
        &account.username,
        &password,
        xtream_channel.stream_id,
    );

    Ok(Json(serde_json::json!({ "url": stream_url })))
}

// ===========================================================================
// EPG
// ===========================================================================

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EpgRefreshResult {
    pub success: bool,
    pub sources_refreshed: usize,
    pub sources_failed: usize,
    pub errors: Vec<String>,
}

async fn refresh_all_epg(
    State(state): State<AppState>,
) -> ApiResult<EpgRefreshResult> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let sources: Vec<XmltvSource> = xmltv_sources::table
        .filter(xmltv_sources::is_active.eq(1))
        .load(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let mut success_count = 0usize;
    let mut errors = Vec::new();

    for source in &sources {
        let source_id = source.id.unwrap_or(0);
        match services::epg::refresh_epg_source(&mut conn, source_id).await {
            Ok(()) => {
                success_count += 1;
                state.invalidate_epg_cache();
            }
            Err(msg) => {
                errors.push(format!("{}: {}", source.name, msg));
            }
        }
    }

    Ok(Json(EpgRefreshResult {
        success: errors.is_empty(),
        sources_refreshed: success_count,
        sources_failed: errors.len(),
        errors,
    }))
}

async fn refresh_epg_source(
    State(state): State<AppState>,
    Path(source_id): Path<i32>,
) -> ApiResult<EpgRefreshResult> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    match services::epg::refresh_epg_source(&mut conn, source_id).await {
        Ok(()) => {
            state.invalidate_epg_cache();
            Ok(Json(EpgRefreshResult {
                success: true,
                sources_refreshed: 1,
                sources_failed: 0,
                errors: vec![],
            }))
        }
        Err(msg) => Ok(Json(EpgRefreshResult {
            success: false,
            sources_refreshed: 0,
            sources_failed: 1,
            errors: vec![msg],
        })),
    }
}

async fn get_epg_stats(
    State(state): State<AppState>,
) -> ApiResult<crate::types::EpgStatsResponse> {
    use crate::types::EpgStatsResponse;
    use crate::db::schema::{programs, xmltv_channels};

    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let channel_count: i64 = xmltv_channels::table
        .count()
        .get_result(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let program_count: i64 = programs::table
        .count()
        .get_result(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let last_refresh: Option<String> = xmltv_sources::table
        .select(xmltv_sources::last_refresh)
        .order(xmltv_sources::last_refresh.desc())
        .first::<Option<String>>(&mut conn)
        .optional()
        .map_err(|e| internal(e.to_string()))?
        .flatten();

    Ok(Json(EpgStatsResponse {
        channel_count,
        program_count,
        last_refresh,
    }))
}

async fn get_xmltv_channels_for_epg(
    State(state): State<AppState>,
    Path(source_id): Path<i32>,
) -> ApiResult<Vec<XmltvChannelResponse>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let channels = services::epg::get_xmltv_channels(&mut conn, source_id)
        .map_err(epg_err)?;
    Ok(Json(channels))
}

async fn get_programs(
    State(state): State<AppState>,
    Path(source_id): Path<i32>,
) -> ApiResult<Vec<ProgramResponse>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let programs = services::epg::get_programs(&mut conn, source_id)
        .map_err(epg_err)?;
    Ok(Json(programs))
}

async fn get_epg_schedule(
    State(state): State<AppState>,
) -> ApiResult<EpgScheduleResponse> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let schedule = services::epg::get_epg_schedule(&mut conn);
    Ok(Json(schedule))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetEpgScheduleRequest {
    pub hour: u8,
    pub minute: u8,
    pub enabled: bool,
}

async fn set_epg_schedule(
    State(state): State<AppState>,
    Json(req): Json<SetEpgScheduleRequest>,
) -> ApiResult<EpgScheduleResponse> {
    if req.hour > 23 {
        return Err(bad_request("Hour must be between 0 and 23"));
    }
    if req.minute > 59 {
        return Err(bad_request("Minute must be between 0 and 59"));
    }

    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let config = crate::scheduler::EpgScheduleConfig {
        hour: req.hour,
        minute: req.minute,
        enabled: req.enabled,
    };

    crate::scheduler::set_epg_schedule(&mut conn, &config)
        .map_err(|e| internal(e.to_string()))?;

    // Re-read to return consistent state
    let schedule = services::epg::get_epg_schedule(&mut conn);
    Ok(Json(schedule))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EpgGridQuery {
    pub start_time: String,
    pub end_time: String,
}

async fn get_enabled_channels_with_programs(
    State(state): State<AppState>,
    Query(q): Query<EpgGridQuery>,
) -> ApiResult<Vec<EpgGridChannel>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let channels = services::epg::get_enabled_channels_with_programs(
        &mut conn,
        &q.start_time,
        &q.end_time,
    )
    .map_err(internal)?;
    Ok(Json(channels))
}

async fn search_epg_programs(
    State(state): State<AppState>,
    Query(q): Query<SearchQuery>,
) -> ApiResult<Vec<EpgSearchResult>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let results = services::epg::search_epg_programs(&mut conn, &q.query)
        .map_err(internal)?;
    Ok(Json(results))
}

async fn get_channel_stream_info(
    State(state): State<AppState>,
    Path(channel_id): Path<i32>,
) -> ApiResult<Option<ChannelStreamInfo>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let info = services::epg::get_channel_stream_info(&mut conn, channel_id)
        .map_err(epg_err)?;
    Ok(Json(info))
}

async fn get_program_by_id(
    State(state): State<AppState>,
    Path(program_id): Path<i32>,
) -> ApiResult<Option<ProgramWithChannel>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let program = services::epg::get_program_by_id(&mut conn, program_id)
        .map_err(epg_err)?;
    Ok(Json(program))
}

// ===========================================================================
// Settings
// ===========================================================================

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsMap {
    pub settings: std::collections::HashMap<String, String>,
}

async fn get_all_settings(State(state): State<AppState>) -> ApiResult<SettingsMap> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let rows: Vec<Setting> = settings::table
        .load(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let map = rows
        .into_iter()
        .map(|s| (s.key, s.value))
        .collect();

    Ok(Json(SettingsMap { settings: map }))
}

async fn get_setting(
    State(state): State<AppState>,
    Path(key): Path<String>,
) -> ApiResult<serde_json::Value> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let value = services::settings::get_setting(&mut conn, &key)
        .map_err(|e| internal(e.to_string()))?;
    Ok(Json(serde_json::json!({ "key": key, "value": value })))
}

#[derive(Deserialize)]
pub struct SetSettingRequest {
    pub value: String,
}

async fn set_setting(
    State(state): State<AppState>,
    Path(key): Path<String>,
    Json(req): Json<SetSettingRequest>,
) -> ApiResult<serde_json::Value> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    services::settings::set_setting(&mut conn, &key, &req.value)
        .map_err(|e| internal(e.to_string()))?;
    Ok(Json(serde_json::json!({ "key": key, "value": req.value })))
}

async fn get_plex_config(
    State(state): State<AppState>,
) -> ApiResult<serde_json::Value> {
    use crate::server::hdhr::{get_local_ip, get_tuner_count};

    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let port = services::settings::get_server_port(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let local_ip = get_local_ip();
    let tuner_count = get_tuner_count(&mut conn)
        .map_err(|e| internal(format!("Failed to get tuner count: {}", e)))? as i32;

    let base_url = format!("http://{}:{}", local_ip, port);

    Ok(Json(serde_json::json!({
        "serverRunning": true,
        "localIp": local_ip,
        "port": port,
        "m3uUrl": format!("{}/playlist.m3u", base_url),
        "epgUrl": format!("{}/epg.xml", base_url),
        "hdhrUrl": base_url,
        "tunerCount": tuner_count,
    })))
}

async fn get_resilience_config(
    State(state): State<AppState>,
) -> ApiResult<crate::server::failover::ResilienceConfig> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let config = services::settings::get_resilience_config(&mut conn);
    Ok(Json(config))
}

#[derive(Deserialize)]
pub struct SetFailoverRequest {
    pub strictness: String,
}

async fn set_failover_strictness(
    State(state): State<AppState>,
    Json(req): Json<SetFailoverRequest>,
) -> ApiResult<crate::server::failover::ResilienceConfig> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let config = services::settings::set_failover_strictness(&mut conn, &req.strictness)
        .map_err(internal)?;
    Ok(Json(config))
}

async fn restart_server() -> ApiResult<serde_json::Value> {
    // Placeholder — actual restart requires app restart
    Ok(Json(serde_json::json!({
        "message": "Server port change saved. Port will take effect on next application restart."
    })))
}

// ===========================================================================
// Channels
// ===========================================================================

async fn list_channels(
    State(state): State<AppState>,
    Path(account_id): Path<i32>,
) -> ApiResult<Vec<ChannelResponse>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let channels = services::channels::get_channels(&mut conn, account_id)
        .map_err(internal)?;
    Ok(Json(channels))
}

async fn get_channel_count(
    State(state): State<AppState>,
    Path(account_id): Path<i32>,
) -> ApiResult<serde_json::Value> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let count = services::channels::get_channel_count(&mut conn, account_id)
        .map_err(internal)?;
    Ok(Json(serde_json::json!({ "count": count })))
}

async fn scan_channels(
    State(state): State<AppState>,
    Path(account_id): Path<i32>,
) -> ApiResult<crate::types::ScanChannelsResponse> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let response = services::channels::scan_channels(&mut conn, state.app_data_dir(), account_id)
        .await
        .map_err(internal)?;
    Ok(Json(response))
}

async fn scan_and_rematch(
    State(state): State<AppState>,
    Path(account_id): Path<i32>,
) -> ApiResult<crate::types::ScanAndRematchResponse> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let response = services::channels::scan_and_rematch(&mut conn, state.app_data_dir(), account_id)
        .await
        .map_err(internal)?;
    Ok(Json(response))
}

// ===========================================================================
// Events / Logs
// ===========================================================================

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventsQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub level: Option<String>,
    pub category: Option<String>,
    pub unread_only: Option<bool>,
    pub created_after: Option<String>,
    pub created_before: Option<String>,
}

async fn list_events(
    State(state): State<AppState>,
    Query(q): Query<EventsQuery>,
) -> ApiResult<EventLogResponse> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let response = services::logs::get_events(
        &mut conn,
        q.limit,
        q.offset,
        q.level.as_deref(),
        q.category.as_deref(),
        q.unread_only,
        q.created_after.as_deref(),
        q.created_before.as_deref(),
    ).map_err(internal)?;
    Ok(Json(response))
}

async fn get_unread_count(State(state): State<AppState>) -> ApiResult<serde_json::Value> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let count = services::logs::get_unread_event_count(&mut conn)
        .map_err(internal)?;
    Ok(Json(serde_json::json!({ "count": count })))
}

async fn mark_event_read(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    services::logs::mark_event_read(&mut conn, id)
        .map_err(internal)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn mark_all_events_read(
    State(state): State<AppState>,
) -> ApiResult<serde_json::Value> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let count = services::logs::mark_all_events_read(&mut conn)
        .map_err(internal)?;
    Ok(Json(serde_json::json!({ "markedRead": count })))
}

async fn log_event(
    State(state): State<AppState>,
    Json(req): Json<LogEventInput>,
) -> ApiResult<serde_json::Value> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let event = services::logs::log_event(
        &mut conn,
        &req.level,
        &req.category,
        &req.message,
        req.details.as_deref(),
    )
    .map_err(bad_request)?;
    match event {
        Some(e) => Ok(Json(serde_json::json!({
            "logged": true,
            "id": e.id
        }))),
        None => Ok(Json(serde_json::json!({
            "logged": false,
            "reason": "filtered by verbosity"
        }))),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearOldEventsRequest {
    pub keep_count: Option<i64>,
}

async fn clear_old_events(
    State(state): State<AppState>,
    Json(req): Json<ClearOldEventsRequest>,
) -> ApiResult<serde_json::Value> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let deleted = services::logs::clear_old_events(&mut conn, req.keep_count)
        .map_err(internal)?;
    Ok(Json(serde_json::json!({ "deleted": deleted })))
}

// ===========================================================================
// Matcher
// ===========================================================================

async fn get_matcher_stats(State(state): State<AppState>) -> ApiResult<MatchStats> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let stats = services::matcher::get_match_stats(&mut conn)
        .map_err(internal)?;
    Ok(Json(stats))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunMatchingRequest {
    pub threshold: Option<f64>,
}

async fn run_matching(
    State(state): State<AppState>,
    Json(req): Json<RunMatchingRequest>,
) -> ApiResult<MatchResponse> {
    use crate::services::matcher as svc;

    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let result = svc::run_channel_matching(&mut conn, req.threshold, |_| {})
        .map_err(internal)?;

    Ok(Json(MatchResponse {
        success: true,
        matched_count: result.matched_count,
        unmatched_count: result.unmatched_count,
        total_xmltv: result.total_xmltv,
        total_source_channels: result.total_source_channels,
        duration_ms: result.duration_ms,
        message: format!(
            "Matched {} of {} XMLTV channels. {} mappings saved.",
            result.matched_count, result.total_xmltv, result.mappings_saved
        ),
    }))
}

async fn get_channel_mappings_for_xmltv(
    State(state): State<AppState>,
    Path(xmltv_channel_id): Path<i32>,
) -> ApiResult<Vec<crate::db::models::ChannelMapping>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let mappings = services::matcher::get_channel_mappings_for_xmltv(&mut conn, xmltv_channel_id)
        .map_err(internal)?;
    Ok(Json(mappings))
}

async fn get_xmltv_channel_settings(
    State(state): State<AppState>,
    Path(xmltv_channel_id): Path<i32>,
) -> ApiResult<Option<crate::db::models::XmltvChannelSettings>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let settings = services::matcher::get_xmltv_channel_settings(&mut conn, xmltv_channel_id)
        .map_err(internal)?;
    Ok(Json(settings))
}

async fn get_match_threshold(
    State(state): State<AppState>,
) -> ApiResult<serde_json::Value> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let threshold = services::matcher::get_match_threshold(&mut conn)
        .map_err(internal)?;
    Ok(Json(serde_json::json!({ "threshold": threshold })))
}

#[derive(Deserialize)]
pub struct SetThresholdRequest {
    pub threshold: f64,
}

async fn set_match_threshold(
    State(state): State<AppState>,
    Json(req): Json<SetThresholdRequest>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    services::matcher::set_match_threshold(&mut conn, req.threshold)
        .map_err(internal)?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct NormalizeQuery {
    pub name: String,
}

async fn normalize_channel_name(
    Query(q): Query<NormalizeQuery>,
) -> ApiResult<serde_json::Value> {
    let normalized = services::matcher::normalize_channel_name(&q.name);
    Ok(Json(serde_json::json!({ "normalized": normalized })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchScoreQuery {
    pub xmltv_name: String,
    pub xtream_name: String,
    #[serde(default)]
    pub epg_id_match: bool,
    #[serde(default)]
    pub exact_name_match: bool,
}

async fn calculate_match_score(
    Query(q): Query<MatchScoreQuery>,
) -> ApiResult<serde_json::Value> {
    let score = services::matcher::calculate_match_score(
        &q.xmltv_name,
        &q.xtream_name,
        q.epg_id_match,
        q.exact_name_match,
    );
    Ok(Json(serde_json::json!({ "score": score })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoMatchM3uRequest {
    pub source_id: Option<i32>,
    pub threshold: Option<f64>,
}

async fn auto_match_m3u_channels(
    State(state): State<AppState>,
    Json(req): Json<AutoMatchM3uRequest>,
) -> ApiResult<M3uAutoMatchResponse> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let result = services::matcher::auto_match_m3u_channels(
        &mut conn,
        req.source_id,
        req.threshold,
        |_| {},
    )
    .map_err(internal)?;

    Ok(Json(M3uAutoMatchResponse {
        success: true,
        matched_count: result.matched_count,
        unmatched_count: result.unmatched_count,
        total_m3u_channels: result.total_m3u_channels,
        total_xmltv_channels: result.total_xmltv_channels,
        duration_ms: result.duration_ms,
        mappings_created: result.mappings_created,
        message: format!(
            "Matched {} M3U channels to {} XMLTV channels. {} mappings created.",
            result.matched_count, result.total_xmltv_channels, result.mappings_created
        ),
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct M3uMatchResultsQuery {
    pub source_id: Option<i32>,
}

async fn get_m3u_auto_match_results(
    State(state): State<AppState>,
    Query(q): Query<M3uMatchResultsQuery>,
) -> ApiResult<Vec<M3uMatchResult>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let results = services::matcher::get_m3u_auto_match_results(&mut conn, q.source_id)
        .map_err(internal)?;
    Ok(Json(results))
}

// ===========================================================================
// Config (export/import)
// ===========================================================================

async fn export_configuration(
    State(state): State<AppState>,
) -> ApiResult<serde_json::Value> {
    use crate::db::schema::{channel_mappings, xmltv_channel_settings};
    use crate::db::{ChannelMapping, XmltvChannelSettings};
    use crate::types::{
        ConfigExport, ExportData, ExportedAccount, ExportedChannelMapping,
        ExportedSettings, ExportedXmltvChannelSettings, ExportedXmltvSource,
    };

    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    // Query all settings
    let settings_rows: Vec<Setting> = settings::table
        .load(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

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
            "epg_schedule_enabled" => exported_settings.epg_schedule_enabled = Some(setting.value),
            "match_threshold" => exported_settings.match_threshold = Some(setting.value),
            "failover_strictness" => exported_settings.failover_strictness = Some(setting.value),
            _ => {}
        }
    }

    // Query accounts (exclude password)
    let account_rows: Vec<Account> = accounts::table
        .load(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

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

    // Query XMLTV sources
    let source_rows: Vec<XmltvSource> = xmltv_sources::table
        .load(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

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

    // Query channel mappings
    let mapping_rows: Vec<ChannelMapping> = channel_mappings::table
        .load(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

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

    // Query XMLTV channel settings
    let channel_settings_rows: Vec<XmltvChannelSettings> = xmltv_channel_settings::table
        .load(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let exported_channel_settings: Vec<ExportedXmltvChannelSettings> = channel_settings_rows
        .into_iter()
        .map(|s| ExportedXmltvChannelSettings {
            xmltv_channel_id: s.xmltv_channel_id,
            is_enabled: s.is_enabled.map(|v| v != 0).unwrap_or(false),
            plex_display_order: s.plex_display_order,
        })
        .collect();

    let export = ConfigExport {
        version: "1.0".to_string(),
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

    let json_value = serde_json::to_value(&export)
        .map_err(|e| internal(e.to_string()))?;

    Ok(Json(json_value))
}

#[derive(Deserialize)]
pub struct ImportRequest {
    pub content: String,
}

async fn import_configuration(
    State(state): State<AppState>,
    Json(req): Json<ImportRequest>,
) -> ApiResult<crate::types::ImportResult> {
    use crate::types::{ConfigExport, ImportResult};
    use crate::db::schema::{channel_mappings, xmltv_channel_settings};
    use crate::db::NewAccount;

    let config: ConfigExport = serde_json::from_str(&req.content)
        .map_err(|e| bad_request(format!("Invalid JSON: {}", e)))?;

    // Version check (1.0+)
    let parts: Vec<&str> = config.version.split('.').collect();
    if parts.len() < 2 {
        return Err(bad_request("Invalid version format"));
    }
    let major: u32 = parts[0].parse().unwrap_or(0);
    if major < 1 {
        return Err(bad_request(format!(
            "Unsupported version: {}. Minimum: 1.0",
            config.version
        )));
    }

    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    conn.transaction::<_, diesel::result::Error, _>(|conn| {
        diesel::delete(channel_mappings::table).execute(conn)?;
        diesel::delete(xmltv_channel_settings::table).execute(conn)?;
        diesel::delete(xmltv_sources::table).execute(conn)?;
        diesel::delete(accounts::table).execute(conn)?;
        diesel::delete(settings::table).execute(conn)?;

        // Insert settings
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

        // Insert accounts (without passwords)
        for account in &config.data.accounts {
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

        // Insert XMLTV sources
        for source in &config.data.xmltv_sources {
            let new_source = crate::db::NewXmltvSource {
                name: source.name.clone(),
                url: source.url.clone(),
                format: source.format.clone(),
                refresh_interval_hours: source.refresh_interval_hours,
                is_active: if source.is_active { 1 } else { 0 },
                created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                updated_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            };
            diesel::insert_into(xmltv_sources::table)
                .values(&new_source)
                .execute(conn)?;
        }

        Ok(())
    })
    .map_err(|e| internal(e.to_string()))?;

    // Count imported items
    let settings_count = [
        &config.data.settings.server_port,
        &config.data.settings.autostart_enabled,
        &config.data.settings.epg_schedule_hour,
        &config.data.settings.epg_schedule_minute,
        &config.data.settings.epg_schedule_enabled,
        &config.data.settings.match_threshold,
        &config.data.settings.failover_strictness,
    ]
    .iter()
    .filter(|s| s.is_some())
    .count();

    Ok(Json(ImportResult {
        success: true,
        accounts_imported: config.data.accounts.len(),
        xmltv_sources_imported: config.data.xmltv_sources.len(),
        channel_mappings_imported: 0,
        settings_imported: settings_count,
        message: format!(
            "Configuration imported successfully. {} accounts need passwords re-entered.",
            config.data.accounts.len()
        ),
    }))
}

async fn validate_import_file(
    Json(req): Json<ImportRequest>,
) -> ApiResult<crate::types::ImportPreview> {
    // Delegate to the shared pure function
    let preview = crate::types::validate_import_file(req.content)
        .map_err(internal)?;
    Ok(Json(preview))
}

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------

async fn get_current_version() -> ApiResult<String> {
    Ok(Json(env!("CARGO_PKG_VERSION").to_string()))
}

async fn get_update_settings_handler(
    State(state): State<AppState>,
) -> ApiResult<serde_json::Value> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let auto_check = services::settings::get_setting(&mut conn, "auto_check_updates")
        .unwrap_or(None)
        .map(|v| v == "true" || v == "1")
        .unwrap_or(true);

    let last_check = services::settings::get_setting(&mut conn, "last_update_check")
        .unwrap_or(None);

    Ok(Json(serde_json::json!({
        "autoCheck": auto_check,
        "lastCheck": last_check,
        "currentVersion": env!("CARGO_PKG_VERSION"),
    })))
}

async fn set_auto_check_updates_handler(
    State(state): State<AppState>,
    Json(req): Json<serde_json::Value>,
) -> ApiResult<()> {
    let enabled = req.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    services::settings::set_setting(&mut conn, "auto_check_updates", if enabled { "true" } else { "false" })
        .map_err(|e| internal(e.to_string()))?;
    Ok(Json(()))
}

async fn check_for_update_handler() -> ApiResult<serde_json::Value> {
    // In headless/REST mode, use the same GitHub check as the startup version check
    let url = "https://github.com/javipelopi/streamforge/releases/latest/download/latest.json";
    let current = env!("CARGO_PKG_VERSION");

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| internal(e.to_string()))?;

    let response = client.get(url).send().await
        .map_err(|e| internal(format!("Failed to check for updates: {}", e)))?;

    let body: serde_json::Value = response.json().await
        .map_err(|e| internal(format!("Failed to parse update info: {}", e)))?;

    let latest = body.get("version").and_then(|v| v.as_str()).unwrap_or(current);
    let available = latest != current;

    Ok(Json(serde_json::json!({
        "available": available,
        "version": if available { Some(latest) } else { None },
        "notes": body.get("notes").and_then(|v| v.as_str()),
        "date": body.get("pub_date").and_then(|v| v.as_str()),
    })))
}

// ===========================================================================
// Matching Profiles
// ===========================================================================

use crate::db::models::{MatchingProfile, MatchingProfileUpdate, NewMatchingProfile, NormalizationRule};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MatchingProfileQuery {
    xmltv_source_id: Option<i32>,
}

async fn list_matching_profiles(
    State(state): State<AppState>,
    Query(params): Query<MatchingProfileQuery>,
) -> ApiResult<Vec<MatchingProfile>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let profiles = services::matching_profiles::list_profiles(&mut conn, params.xmltv_source_id)
        .map_err(internal)?;
    Ok(Json(profiles))
}

async fn get_matching_profile(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> ApiResult<MatchingProfile> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let profile = services::matching_profiles::get_profile(&mut conn, id)
        .map_err(not_found)?;
    Ok(Json(profile))
}

async fn create_matching_profile(
    State(state): State<AppState>,
    Json(new_profile): Json<NewMatchingProfile>,
) -> ApiResult<MatchingProfile> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let profile = services::matching_profiles::create_profile(&mut conn, new_profile)
        .map_err(bad_request)?;
    Ok(Json(profile))
}

async fn update_matching_profile(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(updates): Json<MatchingProfileUpdate>,
) -> ApiResult<MatchingProfile> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let profile = services::matching_profiles::update_profile(&mut conn, id, updates)
        .map_err(internal)?;
    Ok(Json(profile))
}

async fn delete_matching_profile(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    services::matching_profiles::delete_profile(&mut conn, id)
        .map_err(not_found)?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReorderRequest {
    profile_ids: Vec<i32>,
}

async fn reorder_matching_profiles(
    State(state): State<AppState>,
    Json(body): Json<ReorderRequest>,
) -> ApiResult<Vec<MatchingProfile>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let profiles = services::matching_profiles::reorder_profiles(&mut conn, &body.profile_ids)
        .map_err(internal)?;
    Ok(Json(profiles))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PreviewRequest {
    name: String,
    rules: Vec<NormalizationRule>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PreviewResponse {
    original: String,
    normalized: String,
}

async fn preview_matching_normalization(
    Json(body): Json<PreviewRequest>,
) -> ApiResult<PreviewResponse> {
    let normalized = services::matching_profiles::preview_normalization(&body.name, &body.rules);
    Ok(Json(PreviewResponse {
        original: body.name,
        normalized,
    }))
}

// ===========================================================================
// Channel Tags (ip-lko)
// ===========================================================================

async fn get_all_tags(State(state): State<AppState>) -> ApiResult<Vec<String>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let tags = services::channel_tags::get_all_tags(&mut conn)
        .map_err(|e| internal(e.to_string()))?;
    Ok(Json(tags))
}

async fn get_channel_tags(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> ApiResult<Vec<String>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let tags = services::channel_tags::get_tags_for_channel(&mut conn, id)
        .map_err(|e| internal(e.to_string()))?;
    Ok(Json(tags))
}

#[derive(Deserialize)]
struct SetTagsRequest {
    tags: Vec<String>,
}

async fn set_channel_tags(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<SetTagsRequest>,
) -> ApiResult<Vec<String>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let tags = services::channel_tags::set_tags_for_channel(&mut conn, id, &body.tags)
        .map_err(|e| internal(e.to_string()))?;
    Ok(Json(tags))
}
