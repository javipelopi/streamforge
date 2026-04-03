import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { invokeApi } from '../api-adapter';

/**
 * Detect whether we're running inside a Tauri webview or a plain browser.
 * In Tauri, the runtime injects `window.__TAURI__` before any app code runs.
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Commands that REQUIRE Tauri IPC (OS-native, no REST equivalent).
 * Everything else routes through the REST API for a single unified API surface.
 */
const DESKTOP_ONLY_COMMANDS = new Set([
  'get_autostart_enabled',
  'set_autostart_enabled',
  'download_and_install_update',
]);

/**
 * Unified invoke: REST API is the default for all business logic.
 * Tauri IPC is only used for desktop-native commands that have no REST equivalent.
 */
export function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (DESKTOP_ONLY_COMMANDS.has(cmd) && isTauri()) {
    return tauriInvoke<T>(cmd, args);
  }
  return invokeApi<T>(cmd, args);
}
