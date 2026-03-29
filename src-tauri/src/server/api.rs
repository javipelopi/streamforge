//! Management REST API
//!
//! Axum HTTP/JSON routes that expose the same operations as Tauri commands,
//! allowing the frontend to communicate via fetch() instead of tauri.invoke().
//!
//! Issue: ip-wps

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::commands::accounts::{
    AccountError, AccountResponse, AddAccountRequest, UpdateAccountRequest,
};
use crate::commands::channels::ChannelResponse;
use crate::commands::epg::{EpgSourceError, XmltvSourceResponse};
use crate::commands::logs::EventLogResponse;
use crate::db::models::XmltvSourceUpdate;
use crate::db::schema::{accounts, settings, xmltv_sources};
use crate::db::{Account, Setting, XmltvSource};
use crate::matcher::MatchStats;
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
        // XMLTV sources
        .route("/xmltv-sources", get(list_xmltv_sources).post(create_xmltv_source))
        .route("/xmltv-sources/{id}", get(get_xmltv_source).put(update_xmltv_source).delete(delete_xmltv_source))
        .route("/xmltv-sources/{id}/toggle", post(toggle_xmltv_source))
        // EPG
        .route("/epg/refresh", post(refresh_all_epg))
        .route("/epg/refresh/{source_id}", post(refresh_epg_source))
        .route("/epg/stats", get(get_epg_stats))
        // Settings
        .route("/settings", get(get_all_settings))
        .route("/settings/{key}", get(get_setting).put(set_setting))
        // Channels
        .route("/channels/{account_id}", get(list_channels))
        .route("/channels/{account_id}/scan", post(scan_channels))
        .route("/channels/{account_id}/count", get(get_channel_count))
        // Events / logs
        .route("/events", get(list_events))
        .route("/events/unread-count", get(get_unread_count))
        .route("/events/{id}/read", post(mark_event_read))
        .route("/events/read-all", post(mark_all_events_read))
        // Matcher
        .route("/matcher/stats", get(get_matcher_stats))
        .route("/matcher/run", post(run_matching))
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
) -> ApiResult<crate::commands::accounts::TestConnectionResponse> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let response = services::accounts::test_connection(&mut conn, state.app_data_dir(), id)
        .await
        .map_err(account_err)?;
    Ok(Json(response))
}

// ===========================================================================
// XMLTV Sources
// ===========================================================================

async fn list_xmltv_sources(State(state): State<AppState>) -> ApiResult<Vec<XmltvSourceResponse>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let sources = services::epg::get_xmltv_sources(&mut conn)
        .map_err(|e| epg_err(e))?;
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
        .map_err(|e| epg_err(e))?;
    Ok((StatusCode::CREATED, Json(source)))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateXmltvSourceRequest {
    pub name: String,
    pub url: String,
    pub format: String,
    pub refresh_interval_hours: i32,
}

async fn update_xmltv_source(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(req): Json<UpdateXmltvSourceRequest>,
) -> ApiResult<XmltvSourceResponse> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let updates = XmltvSourceUpdate {
        name: Some(req.name),
        url: Some(req.url),
        format: Some(req.format),
        refresh_interval_hours: Some(req.refresh_interval_hours),
        is_active: None,
        updated_at: None, // service sets this
    };

    let source = services::epg::update_xmltv_source(&mut conn, id, updates)
        .map_err(|e| epg_err(e))?;
    Ok(Json(source))
}

async fn delete_xmltv_source(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    services::epg::delete_xmltv_source(&mut conn, id)
        .map_err(|e| epg_err(e))?;
    Ok(StatusCode::NO_CONTENT)
}

async fn toggle_xmltv_source(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(req): Json<ToggleRequest>,
) -> ApiResult<XmltvSourceResponse> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let source = services::epg::toggle_xmltv_source(&mut conn, id, req.is_active)
        .map_err(|e| epg_err(e))?;
    Ok(Json(source))
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

    // Load active sources to iterate and report per-source results
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
) -> ApiResult<crate::commands::epg::EpgStatsResponse> {
    use crate::commands::epg::EpgStatsResponse;
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

// ===========================================================================
// Channels
// ===========================================================================

async fn list_channels(
    State(state): State<AppState>,
    Path(account_id): Path<i32>,
) -> ApiResult<Vec<ChannelResponse>> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let channels = services::channels::get_channels(&mut conn, account_id)
        .map_err(|e| internal(e))?;
    Ok(Json(channels))
}

async fn get_channel_count(
    State(state): State<AppState>,
    Path(account_id): Path<i32>,
) -> ApiResult<serde_json::Value> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let count = services::channels::get_channel_count(&mut conn, account_id)
        .map_err(|e| internal(e))?;
    Ok(Json(serde_json::json!({ "count": count })))
}

async fn scan_channels(
    State(state): State<AppState>,
    Path(account_id): Path<i32>,
) -> ApiResult<crate::commands::channels::ScanChannelsResponse> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let response = services::channels::scan_channels(&mut conn, state.app_data_dir(), account_id)
        .await
        .map_err(|e| internal(e))?;
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
    ).map_err(|e| internal(e))?;
    Ok(Json(response))
}

async fn get_unread_count(State(state): State<AppState>) -> ApiResult<serde_json::Value> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let count = services::logs::get_unread_event_count(&mut conn)
        .map_err(|e| internal(e))?;
    Ok(Json(serde_json::json!({ "count": count })))
}

async fn mark_event_read(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    services::logs::mark_event_read(&mut conn, id)
        .map_err(|e| internal(e))?;
    Ok(StatusCode::NO_CONTENT)
}

async fn mark_all_events_read(
    State(state): State<AppState>,
) -> ApiResult<serde_json::Value> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let count = services::logs::mark_all_events_read(&mut conn)
        .map_err(|e| internal(e))?;
    Ok(Json(serde_json::json!({ "markedRead": count })))
}

// ===========================================================================
// Matcher
// ===========================================================================

async fn get_matcher_stats(State(state): State<AppState>) -> ApiResult<MatchStats> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;
    let stats = services::matcher::get_match_stats(&mut conn)
        .map_err(|e| internal(e))?;
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
) -> ApiResult<crate::commands::matcher::MatchResponse> {
    use crate::commands::matcher::MatchResponse;
    use crate::services::matcher as svc;

    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let result = svc::run_channel_matching(&mut conn, req.threshold, |_| {})
        .map_err(|e| internal(e))?;

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
