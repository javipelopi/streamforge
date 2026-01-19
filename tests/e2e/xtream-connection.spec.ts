import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Story 2.2: Test Xtream Connection and Display Account Status
 *
 * Tests the complete user journey of testing an Xtream connection and viewing
 * account status information through the UI.
 */

test.describe('Test Xtream Connection', () => {
  test('should show loading state when testing connection', async ({ page }) => {
    // GIVEN: User has an account and navigates to Accounts view
    await page.goto('/accounts');

    // Add an account first (prerequisite)
    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Test Provider');
    await page.fill('[data-testid="server-url-input"]', 'http://example.com:8080');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    await page.click('[data-testid="submit-account-button"]');

    // Wait for account to be added
    await expect(page.locator('[data-testid="account-item"]')).toBeVisible();

    // WHEN: User clicks "Test Connection"
    await page.click('[data-testid="test-connection-button"]');

    // THEN: Loading indicator is shown
    await expect(page.locator('[data-testid="test-connection-loading"]')).toBeVisible();

    // AND: Button is disabled during loading
    await expect(page.locator('[data-testid="test-connection-button"]')).toBeDisabled();
  });

  test('should display connection status and account info on successful authentication', async ({ page }) => {
    // GIVEN: User has an account
    await page.goto('/accounts');

    // Add an account
    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Test Provider');
    await page.fill('[data-testid="server-url-input"]', 'http://example.com:8080');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]')).toBeVisible();

    // Mock successful Xtream API response
    await page.route('**/player_api.php**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user_info: {
            username: 'testuser',
            password: 'testpass123',
            auth: 1,
            status: 'Active',
            exp_date: '1735689600', // 2025-01-01
            max_connections: '2',
            active_cons: '0',
            is_trial: '0',
          },
          server_info: {
            url: 'http://example.com',
            port: '8080',
          },
        }),
      });
    });

    // WHEN: User clicks "Test Connection" and authentication succeeds
    await page.click('[data-testid="test-connection-button"]');

    // THEN: Connection status is displayed
    await expect(page.locator('[data-testid="status-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-badge"]')).toContainText('Connected');

    // AND: Account expiry date is shown
    await expect(page.locator('[data-testid="expiry-date"]')).toBeVisible();
    await expect(page.locator('[data-testid="expiry-date"]')).toContainText('2025');

    // AND: Tuner information is displayed
    await expect(page.locator('[data-testid="tuner-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="tuner-active-count"]')).toHaveText('0');
    await expect(page.locator('[data-testid="tuner-max-count"]')).toHaveText('2');
  });

  test('should display error message with suggestions on authentication failure', async ({ page }) => {
    // GIVEN: User has an account
    await page.goto('/accounts');

    // Add an account
    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Test Provider');
    await page.fill('[data-testid="server-url-input"]', 'http://example.com:8080');
    await page.fill('[data-testid="username-input"]', 'wronguser');
    await page.fill('[data-testid="password-input"]', 'wrongpass');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]')).toBeVisible();

    // Mock failed Xtream API response
    await page.route('**/player_api.php**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user_info: {
            auth: 0,
            message: 'Invalid credentials',
          },
        }),
      });
    });

    // WHEN: User clicks "Test Connection" and authentication fails
    await page.click('[data-testid="test-connection-button"]');

    // THEN: Error message is displayed
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid');

    // AND: Suggestions are provided
    await expect(page.locator('[data-testid="error-suggestions"]')).toBeVisible();
    const suggestions = page.locator('[data-testid="error-suggestion-item"]');
    await expect(suggestions).toHaveCount(3); // Should have at least 3 suggestions

    // Verify suggestions are actionable
    const firstSuggestion = suggestions.first();
    await expect(firstSuggestion).toContainText(/username|password|credentials|subscription/i);
  });
});
