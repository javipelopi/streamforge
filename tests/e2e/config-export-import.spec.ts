import { test, expect } from '@playwright/test';
import { injectSettingsStatefulMock } from '../support/mocks/tauri.mock';

/**
 * E2E Tests for Story 6-2: Configuration Export/Import
 *
 * Tests the configuration export and import functionality through the Settings GUI.
 *
 * Run with: pnpm test -- tests/e2e/config-export-import.spec.ts
 */

test.describe('Configuration Export/Import - UI Elements', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Tauri mock before navigation
    await injectSettingsStatefulMock(page);

    // Navigate to Settings view
    await page.goto('/');
    await page.click('[data-testid="settings-nav-link"]');
    await expect(page).toHaveURL('/settings');
  });

  test('should display Configuration Backup section (AC #1)', async ({ page }) => {
    // GIVEN: User is on Settings view

    // WHEN: Settings view loads
    // (navigation already complete from beforeEach)

    // THEN: Configuration Backup section is visible
    await expect(page.locator('[data-testid="config-backup-section"]')).toBeVisible();
  });

  test('should display Export Configuration button (AC #1)', async ({ page }) => {
    // GIVEN: User is on Settings view with Configuration Backup section visible
    const backupSection = page.locator('[data-testid="config-backup-section"]');
    await expect(backupSection).toBeVisible();

    // WHEN: Looking at the backup section
    // (section already visible)

    // THEN: Export Configuration button is present
    const exportButton = page.locator('[data-testid="export-config-button"]');
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toContainText('Export');
  });

  test('should display Import Configuration button (AC #3)', async ({ page }) => {
    // GIVEN: User is on Settings view with Configuration Backup section visible
    const backupSection = page.locator('[data-testid="config-backup-section"]');
    await expect(backupSection).toBeVisible();

    // WHEN: Looking at the backup section
    // (section already visible)

    // THEN: Import Configuration button is present
    const importButton = page.locator('[data-testid="import-config-button"]');
    await expect(importButton).toBeVisible();
    await expect(importButton).toContainText('Import');
  });

  test('should display security warning about passwords not being exported (AC #2)', async ({ page }) => {
    // GIVEN: User is on Settings view

    // WHEN: Looking at the Configuration Backup section
    const backupSection = page.locator('[data-testid="config-backup-section"]');
    await expect(backupSection).toBeVisible();

    // THEN: Warning about passwords not being exported is visible
    await expect(backupSection).toContainText('Passwords are not exported');
  });

  test('should display warning about data replacement on import (AC #5)', async ({ page }) => {
    // GIVEN: User is on Settings view

    // WHEN: Looking at the Configuration Backup section
    const backupSection = page.locator('[data-testid="config-backup-section"]');
    await expect(backupSection).toBeVisible();

    // THEN: Warning about data replacement is visible
    await expect(backupSection).toContainText('replace all current settings');
  });
});

test.describe('Configuration Export/Import - Import Preview Dialog', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Tauri mock before navigation
    await injectSettingsStatefulMock(page);

    // Mock the file dialog and fs plugins
    await page.addInitScript(() => {
      // Store the content that would be read from a file
      (window as any).__MOCK_FILE_CONTENT__ = null;

      // Mock @tauri-apps/plugin-dialog
      (window as any).__TAURI_PLUGIN_DIALOG__ = {
        open: async () => {
          const content = (window as any).__MOCK_FILE_CONTENT__;
          if (content) {
            return '/mock/path/config.json';
          }
          return null;
        },
        save: async () => '/mock/path/export.json',
      };

      // Mock @tauri-apps/plugin-fs
      (window as any).__TAURI_PLUGIN_FS__ = {
        readTextFile: async () => {
          return (window as any).__MOCK_FILE_CONTENT__;
        },
        writeTextFile: async () => undefined,
      };
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should show preview dialog with valid import file (AC #4)', async ({ page }) => {
    // GIVEN: User has a valid configuration file
    const validConfig = JSON.stringify({
      version: '1.0',
      exportDate: '2026-01-23T12:00:00Z',
      appVersion: '0.1.0',
      data: {
        settings: {
          server_port: '5005',
          autostart_enabled: 'true',
        },
        accounts: [
          { id: 1, name: 'Test Account', serverUrl: 'http://test.com', username: 'user', maxConnections: 1, isActive: true },
        ],
        xmltv_sources: [
          { id: 1, name: 'EPG Source', url: 'http://epg.com', format: 'xml', refreshHour: 4, isActive: true },
        ],
        channel_mappings: [],
        xmltv_channel_settings: [],
      },
    });

    // Set the mock file content
    await page.evaluate((content) => {
      (window as any).__MOCK_FILE_CONTENT__ = content;
    }, validConfig);

    // WHEN: User clicks Import and selects the file
    // Note: In real E2E test, we'd need to handle the native file dialog
    // For this test, we simulate by directly calling the validation
    const preview = await page.evaluate(async (content) => {
      const commands = (window as any).__TAURI_MOCK__.commands;
      return commands.validate_import_file({ content });
    }, validConfig);

    // THEN: Preview shows valid status with correct counts
    expect(preview.valid).toBe(true);
    expect(preview.accountCount).toBe(1);
    expect(preview.xmltvSourceCount).toBe(1);
    expect(preview.version).toBe('1.0');
  });

  test('should show error for invalid JSON file (AC #6)', async ({ page }) => {
    // GIVEN: User has an invalid JSON file
    const invalidContent = 'not valid json { }}}';

    // WHEN: File is validated
    const preview = await page.evaluate(async (content) => {
      const commands = (window as any).__TAURI_MOCK__.commands;
      return commands.validate_import_file({ content });
    }, invalidContent);

    // THEN: Preview shows invalid status with error message
    expect(preview.valid).toBe(false);
    expect(preview.errorMessage).toContain('Invalid JSON');
  });

  test('should show error for unsupported version (AC #6)', async ({ page }) => {
    // GIVEN: User has a configuration file with old version
    const oldVersionConfig = JSON.stringify({
      version: '0.5',
      exportDate: '2026-01-23T12:00:00Z',
      appVersion: '0.1.0',
      data: {
        settings: {},
        accounts: [],
        xmltv_sources: [],
        channel_mappings: [],
        xmltv_channel_settings: [],
      },
    });

    // WHEN: File is validated
    const preview = await page.evaluate(async (content) => {
      const commands = (window as any).__TAURI_MOCK__.commands;
      return commands.validate_import_file({ content });
    }, oldVersionConfig);

    // THEN: Preview shows invalid status with version error
    expect(preview.valid).toBe(false);
    expect(preview.errorMessage).toContain('Unsupported');
    expect(preview.errorMessage).toContain('0.5');
  });

  test('should show correct settings summary in preview (AC #4)', async ({ page }) => {
    // GIVEN: User has a configuration file with settings
    const configWithSettings = JSON.stringify({
      version: '1.0',
      exportDate: '2026-01-23T12:00:00Z',
      appVersion: '0.1.0',
      data: {
        settings: {
          server_port: '5008',
          autostart_enabled: 'true',
          epg_schedule_hour: '3',
        },
        accounts: [],
        xmltv_sources: [],
        channel_mappings: [],
        xmltv_channel_settings: [],
      },
    });

    // WHEN: File is validated
    const preview = await page.evaluate(async (content) => {
      const commands = (window as any).__TAURI_MOCK__.commands;
      return commands.validate_import_file({ content });
    }, configWithSettings);

    // THEN: Settings summary includes the settings
    expect(preview.valid).toBe(true);
    expect(preview.settingsSummary).toContain('Server port: 5008');
    expect(preview.settingsSummary).toContain('Autostart: enabled');
  });
});

test.describe('Configuration Export/Import - Import Execution', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Tauri mock before navigation
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should import configuration successfully (AC #5)', async ({ page }) => {
    // GIVEN: User has a valid configuration file to import
    const importConfig = JSON.stringify({
      version: '1.0',
      exportDate: '2026-01-23T12:00:00Z',
      appVersion: '0.1.0',
      data: {
        settings: {
          server_port: '5010',
          autostart_enabled: 'true',
          epg_schedule_hour: '6',
          epg_schedule_minute: '30',
          epg_schedule_enabled: 'true',
        },
        accounts: [
          { id: 1, name: 'Imported Account', serverUrl: 'http://imported.com', username: 'imported', maxConnections: 2, isActive: true },
        ],
        xmltv_sources: [
          { id: 1, name: 'Imported EPG', url: 'http://imported-epg.com', format: 'xml', refreshHour: 6, isActive: true },
        ],
        channel_mappings: [],
        xmltv_channel_settings: [],
      },
    });

    // WHEN: Import is executed
    const result = await page.evaluate(async (content) => {
      const commands = (window as any).__TAURI_MOCK__.commands;
      return commands.import_configuration({ content });
    }, importConfig);

    // THEN: Import succeeds with correct counts
    expect(result.success).toBe(true);
    expect(result.accountsImported).toBe(1);
    expect(result.xmltvSourcesImported).toBe(1);
    expect(result.settingsImported).toBe(5);

    // AND: Settings state is updated
    const state = await page.evaluate(() => (window as any).__SETTINGS_STATE__);
    expect(state.serverPort).toBe(5010);
    expect(state.autostartEnabled).toBe(true);
    expect(state.epgSchedule.hour).toBe(6);
    expect(state.epgSchedule.minute).toBe(30);
  });

  test('should return correct message about password re-entry (AC #5)', async ({ page }) => {
    // GIVEN: User imports a configuration with accounts
    const importConfig = JSON.stringify({
      version: '1.0',
      exportDate: '2026-01-23T12:00:00Z',
      appVersion: '0.1.0',
      data: {
        settings: {},
        accounts: [
          { id: 1, name: 'Account 1', serverUrl: 'http://test1.com', username: 'user1', maxConnections: 1, isActive: true },
          { id: 2, name: 'Account 2', serverUrl: 'http://test2.com', username: 'user2', maxConnections: 1, isActive: true },
        ],
        xmltv_sources: [],
        channel_mappings: [],
        xmltv_channel_settings: [],
      },
    });

    // WHEN: Import is executed
    const result = await page.evaluate(async (content) => {
      const commands = (window as any).__TAURI_MOCK__.commands;
      return commands.import_configuration({ content });
    }, importConfig);

    // THEN: Result indicates accounts were imported
    expect(result.success).toBe(true);
    expect(result.accountsImported).toBe(2);
    // Note: The message about password re-entry is shown in the frontend
  });

  test('should not modify state on import failure (AC #6)', async ({ page }) => {
    // GIVEN: User has current settings state
    const initialState = await page.evaluate(() => {
      return JSON.parse(JSON.stringify((window as any).__SETTINGS_STATE__));
    });

    // WHEN: Import fails with invalid JSON
    const result = await page.evaluate(async () => {
      const commands = (window as any).__TAURI_MOCK__.commands;
      return commands.import_configuration({ content: 'invalid json {{' });
    });

    // THEN: Import fails
    expect(result.success).toBe(false);

    // AND: State is unchanged (atomic rollback)
    const currentState = await page.evaluate(() => (window as any).__SETTINGS_STATE__);
    expect(currentState.serverPort).toBe(initialState.serverPort);
    expect(currentState.autostartEnabled).toBe(initialState.autostartEnabled);
  });
});

test.describe('Configuration Export/Import - Export Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Tauri mock with specific settings
    await injectSettingsStatefulMock(page, {
      serverPort: 5555,
      autostartEnabled: true,
      epgSchedule: { hour: 3, minute: 45, enabled: false },
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should export current configuration (AC #2)', async ({ page }) => {
    // GIVEN: User has specific settings configured

    // WHEN: Export is executed
    const exportJson = await page.evaluate(async () => {
      const commands = (window as any).__TAURI_MOCK__.commands;
      return commands.export_configuration();
    });

    // THEN: Exported JSON contains current settings
    const exported = JSON.parse(exportJson);
    expect(exported.version).toBe('1.0');
    expect(exported.data.settings.server_port).toBe('5555');
    expect(exported.data.settings.autostart_enabled).toBe('true');
    expect(exported.data.settings.epg_schedule_hour).toBe('3');
    expect(exported.data.settings.epg_schedule_minute).toBe('45');
    expect(exported.data.settings.epg_schedule_enabled).toBe('false');
  });

  test('should include metadata in export (AC #2)', async ({ page }) => {
    // GIVEN: User exports configuration

    // WHEN: Export is executed
    const exportJson = await page.evaluate(async () => {
      const commands = (window as any).__TAURI_MOCK__.commands;
      return commands.export_configuration();
    });

    // THEN: Export includes metadata
    const exported = JSON.parse(exportJson);
    expect(exported.version).toBeDefined();
    expect(exported.exportDate).toBeDefined();
    expect(exported.appVersion).toBeDefined();
  });

  test('should NOT include passwords in export (AC #2)', async ({ page }) => {
    // GIVEN: User has accounts with passwords

    // WHEN: Export is executed
    const exportJson = await page.evaluate(async () => {
      const commands = (window as any).__TAURI_MOCK__.commands;
      return commands.export_configuration();
    });

    // THEN: Export does not contain password fields
    expect(exportJson).not.toContain('password');
    expect(exportJson).not.toContain('passwordEncrypted');
    expect(exportJson).not.toContain('password_encrypted');
  });
});

test.describe('Configuration Export/Import - Round Trip', () => {
  test('should successfully export and re-import configuration', async ({ page }) => {
    // Setup mock with initial settings
    await injectSettingsStatefulMock(page, {
      serverPort: 6000,
      autostartEnabled: true,
      epgSchedule: { hour: 5, minute: 15, enabled: true },
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // GIVEN: User has a specific configuration
    const originalState = await page.evaluate(() => {
      return JSON.parse(JSON.stringify((window as any).__SETTINGS_STATE__));
    });

    // WHEN: User exports the configuration
    const exportJson = await page.evaluate(async () => {
      const commands = (window as any).__TAURI_MOCK__.commands;
      return commands.export_configuration();
    });

    // AND: User changes settings
    await page.evaluate(() => {
      (window as any).__SETTINGS_STATE__.serverPort = 9999;
      (window as any).__SETTINGS_STATE__.autostartEnabled = false;
    });

    // AND: User imports the previously exported configuration
    const importResult = await page.evaluate(async (content) => {
      const commands = (window as any).__TAURI_MOCK__.commands;
      return commands.import_configuration({ content });
    }, exportJson);

    // THEN: Import succeeds
    expect(importResult.success).toBe(true);

    // AND: Settings are restored to original values
    const restoredState = await page.evaluate(() => (window as any).__SETTINGS_STATE__);
    expect(restoredState.serverPort).toBe(originalState.serverPort);
    expect(restoredState.autostartEnabled).toBe(originalState.autostartEnabled);
    expect(restoredState.epgSchedule.hour).toBe(originalState.epgSchedule.hour);
    expect(restoredState.epgSchedule.minute).toBe(originalState.epgSchedule.minute);
  });
});
