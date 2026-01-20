import { test, expect, Page } from '@playwright/test';
import {
  createXmltvChannelWithMappings,
  createXtreamStreamSearchResult,
} from '../support/factories/xmltv-channel-display.factory';

/**
 * E2E Tests for Stream Search Functionality
 *
 * Tests the search_xtream_streams command through the UI.
 * Verifies fuzzy matching, error handling, and UI feedback.
 */

/**
 * Inject Tauri mock with stream search command
 */
async function injectStreamSearchMocks(
  page: Page,
  options: {
    channels?: ReturnType<typeof createXmltvChannelWithMappings>[];
    searchResults?: ReturnType<typeof createXtreamStreamSearchResult>[];
    searchError?: string;
  } = {}
) {
  const {
    channels = [createXmltvChannelWithMappings({ id: 1, displayName: 'ESPN' })],
    searchResults = [],
    searchError,
  } = options;

  const mockScript = `
    (function() {
      window.__XMLTV_CHANNELS_STATE__ = {
        channels: ${JSON.stringify(channels)},
        searchResults: ${JSON.stringify(searchResults)},
        searchError: ${JSON.stringify(searchError)},
      };

      const mockCommands = {
        greet: (args) => \`Hello, \${args.name}!\`,
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

        set_primary_stream: (args) => {
          const { xmltvChannelId, xtreamChannelId } = args;
          const channel = window.__XMLTV_CHANNELS_STATE__.channels.find(
            ch => ch.id === xmltvChannelId
          );
          if (!channel) throw new Error('Channel not found');
          channel.matches = channel.matches.map(match => ({
            ...match,
            isPrimary: match.id === xtreamChannelId,
            streamPriority: match.id === xtreamChannelId ? 0 : 1,
          }));
          return channel.matches;
        },

        toggle_xmltv_channel: (args) => {
          const channel = window.__XMLTV_CHANNELS_STATE__.channels.find(
            ch => ch.id === args.channelId
          );
          if (channel) {
            channel.isEnabled = !channel.isEnabled;
          }
          return channel;
        },

        // NEW: search_xtream_streams command
        search_xtream_streams: (args) => {
          console.log('[Mock] search_xtream_streams:', args);

          if (window.__XMLTV_CHANNELS_STATE__.searchError) {
            throw new Error(window.__XMLTV_CHANNELS_STATE__.searchError);
          }

          const query = args.query.toLowerCase().trim();
          if (!query) {
            throw new Error('Search query cannot be empty');
          }

          // Return pre-configured search results or generate based on query
          const results = window.__XMLTV_CHANNELS_STATE__.searchResults;
          if (results.length > 0) {
            return results.map(r => ({
              ...r,
              fuzzyScore: r.name.toLowerCase().includes(query) ? 0.9 : 0.5,
            }));
          }

          // Generate mock results based on query
          return [
            {
              id: 101,
              streamId: 101,
              name: query.toUpperCase() + ' HD',
              streamIcon: null,
              qualities: ['HD'],
              categoryName: 'Sports',
              matchedToXmltvIds: [],
              fuzzyScore: 0.95,
            },
            {
              id: 102,
              streamId: 102,
              name: query.toUpperCase() + ' SD',
              streamIcon: null,
              qualities: ['SD'],
              categoryName: 'Sports',
              matchedToXmltvIds: [],
              fuzzyScore: 0.88,
            },
          ];
        },

        add_manual_stream_mapping: (args) => {
          console.log('[Mock] add_manual_stream_mapping:', args);
          const channel = window.__XMLTV_CHANNELS_STATE__.channels.find(
            ch => ch.id === args.xmltvChannelId
          );
          if (!channel) throw new Error('Channel not found');

          const newMatch = {
            id: args.xtreamChannelId,
            mappingId: Date.now(),
            name: 'Manually Added Stream',
            streamIcon: null,
            qualities: ['HD'],
            matchConfidence: 1.0,
            isPrimary: args.setAsPrimary,
            isManual: true,
            streamPriority: args.setAsPrimary ? 0 : channel.matches.length,
            isOrphaned: false,
          };

          if (args.setAsPrimary) {
            channel.matches = channel.matches.map(m => ({
              ...m,
              isPrimary: false,
              streamPriority: m.streamPriority + 1,
            }));
          }

          channel.matches.push(newMatch);
          channel.matchCount = channel.matches.length;

          return channel.matches;
        },

        remove_stream_mapping: (args) => {
          console.log('[Mock] remove_stream_mapping:', args);
          for (const channel of window.__XMLTV_CHANNELS_STATE__.channels) {
            const matchIndex = channel.matches.findIndex(
              m => m.mappingId === args.mappingId
            );
            if (matchIndex >= 0) {
              channel.matches.splice(matchIndex, 1);
              channel.matchCount = channel.matches.length;
              return channel.matches;
            }
          }
          throw new Error('Mapping not found');
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

      console.log('[Tauri Mock] Stream search mock initialized');
    })();
  `;

  await page.addInitScript(mockScript);
}

test.describe('Stream Search (search_xtream_streams)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*.{png,jpg,jpeg,svg,gif}', (route) => route.abort());
  });

  test('should search streams with fuzzy matching', async ({ page }) => {
    // GIVEN: Channel with search dropdown available
    const channel = createXmltvChannelWithMappings({
      id: 1,
      displayName: 'ESPN',
      matchCount: 1,
      isEnabled: true,
    });

    await injectStreamSearchMocks(page, { channels: [channel] });
    await page.goto('/');
    await page.click('a[href="/channels"]');
    await page.waitForLoadState('networkidle');

    // WHEN: Open add stream dropdown
    const channelRow = page.locator('[data-testid="channel-row-1"]');
    await channelRow.locator('[data-testid="expand-button"]').click();
    await channelRow.locator('[data-testid="add-stream-button"]').click();

    // THEN: Search input is pre-filled with channel name
    const searchInput = page.locator('[data-testid="stream-search-input"]');
    await expect(searchInput).toHaveValue('ESPN');

    // AND: Search results appear
    await page.waitForSelector('[data-testid="stream-list"]');
    const streamOptions = page.locator('[data-testid^="stream-option-"]');
    await expect(streamOptions).toHaveCount(2);

    // AND: Results show fuzzy scores
    await expect(page.locator('[data-testid="stream-option-101"]')).toContainText('95%');
  });

  test('should show error message when search fails', async ({ page }) => {
    // GIVEN: Search will fail
    const channel = createXmltvChannelWithMappings({
      id: 1,
      displayName: 'ESPN',
    });

    await injectStreamSearchMocks(page, {
      channels: [channel],
      searchError: 'Database connection failed',
    });
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // WHEN: Open search dropdown
    const channelRow = page.locator('[data-testid="channel-row-1"]');
    await channelRow.locator('[data-testid="expand-button"]').click();
    await channelRow.locator('[data-testid="add-stream-button"]').click();

    // THEN: Error message is shown
    await expect(page.locator('[data-testid="search-error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-error-message"]')).toContainText('Failed to search');
  });

  test('should show empty state when no results match', async ({ page }) => {
    // GIVEN: Search returns no results
    const channel = createXmltvChannelWithMappings({
      id: 1,
      displayName: 'Obscure Channel',
    });

    await injectStreamSearchMocks(page, {
      channels: [channel],
      searchResults: [], // No results
    });
    await page.goto('/');
    await page.click('a[href="/channels"]');

    // WHEN: Search for something with no matches
    const channelRow = page.locator('[data-testid="channel-row-1"]');
    await channelRow.locator('[data-testid="expand-button"]').click();
    await channelRow.locator('[data-testid="add-stream-button"]').click();

    // Clear the input and type a new search
    const searchInput = page.locator('[data-testid="stream-search-input"]');
    await searchInput.fill('xyz123nonexistent');

    // Wait for debounce
    await page.waitForTimeout(400);

    // THEN: Empty state message is shown
    await expect(page.locator('[data-testid="no-results-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="no-results-message"]')).toContainText('No streams match');
  });

  test('should close dropdown on escape key', async ({ page }) => {
    // GIVEN: Search dropdown is open
    const channel = createXmltvChannelWithMappings({
      id: 1,
      displayName: 'ESPN',
    });

    await injectStreamSearchMocks(page, { channels: [channel] });
    await page.goto('/');
    await page.click('a[href="/channels"]');

    const channelRow = page.locator('[data-testid="channel-row-1"]');
    await channelRow.locator('[data-testid="expand-button"]').click();
    await channelRow.locator('[data-testid="add-stream-button"]').click();

    // Verify dropdown is open
    await expect(page.locator('[data-testid="stream-search-input"]')).toBeVisible();

    // WHEN: Press escape
    await page.keyboard.press('Escape');

    // THEN: Dropdown closes
    await expect(page.locator('[data-testid="stream-search-input"]')).not.toBeVisible();
  });
});
