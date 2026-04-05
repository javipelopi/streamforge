import { invoke } from './invoke';

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
  const result = await invoke<number | { threshold: number }>('get_match_threshold');
  // REST API returns { threshold: number }, Tauri IPC returns bare number
  if (typeof result === 'object' && result !== null && 'threshold' in result) {
    return result.threshold;
  }
  return result as number;
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
// M3U Auto-Match (Multi-Source Stream Support)
// ============================================================================

/** M3U auto-match response type */
export interface M3uAutoMatchResponse {
  success: boolean;
  matchedCount: number;
  unmatchedCount: number;
  totalM3uChannels: number;
  totalXmltvChannels: number;
  durationMs: number;
  mappingsCreated: number;
  message: string;
}

/** M3U match result type */
export interface M3uMatchResult {
  xmltvChannelId: number;
  m3uChannelId: number;
  confidence: number;
  isPrimary: boolean;
  streamPriority: number;
  matchType: MatchType;
}

/**
 * Auto-match M3U channels to XMLTV channels using fuzzy matching
 * @param sourceId - Optional M3U source ID to match. If not provided, matches all sources.
 * @param threshold - Optional confidence threshold (0.0 to 1.0). Defaults to 0.85.
 * @returns Match response with statistics
 */
export async function autoMatchM3uChannels(
  sourceId?: number,
  threshold?: number
): Promise<M3uAutoMatchResponse> {
  return invoke<M3uAutoMatchResponse>('auto_match_m3u_channels', {
    sourceId,
    threshold,
  });
}

/**
 * Get M3U auto-match results
 * @param sourceId - Optional M3U source ID to filter by
 * @returns List of M3U match results
 */
export async function getM3uAutoMatchResults(sourceId?: number): Promise<M3uMatchResult[]> {
  return invoke<M3uMatchResult[]>('get_m3u_auto_match_results', { sourceId });
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
  // Tags
  tags: string[];
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
