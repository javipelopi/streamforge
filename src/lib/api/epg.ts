import { invoke } from './invoke';

// ============================================================================
// EPG Refresh types and functions
// ============================================================================

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

// ============================================================================
// EPG Schedule types and functions
// ============================================================================

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
// EPG Grid types and functions (Story 5.1, updated Story 5.9)
// ============================================================================

/** Program data for EPG display */
export interface EpgProgram {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  category?: string;
  description?: string;
  episodeInfo?: string;
}

/** Channel data with programs for EPG display */
export interface EpgChannel {
  channelId: number;
  channelName: string;
  channelIcon?: string;
  plexDisplayOrder: number;
  programs: EpgProgram[];
}

// Legacy type aliases for backwards compatibility with Rust backend
// These match the Rust struct names in get_enabled_channels_with_programs command
/** @deprecated Use EpgProgram instead */
export type EpgGridProgram = EpgProgram;
/** @deprecated Use EpgChannel instead */
export type EpgGridChannel = EpgChannel;

/**
 * Get enabled XMLTV channels with their programs in a time range
 *
 * Story 5.1: EPG Grid Browser with Time Navigation
 * AC #1: Grid displays enabled XMLTV channels only (Plex preview mode)
 * AC #3: Efficient rendering with time range filtering
 *
 * @param startTime - Start of time window (ISO string)
 * @param endTime - End of time window (ISO string)
 * @returns List of enabled channels with their programs
 */
export async function getEnabledChannelsWithPrograms(
  startTime: string,
  endTime: string
): Promise<EpgChannel[]> {
  return invoke<EpgChannel[]>('get_enabled_channels_with_programs', {
    startTime,
    endTime,
  });
}

// ============================================================================
// EPG Search types and functions (Story 5.2)
// ============================================================================

/** Match type for search result relevance */
export type EpgSearchMatchType = 'title' | 'channel' | 'description';

/** Result type for search results (program vs channel-only) */
export type EpgSearchResultType = 'program' | 'channel';

/** Search result for EPG program or channel search */
export interface EpgSearchResult {
  /** Type of result: 'program' or 'channel' */
  resultType: EpgSearchResultType;
  /** Program ID (null for channel-only results) */
  programId?: number | null;
  title: string;
  description?: string | null;
  /** Start time (null for channel-only results) */
  startTime?: string | null;
  /** End time (null for channel-only results) */
  endTime?: string | null;
  category?: string | null;
  channelId: number;
  channelName: string;
  channelIcon?: string | null;
  /** Match type for relevance: 'title', 'channel', 'description' */
  matchType: EpgSearchMatchType;
  /** Match score 0-1 for relevance ordering */
  relevanceScore: number;
}

/**
 * Search EPG programs by title, description, or channel name
 *
 * Story 5.2: EPG Search Functionality
 * AC #2: Search filters by title, description, channel name (enabled channels only)
 *
 * @param query - Search query string
 * @returns List of matching programs with relevance scores
 */
export async function searchEpgPrograms(query: string): Promise<EpgSearchResult[]> {
  return invoke<EpgSearchResult[]>('search_epg_programs', { query });
}

/**
 * Get relevance indicator display text based on search match type
 *
 * Story 5.2: AC #3 - Results show relevance indicator
 *
 * @param matchType - The match type from search result
 * @returns Human-readable relevance indicator
 */
export function getEpgSearchMatchTypeDisplay(matchType: EpgSearchMatchType): string {
  switch (matchType) {
    case 'title':
      return 'Title match';
    case 'channel':
      return 'Channel match';
    case 'description':
      return 'Description match';
    default:
      return 'Match';
  }
}

/**
 * Get relevance badge color classes based on match type
 *
 * @param matchType - The match type from search result
 * @returns Tailwind CSS classes for the badge
 */
export function getMatchTypeBadgeClasses(matchType: EpgSearchMatchType): string {
  switch (matchType) {
    case 'title':
      return 'bg-green-100 text-green-800'; // Highest relevance
    case 'channel':
      return 'bg-blue-100 text-blue-800'; // Medium relevance
    case 'description':
      return 'bg-gray-100 text-gray-800'; // Lower relevance
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Format program duration from start and end times
 *
 * @param startTime - ISO start time string
 * @param endTime - ISO end time string
 * @returns Formatted duration string (e.g., "1h 30m")
 */
export function formatProgramDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));

  if (durationMinutes < 60) {
    return `${durationMinutes}m`;
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

// ============================================================================
// Program Details types and functions (Story 5.3)
// ============================================================================

/** Stream info for program details panel */
export interface ChannelStreamInfo {
  streamName: string;
  qualityTiers: string[];
  isPrimary: boolean;
  matchConfidence: number;
}

/**
 * Get stream info for an XMLTV channel
 *
 * Story 5.3: Program Details View
 * AC #3: Stream info displays for channels with Xtream mappings
 *
 * @param xmltvChannelId - XMLTV channel ID to get stream info for
 * @returns Stream info or null if no mapping exists
 */
export async function getChannelStreamInfo(
  xmltvChannelId: number
): Promise<ChannelStreamInfo | null> {
  return invoke<ChannelStreamInfo | null>('get_channel_stream_info', {
    xmltvChannelId,
  });
}

// ============================================================================
// Program Details types and functions (Story 5.8)
// ============================================================================

/** Program with associated channel information */
export interface ProgramWithChannel {
  program: Program;
  channel: {
    id: number;
    displayName: string;
    icon?: string;
  };
}

/**
 * Get program by ID with associated channel information
 *
 * Story 5.8: EPG Program Details Panel
 * Task 8.4: TypeScript binding for getProgramById
 *
 * @param programId - Program ID to fetch
 * @returns Program with channel data, or null if not found
 */
export async function getProgramById(programId: number): Promise<ProgramWithChannel | null> {
  return invoke<ProgramWithChannel | null>('get_program_by_id', { programId });
}
