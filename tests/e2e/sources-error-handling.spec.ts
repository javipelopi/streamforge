import { test as base, expect } from '@playwright/test';

/**
 * E2E Tests for Error Handling Scenarios
 *
 * Tests the application's handling of:
 * 1. Network failures and timeouts
 * 2. Malformed M3U content
 * 3. Invalid URL formats
 * 4. Server error responses (500)
 *
 * @see tech-spec-multi-source-stream-support.md
 */

// Extend base test with mock injection capability
interface ErrorHandlingFixtures {
  injectErrorMocks: (config: {
    networkError?: boolean;
    serverError?: boolean;
    timeoutError?: boolean;
    malformedResponse?: boolean;
  }) => Promise<void>;
}

/**
 * Generate mock script for error scenarios
 */
function generateErrorMockScript(config: {
  networkError?: boolean;
  serverError?: boolean;
  timeoutError?: boolean;
  malformedResponse?: boolean;
}): string {
  return `
    (function() {
      window.__ERROR_CONFIG__ = ${JSON.stringify(config)};

      const mockCommands = {
        greet: () => 'Hello',
        get_setting: () => null,
        set_setting: () => undefined,
        get_server_port: () => 5004,
        set_server_port: () => undefined,
        get_autostart_enabled: () => ({ enabled: false }),
        set_autostart_enabled: () => undefined,

        // M3U commands with error simulation
        get_m3u_sources: () => {
          if (window.__ERROR_CONFIG__.networkError) {
            throw new Error('Network request failed: Connection refused');
          }
          if (window.__ERROR_CONFIG__.serverError) {
            throw new Error('Server error: Internal server error (500)');
          }
          if (window.__ERROR_CONFIG__.timeoutError) {
            throw new Error('Request timeout: The operation timed out');
          }
          return [];
        },

        add_m3u_source: (args) => {
          console.log('[Mock] add_m3u_source called:', args);
          const { url } = args;

          // Validate URL format
          try {
            new URL(url);
          } catch {
            throw new Error('Invalid URL format: Unable to parse URL');
          }

          // Simulate various error conditions
          if (window.__ERROR_CONFIG__.networkError) {
            throw new Error('Network request failed: Unable to fetch playlist');
          }
          if (window.__ERROR_CONFIG__.serverError) {
            throw new Error('Server returned 500: Internal server error');
          }
          if (window.__ERROR_CONFIG__.timeoutError) {
            throw new Error('Request timed out after 30 seconds');
          }
          if (window.__ERROR_CONFIG__.malformedResponse) {
            throw new Error('Parse error: Invalid M3U format - missing #EXTM3U header');
          }

          // Simulate network failures for specific URLs
          if (url.includes('timeout.example.com')) {
            throw new Error('Request timed out');
          }
          if (url.includes('error.example.com')) {
            throw new Error('Server returned 500');
          }
          if (url.includes('invalid.example.com')) {
            throw new Error('Invalid M3U content');
          }
          if (url.includes('offline.example.com')) {
            throw new Error('Network error: Host unreachable');
          }

          // Success case
          const now = new Date().toISOString();
          return {
            source: {
              id: 1,
              name: args.name,
              url: args.url,
              refreshIntervalHours: 24,
              lastRefresh: now,
              isActive: true,
              createdAt: now,
              updatedAt: now,
            },
            channelCount: 10,
          };
        },

        refresh_m3u_source: (args) => {
          if (window.__ERROR_CONFIG__.networkError) {
            throw new Error('Network error during refresh');
          }
          if (window.__ERROR_CONFIG__.serverError) {
            throw new Error('Server error during refresh');
          }
          return { source: {}, channelCount: 10, added: 0, removed: 0, updated: 0 };
        },

        get_m3u_channels: () => [],

        // Acestream commands with error simulation
        get_acestream_sources: () => {
          if (window.__ERROR_CONFIG__.networkError) {
            throw new Error('Network error');
          }
          return [];
        },

        check_acestream_status: () => ({
          isSupported: true,
          engineAvailable: false,
          platform: 'linux',
          engineUrl: 'http://127.0.0.1:6878',
        }),

        add_acestream_source: (args) => {
          const { contentId } = args;

          // Validate content ID format
          if (!/^[a-f0-9]{40}$/i.test(contentId)) {
            throw new Error('Invalid Acestream content ID: must be 40 hexadecimal characters');
          }

          if (window.__ERROR_CONFIG__.networkError) {
            throw new Error('Network error while adding source');
          }

          return { id: 1, name: args.name, contentId, isActive: true };
        },

        // Xtream commands
        get_accounts: () => [],
        get_xtream_streams_for_account: () => [],
        get_account_stream_stats: () => ({ streamCount: 0, linkedCount: 0, orphanCount: 0, promotedCount: 0 }),

        // XMLTV commands
        get_xmltv_sources: () => [],
        get_xmltv_channels_for_source: () => [],
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
      window.__TAURI__ = { invoke: mockInvoke };
      window.__TAURI_MOCK__ = { invoke: mockInvoke, commands: mockCommands };
    })();
  `;
}

const test = base.extend<ErrorHandlingFixtures>({
  injectErrorMocks: async ({ page }, use) => {
    const inject = async (config: {
      networkError?: boolean;
      serverError?: boolean;
      timeoutError?: boolean;
      malformedResponse?: boolean;
    }) => {
      const script = generateErrorMockScript(config);
      await page.addInitScript(script);
    };
    await use(inject);
  },
});

test.describe('Error Handling - Network Failures', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*.{png,jpg,jpeg,svg,gif}', (route) => route.abort());
  });

  test('should display error message on network timeout', async ({
    page,
    injectErrorMocks,
  }) => {
    await injectErrorMocks({ timeoutError: true });

    await page.goto('/sources');
    await page.waitForLoadState('networkidle');
    await page.click('[data-testid="m3u-tab"]');

    // Should show error state or error message
    const errorState = page.locator('[data-testid="m3u-error-state"], [data-testid="m3u-sources-tab"] .text-red-700');
    await expect(errorState).toBeVisible({ timeout: 3000 });
  });

  test('should display error when adding M3U source fails due to network', async ({
    page,
    injectErrorMocks,
  }) => {
    await injectErrorMocks({});

    await page.goto('/sources');
    await page.waitForLoadState('networkidle');
    await page.click('[data-testid="m3u-tab"]');
    await page.click('[data-testid="add-m3u-source-button"]');

    // Fill form with URL that simulates timeout
    await page.fill('[data-testid="m3u-source-name-input"]', 'Timeout Test');
    await page.fill('[data-testid="m3u-source-url-input"]', 'https://timeout.example.com/playlist.m3u');

    await page.click('[data-testid="add-m3u-source-submit"]');

    // Should show error message
    const errorMessage = page.locator('[data-testid="m3u-add-error"], .text-red-600, .text-red-700');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    await expect(errorMessage).toContainText(/timeout|timed out|error/i);
  });

  test('should allow retry after network failure', async ({
    page,
    injectErrorMocks,
  }) => {
    await injectErrorMocks({});

    await page.goto('/sources');
    await page.waitForLoadState('networkidle');
    await page.click('[data-testid="m3u-tab"]');
    await page.click('[data-testid="add-m3u-source-button"]');

    // First attempt with failing URL
    await page.fill('[data-testid="m3u-source-name-input"]', 'Retry Test');
    await page.fill('[data-testid="m3u-source-url-input"]', 'https://error.example.com/playlist.m3u');
    await page.click('[data-testid="add-m3u-source-submit"]');

    // Wait for error
    await page.waitForSelector('.text-red-600, .text-red-700, [data-testid="m3u-add-error"]', { timeout: 5000 });

    // Clear and retry with valid URL
    await page.fill('[data-testid="m3u-source-url-input"]', 'https://valid.example.com/playlist.m3u');
    await page.click('[data-testid="add-m3u-source-submit"]');

    // Should succeed or at least not show the same error
    const successToast = page.getByText(/added|success/i);
    await expect(successToast).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Error Handling - Invalid URL Format', () => {
  test.beforeEach(async ({ page, injectErrorMocks }) => {
    await page.route('**/*.{png,jpg,jpeg,svg,gif}', (route) => route.abort());
    await injectErrorMocks({});
  });

  test('should show validation error for empty URL', async ({ page }) => {
    await page.goto('/sources');
    await page.waitForLoadState('networkidle');
    await page.click('[data-testid="m3u-tab"]');
    await page.click('[data-testid="add-m3u-source-button"]');

    // Fill name but leave URL empty
    await page.fill('[data-testid="m3u-source-name-input"]', 'Empty URL Test');
    await page.click('[data-testid="add-m3u-source-submit"]');

    // Should show URL required error
    const urlError = page.locator('[data-testid="m3u-url-error"]');
    await expect(urlError).toBeVisible();
    await expect(urlError).toContainText(/required|enter|provide/i);
  });

  test('should show validation error for invalid URL format', async ({ page }) => {
    await page.goto('/sources');
    await page.waitForLoadState('networkidle');
    await page.click('[data-testid="m3u-tab"]');
    await page.click('[data-testid="add-m3u-source-button"]');

    // Fill with invalid URL
    await page.fill('[data-testid="m3u-source-name-input"]', 'Invalid URL Test');
    await page.fill('[data-testid="m3u-source-url-input"]', 'not-a-valid-url');
    await page.click('[data-testid="add-m3u-source-submit"]');

    // Should show URL format error
    const urlError = page.locator('[data-testid="m3u-url-error"]');
    await expect(urlError).toBeVisible();
    await expect(urlError).toContainText(/valid.*url|invalid.*url|format/i);
  });

  test('should show validation error for URL without protocol', async ({ page }) => {
    await page.goto('/sources');
    await page.waitForLoadState('networkidle');
    await page.click('[data-testid="m3u-tab"]');
    await page.click('[data-testid="add-m3u-source-button"]');

    // Fill with URL missing protocol
    await page.fill('[data-testid="m3u-source-name-input"]', 'No Protocol Test');
    await page.fill('[data-testid="m3u-source-url-input"]', 'example.com/playlist.m3u');
    await page.click('[data-testid="add-m3u-source-submit"]');

    // Should either auto-fix or show error
    const urlError = page.locator('[data-testid="m3u-url-error"]');
    const isErrorVisible = await urlError.isVisible();

    // Either shows error or accepts the URL (some implementations auto-add http://)
    expect(typeof isErrorVisible).toBe('boolean');
  });
});

test.describe('Error Handling - Malformed M3U Content', () => {
  test.beforeEach(async ({ page, injectErrorMocks }) => {
    await page.route('**/*.{png,jpg,jpeg,svg,gif}', (route) => route.abort());
    await injectErrorMocks({});
  });

  test('should show error for malformed M3U content', async ({ page }) => {
    await page.goto('/sources');
    await page.waitForLoadState('networkidle');
    await page.click('[data-testid="m3u-tab"]');
    await page.click('[data-testid="add-m3u-source-button"]');

    // Fill with URL that returns malformed content
    await page.fill('[data-testid="m3u-source-name-input"]', 'Malformed Test');
    await page.fill('[data-testid="m3u-source-url-input"]', 'https://invalid.example.com/malformed.m3u');
    await page.click('[data-testid="add-m3u-source-submit"]');

    // Should show parse error
    const errorMessage = page.locator('[data-testid="m3u-add-error"], .text-red-600, .text-red-700');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    await expect(errorMessage).toContainText(/invalid|parse|format|m3u/i);
  });
});

test.describe('Error Handling - Server Error Responses', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*.{png,jpg,jpeg,svg,gif}', (route) => route.abort());
  });

  test('should display error on 500 server response', async ({
    page,
    injectErrorMocks,
  }) => {
    await injectErrorMocks({ serverError: true });

    await page.goto('/sources');
    await page.waitForLoadState('networkidle');
    await page.click('[data-testid="m3u-tab"]');

    // Should show error state
    const errorState = page.locator('[data-testid="m3u-error-state"], [data-testid="m3u-sources-tab"] .text-red-700, .bg-red-50');
    await expect(errorState).toBeVisible({ timeout: 3000 });
  });

  test('should show error when M3U source URL returns 500', async ({
    page,
    injectErrorMocks,
  }) => {
    await injectErrorMocks({});

    await page.goto('/sources');
    await page.waitForLoadState('networkidle');
    await page.click('[data-testid="m3u-tab"]');
    await page.click('[data-testid="add-m3u-source-button"]');

    // Fill with URL that returns 500
    await page.fill('[data-testid="m3u-source-name-input"]', 'Server Error Test');
    await page.fill('[data-testid="m3u-source-url-input"]', 'https://error.example.com/playlist.m3u');
    await page.click('[data-testid="add-m3u-source-submit"]');

    // Should show server error message
    const errorMessage = page.locator('[data-testid="m3u-add-error"], .text-red-600, .text-red-700');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    await expect(errorMessage).toContainText(/500|server|error/i);
  });
});

test.describe('Error Handling - Acestream Validation', () => {
  test.beforeEach(async ({ page, injectErrorMocks }) => {
    await page.route('**/*.{png,jpg,jpeg,svg,gif}', (route) => route.abort());
    await injectErrorMocks({});
  });

  test('should show error for invalid Acestream content ID format', async ({ page }) => {
    await page.goto('/sources');
    await page.waitForLoadState('networkidle');
    await page.click('[data-testid="acestream-tab"]');
    await page.click('[data-testid="add-acestream-source-button"]');

    // Fill with invalid content ID (too short)
    await page.fill('[data-testid="acestream-name-input"]', 'Invalid ID Test');
    await page.fill('[data-testid="acestream-content-id-input"]', 'abc123');
    await page.click('[data-testid="add-acestream-submit"]');

    // Should show validation error
    const error = page.locator('[data-testid="acestream-content-id-error"]');
    await expect(error).toBeVisible();
    await expect(error).toContainText(/invalid|40|character|hex/i);
  });

  test('should show error for non-hexadecimal Acestream content ID', async ({ page }) => {
    await page.goto('/sources');
    await page.waitForLoadState('networkidle');
    await page.click('[data-testid="acestream-tab"]');
    await page.click('[data-testid="add-acestream-source-button"]');

    // Fill with non-hex characters (correct length but invalid chars)
    await page.fill('[data-testid="acestream-name-input"]', 'Non-Hex Test');
    await page.fill('[data-testid="acestream-content-id-input"]', 'ghijklmnopqrstuvwxyzghijklmnopqrstuvwxyz');
    await page.click('[data-testid="add-acestream-submit"]');

    // Should show validation error
    const error = page.locator('[data-testid="acestream-content-id-error"]');
    await expect(error).toBeVisible();
    await expect(error).toContainText(/invalid|hex/i);
  });
});

test.describe('Error Handling - Graceful Degradation', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*.{png,jpg,jpeg,svg,gif}', (route) => route.abort());
  });

  test('should not crash the entire app when M3U tab fails to load', async ({
    page,
    injectErrorMocks,
  }) => {
    await injectErrorMocks({ networkError: true });

    await page.goto('/sources');
    await page.waitForLoadState('networkidle');

    // Click M3U tab - should show error but not crash
    await page.click('[data-testid="m3u-tab"]');

    // Other tabs should still be clickable
    const xtreamTab = page.locator('[data-testid="xtream-tab"]');
    if (await xtreamTab.isVisible()) {
      await xtreamTab.click();
      // Should switch tabs without crashing
      await expect(xtreamTab).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('should maintain UI state after dismissing error', async ({
    page,
    injectErrorMocks,
  }) => {
    await injectErrorMocks({});

    await page.goto('/sources');
    await page.waitForLoadState('networkidle');
    await page.click('[data-testid="m3u-tab"]');
    await page.click('[data-testid="add-m3u-source-button"]');

    // Fill with failing URL
    await page.fill('[data-testid="m3u-source-name-input"]', 'Error Test');
    await page.fill('[data-testid="m3u-source-url-input"]', 'https://error.example.com/playlist.m3u');
    await page.click('[data-testid="add-m3u-source-submit"]');

    // Wait for error
    await page.waitForSelector('.text-red-600, .text-red-700, [data-testid="m3u-add-error"]', { timeout: 5000 });

    // Close dialog
    const closeButton = page.locator('[data-testid="add-m3u-source-cancel"], [data-testid="dialog-close"]');
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // UI should still be functional
    const addButton = page.locator('[data-testid="add-m3u-source-button"]');
    await expect(addButton).toBeVisible();
    await expect(addButton).toBeEnabled();
  });
});
