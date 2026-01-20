import { test, expect, Page } from '@playwright/test';
import {
  createXmltvChannelWithMappings,
  createXmltvChannelWithNoMatches,
  XmltvChannelWithMappings,
} from '../support/factories/xmltv-channel-display.factory';

/**
 * E2E Tests for Story 3-7: Bulk Channel Operations
 *
 * Tests the complete user journey of bulk enabling/disabling XMLTV channels
 * using checkboxes and bulk action toolbar.
 *
 * ATDD Pattern: RED Phase - These tests MUST fail initially
 * - Tests define expected behavior before implementation exists
 * - Failures should be due to missing implementation, not test bugs
 * - Once implementation is done, tests should pass (GREEN phase)
 */

/**
 * BulkToggleResult from backend
 */
interface BulkToggleResult {
  successCount: number;
  skippedCount: number;
  skippedIds: number[];
}

/**
 * Inject Tauri mock with bulk channel operations commands
 */
async function injectBulkChannelMocks(
  page: Page,
  channelsData: XmltvChannelWithMappings[]
) {
  const mockScript = `
    (function() {
      // State storage
      window.__XMLTV_CHANNELS_STATE__ = {
        channels: ${JSON.stringify(channelsData)},
      };

      const mockCommands = {
        greet: (args) => \`Hello, \${args.name}! Welcome to StreamForge.\`,
        get_setting: () => null,
        set_setting: () => undefined,
        get_server_port: () => 5004,
        set_server_port: () => undefined,
        get_autostart_enabled: () => ({ enabled: false }),
        set_autostart_enabled: () => undefined,
        get_accounts: () => [],

        // Get XMLTV channels with mappings
        get_xmltv_channels_with_mappings: () => {
          console.log('[Mock] get_xmltv_channels_with_mappings called');
          return window.__XMLTV_CHANNELS_STATE__.channels;
        },

        // Single channel toggle (from Story 3-5)
        toggle_xmltv_channel: (args) => {
          console.log('[Mock] toggle_xmltv_channel:', args);
          const channel = window.__XMLTV_CHANNELS_STATE__.channels.find(
            ch => ch.id === args.channelId
          );

          if (!channel) {
            throw new Error('Channel not found');
          }

          if (!channel.isEnabled && channel.matchCount === 0) {
            throw new Error('Cannot enable channel: No stream source available.');
          }

          channel.isEnabled = !channel.isEnabled;
          return channel;
        },

        // Bulk toggle channels (Story 3-7)
        bulk_toggle_channels: (args) => {
          console.log('[Mock] bulk_toggle_channels:', args);
          const { channelIds, enabled } = args;

          let successCount = 0;
          const skippedIds = [];

          for (const channelId of channelIds) {
            const channel = window.__XMLTV_CHANNELS_STATE__.channels.find(
              ch => ch.id === channelId
            );

            if (!channel) {
              console.warn('[Mock] Channel not found:', channelId);
              continue;
            }

            // If enabling, check if channel has matched streams
            if (enabled && channel.matchCount === 0) {
              skippedIds.push(channelId);
              continue;
            }

            // Update enabled state
            channel.isEnabled = enabled;
            successCount++;
          }

          const result = {
            successCount,
            skippedCount: skippedIds.length,
            skippedIds,
          };

          console.log('[Mock] bulk_toggle_channels result:', result);
          return result;
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

      // Set up Tauri V2 internals mock
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

      window.__TAURI__ = {
        invoke: mockInvoke,
      };

      window.__TAURI_MOCK__ = {
        invoke: mockInvoke,
        commands: mockCommands,
      };

      console.log('[Tauri Mock] Bulk channel operations mock initialized');
    })();
  `;

  await page.addInitScript(mockScript);
}

test.describe('Bulk Channel Operations (Story 3-7)', () => {
  test.beforeEach(async ({ page }) => {
    // Network-first: Intercept BEFORE navigation
    await page.route('**/*.{png,jpg,jpeg,svg,gif}', (route) => route.abort());
  });

  test('AC1: should show bulk action toolbar when multiple channels are selected', async ({ page }) => {
    // GIVEN: The Channels view with multiple XMLTV channels
    const channels = [
      createXmltvChannelWithMappings({ id: 1, displayName: 'ESPN', matchCount: 2, isEnabled: false }),
      createXmltvChannelWithMappings({ id: 2, displayName: 'CNN', matchCount: 1, isEnabled: false }),
      createXmltvChannelWithMappings({ id: 3, displayName: 'HBO', matchCount: 3, isEnabled: true }),
    ];

    await injectBulkChannelMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');
    await page.waitForLoadState('networkidle');

    // THEN: Bulk action toolbar is not visible initially
    const toolbar = page.locator('[data-testid="bulk-action-toolbar"]');
    await expect(toolbar).not.toBeVisible();

    // WHEN: I select multiple XMLTV channels using checkboxes
    await page.locator('[data-testid="channel-checkbox-1"]').check();
    await page.locator('[data-testid="channel-checkbox-2"]').check();

    // THEN: Bulk action toolbar appears
    await expect(toolbar).toBeVisible();

    // THEN: Toolbar shows correct selection count
    await expect(toolbar).toContainText('2 channels selected');
  });

  test('AC1: should hide bulk action toolbar when all selections are cleared', async ({ page }) => {
    // GIVEN: Multiple channels with some selected
    const channels = [
      createXmltvChannelWithMappings({ id: 1, displayName: 'ESPN', matchCount: 2 }),
      createXmltvChannelWithMappings({ id: 2, displayName: 'CNN', matchCount: 1 }),
    ];

    await injectBulkChannelMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // WHEN: I select channels
    await page.locator('[data-testid="channel-checkbox-1"]').check();
    await page.locator('[data-testid="channel-checkbox-2"]').check();

    const toolbar = page.locator('[data-testid="bulk-action-toolbar"]');
    await expect(toolbar).toBeVisible();

    // WHEN: I clear all selections
    await page.locator('[data-testid="channel-checkbox-1"]').uncheck();
    await page.locator('[data-testid="channel-checkbox-2"]').uncheck();

    // THEN: Toolbar is hidden
    await expect(toolbar).not.toBeVisible();
  });

  test('AC2: should enable selected channels with matched streams', async ({ page }) => {
    // GIVEN: Multiple channels are selected (all with matched streams)
    const channels = [
      createXmltvChannelWithMappings({ id: 1, displayName: 'ESPN', matchCount: 2, isEnabled: false }),
      createXmltvChannelWithMappings({ id: 2, displayName: 'CNN', matchCount: 1, isEnabled: false }),
      createXmltvChannelWithMappings({ id: 3, displayName: 'HBO', matchCount: 3, isEnabled: false }),
    ];

    await injectBulkChannelMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // WHEN: I select multiple channels
    await page.locator('[data-testid="channel-checkbox-1"]').check();
    await page.locator('[data-testid="channel-checkbox-2"]').check();
    await page.locator('[data-testid="channel-checkbox-3"]').check();

    // WHEN: I click "Enable Selected"
    await page.locator('[data-testid="bulk-action-toolbar"]').locator('button', { hasText: 'Enable Selected' }).click();

    // THEN: All selected channels with matched streams are enabled
    await expect(page.locator('[data-testid="channel-row-1"]').locator('[data-testid="channel-toggle"]')).toBeChecked();
    await expect(page.locator('[data-testid="channel-row-2"]').locator('[data-testid="channel-toggle"]')).toBeChecked();
    await expect(page.locator('[data-testid="channel-row-3"]').locator('[data-testid="channel-toggle"]')).toBeChecked();

    // THEN: Success toast is shown
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText(/Enabled 3 channels/i);

    // THEN: Selection is cleared after operation
    await expect(page.locator('[data-testid="bulk-action-toolbar"]')).not.toBeVisible();
  });

  test('AC2: should show warning count when enabling channels without streams', async ({ page }) => {
    // GIVEN: Multiple channels selected, some without matched streams
    const channels = [
      createXmltvChannelWithMappings({ id: 1, displayName: 'ESPN', matchCount: 2, isEnabled: false }),
      createXmltvChannelWithNoMatches({ id: 2, displayName: 'Local TV', isEnabled: false }),
      createXmltvChannelWithNoMatches({ id: 3, displayName: 'Community Channel', isEnabled: false }),
      createXmltvChannelWithMappings({ id: 4, displayName: 'HBO', matchCount: 1, isEnabled: false }),
    ];

    await injectBulkChannelMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // WHEN: I select all channels (including unmatched)
    await page.locator('[data-testid="channel-checkbox-1"]').check();
    await page.locator('[data-testid="channel-checkbox-2"]').check();
    await page.locator('[data-testid="channel-checkbox-3"]').check();
    await page.locator('[data-testid="channel-checkbox-4"]').check();

    // WHEN: I click "Enable Selected"
    await page.locator('[data-testid="bulk-action-toolbar"]').locator('button', { hasText: 'Enable Selected' }).click();

    // THEN: Channels with streams are enabled
    await expect(page.locator('[data-testid="channel-row-1"]').locator('[data-testid="channel-toggle"]')).toBeChecked();
    await expect(page.locator('[data-testid="channel-row-4"]').locator('[data-testid="channel-toggle"]')).toBeChecked();

    // THEN: Channels without streams remain disabled
    await expect(page.locator('[data-testid="channel-row-2"]').locator('[data-testid="channel-toggle"]')).not.toBeChecked();
    await expect(page.locator('[data-testid="channel-row-3"]').locator('[data-testid="channel-toggle"]')).not.toBeChecked();

    // THEN: Success toast shows enabled count
    const successToast = page.locator('[data-testid="toast"]').first();
    await expect(successToast).toBeVisible({ timeout: 5000 });
    await expect(successToast).toContainText(/Enabled 2 channels/i);

    // THEN: Warning toast shows skipped count
    const warningToast = page.locator('[data-testid="toast"]').last();
    await expect(warningToast).toBeVisible({ timeout: 7000 });
    await expect(warningToast).toContainText(/Skipped 2 channels without streams/i);
  });

  test('AC3: should disable all selected channels', async ({ page }) => {
    // GIVEN: Multiple channels are selected (mix of enabled and disabled)
    const channels = [
      createXmltvChannelWithMappings({ id: 1, displayName: 'ESPN', matchCount: 2, isEnabled: true }),
      createXmltvChannelWithMappings({ id: 2, displayName: 'CNN', matchCount: 1, isEnabled: true }),
      createXmltvChannelWithMappings({ id: 3, displayName: 'HBO', matchCount: 3, isEnabled: false }),
    ];

    await injectBulkChannelMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // WHEN: I select multiple channels
    await page.locator('[data-testid="channel-checkbox-1"]').check();
    await page.locator('[data-testid="channel-checkbox-2"]').check();
    await page.locator('[data-testid="channel-checkbox-3"]').check();

    // WHEN: I click "Disable Selected"
    await page.locator('[data-testid="bulk-action-toolbar"]').locator('button', { hasText: 'Disable Selected' }).click();

    // THEN: All selected channels are disabled
    await expect(page.locator('[data-testid="channel-row-1"]').locator('[data-testid="channel-toggle"]')).not.toBeChecked();
    await expect(page.locator('[data-testid="channel-row-2"]').locator('[data-testid="channel-toggle"]')).not.toBeChecked();
    await expect(page.locator('[data-testid="channel-row-3"]').locator('[data-testid="channel-toggle"]')).not.toBeChecked();

    // THEN: Success toast is shown
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText(/Disabled 3 channels/i);
  });

  test('AC4: should select all matched channels when clicking "Select All Matched"', async ({ page }) => {
    // GIVEN: The Channels view with mix of matched and unmatched channels
    const channels = [
      createXmltvChannelWithMappings({ id: 1, displayName: 'ESPN', matchCount: 2 }),
      createXmltvChannelWithNoMatches({ id: 2, displayName: 'Local TV' }),
      createXmltvChannelWithMappings({ id: 3, displayName: 'HBO', matchCount: 1 }),
      createXmltvChannelWithNoMatches({ id: 4, displayName: 'Community Channel' }),
      createXmltvChannelWithMappings({ id: 5, displayName: 'CNN', matchCount: 3 }),
    ];

    await injectBulkChannelMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // WHEN: I click "Select All Matched"
    await page.locator('button', { hasText: 'Select All Matched' }).click();

    // THEN: Only XMLTV channels with at least one Xtream stream are selected
    await expect(page.locator('[data-testid="channel-checkbox-1"]')).toBeChecked();
    await expect(page.locator('[data-testid="channel-checkbox-2"]')).not.toBeChecked();
    await expect(page.locator('[data-testid="channel-checkbox-3"]')).toBeChecked();
    await expect(page.locator('[data-testid="channel-checkbox-4"]')).not.toBeChecked();
    await expect(page.locator('[data-testid="channel-checkbox-5"]')).toBeChecked();

    // THEN: Bulk action toolbar shows correct count
    await expect(page.locator('[data-testid="bulk-action-toolbar"]')).toContainText('3 channels selected');
  });

  test('AC4: should show matched count in "Select All Matched" button text', async ({ page }) => {
    // GIVEN: The Channels view with multiple matched channels
    const channels = [
      createXmltvChannelWithMappings({ id: 1, displayName: 'ESPN', matchCount: 2 }),
      createXmltvChannelWithNoMatches({ id: 2, displayName: 'Local TV' }),
      createXmltvChannelWithMappings({ id: 3, displayName: 'HBO', matchCount: 1 }),
      createXmltvChannelWithMappings({ id: 4, displayName: 'CNN', matchCount: 3 }),
    ];

    await injectBulkChannelMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // THEN: Button shows count of matched channels
    const selectAllButton = page.locator('button', { hasText: 'Select All Matched' });
    await expect(selectAllButton).toContainText('Select All Matched (3)');
  });

  test('AC5: should only select filtered channels when category filter is applied', async ({ page }) => {
    // GIVEN: The Channels view has category filters
    const channels = [
      createXmltvChannelWithMappings({ id: 1, displayName: 'ESPN Sports', matchCount: 2, isEnabled: false }),
      createXmltvChannelWithMappings({ id: 2, displayName: 'Fox Sports', matchCount: 1, isEnabled: false }),
      createXmltvChannelWithMappings({ id: 3, displayName: 'CNN News', matchCount: 3, isEnabled: false }),
      createXmltvChannelWithMappings({ id: 4, displayName: 'BBC News', matchCount: 1, isEnabled: false }),
    ];

    await injectBulkChannelMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // WHEN: I filter by XMLTV category (e.g., "Sports")
    // NOTE: Category filtering requires categories in channel data or inferred from names
    // For this test, assume a simple text filter or category dropdown exists
    const categoryFilter = page.locator('[data-testid="category-filter"]');
    await categoryFilter.selectOption('Sports');

    // THEN: Only Sports channels are visible
    await expect(page.locator('[data-testid="channel-row-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="channel-row-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="channel-row-3"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="channel-row-4"]')).not.toBeVisible();

    // WHEN: I click "Select All" (the visible/filtered channels button, not "Select All Matched")
    await page.getByRole('button', { name: 'Select All', exact: true }).click();

    // THEN: Only filtered (visible) channels are selected
    await expect(page.locator('[data-testid="channel-checkbox-1"]')).toBeChecked();
    await expect(page.locator('[data-testid="channel-checkbox-2"]')).toBeChecked();

    // THEN: Bulk action toolbar shows correct count
    await expect(page.locator('[data-testid="bulk-action-toolbar"]')).toContainText('2 channels selected');

    // WHEN: I perform bulk enable
    await page.locator('[data-testid="bulk-action-toolbar"]').locator('button', { hasText: 'Enable Selected' }).click();

    // THEN: Only selected (filtered) channels are enabled
    await expect(page.locator('[data-testid="channel-row-1"]').locator('[data-testid="channel-toggle"]')).toBeChecked();
    await expect(page.locator('[data-testid="channel-row-2"]').locator('[data-testid="channel-toggle"]')).toBeChecked();
  });

  test('Integration: should clear selection after bulk operation completes', async ({ page }) => {
    // GIVEN: Multiple channels selected
    const channels = [
      createXmltvChannelWithMappings({ id: 1, displayName: 'ESPN', matchCount: 2, isEnabled: false }),
      createXmltvChannelWithMappings({ id: 2, displayName: 'CNN', matchCount: 1, isEnabled: false }),
    ];

    await injectBulkChannelMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    await page.locator('[data-testid="channel-checkbox-1"]').check();
    await page.locator('[data-testid="channel-checkbox-2"]').check();

    // WHEN: I perform bulk enable
    await page.locator('[data-testid="bulk-action-toolbar"]').locator('button', { hasText: 'Enable Selected' }).click();

    // THEN: Selection is cleared
    await expect(page.locator('[data-testid="channel-checkbox-1"]')).not.toBeChecked();
    await expect(page.locator('[data-testid="channel-checkbox-2"]')).not.toBeChecked();

    // THEN: Toolbar is hidden
    await expect(page.locator('[data-testid="bulk-action-toolbar"]')).not.toBeVisible();
  });

  test('Integration: should update enabled count in header after bulk operation', async ({ page }) => {
    // GIVEN: Multiple channels with mixed enabled states
    const channels = [
      createXmltvChannelWithMappings({ id: 1, displayName: 'ESPN', matchCount: 2, isEnabled: false }),
      createXmltvChannelWithMappings({ id: 2, displayName: 'CNN', matchCount: 1, isEnabled: false }),
      createXmltvChannelWithMappings({ id: 3, displayName: 'HBO', matchCount: 3, isEnabled: true }),
    ];

    await injectBulkChannelMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // THEN: Initial enabled count
    await expect(page.locator('[data-testid="enabled-count"]')).toHaveText('1 enabled');

    // WHEN: I bulk enable 2 disabled channels
    await page.locator('[data-testid="channel-checkbox-1"]').check();
    await page.locator('[data-testid="channel-checkbox-2"]').check();
    await page.locator('[data-testid="bulk-action-toolbar"]').locator('button', { hasText: 'Enable Selected' }).click();

    // THEN: Enabled count updates
    await expect(page.locator('[data-testid="enabled-count"]')).toHaveText('3 enabled');
  });

  test('Accessibility: bulk action toolbar buttons are keyboard accessible', async ({ page }) => {
    // GIVEN: Multiple channels selected
    const channels = [
      createXmltvChannelWithMappings({ id: 1, displayName: 'ESPN', matchCount: 2 }),
      createXmltvChannelWithMappings({ id: 2, displayName: 'CNN', matchCount: 1 }),
    ];

    await injectBulkChannelMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    await page.locator('[data-testid="channel-checkbox-1"]').check();
    await page.locator('[data-testid="channel-checkbox-2"]').check();

    // WHEN: Navigating to bulk action buttons via keyboard
    const enableButton = page.locator('[data-testid="bulk-action-toolbar"]').locator('button', { hasText: 'Enable Selected' });
    const disableButton = page.locator('[data-testid="bulk-action-toolbar"]').locator('button', { hasText: 'Disable Selected' });
    const clearButton = page.locator('[data-testid="bulk-action-toolbar"]').locator('button', { hasText: 'Clear Selection' });

    // THEN: All buttons are focusable and have proper accessibility attributes
    await expect(enableButton).toBeVisible();
    await expect(enableButton).toBeEnabled();
    await expect(enableButton).toHaveAttribute('type', 'button');

    await expect(disableButton).toBeVisible();
    await expect(disableButton).toBeEnabled();
    await expect(disableButton).toHaveAttribute('type', 'button');

    await expect(clearButton).toBeVisible();
    await expect(clearButton).toBeEnabled();
    await expect(clearButton).toHaveAttribute('type', 'button');

    // THEN: Buttons can receive focus
    await enableButton.focus();
    await expect(enableButton).toBeFocused();
  });

  test('Accessibility: checkboxes have proper labels and keyboard support', async ({ page }) => {
    // GIVEN: Channel row with checkbox
    const channels = [
      createXmltvChannelWithMappings({ id: 1, displayName: 'ESPN', matchCount: 2 }),
    ];

    await injectBulkChannelMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    const checkbox = page.locator('[data-testid="channel-checkbox-1"]');

    // THEN: Checkbox has proper accessibility attributes
    await expect(checkbox).toBeVisible();
    await expect(checkbox).toHaveAttribute('type', 'checkbox');
    await expect(checkbox).toHaveAttribute('aria-label', /Select ESPN/i);

    // THEN: Checkbox can receive focus
    await checkbox.focus();
    await expect(checkbox).toBeFocused();

    // THEN: Checkbox can be toggled via keyboard (Space key)
    await checkbox.press('Space');
    await expect(checkbox).toBeChecked();

    await checkbox.press('Space');
    await expect(checkbox).not.toBeChecked();
  });

  test('Error handling: should show toast on bulk operation backend error', async ({ page }) => {
    // GIVEN: Mock that throws error on bulk toggle
    const channels = [
      createXmltvChannelWithMappings({ id: 1, displayName: 'ESPN', matchCount: 2, isEnabled: false }),
      createXmltvChannelWithMappings({ id: 2, displayName: 'CNN', matchCount: 1, isEnabled: false }),
    ];

    const mockScript = `
      (function() {
        window.__XMLTV_CHANNELS_STATE__ = {
          channels: ${JSON.stringify(channels)},
        };

        const mockCommands = {
          greet: () => 'Hello',
          get_setting: () => null,
          set_setting: () => undefined,
          get_server_port: () => 5004,
          set_server_port: () => undefined,
          get_autostart_enabled: () => ({ enabled: false }),
          set_autostart_enabled: () => undefined,
          get_accounts: () => [],
          get_xmltv_channels_with_mappings: () => {
            return window.__XMLTV_CHANNELS_STATE__.channels;
          },
          bulk_toggle_channels: () => {
            console.log('[Mock] bulk_toggle_channels - throwing error');
            throw new Error('Database transaction failed');
          },
        };

        async function mockInvoke(cmd, args = {}) {
          if (mockCommands[cmd]) {
            try {
              return await Promise.resolve(mockCommands[cmd](args));
            } catch (error) {
              console.error('[Tauri Mock] Error:', cmd, error);
              throw error;
            }
          }
          return null;
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

    await page.addInitScript(mockScript);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // WHEN: I try to perform bulk enable (will fail)
    await page.locator('[data-testid="channel-checkbox-1"]').check();
    await page.locator('[data-testid="channel-checkbox-2"]').check();
    await page.locator('[data-testid="bulk-action-toolbar"]').locator('button', { hasText: 'Enable Selected' }).click();

    // THEN: Error toast is displayed
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText(/Failed|error|Database/i);
  });

  test('Performance: should handle large selection efficiently', async ({ page }) => {
    // GIVEN: A large list of channels
    const channels = Array.from({ length: 50 }, (_, i) =>
      createXmltvChannelWithMappings({
        id: i + 1,
        displayName: `Channel ${i + 1}`,
        matchCount: i % 2 === 0 ? 2 : 1, // Alternate match counts
        isEnabled: false,
      })
    );

    await injectBulkChannelMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // WHEN: I select all matched channels
    await page.locator('button', { hasText: 'Select All Matched' }).click();

    // THEN: All 50 channels are selected
    await expect(page.locator('[data-testid="bulk-action-toolbar"]')).toContainText('50 channels selected');

    // WHEN: I perform bulk enable
    const startTime = Date.now();
    await page.locator('[data-testid="bulk-action-toolbar"]').locator('button', { hasText: 'Enable Selected' }).click();

    // Wait for success toast
    await expect(page.locator('[data-testid="toast"]')).toContainText(/Enabled 50 channels/i);
    const endTime = Date.now();

    // THEN: Operation completes in reasonable time (< 3 seconds)
    const duration = endTime - startTime;
    expect(duration).toBeLessThan(3000);
  });
});
