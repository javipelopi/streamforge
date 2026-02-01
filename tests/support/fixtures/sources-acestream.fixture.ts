import { test as base } from '@playwright/test';
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
 * Sources View - Acestream Tab Fixtures
 *
 * Provides test fixtures for the Acestream tab in Sources view.
 * Injects Tauri mocks for Acestream sources and platform status.
 *
 * Fixture architecture:
 * - Setup: Inject Tauri mocks with configured Acestream sources and platform status
 * - Provide: Return sources and status data to test
 * - Cleanup: Mock state is automatically cleared on page navigation
 *
 * @see tech-spec-multi-source-stream-support.md
 */

interface AcestreamSourcesState {
  sources: AcestreamSource[];
  status: AcestreamStatus;
}

interface AcestreamSourcesFixtures {
  /**
   * Injects Tauri mocks for Acestream sources with provided data.
   * Call this before navigating to the app.
   */
  injectAcestreamSourcesMocks: (
    sources: AcestreamSource[],
    status: AcestreamStatus
  ) => Promise<void>;

  /**
   * Pre-configured scenario: Windows/Linux with engine running.
   * Automatically injects mocks - just navigate to /sources after using.
   */
  acestreamSourcesSupported: {
    sources: AcestreamSource[];
    status: AcestreamStatus;
  };

  /**
   * Pre-configured scenario: Windows/Linux but engine NOT running.
   * Use to test "Engine Not Found" state.
   */
  acestreamSourcesNoEngine: {
    sources: AcestreamSource[];
    status: AcestreamStatus;
  };

  /**
   * Pre-configured scenario: Mac (unsupported platform).
   * Use to test Mac warning banner.
   */
  acestreamSourcesMac: {
    sources: AcestreamSource[];
    status: AcestreamStatus;
  };

  /**
   * Pre-configured scenario: Empty state (no Acestream sources).
   * Use to test empty state UI.
   */
  emptyAcestreamState: {
    status: AcestreamStatus;
  };
}

/**
 * Generate the Tauri mock injection script for Acestream sources
 */
function generateAcestreamMockScript(
  sources: AcestreamSource[],
  status: AcestreamStatus
): string {
  return `
    (function() {
      // State storage for Acestream sources
      window.__ACESTREAM_SOURCES_STATE__ = {
        sources: ${JSON.stringify(sources)},
        status: ${JSON.stringify(status)},
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

        // Acestream Source Commands
        get_acestream_sources: () => {
          console.log('[Mock] get_acestream_sources called');
          return window.__ACESTREAM_SOURCES_STATE__.sources;
        },

        add_acestream_source: (args) => {
          console.log('[Mock] add_acestream_source called:', args);
          const { name, contentId } = args;

          // Validate content ID format (40 hex chars)
          if (!/^[a-f0-9]{40}$/i.test(contentId)) {
            throw new Error('Invalid Acestream content ID format');
          }

          // Check for duplicate content ID
          if (window.__ACESTREAM_SOURCES_STATE__.sources.some(s => s.contentId === contentId)) {
            throw new Error('Acestream source with this content ID already exists');
          }

          const now = new Date().toISOString();
          const newId = Math.max(0, ...window.__ACESTREAM_SOURCES_STATE__.sources.map(s => s.id)) + 1;

          const newSource = {
            id: newId,
            name,
            contentId: contentId.toLowerCase(),
            isActive: true,
            createdAt: now,
            updatedAt: now,
          };

          window.__ACESTREAM_SOURCES_STATE__.sources.push(newSource);

          return newSource;
        },

        delete_acestream_source: (args) => {
          console.log('[Mock] delete_acestream_source called:', args);
          const { sourceId } = args;

          const index = window.__ACESTREAM_SOURCES_STATE__.sources.findIndex(s => s.id === sourceId);
          if (index === -1) {
            throw new Error('Acestream source not found');
          }

          window.__ACESTREAM_SOURCES_STATE__.sources.splice(index, 1);

          return { success: true };
        },

        check_acestream_status: () => {
          console.log('[Mock] check_acestream_status called');
          return window.__ACESTREAM_SOURCES_STATE__.status;
        },

        // M3U commands (for tab integration)
        get_m3u_sources: () => [],
        get_m3u_channels: () => [],

        // Xtream commands (for tab integration)
        get_accounts: () => [],
        get_xtream_streams_for_account: () => [],
        get_account_stream_stats: () => ({ streamCount: 0, linkedCount: 0, orphanCount: 0, promotedCount: 0 }),

        // XMLTV commands (for tab integration)
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

      window.__TAURI__ = {
        invoke: mockInvoke,
      };

      window.__TAURI_MOCK__ = {
        invoke: mockInvoke,
        commands: mockCommands,
        getState: () => window.__ACESTREAM_SOURCES_STATE__,
      };

      console.log('[Tauri Mock] Acestream sources mock initialized with',
        window.__ACESTREAM_SOURCES_STATE__.sources.length, 'sources,',
        'platform:', window.__ACESTREAM_SOURCES_STATE__.status.platform,
        'engineAvailable:', window.__ACESTREAM_SOURCES_STATE__.status.engineAvailable);
    })();
  `;
}

/**
 * Extended test with Acestream sources fixtures
 */
export const test = base.extend<AcestreamSourcesFixtures>({
  /**
   * injectAcestreamSourcesMocks: Low-level fixture for custom mock injection
   */
  injectAcestreamSourcesMocks: async ({ page }, use) => {
    const inject = async (
      sources: AcestreamSource[],
      status: AcestreamStatus
    ): Promise<void> => {
      const mockScript = generateAcestreamMockScript(sources, status);
      await page.addInitScript(mockScript);
    };

    await use(inject);
  },

  /**
   * acestreamSourcesSupported: Windows/Linux with engine running
   */
  acestreamSourcesSupported: async ({ page }, use) => {
    const sources = createAcestreamSources(3);
    const status = createAcestreamStatusSupported(true, { platform: 'linux' });

    const mockScript = generateAcestreamMockScript(sources, status);
    await page.addInitScript(mockScript);

    await use({ sources, status });
  },

  /**
   * acestreamSourcesNoEngine: Windows/Linux but engine NOT running
   */
  acestreamSourcesNoEngine: async ({ page }, use) => {
    const sources = createAcestreamSources(2);
    const status = createAcestreamStatusNoEngine({ platform: 'windows' });

    const mockScript = generateAcestreamMockScript(sources, status);
    await page.addInitScript(mockScript);

    await use({ sources, status });
  },

  /**
   * acestreamSourcesMac: Unsupported platform (Mac)
   */
  acestreamSourcesMac: async ({ page }, use) => {
    // Still show sources, but platform is unsupported
    const sources = createAcestreamSources(2);
    const status = createAcestreamStatusUnsupported();

    const mockScript = generateAcestreamMockScript(sources, status);
    await page.addInitScript(mockScript);

    await use({ sources, status });
  },

  /**
   * emptyAcestreamState: No Acestream sources, engine available
   */
  emptyAcestreamState: async ({ page }, use) => {
    const status = createAcestreamStatusSupported(true, { platform: 'linux' });
    const mockScript = generateAcestreamMockScript([], status);
    await page.addInitScript(mockScript);

    await use({ status });
  },
});

// Re-export expect and factory functions for convenience
export { expect } from '@playwright/test';
export {
  createAcestreamSource,
  createAcestreamSources,
  createAcestreamStatusSupported,
  createAcestreamStatusUnsupported,
  createAcestreamStatusNoEngine,
  generateAcestreamContentId,
} from '../factories/acestream-source.factory';
export type { AcestreamSource, AcestreamStatus } from '../factories/acestream-source.factory';
