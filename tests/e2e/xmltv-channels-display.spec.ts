import { test, expect, Page } from '@playwright/test';
import {
  createXmltvChannelWithMappings,
  createXmltvChannelWithMultipleMatches,
  createXmltvChannelWithNoMatches,
  createLargeXmltvChannelList,
} from '../support/factories/xmltv-channel-display.factory';

/**
 * E2E Tests for Story 3.2: Display XMLTV Channel List with Match Status
 *
 * Tests the complete user journey of viewing XMLTV channels with their
 * matched Xtream streams through the UI.
 *
 * ATDD Pattern: RED Phase - These tests MUST fail initially
 * - Tests define expected behavior before implementation exists
 * - Failures should be due to missing UI/commands, not test bugs
 * - Once implementation is done, tests should pass (GREEN phase)
 */

/**
 * Inject Tauri mock with XMLTV channel display commands
 */
async function injectXmltvChannelDisplayMocks(
  page: Page,
  channelsData: ReturnType<typeof createXmltvChannelWithMappings>[]
) {
  const mockScript = `
    (function() {
      // State storage
      window.__XMLTV_CHANNELS_STATE__ = {
        channels: ${JSON.stringify(channelsData)},
      };

      const mockCommands = {
        // Existing commands that may be needed
        greet: (args) => \`Hello, \${args.name}! Welcome to iptv.\`,
        get_setting: () => null,
        set_setting: () => undefined,

        // NEW COMMAND: Get XMLTV channels with mappings
        get_xmltv_channels_with_mappings: () => {
          console.log('[Mock] get_xmltv_channels_with_mappings called');
          return window.__XMLTV_CHANNELS_STATE__.channels;
        },

        // NEW COMMAND: Set primary stream for a channel
        set_primary_stream: (args) => {
          console.log('[Mock] set_primary_stream:', args);
          const { xmltvChannelId, xtreamChannelId } = args;

          // Find the channel
          const channel = window.__XMLTV_CHANNELS_STATE__.channels.find(
            ch => ch.id === xmltvChannelId
          );

          if (!channel) {
            throw new Error('Channel not found');
          }

          // Update primary status
          channel.matches.forEach(match => {
            match.isPrimary = match.id === xtreamChannelId;
            match.streamPriority = match.id === xtreamChannelId ? 0 : 1;
          });

          return channel.matches;
        },

        // Toggle channel enabled status
        toggle_xmltv_channel: (args) => {
          console.log('[Mock] toggle_xmltv_channel:', args);
          const channel = window.__XMLTV_CHANNELS_STATE__.channels.find(
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

      if (!window.__TAURI__) {
        window.__TAURI__ = {};
      }
      window.__TAURI__.invoke = mockInvoke;
      window.__TAURI_INTERNALS__ = { invoke: mockInvoke };
    })();
  `;

  await page.addInitScript(mockScript);
}

test.describe('XMLTV Channels Display (Story 3.2)', () => {
  test.beforeEach(async ({ page }) => {
    // Network-first: Intercept BEFORE navigation
    await page.route('**/*.{png,jpg,jpeg,svg,gif}', (route) => route.abort());
  });

  test('AC1: should display virtualized list of XMLTV channels with match info', async ({ page }) => {
    // GIVEN: Multiple XMLTV channels with different match statuses
    const channels = [
      createXmltvChannelWithMappings({
        id: 1,
        displayName: 'ESPN',
        matchCount: 3,
        isEnabled: true,
      }),
      createXmltvChannelWithMappings({
        id: 2,
        displayName: 'CNN',
        matchCount: 2,
        isEnabled: false,
      }),
      createXmltvChannelWithMappings({
        id: 3,
        displayName: 'HBO',
        matchCount: 1,
        isEnabled: true,
      }),
    ];

    await injectXmltvChannelDisplayMocks(page, channels);
    await page.goto('/channels');

    // WHEN: The Channels view loads
    await page.waitForLoadState('networkidle');

    // THEN: I see a list of all XMLTV channels
    await expect(page.locator('[data-testid="xmltv-channels-list"]')).toBeVisible();

    // THEN: Each row shows required information
    const espnRow = page.locator('[data-testid="channel-row-1"]');
    await expect(espnRow).toBeVisible();

    // Channel name and logo
    await expect(espnRow.locator('[data-testid="channel-name"]')).toHaveText('ESPN');
    await expect(espnRow.locator('[data-testid="channel-logo"]')).toBeVisible();

    // Source icon (XMLTV)
    await expect(espnRow.locator('[data-testid="source-icon-xmltv"]')).toBeVisible();

    // Match count badge
    await expect(espnRow.locator('[data-testid="match-count-badge"]')).toHaveText('3 streams');

    // Primary stream info
    await expect(espnRow.locator('[data-testid="primary-stream-name"]')).toBeVisible();
    await expect(espnRow.locator('[data-testid="primary-stream-confidence"]')).toContainText('%');

    // Enabled/disabled toggle
    await expect(espnRow.locator('[data-testid="channel-toggle"]')).toBeVisible();
    await expect(espnRow.locator('[data-testid="channel-toggle"]')).toBeChecked();
  });

  test('AC1: should allow expanding a row to see all matched streams', async ({ page }) => {
    // GIVEN: An XMLTV channel with multiple matched streams
    const channel = createXmltvChannelWithMultipleMatches({
      id: 1,
      displayName: 'ESPN',
      matchCount: 3,
    });

    await injectXmltvChannelDisplayMocks(page, [channel]);
    await page.goto('/channels');

    // WHEN: I click the expand button on a channel row
    const channelRow = page.locator('[data-testid="channel-row-1"]');
    await channelRow.locator('[data-testid="expand-button"]').click();

    // THEN: The row expands to show all matched streams
    const matchedStreamsList = channelRow.locator('[data-testid="matched-streams-list"]');
    await expect(matchedStreamsList).toBeVisible();

    // Each stream shows required information
    const streamItems = matchedStreamsList.locator('[data-testid^="stream-item-"]');
    await expect(streamItems).toHaveCount(3);

    // First stream (should be primary)
    const firstStream = streamItems.first();
    await expect(firstStream.locator('[data-testid="stream-name"]')).toBeVisible();
    await expect(firstStream.locator('[data-testid="quality-badge"]')).toBeVisible();
    await expect(firstStream.locator('[data-testid="match-confidence"]')).toContainText('%');
    await expect(firstStream.locator('[data-testid="primary-badge"]')).toHaveText('Primary');
  });

  test('AC2: should display all matched streams with quality and confidence', async ({ page }) => {
    // GIVEN: An XMLTV channel with multiple quality tiers
    const channel = createXmltvChannelWithMultipleMatches({
      id: 1,
      displayName: 'ESPN',
      matches: [
        {
          id: 101,
          name: 'ESPN HD',
          qualities: ['HD'],
          matchConfidence: 0.95,
          isPrimary: true,
          streamPriority: 0,
        },
        {
          id: 102,
          name: 'ESPN SD',
          qualities: ['SD'],
          matchConfidence: 0.92,
          isPrimary: false,
          streamPriority: 1,
        },
        {
          id: 103,
          name: 'ESPN 4K',
          qualities: ['4K'],
          matchConfidence: 0.88,
          isPrimary: false,
          streamPriority: 2,
        },
      ],
    });

    await injectXmltvChannelDisplayMocks(page, [channel]);
    await page.goto('/channels');

    // WHEN: I expand the channel row
    await page.locator('[data-testid="channel-row-1"]').locator('[data-testid="expand-button"]').click();

    // THEN: I see all matched streams with quality badges
    const streamsList = page.locator('[data-testid="matched-streams-list"]');

    // HD stream
    const hdStream = streamsList.locator('[data-testid="stream-item-101"]');
    await expect(hdStream.locator('[data-testid="quality-badge"]')).toHaveText('HD');
    await expect(hdStream.locator('[data-testid="match-confidence"]')).toHaveText('95%');
    await expect(hdStream.locator('[data-testid="primary-badge"]')).toHaveText('Primary');

    // SD stream (backup)
    const sdStream = streamsList.locator('[data-testid="stream-item-102"]');
    await expect(sdStream.locator('[data-testid="quality-badge"]')).toHaveText('SD');
    await expect(sdStream.locator('[data-testid="match-confidence"]')).toHaveText('92%');
    await expect(sdStream.locator('[data-testid="primary-badge"]')).toHaveText('Backup');

    // 4K stream (backup)
    const fourKStream = streamsList.locator('[data-testid="stream-item-103"]');
    await expect(fourKStream.locator('[data-testid="quality-badge"]')).toHaveText('4K');
    await expect(fourKStream.locator('[data-testid="match-confidence"]')).toHaveText('88%');
  });

  test('AC2: should allow changing primary stream', async ({ page }) => {
    // GIVEN: An XMLTV channel with multiple streams (HD is primary)
    const channel = createXmltvChannelWithMultipleMatches({
      id: 1,
      displayName: 'ESPN',
    });

    await injectXmltvChannelDisplayMocks(page, [channel]);
    await page.goto('/channels');

    // WHEN: I expand the channel and click "Make Primary" on a backup stream
    await page.locator('[data-testid="channel-row-1"]').locator('[data-testid="expand-button"]').click();

    const backupStream = page.locator('[data-testid="matched-streams-list"]')
      .locator('[data-testid^="stream-item-"]')
      .filter({ has: page.locator('[data-testid="primary-badge"]:text("Backup")') })
      .first();

    await backupStream.locator('[data-testid="make-primary-button"]').click();

    // THEN: The stream becomes primary and UI updates
    await expect(backupStream.locator('[data-testid="primary-badge"]')).toHaveText('Primary');

    // Original primary should now show "Make Primary" button
    const originalPrimary = page.locator('[data-testid="matched-streams-list"]')
      .locator('[data-testid^="stream-item-"]')
      .filter({ has: page.locator('[data-testid="primary-badge"]:text("Backup")') })
      .first();
    await expect(originalPrimary.locator('[data-testid="make-primary-button"]')).toBeVisible();
  });

  test('AC3: should display unmatched channels with warning indicator', async ({ page }) => {
    // GIVEN: An XMLTV channel with no matched streams
    const unmatchedChannel = createXmltvChannelWithNoMatches({
      id: 1,
      displayName: 'Obscure Local TV',
    });

    await injectXmltvChannelDisplayMocks(page, [unmatchedChannel]);
    await page.goto('/channels');

    // WHEN: Viewing the channel list
    const channelRow = page.locator('[data-testid="channel-row-1"]');

    // THEN: The channel shows warning indicator
    await expect(channelRow.locator('[data-testid="warning-icon"]')).toBeVisible();

    // No stream matched message
    await expect(channelRow.locator('[data-testid="match-status"]')).toHaveText('No stream matched');

    // Warning styling (amber/yellow background)
    await expect(channelRow).toHaveClass(/warning|amber|yellow/);

    // Channel is disabled by default
    await expect(channelRow.locator('[data-testid="channel-toggle"]')).not.toBeChecked();

    // No expand button (nothing to expand)
    await expect(channelRow.locator('[data-testid="expand-button"]')).not.toBeVisible();
  });

  test('AC4: should maintain responsive performance with large channel list', async ({ page }) => {
    // GIVEN: A large list of 1000+ XMLTV channels
    const largeChannelList = createLargeXmltvChannelList(1200);

    await injectXmltvChannelDisplayMocks(page, largeChannelList);

    // WHEN: Navigating to channels view
    const startTime = Date.now();
    await page.goto('/channels');
    await page.waitForSelector('[data-testid="xmltv-channels-list"]');
    const loadTime = Date.now() - startTime;

    // THEN: Initial load is fast
    expect(loadTime).toBeLessThan(5000); // 5 seconds max for initial load

    // Virtualization check: Not all 1200 rows are rendered
    const renderedRows = await page.locator('[data-testid^="channel-row-"]').count();
    expect(renderedRows).toBeLessThan(100); // Only visible + overscan rendered

    // WHEN: Scrolling through the list
    const scrollContainer = page.locator('[data-testid="xmltv-channels-list"]');

    // Scroll to middle
    const scrollStart = Date.now();
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight / 2;
    });
    await page.waitForTimeout(100); // Small delay for virtual scroller
    const scrollTime = Date.now() - scrollStart;

    // THEN: Scrolling is responsive (<100ms per NFR5)
    expect(scrollTime).toBeLessThan(100);

    // UI remains responsive
    await expect(scrollContainer).toBeVisible();

    // Can still interact with rows
    const middleRow = page.locator('[data-testid^="channel-row-"]').first();
    await expect(middleRow).toBeVisible();
  });

  test('AC1: should toggle channel enabled status', async ({ page }) => {
    // GIVEN: An enabled XMLTV channel
    const channel = createXmltvChannelWithMappings({
      id: 1,
      displayName: 'ESPN',
      isEnabled: true,
    });

    await injectXmltvChannelDisplayMocks(page, [channel]);
    await page.goto('/channels');

    // WHEN: I click the toggle switch
    const channelRow = page.locator('[data-testid="channel-row-1"]');
    const toggle = channelRow.locator('[data-testid="channel-toggle"]');

    await expect(toggle).toBeChecked();
    await toggle.click();

    // THEN: The channel is disabled
    await expect(toggle).not.toBeChecked();

    // Can toggle back on
    await toggle.click();
    await expect(toggle).toBeChecked();
  });

  test('Integration: should show channel count in header', async ({ page }) => {
    // GIVEN: Multiple XMLTV channels
    const channels = createLargeXmltvChannelList(25);

    await injectXmltvChannelDisplayMocks(page, channels);
    await page.goto('/channels');

    // THEN: Header shows total channel count
    await expect(page.locator('[data-testid="channel-count"]')).toHaveText('25 channels');

    // Shows enabled count
    const enabledCount = channels.filter(ch => ch.isEnabled).length;
    await expect(page.locator('[data-testid="enabled-count"]')).toHaveText(`${enabledCount} enabled`);
  });

  test('Accessibility: keyboard navigation works', async ({ page }) => {
    // GIVEN: Multiple XMLTV channels
    const channels = [
      createXmltvChannelWithMappings({ id: 1, displayName: 'ESPN' }),
      createXmltvChannelWithMappings({ id: 2, displayName: 'CNN' }),
      createXmltvChannelWithMappings({ id: 3, displayName: 'HBO' }),
    ];

    await injectXmltvChannelDisplayMocks(page, channels);
    await page.goto('/channels');

    // WHEN: Using keyboard to navigate
    const channelsList = page.locator('[data-testid="xmltv-channels-list"]');
    await channelsList.focus();

    // Arrow down to move between rows
    await page.keyboard.press('ArrowDown');

    // Enter/Space to expand row
    await page.keyboard.press('Enter');

    // THEN: Row expands
    await expect(page.locator('[data-testid="channel-row-1"]')
      .locator('[data-testid="matched-streams-list"]')).toBeVisible();

    // Has proper ARIA attributes
    await expect(channelsList).toHaveAttribute('role', 'listbox');
    await expect(page.locator('[data-testid="channel-row-1"]')).toHaveAttribute('role', 'option');
    await expect(page.locator('[data-testid="channel-row-1"]')).toHaveAttribute('aria-expanded', 'true');
  });
});
