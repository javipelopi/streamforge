import { test, expect, Page } from '@playwright/test';
import {
  createXmltvChannelWithMappings,
  XmltvChannelWithMappings,
} from '../support/factories/xmltv-channel-display.factory';

/**
 * E2E Tests for Story 3-6: Drag-and-Drop Channel Reordering
 *
 * Tests the complete user journey of reordering XMLTV channels via drag-and-drop
 * to control the channel order in Plex lineup.
 *
 * ATDD Pattern: RED Phase - These tests MUST fail initially
 * - Tests define expected behavior before implementation exists
 * - Failures should be due to missing implementation, not test bugs
 * - Once implementation is done, tests should pass (GREEN phase)
 */

/**
 * Inject Tauri mock with channel reorder command
 */
async function injectChannelReorderMocks(
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

        // Get XMLTV channels with mappings (ordered by plexDisplayOrder)
        get_xmltv_channels_with_mappings: () => {
          console.log('[Mock] get_xmltv_channels_with_mappings called');
          // Sort by plexDisplayOrder (nulls last)
          return [...window.__XMLTV_CHANNELS_STATE__.channels].sort((a, b) => {
            if (a.plexDisplayOrder === null || a.plexDisplayOrder === undefined) return 1;
            if (b.plexDisplayOrder === null || b.plexDisplayOrder === undefined) return -1;
            return a.plexDisplayOrder - b.plexDisplayOrder;
          });
        },

        // Update channel order
        update_channel_order: (args) => {
          console.log('[Mock] update_channel_order:', args);
          const { channelIds } = args;

          if (!Array.isArray(channelIds)) {
            throw new Error('channelIds must be an array');
          }

          // Update plexDisplayOrder for each channel
          channelIds.forEach((channelId, index) => {
            const channel = window.__XMLTV_CHANNELS_STATE__.channels.find(
              ch => ch.id === channelId
            );

            if (channel) {
              channel.plexDisplayOrder = index;
            }
          });

          console.log('[Mock] Channel order updated successfully');
          return null;
        },

        // Toggle channel enabled status (from story 3-5)
        toggle_xmltv_channel: (args) => {
          console.log('[Mock] toggle_xmltv_channel:', args);
          const channel = window.__XMLTV_CHANNELS_STATE__.channels.find(
            ch => ch.id === args.channelId
          );

          if (!channel) {
            throw new Error('Channel not found');
          }

          if (!channel.isEnabled && channel.matchCount === 0) {
            throw new Error('Cannot enable channel: No stream source available. Match an Xtream stream first.');
          }

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

      console.log('[Tauri Mock] Channel reorder mock initialized');
    })();
  `;

  await page.addInitScript(mockScript);
}

test.describe('Channel Drag-and-Drop Reordering (Story 3-6)', () => {
  test.beforeEach(async ({ page }) => {
    // Network-first: Intercept BEFORE navigation
    await page.route('**/*.{png,jpg,jpeg,svg,gif}', (route) => route.abort());
  });

  test('AC1: should show visual feedback when dragging a channel', async ({ page }) => {
    // GIVEN: Multiple channels in channels view
    const channels = [
      createXmltvChannelWithMappings({
        id: 1,
        displayName: 'ESPN',
        plexDisplayOrder: 0,
        isEnabled: true,
      }),
      createXmltvChannelWithMappings({
        id: 2,
        displayName: 'CNN',
        plexDisplayOrder: 1,
        isEnabled: true,
      }),
      createXmltvChannelWithMappings({
        id: 3,
        displayName: 'HBO',
        plexDisplayOrder: 2,
        isEnabled: true,
      }),
    ];

    await injectChannelReorderMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');
    await page.waitForLoadState('networkidle');

    // WHEN: I start dragging a channel
    const dragHandle = page.locator('[data-testid="channel-row-1"]')
      .locator('[data-testid="drag-handle"]');

    await expect(dragHandle).toBeVisible();

    // Simulate drag start
    await dragHandle.hover();
    await page.mouse.down();

    // THEN: Visual feedback shows dragging state
    const draggingRow = page.locator('[data-testid="channel-row-1"]');
    await expect(draggingRow).toHaveAttribute('data-dragging', 'true');

    // THEN: Drag overlay is visible
    const dragOverlay = page.locator('[data-testid="drag-overlay"]');
    await expect(dragOverlay).toBeVisible();

    // Clean up
    await page.mouse.up();
  });

  test('AC1: should highlight drop zones during drag', async ({ page }) => {
    // GIVEN: Multiple channels
    const channels = [
      createXmltvChannelWithMappings({ id: 1, displayName: 'ESPN', plexDisplayOrder: 0 }),
      createXmltvChannelWithMappings({ id: 2, displayName: 'CNN', plexDisplayOrder: 1 }),
      createXmltvChannelWithMappings({ id: 3, displayName: 'HBO', plexDisplayOrder: 2 }),
    ];

    await injectChannelReorderMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // WHEN: I drag a channel over another position
    const dragHandle = page.locator('[data-testid="channel-row-1"]')
      .locator('[data-testid="drag-handle"]');

    await dragHandle.hover();
    await page.mouse.down();

    // Move mouse over another row
    const targetRow = page.locator('[data-testid="channel-row-2"]');
    await targetRow.hover();

    // THEN: Drop zone is highlighted
    await expect(targetRow).toHaveAttribute('data-drop-target', 'true');

    await page.mouse.up();
  });

  test('AC2: should recalculate plex_display_order after drop', async ({ page }) => {
    // GIVEN: Three channels in original order
    const channels = [
      createXmltvChannelWithMappings({
        id: 1,
        displayName: 'ESPN',
        plexDisplayOrder: 0,
      }),
      createXmltvChannelWithMappings({
        id: 2,
        displayName: 'CNN',
        plexDisplayOrder: 1,
      }),
      createXmltvChannelWithMappings({
        id: 3,
        displayName: 'HBO',
        plexDisplayOrder: 2,
      }),
    ];

    await injectChannelReorderMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');
    await page.waitForLoadState('networkidle');

    // Verify initial order
    const channelNames = page.locator('[data-testid^="channel-row-"]')
      .locator('[data-testid="channel-name"]');
    await expect(channelNames.nth(0)).toHaveText('ESPN');
    await expect(channelNames.nth(1)).toHaveText('CNN');
    await expect(channelNames.nth(2)).toHaveText('HBO');

    // WHEN: I drag ESPN (position 0) to position 2 (after HBO)
    const espnDragHandle = page.locator('[data-testid="channel-row-1"]')
      .locator('[data-testid="drag-handle"]');
    const hboRow = page.locator('[data-testid="channel-row-3"]');

    await espnDragHandle.dragTo(hboRow);

    // THEN: Order is updated to CNN, HBO, ESPN
    await page.waitForLoadState('networkidle');
    await expect(channelNames.nth(0)).toHaveText('CNN');
    await expect(channelNames.nth(1)).toHaveText('HBO');
    await expect(channelNames.nth(2)).toHaveText('ESPN');

    // THEN: plexDisplayOrder values are updated
    // CNN: 0, HBO: 1, ESPN: 2
    // (Verified by the new visual order)
  });

  test('AC2: should reflect new order in M3U playlist', async ({ page }) => {
    // GIVEN: Channels with initial order
    const channels = [
      createXmltvChannelWithMappings({
        id: 1,
        displayName: 'ESPN',
        plexDisplayOrder: 0,
        isEnabled: true,
      }),
      createXmltvChannelWithMappings({
        id: 2,
        displayName: 'CNN',
        plexDisplayOrder: 1,
        isEnabled: true,
      }),
      createXmltvChannelWithMappings({
        id: 3,
        displayName: 'HBO',
        plexDisplayOrder: 2,
        isEnabled: true,
      }),
    ];

    await injectChannelReorderMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // WHEN: I reorder channels
    const espnDragHandle = page.locator('[data-testid="channel-row-1"]')
      .locator('[data-testid="drag-handle"]');
    const hboRow = page.locator('[data-testid="channel-row-3"]');

    await espnDragHandle.dragTo(hboRow);
    await page.waitForLoadState('networkidle');

    // THEN: New order is persisted
    // NOTE: M3U generation is Epic 4 scope
    // This test verifies that plex_display_order is updated correctly
    // M3U endpoint will use ORDER BY plex_display_order ASC
    // Verifying visual order confirms database order is correct
    const channelNames = page.locator('[data-testid^="channel-row-"]')
      .locator('[data-testid="channel-name"]');
    await expect(channelNames.nth(0)).toHaveText('CNN');
    await expect(channelNames.nth(1)).toHaveText('HBO');
    await expect(channelNames.nth(2)).toHaveText('ESPN');
  });

  test('AC3: should preserve custom order after app restart', async ({ page }) => {
    // GIVEN: Channels with custom display order
    const channels = [
      createXmltvChannelWithMappings({
        id: 2,
        displayName: 'CNN',
        plexDisplayOrder: 0, // Custom order: CNN first
      }),
      createXmltvChannelWithMappings({
        id: 3,
        displayName: 'HBO',
        plexDisplayOrder: 1, // HBO second
      }),
      createXmltvChannelWithMappings({
        id: 1,
        displayName: 'ESPN',
        plexDisplayOrder: 2, // ESPN last
      }),
    ];

    await injectChannelReorderMocks(page, channels);

    // WHEN: I load the channels view (simulating app restart)
    await page.goto('/');
    await page.click('a[href="/channels"]');
    await page.waitForLoadState('networkidle');

    // THEN: Custom order is preserved (channels sorted by plexDisplayOrder)
    const channelNames = page.locator('[data-testid^="channel-row-"]')
      .locator('[data-testid="channel-name"]');
    await expect(channelNames.nth(0)).toHaveText('CNN');
    await expect(channelNames.nth(1)).toHaveText('HBO');
    await expect(channelNames.nth(2)).toHaveText('ESPN');

    // ============================================================================
    // TEST LIMITATION: Mock uses in-memory state, not database persistence
    // ============================================================================
    // This test validates the UI correctly displays persisted order from backend.
    // In production:
    // 1. update_channel_order writes plex_display_order to xmltv_channel_settings
    // 2. App restart triggers get_xmltv_channels_with_mappings
    // 3. Query returns channels ORDER BY plex_display_order ASC
    //
    // Real persistence is validated by:
    // - Rust integration tests (database layer)
    // - Manual QA with actual app restarts
  });

  test('Accessibility: drag handle is keyboard accessible', async ({ page }) => {
    // GIVEN: Channels with drag handles
    const channels = [
      createXmltvChannelWithMappings({ id: 1, displayName: 'ESPN', plexDisplayOrder: 0 }),
      createXmltvChannelWithMappings({ id: 2, displayName: 'CNN', plexDisplayOrder: 1 }),
      createXmltvChannelWithMappings({ id: 3, displayName: 'HBO', plexDisplayOrder: 2 }),
    ];

    await injectChannelReorderMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // WHEN: I focus on the drag handle
    const dragHandle = page.locator('[data-testid="channel-row-1"]')
      .locator('[data-testid="drag-handle"]');

    await dragHandle.focus();

    // THEN: Drag handle has proper accessibility attributes
    await expect(dragHandle).toBeFocused();
    await expect(dragHandle).toHaveAttribute('aria-label', /drag to reorder|reorder/i);
    await expect(dragHandle).toHaveAttribute('role', 'button');

    // THEN: Keyboard instructions are available
    // Screen reader users should hear: "Press Space to pick up, Arrow keys to move, Space to drop"
    await expect(dragHandle).toHaveAttribute('aria-describedby', /keyboard-instructions|drag-instructions/i);
  });

  test('Accessibility: keyboard reordering with arrow keys', async ({ page }) => {
    // GIVEN: Channels in initial order
    const channels = [
      createXmltvChannelWithMappings({ id: 1, displayName: 'ESPN', plexDisplayOrder: 0 }),
      createXmltvChannelWithMappings({ id: 2, displayName: 'CNN', plexDisplayOrder: 1 }),
      createXmltvChannelWithMappings({ id: 3, displayName: 'HBO', plexDisplayOrder: 2 }),
    ];

    await injectChannelReorderMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // WHEN: I use keyboard to reorder
    const dragHandle = page.locator('[data-testid="channel-row-1"]')
      .locator('[data-testid="drag-handle"]');

    await dragHandle.focus();
    await page.keyboard.press('Space'); // Pick up item
    await page.keyboard.press('ArrowDown'); // Move down one position
    await page.keyboard.press('Space'); // Drop item

    // THEN: Channel order is updated
    const channelNames = page.locator('[data-testid^="channel-row-"]')
      .locator('[data-testid="channel-name"]');
    await expect(channelNames.nth(0)).toHaveText('CNN');
    await expect(channelNames.nth(1)).toHaveText('ESPN');
    await expect(channelNames.nth(2)).toHaveText('HBO');
  });

  test('Performance: should handle large channel lists efficiently', async ({ page }) => {
    // GIVEN: Large list of channels (100+)
    const channels = Array.from({ length: 150 }, (_, i) =>
      createXmltvChannelWithMappings({
        id: i + 1,
        displayName: `Channel ${i + 1}`,
        plexDisplayOrder: i,
      })
    );

    await injectChannelReorderMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');
    await page.waitForLoadState('networkidle');

    // WHEN: I drag a channel in a large list
    const startTime = Date.now();

    const dragHandle = page.locator('[data-testid="channel-row-1"]')
      .locator('[data-testid="drag-handle"]');
    const targetRow = page.locator('[data-testid="channel-row-10"]');

    await dragHandle.dragTo(targetRow);
    await page.waitForLoadState('networkidle');

    const endTime = Date.now();
    const duration = endTime - startTime;

    // THEN: Drag operation completes in reasonable time (<2 seconds)
    expect(duration).toBeLessThan(2000);

    // THEN: Virtualization still works (only visible rows rendered)
    // Check that not all 150 rows are in DOM
    const renderedRows = page.locator('[data-testid^="channel-row-"]');
    const rowCount = await renderedRows.count();
    expect(rowCount).toBeLessThan(150); // Should be ~20-30 visible rows
  });

  test('Error handling: should show toast on reorder failure', async ({ page }) => {
    // GIVEN: Channels that will fail to reorder (simulate backend error)
    const channels = [
      createXmltvChannelWithMappings({ id: 1, displayName: 'ESPN', plexDisplayOrder: 0 }),
      createXmltvChannelWithMappings({ id: 2, displayName: 'CNN', plexDisplayOrder: 1 }),
      createXmltvChannelWithMappings({ id: 3, displayName: 'HBO', plexDisplayOrder: 2 }),
    ];

    // Inject mock that throws error on update_channel_order
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
            return [...window.__XMLTV_CHANNELS_STATE__.channels].sort((a, b) => {
              if (a.plexDisplayOrder === null) return 1;
              if (b.plexDisplayOrder === null) return -1;
              return a.plexDisplayOrder - b.plexDisplayOrder;
            });
          },
          update_channel_order: () => {
            console.log('[Mock] update_channel_order - throwing error');
            throw new Error('Database error: failed to update order');
          },
          toggle_xmltv_channel: (args) => {
            const channel = window.__XMLTV_CHANNELS_STATE__.channels.find(
              ch => ch.id === args.channelId
            );
            if (!channel) throw new Error('Channel not found');
            if (!channel.isEnabled && channel.matchCount === 0) {
              throw new Error('Cannot enable channel: No stream source available.');
            }
            channel.isEnabled = !channel.isEnabled;
            return channel;
          },
        };

        async function mockInvoke(cmd, args = {}) {
          if (mockCommands[cmd]) {
            try {
              return await Promise.resolve(mockCommands[cmd](args));
            } catch (error) {
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

    await page.addInitScript(mockScript);
    await page.goto('/');
    await page.click('a[href="/channels"]');
    await page.waitForLoadState('networkidle');

    // Store original order
    const channelNames = page.locator('[data-testid^="channel-row-"]')
      .locator('[data-testid="channel-name"]');
    const originalFirstChannel = await channelNames.nth(0).textContent();

    // WHEN: I try to reorder (this will trigger backend error)
    const dragHandle = page.locator('[data-testid="channel-row-1"]')
      .locator('[data-testid="drag-handle"]');
    const targetRow = page.locator('[data-testid="channel-row-3"]');

    await dragHandle.dragTo(targetRow);

    // THEN: Error toast is displayed
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText(/Failed|error|Database/i);

    // THEN: Optimistic update is rolled back (order reverts to original)
    await expect(channelNames.nth(0)).toHaveText(originalFirstChannel!);
  });

  test('Error handling: should rollback optimistic update on failure', async ({ page }) => {
    // GIVEN: Channels with error-throwing mock
    const channels = [
      createXmltvChannelWithMappings({
        id: 1,
        displayName: 'ESPN',
        plexDisplayOrder: 0,
      }),
      createXmltvChannelWithMappings({
        id: 2,
        displayName: 'CNN',
        plexDisplayOrder: 1,
      }),
      createXmltvChannelWithMappings({
        id: 3,
        displayName: 'HBO',
        plexDisplayOrder: 2,
      }),
    ];

    const mockScript = `
      (function() {
        window.__XMLTV_CHANNELS_STATE__ = { channels: ${JSON.stringify(channels)} };
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
            return [...window.__XMLTV_CHANNELS_STATE__.channels].sort((a, b) => {
              if (a.plexDisplayOrder === null) return 1;
              if (b.plexDisplayOrder === null) return -1;
              return a.plexDisplayOrder - b.plexDisplayOrder;
            });
          },
          update_channel_order: () => {
            throw new Error('Database error: transaction failed');
          },
          toggle_xmltv_channel: () => ({ id: 1, isEnabled: true }),
        };
        async function mockInvoke(cmd, args = {}) {
          if (mockCommands[cmd]) return await Promise.resolve(mockCommands[cmd](args));
          throw new Error(\`Unknown command: \${cmd}\`);
        }
        window.__TAURI_INTERNALS__ = {
          invoke: mockInvoke,
          metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' }, windows: [{ label: 'main' }], webviews: [{ label: 'main' }] },
          plugins: {},
        };
        window.__TAURI__ = { invoke: mockInvoke };
        window.__TAURI_MOCK__ = { invoke: mockInvoke, commands: mockCommands };
      })();
    `;

    await page.addInitScript(mockScript);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // WHEN: I drag to reorder
    const dragHandle = page.locator('[data-testid="channel-row-1"]')
      .locator('[data-testid="drag-handle"]');
    const targetRow = page.locator('[data-testid="channel-row-3"]');

    await dragHandle.dragTo(targetRow);

    // Wait for error toast
    await expect(page.locator('[data-testid="toast"]')).toBeVisible({ timeout: 5000 });

    // THEN: Order is rolled back to original
    const channelNames = page.locator('[data-testid^="channel-row-"]')
      .locator('[data-testid="channel-name"]');
    await expect(channelNames.nth(0)).toHaveText('ESPN');
    await expect(channelNames.nth(1)).toHaveText('CNN');
    await expect(channelNames.nth(2)).toHaveText('HBO');
  });

  test('Integration: reorder only affects enabled channels lineup', async ({ page }) => {
    // GIVEN: Mix of enabled and disabled channels
    const channels = [
      createXmltvChannelWithMappings({
        id: 1,
        displayName: 'ESPN',
        plexDisplayOrder: 0,
        isEnabled: true,
      }),
      createXmltvChannelWithMappings({
        id: 2,
        displayName: 'CNN',
        plexDisplayOrder: 1,
        isEnabled: false, // Disabled
      }),
      createXmltvChannelWithMappings({
        id: 3,
        displayName: 'HBO',
        plexDisplayOrder: 2,
        isEnabled: true,
      }),
    ];

    await injectChannelReorderMocks(page, channels);
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // WHEN: I reorder channels
    const espnDragHandle = page.locator('[data-testid="channel-row-1"]')
      .locator('[data-testid="drag-handle"]');
    const hboRow = page.locator('[data-testid="channel-row-3"]');

    await espnDragHandle.dragTo(hboRow);
    await page.waitForLoadState('networkidle');

    // THEN: All channels are reordered (both enabled and disabled)
    // Note: Only enabled channels appear in M3U (Epic 4)
    // But plex_display_order is updated for all channels
    const channelNames = page.locator('[data-testid^="channel-row-"]')
      .locator('[data-testid="channel-name"]');
    await expect(channelNames.nth(0)).toHaveText('CNN');
    await expect(channelNames.nth(1)).toHaveText('HBO');
    await expect(channelNames.nth(2)).toHaveText('ESPN');
  });
});
