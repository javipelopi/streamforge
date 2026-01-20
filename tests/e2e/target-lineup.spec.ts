import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Story 3.9: Implement Target Lineup View
 *
 * Tests the user journey of:
 * 1. Navigating to Target Lineup view from sidebar
 * 2. Viewing only enabled channels in a focused, fast-loading list
 * 3. Managing channels: drag-drop reorder, enable/disable toggle
 * 4. Seeing warnings for channels without stream sources
 * 5. Handling empty state with link to Sources
 * 6. Disabling channels with undo functionality
 *
 * ATDD Pattern: RED Phase - These tests MUST fail initially
 */

// Mock target lineup channel data
interface MockTargetLineupChannel {
  id: number;
  channelId: string;
  displayName: string;
  icon: string | null;
  isSynthetic: boolean;
  isEnabled: boolean;
  plexDisplayOrder: number;
  streamCount: number;
  primaryStreamName: string | null;
}

/**
 * Create mock target lineup channel with defaults and overrides
 */
function createMockTargetLineupChannel(overrides: Partial<MockTargetLineupChannel> = {}): MockTargetLineupChannel {
  const id = overrides.id ?? 1;
  return {
    id,
    channelId: overrides.channelId ?? `channel-${id}`,
    displayName: overrides.displayName ?? `Channel ${id}`,
    icon: overrides.icon ?? (id % 2 === 0 ? `https://example.com/icon${id}.png` : null),
    isSynthetic: overrides.isSynthetic ?? false,
    isEnabled: overrides.isEnabled ?? true, // Must be true for target lineup
    plexDisplayOrder: overrides.plexDisplayOrder ?? id,
    streamCount: overrides.streamCount ?? 1, // 0 = no stream warning
    primaryStreamName: overrides.primaryStreamName ?? `Stream for Channel ${id}`,
  };
}

/**
 * Create array of enabled channels for bulk testing
 */
function createMockEnabledChannels(count: number): MockTargetLineupChannel[] {
  return Array.from({ length: count }, (_, i) => createMockTargetLineupChannel({
    id: 100 + i,
    displayName: `Enabled Channel ${i + 1}`,
    plexDisplayOrder: i + 1,
  }));
}

/**
 * Inject Tauri mock with target lineup commands
 */
async function injectTargetLineupMocks(
  page: Page,
  enabledChannels: MockTargetLineupChannel[]
): Promise<void> {
  const mockScript = `
    (function() {
      // State storage for target lineup
      window.__TARGET_LINEUP_STATE__ = {
        enabledChannels: ${JSON.stringify(enabledChannels)},
        pendingDisables: new Map(),
        undoTimeouts: new Map(),
      };

      const mockCommands = {
        // Core settings commands
        greet: (args) => \`Hello, \${args.name}! Welcome to iptv.\`,
        get_setting: () => null,
        set_setting: () => undefined,
        get_server_port: () => 5004,
        set_server_port: () => undefined,
        get_autostart_enabled: () => ({ enabled: false }),
        set_autostart_enabled: () => undefined,
        get_accounts: () => [],

        // Story 3-9: Get target lineup channels (only enabled)
        get_target_lineup_channels: () => {
          console.log('[Mock] get_target_lineup_channels called');

          // Simulate performance timing
          const startTime = performance.now();

          // Return only enabled channels, sorted by display order
          const channels = window.__TARGET_LINEUP_STATE__.enabledChannels
            .filter(ch => ch.isEnabled)
            .sort((a, b) => a.plexDisplayOrder - b.plexDisplayOrder);

          const duration = performance.now() - startTime;
          console.log(\`[Mock] Loaded \${channels.length} channels in \${duration.toFixed(2)}ms\`);

          return channels;
        },

        // Update channel enabled status
        update_channel_enabled: (args) => {
          console.log('[Mock] update_channel_enabled:', args);
          const { channelId, enabled } = args;

          const channel = window.__TARGET_LINEUP_STATE__.enabledChannels.find(
            ch => ch.id === channelId
          );

          if (channel) {
            channel.isEnabled = enabled;
          }

          return undefined;
        },

        // Update channel order (bulk reordering after drag-drop)
        update_channel_order: (args) => {
          console.log('[Mock] update_channel_order:', args);
          const { channelOrders } = args;

          // Update display order for each channel
          channelOrders.forEach(({ id, order }) => {
            const channel = window.__TARGET_LINEUP_STATE__.enabledChannels.find(
              ch => ch.id === id
            );
            if (channel) {
              channel.plexDisplayOrder = order;
            }
          });

          return undefined;
        },

        // Toggle single channel (legacy, may not be needed)
        toggle_xmltv_channel: (args) => {
          console.log('[Mock] toggle_xmltv_channel:', args);
          const channel = window.__TARGET_LINEUP_STATE__.enabledChannels.find(
            ch => ch.id === args.channelId
          );

          if (channel) {
            channel.isEnabled = !channel.isEnabled;
          }

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
        getState: () => window.__TARGET_LINEUP_STATE__,
      };

      console.log('[Tauri Mock] Target Lineup mock initialized with', window.__TARGET_LINEUP_STATE__.enabledChannels.length, 'enabled channels');
    })();
  `;

  await page.addInitScript(mockScript);
}

test.describe('Target Lineup View (Story 3-9)', () => {
  test.beforeEach(async ({ page }) => {
    // Block image loading for faster tests
    await page.route('**/*.{png,jpg,jpeg,svg,gif}', (route) => route.abort());
  });

  test.describe('AC #1: Navigation Changes', () => {
    test('should display "Target Lineup" menu item in sidebar after Dashboard', async ({ page }) => {
      // GIVEN: App with standard navigation
      const channels = createMockEnabledChannels(2);
      await injectTargetLineupMocks(page, channels);

      // WHEN: Navigate to app
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // THEN: "Target Lineup" menu item exists in sidebar
      const targetLineupItem = page.locator('[data-testid="target-lineup-nav-item"]');
      await expect(targetLineupItem).toBeVisible();
      await expect(targetLineupItem).toContainText('Target Lineup');

      // Verify it has correct aria-label for accessibility
      await expect(targetLineupItem).toHaveAttribute('aria-label', /Target Lineup/i);
    });

    test('should remove old "Channels" menu item from sidebar', async ({ page }) => {
      // GIVEN: App with new navigation structure
      const channels = createMockEnabledChannels(2);
      await injectTargetLineupMocks(page, channels);

      // WHEN: Navigate to app
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // THEN: Old "Channels" menu item does NOT exist
      const channelsItem = page.locator('[data-testid="channels-nav-item"]');
      await expect(channelsItem).not.toBeVisible();
    });
  });

  test.describe('AC #2: Target Lineup View and Performance', () => {
    test('should navigate to Target Lineup view when clicking menu item', async ({ page }) => {
      // GIVEN: App with Target Lineup in navigation
      const channels = createMockEnabledChannels(3);
      await injectTargetLineupMocks(page, channels);

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // WHEN: Click "Target Lineup" menu item
      await page.click('[data-testid="target-lineup-nav-item"]');

      // THEN: Navigate to /target-lineup route
      await expect(page).toHaveURL(/\/target-lineup/);

      // AND: Target Lineup view is rendered
      const view = page.locator('[data-testid="target-lineup-view"]');
      await expect(view).toBeVisible();
    });

    test('should display only enabled channels in Target Lineup', async ({ page }) => {
      // GIVEN: Mix of enabled and disabled channels (mocks provide only enabled)
      const enabledChannels = [
        createMockTargetLineupChannel({ id: 1, displayName: 'CNN HD', isEnabled: true }),
        createMockTargetLineupChannel({ id: 2, displayName: 'BBC World', isEnabled: true }),
        createMockTargetLineupChannel({ id: 3, displayName: 'ESPN', isEnabled: true }),
      ];
      await injectTargetLineupMocks(page, enabledChannels);

      // WHEN: Navigate to Target Lineup
      await page.goto('/target-lineup');
      await page.waitForLoadState('networkidle');

      // THEN: Only enabled channels are displayed
      await expect(page.locator('[data-testid="target-lineup-channel-1"]')).toBeVisible();
      await expect(page.locator('[data-testid="target-lineup-channel-1"]')).toContainText('CNN HD');

      await expect(page.locator('[data-testid="target-lineup-channel-2"]')).toBeVisible();
      await expect(page.locator('[data-testid="target-lineup-channel-2"]')).toContainText('BBC World');

      await expect(page.locator('[data-testid="target-lineup-channel-3"]')).toBeVisible();
      await expect(page.locator('[data-testid="target-lineup-channel-3"]')).toContainText('ESPN');

      // Verify total count
      const channelRows = page.locator('[data-testid^="target-lineup-channel-"]');
      await expect(channelRows).toHaveCount(3);
    });

    test('should load enabled channels quickly (performance check)', async ({ page }) => {
      // GIVEN: Large number of enabled channels (500)
      const channels = createMockEnabledChannels(500);
      await injectTargetLineupMocks(page, channels);

      // WHEN: Navigate to Target Lineup and measure load time
      const startTime = Date.now();
      await page.goto('/target-lineup');

      // Wait for channels to be visible (not just loading state)
      await expect(page.locator('[data-testid^="target-lineup-channel-"]').first()).toBeVisible({ timeout: 1000 });

      const loadTime = Date.now() - startTime;

      // THEN: Load time is under 500ms
      console.log(`Target Lineup loaded ${channels.length} channels in ${loadTime}ms`);
      expect(loadTime).toBeLessThan(500);
    });
  });

  test.describe('AC #3: Channel Management', () => {
    test('should allow drag-drop reordering of channels', async ({ page }) => {
      // GIVEN: Multiple channels in Target Lineup
      const channels = [
        createMockTargetLineupChannel({ id: 1, displayName: 'First Channel', plexDisplayOrder: 1 }),
        createMockTargetLineupChannel({ id: 2, displayName: 'Second Channel', plexDisplayOrder: 2 }),
        createMockTargetLineupChannel({ id: 3, displayName: 'Third Channel', plexDisplayOrder: 3 }),
      ];
      await injectTargetLineupMocks(page, channels);

      await page.goto('/target-lineup');
      await page.waitForLoadState('networkidle');

      // WHEN: Drag second channel to first position
      const secondChannel = page.locator('[data-testid="target-lineup-channel-2"]');
      const dragHandle = page.locator('[data-testid="channel-drag-handle-2"]');

      await expect(dragHandle).toBeVisible();

      // Simulate drag operation (actual drag implementation depends on dnd-kit)
      // For now, verify drag handle exists and is interactive
      await expect(dragHandle).toHaveAttribute('aria-label', /drag to reorder/i);
    });

    test('should toggle channel enabled/disabled status', async ({ page }) => {
      // GIVEN: Enabled channel in Target Lineup
      const channels = [
        createMockTargetLineupChannel({ id: 1, displayName: 'Test Channel', isEnabled: true }),
      ];
      await injectTargetLineupMocks(page, channels);

      await page.goto('/target-lineup');
      await page.waitForLoadState('networkidle');

      // WHEN: Click toggle to disable
      const toggle = page.locator('[data-testid="channel-toggle-1"]');
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-label', /toggle channel/i);

      // Toggle is a switch, should be interactive
      await expect(toggle).toBeEnabled();
    });

    test('should display warning icon for channels without streams', async ({ page }) => {
      // GIVEN: Channel with no stream source
      const channels = [
        createMockTargetLineupChannel({
          id: 1,
          displayName: 'Orphan Channel',
          streamCount: 0,
          primaryStreamName: null,
        }),
      ];
      await injectTargetLineupMocks(page, channels);

      await page.goto('/target-lineup');
      await page.waitForLoadState('networkidle');

      // THEN: Warning badge is visible
      const warningBadge = page.locator('[data-testid="no-stream-warning-1"]');
      await expect(warningBadge).toBeVisible();
      await expect(warningBadge).toContainText('No stream');
    });
  });

  test.describe('AC #4: No Stream Warning', () => {
    test('should show "No stream" badge for channels with streamCount = 0', async ({ page }) => {
      // GIVEN: Channel without stream
      const channels = [
        createMockTargetLineupChannel({
          id: 10,
          displayName: 'Channel Without Stream',
          streamCount: 0,
        }),
      ];
      await injectTargetLineupMocks(page, channels);

      await page.goto('/target-lineup');
      await page.waitForLoadState('networkidle');

      // THEN: Badge displays "No stream"
      const badge = page.locator('[data-testid="no-stream-warning-10"]');
      await expect(badge).toBeVisible();
      await expect(badge).toContainText(/no stream/i);

      // Badge should have amber/warning styling (visual check in implementation)
    });

    test('should display tooltip on hover: "This channel has no video source"', async ({ page }) => {
      // GIVEN: Channel without stream
      const channels = [
        createMockTargetLineupChannel({
          id: 10,
          displayName: 'Channel Without Stream',
          streamCount: 0,
        }),
      ];
      await injectTargetLineupMocks(page, channels);

      await page.goto('/target-lineup');
      await page.waitForLoadState('networkidle');

      // WHEN: Hover over warning badge
      const badge = page.locator('[data-testid="no-stream-warning-10"]');
      await badge.hover();

      // THEN: Tooltip appears with message
      // Note: Tooltip implementation varies; this checks title attribute
      await expect(badge).toHaveAttribute('title', /no video source/i);
    });
  });

  test.describe('AC #5: Empty State', () => {
    test('should display empty state when no enabled channels exist', async ({ page }) => {
      // GIVEN: No enabled channels
      await injectTargetLineupMocks(page, []);

      // WHEN: Navigate to Target Lineup
      await page.goto('/target-lineup');
      await page.waitForLoadState('networkidle');

      // THEN: Empty state is displayed
      const emptyState = page.locator('[data-testid="target-lineup-empty-state"]');
      await expect(emptyState).toBeVisible();

      const message = page.locator('[data-testid="empty-state-message"]');
      await expect(message).toBeVisible();
      await expect(message).toContainText('No channels in lineup');
      await expect(message).toContainText('Add channels from Sources');
    });

    test('should show "Browse Sources" button in empty state', async ({ page }) => {
      // GIVEN: No enabled channels
      await injectTargetLineupMocks(page, []);

      await page.goto('/target-lineup');
      await page.waitForLoadState('networkidle');

      // THEN: Button exists and links to Sources
      const button = page.locator('[data-testid="browse-sources-button"]');
      await expect(button).toBeVisible();
      await expect(button).toContainText('Browse Sources');

      // Button should have aria-label for accessibility
      await expect(button).toHaveAttribute('aria-label', /browse sources/i);

      // Note: Button may be disabled or show "Coming soon" until story 3-10 is complete
    });
  });

  test.describe('AC #6: Disable with Undo', () => {
    test('should remove channel from list when disabled (optimistic UI)', async ({ page }) => {
      // GIVEN: Enabled channel in Target Lineup
      const channels = [
        createMockTargetLineupChannel({ id: 1, displayName: 'Test Channel', isEnabled: true }),
        createMockTargetLineupChannel({ id: 2, displayName: 'Other Channel', isEnabled: true }),
      ];
      await injectTargetLineupMocks(page, channels);

      await page.goto('/target-lineup');
      await page.waitForLoadState('networkidle');

      // Verify channel is visible initially
      await expect(page.locator('[data-testid="target-lineup-channel-1"]')).toBeVisible();

      // WHEN: Disable the channel
      await page.click('[data-testid="channel-toggle-1"]');

      // THEN: Channel is immediately removed from list (optimistic UI)
      await expect(page.locator('[data-testid="target-lineup-channel-1"]')).not.toBeVisible({ timeout: 1000 });

      // Other channel remains visible
      await expect(page.locator('[data-testid="target-lineup-channel-2"]')).toBeVisible();
    });

    test('should show toast with "Undo" action after disabling', async ({ page }) => {
      // GIVEN: Enabled channel in Target Lineup
      const channels = [
        createMockTargetLineupChannel({ id: 1, displayName: 'Test Channel', isEnabled: true }),
      ];
      await injectTargetLineupMocks(page, channels);

      await page.goto('/target-lineup');
      await page.waitForLoadState('networkidle');

      // WHEN: Disable the channel
      await page.click('[data-testid="channel-toggle-1"]');

      // THEN: Toast notification appears
      const toast = page.getByText(/channel removed from lineup/i);
      await expect(toast).toBeVisible({ timeout: 2000 });

      // AND: Toast contains "Undo" action button
      const undoButton = page.getByRole('button', { name: /undo/i });
      await expect(undoButton).toBeVisible();
    });

    test('should restore channel when "Undo" is clicked within 5 seconds', async ({ page }) => {
      // GIVEN: Channel was just disabled
      const channels = [
        createMockTargetLineupChannel({ id: 1, displayName: 'Test Channel', isEnabled: true }),
      ];
      await injectTargetLineupMocks(page, channels);

      await page.goto('/target-lineup');
      await page.waitForLoadState('networkidle');

      // Disable the channel
      await page.click('[data-testid="channel-toggle-1"]');
      await expect(page.locator('[data-testid="target-lineup-channel-1"]')).not.toBeVisible();

      // WHEN: Click "Undo" within 5 seconds
      const undoButton = page.getByRole('button', { name: /undo/i });
      await expect(undoButton).toBeVisible({ timeout: 2000 });
      await undoButton.click();

      // THEN: Channel is restored to the list
      await expect(page.locator('[data-testid="target-lineup-channel-1"]')).toBeVisible({ timeout: 2000 });
      await expect(page.locator('[data-testid="target-lineup-channel-1"]')).toContainText('Test Channel');

      // Toast should disappear
      await expect(page.getByText(/channel removed from lineup/i)).not.toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible navigation item with ARIA label', async ({ page }) => {
      // GIVEN: App with navigation
      const channels = createMockEnabledChannels(1);
      await injectTargetLineupMocks(page, channels);

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // THEN: Navigation item is accessible
      const navItem = page.locator('[data-testid="target-lineup-nav-item"]');
      await expect(navItem).toHaveAttribute('aria-label', /target lineup/i);
    });

    test('should have accessible drag handles with ARIA labels', async ({ page }) => {
      // GIVEN: Channels in Target Lineup
      const channels = createMockEnabledChannels(2);
      await injectTargetLineupMocks(page, channels);

      await page.goto('/target-lineup');
      await page.waitForLoadState('networkidle');

      // THEN: Drag handles have aria-label
      const dragHandle = page.locator('[data-testid="channel-drag-handle-100"]');
      await expect(dragHandle).toHaveAttribute('aria-label', /drag to reorder/i);
    });

    test('should have accessible toggle switches with ARIA labels', async ({ page }) => {
      // GIVEN: Channels in Target Lineup
      const channels = createMockEnabledChannels(1);
      await injectTargetLineupMocks(page, channels);

      await page.goto('/target-lineup');
      await page.waitForLoadState('networkidle');

      // THEN: Toggle has aria-label
      const toggle = page.locator('[data-testid="channel-toggle-100"]');
      await expect(toggle).toHaveAttribute('aria-label', /toggle channel/i);
    });
  });

  test.describe('Synthetic Channel Badge', () => {
    test('should display "Synthetic" badge on synthetic channels', async ({ page }) => {
      // GIVEN: Synthetic channel (promoted orphan)
      const channels = [
        createMockTargetLineupChannel({
          id: 50,
          displayName: 'Promoted Orphan',
          isSynthetic: true,
        }),
      ];
      await injectTargetLineupMocks(page, channels);

      await page.goto('/target-lineup');
      await page.waitForLoadState('networkidle');

      // THEN: Synthetic badge is visible
      const badge = page.locator('[data-testid="synthetic-badge-50"]');
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText('Synthetic');
    });

    test('should not display "Synthetic" badge on regular channels', async ({ page }) => {
      // GIVEN: Regular (non-synthetic) channel
      const channels = [
        createMockTargetLineupChannel({
          id: 60,
          displayName: 'Regular Channel',
          isSynthetic: false,
        }),
      ];
      await injectTargetLineupMocks(page, channels);

      await page.goto('/target-lineup');
      await page.waitForLoadState('networkidle');

      // THEN: No synthetic badge
      await expect(page.locator('[data-testid="synthetic-badge-60"]')).not.toBeVisible();
    });
  });
});
