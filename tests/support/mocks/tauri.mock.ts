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
