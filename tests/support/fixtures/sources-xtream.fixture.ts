import { test as base, Page } from '@playwright/test';
import { createAccount, createAccounts, Account } from '../factories/account.factory';
import {
  createXtreamAccountStream,
  createXtreamAccountStreams,
  createLinkedStream,
  createOrphanStream,
  createPromotedStream,
  createRealisticStreamMix,
  createStreamStats,
  createAccountStreamStats,
  XtreamAccountStream,
  AccountStreamStats,
} from '../factories/xtream-account-stream.factory';

/**
 * Sources View - Xtream Tab Fixtures (Story 3-11)
 *
 * Provides test fixtures for the Xtream tab in Sources view.
 * Injects Tauri mocks for Xtream streams with mapping status.
 *
 * Fixture architecture:
 * - Setup: Inject Tauri mocks with configured accounts/streams
 * - Provide: Return accounts and streams data to test
 * - Cleanup: Mock state is automatically cleared on page navigation
 */

interface SourcesXtreamState {
  accounts: Account[];
  streamsByAccountId: Map<number, XtreamAccountStream[]>;
  statsByAccountId: Map<number, AccountStreamStats>;
}

interface SourcesXtreamFixtures {
  /**
   * Injects Tauri mocks for Xtream sources with provided data.
   * Call this before navigating to the app.
   */
  injectXtreamSourcesMocks: (
    accounts: Account[],
    streamsByAccountId: Map<number, XtreamAccountStream[]>
  ) => Promise<void>;

  /**
   * Pre-configured scenario: Multiple accounts with varied stream data.
   * Automatically injects mocks - just navigate to /sources after using.
   */
  xtreamSourcesWithStreams: {
    accounts: Account[];
    streamsByAccountId: Map<number, XtreamAccountStream[]>;
    linkedStream: XtreamAccountStream;
    orphanStream: XtreamAccountStream;
    promotedStream: XtreamAccountStream;
  };

  /**
   * Pre-configured scenario: Empty state (no Xtream accounts).
   * Use to test empty state UI.
   */
  emptyXtreamState: void;

  /**
   * Pre-configured scenario: Single account with large stream count.
   * Use for performance testing.
   */
  largeXtreamAccount: {
    account: Account;
    streams: XtreamAccountStream[];
  };
}

/**
 * Generate the Tauri mock injection script for Xtream sources
 */
function generateXtreamMockScript(
  accounts: Account[],
  streamsByAccountId: Map<number, XtreamAccountStream[]>
): string {
  // Calculate stats for each account
  const statsByAccountId = new Map<number, AccountStreamStats>();
  streamsByAccountId.forEach((streams, accountId) => {
    statsByAccountId.set(accountId, createStreamStats(streams));
  });

  return `
    (function() {
      // State storage for Xtream sources
      window.__XTREAM_SOURCES_STATE__ = {
        accounts: ${JSON.stringify(accounts)},
        streamsByAccountId: new Map(${JSON.stringify(Array.from(streamsByAccountId.entries()))}),
        statsByAccountId: new Map(${JSON.stringify(Array.from(statsByAccountId.entries()))}),
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

        // Story 3-11: Get Xtream accounts
        get_accounts: () => {
          console.log('[Mock] get_accounts called');
          return window.__XTREAM_SOURCES_STATE__.accounts;
        },

        // Story 3-11: Get streams for a specific account with mapping status
        get_xtream_streams_for_account: (args) => {
          console.log('[Mock] get_xtream_streams_for_account called:', args);
          const { accountId } = args;

          const startTime = performance.now();
          const streams = window.__XTREAM_SOURCES_STATE__.streamsByAccountId.get(accountId) || [];
          const duration = performance.now() - startTime;
          console.log(\`[Mock] Loaded \${streams.length} streams for account \${accountId} in \${duration.toFixed(2)}ms\`);

          return streams;
        },

        // Story 3-11: Get stream stats for account header
        get_account_stream_stats: (args) => {
          console.log('[Mock] get_account_stream_stats called:', args);
          const { accountId } = args;

          const stats = window.__XTREAM_SOURCES_STATE__.statsByAccountId.get(accountId) || {
            streamCount: 0,
            linkedCount: 0,
            orphanCount: 0,
            promotedCount: 0,
          };

          return stats;
        },

        // Story 3-8: Promote orphan to Plex (create synthetic channel)
        promote_orphan_to_plex: (args) => {
          console.log('[Mock] promote_orphan_to_plex:', args);
          const { xtreamChannelId, displayName, icon, enableInLineup } = args;

          // Find and update the stream
          for (const [accountId, streams] of window.__XTREAM_SOURCES_STATE__.streamsByAccountId.entries()) {
            const stream = streams.find(s => s.id === xtreamChannelId);
            if (stream) {
              // Create synthetic channel ID
              const syntheticId = Math.floor(Math.random() * 1000) + 2000;

              // Update stream status
              stream.linkStatus = 'promoted';
              stream.syntheticChannelId = syntheticId;
              stream.linkedXmltvIds = [syntheticId];

              // Update stats
              const stats = window.__XTREAM_SOURCES_STATE__.statsByAccountId.get(accountId);
              if (stats) {
                stats.orphanCount--;
                stats.promotedCount++;
              }

              return { success: true, syntheticChannelId: syntheticId };
            }
          }

          throw new Error('Stream not found');
        },

        // Story 3-3: Add manual stream mapping (link to XMLTV channel)
        add_manual_stream_mapping: (args) => {
          console.log('[Mock] add_manual_stream_mapping:', args);
          const { xmltvChannelId, xtreamChannelId, setAsPrimary } = args;

          // Find and update the stream
          for (const [accountId, streams] of window.__XTREAM_SOURCES_STATE__.streamsByAccountId.entries()) {
            const stream = streams.find(s => s.id === xtreamChannelId);
            if (stream) {
              // Update stream status
              stream.linkStatus = 'linked';
              if (!stream.linkedXmltvIds.includes(xmltvChannelId)) {
                stream.linkedXmltvIds.push(xmltvChannelId);
              }
              stream.syntheticChannelId = null;

              // Update stats
              const stats = window.__XTREAM_SOURCES_STATE__.statsByAccountId.get(accountId);
              if (stats) {
                if (stream.linkStatus === 'orphan') {
                  stats.orphanCount--;
                  stats.linkedCount++;
                }
              }

              return { success: true, mappingId: Math.floor(Math.random() * 1000) };
            }
          }

          throw new Error('Stream not found');
        },

        // Story 3-3: Remove stream mapping
        remove_stream_mapping: (args) => {
          console.log('[Mock] remove_stream_mapping:', args);
          const { mappingId } = args;

          // Find and update the stream (simplified - just clear all links for now)
          for (const [accountId, streams] of window.__XTREAM_SOURCES_STATE__.streamsByAccountId.entries()) {
            // In a real scenario, we'd track mappingId → stream
            // For testing, we'll just find any linked stream and unlink it
            const linkedStream = streams.find(s => s.linkStatus === 'linked');
            if (linkedStream) {
              linkedStream.linkStatus = 'orphan';
              linkedStream.linkedXmltvIds = [];

              // Update stats
              const stats = window.__XTREAM_SOURCES_STATE__.statsByAccountId.get(accountId);
              if (stats) {
                stats.linkedCount--;
                stats.orphanCount++;
              }

              return { success: true };
            }
          }

          return { success: true };
        },

        // XMLTV sources integration
        get_xmltv_sources: () => {
          console.log('[Mock] get_xmltv_sources called');
          return [];
        },

        get_xmltv_channels_for_source: (args) => {
          console.log('[Mock] get_xmltv_channels_for_source called:', args);
          return [];
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

      // Tauri V2 internals mock
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
        getState: () => window.__XTREAM_SOURCES_STATE__,
      };

      console.log('[Tauri Mock] Xtream sources mock initialized with', window.__XTREAM_SOURCES_STATE__.accounts.length, 'accounts');
    })();
  `;
}

/**
 * Extended test with Xtream sources fixtures
 */
export const test = base.extend<SourcesXtreamFixtures>({
  /**
   * injectXtreamSourcesMocks: Low-level fixture for custom mock injection
   */
  injectXtreamSourcesMocks: async ({ page }, use) => {
    const inject = async (
      accounts: Account[],
      streamsByAccountId: Map<number, XtreamAccountStream[]>
    ): Promise<void> => {
      const mockScript = generateXtreamMockScript(accounts, streamsByAccountId);
      await page.addInitScript(mockScript);
    };

    await use(inject);
    // No cleanup needed - mocks are cleared on page navigation
  },

  /**
   * xtreamSourcesWithStreams: Pre-configured scenario with multiple accounts
   */
  xtreamSourcesWithStreams: async ({ page }, use) => {
    // Create test accounts
    const accounts = [
      createAccount({ id: 1, name: 'IPTV Provider A' }),
      createAccount({ id: 2, name: 'IPTV Provider B' }),
    ];

    // Create specific streams for testing different scenarios
    const linkedStream = createLinkedStream({
      id: 1001,
      name: 'CNN HD',
      linkedXmltvIds: [500],
    });

    const orphanStream = createOrphanStream({
      id: 1002,
      name: 'Local Sports Channel',
    });

    const promotedStream = createPromotedStream({
      id: 1003,
      name: 'Promoted Stream HD',
      syntheticChannelId: 2500,
    });

    // Account 1: Mix of stream states
    const account1Streams = [
      linkedStream,
      orphanStream,
      promotedStream,
      ...createRealisticStreamMix(17), // 17 more streams
    ];

    // Account 2: Smaller set
    const account2Streams = createRealisticStreamMix(10);

    const streamsByAccountId = new Map<number, XtreamAccountStream[]>([
      [1, account1Streams],
      [2, account2Streams],
    ]);

    // Inject mocks
    const mockScript = generateXtreamMockScript(accounts, streamsByAccountId);
    await page.addInitScript(mockScript);

    // Provide data to test
    await use({
      accounts,
      streamsByAccountId,
      linkedStream,
      orphanStream,
      promotedStream,
    });
  },

  /**
   * emptyXtreamState: Scenario with no Xtream accounts
   */
  emptyXtreamState: async ({ page }, use) => {
    const mockScript = generateXtreamMockScript([], new Map());
    await page.addInitScript(mockScript);
    await use();
  },

  /**
   * largeXtreamAccount: Performance test scenario
   */
  largeXtreamAccount: async ({ page }, use) => {
    const account = createAccount({ id: 1, name: 'Large IPTV Provider' });
    const streams = createRealisticStreamMix(500);

    const streamsByAccountId = new Map<number, XtreamAccountStream[]>([
      [1, streams],
    ]);

    const mockScript = generateXtreamMockScript([account], streamsByAccountId);
    await page.addInitScript(mockScript);

    await use({ account, streams });
  },
});

// Re-export expect and factory functions for convenience
export { expect } from '@playwright/test';
export {
  createXtreamAccountStream,
  createXtreamAccountStreams,
  createLinkedStream,
  createOrphanStream,
  createPromotedStream,
  createRealisticStreamMix,
  createStreamStats,
  createAccountStreamStats,
} from '../factories/xtream-account-stream.factory';
export { createAccount, createAccounts } from '../factories/account.factory';
export type { XtreamAccountStream, AccountStreamStats } from '../factories/xtream-account-stream.factory';
export type { Account } from '../factories/account.factory';
