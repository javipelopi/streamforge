import { invoke } from './invoke';

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

// ============================================================================
// Auto-Update (Story 6-5)
// ============================================================================

/** Update information response */
export interface UpdateInfo {
  /** Whether an update is available */
  available: boolean;
  /** Version of the available update (null if no update) */
  version: string | null;
  /** Release notes/changelog (null if no update) */
  notes: string | null;
  /** Release date ISO string (null if no update) */
  date: string | null;
}

/** Update settings response */
export interface UpdateSettings {
  /** Whether automatic update checks are enabled */
  autoCheck: boolean;
  /** Timestamp of last update check (ISO 8601) */
  lastCheck: string | null;
  /** Current application version */
  currentVersion: string;
}

/**
 * Check for available updates
 *
 * Story 6-5: Auto-Update Mechanism
 * AC #1, #2: Check for updates with signature verification
 *
 * @returns Update information
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
  return invoke<UpdateInfo>('check_for_update');
}

/**
 * Get current update settings
 *
 * Story 6-5: Auto-Update Mechanism
 * AC #4: Auto-check preference stored in database
 *
 * @returns Update settings including auto-check preference and last check timestamp
 */
export async function getUpdateSettings(): Promise<UpdateSettings> {
  return invoke<UpdateSettings>('get_update_settings');
}

/**
 * Set auto-check updates preference
 *
 * Story 6-5: Auto-Update Mechanism
 * AC #4: Toggle auto-check preference
 *
 * @param enabled - Whether to enable automatic update checks
 */
export async function setAutoCheckUpdates(enabled: boolean): Promise<void> {
  return invoke<void>('set_auto_check_updates', { enabled });
}

/**
 * Download and install the available update
 *
 * Story 6-5: Auto-Update Mechanism
 * AC #5, #6: Download with progress, install and restart
 *
 * This function:
 * 1. Downloads the update with progress events
 * 2. Verifies the signature (built into Tauri updater)
 * 3. Installs the update
 *
 * @returns Promise that resolves when update is installed
 */
export async function downloadAndInstallUpdate(): Promise<void> {
  return invoke<void>('download_and_install_update');
}

/**
 * Get the current application version
 *
 * Story 6-5: Used to display current version in Settings
 *
 * @returns Current version string (e.g., "0.1.0")
 */
export async function getCurrentVersion(): Promise<string> {
  return invoke<string>('get_current_version');
}

/**
 * Format relative time for last check timestamp
 *
 * @param dateStr - ISO 8601 date string or null
 * @returns Human-readable relative time (e.g., "5 minutes ago", "Never")
 */
export function formatLastCheckTime(dateStr: string | null): string {
  if (!dateStr) {
    return 'Never';
  }

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }

  // Format as date for older checks
  return date.toLocaleDateString();
}
