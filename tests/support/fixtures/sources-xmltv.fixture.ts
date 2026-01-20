import { test as base, Page } from '@playwright/test';
import {
  createXmltvSourceChannel,
  createXmltvSourceChannels,
  createEnabledXmltvChannel,
  createDisabledXmltvChannel,
  createUnmatchedXmltvChannel,
  createMatchedXmltvChannel,
  createRealisticChannelMix,
  XmltvSourceChannel,
} from '../factories/xmltv-source-channel.factory';
import {
  createXmltvSource,
  createXmltvSources,
  XmltvSource,
} from '../factories/xmltv-source.factory';

/**
 * Sources View Fixtures (Story 3-10)
 *
 * Provides test fixtures for the Sources view with XMLTV tab.
 * Injects Tauri mocks for all required commands and manages test data.
 *
 * Fixture architecture:
 * - Setup: Inject Tauri mocks with configured sources/channels
 * - Provide: Return sources and channels data to test
 * - Cleanup: Mock state is automatically cleared on page navigation
 */

interface SourcesViewState {
  sources: XmltvSource[];
  channelsBySourceId: Map<number, XmltvSourceChannel[]>;
}

interface SourcesXmltvFixtures {
  /**
   * Injects Tauri mocks for Sources view with provided data.
   * Call this before navigating to the app.
   */
  injectSourcesMocks: (
    sources: XmltvSource[],
    channelsBySourceId: Map<number, XmltvSourceChannel[]>
  ) => Promise<void>;

  /**
   * Pre-configured scenario: Multiple sources with varied channel data.
   * Automatically injects mocks - just navigate to /sources after using.
   */
  sourcesWithChannels: {
    sources: XmltvSource[];
    channelsBySourceId: Map<number, XmltvSourceChannel[]>;
    enabledChannel: XmltvSourceChannel;
    disabledChannel: XmltvSourceChannel;
    unmatchedChannel: XmltvSourceChannel;
  };

  /**
   * Pre-configured scenario: Empty state (no XMLTV sources).
   * Use to test empty state UI.
   */
  emptySourcesState: void;

  /**
   * Pre-configured scenario: Single source with large channel count.
   * Use for performance testing.
   */
  largeSourceWithChannels: {
    source: XmltvSource;
    channels: XmltvSourceChannel[];
  };
}

/**
 * Generate the Tauri mock injection script
 */
function generateMockScript(
  sources: XmltvSource[],
  channelsBySourceId: Map<number, XmltvSourceChannel[]>
): string {
  return `
    (function() {
      // State storage for Sources view
      window.__SOURCES_STATE__ = {
        sources: ${JSON.stringify(sources)},
        channelsBySourceId: new Map(${JSON.stringify(Array.from(channelsBySourceId.entries()))}),
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

        // Story 3-10: Get XMLTV sources
        get_xmltv_sources: () => {
          console.log('[Mock] get_xmltv_sources called');
          return window.__SOURCES_STATE__.sources;
        },

        // Story 3-10: Get channels for a specific source
        get_xmltv_channels_for_source: (args) => {
          console.log('[Mock] get_xmltv_channels_for_source called:', args);
          const { sourceId } = args;

          const startTime = performance.now();
          const channels = window.__SOURCES_STATE__.channelsBySourceId.get(sourceId) || [];
          const duration = performance.now() - startTime;
          console.log(\`[Mock] Loaded \${channels.length} channels for source \${sourceId} in \${duration.toFixed(2)}ms\`);

          return channels;
        },

        // Story 3-10: Toggle channel enabled status
        toggle_xmltv_channel: (args) => {
          console.log('[Mock] toggle_xmltv_channel:', args);
          const { channelId } = args;

          let channel = null;
          for (const [sourceId, channels] of window.__SOURCES_STATE__.channelsBySourceId.entries()) {
            channel = channels.find(ch => ch.id === channelId);
            if (channel) break;
          }

          if (!channel) {
            throw new Error(\`Channel \${channelId} not found\`);
          }

          // Business rule: cannot enable channel with no matches
          if (!channel.isEnabled && channel.matchCount === 0) {
            throw new Error('Cannot enable channel without stream source');
          }

          channel.isEnabled = !channel.isEnabled;
          return channel;
        },

        // Story 3-10: Get EPG stats for source
        get_epg_stats: (args) => {
          console.log('[Mock] get_epg_stats:', args);
          const { sourceId } = args;
          const channels = window.__SOURCES_STATE__.channelsBySourceId.get(sourceId) || [];

          return {
            channelCount: channels.length,
            programCount: channels.length * 300,
          };
        },

        // Target lineup integration
        get_target_lineup_channels: () => {
          console.log('[Mock] get_target_lineup_channels called');
          const allChannels = [];
          for (const channels of window.__SOURCES_STATE__.channelsBySourceId.values()) {
            allChannels.push(...channels.filter(ch => ch.isEnabled));
          }
          return allChannels.sort((a, b) => a.id - b.id);
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
        getState: () => window.__SOURCES_STATE__,
      };

      console.log('[Tauri Mock] Sources mock initialized with', window.__SOURCES_STATE__.sources.length, 'sources');
    })();
  `;
}

/**
 * Extended test with Sources view fixtures
 */
export const test = base.extend<SourcesXmltvFixtures>({
  /**
   * injectSourcesMocks: Low-level fixture for custom mock injection
   */
  injectSourcesMocks: async ({ page }, use) => {
    const inject = async (
      sources: XmltvSource[],
      channelsBySourceId: Map<number, XmltvSourceChannel[]>
    ): Promise<void> => {
      const mockScript = generateMockScript(sources, channelsBySourceId);
      await page.addInitScript(mockScript);
    };

    await use(inject);
    // No cleanup needed - mocks are cleared on page navigation
  },

  /**
   * sourcesWithChannels: Pre-configured scenario with multiple sources
   */
  sourcesWithChannels: async ({ page }, use) => {
    // Create diverse test data
    const sources = [
      createXmltvSource({ id: 1, name: 'IPTV Provider A EPG' }),
      createXmltvSource({ id: 2, name: 'IPTV Provider B EPG' }),
    ];

    // Create specific channels for testing different scenarios
    const enabledChannel = createEnabledXmltvChannel({
      id: 100,
      displayName: 'CNN HD',
      matchCount: 3,
    });

    const disabledChannel = createDisabledXmltvChannel({
      id: 101,
      displayName: 'ESPN',
      matchCount: 2,
    });

    const unmatchedChannel = createUnmatchedXmltvChannel({
      id: 102,
      displayName: 'Local Channel',
    });

    // Source 1: Mix of channel states
    const source1Channels = [
      enabledChannel,
      disabledChannel,
      unmatchedChannel,
      ...createXmltvSourceChannels(7), // 7 more random channels
    ];

    // Source 2: Smaller set
    const source2Channels = createXmltvSourceChannels(5);

    const channelsBySourceId = new Map<number, XmltvSourceChannel[]>([
      [1, source1Channels],
      [2, source2Channels],
    ]);

    // Inject mocks
    const mockScript = generateMockScript(sources, channelsBySourceId);
    await page.addInitScript(mockScript);

    // Provide data to test
    await use({
      sources,
      channelsBySourceId,
      enabledChannel,
      disabledChannel,
      unmatchedChannel,
    });
  },

  /**
   * emptySourcesState: Scenario with no XMLTV sources
   */
  emptySourcesState: async ({ page }, use) => {
    const mockScript = generateMockScript([], new Map());
    await page.addInitScript(mockScript);
    await use();
  },

  /**
   * largeSourceWithChannels: Performance test scenario
   */
  largeSourceWithChannels: async ({ page }, use) => {
    const source = createXmltvSource({ id: 1, name: 'Large EPG Provider' });
    const channels = createXmltvSourceChannels(500);

    const channelsBySourceId = new Map<number, XmltvSourceChannel[]>([
      [1, channels],
    ]);

    const mockScript = generateMockScript([source], channelsBySourceId);
    await page.addInitScript(mockScript);

    await use({ source, channels });
  },
});

// Re-export expect and factory functions for convenience
export { expect } from '@playwright/test';
export {
  createXmltvSourceChannel,
  createXmltvSourceChannels,
  createEnabledXmltvChannel,
  createDisabledXmltvChannel,
  createUnmatchedXmltvChannel,
  createMatchedXmltvChannel,
  createRealisticChannelMix,
} from '../factories/xmltv-source-channel.factory';
export {
  createXmltvSource,
  createXmltvSources,
} from '../factories/xmltv-source.factory';
export type { XmltvSourceChannel } from '../factories/xmltv-source-channel.factory';
export type { XmltvSource } from '../factories/xmltv-source.factory';
