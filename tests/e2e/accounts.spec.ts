import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Story 2.1: Add Xtream Account with Secure Credential Storage
 *
 * Tests the complete user journey of adding an Xtream Codes account through the UI,
 * including form display, validation, submission, and secure storage.
 */

test.describe('Add Xtream Account', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: User navigates to Accounts view
    await page.goto('/accounts');
  });

  test('should display account form when Add Account button is clicked', async ({ page }) => {
    // GIVEN: User is on the Accounts view

    // WHEN: User clicks "Add Account" button
    await page.click('[data-testid="add-account-button"]');

    // THEN: Account form appears with all required fields
    await expect(page.locator('[data-testid="account-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="account-name-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="server-url-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="username-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="submit-account-button"]')).toBeVisible();
  });

  test('should show validation error when account name is empty', async ({ page }) => {
    // GIVEN: User opens account form
    await page.click('[data-testid="add-account-button"]');

    // WHEN: User submits form without entering account name
    await page.fill('[data-testid="server-url-input"]', 'http://example.com:8080');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    await page.click('[data-testid="submit-account-button"]');

    // THEN: Validation error is shown for account name
    await expect(page.locator('[data-testid="account-name-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="account-name-error"]')).toContainText('required');
  });

  test('should show validation error when server URL is empty', async ({ page }) => {
    // GIVEN: User opens account form
    await page.click('[data-testid="add-account-button"]');

    // WHEN: User submits form without entering server URL
    await page.fill('[data-testid="account-name-input"]', 'My IPTV Provider');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    await page.click('[data-testid="submit-account-button"]');

    // THEN: Validation error is shown for server URL
    await expect(page.locator('[data-testid="server-url-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="server-url-error"]')).toContainText('required');
  });

  test('should show validation error when server URL format is invalid', async ({ page }) => {
    // GIVEN: User opens account form
    await page.click('[data-testid="add-account-button"]');

    // WHEN: User enters invalid URL format
    await page.fill('[data-testid="account-name-input"]', 'My IPTV Provider');
    await page.fill('[data-testid="server-url-input"]', 'not-a-valid-url');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    await page.click('[data-testid="submit-account-button"]');

    // THEN: Validation error is shown for URL format
    await expect(page.locator('[data-testid="server-url-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="server-url-error"]')).toContainText('valid URL');
  });

  test('should show validation error when username is empty', async ({ page }) => {
    // GIVEN: User opens account form
    await page.click('[data-testid="add-account-button"]');

    // WHEN: User submits form without entering username
    await page.fill('[data-testid="account-name-input"]', 'My IPTV Provider');
    await page.fill('[data-testid="server-url-input"]', 'http://example.com:8080');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    await page.click('[data-testid="submit-account-button"]');

    // THEN: Validation error is shown for username
    await expect(page.locator('[data-testid="username-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="username-error"]')).toContainText('required');
  });

  test('should show validation error when password is empty', async ({ page }) => {
    // GIVEN: User opens account form
    await page.click('[data-testid="add-account-button"]');

    // WHEN: User submits form without entering password
    await page.fill('[data-testid="account-name-input"]', 'My IPTV Provider');
    await page.fill('[data-testid="server-url-input"]', 'http://example.com:8080');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.click('[data-testid="submit-account-button"]');

    // THEN: Validation error is shown for password
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-error"]')).toContainText('required');
  });

  test('should successfully add account with valid credentials', async ({ page }) => {
    // GIVEN: User opens account form
    await page.click('[data-testid="add-account-button"]');

    // WHEN: User fills in all valid fields and submits
    await page.fill('[data-testid="account-name-input"]', 'My IPTV Provider');
    await page.fill('[data-testid="server-url-input"]', 'http://example.com:8080');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    await page.click('[data-testid="submit-account-button"]');

    // THEN: Account appears in the accounts list
    await expect(page.locator('[data-testid="accounts-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="account-item"]')).toContainText('My IPTV Provider');
    await expect(page.locator('[data-testid="account-item"]')).toContainText('example.com:8080');
    await expect(page.locator('[data-testid="account-item"]')).toContainText('testuser');
  });

  test('should not display password in accounts list', async ({ page }) => {
    // GIVEN: User has added an account
    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'My IPTV Provider');
    await page.fill('[data-testid="server-url-input"]', 'http://example.com:8080');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    await page.click('[data-testid="submit-account-button"]');

    // WHEN: Viewing the accounts list
    const accountItem = page.locator('[data-testid="account-item"]').first();

    // THEN: Password is not visible in the UI
    await expect(accountItem).not.toContainText('testpass123');
    await expect(accountItem).not.toContainText('password');
  });

  test('should clear form after successful submission', async ({ page }) => {
    // GIVEN: User opens account form
    await page.click('[data-testid="add-account-button"]');

    // WHEN: User successfully adds an account
    await page.fill('[data-testid="account-name-input"]', 'My IPTV Provider');
    await page.fill('[data-testid="server-url-input"]', 'http://example.com:8080');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    await page.click('[data-testid="submit-account-button"]');

    // Wait for success (form closes or shows success message)
    await expect(page.locator('[data-testid="accounts-list"]')).toContainText('My IPTV Provider');

    // THEN: Form is cleared when reopened
    await page.click('[data-testid="add-account-button"]');
    await expect(page.locator('[data-testid="account-name-input"]')).toHaveValue('');
    await expect(page.locator('[data-testid="server-url-input"]')).toHaveValue('');
    await expect(page.locator('[data-testid="username-input"]')).toHaveValue('');
    await expect(page.locator('[data-testid="password-input"]')).toHaveValue('');
  });

  test('should display loading state during account submission', async ({ page }) => {
    // GIVEN: User opens account form
    await page.click('[data-testid="add-account-button"]');

    // WHEN: User submits the form
    await page.fill('[data-testid="account-name-input"]', 'My IPTV Provider');
    await page.fill('[data-testid="server-url-input"]', 'http://example.com:8080');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');

    // Click submit and immediately check for loading state
    const submitButton = page.locator('[data-testid="submit-account-button"]');
    await submitButton.click();

    // THEN: Loading state is displayed
    await expect(submitButton).toBeDisabled();
  });
});

test.describe('Accounts List Display', () => {
  test('should show empty state when no accounts exist', async ({ page }) => {
    // GIVEN: User navigates to Accounts view
    await page.goto('/accounts');

    // WHEN: No accounts have been added

    // THEN: Empty state message is displayed
    await expect(page.locator('[data-testid="accounts-empty-state"]')).toBeVisible();
    await expect(page.locator('[data-testid="accounts-empty-state"]')).toContainText('No accounts');
  });
});
