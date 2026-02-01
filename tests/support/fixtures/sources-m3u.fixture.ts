import { test as base } from '@playwright/test';
import {
  createM3uSource,
  createM3uSources,
  createM3uChannel,
  createM3uChannels,
  createM3uSourceWithChannels,
  createM3uSourcesWithChannels,
  M3uSource,
  M3uChannel,
  M3uSourceWithChannels,
} from '../factories/m3u-source.factory';

/**
 * Sources View - M3U Tab Fixtures
 *
 * Provides test fixtures for the M3U tab in Sources view.
 * Injects Tauri mocks for M3U sources and channels.
 *
 * Fixture architecture:
 * - Setup: Inject Tauri mocks with configured M3U sources
 * - Provide: Return sources and channels data to test
 * - Cleanup: Mock state is automatically cleared on page navigation
 *
 * @see tech-spec-multi-source-stream-support.md
 */

interface M3uSourcesState {
  sources: M3uSource[];
  channelsBySourceId: Map<number, M3uChannel[]>;
}

interface M3uSourcesFixtures {
  /**
   * Injects Tauri mocks for M3U sources with provided data.
   * Call this before navigating to the app.
   */
  injectM3uSourcesMocks: (
    sources: M3uSource[],
    channelsBySourceId: Map<number, M3uChannel[]>
  ) => Promise<void>;

  /**
   * Pre-configured scenario: Multiple M3U sources with channels.
   * Automatically injects mocks - just navigate to /sources after using.
   */
  m3uSourcesWithChannels: {
    sources: M3uSource[];
    channelsBySourceId: Map<number, M3uChannel[]>;
    sourceWithFullChannels: M3uSourceWithChannels;
    sourceWithMinimalChannels: M3uSourceWithChannels;
  };

  /**
   * Pre-configured scenario: Empty state (no M3U sources).
   * Use to test empty state UI.
   */
  emptyM3uState: void;

  /**
   * Pre-configured scenario: Single M3U source with large channel count.
   * Use for performance testing.
   */
  largeM3uSource: {
    source: M3uSource;
    channels: M3uChannel[];
  };

  /**
   * Pre-configured scenario: M3U source with refresh pending.
   * Use for testing refresh flow.
   */
  m3uSourcePendingRefresh: {
    source: M3uSource;
    channels: M3uChannel[];
  };
}

/**
 * Generate the Tauri mock injection script for M3U sources
 */
function generateM3uMockScript(
  sources: M3uSource[],
  channelsBySourceId: Map<number, M3uChannel[]>
): string {
  return `
    (function() {
      // State storage for M3U sources
      window.__M3U_SOURCES_STATE__ = {
        sources: ${JSON.stringify(sources)},
        channelsBySourceId: new Map(${JSON.stringify(Array.from(channelsBySourceId.entries()))}),
      };

      const mockCommands = {
        // Core settings commands
        greet: (args) => \`Hello, \${args.name}! Welcome to StreamForge.\`,
        get_setting: () => null,
        set_setting: () => undefined,
        get_server_port: () => 5004,
        set_server_port: () => undefined,
        get_autostart_enabled: () => ({ enabled: false }),
        set_autostart_enabled: () => undefined,

        // M3U Source Commands
        get_m3u_sources: () => {
          console.log('[Mock] get_m3u_sources called');
          return window.__M3U_SOURCES_STATE__.sources;
        },

        add_m3u_source: (args) => {
          console.log('[Mock] add_m3u_source called:', args);
          const { name, url, refreshIntervalHours, isLocalFile, isSingleStream } = args;

          const now = new Date().toISOString();
          const newId = Math.max(0, ...window.__M3U_SOURCES_STATE__.sources.map(s => s.id)) + 1;

          const newSource = {
            id: newId,
            name,
            url,
            refreshIntervalHours: isSingleStream ? null : (refreshIntervalHours || 24),
            lastRefresh: now,
            isActive: true,
            isLocalFile: isLocalFile || false,
            createdAt: now,
            updatedAt: now,
          };

          // Simulate parsing playlist and adding channels
          let mockChannels;
          if (isSingleStream) {
            // Single stream creates a virtual channel entry
            mockChannels = [
              { id: newId * 1000 + 1, sourceId: newId, streamUrl: url, name: name, tvgId: null, tvgName: name, tvgLogo: null, groupTitle: 'Single Streams', createdAt: now, updatedAt: now },
            ];
          } else if (isLocalFile) {
            // Local file parsing simulation
            mockChannels = [
              { id: newId * 1000 + 1, sourceId: newId, streamUrl: 'http://example.com/local-stream1.m3u8', name: 'Local Channel 1', tvgId: 'local1', tvgName: 'Local Channel 1', tvgLogo: null, groupTitle: 'Local', createdAt: now, updatedAt: now },
              { id: newId * 1000 + 2, sourceId: newId, streamUrl: 'http://example.com/local-stream2.m3u8', name: 'Local Channel 2', tvgId: 'local2', tvgName: 'Local Channel 2', tvgLogo: null, groupTitle: 'Local', createdAt: now, updatedAt: now },
              { id: newId * 1000 + 3, sourceId: newId, streamUrl: 'http://example.com/local-stream3.m3u8', name: 'Local Channel 3', tvgId: 'local3', tvgName: 'Local Channel 3', tvgLogo: null, groupTitle: 'Local', createdAt: now, updatedAt: now },
            ];
          } else {
            // URL playlist parsing simulation
            mockChannels = [
              { id: newId * 1000 + 1, sourceId: newId, streamUrl: 'http://example.com/stream1.m3u8', name: 'Channel 1', tvgId: 'ch1', tvgName: 'Channel 1', tvgLogo: null, groupTitle: 'News', createdAt: now, updatedAt: now },
              { id: newId * 1000 + 2, sourceId: newId, streamUrl: 'http://example.com/stream2.m3u8', name: 'Channel 2', tvgId: 'ch2', tvgName: 'Channel 2', tvgLogo: null, groupTitle: 'Sports', createdAt: now, updatedAt: now },
            ];
          }

          window.__M3U_SOURCES_STATE__.sources.push(newSource);
          window.__M3U_SOURCES_STATE__.channelsBySourceId.set(newId, mockChannels);

          return { source: newSource, channelCount: mockChannels.length };
        },

        refresh_m3u_source: (args) => {
          console.log('[Mock] refresh_m3u_source called:', args);
          const { sourceId } = args;

          const source = window.__M3U_SOURCES_STATE__.sources.find(s => s.id === sourceId);
          if (!source) {
            throw new Error('M3U source not found');
          }

          const now = new Date().toISOString();
          source.lastRefresh = now;
          source.updatedAt = now;

          // Simulate adding a new channel on refresh
          const channels = window.__M3U_SOURCES_STATE__.channelsBySourceId.get(sourceId) || [];
          const newChannel = {
            id: channels.length > 0 ? Math.max(...channels.map(c => c.id)) + 1 : 1,
            sourceId,
            streamUrl: 'http://example.com/new-stream.m3u8',
            name: 'New Channel (from refresh)',
            tvgId: 'new-ch',
            tvgName: 'New Channel',
            tvgLogo: null,
            groupTitle: 'Added',
            createdAt: now,
            updatedAt: now,
          };
          channels.push(newChannel);
          window.__M3U_SOURCES_STATE__.channelsBySourceId.set(sourceId, channels);

          return {
            source,
            channelCount: channels.length,
            added: 1,
            removed: 0,
            updated: 0,
          };
        },

        delete_m3u_source: (args) => {
          console.log('[Mock] delete_m3u_source called:', args);
          const { sourceId } = args;

          const index = window.__M3U_SOURCES_STATE__.sources.findIndex(s => s.id === sourceId);
          if (index === -1) {
            throw new Error('M3U source not found');
          }

          window.__M3U_SOURCES_STATE__.sources.splice(index, 1);
          window.__M3U_SOURCES_STATE__.channelsBySourceId.delete(sourceId);

          return { success: true };
        },

        get_m3u_channels: (args) => {
          console.log('[Mock] get_m3u_channels called:', args);
          const { sourceId } = args;

          return window.__M3U_SOURCES_STATE__.channelsBySourceId.get(sourceId) || [];
        },

        // Xtream commands (for tab integration)
        get_accounts: () => [],
        get_xtream_streams_for_account: () => [],
        get_account_stream_stats: () => ({ streamCount: 0, linkedCount: 0, orphanCount: 0, promotedCount: 0 }),

        // XMLTV commands (for tab integration)
        get_xmltv_sources: () => [],
        get_xmltv_channels_for_source: () => [],

        // Acestream commands (stub)
        get_acestream_sources: () => [],
        check_acestream_status: () => ({ isSupported: true, engineAvailable: false, platform: 'linux', engineUrl: 'http://127.0.0.1:6878' }),
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
        getState: () => window.__M3U_SOURCES_STATE__,
      };

      console.log('[Tauri Mock] M3U sources mock initialized with', window.__M3U_SOURCES_STATE__.sources.length, 'sources');
    })();
  `;
}

/**
 * Extended test with M3U sources fixtures
 */
export const test = base.extend<M3uSourcesFixtures>({
  /**
   * injectM3uSourcesMocks: Low-level fixture for custom mock injection
   */
  injectM3uSourcesMocks: async ({ page }, use) => {
    const inject = async (
      sources: M3uSource[],
      channelsBySourceId: Map<number, M3uChannel[]>
    ): Promise<void> => {
      const mockScript = generateM3uMockScript(sources, channelsBySourceId);
      await page.addInitScript(mockScript);
    };

    await use(inject);
  },

  /**
   * m3uSourcesWithChannels: Pre-configured scenario with multiple sources
   */
  m3uSourcesWithChannels: async ({ page }, use) => {
    // Create test sources with varying channel counts
    const sourceWithFullChannels = createM3uSourceWithChannels(25, {
      id: 1,
      name: 'Premium IPTV Playlist',
      url: 'https://premium-iptv.example.com/playlist.m3u',
    });

    const sourceWithMinimalChannels = createM3uSourceWithChannels(5, {
      id: 2,
      name: 'Free Channels',
      url: 'https://free-channels.example.com/list.m3u8',
    });

    const sources = [sourceWithFullChannels.source, sourceWithMinimalChannels.source];
    const channelsBySourceId = new Map<number, M3uChannel[]>([
      [1, sourceWithFullChannels.channels],
      [2, sourceWithMinimalChannels.channels],
    ]);

    // Inject mocks
    const mockScript = generateM3uMockScript(sources, channelsBySourceId);
    await page.addInitScript(mockScript);

    // Provide data to test
    await use({
      sources,
      channelsBySourceId,
      sourceWithFullChannels,
      sourceWithMinimalChannels,
    });
  },

  /**
   * emptyM3uState: Scenario with no M3U sources
   */
  emptyM3uState: async ({ page }, use) => {
    const mockScript = generateM3uMockScript([], new Map());
    await page.addInitScript(mockScript);
    await use();
  },

  /**
   * largeM3uSource: Performance test scenario
   */
  largeM3uSource: async ({ page }, use) => {
    const { source, channels } = createM3uSourceWithChannels(500, {
      id: 1,
      name: 'Mega IPTV Playlist',
    });

    const channelsBySourceId = new Map<number, M3uChannel[]>([[1, channels]]);
    const mockScript = generateM3uMockScript([source], channelsBySourceId);
    await page.addInitScript(mockScript);

    await use({ source, channels });
  },

  /**
   * m3uSourcePendingRefresh: Source that hasn't been refreshed recently
   */
  m3uSourcePendingRefresh: async ({ page }, use) => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 7); // 7 days ago

    const { source, channels } = createM3uSourceWithChannels(10, {
      id: 1,
      name: 'Stale Playlist',
      lastRefresh: oldDate.toISOString(),
      refreshIntervalHours: 24,
    });

    const channelsBySourceId = new Map<number, M3uChannel[]>([[1, channels]]);
    const mockScript = generateM3uMockScript([source], channelsBySourceId);
    await page.addInitScript(mockScript);

    await use({ source, channels });
  },
});

// Re-export expect and factory functions for convenience
export { expect } from '@playwright/test';
export {
  createM3uSource,
  createM3uSources,
  createM3uChannel,
  createM3uChannels,
  createM3uSourceWithChannels,
  createM3uSourcesWithChannels,
} from '../factories/m3u-source.factory';
export type { M3uSource, M3uChannel, M3uSourceWithChannels } from '../factories/m3u-source.factory';
