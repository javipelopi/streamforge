# Story 2.2: Test Xtream Connection and Display Account Status

Status: ready-for-dev

## Story

As a user,
I want to test my Xtream connection and see account status,
So that I know my credentials are correct and when my subscription expires.

## Acceptance Criteria

1. **Given** an account exists
   **When** I click "Test Connection"
   **Then** the app attempts to authenticate with the Xtream API
   **And** a loading indicator is shown during the test

2. **Given** authentication succeeds
   **When** the API responds
   **Then** I see:
   - Connection status: "Connected"
   - Account expiry date
   - Maximum connections (tuner count)
   - Active connections count
   **And** this information is stored in the account record

3. **Given** authentication fails
   **When** the API responds with an error
   **Then** I see a clear error message explaining the failure
   **And** suggestions for common issues (wrong URL, credentials, server down)

## Tasks / Subtasks

- [ ] Task 1: Create Xtream API client module (AC: #1, #2, #3)
  - [ ] 1.1 Create `src-tauri/src/xtream/mod.rs` module structure
  - [ ] 1.2 Create `src-tauri/src/xtream/client.rs` with XtreamClient struct
  - [ ] 1.3 Create `src-tauri/src/xtream/types.rs` with API response types
  - [ ] 1.4 Implement `authenticate()` method to call `player_api.php?username=X&password=X`
  - [ ] 1.5 Parse authentication response (user_info, server_info)
  - [ ] 1.6 Handle HTTP errors, connection timeouts, and invalid JSON responses
  - [ ] 1.7 Add unit tests for response parsing

- [ ] Task 2: Create database migration for account status fields (AC: #2)
  - [ ] 2.1 Generate migration: `diesel migration generate add_account_status_fields`
  - [ ] 2.2 Add columns: `expiry_date TEXT`, `max_connections INTEGER`, `active_connections INTEGER`, `last_check TEXT`, `status TEXT`
  - [ ] 2.3 Run migration and verify schema.rs updates

- [ ] Task 3: Update Diesel models for account status (AC: #2)
  - [ ] 3.1 Update `Account` struct in `src-tauri/src/db/models.rs` with new fields
  - [ ] 3.2 Create `AccountStatusUpdate` struct for partial updates
  - [ ] 3.3 Add method to update account status fields

- [ ] Task 4: Implement test_connection Tauri command (AC: #1, #2, #3)
  - [ ] 4.1 Create `test_connection(account_id: i32)` command in `src-tauri/src/commands/accounts.rs`
  - [ ] 4.2 Retrieve account credentials (including password from keyring/fallback)
  - [ ] 4.3 Call XtreamClient::authenticate()
  - [ ] 4.4 On success: parse and store status info, return success response
  - [ ] 4.5 On failure: return user-friendly error message with suggestions
  - [ ] 4.6 Never log passwords during connection test

- [ ] Task 5: Create AccountStatusResponse type (AC: #2)
  - [ ] 5.1 Define response struct with: status, expiry_date, max_connections, active_connections, message
  - [ ] 5.2 Add TypeScript interface in `src/lib/tauri.ts`
  - [ ] 5.3 Add `testConnection()` function to tauri.ts

- [ ] Task 6: Update AccountsList component to show status (AC: #2)
  - [ ] 6.1 Add "Test Connection" button to each account row
  - [ ] 6.2 Show loading spinner during test
  - [ ] 6.3 Display connection status indicator (green checkmark/red X)
  - [ ] 6.4 Display expiry date, max connections, active connections on success
  - [ ] 6.5 Show error message with suggestions on failure

- [ ] Task 7: Create AccountStatus component (AC: #2, #3)
  - [ ] 7.1 Create `src/components/accounts/AccountStatus.tsx`
  - [ ] 7.2 Display status badge (Connected/Disconnected/Error)
  - [ ] 7.3 Display account info: expiry date, tuner count
  - [ ] 7.4 Display error messages with actionable suggestions

- [ ] Task 8: Add error handling and suggestions (AC: #3)
  - [ ] 8.1 Map common error codes to user-friendly messages
  - [ ] 8.2 Provide suggestions for: wrong URL format, invalid credentials, server unreachable, timeout
  - [ ] 8.3 Log errors to event_log table for diagnostics

- [ ] Task 9: Testing and verification (AC: #1, #2, #3)
  - [ ] 9.1 Run `cargo check` and `cargo clippy` - verify no warnings
  - [ ] 9.2 Run `pnpm exec tsc --noEmit` - verify TypeScript compiles
  - [ ] 9.3 Add E2E tests for test connection flow
  - [ ] 9.4 Add integration tests for Xtream API client (mock responses)
  - [ ] 9.5 Verify password is never logged during tests

## Dev Notes

### Architecture Compliance

This story implements FR2 and FR7 from the PRD, building on the account management from Story 2.1.

**From PRD:**
> FR2: System can connect to Xtream Codes API and authenticate
> FR7: User can test connection and see account status/expiry

[Source: _bmad-output/planning-artifacts/prd.md#Functional Requirements - Xtream Codes Integration]

**From Architecture - Xtream Client Module:**
```
xtream/
├── mod.rs           # Module exports
├── client.rs        # API client implementation
├── types.rs         # API response types
├── auth.rs          # Authentication handling
└── streams.rs       # Stream URL generation
```

[Source: _bmad-output/planning-artifacts/architecture.md#Core Modules - Xtream Client]

**From Architecture - Key Types:**
```rust
pub struct XtreamClient {
    http: reqwest::Client,
    config: XtreamConfig,
}

pub struct XtreamConfig {
    server_url: String,
    username: String,
    password: String,
}

impl XtreamClient {
    pub async fn authenticate(&self) -> Result<AccountInfo>;
    pub async fn get_live_streams(&self) -> Result<Vec<XtreamChannel>>;
    pub async fn get_stream_url(&self, stream_id: i32, quality: Quality) -> String;
}
```

[Source: _bmad-output/planning-artifacts/architecture.md#Core Modules - Xtream Client]

### Xtream Codes API Contract

**Authentication Endpoint:**
```
GET {server_url}/player_api.php?username={username}&password={password}
```

**Successful Response (JSON):**
```json
{
  "user_info": {
    "username": "testuser",
    "password": "testpass",
    "message": "...",
    "auth": 1,
    "status": "Active",
    "exp_date": "1735689600",
    "is_trial": "0",
    "active_cons": "0",
    "created_at": "1704067200",
    "max_connections": "2",
    "allowed_output_formats": ["m3u8", "ts"]
  },
  "server_info": {
    "url": "http://example.com",
    "port": "8080",
    "https_port": "443",
    "server_protocol": "http",
    "rtmp_port": "1935",
    "timestamp_now": 1704153600,
    "time_now": "2026-01-02 12:00:00",
    "timezone": "UTC"
  }
}
```

**Key Fields to Extract:**
- `user_info.auth`: 1 = authenticated, 0 = failed
- `user_info.status`: "Active", "Banned", "Disabled", "Expired"
- `user_info.exp_date`: Unix timestamp of expiry
- `user_info.max_connections`: Tuner count limit
- `user_info.active_cons`: Current active streams

**Failed Response:**
```json
{
  "user_info": {
    "auth": 0
  }
}
```

### Critical Technical Requirements

**XtreamClient Implementation:**
```rust
// src-tauri/src/xtream/client.rs

use reqwest::Client;
use crate::xtream::types::{XtreamAuthResponse, AccountInfo};

pub struct XtreamClient {
    http: Client,
    server_url: String,
    username: String,
    password: String,
}

impl XtreamClient {
    pub fn new(server_url: &str, username: &str, password: &str) -> Self {
        Self {
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .expect("Failed to create HTTP client"),
            server_url: server_url.to_string(),
            username: username.to_string(),
            password: password.to_string(),
        }
    }

    pub async fn authenticate(&self) -> Result<AccountInfo, XtreamError> {
        let url = format!(
            "{}/player_api.php?username={}&password={}",
            self.server_url.trim_end_matches('/'),
            &self.username,
            &self.password
        );

        let response = self.http.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(XtreamError::HttpError(response.status().as_u16()));
        }

        let auth_response: XtreamAuthResponse = response.json().await?;

        if auth_response.user_info.auth != 1 {
            return Err(XtreamError::AuthenticationFailed);
        }

        Ok(AccountInfo::from(auth_response))
    }
}
```

**Response Types:**
```rust
// src-tauri/src/xtream/types.rs

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Deserialize)]
pub struct XtreamAuthResponse {
    pub user_info: UserInfo,
    pub server_info: Option<ServerInfo>,
}

#[derive(Debug, Deserialize)]
pub struct UserInfo {
    pub username: String,
    pub auth: i32,
    pub status: Option<String>,
    pub exp_date: Option<String>,  // Unix timestamp as string
    pub max_connections: Option<String>,  // Number as string
    pub active_cons: Option<String>,  // Number as string
    pub is_trial: Option<String>,
    pub created_at: Option<String>,
    pub allowed_output_formats: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct ServerInfo {
    pub url: Option<String>,
    pub port: Option<String>,
    pub https_port: Option<String>,
    pub server_protocol: Option<String>,
    pub timestamp_now: Option<i64>,
    pub timezone: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AccountInfo {
    pub is_authenticated: bool,
    pub status: String,
    pub expiry_date: Option<DateTime<Utc>>,
    pub max_connections: i32,
    pub active_connections: i32,
    pub is_trial: bool,
}

impl From<XtreamAuthResponse> for AccountInfo {
    fn from(response: XtreamAuthResponse) -> Self {
        let user = response.user_info;

        let expiry_date = user.exp_date
            .and_then(|s| s.parse::<i64>().ok())
            .map(|ts| DateTime::from_timestamp(ts, 0))
            .flatten();

        let max_connections = user.max_connections
            .and_then(|s| s.parse::<i32>().ok())
            .unwrap_or(1);

        let active_connections = user.active_cons
            .and_then(|s| s.parse::<i32>().ok())
            .unwrap_or(0);

        let is_trial = user.is_trial
            .map(|s| s == "1")
            .unwrap_or(false);

        AccountInfo {
            is_authenticated: user.auth == 1,
            status: user.status.unwrap_or_else(|| "Unknown".to_string()),
            expiry_date,
            max_connections,
            active_connections,
            is_trial,
        }
    }
}
```

**Error Handling:**
```rust
// src-tauri/src/xtream/mod.rs

use thiserror::Error;

#[derive(Debug, Error)]
pub enum XtreamError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("HTTP error: status {0}")]
    HttpError(u16),

    #[error("Authentication failed - check username and password")]
    AuthenticationFailed,

    #[error("Invalid server response")]
    InvalidResponse,

    #[error("Connection timeout - server may be unreachable")]
    Timeout,

    #[error("Invalid server URL")]
    InvalidUrl,
}

impl XtreamError {
    pub fn user_message(&self) -> String {
        match self {
            Self::Network(_) => "Cannot connect to server. Check your internet connection.".into(),
            Self::HttpError(code) => format!("Server returned error (HTTP {})", code),
            Self::AuthenticationFailed => "Invalid username or password.".into(),
            Self::InvalidResponse => "Server returned unexpected data format.".into(),
            Self::Timeout => "Connection timed out. Server may be offline or unreachable.".into(),
            Self::InvalidUrl => "Invalid server URL format.".into(),
        }
    }

    pub fn suggestions(&self) -> Vec<String> {
        match self {
            Self::Network(_) | Self::Timeout => vec![
                "Check your internet connection".into(),
                "Verify the server URL is correct".into(),
                "The server may be temporarily down".into(),
            ],
            Self::AuthenticationFailed => vec![
                "Double-check your username and password".into(),
                "Ensure your subscription is active".into(),
                "Contact your provider if issues persist".into(),
            ],
            Self::HttpError(code) if *code >= 500 => vec![
                "Server is experiencing issues".into(),
                "Try again later".into(),
            ],
            Self::HttpError(_) => vec![
                "Check the server URL is correct".into(),
                "Ensure you're using the right port".into(),
            ],
            Self::InvalidResponse => vec![
                "The server may not be an Xtream Codes server".into(),
                "Verify the server URL".into(),
            ],
            Self::InvalidUrl => vec![
                "Server URL should start with http:// or https://".into(),
                "Include the port number if required".into(),
            ],
        }
    }
}
```

### Database Migration

**Migration file:** `src-tauri/migrations/YYYY-MM-DD-HHMMSS_add_account_status_fields/up.sql`
```sql
ALTER TABLE accounts ADD COLUMN expiry_date TEXT;
ALTER TABLE accounts ADD COLUMN max_connections_actual INTEGER;
ALTER TABLE accounts ADD COLUMN active_connections INTEGER DEFAULT 0;
ALTER TABLE accounts ADD COLUMN last_check TEXT;
ALTER TABLE accounts ADD COLUMN connection_status TEXT DEFAULT 'unknown';
```

Note: SQLite does not support adding multiple columns in one ALTER TABLE statement, so each column requires a separate statement.

**down.sql:**
```sql
-- SQLite doesn't support DROP COLUMN prior to 3.35.0
-- For compatibility, we'll create a new table and migrate data
CREATE TABLE accounts_backup AS SELECT
    id, name, server_url, username, password_encrypted, max_connections, is_active, created_at, updated_at
FROM accounts;
DROP TABLE accounts;
ALTER TABLE accounts_backup RENAME TO accounts;
```

### Tauri Command Implementation

```rust
// In src-tauri/src/commands/accounts.rs

use crate::xtream::{XtreamClient, XtreamError, AccountInfo};
use crate::credentials;

#[derive(Serialize)]
pub struct TestConnectionResponse {
    pub success: bool,
    pub status: Option<String>,
    pub expiry_date: Option<String>,
    pub max_connections: Option<i32>,
    pub active_connections: Option<i32>,
    pub error_message: Option<String>,
    pub suggestions: Option<Vec<String>>,
}

#[tauri::command]
pub async fn test_connection(
    state: tauri::State<'_, DbConnection>,
    account_id: i32,
) -> Result<TestConnectionResponse, String> {
    // 1. Load account from database
    let account = get_account_by_id(&state, account_id)
        .map_err(|e| format!("Account not found: {}", e))?;

    // 2. Retrieve password from keyring/fallback
    let password = credentials::retrieve_password(&account_id.to_string())
        .map_err(|_| "Failed to retrieve credentials".to_string())?;

    // 3. Create Xtream client and authenticate
    let client = XtreamClient::new(&account.server_url, &account.username, &password);

    match client.authenticate().await {
        Ok(info) => {
            // 4. Update account record with status info
            update_account_status(&state, account_id, &info)
                .map_err(|e| format!("Failed to save status: {}", e))?;

            Ok(TestConnectionResponse {
                success: true,
                status: Some(info.status),
                expiry_date: info.expiry_date.map(|d| d.to_rfc3339()),
                max_connections: Some(info.max_connections),
                active_connections: Some(info.active_connections),
                error_message: None,
                suggestions: None,
            })
        }
        Err(e) => {
            Ok(TestConnectionResponse {
                success: false,
                status: None,
                expiry_date: None,
                max_connections: None,
                active_connections: None,
                error_message: Some(e.user_message()),
                suggestions: Some(e.suggestions()),
            })
        }
    }
}
```

### Frontend TypeScript Types

```typescript
// Add to src/lib/tauri.ts

export interface TestConnectionResponse {
  success: boolean;
  status?: string;
  expiryDate?: string;  // ISO 8601 format
  maxConnections?: number;
  activeConnections?: number;
  errorMessage?: string;
  suggestions?: string[];
}

export async function testConnection(accountId: number): Promise<TestConnectionResponse> {
  return invoke<TestConnectionResponse>("test_connection", { accountId });
}
```

### UI Component Structure

```tsx
// src/components/accounts/AccountStatus.tsx

interface AccountStatusProps {
  accountId: number;
  status?: string;
  expiryDate?: string;
  maxConnections?: number;
  activeConnections?: number;
}

export function AccountStatus({
  accountId,
  status,
  expiryDate,
  maxConnections,
  activeConnections,
}: AccountStatusProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);

  const handleTestConnection = async () => {
    setIsLoading(true);
    try {
      const result = await testConnection(accountId);
      setTestResult(result);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Button onClick={handleTestConnection} disabled={isLoading}>
        {isLoading ? <Spinner /> : "Test Connection"}
      </Button>

      {testResult?.success && (
        <div className="flex items-center gap-2">
          <CheckCircle className="text-green-500" />
          <span>Connected</span>
          <span className="text-sm text-gray-500">
            Expires: {formatDate(testResult.expiryDate)}
          </span>
          <span className="text-sm text-gray-500">
            Tuners: {testResult.activeConnections}/{testResult.maxConnections}
          </span>
        </div>
      )}

      {testResult && !testResult.success && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-red-500">
            <XCircle />
            <span>{testResult.errorMessage}</span>
          </div>
          {testResult.suggestions && (
            <ul className="text-sm text-gray-500 list-disc list-inside">
              {testResult.suggestions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

### Previous Story Intelligence

**From Story 2-1 Implementation:**
- Credentials module at `src-tauri/src/credentials/mod.rs` with keyring + AES-256-GCM fallback
- Account model at `src-tauri/src/db/models.rs` with Account and NewAccount structs
- Commands at `src-tauri/src/commands/accounts.rs` with add_account, get_accounts, delete_account
- Frontend at `src/components/accounts/` with AccountForm.tsx and AccountsList.tsx
- URL validation using `url` crate for proper parsing
- HKDF-SHA256 for secure key derivation (fixed in code review)

**Key Patterns to Follow:**
- Commands use `Result<T, String>` return type with user-friendly error messages
- Use `thiserror` for custom error types with `user_message()` method
- Validate inputs before processing
- Never log passwords or sensitive data
- Use async/await pattern for network calls

**Files Created in Story 2-1:**
- `src-tauri/src/credentials/mod.rs`
- `src-tauri/src/commands/accounts.rs`
- `src/components/accounts/AccountForm.tsx`
- `src/components/accounts/AccountsList.tsx`

### File Structure to Create/Modify

**New Files:**
- `src-tauri/src/xtream/mod.rs`
- `src-tauri/src/xtream/client.rs`
- `src-tauri/src/xtream/types.rs`
- `src-tauri/migrations/YYYY-MM-DD-HHMMSS_add_account_status_fields/up.sql`
- `src-tauri/migrations/YYYY-MM-DD-HHMMSS_add_account_status_fields/down.sql`
- `src/components/accounts/AccountStatus.tsx`

**Modified Files:**
- `src-tauri/src/lib.rs` - Add xtream module, register test_connection command
- `src-tauri/src/db/models.rs` - Add status fields to Account struct
- `src-tauri/src/db/schema.rs` - Auto-updated by Diesel
- `src-tauri/src/commands/accounts.rs` - Add test_connection command
- `src-tauri/src/commands/mod.rs` - Export test_connection
- `src/components/accounts/AccountsList.tsx` - Add Test Connection button and status display
- `src/lib/tauri.ts` - Add testConnection function and types

### Security Checklist

- [ ] Password retrieved from keyring/fallback for API call
- [ ] Password NEVER logged during test_connection
- [ ] Password NEVER returned in response
- [ ] URL validated before making request
- [ ] HTTP timeouts configured (10 seconds)
- [ ] Error messages don't leak internal details

### Performance Targets

- Connection test: < 10 seconds timeout
- UI responsiveness: Immediate loading state, no blocking
- Status update: < 500ms after API response

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Core Modules - Xtream Client]
- [Source: _bmad-output/planning-artifacts/architecture.md#Technology Stack]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2]
- [Source: _bmad-output/planning-artifacts/prd.md#Xtream Codes Integration]
- [Xtream Codes API Documentation](https://xtream-ui.org/api-xtreamui-xtreamcode/)
- [Previous Story 2-1 Implementation](_bmad-output/implementation-artifacts/2-1-add-xtream-account-with-secure-credential-storage.md)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
