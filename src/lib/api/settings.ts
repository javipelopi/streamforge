import { invoke } from './invoke';

// ============================================================================
// Plex Configuration (Story 4-6)
// ============================================================================

/** Plex configuration response type */
export interface PlexConfig {
  /** Whether the HTTP server is running and accepting connections */
  serverRunning: boolean;
  /** Local network IP address */
  localIp: string;
  /** Server port (default 5004) */
  port: number;
  /** M3U Playlist URL for Plex tuner configuration */
  m3uUrl: string;
  /** EPG/XMLTV URL for Plex guide data */
  epgUrl: string;
  /** HDHomeRun base URL for manual tuner setup */
  hdhrUrl: string;
  /** Maximum concurrent streams (tuner count) from active accounts */
  tunerCount: number;
}

/**
 * Get Plex configuration URLs for display in Dashboard
 *
 * Story 4-6: Display Plex Configuration URLs
 *
 * @returns PlexConfig with URLs and server status
 */
export async function getPlexConfig(): Promise<PlexConfig> {
  return invoke<PlexConfig>('get_plex_config');
}

// ============================================================================
// Server Port Settings (Story 6.1)
// ============================================================================

/**
 * Get the current server port from settings
 *
 * @returns Current server port (default 5004)
 */
export async function getServerPort(): Promise<number> {
  return invoke<number>('get_server_port');
}

/**
 * Set the server port in settings
 *
 * Note: Changing the port requires a server restart to take effect.
 *
 * @param port - New port value (must be 1024-65535)
 */
export async function setServerPort(port: number): Promise<void> {
  return invoke<void>('set_server_port', { port });
}

/**
 * Restart the HTTP server on the new port
 *
 * @returns Promise that resolves when server has restarted
 */
export async function restartServer(): Promise<void> {
  return invoke<void>('restart_server');
}

// ============================================================================
// Configuration Export/Import (Story 6-2)
// ============================================================================

/** Import preview response type */
export interface ImportPreview {
  valid: boolean;
  version: string;
  exportDate: string;
  accountCount: number;
  xmltvSourceCount: number;
  channelMappingCount: number;
  xmltvChannelSettingsCount: number;
  settingsSummary: string[];
  errorMessage?: string;
}

/** Import result response type */
export interface ImportResult {
  success: boolean;
  accountsImported: number;
  xmltvSourcesImported: number;
  channelMappingsImported: number;
  settingsImported: number;
  message: string;
}

/**
 * Export all configuration data to JSON
 *
 * SECURITY: Passwords are NOT included in the export.
 *
 * @returns JSON string of the configuration export
 */
export async function exportConfiguration(): Promise<string> {
  return invoke<string>('export_configuration');
}

/**
 * Validate an import file and get preview
 *
 * Parses the JSON content and returns a preview of what will be imported.
 * Does not modify any data - use importConfiguration to actually import.
 *
 * @param content - JSON content of the configuration file
 * @returns Preview of what will be imported
 */
export async function validateImportFile(content: string): Promise<ImportPreview> {
  return invoke<ImportPreview>('validate_import_file', { content });
}

/**
 * Import configuration from JSON content
 *
 * Performs atomic import: all existing data is REPLACED (not merged).
 * Accounts are imported with empty passwords - user must re-enter.
 *
 * @param content - JSON content of the configuration file
 * @returns Result of the import operation
 */
export async function importConfiguration(content: string): Promise<ImportResult> {
  return invoke<ImportResult>('import_configuration', { content });
}

// ============================================================================
// Log Verbosity Settings (Story 6-3)
// ============================================================================

/** Log verbosity type */
export type LogVerbosity = 'minimal' | 'verbose';

/**
 * Get the current log verbosity setting
 *
 * @returns Current log verbosity ("verbose" or "minimal")
 */
export async function getLogVerbosity(): Promise<LogVerbosity> {
  return invoke<LogVerbosity>('get_log_verbosity');
}

/**
 * Set the log verbosity setting
 *
 * @param verbosity - "verbose" (log all events) or "minimal" (only warn/error)
 */
export async function setLogVerbosity(verbosity: LogVerbosity): Promise<void> {
  return invoke<void>('set_log_verbosity', { verbosity });
}

// ============================================================================
// Stream URL Helpers for Video Playback
// ============================================================================

/**
 * Build the stream URL for an XMLTV channel using the internal proxy.
 * Used for Target Lineup and EPG playback.
 *
 * @param xmltvChannelId - XMLTV channel ID
 * @param serverPort - The server port (from getServerPort())
 * @returns The proxy stream URL
 */
export function buildProxyStreamUrl(xmltvChannelId: number, serverPort: number): string {
  if (typeof window !== 'undefined' && !('__TAURI__' in window)) {
    return `${window.location.origin}/stream/${xmltvChannelId}`;
  }
  return `http://127.0.0.1:${serverPort}/stream/${xmltvChannelId}`;
}

/**
 * Build the stream URL for an Acestream source.
 * Connects to the local Acestream engine.
 *
 * @param contentId - Acestream content ID (40-char hex string)
 * @returns The Acestream engine URL
 */
export function buildAcestreamUrl(contentId: string): string {
  return `http://127.0.0.1:6878/ace/getstream?id=${contentId}`;
}

// ============================================================================
// Failover Resilience Settings (ip-6fj)
// ============================================================================

/** Failover strictness levels */
export type FailoverStrictness = 'strict' | 'balanced' | 'lenient';

/** Resilience configuration returned from the backend */
export interface ResilienceConfig {
  strictness: FailoverStrictness;
  maxRetries: number;
  backoffBaseMs: number;
  backoffMultiplier: number;
  backoffMaxMs: number;
  recoveryCheckSecs: number;
  tryAlternateEndpoints: boolean;
}

/**
 * Get the current failover resilience configuration
 *
 * @returns Active resilience config including strictness, retry count, and backoff settings
 */
export async function getResilienceConfig(): Promise<ResilienceConfig> {
  return invoke<ResilienceConfig>('get_resilience_config');
}

/**
 * Set the failover strictness level
 *
 * @param strictness - One of 'strict', 'balanced', or 'lenient'
 * @returns Updated resilience config reflecting the new strictness level
 */
export async function setFailoverStrictness(
  strictness: FailoverStrictness
): Promise<ResilienceConfig> {
  return invoke<ResilienceConfig>('set_failover_strictness', { strictness });
}
