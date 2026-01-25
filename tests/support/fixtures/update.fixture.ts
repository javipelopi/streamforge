/**
 * Update Mock Fixtures for Tauri Updater Plugin
 *
 * Provides fixtures for mocking Tauri updater plugin responses in E2E tests.
 * These fixtures simulate update availability scenarios without requiring
 * actual update server or Tauri backend.
 *
 * These fixtures use the main injectSettingsStatefulMock from tauri.mock.ts
 * and configure update-specific state for different test scenarios.
 */

import { Page } from '@playwright/test';
import { injectSettingsStatefulMock } from '../mocks/tauri.mock';

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
  // Inject the main settings mock first
  await injectSettingsStatefulMock(page);

  // Configure update state
  const updateStateScript = `
    (function() {
      // Configure update info to return when check_for_update is called
      window.__UPDATE_INFO__ = ${JSON.stringify(updateInfo)};

      // Configure update settings
      window.__UPDATE_STATE__ = {
        autoCheck: true,
        lastCheck: null,
        currentVersion: '1.1.0',
      };

      console.log('[Update Fixture] Configured update available:', window.__UPDATE_INFO__);
    })();
  `;

  await page.addInitScript(updateStateScript);
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

  // Inject the main settings mock first
  await injectSettingsStatefulMock(page);

  // Configure update state - no update available
  const updateStateScript = `
    (function() {
      // Configure update info - no update available
      window.__UPDATE_INFO__ = ${JSON.stringify(noUpdateInfo)};

      // Configure update settings
      window.__UPDATE_STATE__ = {
        autoCheck: true,
        lastCheck: null,
        currentVersion: '1.1.0',
      };

      console.log('[Update Fixture] Configured no update available');
    })();
  `;

  await page.addInitScript(updateStateScript);
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

  // Inject the main settings mock first
  await injectSettingsStatefulMock(page);

  // Configure update state with custom settings (but respect localStorage for persistence tests)
  const updateStateScript = `
    (function() {
      const UPDATE_STATE_KEY = '__TAURI_MOCK_UPDATE_STATE__';

      // Configure update info - no update by default
      window.__UPDATE_INFO__ = {
        available: false,
        version: null,
        notes: null,
        date: null,
      };

      // Try to load update state from localStorage first (for persistence across reloads)
      let savedState = null;
      try {
        const stored = localStorage.getItem(UPDATE_STATE_KEY);
        if (stored) {
          savedState = JSON.parse(stored);
          console.log('[Update Fixture] Loaded persisted update state:', savedState);
        }
      } catch (e) {
        console.warn('[Update Fixture] Failed to load persisted state:', e);
      }

      // Use saved state if available, otherwise use initial settings
      window.__UPDATE_STATE__ = savedState || ${JSON.stringify(mergedSettings)};

      console.log('[Update Fixture] Configured with settings:', window.__UPDATE_STATE__);
    })();
  `;

  await page.addInitScript(updateStateScript);
}
