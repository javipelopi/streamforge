/**
 * Update Mock Fixtures for Tauri Updater Plugin
 *
 * Provides fixtures for mocking Tauri updater plugin responses in E2E tests.
 * These fixtures simulate update availability scenarios without requiring
 * actual update server or Tauri backend.
 */

import { Page } from '@playwright/test';

/**
 * Update info structure matching Tauri updater plugin response
 */
export interface UpdateInfo {
  available: boolean;
  version: string | null;
  notes: string | null;
  date: string | null;
}

/**
 * Update settings structure
 */
export interface UpdateSettings {
  autoCheck: boolean;
  lastCheck: string | null;
  currentVersion: string;
}

/**
 * Injects Tauri updater mock with update available
 *
 * @param page - Playwright page object
 * @param updateInfo - Custom update info (defaults to v1.2.0 available)
 */
export async function injectUpdateAvailableMock(
  page: Page,
  updateInfo: UpdateInfo = {
    available: true,
    version: '1.2.0',
    notes: `## What's New in v1.2.0

- Feature: Auto-update mechanism with signature verification
- Feature: Event log viewer with notification badge
- Improvement: Enhanced settings UI
- Bug fix: Channel matching edge cases

For full release notes, visit GitHub releases.`,
    date: '2026-01-24T00:00:00Z',
  }
): Promise<void> {
  const mockScript = `
    (function() {
      // Mock update info
      const updateInfo = ${JSON.stringify(updateInfo)};

      // Mock update settings state
      let updateSettings = {
        autoCheck: true,
        lastCheck: null,
        currentVersion: '1.1.0',
      };

      // Create mock invoke function
      async function mockInvoke(cmd, args = {}) {
        console.log('[Update Mock] Invoke:', cmd, args);

        switch (cmd) {
          case 'check_for_update':
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 100));

            // Update last check timestamp
            updateSettings.lastCheck = new Date().toISOString();

            console.log('[Update Mock] Update available:', updateInfo);
            return updateInfo;

          case 'get_update_settings':
            console.log('[Update Mock] Get settings:', updateSettings);
            return updateSettings;

          case 'set_auto_check_updates':
            updateSettings.autoCheck = args.enabled;
            console.log('[Update Mock] Set auto-check:', args.enabled);
            return undefined;

          case 'download_and_install_update':
            console.log('[Update Mock] Download and install');
            // Simulate download progress (mock only)
            // In real implementation, this would trigger progress events
            return undefined;

          default:
            console.warn('[Update Mock] Unknown command:', cmd);
            throw new Error(\`Unknown command: \${cmd}\`);
        }
      }

      // Inject the mock into window.__TAURI_INTERNALS__
      window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};
      window.__TAURI_INTERNALS__.invoke = mockInvoke;

      // Also expose for direct access in tests
      window.__UPDATE_MOCK__ = {
        invoke: mockInvoke,
        updateInfo: updateInfo,
        updateSettings: updateSettings,
      };

      console.log('[Update Mock] Initialized - Update available');
    })();
  `;

  await page.addInitScript(mockScript);
}

/**
 * Injects Tauri updater mock with no update available
 *
 * @param page - Playwright page object
 */
export async function injectUpdateNotAvailableMock(page: Page): Promise<void> {
  const noUpdateInfo: UpdateInfo = {
    available: false,
    version: null,
    notes: null,
    date: null,
  };

  const mockScript = `
    (function() {
      // Mock update info - no update available
      const updateInfo = ${JSON.stringify(noUpdateInfo)};

      // Mock update settings state
      let updateSettings = {
        autoCheck: true,
        lastCheck: null,
        currentVersion: '1.1.0',
      };

      // Create mock invoke function
      async function mockInvoke(cmd, args = {}) {
        console.log('[Update Mock] Invoke:', cmd, args);

        switch (cmd) {
          case 'check_for_update':
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 100));

            // Update last check timestamp
            updateSettings.lastCheck = new Date().toISOString();

            console.log('[Update Mock] No update available');
            return updateInfo;

          case 'get_update_settings':
            console.log('[Update Mock] Get settings:', updateSettings);
            return updateSettings;

          case 'set_auto_check_updates':
            updateSettings.autoCheck = args.enabled;
            console.log('[Update Mock] Set auto-check:', args.enabled);
            return undefined;

          default:
            console.warn('[Update Mock] Unknown command:', cmd);
            throw new Error(\`Unknown command: \${cmd}\`);
        }
      }

      // Inject the mock into window.__TAURI_INTERNALS__
      window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};
      window.__TAURI_INTERNALS__.invoke = mockInvoke;

      // Also expose for direct access in tests
      window.__UPDATE_MOCK__ = {
        invoke: mockInvoke,
        updateInfo: updateInfo,
        updateSettings: updateSettings,
      };

      console.log('[Update Mock] Initialized - No update available');
    })();
  `;

  await page.addInitScript(mockScript);
}

/**
 * Injects Tauri updater mock with custom settings
 *
 * @param page - Playwright page object
 * @param settings - Custom update settings
 */
export async function injectUpdateMockWithSettings(
  page: Page,
  settings: Partial<UpdateSettings> = {}
): Promise<void> {
  const defaultSettings: UpdateSettings = {
    autoCheck: true,
    lastCheck: null,
    currentVersion: '1.1.0',
  };

  const mergedSettings = { ...defaultSettings, ...settings };

  const mockScript = `
    (function() {
      // Mock update settings state
      let updateSettings = ${JSON.stringify(mergedSettings)};

      // Create mock invoke function
      async function mockInvoke(cmd, args = {}) {
        console.log('[Update Mock] Invoke:', cmd, args);

        switch (cmd) {
          case 'check_for_update':
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 100));

            // Update last check timestamp
            updateSettings.lastCheck = new Date().toISOString();

            // Return no update by default
            return {
              available: false,
              version: null,
              notes: null,
              date: null,
            };

          case 'get_update_settings':
            console.log('[Update Mock] Get settings:', updateSettings);
            return updateSettings;

          case 'set_auto_check_updates':
            updateSettings.autoCheck = args.enabled;
            console.log('[Update Mock] Set auto-check:', args.enabled);
            return undefined;

          default:
            console.warn('[Update Mock] Unknown command:', cmd);
            throw new Error(\`Unknown command: \${cmd}\`);
        }
      }

      // Inject the mock into window.__TAURI_INTERNALS__
      window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};
      window.__TAURI_INTERNALS__.invoke = mockInvoke;

      // Also expose for direct access in tests
      window.__UPDATE_MOCK__ = {
        invoke: mockInvoke,
        updateSettings: updateSettings,
      };

      console.log('[Update Mock] Initialized with custom settings');
    })();
  `;

  await page.addInitScript(mockScript);
}
