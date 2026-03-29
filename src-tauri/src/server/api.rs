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
    AccountResponse, AddAccountRequest, UpdateAccountRequest,
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

    let rows: Vec<Account> = accounts::table
        .load(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    Ok(Json(rows.into_iter().map(AccountResponse::from).collect()))
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
    // Validate
    if req.name.trim().is_empty() {
        return Err(bad_request("Account name is required"));
    }
    if !req.server_url.starts_with("http://") && !req.server_url.starts_with("https://") {
        return Err(bad_request("Server URL must start with http:// or https://"));
    }
    if req.username.trim().is_empty() {
        return Err(bad_request("Username is required"));
    }
    if req.password.trim().is_empty() {
        return Err(bad_request("Password is required"));
    }

    let normalized_url = req.server_url.trim().trim_end_matches('/').to_string();
    let app_data_dir = state.app_data_dir().clone();
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    // Insert account
    let new_account = crate::db::NewAccount::new(
        req.name.clone(),
        normalized_url,
        req.username.clone(),
        vec![], // placeholder password
    );

    diesel::insert_into(accounts::table)
        .values(&new_account)
        .execute(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let inserted: Account = accounts::table
        .order(accounts::id.desc())
        .first(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let account_id = inserted.id.unwrap_or(0);

    // Store password securely
    let cred_mgr = CredentialManager::new(app_data_dir);
    let (_, encrypted) = cred_mgr
        .store_password(&account_id.to_string(), &req.password)
        .map_err(|_| internal("Failed to store credentials securely"))?;

    diesel::update(accounts::table.filter(accounts::id.eq(account_id)))
        .set(accounts::password_encrypted.eq(&encrypted))
        .execute(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let account: Account = accounts::table
        .filter(accounts::id.eq(account_id))
        .first(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    Ok((StatusCode::CREATED, Json(AccountResponse::from(account))))
}

async fn update_account(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(req): Json<UpdateAccountRequest>,
) -> ApiResult<AccountResponse> {
    if req.name.trim().is_empty() {
        return Err(bad_request("Account name is required"));
    }

    let normalized_url = req.server_url.trim().trim_end_matches('/').to_string();
    let app_data_dir = state.app_data_dir().clone();
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let existing: Account = accounts::table
        .filter(accounts::id.eq(id))
        .first(&mut conn)
        .optional()
        .map_err(|e| internal(e.to_string()))?
        .ok_or_else(|| not_found("Account not found"))?;

    let now = chrono::Utc::now().to_rfc3339();

    diesel::update(accounts::table.filter(accounts::id.eq(id)))
        .set((
            accounts::name.eq(&req.name),
            accounts::server_url.eq(&normalized_url),
            accounts::username.eq(&req.username),
            accounts::updated_at.eq(&now),
        ))
        .execute(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    if let Some(password) = &req.password {
        let cred_mgr = CredentialManager::new(app_data_dir);
        let _ = cred_mgr.delete_password(&id.to_string(), &existing.password_encrypted);
        let (_, encrypted) = cred_mgr
            .store_password(&id.to_string(), password)
            .map_err(|_| internal("Failed to store credentials"))?;
        diesel::update(accounts::table.filter(accounts::id.eq(id)))
            .set(accounts::password_encrypted.eq(&encrypted))
            .execute(&mut conn)
            .map_err(|e| internal(e.to_string()))?;
    }

    let account: Account = accounts::table
        .filter(accounts::id.eq(id))
        .first(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    Ok(Json(AccountResponse::from(account)))
}

async fn delete_account(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let app_data_dir = state.app_data_dir().clone();
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let account: Account = accounts::table
        .filter(accounts::id.eq(id))
        .first(&mut conn)
        .optional()
        .map_err(|e| internal(e.to_string()))?
        .ok_or_else(|| not_found("Account not found"))?;

    let cred_mgr = CredentialManager::new(app_data_dir);
    let _ = cred_mgr.delete_password(&id.to_string(), &account.password_encrypted);

    diesel::delete(accounts::table.filter(accounts::id.eq(id)))
        .execute(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

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

    let _existing: Account = accounts::table
        .filter(accounts::id.eq(id))
        .first(&mut conn)
        .optional()
        .map_err(|e| internal(e.to_string()))?
        .ok_or_else(|| not_found("Account not found"))?;

    let now = chrono::Utc::now().to_rfc3339();
    diesel::update(accounts::table.filter(accounts::id.eq(id)))
        .set((
            accounts::is_active.eq(if req.is_active { 1 } else { 0 }),
            accounts::updated_at.eq(&now),
        ))
        .execute(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let account: Account = accounts::table
        .filter(accounts::id.eq(id))
        .first(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    Ok(Json(AccountResponse::from(account)))
}

async fn test_account_connection(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> ApiResult<crate::commands::accounts::TestConnectionResponse> {
    use crate::commands::accounts::TestConnectionResponse;
    use crate::db::AccountStatusUpdate;
    use crate::xtream::XtreamClient;

    let app_data_dir = state.app_data_dir().clone();
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let account: Account = accounts::table
        .filter(accounts::id.eq(id))
        .first(&mut conn)
        .optional()
        .map_err(|e| internal(e.to_string()))?
        .ok_or_else(|| not_found("Account not found"))?;

    let cred_mgr = CredentialManager::new(app_data_dir);
    let password = cred_mgr
        .retrieve_password(&id.to_string(), &account.password_encrypted)
        .map_err(|_| internal("Failed to retrieve credentials"))?;

    let client = XtreamClient::new(&account.server_url, &account.username, &password)
        .map_err(|e| internal(e.user_message()))?;

    match client.authenticate().await {
        Ok(info) => {
            let expiry_date_str = info.expiry_date.map(|d| d.to_rfc3339());
            let last_check = chrono::Utc::now().to_rfc3339();

            let status_update = AccountStatusUpdate {
                expiry_date: expiry_date_str.clone(),
                max_connections_actual: Some(info.max_connections),
                active_connections: Some(info.active_connections),
                last_check: Some(last_check),
                connection_status: Some("connected".to_string()),
            };
            let _ = diesel::update(accounts::table.filter(accounts::id.eq(id)))
                .set(&status_update)
                .execute(&mut conn);

            Ok(Json(TestConnectionResponse {
                success: true,
                status: Some(info.status),
                expiry_date: expiry_date_str,
                max_connections: Some(info.max_connections),
                active_connections: Some(info.active_connections),
                error_message: None,
                suggestions: None,
            }))
        }
        Err(e) => {
            let last_check = chrono::Utc::now().to_rfc3339();
            let status_update = AccountStatusUpdate {
                expiry_date: None,
                max_connections_actual: None,
                active_connections: None,
                last_check: Some(last_check),
                connection_status: Some("failed".to_string()),
            };
            let _ = diesel::update(accounts::table.filter(accounts::id.eq(id)))
                .set(&status_update)
                .execute(&mut conn);

            Ok(Json(TestConnectionResponse {
                success: false,
                status: None,
                expiry_date: None,
                max_connections: None,
                active_connections: None,
                error_message: Some(e.user_message()),
                suggestions: Some(e.suggestions()),
            }))
        }
    }
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

    let channels: Vec<XtreamChannel> = xtream_channels::table
        .filter(xtream_channels::account_id.eq(account_id))
        .order(xtream_channels::name.asc())
        .load(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    Ok(Json(channels.into_iter().map(ChannelResponse::from).collect()))
}

async fn get_channel_count(
    State(state): State<AppState>,
    Path(account_id): Path<i32>,
) -> ApiResult<serde_json::Value> {
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let count: i64 = xtream_channels::table
        .filter(xtream_channels::account_id.eq(account_id))
        .count()
        .get_result(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    Ok(Json(serde_json::json!({ "count": count })))
}

async fn scan_channels(
    State(state): State<AppState>,
    Path(account_id): Path<i32>,
) -> ApiResult<crate::commands::channels::ScanChannelsResponse> {
    use crate::commands::channels::ScanChannelsResponse;
    use crate::db::{NewXtreamChannel, XtreamChannelUpdate};
    use crate::xtream::{quality, XtreamClient};
    use std::collections::{HashMap, HashSet};
    use std::time::Instant;

    let start_time = Instant::now();
    let app_data_dir = state.app_data_dir().clone();
    let mut conn = state.get_connection().map_err(|e| internal(e.to_string()))?;

    let account: Account = accounts::table
        .filter(accounts::id.eq(account_id))
        .first(&mut conn)
        .optional()
        .map_err(|e| internal(e.to_string()))?
        .ok_or_else(|| not_found("Account not found"))?;

    let cred_mgr = CredentialManager::new(app_data_dir);
    let password = cred_mgr
        .retrieve_password(&account_id.to_string(), &account.password_encrypted)
        .map_err(|_| internal("Failed to retrieve credentials"))?;

    let client = XtreamClient::new(&account.server_url, &account.username, &password)
        .map_err(|e| internal(e.user_message()))?;

    // Refresh account info
    if let Ok(info) = client.authenticate().await {
        use crate::db::AccountStatusUpdate;
        let status = AccountStatusUpdate {
            expiry_date: info.expiry_date.map(|dt| dt.to_rfc3339()),
            max_connections_actual: Some(info.max_connections),
            active_connections: Some(info.active_connections),
            last_check: Some(chrono::Utc::now().to_rfc3339()),
            connection_status: Some("Active".to_string()),
        };
        let _ = diesel::update(accounts::table.filter(accounts::id.eq(account_id)))
            .set(&status)
            .execute(&mut conn);
    }

    let categories = client.get_live_categories().await
        .map_err(|e| internal(e.user_message()))?;
    let category_map: HashMap<String, String> = categories
        .into_iter()
        .map(|c| (c.category_id, c.category_name))
        .collect();

    let streams = client.get_live_streams().await
        .map_err(|e| internal(e.user_message()))?;

    let total_channels = streams.len() as i32;

    let existing: Vec<XtreamChannel> = xtream_channels::table
        .filter(xtream_channels::account_id.eq(account_id))
        .load(&mut conn)
        .map_err(|e| internal(e.to_string()))?;

    let existing_map: HashMap<i32, XtreamChannel> = existing
        .into_iter()
        .filter_map(|c| c.id.map(|_| (c.stream_id, c)))
        .collect();

    let current_ids: HashSet<i32> = streams.iter().map(|s| s.stream_id).collect();
    let removed_ids: Vec<i32> = existing_map.keys()
        .filter(|id| !current_ids.contains(id))
        .copied()
        .collect();
    let removed_channels = removed_ids.len() as i32;

    let mut new_channels = 0i32;
    let mut updated_channels = 0i32;
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.transaction::<_, diesel::result::Error, _>(|conn| {
        for stream in &streams {
            let qualities = quality::detect_qualities(&stream.name);
            let qualities_json = quality::qualities_to_json(&qualities);
            let category_name = stream.category_id.as_ref()
                .and_then(|cid| category_map.get(cid).cloned());
            let category_id = stream.category_id.as_ref()
                .and_then(|s| s.parse::<i32>().ok());

            if existing_map.contains_key(&stream.stream_id) {
                let update = XtreamChannelUpdate {
                    name: stream.name.clone(),
                    stream_icon: stream.stream_icon.clone(),
                    category_id,
                    category_name,
                    qualities: qualities_json,
                    epg_channel_id: stream.epg_channel_id.clone(),
                    tv_archive: stream.tv_archive.unwrap_or(0),
                    tv_archive_duration: stream.tv_archive_duration.unwrap_or(0),
                    updated_at: now.clone(),
                };
                diesel::update(
                    xtream_channels::table
                        .filter(xtream_channels::account_id.eq(account_id))
                        .filter(xtream_channels::stream_id.eq(stream.stream_id)),
                )
                .set(&update)
                .execute(conn)?;
                updated_channels += 1;
            } else {
                let new_ch = NewXtreamChannel {
                    account_id,
                    stream_id: stream.stream_id,
                    name: stream.name.clone(),
                    stream_icon: stream.stream_icon.clone(),
                    category_id,
                    category_name,
                    qualities: qualities_json,
                    epg_channel_id: stream.epg_channel_id.clone(),
                    tv_archive: stream.tv_archive.unwrap_or(0),
                    tv_archive_duration: stream.tv_archive_duration.unwrap_or(0),
                };
                diesel::insert_into(xtream_channels::table)
                    .values(&new_ch)
                    .execute(conn)?;
                new_channels += 1;
            }
        }

        if !removed_ids.is_empty() {
            diesel::delete(
                xtream_channels::table
                    .filter(xtream_channels::account_id.eq(account_id))
                    .filter(xtream_channels::stream_id.eq_any(&removed_ids)),
            )
            .execute(conn)?;
        }

        Ok(())
    })
    .map_err(|e| internal(e.to_string()))?;

    Ok(Json(ScanChannelsResponse {
        success: true,
        total_channels,
        new_channels,
        updated_channels,
        removed_channels,
        scan_duration_ms: start_time.elapsed().as_millis() as u64,
        error_message: None,
    }))
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
