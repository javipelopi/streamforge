# Story 2.1: Add Xtream Account with Secure Credential Storage

Status: ready-for-dev

## Story

As a user,
I want to add my Xtream Codes account credentials securely,
So that the app can connect to my IPTV provider.

## Acceptance Criteria

1. **Given** the Accounts view
   **When** I click "Add Account"
   **Then** a form appears with fields:
   - Account name (display name)
   - Server URL
   - Username
   - Password

2. **Given** I fill in valid credentials and submit
   **When** the form is submitted
   **Then** the password is encrypted using OS keychain (or AES-256-GCM fallback)
   **And** the account is saved to the `accounts` table
   **And** the account appears in the accounts list
   **And** the password is never logged or displayed in plaintext

3. **Given** I submit invalid/empty required fields
   **When** validation runs
   **Then** appropriate error messages are shown
   **And** the form is not submitted

## Tasks / Subtasks

- [ ] Task 1: Create database migration for accounts table (AC: #2)
  - [ ] 1.1 Run `diesel migration generate create_accounts`
  - [ ] 1.2 Create `up.sql` with accounts table schema per Architecture spec
  - [ ] 1.3 Create `down.sql` to drop accounts table
  - [ ] 1.4 Run `diesel migration run` to apply
  - [ ] 1.5 Verify `schema.rs` is updated with accounts table

- [ ] Task 2: Add credential storage dependencies (AC: #2)
  - [ ] 2.1 Add `keyring = { version = "3", features = ["apple-native", "windows-native", "sync-secret-service"] }` to Cargo.toml
  - [ ] 2.2 Add `aes-gcm = "0.10"` for fallback encryption
  - [ ] 2.3 Add `rand = "0.8"` for nonce generation
  - [ ] 2.4 Add `base64 = "0.22"` for encoding encrypted data
  - [ ] 2.5 Run `cargo check` to verify dependencies

- [ ] Task 3: Create credential storage module (AC: #2)
  - [ ] 3.1 Create `src-tauri/src/credentials/mod.rs` module
  - [ ] 3.2 Implement `store_password(account_id: &str, password: &str) -> Result<()>`
  - [ ] 3.3 Implement `retrieve_password(account_id: &str) -> Result<String>`
  - [ ] 3.4 Implement `delete_password(account_id: &str) -> Result<()>`
  - [ ] 3.5 Use keyring crate as primary storage (OS keychain)
  - [ ] 3.6 Implement AES-256-GCM fallback if keyring fails
  - [ ] 3.7 Store fallback key derivation in app data directory (machine-derived)
  - [ ] 3.8 Add unit tests for credential storage

- [ ] Task 4: Create Diesel models for accounts (AC: #2)
  - [ ] 4.1 Create `src-tauri/src/db/models/account.rs`
  - [ ] 4.2 Define `Account` struct with Queryable, Identifiable derives
  - [ ] 4.3 Define `NewAccount` struct with Insertable derive
  - [ ] 4.4 Add to db module exports

- [ ] Task 5: Implement Tauri commands for account management (AC: #1, #2, #3)
  - [ ] 5.1 Create `src-tauri/src/commands/accounts.rs`
  - [ ] 5.2 Implement `add_account(name, server_url, username, password)` command
  - [ ] 5.3 Implement `get_accounts()` command (returns list without passwords)
  - [ ] 5.4 Implement `delete_account(id)` command
  - [ ] 5.5 Implement `update_account(id, name, server_url, username, password?)` command
  - [ ] 5.6 Register commands in lib.rs invoke_handler
  - [ ] 5.7 Validate required fields, return clear error messages

- [ ] Task 6: Create React account form component (AC: #1, #3)
  - [ ] 6.1 Create `src/components/accounts/AccountForm.tsx`
  - [ ] 6.2 Add form fields: name, server_url, username, password
  - [ ] 6.3 Implement client-side validation (required fields, URL format)
  - [ ] 6.4 Show inline error messages for invalid fields
  - [ ] 6.5 Add loading state during submission
  - [ ] 6.6 Clear form on successful submission

- [ ] Task 7: Create React accounts list component (AC: #2)
  - [ ] 7.1 Create `src/components/accounts/AccountsList.tsx`
  - [ ] 7.2 Display accounts with name, server URL, username (no password)
  - [ ] 7.3 Add edit and delete buttons per account
  - [ ] 7.4 Show confirmation dialog before delete
  - [ ] 7.5 Handle empty state (no accounts yet)

- [ ] Task 8: Update Accounts view with new components (AC: #1, #2, #3)
  - [ ] 8.1 Replace placeholder content in `src/views/Accounts.tsx`
  - [ ] 8.2 Add "Add Account" button that shows form modal/dialog
  - [ ] 8.3 Integrate AccountsList component
  - [ ] 8.4 Use TanStack Query for data fetching and cache invalidation
  - [ ] 8.5 Show toast notifications for success/error feedback

- [ ] Task 9: Add Tauri lib functions for frontend (AC: #1, #2)
  - [ ] 9.1 Update `src/lib/tauri.ts` with account-related functions
  - [ ] 9.2 Add `addAccount()` function
  - [ ] 9.3 Add `getAccounts()` function
  - [ ] 9.4 Add `deleteAccount()` function
  - [ ] 9.5 Add `updateAccount()` function
  - [ ] 9.6 Add TypeScript types for Account interface

- [ ] Task 10: Testing and verification (AC: #1, #2, #3)
  - [ ] 10.1 Run `cargo check` and `cargo clippy` - verify no warnings
  - [ ] 10.2 Run `pnpm exec tsc --noEmit` - verify TypeScript compiles
  - [ ] 10.3 Add E2E tests for account form UI
  - [ ] 10.4 Add integration tests for account commands
  - [ ] 10.5 Verify password is never in console logs
  - [ ] 10.6 Test keyring storage on current platform
  - [ ] 10.7 Test AES-256-GCM fallback (disable keyring temporarily)

## Dev Notes

### Architecture Compliance

This story implements the first feature of Epic 2 (Account & Source Configuration) per the Architecture and PRD.

**From PRD - FR1:**
> User can add Xtream Codes account credentials (server URL, username, password)

[Source: prd.md#Functional Requirements - Xtream Codes Integration]

**From Architecture - Security:**
> Xtream passwords encrypted using OS keychain (via `keyring` crate)
> Fallback: AES-256-GCM encryption with machine-derived key
> Never log credentials

[Source: architecture.md#Security Considerations]

**From Architecture - Database Schema:**
```sql
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    server_url TEXT NOT NULL,
    username TEXT NOT NULL,
    password_encrypted BLOB NOT NULL,
    max_connections INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

[Source: architecture.md#Database Schema (SQLite)]

### Critical Technical Requirements

**Credential Storage Strategy:**

1. **Primary: OS Keychain via `keyring` crate**
   - Windows: Credential Manager
   - macOS: Keychain Services
   - Linux: Secret Service (GNOME Keyring, KWallet)

2. **Fallback: AES-256-GCM encryption**
   - Used when keyring is unavailable or fails
   - Key derived from machine-specific identifier
   - Encrypted data stored in `password_encrypted` column

**Keyring Crate Usage (v3.x):**
```rust
use keyring::Entry;

const SERVICE_NAME: &str = "iptv";

pub fn store_password(account_id: &str, password: &str) -> Result<(), keyring::Error> {
    let entry = Entry::new(SERVICE_NAME, account_id)?;
    entry.set_password(password)?;
    Ok(())
}

pub fn retrieve_password(account_id: &str) -> Result<String, keyring::Error> {
    let entry = Entry::new(SERVICE_NAME, account_id)?;
    entry.get_password()
}

pub fn delete_password(account_id: &str) -> Result<(), keyring::Error> {
    let entry = Entry::new(SERVICE_NAME, account_id)?;
    entry.delete_credential()?;
    Ok(())
}
```

**AES-256-GCM Fallback:**
```rust
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use rand::RngCore;

fn encrypt_password(password: &str, key: &[u8; 32]) -> Result<Vec<u8>, Error> {
    let cipher = Aes256Gcm::new_from_slice(key)?;
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher.encrypt(nonce, password.as_bytes())?;

    // Prepend nonce to ciphertext for storage
    let mut result = nonce_bytes.to_vec();
    result.extend(ciphertext);
    Ok(result)
}

fn decrypt_password(encrypted: &[u8], key: &[u8; 32]) -> Result<String, Error> {
    let cipher = Aes256Gcm::new_from_slice(key)?;
    let (nonce_bytes, ciphertext) = encrypted.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher.decrypt(nonce, ciphertext)?;
    Ok(String::from_utf8(plaintext)?)
}
```

**Machine-Derived Key for Fallback:**
- Derive from machine UUID/hostname + app-specific salt
- Store salt in app data directory (not the key itself)
- Key regenerated on each app launch from salt + machine info

### Database Migration

Create migration file at `src-tauri/migrations/YYYY-MM-DD-HHMMSS_create_accounts/up.sql`:

```sql
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    server_url TEXT NOT NULL,
    username TEXT NOT NULL,
    password_encrypted BLOB NOT NULL,
    max_connections INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_accounts_is_active ON accounts(is_active);
```

Note: SQLite uses INTEGER (0/1) for boolean and TEXT for timestamps.

### Tauri Commands Structure

```rust
// src-tauri/src/commands/accounts.rs

use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct AccountResponse {
    pub id: i32,
    pub name: String,
    pub server_url: String,
    pub username: String,
    pub max_connections: i32,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
    // NOTE: password is NEVER included in response
}

#[derive(Deserialize)]
pub struct AddAccountRequest {
    pub name: String,
    pub server_url: String,
    pub username: String,
    pub password: String,
}

#[tauri::command]
pub async fn add_account(
    state: tauri::State<'_, DbConnection>,
    request: AddAccountRequest,
) -> Result<AccountResponse, String> {
    // 1. Validate required fields
    // 2. Store password in keyring (or fallback)
    // 3. Insert account record (with encrypted blob for fallback)
    // 4. Return account without password
}

#[tauri::command]
pub async fn get_accounts(
    state: tauri::State<'_, DbConnection>,
) -> Result<Vec<AccountResponse>, String> {
    // Returns all accounts WITHOUT passwords
}
```

### Frontend TypeScript Types

```typescript
// src/lib/types.ts

export interface Account {
  id: number;
  name: string;
  serverUrl: string;
  username: string;
  maxConnections: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddAccountInput {
  name: string;
  serverUrl: string;
  username: string;
  password: string;
}
```

### Form Validation Rules

- **Account Name**: Required, 1-100 characters
- **Server URL**: Required, valid URL format (http:// or https://)
- **Username**: Required, 1-100 characters
- **Password**: Required, 1-500 characters

### Security Checklist

- [ ] Password NEVER appears in console.log or eprintln!
- [ ] Password NEVER returned in API responses
- [ ] Password NEVER stored in plaintext in database
- [ ] Use OS keychain when available
- [ ] AES-256-GCM for fallback (audited implementation)
- [ ] Nonce is unique per encryption (random 96-bit)
- [ ] Machine-derived key not stored directly

### Previous Story Intelligence

**From Story 1-6 (Auto-start):**
- Tauri commands pattern: `#[tauri::command]` with async
- Commands registered in `lib.rs` invoke_handler
- Error handling: return `Result<T, String>` with user-friendly messages
- Use `app.state::<DbConnection>()` for database access
- Use `thiserror` for custom error types

**From Story 1-2 (Database Setup):**
- Diesel migrations in `src-tauri/migrations/`
- Connection pool via `DbConnection` wrapper
- Models in `src-tauri/src/db/models/`
- Schema auto-generated in `src-tauri/src/db/schema.rs`

**From Story 1-3 (GUI Shell):**
- Views in `src/views/`
- Components in `src/components/`
- TanStack Query for data fetching
- Zustand for state management
- Router configured in `src/router.tsx`

**Learnings Applied:**
- Platform-specific code uses `#[cfg(...)]` guards
- Sanitize error messages (don't leak internal details)
- Use async/await pattern for Tauri commands
- Return clear, actionable error messages to frontend

### File Structure to Create/Modify

**New Files:**
- `src-tauri/migrations/YYYY-MM-DD-HHMMSS_create_accounts/up.sql`
- `src-tauri/migrations/YYYY-MM-DD-HHMMSS_create_accounts/down.sql`
- `src-tauri/src/credentials/mod.rs`
- `src-tauri/src/db/models/account.rs`
- `src-tauri/src/commands/accounts.rs`
- `src/components/accounts/AccountForm.tsx`
- `src/components/accounts/AccountsList.tsx`
- `src/components/accounts/index.ts`
- `src/lib/types.ts`

**Modified Files:**
- `src-tauri/Cargo.toml` - Add keyring, aes-gcm, rand, base64 dependencies
- `src-tauri/src/lib.rs` - Add credentials module, register account commands
- `src-tauri/src/db/mod.rs` - Export account model
- `src-tauri/src/db/models/mod.rs` - Export account model
- `src-tauri/src/commands/mod.rs` - Export account commands
- `src/views/Accounts.tsx` - Replace placeholder with real implementation
- `src/lib/tauri.ts` - Add account-related functions

### Testing Approach

**Rust Unit Tests:**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_password_encryption_roundtrip() {
        let key = [0u8; 32]; // Test key
        let password = "test_password_123";

        let encrypted = encrypt_password(password, &key).unwrap();
        let decrypted = decrypt_password(&encrypted, &key).unwrap();

        assert_eq!(password, decrypted);
    }
}
```

**E2E Tests:**
```typescript
// tests/e2e/accounts.spec.ts
test('can add new account', async ({ page }) => {
  await page.goto('/accounts');
  await page.click('[data-testid="add-account-button"]');

  await page.fill('[data-testid="account-name"]', 'My Provider');
  await page.fill('[data-testid="server-url"]', 'http://example.com:8080');
  await page.fill('[data-testid="username"]', 'testuser');
  await page.fill('[data-testid="password"]', 'testpass123');

  await page.click('[data-testid="submit-account"]');

  await expect(page.locator('[data-testid="account-list"]'))
    .toContainText('My Provider');
});
```

### Error Handling

```rust
#[derive(Debug, thiserror::Error)]
pub enum AccountError {
    #[error("Account name is required")]
    NameRequired,

    #[error("Server URL is required")]
    ServerUrlRequired,

    #[error("Invalid server URL format")]
    InvalidServerUrl,

    #[error("Username is required")]
    UsernameRequired,

    #[error("Password is required")]
    PasswordRequired,

    #[error("Failed to store credentials securely")]
    CredentialStorageError,

    #[error("Database error")]
    DatabaseError,

    #[error("Account not found")]
    NotFound,
}
```

### Performance Targets

- Account save: < 500ms (including keychain access)
- Account list load: < 100ms
- Form validation: < 50ms (client-side)

### References

- [Source: architecture.md#Security Considerations] - Credential storage requirements
- [Source: architecture.md#Database Schema (SQLite)] - Accounts table schema
- [Source: prd.md#Xtream Codes Integration] - FR1 requirements
- [Source: epics.md#Story 2.1] - Original acceptance criteria
- [Keyring crate](https://crates.io/crates/keyring) - v3.x documentation
- [aes-gcm crate](https://crates.io/crates/aes-gcm) - AES-256-GCM implementation

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
