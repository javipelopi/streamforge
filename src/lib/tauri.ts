import { invoke } from '@tauri-apps/api/core';

export async function greet(name: string): Promise<string> {
  return invoke('greet', { name });
}

/** Response type for autostart status queries */
export interface AutostartStatus {
  enabled: boolean;
}

/**
 * Get the current autostart status
 * @returns Whether autostart is enabled
 */
export async function getAutostartEnabled(): Promise<AutostartStatus> {
  return invoke<AutostartStatus>('get_autostart_enabled');
}

/**
 * Set the autostart status
 * @param enabled - Whether to enable or disable autostart
 */
export async function setAutostartEnabled(enabled: boolean): Promise<void> {
  return invoke('set_autostart_enabled', { enabled });
}
