import { test, expect } from '@playwright/test';
import { injectSettingsStatefulMock } from '../support/mocks/tauri.mock';

/**
 * E2E Tests for Story 6.1: Settings GUI for Server and Startup Options
 *
 * Tests the settings interface for configuring server port, auto-start,
 * and EPG refresh schedule through the GUI.
 *
 * Run with: pnpm test -- tests/e2e/settings-gui.spec.ts
 */

test.describe('Settings GUI - Server and Startup Options', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Tauri mock before navigation
    await injectSettingsStatefulMock(page);

    // GIVEN: Navigate to Settings view
    await page.goto('/');
    await page.click('[data-testid="settings-nav-link"]');
    await expect(page).toHaveURL('/settings');
  });

  test('should display all configuration sections', async ({ page }) => {
    // GIVEN: User is on Settings view (from beforeEach)

    // WHEN: Settings view loads
    // (navigation already complete)

    // THEN: All configuration sections are visible
    await expect(page.locator('[data-testid="server-settings-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="startup-settings-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="epg-settings-section"]')).toBeVisible();
  });

  test('should display server port input with default value', async ({ page }) => {
    // GIVEN: User is on Settings view
    // (from beforeEach)

    // WHEN: Server settings section is visible
    const serverSection = page.locator('[data-testid="server-settings-section"]');
    await expect(serverSection).toBeVisible();

    // THEN: Port input shows default value
    const portInput = page.locator('[data-testid="server-port-input"]');
    await expect(portInput).toHaveValue('5004');
  });

  test('should display auto-start toggle', async ({ page }) => {
    // GIVEN: User is on Settings view
    // (from beforeEach)

    // WHEN: Startup settings section is visible
    const startupSection = page.locator('[data-testid="startup-settings-section"]');
    await expect(startupSection).toBeVisible();

    // THEN: Auto-start toggle is visible
    const autoStartToggle = page.locator('[data-testid="auto-start-toggle"]');
    await expect(autoStartToggle).toBeVisible();
  });

  test('should display EPG refresh time picker', async ({ page }) => {
    // GIVEN: User is on Settings view
    // (from beforeEach)

    // WHEN: EPG settings section is visible
    const epgSection = page.locator('[data-testid="epg-settings-section"]');
    await expect(epgSection).toBeVisible();

    // THEN: Refresh time picker is visible
    const timePicker = page.locator('[data-testid="epg-refresh-time-input"]');
    await expect(timePicker).toBeVisible();
  });
});

test.describe('Settings GUI - Server Port Change', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Tauri mock before navigation
    await injectSettingsStatefulMock(page);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should save new server port', async ({ page }) => {
    // GIVEN: User is on Settings view with default port 5004
    const portInput = page.locator('[data-testid="server-port-input"]');
    await expect(portInput).toHaveValue('5004');

    // WHEN: User changes port to 5005 and saves
    await portInput.fill('5005');
    await page.click('[data-testid="save-settings-button"]');

    // THEN: Success message is displayed with restart instruction
    await expect(page.locator('[data-testid="settings-success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="settings-success-message"]')).toContainText('Port saved');
  });

  test('should update Plex configuration URLs after port change', async ({ page }) => {
    // Clear any persisted state from previous tests
    await page.evaluate(() => localStorage.removeItem('__TAURI_MOCK_SETTINGS__'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // GIVEN: User has changed the port to 5005
    await page.locator('[data-testid="server-port-input"]').fill('5005');
    await page.click('[data-testid="save-settings-button"]');
    await expect(page.locator('[data-testid="settings-success-message"]')).toBeVisible();

    // WHEN: User navigates to Dashboard to see Plex Config
    // Note: Plex config is displayed on Dashboard, not a separate route
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // THEN: URLs reflect the new port
    // The Plex config section shows URLs with testid pattern: prefix-url-value
    const m3uUrl = page.locator('[data-testid="m3u-url-value"]');
    await expect(m3uUrl).toContainText(':5005/');

    const epgUrl = page.locator('[data-testid="epg-url-value"]');
    await expect(epgUrl).toContainText(':5005/');
  });

  test('should validate port number range', async ({ page }) => {
    // GIVEN: User is on Settings view
    const portInput = page.locator('[data-testid="server-port-input"]');

    // WHEN: User enters invalid port number (too low)
    await portInput.fill('0');

    // THEN: Save button is disabled due to validation error
    // The inline validation prevents saving invalid ports
    const saveButton = page.locator('[data-testid="save-settings-button"]');
    await expect(saveButton).toBeDisabled();
  });

  test('should validate port number is numeric', async ({ page }) => {
    // GIVEN: User is on Settings view
    const portInput = page.locator('[data-testid="server-port-input"]');

    // WHEN: User enters non-numeric value
    await portInput.fill('abc');

    // THEN: Input is not accepted or shows error
    // Non-numeric input is filtered out, leaving empty string
    const saveButton = page.locator('[data-testid="save-settings-button"]');
    await expect(saveButton).toBeDisabled();
  });
});

test.describe('Settings GUI - Auto-Start Toggle', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Tauri mock before navigation
    await injectSettingsStatefulMock(page, { autostartEnabled: false });
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should enable auto-start on boot', async ({ page }) => {
    // GIVEN: Auto-start is currently disabled
    const autoStartToggle = page.locator('[data-testid="auto-start-toggle"]');
    await expect(autoStartToggle).toHaveAttribute('aria-checked', 'false');

    // WHEN: User enables auto-start and saves
    await autoStartToggle.click();
    await expect(autoStartToggle).toHaveAttribute('aria-checked', 'true');
    await page.click('[data-testid="save-settings-button"]');

    // THEN: Success message confirms OS autostart entry created
    await expect(page.locator('[data-testid="settings-success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="settings-success-message"]')).toContainText('Auto-start enabled');
  });

  test('should disable auto-start on boot', async ({ page }) => {
    // Re-inject with autostart initially enabled
    await injectSettingsStatefulMock(page, { autostartEnabled: true });
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // GIVEN: Auto-start is currently enabled
    const autoStartToggle = page.locator('[data-testid="auto-start-toggle"]');
    await expect(autoStartToggle).toHaveAttribute('aria-checked', 'true');

    // WHEN: User disables auto-start and saves
    await autoStartToggle.click();
    await expect(autoStartToggle).toHaveAttribute('aria-checked', 'false');
    await page.click('[data-testid="save-settings-button"]');

    // THEN: Success message confirms OS autostart entry removed
    await expect(page.locator('[data-testid="settings-success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="settings-success-message"]')).toContainText('Auto-start disabled');
  });

  test('should persist auto-start setting across page reloads', async ({ page }) => {
    // Clear any persisted state from previous tests
    await page.evaluate(() => localStorage.removeItem('__TAURI_MOCK_SETTINGS__'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // GIVEN: User has enabled auto-start
    const autoStartToggle = page.locator('[data-testid="auto-start-toggle"]');
    await autoStartToggle.click();
    await page.click('[data-testid="save-settings-button"]');
    await expect(page.locator('[data-testid="settings-success-message"]')).toBeVisible();

    // WHEN: User reloads the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // THEN: Auto-start toggle remains enabled
    await expect(autoStartToggle).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('Settings GUI - EPG Refresh Schedule', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Tauri mock before navigation
    await injectSettingsStatefulMock(page);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should update EPG refresh time', async ({ page }) => {
    // GIVEN: User is on Settings view
    const timeInput = page.locator('[data-testid="epg-refresh-time-input"]');

    // WHEN: User sets refresh time to 3:00 AM and saves
    await timeInput.fill('03:00');
    await page.click('[data-testid="save-settings-button"]');

    // THEN: Success message is displayed
    await expect(page.locator('[data-testid="settings-success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="settings-success-message"]')).toContainText('EPG refresh time updated');
  });

  test('should display next scheduled refresh time', async ({ page }) => {
    // GIVEN: User has set EPG refresh time to 3:00 AM
    const timeInput = page.locator('[data-testid="epg-refresh-time-input"]');
    await timeInput.fill('03:00');
    await page.click('[data-testid="save-settings-button"]');
    await expect(page.locator('[data-testid="settings-success-message"]')).toBeVisible();

    // WHEN: Settings are saved
    // (already complete)

    // THEN: Next refresh time is displayed
    const nextRefreshDisplay = page.locator('[data-testid="next-epg-refresh-display"]');
    await expect(nextRefreshDisplay).toBeVisible();
    await expect(nextRefreshDisplay).toContainText('3:00');
  });

  test('should validate time format', async ({ page }) => {
    // GIVEN: User is on Settings view
    const timeInput = page.locator('[data-testid="epg-refresh-time-input"]');

    // WHEN: User clears the time input (making it empty/invalid)
    // HTML5 time input won't accept values like "25:00" via fill()
    // Instead, we clear the input to trigger validation
    await timeInput.clear();

    // THEN: Save button should be disabled when no changes made (value same as saved)
    // or enabled if there was a change (then validation will show error on save attempt)
    // Since clearing doesn't change from saved value if it was already empty,
    // let's first make a change and then test validation
    // Actually, a cleared time input triggers validation error in our component
    const saveButton = page.locator('[data-testid="save-settings-button"]');
    // When time is cleared, validation error should prevent saving
    // However, the component may not have validation for empty time
    // Let's verify the time input is required for changes to be saveable
    await expect(saveButton).toBeDisabled();
  });

  test('should persist EPG refresh time across page reloads', async ({ page }) => {
    // Clear any persisted state from previous tests
    await page.evaluate(() => localStorage.removeItem('__TAURI_MOCK_SETTINGS__'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // GIVEN: User has set refresh time to 4:30 AM
    const timeInput = page.locator('[data-testid="epg-refresh-time-input"]');
    await timeInput.fill('04:30');
    await page.click('[data-testid="save-settings-button"]');
    await expect(page.locator('[data-testid="settings-success-message"]')).toBeVisible();

    // WHEN: User reloads the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // THEN: Refresh time remains set to 4:30 AM
    await expect(timeInput).toHaveValue('04:30');
  });
});

test.describe('Settings GUI - Form Interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Tauri mock before navigation
    await injectSettingsStatefulMock(page);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should show unsaved changes indicator', async ({ page }) => {
    // GIVEN: User is on Settings view with no changes
    const unsavedIndicator = page.locator('[data-testid="unsaved-changes-indicator"]');
    await expect(unsavedIndicator).not.toBeVisible();

    // WHEN: User makes a change without saving
    await page.locator('[data-testid="server-port-input"]').fill('5010');

    // THEN: Unsaved changes indicator appears
    await expect(unsavedIndicator).toBeVisible();
  });

  test('should clear unsaved changes indicator after save', async ({ page }) => {
    // GIVEN: User has made unsaved changes
    await page.locator('[data-testid="server-port-input"]').fill('5010');
    const unsavedIndicator = page.locator('[data-testid="unsaved-changes-indicator"]');
    await expect(unsavedIndicator).toBeVisible();

    // WHEN: User saves the changes
    await page.click('[data-testid="save-settings-button"]');
    await expect(page.locator('[data-testid="settings-success-message"]')).toBeVisible();

    // THEN: Unsaved changes indicator disappears
    await expect(unsavedIndicator).not.toBeVisible();
  });

  test('should have cancel/reset button to revert unsaved changes', async ({ page }) => {
    // GIVEN: User has made unsaved changes
    const portInput = page.locator('[data-testid="server-port-input"]');
    const originalValue = await portInput.inputValue();
    await portInput.fill('5010');

    // WHEN: User clicks cancel/reset button
    await page.click('[data-testid="reset-settings-button"]');

    // THEN: Input values revert to saved state
    await expect(portInput).toHaveValue(originalValue);
  });
});
