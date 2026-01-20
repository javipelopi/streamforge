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
  isManual: boolean;
  streamPriority: number;
  /** True if this is a manual match pointing to a stream that no longer exists */
  isOrphaned: boolean;
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

// ============================================================================
// Manual Stream Matching types and functions (Story 3-3)
// ============================================================================

/** Xtream stream for search dropdown */
export interface XtreamStreamSearchResult {
  id: number;
  streamId: number;
  name: string;
  streamIcon: string | null;
  qualities: string[];
  categoryName: string | null;
  /** List of XMLTV channel IDs this stream is already matched to */
  matchedToXmltvIds: number[];
  /** Fuzzy match score against search query (0.0-1.0), null if no search query */
  fuzzyScore: number | null;
}

/**
 * Get all Xtream streams for the search dropdown
 * @returns List of Xtream streams with their current mappings
 */
export async function getAllXtreamStreams(): Promise<XtreamStreamSearchResult[]> {
  return invoke<XtreamStreamSearchResult[]>('get_all_xtream_streams');
}

/**
 * Search Xtream streams by fuzzy matching against a query string
 * @param query - Search query (e.g., XMLTV channel name)
 * @returns List of Xtream streams with fuzzy scores, ordered by score descending
 */
export async function searchXtreamStreams(query: string): Promise<XtreamStreamSearchResult[]> {
  return invoke<XtreamStreamSearchResult[]>('search_xtream_streams', { query });
}

/**
 * Add a manual stream mapping between an XMLTV channel and an Xtream stream
 * @param xmltvChannelId - XMLTV channel ID
 * @param xtreamChannelId - Xtream stream ID to map
 * @param setAsPrimary - Whether to set this stream as primary
 * @returns Updated list of matches for the XMLTV channel
 */
export async function addManualStreamMapping(
  xmltvChannelId: number,
  xtreamChannelId: number,
  setAsPrimary: boolean
): Promise<XtreamStreamMatch[]> {
  return invoke<XtreamStreamMatch[]>('add_manual_stream_mapping', {
    xmltvChannelId,
    xtreamChannelId,
    setAsPrimary,
  });
}

/**
 * Remove a stream mapping
 * @param mappingId - Mapping ID to remove
 * @returns Updated list of matches for the XMLTV channel
 */
export async function removeStreamMapping(
  mappingId: number
): Promise<XtreamStreamMatch[]> {
  return invoke<XtreamStreamMatch[]>('remove_stream_mapping', { mappingId });
}

// ============================================================================
// Channel Reordering (Story 3-6)
// ============================================================================

/**
 * Update the display order of XMLTV channels for Plex lineup.
 * Story 3-6: Drag-and-Drop Channel Reordering
 *
 * @param channelIds - Array of XMLTV channel IDs in new display order
 * @returns Promise that resolves when order is updated
 */
export async function updateChannelOrder(channelIds: number[]): Promise<void> {
  return invoke('update_channel_order', { channelIds });
}

// ============================================================================
// Auto-Rematch and Event Logging types and functions (Story 3-4)
// ============================================================================

/** Enhanced response type for scan_and_rematch command */
export interface ScanAndRematchResponse {
  success: boolean;
  /** Total channels from provider */
  totalChannels: number;
  /** New channels from provider */
  newChannels: number;
  /** Channels with updated metadata */
  updatedChannels: number;
  /** Channels removed from provider */
  removedChannels: number;
  /** New XMLTV matches created by auto-rematch */
  newMatches: number;
  /** Mappings removed (due to removed streams) */
  removedMatches: number;
  /** Mappings with updated confidence */
  updatedMatches: number;
  /** Manual matches preserved (not auto-removed) */
  preservedManualMatches: number;
  /** Scan duration in milliseconds */
  scanDurationMs: number;
  /** Error message if failed */
  errorMessage?: string;
}

/**
 * Scan channels from provider and auto-rematch to XMLTV channels
 *
 * This enhanced scan command:
 * 1. Fetches channels from Xtream provider
 * 2. Detects new, removed, and changed streams
 * 3. Auto-matches new streams to XMLTV channels
 * 4. Handles removed streams (deletes auto-mappings, preserves manual)
 * 5. Updates confidence scores for changed streams
 * 6. Logs all provider changes to event log
 *
 * @param accountId - Account ID to scan
 * @returns Enhanced response with both channel and match statistics
 */
export async function scanAndRematch(accountId: number): Promise<ScanAndRematchResponse> {
  return invoke<ScanAndRematchResponse>('scan_and_rematch', { accountId });
}

/**
 * Format scan and rematch results as a human-readable summary
 * @param response - Scan and rematch response
 * @returns Summary string (e.g., "Scanned 100 channels. 5 new matches, 2 removed, 1 updated.")
 */
export function formatScanRematchSummary(response: ScanAndRematchResponse): string {
  const matchText = response.newMatches === 1 ? 'new match' : 'new matches';
  return `Scanned ${response.totalChannels} channels. ${response.newMatches} ${matchText}, ${response.removedMatches} removed, ${response.updatedMatches} updated.`;
}

// Event Log types

/** Event log level */
export type EventLevel = 'info' | 'warn' | 'error';

/** Event log category */
export type EventCategory = 'connection' | 'stream' | 'match' | 'epg' | 'system' | 'provider';

/** Event log entry */
export interface EventLogEntry {
  id: number;
  timestamp: string;
  level: EventLevel;
  category: string;
  message: string;
  details: string | null;
  isRead: boolean;
}

/** Event log response */
export interface EventLogResponse {
  events: EventLogEntry[];
  totalCount: number;
  unreadCount: number;
}

/** Log event input */
export interface LogEventInput {
  level: EventLevel;
  category: string;
  message: string;
  details?: string;
}

/**
 * Log an event to the database
 * @param level - Event level: "info", "warn", or "error"
 * @param category - Event category
 * @param message - Human-readable message
 * @param details - Optional JSON string with additional details
 * @returns The created event log entry
 */
export async function logEvent(
  level: EventLevel,
  category: string,
  message: string,
  details?: string
): Promise<EventLogEntry> {
  return invoke<EventLogEntry>('log_event', { level, category, message, details });
}

/**
 * Get events from the event log
 * @param options - Query options (limit, offset, filters)
 * @returns Event log response with events and counts
 */
export async function getEvents(options?: {
  limit?: number;
  offset?: number;
  level?: EventLevel;
  category?: string;
  unreadOnly?: boolean;
}): Promise<EventLogResponse> {
  return invoke<EventLogResponse>('get_events', {
    limit: options?.limit,
    offset: options?.offset,
    level: options?.level,
    category: options?.category,
    unreadOnly: options?.unreadOnly,
  });
}

/**
 * Get the count of unread events
 * @returns Number of unread events
 */
export async function getUnreadEventCount(): Promise<number> {
  return invoke<number>('get_unread_event_count');
}

/**
 * Mark an event as read
 * @param eventId - Event ID to mark as read
 */
export async function markEventRead(eventId: number): Promise<void> {
  return invoke<void>('mark_event_read', { eventId });
}

/**
 * Mark all events as read
 * @returns Number of events marked as read
 */
export async function markAllEventsRead(): Promise<number> {
  return invoke<number>('mark_all_events_read');
}

/**
 * Clear old events, keeping only the most recent ones
 * @param keepCount - Number of recent events to keep (default 1000)
 * @returns Number of events deleted
 */
export async function clearOldEvents(keepCount?: number): Promise<number> {
  return invoke<number>('clear_old_events', { keepCount });
}

/**
 * Get level badge color classes
 * @param level - Event level
 * @returns Tailwind CSS classes for the badge
 */
export function getEventLevelClasses(level: EventLevel): string {
  switch (level) {
    case 'error':
      return 'bg-red-100 text-red-800';
    case 'warn':
      return 'bg-yellow-100 text-yellow-800';
    case 'info':
    default:
      return 'bg-blue-100 text-blue-800';
  }
}

/**
 * Get level icon name
 * @param level - Event level
 * @returns Icon name for the level
 */
export function getEventLevelIcon(level: EventLevel): string {
  switch (level) {
    case 'error':
      return 'exclamation-circle';
    case 'warn':
      return 'exclamation-triangle';
    case 'info':
    default:
      return 'information-circle';
  }
}

/**
 * Parse event details JSON
 * @param details - JSON string or null
 * @returns Parsed object or null
 */
export function parseEventDetails<T = Record<string, unknown>>(details: string | null): T | null {
  if (!details) return null;
  try {
    return JSON.parse(details) as T;
  } catch {
    return null;
  }
}

// ============================================================================
// Bulk Channel Operations (Story 3-7)
// ============================================================================

/** Result of bulk toggle operation */
export interface BulkToggleResult {
  /** Number of channels successfully toggled */
  successCount: number;
  /** Number of channels skipped (e.g., unmatched channels when enabling) */
  skippedCount: number;
  /** IDs of channels that were skipped */
  skippedIds: number[];
}

/**
 * Bulk toggle the enabled status of multiple XMLTV channels.
 *
 * Story 3-7: Bulk Channel Operations
 *
 * When enabling:
 * - Channels WITH matched streams are enabled
 * - Channels WITHOUT matched streams are skipped (cannot enable without stream source)
 *
 * When disabling:
 * - All selected channels are disabled (no restrictions)
 *
 * @param channelIds - Array of XMLTV channel IDs to toggle
 * @param enabled - True to enable, false to disable
 * @returns BulkToggleResult with success count, skipped count, and skipped IDs
 */
export async function bulkToggleChannels(
  channelIds: number[],
  enabled: boolean
): Promise<BulkToggleResult> {
  return invoke<BulkToggleResult>('bulk_toggle_channels', { channelIds, enabled });
}

// ============================================================================
// Orphan Xtream Channels (Story 3-8)
// ============================================================================

/** Orphan Xtream stream info (streams not matched to any XMLTV channel) */
export interface OrphanXtreamStream {
  id: number;
  streamId: number;
  name: string;
  streamIcon: string | null;
  qualities: string[];
  categoryName: string | null;
}

/**
 * Get all Xtream streams that are NOT matched to any XMLTV channel.
 *
 * Story 3-8: AC #1 - Display unmatched Xtream streams section
 *
 * These are "orphan" streams that exist in the Xtream provider but have no
 * corresponding XMLTV channel entry for EPG data. Users can "promote" these
 * to create synthetic XMLTV channels with placeholder EPG.
 *
 * @returns List of Xtream streams not mapped to any XMLTV channel
 */
export async function getOrphanXtreamStreams(): Promise<OrphanXtreamStream[]> {
  return invoke<OrphanXtreamStream[]>('get_orphan_xtream_streams');
}

/**
 * Promote an orphan Xtream stream to a synthetic XMLTV channel for Plex.
 *
 * Story 3-8: AC #2, #3 - Promote orphan to Plex
 *
 * Creates:
 * 1. A synthetic `xmltv_channels` entry with `is_synthetic = true`
 * 2. A `channel_mappings` entry linking it to the Xtream stream
 * 3. A `xmltv_channel_settings` entry with `is_enabled = 0`
 * 4. Placeholder EPG data for the next 7 days
 *
 * @param xtreamChannelId - The Xtream stream ID to promote
 * @param displayName - Display name for the synthetic channel
 * @param iconUrl - Optional icon URL for the channel
 * @returns The newly created XmltvChannelWithMappings
 */
export async function promoteOrphanToPlex(
  xtreamChannelId: number,
  displayName: string,
  iconUrl: string | null
): Promise<XmltvChannelWithMappings> {
  return invoke<XmltvChannelWithMappings>('promote_orphan_to_plex', {
    xtreamChannelId,
    displayName,
    iconUrl,
  });
}

/**
 * Update a synthetic channel's display name and icon.
 *
 * Story 3-8: AC #5 - Edit synthetic channel
 *
 * Only works for channels where `is_synthetic = true`.
 * Also updates placeholder EPG program titles if name changed.
 *
 * @param channelId - The XMLTV channel ID (must be synthetic)
 * @param displayName - New display name
 * @param iconUrl - New icon URL (or null to remove)
 * @returns Updated XmltvChannelWithMappings
 */
export async function updateSyntheticChannel(
  channelId: number,
  displayName: string,
  iconUrl: string | null
): Promise<XmltvChannelWithMappings> {
  return invoke<XmltvChannelWithMappings>('update_synthetic_channel', {
    channelId,
    displayName,
    iconUrl,
  });
}

// ============================================================================
// Target Lineup View (Story 3-9)
// ============================================================================

/** Target Lineup Channel - simplified view for Plex lineup management */
export interface TargetLineupChannel {
  id: number;
  displayName: string;
  icon: string | null;
  isEnabled: boolean;
  isSynthetic: boolean;
  /** Number of Xtream streams mapped to this channel */
  streamCount: number;
  /** Display order in Plex lineup */
  plexDisplayOrder: number | null;
}

/**
 * Get all ENABLED channels for the Target Lineup view.
 *
 * Story 3-9: AC #2 - Display only enabled channels
 *
 * Returns channels sorted by plex_display_order (nulls last).
 * This is an optimized query that only returns fields needed for the lineup view.
 *
 * @returns List of enabled channels for the Target Lineup
 */
export async function getTargetLineupChannels(): Promise<TargetLineupChannel[]> {
  return invoke<TargetLineupChannel[]>('get_target_lineup_channels');
}

// ============================================================================
// XMLTV Source Channel Display (Story 3-10)
// ============================================================================

/** XMLTV channel with mapping info for Sources view */
export interface XmltvSourceChannel {
  id: number;
  sourceId: number;
  channelId: string;
  displayName: string;
  icon: string | null;
  isSynthetic: boolean;
  /** Whether channel is in the Plex lineup */
  isEnabled: boolean;
  /** Number of Xtream streams mapped to this channel */
  matchCount: number;
}

/**
 * Get all XMLTV channels for a specific source.
 *
 * Story 3-10: AC #2 - Get channels for source
 *
 * Returns channels with enabled status and match counts for display
 * in the Sources view accordion.
 *
 * @param sourceId - Source ID to get channels for
 * @returns List of XMLTV channels for the source
 */
export async function getXmltvChannelsForSource(sourceId: number): Promise<XmltvSourceChannel[]> {
  return invoke<XmltvSourceChannel[]>('get_xmltv_channels_for_source', { sourceId });
}

// ============================================================================
// Xtream Sources View (Story 3-11)
// ============================================================================

/** Link status for Xtream streams */
export type LinkStatus = 'linked' | 'orphan' | 'promoted';

/** Xtream stream with mapping status for display in Sources view */
export interface XtreamAccountStream {
  id: number;
  streamId: number;
  name: string;
  streamIcon: string | null;
  qualities: string[];
  categoryName: string | null;
  /** "linked" | "orphan" | "promoted" */
  linkStatus: LinkStatus;
  /** XMLTV channel IDs this stream is linked to */
  linkedXmltvIds: number[];
  /** If promoted, the synthetic channel ID */
  syntheticChannelId: number | null;
}

/** Statistics for an account's streams */
export interface AccountStreamStats {
  /** Total number of streams for this account */
  streamCount: number;
  /** Number of streams linked to XMLTV channels */
  linkedCount: number;
  /** Number of orphan streams (not linked) */
  orphanCount: number;
  /** Number of promoted streams (linked to synthetic channels) */
  promotedCount: number;
}

/**
 * Get all Xtream streams for a specific account with their mapping status.
 *
 * Story 3-11: AC #2 - Display streams grouped by account
 *
 * Returns streams with:
 * - Stream info (name, icon, qualities, category)
 * - Link status: linked (mapped to XMLTV), orphan (unmapped), or promoted (synthetic)
 * - List of linked XMLTV channel IDs
 *
 * @param accountId - The Xtream account ID to get streams for
 * @returns List of streams for the account with mapping status
 */
export async function getXtreamStreamsForAccount(accountId: number): Promise<XtreamAccountStream[]> {
  return invoke<XtreamAccountStream[]>('get_xtream_streams_for_account', { accountId });
}

/**
 * Get stream statistics for a specific account.
 *
 * Story 3-11: AC #3 - Show statistics in accordion header
 *
 * Returns counts of:
 * - Total streams
 * - Linked streams (mapped to XMLTV channels)
 * - Orphan streams (not mapped)
 * - Promoted streams (linked to synthetic channels)
 *
 * @param accountId - The Xtream account ID to get stats for
 * @returns Statistics for the account's streams
 */
export async function getAccountStreamStats(accountId: number): Promise<AccountStreamStats> {
  return invoke<AccountStreamStats>('get_account_stream_stats', { accountId });
}

/**
 * Remove all mappings for a specific Xtream stream.
 *
 * Story 3-11: AC #3 - Unlink stream from all XMLTV channels
 *
 * Deletes all channel_mappings rows for the given xtream_channel_id.
 * This effectively orphans the stream so it can be re-linked or promoted.
 *
 * @param xtreamChannelId - The Xtream channel ID to unlink
 * @returns Number of mappings removed
 */
export async function unlinkXtreamStream(xtreamChannelId: number): Promise<number> {
  return invoke<number>('unlink_xtream_stream', { xtreamChannelId });
}

/**
 * Get link status badge color classes for display
 * Story 3-11 AC #2: Linked (blue), Orphan (amber), Promoted (green)
 * @param status - Link status
 * @returns Tailwind CSS classes for the badge
 */
export function getLinkStatusBadgeClasses(status: LinkStatus): string {
  switch (status) {
    case 'linked':
      return 'bg-blue-100 text-blue-800';
    case 'orphan':
      return 'bg-amber-100 text-amber-800';
    case 'promoted':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get link status display label
 * @param status - Link status
 * @returns Human-readable status label
 */
export function getLinkStatusLabel(status: LinkStatus): string {
  switch (status) {
    case 'linked':
      return 'Linked';
    case 'orphan':
      return 'Orphan';
    case 'promoted':
      return 'Promoted';
    default:
      return 'Unknown';
  }
}

// ============================================================================
// Plex Configuration (Story 4-6)
// ============================================================================

/** Plex configuration response type */
export interface PlexConfig {
  /** Whether the HTTP server is running and accepting connections */
  server_running: boolean;
  /** Local network IP address */
  local_ip: string;
  /** Server port (default 5004) */
  port: number;
  /** M3U Playlist URL for Plex tuner configuration */
  m3u_url: string;
  /** EPG/XMLTV URL for Plex guide data */
  epg_url: string;
  /** HDHomeRun base URL for manual tuner setup */
  hdhr_url: string;
  /** Maximum concurrent streams (tuner count) from active accounts */
  tuner_count: number;
}

/**
 * Get Plex configuration URLs for display in Dashboard
 *
 * Story 4-6: Display Plex Configuration URLs
 *
 * Returns all URLs needed to configure Plex tuner plus server status.
 * @returns PlexConfig with URLs and server status
 */
export async function getPlexConfig(): Promise<PlexConfig> {
  return invoke<PlexConfig>('get_plex_config');
}
