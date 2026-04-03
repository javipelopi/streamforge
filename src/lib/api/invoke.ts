import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { invokeApi, buildApiRequest } from '../api-adapter';

/**
 * Detect whether we're running inside a Tauri webview or a plain browser.
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Commands that REQUIRE direct Tauri IPC (OS-native, no REST equivalent).
 */
const DESKTOP_ONLY_COMMANDS = new Set([
  'get_autostart_enabled',
  'set_autostart_enabled',
  'download_and_install_update',
  'check_for_update',
  'get_update_settings',
  'set_auto_check_updates',
  'get_current_version',
  'greet',
]);

/**
 * Unified invoke:
 * - In Tauri: desktop-only commands use direct IPC, everything else uses
 *   the api_proxy command (forwards to local REST API, bypasses CORS)
 * - In browser: all commands use REST API via fetch
 */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    if (DESKTOP_ONLY_COMMANDS.has(cmd)) {
      return tauriInvoke<T>(cmd, args);
    }
    // Proxy through Tauri → local REST API (avoids CORS)
    const req = buildApiRequest(cmd, args);
    const result = await tauriInvoke<T>('api_proxy', {
      method: req.method,
      url: req.url,
      body: req.body ?? null,
    });
    // Settings unwrap
    if (req.url.startsWith('/api/settings/') && req.method === 'GET' && result && typeof result === 'object' && 'value' in (result as Record<string, unknown>)) {
      return (result as Record<string, unknown>).value as T;
    }
    return result;
  }
  return invokeApi<T>(cmd, args);
}
