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
  // Connection status fields (populated after connection test)
  connectionStatus?: string;
  expiryDate?: string;
  maxConnectionsActual?: number;
  activeConnections?: number;
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

/** Request type for updating an account */
export interface UpdateAccountRequest {
  name: string;
  serverUrl: string;
  username: string;
  password?: string; // Optional - only update if provided
}

/**
 * Update an existing account
 * @param id - Account ID to update
 * @param request - Updated account details (password optional)
 * @returns The updated account (without password)
 */
export async function updateAccount(id: number, request: UpdateAccountRequest): Promise<Account> {
  return invoke<Account>('update_account', { id, request });
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

// EPG Schedule types and functions

/** EPG schedule response type */
export interface EpgSchedule {
  hour: number;
  minute: number;
  enabled: boolean;
  lastScheduledRefresh?: string;
}

/**
 * Get the current EPG schedule settings
 * @returns Current schedule configuration
 */
export async function getEpgSchedule(): Promise<EpgSchedule> {
  return invoke<EpgSchedule>('get_epg_schedule');
}

/**
 * Set the EPG schedule settings
 * @param hour - Hour of day (0-23)
 * @param minute - Minute of hour (0-59)
 * @param enabled - Whether automatic refresh is enabled
 * @returns Updated schedule configuration
 */
export async function setEpgSchedule(
  hour: number,
  minute: number,
  enabled: boolean
): Promise<EpgSchedule> {
  return invoke<EpgSchedule>('set_epg_schedule', { hour, minute, enabled });
}

/**
 * Format schedule time for display
 * @param hour - Hour (0-23)
 * @param minute - Minute (0-59)
 * @returns Formatted time string (e.g., "04:00", "14:30")
 */
export function formatScheduleTime(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

/**
 * Calculate next scheduled refresh time
 * @param schedule - Current schedule configuration
 * @returns Date of next scheduled refresh, or null if disabled
 */
export function getNextScheduledRefresh(schedule: EpgSchedule): Date | null {
  if (!schedule.enabled) {
    return null;
  }

  const now = new Date();
  const next = new Date();
  next.setHours(schedule.hour, schedule.minute, 0, 0);

  // If schedule time has already passed today, use tomorrow
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

/**
 * Format relative time from now
 * @param date - Date to format
 * @returns Relative time string (e.g., "in 3 hours", "2 minutes ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const target = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (Math.abs(diffMinutes) < 1) {
    return 'just now';
  }

  if (diffMinutes > 0) {
    // Future
    if (diffMinutes < 60) {
      return `in ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}`;
    }
    if (diffHours < 24) {
      return `in ${diffHours} hour${diffHours === 1 ? '' : 's'}`;
    }
    return `tomorrow at ${formatScheduleTime(target.getHours(), target.getMinutes())}`;
  } else {
    // Past
    const absMinutes = Math.abs(diffMinutes);
    const absHours = Math.abs(diffHours);
    if (absMinutes < 60) {
      return `${absMinutes} minute${absMinutes === 1 ? '' : 's'} ago`;
    }
    if (absHours < 24) {
      return `${absHours} hour${absHours === 1 ? '' : 's'} ago`;
    }
    return `yesterday at ${formatScheduleTime(target.getHours(), target.getMinutes())}`;
  }
}

// ============================================================================
// Channel Matching types and functions (Story 3-1)
// ============================================================================

/** Match type enum */
export type MatchType = 'exact_epg_id' | 'exact_name' | 'fuzzy' | 'none';

/** Match response type for run_channel_matching command */
export interface MatchResponse {
  success: boolean;
  matchedCount: number;
  unmatchedCount: number;
  totalXmltv: number;
  totalXtream: number;
  durationMs: number;
  message: string;
}

/** Match statistics type */
export interface MatchStats {
  totalXmltv: number;
  totalXtream: number;
  matched: number;
  unmatched: number;
  multipleMatches: number;
  durationMs: number;
}

/** Channel mapping type */
export interface ChannelMapping {
  id: number;
  xmltvChannelId: number;
  xtreamChannelId: number;
  matchConfidence: number | null;
  isManual: number | null;
  isPrimary: number | null;
  streamPriority: number | null;
  createdAt: string;
}

/** XMLTV channel settings type */
export interface XmltvChannelSettings {
  id: number;
  xmltvChannelId: number;
  isEnabled: number | null;
  plexDisplayOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Match progress event payload */
export interface MatchProgressEvent {
  status: 'starting' | 'saving' | 'complete';
  message?: string;
  matched?: number;
  unmatched?: number;
}

/**
 * Run the channel matching algorithm
 * Matches all XMLTV channels to Xtream streams using fuzzy matching.
 * @param threshold - Optional confidence threshold (0.0 to 1.0). Defaults to 0.85.
 * @returns Match response with statistics
 */
export async function runChannelMatching(threshold?: number): Promise<MatchResponse> {
  return invoke<MatchResponse>('run_channel_matching', { threshold });
}

/**
 * Get current match statistics from the database
 * @returns Match statistics
 */
export async function getMatchStats(): Promise<MatchStats> {
  return invoke<MatchStats>('get_match_stats');
}

/**
 * Get channel mappings for a specific XMLTV channel
 * @param xmltvChannelId - XMLTV channel ID
 * @returns List of channel mappings sorted by priority
 */
export async function getChannelMappingsForXmltv(xmltvChannelId: number): Promise<ChannelMapping[]> {
  return invoke<ChannelMapping[]>('get_channel_mappings_for_xmltv', { xmltvChannelId });
}

/**
 * Get XMLTV channel settings
 * @param xmltvChannelId - XMLTV channel ID
 * @returns Channel settings or null if not found
 */
export async function getXmltvChannelSettings(xmltvChannelId: number): Promise<XmltvChannelSettings | null> {
  return invoke<XmltvChannelSettings | null>('get_xmltv_channel_settings', { xmltvChannelId });
}

/**
 * Get the current matching threshold
 * @returns Current threshold value (0.0 to 1.0)
 */
export async function getMatchThreshold(): Promise<number> {
  return invoke<number>('get_match_threshold');
}

/**
 * Set the matching threshold
 * @param threshold - New threshold value (0.0 to 1.0)
 */
export async function setMatchThreshold(threshold: number): Promise<void> {
  return invoke<void>('set_match_threshold', { threshold });
}

/**
 * Normalize a channel name (for testing/debugging)
 * @param name - Channel name to normalize
 * @returns Normalized channel name
 */
export async function normalizeChannelName(name: string): Promise<string> {
  return invoke<string>('normalize_channel_name', { name });
}

/**
 * Calculate match score between two channel names (for testing/debugging)
 * @param xmltvName - XMLTV channel name
 * @param xtreamName - Xtream stream name
 * @param epgIdMatch - Whether EPG IDs match
 * @param exactNameMatch - Whether normalized names match exactly
 * @returns Match score (0.0 to 1.0)
 */
export async function calculateMatchScore(
  xmltvName: string,
  xtreamName: string,
  epgIdMatch: boolean,
  exactNameMatch: boolean
): Promise<number> {
  return invoke<number>('calculate_match_score', {
    xmltvName,
    xtreamName,
    epgIdMatch,
    exactNameMatch,
  });
}

/**
 * Format confidence score as percentage
 * @param confidence - Confidence score (0.0 to 1.0)
 * @returns Formatted percentage string (e.g., "95%")
 */
export function formatConfidence(confidence: number | null): string {
  if (confidence === null) {
    return 'N/A';
  }
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Get match type display name
 * @param matchType - Match type
 * @returns Human-readable match type string
 */
export function getMatchTypeDisplay(matchType: MatchType): string {
  switch (matchType) {
    case 'exact_epg_id':
      return 'EPG ID Match';
    case 'exact_name':
      return 'Exact Name';
    case 'fuzzy':
      return 'Fuzzy Match';
    case 'none':
      return 'No Match';
    default:
      return 'Unknown';
  }
}

// ============================================================================
// XMLTV Channel Display types and functions (Story 3-2)
// ============================================================================

/** Matched Xtream stream info for display */
export interface XtreamStreamMatch {
  id: number;
  mappingId: number;
  name: string;
  streamIcon: string | null;
  qualities: string[];
  matchConfidence: number;
  isPrimary: boolean;
  streamPriority: number;
}

/** XMLTV channel with all mapping info for display */
export interface XmltvChannelWithMappings {
  id: number;
  sourceId: number;
  channelId: string;
  displayName: string;
  icon: string | null;
  isSynthetic: boolean;
  // Settings
  isEnabled: boolean;
  plexDisplayOrder: number | null;
  // Matches
  matchCount: number;
  matches: XtreamStreamMatch[];
}

/**
 * Get all XMLTV channels with their mapped Xtream streams
 * @returns List of XMLTV channels with mapping info
 */
export async function getXmltvChannelsWithMappings(): Promise<XmltvChannelWithMappings[]> {
  return invoke<XmltvChannelWithMappings[]>('get_xmltv_channels_with_mappings');
}

/**
 * Set the primary stream for an XMLTV channel
 * @param xmltvChannelId - XMLTV channel ID
 * @param xtreamChannelId - Xtream stream ID to make primary
 * @returns Updated list of matches
 */
export async function setPrimaryStream(
  xmltvChannelId: number,
  xtreamChannelId: number
): Promise<XtreamStreamMatch[]> {
  return invoke<XtreamStreamMatch[]>('set_primary_stream', {
    xmltvChannelId,
    xtreamChannelId,
  });
}

/**
 * Toggle the enabled status of an XMLTV channel
 * @param channelId - XMLTV channel ID
 * @returns Updated channel with mappings
 */
export async function toggleXmltvChannel(
  channelId: number
): Promise<XmltvChannelWithMappings> {
  return invoke<XmltvChannelWithMappings>('toggle_xmltv_channel', { channelId });
}

/**
 * Get match count label for display
 * @param count - Number of matched streams
 * @returns Formatted string (e.g., "1 stream", "3 streams")
 */
export function getMatchCountLabel(count: number): string {
  if (count === 0) {
    return 'No stream matched';
  }
  return `${count} stream${count === 1 ? '' : 's'}`;
}

/**
 * Get quality badge classes for styling
 * @param quality - Quality tier (SD, HD, FHD, 4K)
 * @returns Tailwind CSS classes for the badge
 */
export function getQualityBadgeClasses(quality: string): string {
  switch (quality.toUpperCase()) {
    case '4K':
      return 'bg-purple-100 text-purple-800';
    case 'FHD':
      return 'bg-blue-100 text-blue-800';
    case 'HD':
      return 'bg-green-100 text-green-800';
    case 'SD':
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
