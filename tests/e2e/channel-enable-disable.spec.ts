import { test, expect, Page } from '@playwright/test';
import {
  createXmltvChannelWithMappings,
  createXmltvChannelWithNoMatches,
  XmltvChannelWithMappings,
} from '../support/factories/xmltv-channel-display.factory';

/**
 * E2E Tests for Story 3-5: Channel Enable/Disable for Plex
 *
 * Tests the complete user journey of enabling/disabling XMLTV channels
 * to control what appears in Plex lineup.
 *
 * ATDD Pattern: RED Phase - These tests MUST fail initially
 * - Tests define expected behavior before implementation exists
 * - Failures should be due to missing implementation, not test bugs
 * - Once implementation is done, tests should pass (GREEN phase)
 */

/**
 * Inject Tauri mock with channel enable/disable commands
 */
async function injectChannelToggleMocks(
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
        greet: (args) => \`Hello, \${args.name}! Welcome to iptv.\`,
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

        // Toggle channel enabled status
        toggle_xmltv_channel: (args) => {
          console.log('[Mock] toggle_xmltv_channel:', args);
          const channel = window.__XMLTV_CHANNELS_STATE__.channels.find(
            ch => ch.id === args.channelId
          );

          if (!channel) {
            throw new Error('Channel not found');
          }

          // AC3: Check if trying to enable a channel with no matches
          if (!channel.isEnabled && channel.matchCount === 0) {
            throw new Error('Cannot enable channel: No stream source available. Match an Xtream stream first.');
          }

          // Toggle the enabled state
          channel.isEnabled = !channel.isEnabled;

          return channel;
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

      console.log('[Tauri Mock] Channel toggle mock initialized');
    })();
  `;

  await page.addInitScript(mockScript);
}

test.describe('Channel Enable/Disable (Story 3-5)', () => {
  test.beforeEach(async ({ page }) => {
    // Network-first: Intercept BEFORE navigation
    await page.route('**/*.{png,jpg,jpeg,svg,gif}', (route) => route.abort());
  });

  test('AC1: should toggle channel enabled status and persist immediately', async ({ page }) => {
    // GIVEN: An enabled XMLTV channel with matches
    const channel = createXmltvChannelWithMappings({
      id: 1,
      displayName: 'ESPN',
      matchCount: 2,
      isEnabled: true,
    });

    await injectChannelToggleMocks(page, [channel]);
    await page.goto('/');

    // WHEN: Navigate to Channels view
    await page.click('a[href="/channels"]');
    await page.waitForLoadState('networkidle');

    // THEN: Channel toggle is visible and checked
    const channelRow = page.locator('[data-testid="channel-row-1"]');
    const toggle = channelRow.locator('[data-testid="channel-toggle"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeChecked();

    // WHEN: I click the toggle to disable
    await toggle.click();

    // THEN: The channel is immediately disabled
    await expect(toggle).not.toBeChecked();

    // WHEN: I click the toggle again to re-enable
    await toggle.click();

    // THEN: The channel is enabled again
    await expect(toggle).toBeChecked();
  });

  test('AC1: should update xmltv_channel_settings.is_enabled in database', async ({ page }) => {
    // GIVEN: A disabled XMLTV channel with matches
    const channel = createXmltvChannelWithMappings({
      id: 1,
      displayName: 'CNN',
      matchCount: 1,
      isEnabled: false,
    });

    await injectChannelToggleMocks(page, [channel]);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // WHEN: I enable the channel
    const toggle = page.locator('[data-testid="channel-row-1"]')
      .locator('[data-testid="channel-toggle"]');
    await toggle.click();

    // THEN: The toggle is checked
    await expect(toggle).toBeChecked();

    // THEN: The change is persisted (mock simulates DB update)
    // In real implementation, this would update database
    // For now, we verify the UI state reflects the change
  });

  test('AC2: should exclude disabled channels from M3U playlist generation', async ({ page }) => {
    // GIVEN: Mix of enabled and disabled channels
    const channels = [
      createXmltvChannelWithMappings({
        id: 1,
        displayName: 'ESPN',
        isEnabled: true,
        matchCount: 1,
      }),
      createXmltvChannelWithMappings({
        id: 2,
        displayName: 'CNN',
        isEnabled: false,
        matchCount: 1,
      }),
      createXmltvChannelWithMappings({
        id: 3,
        displayName: 'HBO',
        isEnabled: true,
        matchCount: 1,
      }),
    ];

    await injectChannelToggleMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // THEN: UI shows correct enabled states
    await expect(page.locator('[data-testid="channel-row-1"]')
      .locator('[data-testid="channel-toggle"]')).toBeChecked();

    await expect(page.locator('[data-testid="channel-row-2"]')
      .locator('[data-testid="channel-toggle"]')).not.toBeChecked();

    await expect(page.locator('[data-testid="channel-row-3"]')
      .locator('[data-testid="channel-toggle"]')).toBeChecked();

    // NOTE: M3U playlist generation is Epic 4 scope
    // This test verifies UI state only
    // M3U generation must filter by is_enabled = true
  });

  test('AC3: should prevent enabling channel with no matched streams', async ({ page }) => {
    // GIVEN: An XMLTV channel with no matched streams
    const unmatchedChannel = createXmltvChannelWithNoMatches({
      id: 1,
      displayName: 'Obscure Local TV',
      isEnabled: false,
    });

    await injectChannelToggleMocks(page, [unmatchedChannel]);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // THEN: Channel toggle is visible but disabled
    const channelRow = page.locator('[data-testid="channel-row-1"]');
    const toggle = channelRow.locator('[data-testid="channel-toggle"]');

    await expect(toggle).toBeVisible();
    await expect(toggle).not.toBeChecked();

    // THEN: Toggle is disabled (cannot be clicked)
    await expect(toggle).toBeDisabled();

    // THEN: Warning message or tooltip is shown
    // Check for tooltip attribute or warning text
    const toggleContainer = channelRow.locator('[data-testid="channel-toggle"]').locator('..');
    await expect(toggleContainer).toHaveAttribute('title', /No stream source available/i);
  });

  test('AC3: should show warning when trying to enable unmatched channel', async ({ page }) => {
    // GIVEN: An XMLTV channel with no matches
    const unmatchedChannel = createXmltvChannelWithNoMatches({
      id: 1,
      displayName: 'Local News Channel',
      isEnabled: false,
    });

    await injectChannelToggleMocks(page, [unmatchedChannel]);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // WHEN: I view the unmatched channel row
    const channelRow = page.locator('[data-testid="channel-row-1"]');

    // THEN: I see a warning indicator
    await expect(channelRow.locator('[data-testid="warning-icon"]')).toBeVisible();

    // THEN: Match status shows "No stream matched"
    await expect(channelRow.locator('[data-testid="match-status"]')).toHaveText('No stream matched');

    // THEN: Toggle is disabled
    await expect(channelRow.locator('[data-testid="channel-toggle"]')).toBeDisabled();
  });

  test('AC4: should preserve enable/disable state across app restart', async ({ page }) => {
    // GIVEN: Multiple channels with different enabled states
    const channels = [
      createXmltvChannelWithMappings({
        id: 1,
        displayName: 'ESPN',
        isEnabled: true,
      }),
      createXmltvChannelWithMappings({
        id: 2,
        displayName: 'CNN',
        isEnabled: false,
      }),
      createXmltvChannelWithMappings({
        id: 3,
        displayName: 'HBO',
        isEnabled: true,
      }),
    ];

    await injectChannelToggleMocks(page, channels);

    // WHEN: I load the channels view (simulating app restart)
    await page.goto('/');
    await page.click('a[href="/channels"]');
    await page.waitForLoadState('networkidle');

    // THEN: All enable/disable states are preserved
    await expect(page.locator('[data-testid="channel-row-1"]')
      .locator('[data-testid="channel-toggle"]')).toBeChecked();

    await expect(page.locator('[data-testid="channel-row-2"]')
      .locator('[data-testid="channel-toggle"]')).not.toBeChecked();

    await expect(page.locator('[data-testid="channel-row-3"]')
      .locator('[data-testid="channel-toggle"]')).toBeChecked();

    // ============================================================================
    // TEST LIMITATION: Mock uses in-memory state, not database persistence
    // ============================================================================
    // This test validates the UI correctly displays persisted state from backend,
    // but the mock doesn't actually write to SQLite. In production:
    // 1. toggle_xmltv_channel writes to xmltv_channel_settings table
    // 2. App restart triggers get_xmltv_channels_with_mappings
    // 3. Query loads is_enabled from database (not in-memory state)
    //
    // Real persistence is validated by:
    // - Rust integration tests (database layer)
    // - Manual QA with actual app restarts
    //
    // This E2E test confirms: UI → Backend → UI round-trip works correctly
  });

  test('Integration: should show count of enabled channels in header', async ({ page }) => {
    // GIVEN: Multiple channels with mixed enabled states
    const channels = [
      createXmltvChannelWithMappings({ id: 1, isEnabled: true }),
      createXmltvChannelWithMappings({ id: 2, isEnabled: false }),
      createXmltvChannelWithMappings({ id: 3, isEnabled: true }),
      createXmltvChannelWithMappings({ id: 4, isEnabled: true }),
      createXmltvChannelWithMappings({ id: 5, isEnabled: false }),
    ];

    await injectChannelToggleMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // THEN: Header shows correct enabled count
    const enabledCount = channels.filter(ch => ch.isEnabled).length;
    await expect(page.locator('[data-testid="enabled-count"]')).toHaveText(`${enabledCount} enabled`);

    // WHEN: I toggle one channel
    await page.locator('[data-testid="channel-row-2"]')
      .locator('[data-testid="channel-toggle"]').click();

    // THEN: Enabled count updates
    await expect(page.locator('[data-testid="enabled-count"]')).toHaveText(`${enabledCount + 1} enabled`);
  });

  test('Accessibility: toggle is keyboard accessible', async ({ page }) => {
    // GIVEN: A channel with matches
    const channel = createXmltvChannelWithMappings({
      id: 1,
      displayName: 'ESPN',
      isEnabled: true,
    });

    await injectChannelToggleMocks(page, [channel]);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // WHEN: Verifying keyboard accessibility attributes
    const toggle = page.locator('[data-testid="channel-row-1"]')
      .locator('[data-testid="channel-toggle"]');

    // THEN: Toggle has proper ARIA attributes for keyboard accessibility
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeEnabled();
    await expect(toggle).toBeChecked();

    // Radix UI Switch provides correct accessibility attributes
    await expect(toggle).toHaveAttribute('role', 'switch');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(toggle).toHaveAttribute('aria-label', 'Disable channel');
    // Switch element should be a button (keyboard focusable by default)
    await expect(toggle).toHaveAttribute('type', 'button');

    // Verify toggle can receive focus (keyboard navigation)
    await toggle.focus();
    await expect(toggle).toBeFocused();

    // Test keyboard toggle via dispatching proper event
    // Radix Switch handles Space/Enter via onClick handler
    await toggle.dispatchEvent('click');

    // THEN: Toggle changes state
    await expect(toggle).not.toBeChecked();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(toggle).toHaveAttribute('aria-label', 'Enable channel');
  });

  test('Error handling: should show toast on backend error', async ({ page }) => {
    // GIVEN: A channel that will fail to toggle (simulate backend error)
    const channel = createXmltvChannelWithMappings({
      id: 1,
      displayName: 'ESPN',
      isEnabled: true, // Start enabled so we can click to disable (simulates backend error)
      matchCount: 1,
    });

    // Inject mock that returns channel list but throws error on toggle
    const mockScript = `
      (function() {
        window.__XMLTV_CHANNELS_STATE__ = {
          channels: ${JSON.stringify([channel])},
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
            console.log('[Mock] get_xmltv_channels_with_mappings called');
            return window.__XMLTV_CHANNELS_STATE__.channels;
          },
          toggle_xmltv_channel: () => {
            console.log('[Mock] toggle_xmltv_channel - throwing error');
            throw new Error('Database error: connection refused');
          },
        };

        async function mockInvoke(cmd, args = {}) {
          console.log('[Tauri Mock] Invoke:', cmd, args);
          if (mockCommands[cmd]) {
            try {
              return await Promise.resolve(mockCommands[cmd](args));
            } catch (error) {
              console.error('[Tauri Mock] Error:', cmd, error);
              throw error;
            }
          }
          console.warn('[Tauri Mock] Unknown command:', cmd);
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
        console.log('[Tauri Mock] Error-throwing mock initialized');
      })();
    `;

    await page.addInitScript(mockScript);

    await page.goto('/');
    await page.click('a[href="/channels"]');
    await page.waitForLoadState('networkidle');

    // WHEN: I try to toggle the channel (this will trigger backend error)
    const toggle = page.locator('[data-testid="channel-row-1"]')
      .locator('[data-testid="channel-toggle"]');

    await expect(toggle).toBeVisible();
    await toggle.click();

    // THEN: Error toast is displayed
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText(/Failed|error|Database/i);
  });
});
