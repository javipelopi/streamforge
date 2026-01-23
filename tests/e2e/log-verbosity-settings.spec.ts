import { test, expect } from '@playwright/test';
import { injectSettingsStatefulMock } from '../support/mocks/tauri.mock';

/**
 * E2E Tests for Story 6-3: Log Verbosity Settings UI (AC #5)
 *
 * Tests the log verbosity toggle in the Settings view.
 *
 * Run with: pnpm test -- tests/e2e/log-verbosity-settings.spec.ts
 */

test.describe('Log Verbosity Settings: UI Elements (AC #5)', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Tauri mock with log verbosity support
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose', // Default
    });

    // Navigate to Settings view
    await page.goto('/');
    await page.click('[data-testid="settings-nav-link"]');
    await expect(page).toHaveURL('/settings');
  });

  test('AC #5: should display Logging Settings section', async ({ page }) => {
    // GIVEN: User is on Settings view

    // WHEN: Settings view loads
    // (navigation already complete from beforeEach)

    // THEN: Logging Settings section is visible
    await expect(page.locator('[data-testid="logging-section"]')).toBeVisible();
  });

  test('AC #5: should display Log Verbosity setting with dropdown', async ({ page }) => {
    // GIVEN: User is on Settings view

    // WHEN: Looking at Logging Settings section
    const loggingSection = page.locator('[data-testid="logging-section"]');
    await expect(loggingSection).toBeVisible();

    // THEN: Log Verbosity label is present
    await expect(loggingSection).toContainText('Log Verbosity');

    // AND: Dropdown/select is present
    const verbositySelect = page.locator('[data-testid="log-verbosity-select"]');
    await expect(verbositySelect).toBeVisible();

    // Expected failure: Element not found - data-testid="logging-section"
  });

  test('AC #5: should display verbosity options (Minimal and Verbose)', async ({ page }) => {
    // GIVEN: User is on Settings view

    // WHEN: Looking at Log Verbosity dropdown
    const verbositySelect = page.locator('[data-testid="log-verbosity-select"]');
    await expect(verbositySelect).toBeVisible();

    // THEN: Dropdown contains both options
    const options = await verbositySelect.locator('option').allTextContents();
    expect(options).toContain('Verbose');
    expect(options).toContain('Minimal');

    // Expected failure: Element not found - data-testid="log-verbosity-select"
  });

  test('should display description for Minimal option', async ({ page }) => {
    // GIVEN: User is on Settings view

    // WHEN: Looking at Logging Settings section
    const loggingSection = page.locator('[data-testid="logging-section"]');
    await expect(loggingSection).toBeVisible();

    // THEN: Description explains minimal mode
    await expect(loggingSection).toContainText('only warnings and errors');
    // OR alternative phrasing:
    const hasMinimalDesc = await loggingSection.textContent();
    expect(hasMinimalDesc).toMatch(/minimal.*warn.*error/i);

    // Expected failure: Element not found - data-testid="logging-section"
  });

  test('should display description for Verbose option', async ({ page }) => {
    // GIVEN: User is on Settings view

    // WHEN: Looking at Logging Settings section
    const loggingSection = page.locator('[data-testid="logging-section"]');
    await expect(loggingSection).toBeVisible();

    // THEN: Description explains verbose mode
    await expect(loggingSection).toContainText('all events including info');
    // OR alternative phrasing:
    const hasVerboseDesc = await loggingSection.textContent();
    expect(hasVerboseDesc).toMatch(/verbose.*all.*info/i);

    // Expected failure: Element not found - data-testid="logging-section"
  });
});

test.describe('Log Verbosity Settings: Default State', () => {
  test('should default to Verbose mode', async ({ page }) => {
    // GIVEN: Fresh settings (not previously configured)
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose', // Default
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // WHEN: Settings view loads

    // THEN: Log Verbosity is set to "Verbose"
    const verbositySelect = page.locator('[data-testid="log-verbosity-select"]');
    await expect(verbositySelect).toHaveValue('verbose');

    // Expected failure: Element not found - data-testid="log-verbosity-select"
  });

  test('should load saved verbosity setting', async ({ page }) => {
    // GIVEN: User previously set verbosity to minimal
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'minimal',
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // WHEN: Settings view loads

    // THEN: Log Verbosity reflects saved value
    const verbositySelect = page.locator('[data-testid="log-verbosity-select"]');
    await expect(verbositySelect).toHaveValue('minimal');

    // Expected failure: Element not found - data-testid="log-verbosity-select"
  });
});

test.describe('Log Verbosity Settings: Interaction', () => {
  test('should change verbosity from Verbose to Minimal', async ({ page }) => {
    // GIVEN: Verbosity is currently verbose
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const verbositySelect = page.locator('[data-testid="log-verbosity-select"]');
    await expect(verbositySelect).toHaveValue('verbose');

    // WHEN: User selects "Minimal"
    await verbositySelect.selectOption('minimal');

    // THEN: Selection changes immediately
    await expect(verbositySelect).toHaveValue('minimal');

    // Expected failure: Element not found - data-testid="log-verbosity-select"
  });

  test('should change verbosity from Minimal to Verbose', async ({ page }) => {
    // GIVEN: Verbosity is currently minimal
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'minimal',
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const verbositySelect = page.locator('[data-testid="log-verbosity-select"]');
    await expect(verbositySelect).toHaveValue('minimal');

    // WHEN: User selects "Verbose"
    await verbositySelect.selectOption('verbose');

    // THEN: Selection changes immediately
    await expect(verbositySelect).toHaveValue('verbose');

    // Expected failure: Element not found - data-testid="log-verbosity-select"
  });

  test('should save verbosity setting when Save button is clicked', async ({ page }) => {
    // GIVEN: User has changed verbosity
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const verbositySelect = page.locator('[data-testid="log-verbosity-select"]');
    await verbositySelect.selectOption('minimal');

    // WHEN: User clicks Save Settings
    const saveButton = page.locator('[data-testid="save-settings-button"]');
    await saveButton.click();

    // THEN: Setting is saved (verified by success message or state)
    // Note: The actual save mechanism depends on Settings.tsx implementation
    // This test verifies the UI triggers the save

    // Verify the command was called
    const savedValue = await page.evaluate(() => {
      return (window as any).__SETTINGS_STATE__.logVerbosity;
    });

    expect(savedValue).toBe('minimal');

    // Expected failure: Element not found - data-testid="log-verbosity-select"
  });
});

test.describe('Log Verbosity Settings: Persistence (AC #5)', () => {
  test('AC #5: should persist verbosity setting across app restarts', async ({ page }) => {
    // GIVEN: User sets verbosity to minimal and saves
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const verbositySelect = page.locator('[data-testid="log-verbosity-select"]');
    await verbositySelect.selectOption('minimal');

    const saveButton = page.locator('[data-testid="save-settings-button"]');
    await saveButton.click();

    // WHEN: Simulating app restart (reload page)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // THEN: Verbosity setting is still "minimal"
    const reloadedSelect = page.locator('[data-testid="log-verbosity-select"]');
    await expect(reloadedSelect).toHaveValue('minimal');

    // Expected failure: Element not found - data-testid="log-verbosity-select"
  });

  test.skip('should not lose verbosity setting when navigating away and back', async ({ page }) => {
    // GIVEN: User sets verbosity to minimal
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const verbositySelect = page.locator('[data-testid="log-verbosity-select"]');
    await verbositySelect.selectOption('minimal');

    const saveButton = page.locator('[data-testid="save-settings-button"]');
    await saveButton.click();

    // WHEN: Navigating to another view and back
    await page.click('[data-testid="dashboard-nav-link"]');
    await expect(page).toHaveURL('/');

    await page.click('[data-testid="settings-nav-link"]');
    await expect(page).toHaveURL('/settings');

    // THEN: Verbosity setting is preserved
    const preservedSelect = page.locator('[data-testid="log-verbosity-select"]');
    await expect(preservedSelect).toHaveValue('minimal');

    // Expected failure: Element not found - data-testid="log-verbosity-select"
  });
});

test.describe('Log Verbosity Settings: Integration with Logs View', () => {
  test.skip('should affect what events appear in Logs view', async ({ page }) => {
    // GIVEN: Verbosity is set to minimal
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'minimal',
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // WHEN: Triggering events that would log at different levels
    // Note: This would require integration with actual event logging
    // For now, this test documents the expected behavior

    // THEN: Navigate to Logs view and verify only warn/error appear
    await page.click('[data-testid="logs-nav-link"]');
    await expect(page).toHaveURL('/logs');

    // Verify no info level events are shown
    // (Actual implementation would depend on Logs.tsx filtering)

    // Expected failure: Element not found - data-testid="logging-section"
  });
});

test.describe('Log Verbosity Settings: Validation', () => {
  test('should only accept valid verbosity values', async ({ page }) => {
    // GIVEN: User is on Settings view
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // WHEN: Checking available options
    const verbositySelect = page.locator('[data-testid="log-verbosity-select"]');
    const options = await verbositySelect.locator('option').all();

    // THEN: Only "verbose" and "minimal" are available
    expect(options).toHaveLength(2);

    const optionValues = await Promise.all(
      options.map((opt) => opt.getAttribute('value'))
    );
    expect(optionValues).toEqual(expect.arrayContaining(['verbose', 'minimal']));

    // Expected failure: Element not found - data-testid="log-verbosity-select"
  });
});
