/**
 * Tauri API Mock for E2E Tests
 *
 * This module provides utilities for mocking Tauri API calls in Playwright E2E tests.
 * Use these when running tests against Vite dev server (without full Tauri backend).
 *
 * The mocks inject a fake `__TAURI_INTERNALS__` object that the @tauri-apps/api/core
 * uses internally, allowing the frontend to work without the actual Tauri backend.
 */

import { Page } from '@playwright/test';

/**
 * Command handler function type
 */
type CommandHandler = (args: Record<string, unknown>) => unknown | Promise<unknown>;

/**
 * Mock configuration for Tauri commands
 */
export interface TauriMockConfig {
  /** Map of command names to their mock implementations */
  commands: Record<string, CommandHandler>;
}

/**
 * Default mock implementations for common commands
 */
export const defaultTauriMocks: TauriMockConfig = {
  commands: {
    greet: (args) => `Hello, ${args.name}! Welcome to StreamForge.`,
    get_setting: () => null,
    set_setting: () => undefined,
    get_server_port: () => 5004,
    set_server_port: () => undefined,
    get_autostart_enabled: () => ({ enabled: false }),
    set_autostart_enabled: () => undefined,
  },
};

/**
 * Injects Tauri mock into the page before navigation
 *
 * Call this before `page.goto()` to intercept Tauri API calls.
 *
 * @param page - Playwright page object
 * @param config - Optional custom mock configuration (merged with defaults)
 *
 * @example
 * ```ts
 * test('should toggle autostart', async ({ page }) => {
 *   // Setup mock with custom autostart state
 *   await injectTauriMock(page, {
 *     commands: {
 *       get_autostart_enabled: () => ({ enabled: true }),
 *     },
 *   });
 *
 *   await page.goto('/settings');
 *   // ... test assertions
 * });
 * ```
 */
export async function injectTauriMock(
  page: Page,
  config: Partial<TauriMockConfig> = {}
): Promise<void> {
  // Merge with defaults
  const mergedConfig: TauriMockConfig = {
    commands: {
      ...defaultTauriMocks.commands,
      ...config.commands,
    },
  };

  // Serialize the command handlers to strings for injection
  // We need to recreate them inside the browser context
  const commandEntries = Object.entries(mergedConfig.commands).map(([name, handler]) => {
    // Convert function to string for injection
    const handlerStr = handler.toString();
    return `"${name}": ${handlerStr}`;
  });

  const mockScript = `
    // Tauri Mock - Injected by Playwright
    (function() {
      const mockCommands = {
        ${commandEntries.join(',\n        ')}
      };

      // Create the mock invoke function
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

      // Inject the mock into window.__TAURI_INTERNALS__
      // This is what @tauri-apps/api/core uses internally
      window.__TAURI_INTERNALS__ = {
        invoke: mockInvoke,
        metadata: {
          currentWindow: { label: 'main' },
          currentWebview: { label: 'main' },
          windows: [{ label: 'main' }],
          webviews: [{ label: 'main' }],
        },
        plugins: {
          autostart: {
            isEnabled: async () => mockCommands.get_autostart_enabled({}).enabled,
            enable: async () => {},
            disable: async () => {},
          },
        },
      };

      // Also expose for direct access in tests
      window.__TAURI_MOCK__ = {
        invoke: mockInvoke,
        commands: mockCommands,
      };

      console.log('[Tauri Mock] Initialized successfully');
    })();
  `;

  await page.addInitScript(mockScript);
}

/**
 * Creates a stateful autostart mock that tracks enable/disable state
 *
 * @param initialEnabled - Initial autostart state
 * @returns TauriMockConfig with stateful autostart commands
 */
export function createStatefulAutostartMock(initialEnabled: boolean = false): TauriMockConfig {
  // Note: This creates a closure that maintains state
  // The state is serialized and recreated in the browser context
  return {
    commands: {
      ...defaultTauriMocks.commands,
      get_autostart_enabled: function() {
        // Access state from window
        const state = (window as any).__AUTOSTART_STATE__ ?? { enabled: initialEnabled };
        return { enabled: state.enabled };
      },
      set_autostart_enabled: function(args: { enabled: boolean }) {
        // Store state in window for persistence across calls
        (window as any).__AUTOSTART_STATE__ = { enabled: args.enabled };
        return undefined;
      },
    },
  };
}

/**
 * Injects stateful Tauri mock with autostart tracking
 *
 * This version tracks autostart state changes across multiple invoke calls,
 * useful for testing toggle behavior.
 *
 * @param page - Playwright page object
 * @param initialEnabled - Initial autostart state (default: false)
 */
export async function injectStatefulTauriMock(
  page: Page,
  initialEnabled: boolean = false
): Promise<void> {
  const mockScript = `
    // Stateful Tauri Mock - Injected by Playwright
    (function() {
      // Initialize state
      window.__AUTOSTART_STATE__ = { enabled: ${initialEnabled} };

      const mockCommands = {
        greet: (args) => \`Hello, \${args.name}! Welcome to StreamForge.\`,
        get_setting: () => null,
        set_setting: () => undefined,
        get_server_port: () => 5004,
        set_server_port: () => undefined,
        get_autostart_enabled: () => {
          return { enabled: window.__AUTOSTART_STATE__.enabled };
        },
        set_autostart_enabled: (args) => {
          window.__AUTOSTART_STATE__.enabled = args.enabled;
          return undefined;
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
        plugins: {
          autostart: {
            isEnabled: async () => window.__AUTOSTART_STATE__.enabled,
            enable: async () => { window.__AUTOSTART_STATE__.enabled = true; },
            disable: async () => { window.__AUTOSTART_STATE__.enabled = false; },
          },
        },
      };

      window.__TAURI_MOCK__ = {
        invoke: mockInvoke,
        commands: mockCommands,
        getState: () => window.__AUTOSTART_STATE__,
        setState: (state) => { window.__AUTOSTART_STATE__ = state; },
      };

      console.log('[Tauri Mock] Stateful mock initialized with autostart =', ${initialEnabled});
    })();
  `;

  await page.addInitScript(mockScript);
}

/**
 * Injects comprehensive stateful Tauri mock for Settings GUI tests
 *
 * Story 6.1: Settings GUI for Server and Startup Options
 *
 * This version tracks all settings state changes across multiple invoke calls,
 * supporting server port, autostart, and EPG schedule settings.
 * State is persisted to localStorage to survive page reloads.
 *
 * @param page - Playwright page object
 * @param initialState - Initial settings state
 */
export async function injectSettingsStatefulMock(
  page: Page,
  initialState: {
    serverPort?: number;
    autostartEnabled?: boolean;
    epgSchedule?: { hour: number; minute: number; enabled: boolean };
  } = {}
): Promise<void> {
  const serverPort = initialState.serverPort ?? 5004;
  const autostartEnabled = initialState.autostartEnabled ?? false;
  const epgHour = initialState.epgSchedule?.hour ?? 4;
  const epgMinute = initialState.epgSchedule?.minute ?? 0;
  const epgEnabled = initialState.epgSchedule?.enabled ?? true;

  const mockScript = `
    // Comprehensive Stateful Tauri Mock for Settings GUI - Injected by Playwright
    (function() {
      const STORAGE_KEY = '__TAURI_MOCK_SETTINGS__';

      // Try to load state from localStorage (for persistence across reloads)
      let savedState = null;
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          savedState = JSON.parse(stored);
          console.log('[Tauri Mock] Loaded persisted state from localStorage:', savedState);
        }
      } catch (e) {
        console.warn('[Tauri Mock] Failed to load persisted state:', e);
      }

      // Initialize all settings state (use saved state if available, otherwise defaults)
      window.__SETTINGS_STATE__ = savedState || {
        serverPort: ${serverPort},
        autostartEnabled: ${autostartEnabled},
        epgSchedule: {
          hour: ${epgHour},
          minute: ${epgMinute},
          enabled: ${epgEnabled},
          lastScheduledRefresh: null
        }
      };

      // Keep legacy state for backwards compatibility
      window.__AUTOSTART_STATE__ = { enabled: window.__SETTINGS_STATE__.autostartEnabled };

      // Helper to persist state to localStorage
      function persistState() {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(window.__SETTINGS_STATE__));
          console.log('[Tauri Mock] Persisted state to localStorage');
        } catch (e) {
          console.warn('[Tauri Mock] Failed to persist state:', e);
        }
      }

      const mockCommands = {
        greet: (args) => \`Hello, \${args.name}! Welcome to StreamForge.\`,
        get_setting: () => null,
        set_setting: () => undefined,

        // Server port commands
        get_server_port: () => {
          return window.__SETTINGS_STATE__.serverPort;
        },
        set_server_port: (args) => {
          const port = args.port;
          if (port < 1024) {
            throw new Error('Port must be 1024 or higher (non-privileged ports)');
          }
          window.__SETTINGS_STATE__.serverPort = port;
          persistState();
          return undefined;
        },
        restart_server: () => {
          // Simulate server restart - just returns success
          console.log('[Tauri Mock] Server restart triggered on port:', window.__SETTINGS_STATE__.serverPort);
          return undefined;
        },

        // Autostart commands
        get_autostart_enabled: () => {
          return { enabled: window.__SETTINGS_STATE__.autostartEnabled };
        },
        set_autostart_enabled: (args) => {
          window.__SETTINGS_STATE__.autostartEnabled = args.enabled;
          window.__AUTOSTART_STATE__.enabled = args.enabled;
          persistState();
          return undefined;
        },

        // EPG Schedule commands
        get_epg_schedule: () => {
          return {
            hour: window.__SETTINGS_STATE__.epgSchedule.hour,
            minute: window.__SETTINGS_STATE__.epgSchedule.minute,
            enabled: window.__SETTINGS_STATE__.epgSchedule.enabled,
            lastScheduledRefresh: window.__SETTINGS_STATE__.epgSchedule.lastScheduledRefresh
          };
        },
        set_epg_schedule: (args) => {
          window.__SETTINGS_STATE__.epgSchedule.hour = args.hour;
          window.__SETTINGS_STATE__.epgSchedule.minute = args.minute;
          window.__SETTINGS_STATE__.epgSchedule.enabled = args.enabled;
          persistState();
          return {
            hour: args.hour,
            minute: args.minute,
            enabled: args.enabled,
            lastScheduledRefresh: window.__SETTINGS_STATE__.epgSchedule.lastScheduledRefresh
          };
        },

        // Plex config command (for verifying port changes)
        get_plex_config: () => {
          const port = window.__SETTINGS_STATE__.serverPort;
          return {
            server_running: true,
            local_ip: '192.168.1.100',
            port: port,
            m3u_url: \`http://192.168.1.100:\${port}/playlist.m3u\`,
            epg_url: \`http://192.168.1.100:\${port}/epg.xml\`,
            hdhr_url: \`http://192.168.1.100:\${port}\`,
            tuner_count: 2
          };
        },

        // Event log commands (stub)
        get_unread_event_count: () => 0,

        // Configuration export/import commands (Story 6-2)
        export_configuration: () => {
          const state = window.__SETTINGS_STATE__;
          const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            appVersion: '0.1.0',
            data: {
              settings: {
                server_port: String(state.serverPort),
                autostart_enabled: String(state.autostartEnabled),
                epg_schedule_hour: String(state.epgSchedule.hour),
                epg_schedule_minute: String(state.epgSchedule.minute),
                epg_schedule_enabled: String(state.epgSchedule.enabled),
              },
              accounts: window.__MOCK_ACCOUNTS__ || [],
              xmltv_sources: window.__MOCK_XMLTV_SOURCES__ || [],
              channel_mappings: [],
              xmltv_channel_settings: [],
            },
          };
          return JSON.stringify(exportData, null, 2);
        },

        validate_import_file: (args) => {
          try {
            const content = args.content;
            const config = JSON.parse(content);

            // Check version
            if (!config.version || parseFloat(config.version) < 1.0) {
              return {
                valid: false,
                version: config.version || 'unknown',
                exportDate: '',
                accountCount: 0,
                xmltvSourceCount: 0,
                channelMappingCount: 0,
                xmltvChannelSettingsCount: 0,
                settingsSummary: [],
                errorMessage: 'Unsupported configuration version: ' + (config.version || 'unknown') + '. Minimum supported: 1.0',
              };
            }

            const data = config.data || {};
            const settings = data.settings || {};
            const settingsSummary = [];
            if (settings.server_port) settingsSummary.push('Server port: ' + settings.server_port);
            if (settings.autostart_enabled) settingsSummary.push('Autostart: ' + (settings.autostart_enabled === 'true' ? 'enabled' : 'disabled'));

            return {
              valid: true,
              version: config.version,
              exportDate: config.exportDate || '',
              accountCount: (data.accounts || []).length,
              xmltvSourceCount: (data.xmltv_sources || []).length,
              channelMappingCount: (data.channel_mappings || []).length,
              xmltvChannelSettingsCount: (data.xmltv_channel_settings || []).length,
              settingsSummary: settingsSummary,
              errorMessage: null,
            };
          } catch (e) {
            return {
              valid: false,
              version: '',
              exportDate: '',
              accountCount: 0,
              xmltvSourceCount: 0,
              channelMappingCount: 0,
              xmltvChannelSettingsCount: 0,
              settingsSummary: [],
              errorMessage: 'Invalid JSON format: ' + e.message,
            };
          }
        },

        import_configuration: (args) => {
          try {
            const config = JSON.parse(args.content);
            const data = config.data || {};
            const settings = data.settings || {};

            // Apply settings to state
            if (settings.server_port) {
              window.__SETTINGS_STATE__.serverPort = parseInt(settings.server_port, 10);
            }
            if (settings.autostart_enabled) {
              window.__SETTINGS_STATE__.autostartEnabled = settings.autostart_enabled === 'true';
              window.__AUTOSTART_STATE__.enabled = window.__SETTINGS_STATE__.autostartEnabled;
            }
            if (settings.epg_schedule_hour) {
              window.__SETTINGS_STATE__.epgSchedule.hour = parseInt(settings.epg_schedule_hour, 10);
            }
            if (settings.epg_schedule_minute) {
              window.__SETTINGS_STATE__.epgSchedule.minute = parseInt(settings.epg_schedule_minute, 10);
            }
            if (settings.epg_schedule_enabled) {
              window.__SETTINGS_STATE__.epgSchedule.enabled = settings.epg_schedule_enabled === 'true';
            }

            // Store mock accounts/sources for later verification
            window.__MOCK_ACCOUNTS__ = data.accounts || [];
            window.__MOCK_XMLTV_SOURCES__ = data.xmltv_sources || [];

            return {
              success: true,
              accountsImported: (data.accounts || []).length,
              xmltvSourcesImported: (data.xmltv_sources || []).length,
              channelMappingsImported: 0,
              settingsImported: Object.keys(settings).length,
              message: 'Configuration imported successfully.',
            };
          } catch (e) {
            return {
              success: false,
              accountsImported: 0,
              xmltvSourcesImported: 0,
              channelMappingsImported: 0,
              settingsImported: 0,
              message: 'Import failed: ' + e.message,
            };
          }
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
        plugins: {
          autostart: {
            isEnabled: async () => window.__SETTINGS_STATE__.autostartEnabled,
            enable: async () => { window.__SETTINGS_STATE__.autostartEnabled = true; window.__AUTOSTART_STATE__.enabled = true; persistState(); },
            disable: async () => { window.__SETTINGS_STATE__.autostartEnabled = false; window.__AUTOSTART_STATE__.enabled = false; persistState(); },
          },
        },
      };

      window.__TAURI_MOCK__ = {
        invoke: mockInvoke,
        commands: mockCommands,
        getState: () => window.__SETTINGS_STATE__,
        setState: (state) => {
          window.__SETTINGS_STATE__ = { ...window.__SETTINGS_STATE__, ...state };
          if (state.autostartEnabled !== undefined) {
            window.__AUTOSTART_STATE__.enabled = state.autostartEnabled;
          }
          persistState();
        },
        clearPersistedState: () => {
          localStorage.removeItem(STORAGE_KEY);
          console.log('[Tauri Mock] Cleared persisted state');
        },
      };

      console.log('[Tauri Mock] Settings stateful mock initialized:', window.__SETTINGS_STATE__);
    })();
  `;

  await page.addInitScript(mockScript);
}
