//! Account management Tauri commands
//!
//! This module provides commands for adding, retrieving, updating, and deleting
//! Xtream Codes account credentials with secure password storage.
//!
//! Story 6-3: Connection event logging for Xtream authentication

use diesel::prelude::*;
use tauri::{AppHandle, State};

use crate::commands::logs::log_event_internal;
use crate::credentials::CredentialManager;
use crate::db::{
    schema::accounts,
    Account, AccountStatusUpdate, DbConnection, NewAccount,
};
use crate::xtream::XtreamClient;

// Re-export shared types from crate::types
pub use crate::types::{
    AccountError, AccountResponse, AddAccountRequest, TestConnectionResponse, UpdateAccountRequest,
};

/// Normalize server URL by removing trailing slashes
fn normalize_url(url: &str) -> String {
    url.trim().trim_end_matches('/').to_string()
}

/// Validate account input fields
fn validate_account_input(
    name: &str,
    server_url: &str,
    username: &str,
    password: Option<&str>,
) -> Result<(), AccountError> {
    // Validate name
    if name.trim().is_empty() {
        return Err(AccountError::NameRequired);
    }
    if name.len() > 100 {
        return Err(AccountError::DatabaseError("Account name must be 100 characters or less".to_string()));
    }

    // Validate server URL
    if server_url.trim().is_empty() {
        return Err(AccountError::ServerUrlRequired);
    }

    // Validate URL format by attempting to parse it
    if !server_url.starts_with("http://") && !server_url.starts_with("https://") {
        return Err(AccountError::InvalidServerUrl);
    }

    // Validate that URL is actually parseable
    if url::Url::parse(server_url.trim()).is_err() {
        return Err(AccountError::InvalidServerUrl);
    }

    // Validate username
    if username.trim().is_empty() {
        return Err(AccountError::UsernameRequired);
    }
    if username.len() > 100 {
        return Err(AccountError::DatabaseError("Username must be 100 characters or less".to_string()));
    }

    // Validate password (only if provided)
    if let Some(pwd) = password {
        if pwd.trim().is_empty() {
            return Err(AccountError::PasswordRequired);
        }
        if pwd.len() > 500 {
            return Err(AccountError::DatabaseError("Password must be 500 characters or less".to_string()));
        }
    }

    Ok(())
}

/// Add a new Xtream Codes account
///
/// Stores the password securely using AES-256-GCM encryption.
#[tauri::command]
pub async fn add_account(
    _app: AppHandle,
    db: State<'_, DbConnection>,
    request: AddAccountRequest,
) -> Result<AccountResponse, String> {
    // Validate input
    validate_account_input(
        &request.name,
        &request.server_url,
        &request.username,
        Some(&request.password),
    )?;

    // Normalize server URL
    let normalized_server_url = normalize_url(&request.server_url);

    // Use the canonical credential directory (shared with headless mode)
    let app_data_dir = crate::credentials::get_credential_dir();

    // Get database connection
    let mut conn = db
        .get_connection()
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    // First, insert the account to get the ID
    let new_account = NewAccount::new(
        request.name.clone(),
        normalized_server_url,
        request.username.clone(),
        vec![], // Placeholder - will be updated after we have the ID
    );

    diesel::insert_into(accounts::table)
        .values(&new_account)
        .execute(&mut conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    // Get the inserted account to retrieve its ID
    let inserted: Account = accounts::table
        .order(accounts::id.desc())
        .first(&mut conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    let account_id = inserted.id.unwrap_or(0);

    // Store password securely using the account ID as key
    let credential_manager = CredentialManager::new(app_data_dir);
    let encrypted_password = credential_manager
        .store_password(&account_id.to_string(), &request.password)
        .map_err(|_| AccountError::CredentialStorageError)?;

    // Update the account with the encrypted password
    diesel::update(accounts::table.filter(accounts::id.eq(account_id)))
        .set(accounts::password_encrypted.eq(&encrypted_password))
        .execute(&mut conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    // Retrieve the final account
    let account: Account = accounts::table
        .filter(accounts::id.eq(account_id))
        .first(&mut conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    Ok(AccountResponse::from(account))
}

/// Get all accounts (without passwords)
#[tauri::command]
pub async fn get_accounts(db: State<'_, DbConnection>) -> Result<Vec<AccountResponse>, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    let account_list: Vec<Account> = accounts::table
        .load(&mut conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    Ok(account_list.into_iter().map(AccountResponse::from).collect())
}

/// Delete an account
#[tauri::command]
pub async fn delete_account(
    _app: AppHandle,
    db: State<'_, DbConnection>,
    id: i32,
) -> Result<(), String> {
    // Use the canonical credential directory (shared with headless mode)
    let app_data_dir = crate::credentials::get_credential_dir();

    let mut conn = db
        .get_connection()
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    // First, get the account to retrieve the encrypted password for deletion
    let account: Account = accounts::table
        .filter(accounts::id.eq(id))
        .first(&mut conn)
        .map_err(|_| AccountError::NotFound)?;

    // Delete the stored credential
    let credential_manager = CredentialManager::new(app_data_dir);
    let _ = credential_manager.delete_password(&id.to_string(), &account.password_encrypted);

    // Delete the account from database
    diesel::delete(accounts::table.filter(accounts::id.eq(id)))
        .execute(&mut conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    Ok(())
}

/// Update an existing account
#[tauri::command]
pub async fn update_account(
    _app: AppHandle,
    db: State<'_, DbConnection>,
    id: i32,
    request: UpdateAccountRequest,
) -> Result<AccountResponse, String> {
    // Validate input (password is optional for updates)
    validate_account_input(
        &request.name,
        &request.server_url,
        &request.username,
        request.password.as_deref(),
    )?;

    // Normalize server URL
    let normalized_server_url = normalize_url(&request.server_url);

    // Use the canonical credential directory (shared with headless mode)
    let app_data_dir = crate::credentials::get_credential_dir();

    let mut conn = db
        .get_connection()
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    // First, check if account exists
    let existing: Account = accounts::table
        .filter(accounts::id.eq(id))
        .first(&mut conn)
        .map_err(|_| AccountError::NotFound)?;

    // Get current timestamp for updated_at
    let now = chrono::Utc::now().to_rfc3339();

    // Update basic fields
    diesel::update(accounts::table.filter(accounts::id.eq(id)))
        .set((
            accounts::name.eq(&request.name),
            accounts::server_url.eq(&normalized_server_url),
            accounts::username.eq(&request.username),
            accounts::updated_at.eq(&now),
        ))
        .execute(&mut conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    // If password is provided, update it
    if let Some(password) = &request.password {
        let credential_manager = CredentialManager::new(app_data_dir);

        // Delete old credential
        let _ = credential_manager.delete_password(&id.to_string(), &existing.password_encrypted);

        // Store new password
        let encrypted_password = credential_manager
            .store_password(&id.to_string(), password)
            .map_err(|_| AccountError::CredentialStorageError)?;

        // Update the encrypted password in database
        diesel::update(accounts::table.filter(accounts::id.eq(id)))
            .set(accounts::password_encrypted.eq(&encrypted_password))
            .execute(&mut conn)
            .map_err(|e| AccountError::DatabaseError(e.to_string()))?;
    }

    // Retrieve and return the updated account
    let account: Account = accounts::table
        .filter(accounts::id.eq(id))
        .first(&mut conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    Ok(AccountResponse::from(account))
}

/// Toggle account active status
#[tauri::command]
pub async fn toggle_account(
    db: State<'_, DbConnection>,
    account_id: i32,
    is_active: bool,
) -> Result<AccountResponse, String> {
    let mut conn = db
        .get_connection()
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    // Check if account exists
    let _existing: Account = accounts::table
        .filter(accounts::id.eq(account_id))
        .first(&mut conn)
        .map_err(|_| AccountError::NotFound)?;

    // Get current timestamp for updated_at
    let now = chrono::Utc::now().to_rfc3339();

    // Update is_active field
    diesel::update(accounts::table.filter(accounts::id.eq(account_id)))
        .set((
            accounts::is_active.eq(if is_active { 1 } else { 0 }),
            accounts::updated_at.eq(&now),
        ))
        .execute(&mut conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    // Retrieve and return the updated account
    let account: Account = accounts::table
        .filter(accounts::id.eq(account_id))
        .first(&mut conn)
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    Ok(AccountResponse::from(account))
}

/// Test connection to Xtream Codes server
///
/// Retrieves credentials, authenticates with the Xtream API, and updates
/// the account status in the database.
#[tauri::command]
pub async fn test_connection(
    _app: AppHandle,
    db: State<'_, DbConnection>,
    account_id: i32,
) -> Result<TestConnectionResponse, String> {
    // Use the canonical credential directory (shared with headless mode)
    let app_data_dir = crate::credentials::get_credential_dir();

    // Get database connection
    let mut conn = db
        .get_connection()
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    // Load account from database
    let account: Account = accounts::table
        .filter(accounts::id.eq(account_id))
        .first(&mut conn)
        .map_err(|_| AccountError::NotFound)?;

    // Retrieve password (AES-decrypted; password is NEVER logged)
    let credential_manager = CredentialManager::new(app_data_dir);
    let password = credential_manager
        .retrieve_password(&account_id.to_string(), &account.password_encrypted)
        .map_err(|e| e.to_string())?;

    // Create Xtream client and authenticate
    let client = XtreamClient::new(&account.server_url, &account.username, &password)
        .map_err(|e| e.user_message())?;

    match client.authenticate().await {
        Ok(info) => {
            // Format expiry date for storage and display
            let expiry_date_str = info.expiry_date.map(|d| d.to_rfc3339());
            let last_check = chrono::Utc::now().to_rfc3339();

            // Update account status in database
            let status_update = AccountStatusUpdate {
                expiry_date: expiry_date_str.clone(),
                max_connections_actual: Some(info.max_connections),
                active_connections: Some(info.active_connections),
                last_check: Some(last_check),
                connection_status: Some("connected".to_string()),
            };

            diesel::update(accounts::table.filter(accounts::id.eq(account_id)))
                .set(&status_update)
                .execute(&mut conn)
                .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

            // Story 6-3: Log successful connection event (AC #1)
            let details = serde_json::json!({
                "accountId": account_id,
                "accountName": account.name,
                "maxConnections": info.max_connections,
                "activeConnections": info.active_connections
            });
            let _ = log_event_internal(
                &mut conn,
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
            // Update account status to failed
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
                .execute(&mut conn);

            // Story 6-3: Log connection failure event (AC #1, AC #2)
            let error_message = e.user_message();
            let details = serde_json::json!({
                "accountId": account_id,
                "accountName": account.name,
                "error": error_message
            });
            let _ = log_event_internal(
                &mut conn,
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
