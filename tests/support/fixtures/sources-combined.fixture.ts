import { test as base } from '@playwright/test';
import {
  createM3uSource,
  createM3uChannel,
  createM3uSourceWithChannels,
  M3uSource,
  M3uChannel,
  M3uSourceWithChannels,
} from '../factories/m3u-source.factory';
import {
  createAcestreamSource,
  createAcestreamSources,
  createAcestreamStatusSupported,
  createAcestreamStatusUnsupported,
  createAcestreamStatusNoEngine,
  AcestreamSource,
  AcestreamStatus,
} from '../factories/acestream-source.factory';

/**
 * Combined Sources Fixture
 *
 * Provides a unified fixture that properly merges M3U and Acestream setups.
 * Use this when you need to test scenarios involving both source types.
 *
 * This fixture resolves the conflict between separate M3U and Acestream fixtures
 * by providing a single mock injection that handles both source types.
 *
 * @see tech-spec-multi-source-stream-support.md
 */

interface CombinedSourcesState {
  m3uSources: M3uSource[];
  m3uChannelsBySourceId: Map<number, M3uChannel[]>;
  acestreamSources: AcestreamSource[];
  acestreamStatus: AcestreamStatus;
}

interface CombinedSourcesFixtures {
  /**
   * Injects Tauri mocks for both M3U and Acestream sources.
   * Call this before navigating to the app.
   */
  injectCombinedSourcesMocks: (config: {
    m3uSources?: M3uSource[];
    m3uChannelsBySourceId?: Map<number, M3uChannel[]>;
    acestreamSources?: AcestreamSource[];
    acestreamStatus?: AcestreamStatus;
  }) => Promise<void>;

  /**
   * Pre-configured scenario: Both M3U and Acestream sources with data.
   * Automatically injects mocks - just navigate to /sources after using.
   */
  combinedSourcesWithData: {
    m3uSources: M3uSource[];
    m3uChannelsBySourceId: Map<number, M3uChannel[]>;
    acestreamSources: AcestreamSource[];
    acestreamStatus: AcestreamStatus;
    m3uSourceWithChannels: M3uSourceWithChannels;
  };

  /**
   * Pre-configured scenario: Empty state for both source types.
   */
  combinedSourcesEmpty: {
    acestreamStatus: AcestreamStatus;
  };

  /**
   * Pre-configured scenario: M3U sources only, no Acestream.
   */
  m3uSourcesOnly: {
    m3uSources: M3uSource[];
    m3uChannelsBySourceId: Map<number, M3uChannel[]>;
    acestreamStatus: AcestreamStatus;
  };

  /**
   * Pre-configured scenario: Acestream sources only, no M3U.
   */
  acestreamSourcesOnly: {
    acestreamSources: AcestreamSource[];
    acestreamStatus: AcestreamStatus;
  };

  /**
   * Pre-configured scenario: Mac platform (Acestream unsupported but M3U works).
   */
  combinedSourcesMac: {
    m3uSources: M3uSource[];
    m3uChannelsBySourceId: Map<number, M3uChannel[]>;
    acestreamSources: AcestreamSource[];
    acestreamStatus: AcestreamStatus;
  };
}

/**
 * Generate the Tauri mock injection script for combined sources
 */
function generateCombinedMockScript(
  m3uSources: M3uSource[],
  m3uChannelsBySourceId: Map<number, M3uChannel[]>,
  acestreamSources: AcestreamSource[],
  acestreamStatus: AcestreamStatus
): string {
  return `
    (function() {
      // Combined state storage
      window.__COMBINED_SOURCES_STATE__ = {
        m3uSources: ${JSON.stringify(m3uSources)},
        m3uChannelsBySourceId: new Map(${JSON.stringify(Array.from(m3uChannelsBySourceId.entries()))}),
        acestreamSources: ${JSON.stringify(acestreamSources)},
        acestreamStatus: ${JSON.stringify(acestreamStatus)},
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

        // ========================================
        // M3U Source Commands
        // ========================================
        get_m3u_sources: () => {
          console.log('[Mock] get_m3u_sources called');
          return window.__COMBINED_SOURCES_STATE__.m3uSources;
        },

        add_m3u_source: (args) => {
          console.log('[Mock] add_m3u_source called:', args);
          const { name, url, refreshIntervalHours } = args;

          const now = new Date().toISOString();
          const newId = Math.max(0, ...window.__COMBINED_SOURCES_STATE__.m3uSources.map(s => s.id), 0) + 1;

          const newSource = {
            id: newId,
            name,
            url,
            refreshIntervalHours: refreshIntervalHours || 24,
            lastRefresh: now,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          };

          const mockChannels = [
            { id: newId * 1000 + 1, sourceId: newId, streamUrl: 'http://example.com/stream1.m3u8', name: 'Channel 1', tvgId: 'ch1', tvgName: 'Channel 1', tvgLogo: null, groupTitle: 'News', createdAt: now, updatedAt: now },
            { id: newId * 1000 + 2, sourceId: newId, streamUrl: 'http://example.com/stream2.m3u8', name: 'Channel 2', tvgId: 'ch2', tvgName: 'Channel 2', tvgLogo: null, groupTitle: 'Sports', createdAt: now, updatedAt: now },
          ];

          window.__COMBINED_SOURCES_STATE__.m3uSources.push(newSource);
          window.__COMBINED_SOURCES_STATE__.m3uChannelsBySourceId.set(newId, mockChannels);

          return { source: newSource, channelCount: mockChannels.length };
        },

        refresh_m3u_source: (args) => {
          console.log('[Mock] refresh_m3u_source called:', args);
          const { sourceId } = args;

          const source = window.__COMBINED_SOURCES_STATE__.m3uSources.find(s => s.id === sourceId);
          if (!source) throw new Error('M3U source not found');

          const now = new Date().toISOString();
          source.lastRefresh = now;
          source.updatedAt = now;

          const channels = window.__COMBINED_SOURCES_STATE__.m3uChannelsBySourceId.get(sourceId) || [];

          return { source, channelCount: channels.length, added: 0, removed: 0, updated: 0 };
        },

        delete_m3u_source: (args) => {
          console.log('[Mock] delete_m3u_source called:', args);
          const { sourceId } = args;

          const index = window.__COMBINED_SOURCES_STATE__.m3uSources.findIndex(s => s.id === sourceId);
          if (index === -1) throw new Error('M3U source not found');

          window.__COMBINED_SOURCES_STATE__.m3uSources.splice(index, 1);
          window.__COMBINED_SOURCES_STATE__.m3uChannelsBySourceId.delete(sourceId);

          return { success: true };
        },

        get_m3u_channels: (args) => {
          console.log('[Mock] get_m3u_channels called:', args);
          const { sourceId } = args;
          return window.__COMBINED_SOURCES_STATE__.m3uChannelsBySourceId.get(sourceId) || [];
        },

        // ========================================
        // Acestream Source Commands
        // ========================================
        get_acestream_sources: () => {
          console.log('[Mock] get_acestream_sources called');
          return window.__COMBINED_SOURCES_STATE__.acestreamSources;
        },

        add_acestream_source: (args) => {
          console.log('[Mock] add_acestream_source called:', args);
          const { name, contentId } = args;

          if (!/^[a-f0-9]{40}$/i.test(contentId)) {
            throw new Error('Invalid Acestream content ID format');
          }

          if (window.__COMBINED_SOURCES_STATE__.acestreamSources.some(s => s.contentId === contentId)) {
            throw new Error('Acestream source with this content ID already exists');
          }

          const now = new Date().toISOString();
          const newId = Math.max(0, ...window.__COMBINED_SOURCES_STATE__.acestreamSources.map(s => s.id), 0) + 1;

          const newSource = {
            id: newId,
            name,
            contentId: contentId.toLowerCase(),
            isActive: true,
            createdAt: now,
            updatedAt: now,
          };

          window.__COMBINED_SOURCES_STATE__.acestreamSources.push(newSource);
          return newSource;
        },

        delete_acestream_source: (args) => {
          console.log('[Mock] delete_acestream_source called:', args);
          const { sourceId } = args;

          const index = window.__COMBINED_SOURCES_STATE__.acestreamSources.findIndex(s => s.id === sourceId);
          if (index === -1) throw new Error('Acestream source not found');

          window.__COMBINED_SOURCES_STATE__.acestreamSources.splice(index, 1);
          return { success: true };
        },

        toggle_acestream_source: (args) => {
          console.log('[Mock] toggle_acestream_source called:', args);
          const { sourceId, active } = args;

          const source = window.__COMBINED_SOURCES_STATE__.acestreamSources.find(s => s.id === sourceId);
          if (!source) throw new Error('Acestream source not found');

          source.isActive = active;
          source.updatedAt = new Date().toISOString();
          return source;
        },

        check_acestream_status: () => {
          console.log('[Mock] check_acestream_status called');
          return window.__COMBINED_SOURCES_STATE__.acestreamStatus;
        },

        // ========================================
        // Xtream Commands (for tab integration)
        // ========================================
        get_accounts: () => [],
        get_xtream_streams_for_account: () => [],
        get_account_stream_stats: () => ({ streamCount: 0, linkedCount: 0, orphanCount: 0, promotedCount: 0 }),

        // ========================================
        // XMLTV Commands (for tab integration)
        // ========================================
        get_xmltv_sources: () => [],
        get_xmltv_channels_for_source: () => [],
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

      window.__TAURI__ = { invoke: mockInvoke };

      window.__TAURI_MOCK__ = {
        invoke: mockInvoke,
        commands: mockCommands,
        getState: () => window.__COMBINED_SOURCES_STATE__,
      };

      console.log('[Tauri Mock] Combined sources mock initialized:',
        'M3U sources:', window.__COMBINED_SOURCES_STATE__.m3uSources.length,
        'Acestream sources:', window.__COMBINED_SOURCES_STATE__.acestreamSources.length);
    })();
  `;
}

/**
 * Extended test with combined sources fixtures
 */
export const test = base.extend<CombinedSourcesFixtures>({
  /**
   * injectCombinedSourcesMocks: Low-level fixture for custom mock injection
   */
  injectCombinedSourcesMocks: async ({ page }, use) => {
    const inject = async (config: {
      m3uSources?: M3uSource[];
      m3uChannelsBySourceId?: Map<number, M3uChannel[]>;
      acestreamSources?: AcestreamSource[];
      acestreamStatus?: AcestreamStatus;
    }): Promise<void> => {
      const mockScript = generateCombinedMockScript(
        config.m3uSources || [],
        config.m3uChannelsBySourceId || new Map(),
        config.acestreamSources || [],
        config.acestreamStatus || createAcestreamStatusSupported(true, { platform: 'linux' })
      );
      await page.addInitScript(mockScript);
    };

    await use(inject);
  },

  /**
   * combinedSourcesWithData: Both M3U and Acestream sources with data
   */
  combinedSourcesWithData: async ({ page }, use) => {
    // Create M3U sources
    const m3uSourceWithChannels = createM3uSourceWithChannels(15, {
      id: 1,
      name: 'Premium IPTV',
      url: 'https://premium.example.com/playlist.m3u',
    });

    const m3uSources = [m3uSourceWithChannels.source];
    const m3uChannelsBySourceId = new Map<number, M3uChannel[]>([
      [1, m3uSourceWithChannels.channels],
    ]);

    // Create Acestream sources
    const acestreamSources = createAcestreamSources(3);
    const acestreamStatus = createAcestreamStatusSupported(true, { platform: 'linux' });

    // Inject combined mocks
    const mockScript = generateCombinedMockScript(
      m3uSources,
      m3uChannelsBySourceId,
      acestreamSources,
      acestreamStatus
    );
    await page.addInitScript(mockScript);

    await use({
      m3uSources,
      m3uChannelsBySourceId,
      acestreamSources,
      acestreamStatus,
      m3uSourceWithChannels,
    });
  },

  /**
   * combinedSourcesEmpty: Empty state for both source types
   */
  combinedSourcesEmpty: async ({ page }, use) => {
    const acestreamStatus = createAcestreamStatusSupported(true, { platform: 'linux' });

    const mockScript = generateCombinedMockScript(
      [],
      new Map(),
      [],
      acestreamStatus
    );
    await page.addInitScript(mockScript);

    await use({ acestreamStatus });
  },

  /**
   * m3uSourcesOnly: M3U sources only, no Acestream
   */
  m3uSourcesOnly: async ({ page }, use) => {
    const { source, channels } = createM3uSourceWithChannels(10, {
      id: 1,
      name: 'M3U Only Playlist',
    });

    const m3uSources = [source];
    const m3uChannelsBySourceId = new Map<number, M3uChannel[]>([[1, channels]]);
    const acestreamStatus = createAcestreamStatusNoEngine({ platform: 'linux' });

    const mockScript = generateCombinedMockScript(
      m3uSources,
      m3uChannelsBySourceId,
      [],
      acestreamStatus
    );
    await page.addInitScript(mockScript);

    await use({ m3uSources, m3uChannelsBySourceId, acestreamStatus });
  },

  /**
   * acestreamSourcesOnly: Acestream sources only, no M3U
   */
  acestreamSourcesOnly: async ({ page }, use) => {
    const acestreamSources = createAcestreamSources(3);
    const acestreamStatus = createAcestreamStatusSupported(true, { platform: 'windows' });

    const mockScript = generateCombinedMockScript(
      [],
      new Map(),
      acestreamSources,
      acestreamStatus
    );
    await page.addInitScript(mockScript);

    await use({ acestreamSources, acestreamStatus });
  },

  /**
   * combinedSourcesMac: Mac platform (Acestream unsupported but M3U works)
   */
  combinedSourcesMac: async ({ page }, use) => {
    const { source, channels } = createM3uSourceWithChannels(10, {
      id: 1,
      name: 'Mac M3U Playlist',
    });

    const m3uSources = [source];
    const m3uChannelsBySourceId = new Map<number, M3uChannel[]>([[1, channels]]);
    const acestreamSources = createAcestreamSources(2); // Still have sources, just can't use them
    const acestreamStatus = createAcestreamStatusUnsupported();

    const mockScript = generateCombinedMockScript(
      m3uSources,
      m3uChannelsBySourceId,
      acestreamSources,
      acestreamStatus
    );
    await page.addInitScript(mockScript);

    await use({ m3uSources, m3uChannelsBySourceId, acestreamSources, acestreamStatus });
  },
});

// Re-export expect and factory functions for convenience
export { expect } from '@playwright/test';

// M3U exports
export {
  createM3uSource,
  createM3uChannel,
  createM3uSourceWithChannels,
} from '../factories/m3u-source.factory';
export type { M3uSource, M3uChannel, M3uSourceWithChannels } from '../factories/m3u-source.factory';

// Acestream exports
export {
  createAcestreamSource,
  createAcestreamSources,
  createAcestreamStatusSupported,
  createAcestreamStatusUnsupported,
  createAcestreamStatusNoEngine,
  generateAcestreamContentId,
} from '../factories/acestream-source.factory';
export type { AcestreamSource, AcestreamStatus } from '../factories/acestream-source.factory';
