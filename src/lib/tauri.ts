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

// Account types and functions

/** Account response type (without password) */
export interface Account {
  id: number;
  name: string;
  serverUrl: string;
  username: string;
  maxConnections: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Request type for adding a new account */
export interface AddAccountRequest {
  name: string;
  serverUrl: string;
  username: string;
  password: string;
}

/**
 * Add a new Xtream Codes account
 * @param request - Account details including credentials
 * @returns The created account (without password)
 */
export async function addAccount(request: AddAccountRequest): Promise<Account> {
  return invoke<Account>('add_account', { request });
}

/**
 * Get all accounts (without passwords)
 * @returns List of all configured accounts
 */
export async function getAccounts(): Promise<Account[]> {
  return invoke<Account[]>('get_accounts');
}

/**
 * Delete an account by ID
 * @param id - Account ID to delete
 */
export async function deleteAccount(id: number): Promise<void> {
  return invoke('delete_account', { id });
}

/** Response type for test_connection command */
export interface TestConnectionResponse {
  success: boolean;
  status?: string;
  expiryDate?: string; // ISO 8601 format
  maxConnections?: number;
  activeConnections?: number;
  errorMessage?: string;
  suggestions?: string[];
}

/**
 * Test connection to Xtream Codes server
 * @param accountId - Account ID to test
 * @returns Connection test result with status or error
 */
export async function testConnection(accountId: number): Promise<TestConnectionResponse> {
  return invoke<TestConnectionResponse>('test_connection', { accountId });
}

// Channel types and functions

/** Channel response type */
export interface Channel {
  id: number;
  accountId: number;
  streamId: number;
  name: string;
  streamIcon: string | null;
  categoryId: number | null;
  categoryName: string | null;
  qualities: string[];
  epgChannelId: string | null;
  tvArchive: boolean;
  tvArchiveDuration: number;
  addedAt: string | null;
}

/** Response type for scan_channels command */
export interface ScanChannelsResponse {
  success: boolean;
  totalChannels: number;
  newChannels: number;
  updatedChannels: number;
  removedChannels: number;
  scanDurationMs: number;
  errorMessage?: string;
}

/**
 * Scan channels from Xtream provider
 * @param accountId - Account ID to scan channels for
 * @returns Scan result with channel counts
 */
export async function scanChannels(accountId: number): Promise<ScanChannelsResponse> {
  return invoke<ScanChannelsResponse>('scan_channels', { accountId });
}

/**
 * Get all channels for an account
 * @param accountId - Account ID to get channels for
 * @returns List of channels
 */
export async function getChannels(accountId: number): Promise<Channel[]> {
  return invoke<Channel[]>('get_channels', { accountId });
}

/**
 * Get channel count for an account
 * @param accountId - Account ID to count channels for
 * @returns Number of channels
 */
export async function getChannelCount(accountId: number): Promise<number> {
  return invoke<number>('get_channel_count', { accountId });
}

// XMLTV EPG Source types and functions

/** XMLTV format type */
export type XmltvFormat = 'xml' | 'xml_gz' | 'auto';

/** XMLTV source response type */
export interface XmltvSource {
  id: number;
  name: string;
  url: string;
  format: XmltvFormat;
  refreshHour: number;
  lastRefresh?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Request type for adding a new XMLTV source */
export interface NewXmltvSource {
  name: string;
  url: string;
  format: XmltvFormat;
}

/** Request type for updating an XMLTV source */
export interface XmltvSourceUpdate {
  name?: string;
  url?: string;
  format?: XmltvFormat;
  refreshHour?: number;
  isActive?: boolean;
}

/**
 * Add a new XMLTV EPG source
 * @param source - Source details
 * @returns The created source
 */
export async function addXmltvSource(source: NewXmltvSource): Promise<XmltvSource> {
  return invoke<XmltvSource>('add_xmltv_source', {
    name: source.name,
    url: source.url,
    format: source.format,
  });
}

/**
 * Get all XMLTV EPG sources
 * @returns List of all configured EPG sources
 */
export async function getXmltvSources(): Promise<XmltvSource[]> {
  return invoke<XmltvSource[]>('get_xmltv_sources');
}

/**
 * Update an existing XMLTV source
 * @param sourceId - Source ID to update
 * @param updates - Fields to update
 * @returns The updated source
 */
export async function updateXmltvSource(
  sourceId: number,
  updates: XmltvSourceUpdate
): Promise<XmltvSource> {
  return invoke<XmltvSource>('update_xmltv_source', { sourceId, updates });
}

/**
 * Delete an XMLTV source
 * @param sourceId - Source ID to delete
 */
export async function deleteXmltvSource(sourceId: number): Promise<void> {
  return invoke<void>('delete_xmltv_source', { sourceId });
}

/**
 * Toggle XMLTV source active state
 * @param sourceId - Source ID to toggle
 * @param active - New active state
 * @returns The updated source
 */
export async function toggleXmltvSource(
  sourceId: number,
  active: boolean
): Promise<XmltvSource> {
  return invoke<XmltvSource>('toggle_xmltv_source', { sourceId, active });
}

/**
 * Detect XMLTV format from URL
 * @param url - URL to analyze
 * @returns Detected format or 'auto' if unable to determine
 */
export function detectXmltvFormat(url: string): XmltvFormat {
  const urlLower = url.toLowerCase();
  if (urlLower.endsWith('.xml.gz') || urlLower.endsWith('.xmltv.gz')) {
    return 'xml_gz';
  }
  if (urlLower.endsWith('.xml') || urlLower.endsWith('.xmltv')) {
    return 'xml';
  }
  return 'auto';
}

// EPG Refresh types and functions

/** EPG statistics response type */
export interface EpgStats {
  channelCount: number;
  programCount: number;
  lastRefresh?: string;
}

/** XMLTV Channel response type */
export interface XmltvChannel {
  id: number;
  sourceId: number;
  channelId: string;
  displayName: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

/** Program response type */
export interface Program {
  id: number;
  xmltvChannelId: number;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  category?: string;
  episodeInfo?: string;
  createdAt: string;
}

/**
 * Refresh EPG data for a single source
 * Downloads, parses, and stores XMLTV data from the source URL.
 * @param sourceId - Source ID to refresh
 */
export async function refreshEpgSource(sourceId: number): Promise<void> {
  return invoke<void>('refresh_epg_source', { sourceId });
}

/**
 * Refresh EPG data for all active sources
 */
export async function refreshAllEpgSources(): Promise<void> {
  return invoke<void>('refresh_all_epg_sources');
}

/**
 * Get EPG statistics for a source
 * @param sourceId - Source ID to get stats for
 * @returns EPG statistics including channel/program counts
 */
export async function getEpgStats(sourceId: number): Promise<EpgStats> {
  return invoke<EpgStats>('get_epg_stats', { sourceId });
}

/**
 * Get all XMLTV channels for a source
 * @param sourceId - Source ID to get channels for
 * @returns List of XMLTV channels
 */
export async function getXmltvChannels(sourceId: number): Promise<XmltvChannel[]> {
  return invoke<XmltvChannel[]>('get_xmltv_channels', { sourceId });
}

/**
 * Get programs for a source (through channels)
 * @param sourceId - Source ID to get programs for
 * @returns List of programs
 */
export async function getPrograms(sourceId: number): Promise<Program[]> {
  return invoke<Program[]>('get_programs', { sourceId });
}
