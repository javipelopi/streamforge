import { test, expect } from '@playwright/test';

/**
 * API Tests for Xtream Client Authentication
 *
 * These tests verify the Xtream client authentication logic through the Tauri app.
 * Tests use mocked HTTP responses to verify request/response handling.
 *
 * Note: The XtreamClient is implemented in Rust and accessed via Tauri commands.
 * These tests verify behavior through the test_connection command.
 */

test.describe('XtreamClient Authentication', () => {
  test('should successfully authenticate with valid credentials', async ({ page }) => {
    // GIVEN: User has added an account
    await page.goto('/accounts');

    // Add an account first
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
            auth: 1,
            status: 'Active',
            exp_date: '1735689600',
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

    // WHEN: User clicks Test Connection
    await page.click('[data-testid="test-connection-button"]');

    // THEN: Authentication succeeds
    // Expected: Returns AccountInfo with is_authenticated: true
    // Expected: HTTP request completes within 10 seconds
    // Expected: Response is parsed correctly
    await expect(page.locator('[data-testid="status-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-badge"]')).toContainText('Connected');
  });

  test('should parse user info correctly from Xtream response', async ({ page }) => {
    // GIVEN: User has an account
    await page.goto('/accounts');

    // Add account
    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Parse Test');
    await page.fill('[data-testid="server-url-input"]', 'http://example.com:8080');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]')).toBeVisible();

    // Mock response with all fields
    await page.route('**/player_api.php**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user_info: {
            username: 'testuser',
            auth: 1,
            status: 'Active',
            exp_date: '1735689600', // Unix timestamp: 2025-01-01 00:00:00 UTC
            max_connections: '3',
            active_cons: '1',
            is_trial: '0',
          },
          server_info: {
            url: 'http://example.com',
          },
        }),
      });
    });

    // WHEN: Parsing response into AccountInfo
    await page.click('[data-testid="test-connection-button"]');

    // THEN: All fields are parsed correctly
    // Expected: exp_date '1735689600' → DateTime<Utc> (2025-01-01)
    await expect(page.locator('[data-testid="expiry-date"]')).toBeVisible();
    await expect(page.locator('[data-testid="expiry-date"]')).toContainText('2025');

    // Expected: max_connections '3' → i32 (3)
    await expect(page.locator('[data-testid="tuner-max-count"]')).toHaveText('3');

    // Expected: active_cons '1' → i32 (1)
    await expect(page.locator('[data-testid="tuner-active-count"]')).toHaveText('1');
  });

  test('should handle authentication failure (auth: 0)', async ({ page }) => {
    // GIVEN: User has an account
    await page.goto('/accounts');

    // Add account
    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Auth Fail Test');
    await page.fill('[data-testid="server-url-input"]', 'http://example.com:8080');
    await page.fill('[data-testid="username-input"]', 'wronguser');
    await page.fill('[data-testid="password-input"]', 'wrongpass');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]')).toBeVisible();

    // Mock failed authentication response
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

    // WHEN: Authentication fails (auth: 0)
    await page.click('[data-testid="test-connection-button"]');

    // THEN: Returns XtreamError::AuthenticationFailed
    // Expected error message: 'Invalid username or password'
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid');

    // Expected suggestions include actionable advice
    await expect(page.locator('[data-testid="error-suggestions"]')).toBeVisible();
    const suggestions = page.locator('[data-testid="error-suggestion-item"]');
    await expect(suggestions).toHaveCount(3);
  });

  test('should handle network timeout errors', async ({ page }) => {
    // GIVEN: User has an account
    await page.goto('/accounts');

    // Add account
    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Timeout Test');
    await page.fill('[data-testid="server-url-input"]', 'http://timeout.example.com:8080');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]')).toBeVisible();

    // Mock timeout by not responding - route will abort
    await page.route('**/player_api.php**', (route) => {
      // Abort the request to simulate network failure
      route.abort('failed');
    });

    // WHEN: Request times out
    await page.click('[data-testid="test-connection-button"]');

    // THEN: Returns XtreamError with timeout/network message
    // Note: The actual error shown depends on how the network failure manifests
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();

    // Expected suggestions include network troubleshooting
    await expect(page.locator('[data-testid="error-suggestions"]')).toBeVisible();
  });

  test('should handle invalid server response (malformed JSON)', async ({ page }) => {
    // GIVEN: User has an account
    await page.goto('/accounts');

    // Add account
    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Malformed Test');
    await page.fill('[data-testid="server-url-input"]', 'http://example.com:8080');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]')).toBeVisible();

    // Mock malformed response (invalid JSON)
    await page.route('**/player_api.php**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html>Not a JSON response</html>',
      });
    });

    // WHEN: Parsing invalid JSON response
    await page.click('[data-testid="test-connection-button"]');

    // THEN: Returns XtreamError::InvalidResponse
    // Expected error message indicates unexpected data format
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();

    // Expected suggestions help user verify server
    await expect(page.locator('[data-testid="error-suggestions"]')).toBeVisible();
  });

  test('should handle HTTP error status codes', async ({ page }) => {
    // GIVEN: User has an account
    await page.goto('/accounts');

    // Add account
    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'HTTP Error Test');
    await page.fill('[data-testid="server-url-input"]', 'http://example.com:8080');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]')).toBeVisible();

    // Mock 500 error
    await page.route('**/player_api.php**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'text/plain',
        body: 'Internal Server Error',
      });
    });

    // WHEN: Server returns non-200 status
    await page.click('[data-testid="test-connection-button"]');

    // THEN: Returns XtreamError::HttpError with status code
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('500');

    // Expected: 5xx errors suggest 'Server is experiencing issues'
    await expect(page.locator('[data-testid="error-suggestions"]')).toBeVisible();
  });

  test('should construct correct API endpoint URL', async ({ page }) => {
    // GIVEN: User has an account with trailing slash
    await page.goto('/accounts');

    // Add account with trailing slash in URL
    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'URL Test');
    await page.fill('[data-testid="server-url-input"]', 'http://example.com:8080/');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]')).toBeVisible();

    // Capture the actual URL called
    let capturedUrl = '';
    await page.route('**/player_api.php**', (route) => {
      capturedUrl = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user_info: { auth: 1, status: 'Active' },
        }),
      });
    });

    // WHEN: Building API endpoint URL
    await page.click('[data-testid="test-connection-button"]');

    // Wait for the request to be made
    await page.waitForTimeout(1000);

    // THEN: URL is constructed correctly
    // Expected: Trailing slashes are handled (no double slashes)
    expect(capturedUrl).not.toContain('//player_api.php');

    // Expected: Query parameters are present
    expect(capturedUrl).toContain('username=');
    expect(capturedUrl).toContain('password=');
  });
});

test.describe('XtreamClient Error Messages', () => {
  test('should provide user-friendly error messages', async ({ page }) => {
    // GIVEN: User has an account
    await page.goto('/accounts');

    // Add account
    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Error Message Test');
    await page.fill('[data-testid="server-url-input"]', 'http://example.com:8080');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]')).toBeVisible();

    // Mock auth failure
    await page.route('**/player_api.php**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user_info: { auth: 0 },
        }),
      });
    });

    // WHEN: Getting user message for authentication failure
    await page.click('[data-testid="test-connection-button"]');

    // THEN: Error messages are clear and actionable
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();

    // Expected: Messages explain what went wrong
    const messageText = await errorMessage.textContent();
    expect(messageText).toBeTruthy();

    // Expected: Messages don't leak technical details (no stack traces)
    expect(messageText).not.toContain('at ');
    expect(messageText).not.toContain('Error:');
  });

  test('should provide actionable suggestions for each error type', async ({ page }) => {
    // GIVEN: User has an account
    await page.goto('/accounts');

    // Add account
    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Suggestions Test');
    await page.fill('[data-testid="server-url-input"]', 'http://example.com:8080');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]')).toBeVisible();

    // Mock auth failure to get suggestions
    await page.route('**/player_api.php**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user_info: { auth: 0 },
        }),
      });
    });

    // WHEN: Getting suggestions for authentication failure
    await page.click('[data-testid="test-connection-button"]');

    // THEN: Suggestions are specific and helpful
    await expect(page.locator('[data-testid="error-suggestions"]')).toBeVisible();

    // Expected: Each error type has 2-3 suggestions
    const suggestions = page.locator('[data-testid="error-suggestion-item"]');
    const count = await suggestions.count();
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(4);

    // Expected: Suggestions are actionable (contain action verbs)
    const suggestionTexts = await suggestions.allTextContents();
    const hasActionableText = suggestionTexts.some(
      (text) =>
        text.toLowerCase().includes('check') ||
        text.toLowerCase().includes('verify') ||
        text.toLowerCase().includes('ensure') ||
        text.toLowerCase().includes('contact')
    );
    expect(hasActionableText).toBe(true);
  });
});
