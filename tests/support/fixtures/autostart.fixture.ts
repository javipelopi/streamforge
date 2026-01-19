import { test as base } from '@playwright/test';
import { invoke } from '@tauri-apps/api/core';

/**
 * Autostart Fixtures
 *
 * Fixtures for testing autostart functionality with automatic cleanup.
 *
 * Story 1.6: Add Auto-Start on Boot Capability
 *
 * These fixtures provide pre-configured autostart states for tests
 * and automatically clean up after test execution.
 */

type AutostartFixtures = {
  withAutostartEnabled: void;
  withAutostartDisabled: void;
};

/**
 * Extended Playwright test with autostart fixtures
 *
 * Usage:
 * import { test } from './fixtures/autostart.fixture';
 *
 * test('my test', async ({ page, withAutostartEnabled }) => {
 *   // Autostart is already enabled
 * });
 */
export const test = base.extend<AutostartFixtures>({
  /**
   * Fixture: withAutostartEnabled
   *
   * Ensures autostart is enabled before test runs and disables it after.
   *
   * Setup: Enables autostart via Tauri command
   * Provides: Clean autostart-enabled state
   * Cleanup: Disables autostart after test
   *
   * @example
   * test('should show enabled state', async ({ page, withAutostartEnabled }) => {
   *   await page.goto('/settings');
   *   await expect(page.locator('[data-testid="autostart-toggle"]')).toBeChecked();
   * });
   */
  withAutostartEnabled: async ({}, use) => {
    // Setup: Enable autostart
    try {
      await invoke('set_autostart_enabled', { enabled: true });
    } catch (error) {
      console.warn('Failed to enable autostart in fixture setup:', error);
    }

    // Provide to test
    await use();

    // Cleanup: Disable autostart
    try {
      await invoke('set_autostart_enabled', { enabled: false });
    } catch (error) {
      console.warn('Failed to disable autostart in fixture cleanup:', error);
    }
  },

  /**
   * Fixture: withAutostartDisabled
   *
   * Ensures autostart is disabled before test runs.
   *
   * Setup: Disables autostart via Tauri command
   * Provides: Clean autostart-disabled state
   * Cleanup: None needed (already disabled)
   *
   * @example
   * test('should show disabled state', async ({ page, withAutostartDisabled }) => {
   *   await page.goto('/settings');
   *   await expect(page.locator('[data-testid="autostart-toggle"]')).not.toBeChecked();
   * });
   */
  withAutostartDisabled: async ({}, use) => {
    // Setup: Disable autostart
    try {
      await invoke('set_autostart_enabled', { enabled: false });
    } catch (error) {
      console.warn('Failed to disable autostart in fixture setup:', error);
    }

    // Provide to test
    await use();

    // Cleanup: None needed (already disabled)
  },
});

export { expect } from '@playwright/test';
