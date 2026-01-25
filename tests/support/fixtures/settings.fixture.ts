import { test as base } from '@playwright/test';
import { createDefaultSettings, createAppSettings, AppSettings } from '../factories/settings.factory';

/**
 * Settings Test Fixtures
 *
 * Provides test fixtures for managing application settings with automatic cleanup.
 * Fixtures handle setup and teardown of settings state for isolated testing.
 */

interface SettingsFixtures {
  /**
   * Provides default settings and ensures cleanup after test
   */
  defaultSettings: AppSettings;

  /**
   * Provides custom settings and ensures cleanup after test
   */
  customSettings: AppSettings;

  /**
   * Provides a function to reset settings to defaults
   */
  resetSettings: (page: any) => Promise<void>;
}

export const test = base.extend<SettingsFixtures>({
  /**
   * Default settings fixture
   * Provides default application settings
   */
  defaultSettings: async ({}, use) => {
    const settings = createDefaultSettings();
    await use(settings);
    // Cleanup: Settings are reset via resetSettings fixture if needed
  },

  /**
   * Custom settings fixture
   * Provides randomly generated settings for testing variations
   */
  customSettings: async ({}, use) => {
    const settings = createAppSettings();
    await use(settings);
    // Cleanup: Settings are reset via resetSettings fixture if needed
  },

  /**
   * Reset settings function
   * Provides a helper to reset settings to defaults via GUI
   */
  resetSettings: async ({ page }, use) => {
    const resetFn = async (testPage: any) => {
      // Navigate to settings
      await testPage.goto('/settings');

      // Reset to defaults
      await testPage.locator('[data-testid="server-port-input"]').fill('5004');
      await testPage.locator('[data-testid="auto-start-toggle"]').uncheck();
      await testPage.locator('[data-testid="epg-refresh-time-input"]').fill('03:00');

      // Save
      await testPage.click('[data-testid="save-settings-button"]');
      await testPage.locator('[data-testid="settings-success-message"]').waitFor({ state: 'visible' });
    };

    await use(resetFn);

    // Cleanup: Reset settings after test
    await resetFn(page);
  },
});

export { expect } from '@playwright/test';
