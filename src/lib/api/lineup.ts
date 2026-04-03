import { invoke } from './invoke';
import type { XmltvChannelWithMappings } from './matcher';
import { getXmltvChannelsWithMappings } from './matcher';
import type { LinkStatus } from './sources';

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

// ============================================================================
// Orphan M3U Channels
// ============================================================================

/** Orphan M3U channel info (channels not matched to any XMLTV channel) */
export interface OrphanM3uChannel {
  id: number;
  sourceId: number;
  sourceName: string;
  name: string;
  streamUrl: string;
  tvgId: string | null;
  tvgName: string | null;
  tvgLogo: string | null;
  groupTitle: string | null;
}

/**
 * Get all M3U channels that are NOT matched to any XMLTV channel.
 *
 * @returns List of M3U channels not mapped to any XMLTV channel
 */
export async function getOrphanM3uChannels(): Promise<OrphanM3uChannel[]> {
  return invoke<OrphanM3uChannel[]>('get_orphan_m3u_channels');
}

/**
 * Promote an orphan M3U channel to a synthetic XMLTV channel for Plex.
 *
 * @param m3uChannelId - The M3U channel ID to promote
 * @param displayName - Display name for the synthetic channel
 * @param iconUrl - Optional icon URL for the channel
 * @returns The newly created XmltvChannelWithMappings
 */
export async function promoteM3uOrphanToPlex(
  m3uChannelId: number,
  displayName: string,
  iconUrl: string | null
): Promise<XmltvChannelWithMappings> {
  return invoke<XmltvChannelWithMappings>('promote_m3u_orphan_to_plex', {
    m3uChannelId,
    displayName,
    iconUrl,
  });
}

// ============================================================================
// Orphan Acestream Sources
// ============================================================================

/** Orphan Acestream source info (sources not matched to any XMLTV channel) */
export interface OrphanAcestreamSource {
  id: number;
  name: string;
  contentId: string;
  isActive: boolean;
}

/**
 * Get all Acestream sources that are NOT matched to any XMLTV channel.
 *
 * @returns List of Acestream sources not mapped to any XMLTV channel
 */
export async function getOrphanAcestreamSources(): Promise<OrphanAcestreamSource[]> {
  return invoke<OrphanAcestreamSource[]>('get_orphan_acestream_sources');
}

/**
 * Promote an orphan Acestream source to a synthetic XMLTV channel for Plex.
 *
 * @param acestreamSourceId - The Acestream source ID to promote
 * @param displayName - Display name for the synthetic channel
 * @param iconUrl - Optional icon URL for the channel
 * @returns The newly created XmltvChannelWithMappings
 */
export async function promoteAcestreamOrphanToPlex(
  acestreamSourceId: number,
  displayName: string,
  iconUrl: string | null
): Promise<XmltvChannelWithMappings> {
  return invoke<XmltvChannelWithMappings>('promote_acestream_orphan_to_plex', {
    acestreamSourceId,
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
 *
 * @returns List of enabled channels for the Target Lineup
 */
export async function getTargetLineupChannels(): Promise<TargetLineupChannel[]> {
  return invoke<TargetLineupChannel[]>('get_target_lineup_channels');
}

/**
 * Get all DISABLED (matched but not enabled) channels for the Target Lineup view.
 *
 * Uses the existing getXmltvChannelsWithMappings endpoint and filters client-side
 * for channels where isEnabled=false and matchCount>0 (matched but disabled).
 *
 * @returns List of disabled channels, sorted alphabetically by display name
 */
export async function getDisabledLineupChannels(): Promise<TargetLineupChannel[]> {
  const allChannels = await getXmltvChannelsWithMappings();
  return allChannels
    .filter((ch) => !ch.isEnabled && ch.matchCount > 0)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map((ch) => ({
      id: ch.id,
      displayName: ch.displayName,
      icon: ch.icon,
      isEnabled: false,
      isSynthetic: ch.isSynthetic,
      streamCount: ch.matchCount,
      plexDisplayOrder: ch.plexDisplayOrder,
    }));
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
 * @param sourceId - Source ID to get channels for
 * @returns List of XMLTV channels for the source
 */
export async function getXmltvChannelsForSource(sourceId: number): Promise<XmltvSourceChannel[]> {
  return invoke<XmltvSourceChannel[]>('get_xmltv_channels_for_source', { sourceId });
}

// ============================================================================
// Xtream Sources View (Story 3-11)
// ============================================================================

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
 * @param xtreamChannelId - The Xtream channel ID to unlink
 * @returns Number of mappings removed
 */
export async function unlinkXtreamStream(xtreamChannelId: number): Promise<number> {
  return invoke<number>('unlink_xtream_stream', { xtreamChannelId });
}

/**
 * Get the playback URL for an Xtream stream.
 *
 * @param xtreamChannelId - The database ID of the Xtream channel/stream
 * @returns The full stream URL for playback
 */
export async function getXtreamStreamUrl(xtreamChannelId: number): Promise<string> {
  return invoke<string>('get_xtream_stream_url', { xtreamChannelId });
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
