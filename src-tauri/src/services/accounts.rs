//! Accounts service — account CRUD and connection testing.
//!
//! Extracted from `commands/accounts.rs`. Credential operations require a
//! `CredentialManager` (constructed from `app_data_dir` by the caller).

use diesel::prelude::*;
use std::path::Path;

use crate::types::{
    AccountError, AccountResponse, AddAccountRequest, TestConnectionResponse, UpdateAccountRequest,
};
use crate::credentials::CredentialManager;
use crate::db::schema::accounts;
use crate::db::{Account, AccountStatusUpdate, NewAccount};
use crate::logging::log_event_internal;
use crate::xtream::XtreamClient;

/// Normalize server URL by removing trailing slashes.
fn normalize_url(url: &str) -> String {
    url.trim().trim_end_matches('/').to_string()
}

/// Validate account input fields.
fn validate_account_input(
    name: &str,
    server_url: &str,
    username: &str,
    password: Option<&str>,
) -> Result<(), AccountError> {
    if name.trim().is_empty() {
        return Err(AccountError::NameRequired);
    }
    if name.len() > 100 {
        return Err(AccountError::DatabaseError(
            "Account name must be 100 characters or less".to_string(),
        ));
    }
    if server_url.trim().is_empty() {
        return Err(AccountError::ServerUrlRequired);
    }
    if !server_url.starts_with("http://") && !server_url.starts_with("https://") {
        return Err(AccountError::InvalidServerUrl);
    }
    if url::Url::parse(server_url.trim()).is_err() {
        return Err(AccountError::InvalidServerUrl);
    }
    if username.trim().is_empty() {
        return Err(AccountError::UsernameRequired);
    }
    if username.len() > 100 {
        return Err(AccountError::DatabaseError(
            "Username must be 100 characters or less".to_string(),
        ));
    }
    if let Some(pwd) = password {
        if pwd.trim().is_empty() {
            return Err(AccountError::PasswordRequired);
        }
        if pwd.len() > 500 {
            return Err(AccountError::DatabaseError(
                "Password must be 500 characters or less".to_string(),
            ));
        }
    }
    Ok(())
}

/// Add a new Xtream Codes account.
pub fn add_account(
    conn: &mut SqliteConnection,
    app_data_dir: &Path,
    request: &AddAccountRequest,
) -> Result<AccountResponse, AccountError> {
    validate_account_input(
        &request.name,
        &request.server_url,
        &request.username,
        Some(&request.password),
    )?;

    let normalized_server_url = normalize_url(&request.server_url);

    let new_account = NewAccount::new(
        request.name.clone(),
        normalized_server_url,
        request.username.clone(),
        vec![], // Placeholder — updated after we get the ID
    );

    diesel::insert_into(accounts::table)
        .values(&new_account)
        .execute(conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    let inserted: Account = accounts::table
        .order(accounts::id.desc())
        .first(conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    let account_id = inserted.id.unwrap_or(0);

    let credential_manager = CredentialManager::new(app_data_dir.to_path_buf());
    let (_, encrypted_password) = credential_manager
        .store_password(&account_id.to_string(), &request.password)
        .map_err(|_| AccountError::CredentialStorageError)?;

    diesel::update(accounts::table.filter(accounts::id.eq(account_id)))
        .set(accounts::password_encrypted.eq(&encrypted_password))
        .execute(conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    let account: Account = accounts::table
        .filter(accounts::id.eq(account_id))
        .first(conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    Ok(AccountResponse::from(account))
}

/// Get all accounts (without passwords).
pub fn get_accounts(conn: &mut SqliteConnection) -> Result<Vec<AccountResponse>, AccountError> {
    let account_list: Vec<Account> = accounts::table
        .load(conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    Ok(account_list.into_iter().map(AccountResponse::from).collect())
}

/// Delete an account and its stored credentials.
pub fn delete_account(
    conn: &mut SqliteConnection,
    app_data_dir: &Path,
    id: i32,
) -> Result<(), AccountError> {
    let account: Account = accounts::table
        .filter(accounts::id.eq(id))
        .first(conn)
        .map_err(|_| AccountError::NotFound)?;

    let credential_manager = CredentialManager::new(app_data_dir.to_path_buf());
    let _ = credential_manager.delete_password(&id.to_string(), &account.password_encrypted);

    diesel::delete(accounts::table.filter(accounts::id.eq(id)))
        .execute(conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    Ok(())
}

/// Update an existing account.
pub fn update_account(
    conn: &mut SqliteConnection,
    app_data_dir: &Path,
    id: i32,
    request: &UpdateAccountRequest,
) -> Result<AccountResponse, AccountError> {
    validate_account_input(
        &request.name,
        &request.server_url,
        &request.username,
        request.password.as_deref(),
    )?;

    let normalized_server_url = normalize_url(&request.server_url);

    let existing: Account = accounts::table
        .filter(accounts::id.eq(id))
        .first(conn)
        .map_err(|_| AccountError::NotFound)?;

    let now = chrono::Utc::now().to_rfc3339();

    diesel::update(accounts::table.filter(accounts::id.eq(id)))
        .set((
            accounts::name.eq(&request.name),
            accounts::server_url.eq(&normalized_server_url),
            accounts::username.eq(&request.username),
            accounts::updated_at.eq(&now),
        ))
        .execute(conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    if let Some(password) = &request.password {
        let credential_manager = CredentialManager::new(app_data_dir.to_path_buf());
        let _ =
            credential_manager.delete_password(&id.to_string(), &existing.password_encrypted);

        let (_, encrypted_password) = credential_manager
            .store_password(&id.to_string(), password)
            .map_err(|_| AccountError::CredentialStorageError)?;

        diesel::update(accounts::table.filter(accounts::id.eq(id)))
            .set(accounts::password_encrypted.eq(&encrypted_password))
            .execute(conn)
            .map_err(|e| AccountError::DatabaseError(e.to_string()))?;
    }

    let account: Account = accounts::table
        .filter(accounts::id.eq(id))
        .first(conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    Ok(AccountResponse::from(account))
}

/// Toggle account active status.
pub fn toggle_account(
    conn: &mut SqliteConnection,
    account_id: i32,
    is_active: bool,
) -> Result<AccountResponse, AccountError> {
    let _existing: Account = accounts::table
        .filter(accounts::id.eq(account_id))
        .first(conn)
        .map_err(|_| AccountError::NotFound)?;

    let now = chrono::Utc::now().to_rfc3339();

    diesel::update(accounts::table.filter(accounts::id.eq(account_id)))
        .set((
            accounts::is_active.eq(if is_active { 1 } else { 0 }),
            accounts::updated_at.eq(&now),
        ))
        .execute(conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    let account: Account = accounts::table
        .filter(accounts::id.eq(account_id))
        .first(conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    Ok(AccountResponse::from(account))
}

/// Test connection to Xtream Codes server.
///
/// Retrieves credentials, authenticates, and updates account status in DB.
pub async fn test_connection(
    conn: &mut SqliteConnection,
    app_data_dir: &Path,
    account_id: i32,
) -> Result<TestConnectionResponse, AccountError> {
    let account: Account = accounts::table
        .filter(accounts::id.eq(account_id))
        .first(conn)
        .map_err(|_| AccountError::NotFound)?;

    let credential_manager = CredentialManager::new(app_data_dir.to_path_buf());
    let password = credential_manager
        .retrieve_password(&account_id.to_string(), &account.password_encrypted)
        .map_err(|_| AccountError::CredentialStorageError)?;

    let client = XtreamClient::new(&account.server_url, &account.username, &password)
        .map_err(|e| AccountError::DatabaseError(e.user_message()))?;

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

            diesel::update(accounts::table.filter(accounts::id.eq(account_id)))
                .set(&status_update)
                .execute(conn)
                .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

            let details = serde_json::json!({
                "accountId": account_id,
                "accountName": account.name,
                "maxConnections": info.max_connections,
                "activeConnections": info.active_connections
            });
            let _ = log_event_internal(
                conn,
                "info",
                "connection",
                &format!("Connection successful: {}", account.name),
                Some(&details.to_string()),
            );

            Ok(TestConnectionResponse {
                success: true,
                status: Some(info.status),
                expiry_date: expiry_date_str,
                max_connections: Some(info.max_connections),
                active_connections: Some(info.active_connections),
                error_message: None,
                suggestions: None,
            })
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

            let _ = diesel::update(accounts::table.filter(accounts::id.eq(account_id)))
                .set(&status_update)
                .execute(conn);

            let error_message = e.user_message();
            let details = serde_json::json!({
                "accountId": account_id,
                "accountName": account.name,
                "error": error_message
            });
            let _ = log_event_internal(
                conn,
                "error",
                "connection",
                &format!("Connection failed: {} - {}", account.name, error_message),
                Some(&details.to_string()),
            );

            Ok(TestConnectionResponse {
                success: false,
                status: None,
                expiry_date: None,
                max_connections: None,
                active_connections: None,
                error_message: Some(error_message),
                suggestions: Some(e.suggestions()),
            })
        }
    }
}
