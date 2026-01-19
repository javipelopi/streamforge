//! Account management Tauri commands
//!
//! This module provides commands for adding, retrieving, updating, and deleting
//! Xtream Codes account credentials with secure password storage.

use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use thiserror::Error;

use crate::credentials::CredentialManager;
use crate::db::{
    schema::accounts,
    Account, DbConnection, NewAccount,
};

/// Error types for account operations
#[derive(Debug, Error)]
pub enum AccountError {
    #[error("Account name is required")]
    NameRequired,

    #[error("Server URL is required")]
    ServerUrlRequired,

    #[error("Server URL format is invalid - must start with http:// or https://")]
    InvalidServerUrl,

    #[error("Username is required")]
    UsernameRequired,

    #[error("Password is required")]
    PasswordRequired,

    #[error("Failed to store credentials securely")]
    CredentialStorageError,

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Account not found")]
    NotFound,

    #[error("Failed to get app data directory")]
    AppDataDirError,
}

impl From<AccountError> for String {
    fn from(err: AccountError) -> Self {
        err.to_string()
    }
}

/// Response type for account data (excludes password)
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AccountResponse {
    pub id: i32,
    pub name: String,
    pub server_url: String,
    pub username: String,
    pub max_connections: i32,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<Account> for AccountResponse {
    fn from(account: Account) -> Self {
        Self {
            id: account.id.unwrap_or(0),
            name: account.name,
            server_url: account.server_url,
            username: account.username,
            max_connections: account.max_connections,
            is_active: account.is_active != 0,
            created_at: account.created_at,
            updated_at: account.updated_at,
        }
    }
}

/// Request type for adding a new account
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddAccountRequest {
    pub name: String,
    pub server_url: String,
    pub username: String,
    pub password: String,
}

/// Request type for updating an account
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAccountRequest {
    pub name: String,
    pub server_url: String,
    pub username: String,
    pub password: Option<String>, // Optional - only update if provided
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

    // Validate server URL
    if server_url.trim().is_empty() {
        return Err(AccountError::ServerUrlRequired);
    }

    // Validate URL format
    if !server_url.starts_with("http://") && !server_url.starts_with("https://") {
        return Err(AccountError::InvalidServerUrl);
    }

    // Validate username
    if username.trim().is_empty() {
        return Err(AccountError::UsernameRequired);
    }

    // Validate password (only if provided)
    if let Some(pwd) = password {
        if pwd.is_empty() {
            return Err(AccountError::PasswordRequired);
        }
    }

    Ok(())
}

/// Add a new Xtream Codes account
///
/// Stores the password securely using OS keychain (preferred) or AES-256-GCM encryption (fallback).
#[tauri::command]
pub async fn add_account(
    app: AppHandle,
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

    // Get app data directory for credential storage
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| AccountError::AppDataDirError)?;

    // Get database connection
    let mut conn = db
        .get_connection()
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    // First, insert the account to get the ID
    let new_account = NewAccount::new(
        request.name.clone(),
        request.server_url.clone(),
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
    let (_, encrypted_password) = credential_manager
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
    app: AppHandle,
    db: State<'_, DbConnection>,
    id: i32,
) -> Result<(), String> {
    // Get app data directory for credential storage
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| AccountError::AppDataDirError)?;

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
    app: AppHandle,
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

    // Get app data directory for credential storage
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| AccountError::AppDataDirError)?;

    let mut conn = db
        .get_connection()
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

    // First, check if account exists
    let existing: Account = accounts::table
        .filter(accounts::id.eq(id))
        .first(&mut conn)
        .map_err(|_| AccountError::NotFound)?;

    // Get current timestamp for updated_at
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Update basic fields
    diesel::update(accounts::table.filter(accounts::id.eq(id)))
        .set((
            accounts::name.eq(&request.name),
            accounts::server_url.eq(&request.server_url),
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
        let (_, encrypted_password) = credential_manager
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
