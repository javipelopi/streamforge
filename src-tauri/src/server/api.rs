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

use crate::commands::accounts::{
    AccountError, AccountResponse, AddAccountRequest, UpdateAccountRequest,
};
use crate::commands::channels::ChannelResponse;
use crate::commands::epg::XmltvSourceResponse;
use crate::commands::logs::EventLogResponse;
use crate::credentials::CredentialManager;
use crate::db::models::{EventLog, NewEventLog, NewXmltvSource, XmltvSourceUpdate};
use crate::db::schema::{
    accounts, event_log, settings, xmltv_sources, xtream_channels,
};
use crate::db::{
    Account, Setting, XmltvSource, XtreamChannel,
};
use crate::logging::log_event_internal;
use crate::matcher::{calculate_match_stats, MatchStats};
use crate::services;
use crate::xmltv::{fetch_xmltv, parse_xmltv_data};

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
        AccountError::CredentialStorageError | AccountError::DatabaseError(_) => {
            StatusCode::INTERNAL_SERVER_ERROR
        }
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

    let rows: Vec<XmltvSource> = xmltv_sources::table
        .load(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    Ok(Json(rows.into_iter().map(XmltvSourceResponse::from).collect()))
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
    if req.name.trim().is_empty() {
        return Err(bad_request("Source name is required"));
    }
    if req.url.trim().is_empty() {
        return Err(bad_request("URL is required"));
    }
    let valid_formats = ["xml", "xml_gz", "auto"];
    if !valid_formats.contains(&req.format.as_str()) {
        return Err(bad_request("Format must be one of: xml, xml_gz, auto"));
    }

    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let new_source = NewXmltvSource::new(
        req.name,
        req.url,
        req.format,
        req.refresh_interval_hours,
    );

    diesel::insert_into(xmltv_sources::table)
        .values(&new_source)
        .execute(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let inserted: XmltvSource = xmltv_sources::table
        .order(xmltv_sources::id.desc())
        .first(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    Ok((StatusCode::CREATED, Json(XmltvSourceResponse::from(inserted))))
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

    let _existing: XmltvSource = xmltv_sources::table
        .filter(xmltv_sources::id.eq(id))
        .first(&mut conn)
        .optional()
        .map_err(|e| internal(e.to_string()))?
        .ok_or_else(|| not_found("XMLTV source not found"))?;

    let now = chrono::Utc::now().to_rfc3339();
    let update = XmltvSourceUpdate {
        name: req.name,
        url: req.url,
        format: req.format,
        refresh_interval_hours: req.refresh_interval_hours,
        updated_at: now,
    };

    diesel::update(xmltv_sources::table.filter(xmltv_sources::id.eq(id)))
        .set(&update)
        .execute(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let source: XmltvSource = xmltv_sources::table
        .filter(xmltv_sources::id.eq(id))
        .first(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    Ok(Json(XmltvSourceResponse::from(source)))
}

async fn delete_xmltv_source(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let deleted = diesel::delete(xmltv_sources::table.filter(xmltv_sources::id.eq(id)))
        .execute(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    if deleted == 0 {
        return Err(not_found("XMLTV source not found"));
    }

    Ok(StatusCode::NO_CONTENT)
}

async fn toggle_xmltv_source(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(req): Json<ToggleRequest>,
) -> ApiResult<XmltvSourceResponse> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let _existing: XmltvSource = xmltv_sources::table
        .filter(xmltv_sources::id.eq(id))
        .first(&mut conn)
        .optional()
        .map_err(|e| internal(e.to_string()))?
        .ok_or_else(|| not_found("XMLTV source not found"))?;

    let now = chrono::Utc::now().to_rfc3339();
    diesel::update(xmltv_sources::table.filter(xmltv_sources::id.eq(id)))
        .set((
            xmltv_sources::is_active.eq(if req.is_active { 1 } else { 0 }),
            xmltv_sources::updated_at.eq(&now),
        ))
        .execute(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let source: XmltvSource = xmltv_sources::table
        .filter(xmltv_sources::id.eq(id))
        .first(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    Ok(Json(XmltvSourceResponse::from(source)))
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
        match do_refresh_source(&mut conn, source).await {
            Ok(()) => {
                success_count += 1;
                state.invalidate_epg_cache();
            }
            Err(msg) => {
                errors.push(format!("{}: {}", source.name, msg));
                let _ = log_event_internal(
                    &mut conn, "error", "epg",
                    &format!("EPG refresh failed for {}: {}", source.name, msg),
                    Some(&serde_json::json!({"sourceId": source_id}).to_string()),
                );
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

    let source: XmltvSource = xmltv_sources::table
        .filter(xmltv_sources::id.eq(source_id))
        .first(&mut conn)
        .optional()
        .map_err(|e| internal(e.to_string()))?
        .ok_or_else(|| not_found("XMLTV source not found"))?;

    match do_refresh_source(&mut conn, &source).await {
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

/// Shared EPG refresh logic (fetch, parse, store).
async fn do_refresh_source(
    conn: &mut diesel::SqliteConnection,
    source: &XmltvSource,
) -> Result<(), String> {
    use crate::db::schema::{programs, xmltv_channels};
    use crate::db::{NewProgram, NewXmltvChannel};
    use crate::epg_ops::{preserve_channel_data, restore_channel_data};

    let source_id = source.id.unwrap_or(0);
    let data = fetch_xmltv(&source.url, &source.format)
        .await
        .map_err(|e| e.to_string())?;

    let (parsed_channels, parsed_programs) =
        parse_xmltv_data(&data).map_err(|e| e.to_string())?;

    // Preserve manual mappings before clearing
    let preserved = preserve_channel_data(conn, source_id)
        .map_err(|e| e.to_string())?;

    // Delete old data for this source
    let old_channel_ids: Vec<Option<i32>> = xmltv_channels::table
        .filter(xmltv_channels::source_id.eq(source_id))
        .select(xmltv_channels::id)
        .load(conn)
        .map_err(|e| e.to_string())?;

    for cid in &old_channel_ids {
        if let Some(id) = cid {
            diesel::delete(programs::table.filter(programs::xmltv_channel_id.eq(*id)))
                .execute(conn)
                .map_err(|e| e.to_string())?;
        }
    }
    diesel::delete(xmltv_channels::table.filter(xmltv_channels::source_id.eq(source_id)))
        .execute(conn)
        .map_err(|e| e.to_string())?;

    // Insert new channels and build ID map
    let mut channel_id_map = std::collections::HashMap::new();
    for ch in &parsed_channels {
        let new_ch = NewXmltvChannel {
            source_id,
            channel_id: ch.id.clone(),
            display_name: ch.display_name.clone(),
            icon: ch.icon.clone(),
        };
        diesel::insert_into(xmltv_channels::table)
            .values(&new_ch)
            .execute(conn)
            .map_err(|e| e.to_string())?;

        let inserted_id: i32 = diesel::select(diesel::dsl::sql::<diesel::sql_types::Integer>(
            "last_insert_rowid()",
        ))
        .get_result(conn)
        .map_err(|e| e.to_string())?;

        channel_id_map.insert(ch.id.clone(), inserted_id);
    }

    // Insert programs
    for prog in &parsed_programs {
        if let Some(&db_channel_id) = channel_id_map.get(&prog.channel_id) {
            let new_prog = NewProgram {
                xmltv_channel_id: db_channel_id,
                title: prog.title.clone(),
                description: prog.description.clone(),
                start_time: prog.start.clone(),
                end_time: prog.stop.clone(),
                category: prog.category.clone(),
                episode_info: prog.episode_info.clone(),
            };
            diesel::insert_into(programs::table)
                .values(&new_prog)
                .execute(conn)
                .map_err(|e| e.to_string())?;
        }
    }

    // Restore preserved data
    let _ = restore_channel_data(conn, &preserved, &channel_id_map);

    // Update last_refresh timestamp
    let now = chrono::Utc::now().to_rfc3339();
    diesel::update(xmltv_sources::table.filter(xmltv_sources::id.eq(source_id)))
        .set(xmltv_sources::last_refresh.eq(&now))
        .execute(conn)
        .map_err(|e| e.to_string())?;

    Ok(())
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

    let value: Option<String> = settings::table
        .filter(settings::key.eq(&key))
        .select(settings::value)
        .first(&mut conn)
        .optional()
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

    let setting = Setting::new(key.clone(), req.value.clone());

    diesel::replace_into(settings::table)
        .values(&setting)
        .execute(&mut conn)
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

    let limit = q.limit.unwrap_or(50);
    let offset = q.offset.unwrap_or(0);

    let mut query = event_log::table.into_boxed();

    if let Some(ref lvl) = q.level {
        query = query.filter(event_log::level.eq(lvl));
    }
    if let Some(ref cat) = q.category {
        query = query.filter(event_log::category.eq(cat));
    }
    if q.unread_only.unwrap_or(false) {
        query = query.filter(event_log::is_read.eq(0));
    }
    if let Some(ref after) = q.created_after {
        query = query.filter(event_log::timestamp.ge(after));
    }
    if let Some(ref before) = q.created_before {
        query = query.filter(event_log::timestamp.lt(before));
    }

    // Count with same filters
    let total_count: i64 = {
        let mut cq = event_log::table.into_boxed();
        if let Some(ref lvl) = q.level { cq = cq.filter(event_log::level.eq(lvl)); }
        if let Some(ref cat) = q.category { cq = cq.filter(event_log::category.eq(cat)); }
        if q.unread_only.unwrap_or(false) { cq = cq.filter(event_log::is_read.eq(0)); }
        if let Some(ref after) = q.created_after { cq = cq.filter(event_log::timestamp.ge(after)); }
        if let Some(ref before) = q.created_before { cq = cq.filter(event_log::timestamp.lt(before)); }
        cq.count().get_result(&mut conn).map_err(|e| internal(e.to_string()))?
    };

    let unread_count: i64 = event_log::table
        .filter(event_log::is_read.eq(0))
        .count()
        .get_result(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let events: Vec<EventLog> = query
        .order(event_log::timestamp.desc())
        .limit(limit)
        .offset(offset)
        .load(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    Ok(Json(EventLogResponse {
        events,
        total_count,
        unread_count,
    }))
}

async fn get_unread_count(State(state): State<AppState>) -> ApiResult<serde_json::Value> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let count: i64 = event_log::table
        .filter(event_log::is_read.eq(0))
        .count()
        .get_result(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    Ok(Json(serde_json::json!({ "count": count })))
}

async fn mark_event_read(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    diesel::update(event_log::table.filter(event_log::id.eq(Some(id))))
        .set(event_log::is_read.eq(1))
        .execute(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

async fn mark_all_events_read(
    State(state): State<AppState>,
) -> ApiResult<serde_json::Value> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let count = diesel::update(event_log::table.filter(event_log::is_read.eq(0)))
        .set(event_log::is_read.eq(1))
        .execute(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    Ok(Json(serde_json::json!({ "markedRead": count })))
}

// ===========================================================================
// Matcher
// ===========================================================================

async fn get_matcher_stats(State(state): State<AppState>) -> ApiResult<MatchStats> {
    let pool = state.pool().clone();
    let stats = calculate_match_stats(&pool)
        .map_err(|e| internal(e.to_string()))?;
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
    use crate::db::schema::{xmltv_channels, xtream_channels};
    use crate::db::{XmltvChannel, XtreamChannel};
    use crate::matcher::{match_channels, save_channel_mappings, MatchConfig};

    let threshold = req.threshold.unwrap_or(0.85);
    if !(0.0..=1.0).contains(&threshold) {
        return Err(bad_request("Threshold must be between 0.0 and 1.0"));
    }

    let config = MatchConfig::default().with_threshold(threshold);
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let xmltv_chs: Vec<XmltvChannel> = xmltv_channels::table
        .load(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let xtream_chs: Vec<XtreamChannel> = xtream_channels::table
        .load(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let (matches, stats) = match_channels(&xmltv_chs, &xtream_chs, &config);

    let xmltv_ids: Vec<i32> = xmltv_chs.iter().filter_map(|c| c.id).collect();
    let saved_count = save_channel_mappings(&mut conn, &matches, &xmltv_ids)
        .map_err(|e| internal(e.to_string()))?;

    let _ = log_event_internal(
        &mut conn, "info", "match",
        &format!("Channel matching completed: {} of {} matched (threshold: {:.0}%)",
            stats.matched, stats.total_xmltv, threshold * 100.0),
        Some(&serde_json::json!({
            "matchedCount": stats.matched,
            "unmatchedCount": stats.unmatched,
            "threshold": threshold,
        }).to_string()),
    );

    Ok(Json(MatchResponse {
        success: true,
        matched_count: stats.matched,
        unmatched_count: stats.unmatched,
        total_xmltv: stats.total_xmltv,
        total_source_channels: stats.total_source_channels,
        duration_ms: stats.duration_ms,
        message: format!(
            "Matched {} of {} XMLTV channels. {} mappings saved.",
            stats.matched, stats.total_xmltv, saved_count
        ),
    }))
}
