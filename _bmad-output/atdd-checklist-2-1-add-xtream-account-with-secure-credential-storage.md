# ATDD Checklist - Epic 2, Story 1: Add Xtream Account with Secure Credential Storage

**Date:** 2026-01-19
**Author:** Javier
**Primary Test Level:** E2E

---

## Story Summary

User can add Xtream Codes account credentials through a form interface with secure password storage using OS keychain or AES-256-GCM encryption fallback.

**As a** user
**I want** to add my Xtream Codes account credentials securely
**So that** the app can connect to my IPTV provider

---

## Acceptance Criteria

1. **Account Form Display**: When user clicks "Add Account", a form appears with fields for account name, server URL, username, and password
2. **Secure Storage**: Password is encrypted using OS keychain (or AES-256-GCM fallback), account is saved to database, password is never logged or displayed in plaintext
3. **Form Validation**: Invalid/empty required fields show appropriate error messages and prevent submission

---

## Failing Tests Created (RED Phase)

### E2E Tests (11 tests)

**File:** `tests/e2e/accounts.spec.ts` (298 lines)

- ✅ **Test:** should display account form when Add Account button is clicked
  - **Status:** RED - Missing AccountForm component and "Add Account" button
  - **Verifies:** AC#1 - Form appears with all required fields

- ✅ **Test:** should show validation error when account name is empty
  - **Status:** RED - Missing form validation logic
  - **Verifies:** AC#3 - Validation for required account name field

- ✅ **Test:** should show validation error when server URL is empty
  - **Status:** RED - Missing form validation logic
  - **Verifies:** AC#3 - Validation for required server URL field

- ✅ **Test:** should show validation error when server URL format is invalid
  - **Status:** RED - Missing URL format validation
  - **Verifies:** AC#3 - Validation for URL format

- ✅ **Test:** should show validation error when username is empty
  - **Status:** RED - Missing form validation logic
  - **Verifies:** AC#3 - Validation for required username field

- ✅ **Test:** should show validation error when password is empty
  - **Status:** RED - Missing form validation logic
  - **Verifies:** AC#3 - Validation for required password field

- ✅ **Test:** should successfully add account with valid credentials
  - **Status:** RED - Missing add_account Tauri command and AccountsList component
  - **Verifies:** AC#1, AC#2 - Account creation and display in list

- ✅ **Test:** should not display password in accounts list
  - **Status:** RED - Missing security implementation
  - **Verifies:** AC#2 - Password is never displayed in plaintext

- ✅ **Test:** should clear form after successful submission
  - **Status:** RED - Missing form reset logic
  - **Verifies:** Form UX behavior

- ✅ **Test:** should display loading state during account submission
  - **Status:** RED - Missing loading state UI
  - **Verifies:** Form UX feedback

- ✅ **Test:** should show empty state when no accounts exist
  - **Status:** RED - Missing empty state UI
  - **Verifies:** Accounts list empty state

### Integration Tests (15 tests)

**File:** `tests/integration/accounts.spec.ts` (354 lines)

- ✅ **Test:** add_account command should create account with encrypted password
  - **Status:** RED - Missing add_account Tauri command implementation
  - **Verifies:** AC#2 - Account creation and password encryption

- ✅ **Test:** add_account command should reject empty name
  - **Status:** RED - Missing backend validation
  - **Verifies:** AC#3 - Backend validation for name field

- ✅ **Test:** add_account command should reject empty server URL
  - **Status:** RED - Missing backend validation
  - **Verifies:** AC#3 - Backend validation for server URL field

- ✅ **Test:** add_account command should reject invalid server URL format
  - **Status:** RED - Missing backend URL validation
  - **Verifies:** AC#3 - Backend URL format validation

- ✅ **Test:** add_account command should reject empty username
  - **Status:** RED - Missing backend validation
  - **Verifies:** AC#3 - Backend validation for username field

- ✅ **Test:** add_account command should reject empty password
  - **Status:** RED - Missing backend validation
  - **Verifies:** AC#3 - Backend validation for password field

- ✅ **Test:** get_accounts command should return list of accounts without passwords
  - **Status:** RED - Missing get_accounts Tauri command
  - **Verifies:** AC#2 - Accounts retrieval without passwords

- ✅ **Test:** get_accounts command should return empty array when no accounts exist
  - **Status:** RED - Missing get_accounts Tauri command
  - **Verifies:** Empty state handling

- ✅ **Test:** delete_account command should remove account from database
  - **Status:** RED - Missing delete_account Tauri command
  - **Verifies:** Account deletion functionality

- ✅ **Test:** delete_account command should also delete stored credentials
  - **Status:** RED - Missing credential cleanup in deletion
  - **Verifies:** AC#2 - Credential storage cleanup

- ✅ **Test:** should never log password in console
  - **Status:** RED - Security verification needed
  - **Verifies:** AC#2 - Password is never logged

- ✅ **Test:** should store password encrypted in database
  - **Status:** RED - Missing encryption implementation
  - **Verifies:** AC#2 - Password encryption in database

---

## Data Factories Created

### Account Factory

**File:** `tests/support/factories/account.factory.ts`

**Exports:**

- `createAccountInput(overrides?)` - Create random account input data for submission
- `createAccountInputs(count)` - Create array of random account inputs
- `createAccount(overrides?)` - Create mock account response (as returned from backend)
- `createAccounts(count)` - Create array of mock accounts
- `createInvalidAccountInput(field)` - Create account input with specific validation failure
- `createAccountInputWithInvalidUrl()` - Create account input with invalid URL format

**Example Usage:**

```typescript
import { createAccountInput, createInvalidAccountInput } from './factories/account.factory';

// Create random account with all valid data
const account = createAccountInput();

// Create account with specific name
const namedAccount = createAccountInput({ name: 'My Provider' });

// Create account with empty name for validation testing
const invalidAccount = createInvalidAccountInput('name');

// Generate 10 random accounts for bulk testing
const accounts = createAccountInputs(10);
```

---

## Fixtures Created

### Account Fixtures

**File:** `tests/support/fixtures/accounts.fixture.ts`

**Fixtures:**

- `testAccount` - Creates a random account and provides it to the test with auto-cleanup
  - **Setup:** Generates random data, calls add_account Tauri command
  - **Provides:** Complete Account object to test
  - **Cleanup:** Calls delete_account to remove created account

- `createAccount` - Factory function for creating accounts with custom data
  - **Setup:** Accepts partial AccountInput, creates account via Tauri command
  - **Provides:** Factory function that returns Account
  - **Cleanup:** Tracks all created accounts, deletes them after test

- `accountInput` - Provides random account input data without creating account
  - **Setup:** Generates random AccountInput using factory
  - **Provides:** AccountInput object
  - **Cleanup:** None (no account created)

**Example Usage:**

```typescript
import { test, expect } from './fixtures/accounts.fixture';

test('should work with existing account', async ({ testAccount }) => {
  // testAccount is created and ready to use
  expect(testAccount.id).toBeDefined();
  // Automatically cleaned up after test
});

test('should create multiple accounts', async ({ createAccount }) => {
  const account1 = await createAccount({ name: 'Provider 1' });
  const account2 = await createAccount({ name: 'Provider 2' });
  // Both automatically cleaned up after test
});

test('should validate input', async ({ accountInput }) => {
  // accountInput contains random data but no account created
  expect(accountInput.name).toBeDefined();
});
```

---

## Mock Requirements

### Tauri Command API Mock (for isolated frontend testing - optional)

**Commands to mock:**

1. **add_account**
   - **Input:** `{ name: string, serverUrl: string, username: string, password: string }`
   - **Success Response:** `{ id: number, name: string, serverUrl: string, username: string, maxConnections: number, isActive: boolean, createdAt: string, updatedAt: string }`
   - **Error Responses:**
     - `"Account name is required"` (empty name)
     - `"Server URL is required"` (empty serverUrl)
     - `"Invalid server URL format"` (invalid URL)
     - `"Username is required"` (empty username)
     - `"Password is required"` (empty password)

2. **get_accounts**
   - **Input:** None
   - **Success Response:** `Account[]` (array of accounts without passwords)

3. **delete_account**
   - **Input:** `{ id: number }`
   - **Success Response:** None (void)
   - **Error Response:** `"Account not found"`

**Note:** Full integration tests use real Tauri commands, but mocks can be used for faster frontend component testing.

---

## Required data-testid Attributes

### Accounts View

- `add-account-button` - Button to open account form

### Account Form Component

- `account-form` - Form container
- `account-name-input` - Account name input field
- `account-name-error` - Error message for account name
- `server-url-input` - Server URL input field
- `server-url-error` - Error message for server URL
- `username-input` - Username input field
- `username-error` - Error message for username
- `password-input` - Password input field (type="password")
- `password-error` - Error message for password
- `submit-account-button` - Form submit button

### Accounts List Component

- `accounts-list` - Container for accounts list
- `accounts-empty-state` - Empty state message when no accounts
- `account-item` - Individual account item in list (repeatable)

**Implementation Example:**

```tsx
// AccountForm.tsx
<form data-testid="account-form">
  <input
    data-testid="account-name-input"
    type="text"
    name="name"
  />
  <span data-testid="account-name-error">{nameError}</span>

  <input
    data-testid="server-url-input"
    type="text"
    name="serverUrl"
  />
  <span data-testid="server-url-error">{urlError}</span>

  <input
    data-testid="username-input"
    type="text"
    name="username"
  />
  <span data-testid="username-error">{usernameError}</span>

  <input
    data-testid="password-input"
    type="password"
    name="password"
  />
  <span data-testid="password-error">{passwordError}</span>

  <button data-testid="submit-account-button" type="submit">
    Add Account
  </button>
</form>

// AccountsList.tsx
<div data-testid="accounts-list">
  {accounts.length === 0 ? (
    <div data-testid="accounts-empty-state">No accounts yet</div>
  ) : (
    accounts.map(account => (
      <div key={account.id} data-testid="account-item">
        {account.name} - {account.serverUrl}
      </div>
    ))
  )}
</div>
```

---

## Implementation Checklist

### Test: should display account form when Add Account button is clicked

**File:** `tests/e2e/accounts.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/components/accounts/AccountForm.tsx` component
- [ ] Create account form with name, serverUrl, username, password fields
- [ ] Add data-testid attributes: `account-form`, `account-name-input`, `server-url-input`, `username-input`, `password-input`, `submit-account-button`
- [ ] Add "Add Account" button to Accounts view with data-testid="add-account-button"
- [ ] Implement modal/dialog to show form when button clicked
- [ ] Run test: `pnpm test:e2e -- accounts.spec.ts -g "should display account form"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: Form validation tests (5 tests)

**File:** `tests/e2e/accounts.spec.ts`

**Tasks to make these tests pass:**

- [ ] Add client-side validation to AccountForm component
- [ ] Validate name is not empty, show error with data-testid="account-name-error"
- [ ] Validate serverUrl is not empty, show error with data-testid="server-url-error"
- [ ] Validate serverUrl format (starts with http:// or https://), show URL format error
- [ ] Validate username is not empty, show error with data-testid="username-error"
- [ ] Validate password is not empty, show error with data-testid="password-error"
- [ ] Prevent form submission when validation fails
- [ ] Run test: `pnpm test:e2e -- accounts.spec.ts -g "validation"`
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 2 hours

---

### Test: Backend Tauri commands (add_account, get_accounts, delete_account)

**File:** `tests/integration/accounts.spec.ts`

**Tasks to make these tests pass:**

- [ ] Create database migration: `diesel migration generate create_accounts`
- [ ] Implement accounts table schema in migration up.sql
- [ ] Run migration: `diesel migration run`
- [ ] Add dependencies to Cargo.toml: keyring, aes-gcm, rand, base64
- [ ] Create `src-tauri/src/credentials/mod.rs` module
- [ ] Implement `store_password()`, `retrieve_password()`, `delete_password()` functions
- [ ] Implement OS keychain storage using keyring crate
- [ ] Implement AES-256-GCM fallback encryption
- [ ] Create `src-tauri/src/db/models/account.rs` with Account and NewAccount structs
- [ ] Create `src-tauri/src/commands/accounts.rs`
- [ ] Implement `add_account` command with validation and password encryption
- [ ] Implement `get_accounts` command (returns accounts WITHOUT passwords)
- [ ] Implement `delete_account` command with credential cleanup
- [ ] Register commands in lib.rs invoke_handler
- [ ] Add unit tests for credential storage encryption/decryption
- [ ] Run test: `pnpm test:integration -- accounts.spec.ts`
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 6 hours

---

### Test: should successfully add account with valid credentials

**File:** `tests/e2e/accounts.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/components/accounts/AccountsList.tsx` component
- [ ] Integrate AccountsList into Accounts view
- [ ] Add data-testid="accounts-list" to list container
- [ ] Add data-testid="account-item" to each account in list
- [ ] Display account name, serverUrl, username (NOT password)
- [ ] Create `src/lib/tauri.ts` functions for accounts (addAccount, getAccounts, deleteAccount)
- [ ] Wire AccountForm submit to call addAccount() via Tauri
- [ ] Use TanStack Query for data fetching and cache invalidation
- [ ] Show toast notification on successful account creation
- [ ] Run test: `pnpm test:e2e -- accounts.spec.ts -g "successfully add account"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 3 hours

---

### Test: should not display password in accounts list

**File:** `tests/e2e/accounts.spec.ts`

**Tasks to make this test pass:**

- [ ] Verify AccountResponse struct does NOT include password field
- [ ] Verify get_accounts Tauri command excludes password from response
- [ ] Verify AccountsList component does NOT render password
- [ ] Add security checklist verification: password never in console logs
- [ ] Run test: `pnpm test:e2e -- accounts.spec.ts -g "not display password"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: should clear form after successful submission

**File:** `tests/e2e/accounts.spec.ts`

**Tasks to make this test pass:**

- [ ] Add form reset logic to AccountForm component
- [ ] Clear all input fields after successful submission
- [ ] Close modal/dialog after success (or keep open with cleared form)
- [ ] Run test: `pnpm test:e2e -- accounts.spec.ts -g "clear form"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: should display loading state during account submission

**File:** `tests/e2e/accounts.spec.ts`

**Tasks to make this test pass:**

- [ ] Add loading state to AccountForm component
- [ ] Disable submit button during submission
- [ ] Show loading spinner or text on button during submission
- [ ] Re-enable button after submission completes (success or error)
- [ ] Run test: `pnpm test:e2e -- accounts.spec.ts -g "loading state"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: should show empty state when no accounts exist

**File:** `tests/e2e/accounts.spec.ts`

**Tasks to make this test pass:**

- [ ] Add empty state to AccountsList component
- [ ] Show message with data-testid="accounts-empty-state" when accounts array is empty
- [ ] Display helpful text like "No accounts yet. Click Add Account to get started."
- [ ] Run test: `pnpm test:e2e -- accounts.spec.ts -g "empty state"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: Credential storage security tests

**File:** `tests/integration/accounts.spec.ts`

**Tasks to make these tests pass:**

- [ ] Remove all console.log statements that might log password
- [ ] Use eprintln! for error logging, never log password in Rust code
- [ ] Verify password is never in console during test execution
- [ ] Add Rust unit tests for encryption roundtrip
- [ ] Add Rust unit tests for keyring storage (with fallback)
- [ ] Test AES-256-GCM encryption with unique nonces
- [ ] Run test: `pnpm test:integration -- accounts.spec.ts -g "security"`
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 2 hours

---

## Running Tests

```bash
# Run all failing tests for this story
pnpm test

# Run E2E tests only
pnpm test:e2e -- accounts.spec.ts

# Run integration tests only
pnpm test:integration -- accounts.spec.ts

# Run specific test by name
pnpm test:e2e -- accounts.spec.ts -g "should display account form"

# Run tests in headed mode (see browser)
pnpm test:e2e -- accounts.spec.ts --headed

# Debug specific test
pnpm test:e2e -- accounts.spec.ts --debug

# Run tests with coverage
pnpm test -- --coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All tests written and failing (26 tests total)
- ✅ Fixtures and factories created with auto-cleanup
- ✅ Mock requirements documented
- ✅ data-testid requirements listed
- ✅ Implementation checklist created

**Verification:**

- All tests run and fail as expected
- Failure messages are clear and actionable
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (recommend starting with form display test)
2. **Read the test** to understand expected behavior
3. **Implement minimal code** to make that specific test pass
4. **Run the test** to verify it now passes (green)
5. **Check off the task** in implementation checklist
6. **Move to next test** and repeat

**Key Principles:**

- One test at a time (don't try to fix all at once)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap

**Progress Tracking:**

- Check off tasks as you complete them
- Share progress in daily standup
- Mark story as IN PROGRESS in sprint-status.yaml

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
2. **Review code for quality** (readability, maintainability, performance)
3. **Extract duplications** (DRY principle)
4. **Optimize performance** (if needed)
5. **Ensure tests still pass** after each refactor
6. **Update documentation** (if API contracts change)

**Key Principles:**

- Tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if tests fail)
- Run tests after each change
- Don't change test behavior (only implementation)

**Completion:**

- All tests pass
- Code quality meets team standards
- No duplications or code smells
- Ready for code review and story approval

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow (manual handoff)
2. **Review this checklist** with team in standup or planning
3. **Run failing tests** to confirm RED phase: `pnpm test`
4. **Begin implementation** using implementation checklist as guide
5. **Work one test at a time** (red → green for each)
6. **Share progress** in daily standup
7. **When all tests pass**, refactor code for quality
8. **When refactoring complete**, manually update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **fixture-architecture.md** - Test fixture patterns with setup/teardown and auto-cleanup using Playwright's `test.extend()`
- **data-factories.md** - Factory patterns using `@faker-js/faker` for random test data generation with overrides support
- **test-quality.md** - Test design principles (Given-When-Then, one assertion per test, determinism, isolation)
- **selector-resilience.md** - data-testid selector patterns for stable tests
- **test-levels-framework.md** - Test level selection framework (E2E vs API vs Component vs Unit)

See `_bmad/bmm/testarch/tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm test`

**Expected Results:**

```
Running 26 tests using 1 worker

E2E Tests - accounts.spec.ts
  Add Xtream Account
    ✗ should display account form when Add Account button is clicked
      Error: Locator not found: [data-testid="add-account-button"]

    ✗ should show validation error when account name is empty
      Error: Locator not found: [data-testid="add-account-button"]

    ✗ should show validation error when server URL is empty
      Error: Locator not found: [data-testid="add-account-button"]

    ✗ should show validation error when server URL format is invalid
      Error: Locator not found: [data-testid="add-account-button"]

    ✗ should show validation error when username is empty
      Error: Locator not found: [data-testid="add-account-button"]

    ✗ should show validation error when password is empty
      Error: Locator not found: [data-testid="add-account-button"]

    ✗ should successfully add account with valid credentials
      Error: Locator not found: [data-testid="add-account-button"]

    ✗ should not display password in accounts list
      Error: Locator not found: [data-testid="add-account-button"]

    ✗ should clear form after successful submission
      Error: Locator not found: [data-testid="add-account-button"]

    ✗ should display loading state during account submission
      Error: Locator not found: [data-testid="add-account-button"]

  Accounts List Display
    ✗ should show empty state when no accounts exist
      Error: Locator not found: [data-testid="accounts-empty-state"]

Integration Tests - accounts.spec.ts
  Account Tauri Commands
    ✗ add_account command should create account with encrypted password
      Error: window.__TAURI__ is undefined or invoke function not found

    ✗ add_account command should reject empty name
      Error: window.__TAURI__ is undefined or invoke function not found

    ✗ add_account command should reject empty server URL
      Error: window.__TAURI__ is undefined or invoke function not found

    ✗ add_account command should reject invalid server URL format
      Error: window.__TAURI__ is undefined or invoke function not found

    ✗ add_account command should reject empty username
      Error: window.__TAURI__ is undefined or invoke function not found

    ✗ add_account command should reject empty password
      Error: window.__TAURI__ is undefined or invoke function not found

    ✗ get_accounts command should return list of accounts without passwords
      Error: window.__TAURI__ is undefined or invoke function not found

    ✗ get_accounts command should return empty array when no accounts exist
      Error: window.__TAURI__ is undefined or invoke function not found

    ✗ delete_account command should remove account from database
      Error: window.__TAURI__ is undefined or invoke function not found

    ✗ delete_account command should also delete stored credentials
      Error: window.__TAURI__ is undefined or invoke function not found

  Credential Storage Security
    ✗ should never log password in console
      Error: window.__TAURI__ is undefined or invoke function not found

    ✗ should store password encrypted in database
      Error: window.__TAURI__ is undefined or invoke function not found

26 failed
```

**Summary:**

- Total tests: 26
- Passing: 0 (expected)
- Failing: 26 (expected)
- Status: ✅ RED phase verified

**Expected Failure Messages:**

1. E2E tests fail because UI components don't exist yet (AccountForm, AccountsList, Add Account button)
2. Integration tests fail because Tauri commands not implemented (add_account, get_accounts, delete_account)
3. This is the expected RED state - all tests fail due to missing implementation

---

## Notes

- **Security is critical**: Password must NEVER appear in logs, console output, or API responses
- **OS keychain is preferred**: Use keyring crate for secure storage, fallback to AES-256-GCM only if keyring fails
- **Database schema**: Use SQLite with BLOB for encrypted password storage (for fallback mode)
- **Nonce uniqueness**: Always generate unique random nonce for each AES-256-GCM encryption
- **Machine-derived key**: For fallback encryption, derive key from machine UUID + app salt (stored in app data dir)
- **Error messages**: Return user-friendly validation errors, don't leak internal details
- **Test data cleanup**: All fixtures automatically delete created accounts - no manual cleanup needed
- **Faker usage**: All test data is randomly generated to avoid collisions and hardcoded dependencies

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Tag @tea agent in Slack/Discord
- Refer to `./_bmad/bmm/docs/tea-README.md` for workflow documentation
- Consult `./_bmad/bmm/testarch/knowledge` for testing best practices

---

**Generated by BMad TEA Agent** - 2026-01-19
