import { test, expect, Page } from '@playwright/test';
import {
  createTestConnectionSuccess,
  createTestConnectionFailure,
} from '../support/factories/test-connection.factory';
import { createAccount } from '../support/factories/account.factory';

/**
 * E2E Tests for Story 2.2: Test Xtream Connection and Display Account Status
 *
 * Tests the complete user journey of testing an Xtream connection and viewing
 * account status information through the UI.
 *
 * These tests use Tauri mock infrastructure to simulate backend commands
 * when running against Vite dev server without the full Tauri backend.
 */

/**
 * Inject Tauri mock with account and test_connection commands
 * This sets up the mock BEFORE page navigation so Tauri API calls work
 */
async function injectAccountMocks(
  page: Page,
  testConnectionResponse: ReturnType<typeof createTestConnectionSuccess>
) {
  const mockScript = `
    (function() {
      // State storage for accounts
      window.__ACCOUNTS_STATE__ = {
        accounts: [],
        nextId: 1,
      };

      // Test connection response to use
      window.__TEST_CONNECTION_RESPONSE__ = ${JSON.stringify(testConnectionResponse)};

      const mockCommands = {
        greet: (args) => \`Hello, \${args.name}! Welcome to StreamForge.\`,
        get_setting: () => null,
        set_setting: () => undefined,
        get_server_port: () => 5004,
        set_server_port: () => undefined,
        get_autostart_enabled: () => ({ enabled: false }),
        set_autostart_enabled: () => undefined,

        // Account commands
        get_accounts: () => {
          return window.__ACCOUNTS_STATE__.accounts;
        },

        add_account: (args) => {
          const request = args.request;
          const now = new Date().toISOString();
          const account = {
            id: window.__ACCOUNTS_STATE__.nextId++,
            name: request.name,
            serverUrl: request.serverUrl,
            username: request.username,
            maxConnections: 1,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          };
          window.__ACCOUNTS_STATE__.accounts.push(account);
          return account;
        },

        delete_account: (args) => {
          const id = args.id;
          window.__ACCOUNTS_STATE__.accounts = window.__ACCOUNTS_STATE__.accounts.filter(
            (acc) => acc.id !== id
          );
          return undefined;
        },

        // Test connection command - returns pre-configured response
        test_connection: (args) => {
          return window.__TEST_CONNECTION_RESPONSE__;
        },
      };

      async function mockInvoke(cmd, args = {}) {
        console.log('[Tauri Mock] Invoke:', cmd, args);

        if (mockCommands[cmd]) {
          try {
            const result = await Promise.resolve(mockCommands[cmd](args));
            console.log('[Tauri Mock] Result:', cmd, result);
            return result;
          } catch (error) {
            console.error('[Tauri Mock] Error:', cmd, error);
            throw error;
          }
        }

        console.warn('[Tauri Mock] Unknown command:', cmd);
        throw new Error(\`Unknown command: \${cmd}\`);
      }

      window.__TAURI_INTERNALS__ = {
        invoke: mockInvoke,
        metadata: {
          currentWindow: { label: 'main' },
          currentWebview: { label: 'main' },
          windows: [{ label: 'main' }],
          webviews: [{ label: 'main' }],
        },
        plugins: {},
      };

      window.__TAURI_MOCK__ = {
        invoke: mockInvoke,
        commands: mockCommands,
        setTestConnectionResponse: (response) => {
          window.__TEST_CONNECTION_RESPONSE__ = response;
        },
      };

      console.log('[Tauri Mock] Account mock initialized');
    })();
  `;

  await page.addInitScript(mockScript);
}

test.describe('Test Xtream Connection', () => {
  test('should show loading state when testing connection', async ({ page }) => {
    // Setup mock with delayed response to test loading state
    // We need to inject a special mock that adds delay to test_connection
    const successResponse = createTestConnectionSuccess({
      status: 'Active',
      expiryDate: '2025-01-01T00:00:00Z',
      maxConnections: 2,
      activeConnections: 0,
    });

    // Inject mock with delayed test_connection response
    const mockScript = `
      (function() {
        window.__ACCOUNTS_STATE__ = {
          accounts: [],
          nextId: 1,
        };

        window.__TEST_CONNECTION_RESPONSE__ = ${JSON.stringify(successResponse)};

        const mockCommands = {
          greet: (args) => \`Hello, \${args.name}! Welcome to StreamForge.\`,
          get_setting: () => null,
          set_setting: () => undefined,
          get_server_port: () => 5004,
          set_server_port: () => undefined,
          get_autostart_enabled: () => ({ enabled: false }),
          set_autostart_enabled: () => undefined,

          get_accounts: () => {
            return window.__ACCOUNTS_STATE__.accounts;
          },

          add_account: (args) => {
            const request = args.request;
            const now = new Date().toISOString();
            const account = {
              id: window.__ACCOUNTS_STATE__.nextId++,
              name: request.name,
              serverUrl: request.serverUrl,
              username: request.username,
              maxConnections: 1,
              isActive: true,
              createdAt: now,
              updatedAt: now,
            };
            window.__ACCOUNTS_STATE__.accounts.push(account);
            return account;
          },

          delete_account: (args) => {
            const id = args.id;
            window.__ACCOUNTS_STATE__.accounts = window.__ACCOUNTS_STATE__.accounts.filter(
              (acc) => acc.id !== id
            );
            return undefined;
          },

          // Test connection with 500ms delay to test loading state
          test_connection: async (args) => {
            await new Promise(resolve => setTimeout(resolve, 500));
            return window.__TEST_CONNECTION_RESPONSE__;
          },
        };

        async function mockInvoke(cmd, args = {}) {
          console.log('[Tauri Mock] Invoke:', cmd, args);

          if (mockCommands[cmd]) {
            try {
              const result = await Promise.resolve(mockCommands[cmd](args));
              console.log('[Tauri Mock] Result:', cmd, result);
              return result;
            } catch (error) {
              console.error('[Tauri Mock] Error:', cmd, error);
              throw error;
            }
          }

          console.warn('[Tauri Mock] Unknown command:', cmd);
          throw new Error(\`Unknown command: \${cmd}\`);
        }

        window.__TAURI_INTERNALS__ = {
          invoke: mockInvoke,
          metadata: {
            currentWindow: { label: 'main' },
            currentWebview: { label: 'main' },
            windows: [{ label: 'main' }],
            webviews: [{ label: 'main' }],
          },
          plugins: {},
        };

        window.__TAURI_MOCK__ = {
          invoke: mockInvoke,
          commands: mockCommands,
        };

        console.log('[Tauri Mock] Account mock with delay initialized');
      })();
    `;
    await page.addInitScript(mockScript);

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
    const accountItem = page.locator('[data-testid="account-item"]').first();
    await expect(accountItem).toBeVisible();

    // WHEN: User clicks "Test Connection"
    const testConnectionBtn = accountItem.locator('[data-testid="test-connection-button"]');
    await testConnectionBtn.click();

    // THEN: Loading indicator is shown (we have 500ms delay to catch it)
    await expect(accountItem.locator('[data-testid="test-connection-loading"]')).toBeVisible();

    // AND: Button is disabled during loading
    await expect(testConnectionBtn).toBeDisabled();
  });

  test('should display connection status and account info on successful authentication', async ({
    page,
  }) => {
    // Setup mock with successful response
    const successResponse = createTestConnectionSuccess({
      status: 'Active',
      expiryDate: '2025-01-01T00:00:00Z',
      maxConnections: 2,
      activeConnections: 0,
    });
    await injectAccountMocks(page, successResponse);

    // GIVEN: User has an account
    await page.goto('/accounts');

    // Add an account
    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Test Provider');
    await page.fill('[data-testid="server-url-input"]', 'http://example.com:8080');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]').first()).toBeVisible();

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

  test('should display error message with suggestions on authentication failure', async ({
    page,
  }) => {
    // Setup mock with failure response
    const failureResponse = createTestConnectionFailure('authentication');
    await injectAccountMocks(page, failureResponse);

    // GIVEN: User has an account
    await page.goto('/accounts');

    // Add an account
    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Test Provider');
    await page.fill('[data-testid="server-url-input"]', 'http://example.com:8080');
    await page.fill('[data-testid="username-input"]', 'wronguser');
    await page.fill('[data-testid="password-input"]', 'wrongpass');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]').first()).toBeVisible();

    // WHEN: User clicks "Test Connection" and authentication fails
    await page.click('[data-testid="test-connection-button"]');

    // THEN: Error message is displayed
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid');

    // AND: Suggestions are provided
    await expect(page.locator('[data-testid="error-suggestions"]')).toBeVisible();
    const suggestions = page.locator('[data-testid="error-suggestion-item"]');
    await expect(suggestions).toHaveCount(3); // Should have 3 suggestions

    // Verify suggestions are actionable
    const firstSuggestion = suggestions.first();
    await expect(firstSuggestion).toContainText(/username|password|credentials|subscription/i);
  });
});
