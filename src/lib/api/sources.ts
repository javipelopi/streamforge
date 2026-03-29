import { invoke } from './invoke';
import type { XtreamStreamMatch } from './matcher';

// ============================================================================
// Link Status (shared across source types)
// ============================================================================

/** Link status for streams/channels across source types */
export type LinkStatus = 'linked' | 'orphan' | 'promoted';

// ============================================================================
// XMLTV Sources
// ============================================================================

/** XMLTV format type */
export type XmltvFormat = 'xml' | 'xml_gz' | 'auto';

/** XMLTV source response type */
export interface XmltvSource {
  id: number;
  name: string;
  url: string;
  format: XmltvFormat;
  refreshIntervalHours: number;
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
  refreshIntervalHours?: number;
}

/** Request type for updating an XMLTV source */
export interface XmltvSourceUpdate {
  name?: string;
  url?: string;
  format?: XmltvFormat;
  refreshIntervalHours?: number;
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
    refreshIntervalHours: source.refreshIntervalHours,
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

// ============================================================================
// M3U Source Management (Multi-Source Support)
// ============================================================================

/** M3U source response type */
export interface M3uSource {
  id: number;
  name: string;
  url: string;
  refreshIntervalHours: number;
  lastRefresh: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** M3U channel response type */
export interface M3uChannel {
  id: number;
  sourceId: number;
  streamUrl: string;
  name: string;
  tvgId: string | null;
  tvgName: string | null;
  tvgLogo: string | null;
  groupTitle: string | null;
  /** "linked" | "orphan" | "promoted" */
  linkStatus: LinkStatus;
  /** XMLTV channel IDs this channel is linked to */
  linkedXmltvIds: number[];
}

/** Request type for adding a new M3U source */
export interface NewM3uSource {
  name: string;
  url: string;
  refreshIntervalHours?: number;
}

/**
 * Add a new M3U playlist source
 *
 * @param name - Display name for the source
 * @param url - URL to the M3U playlist, local file path, or single stream URL
 * @param refreshIntervalHours - How often to refresh (default 24, ignored for local files/streams)
 * @param isLocalFile - Whether the source is a local file path instead of URL
 * @param isSingleStream - Whether this is a single stream URL (not a playlist)
 * @returns The created M3U source with fetched channels
 */
export async function addM3uSource(
  name: string,
  url: string,
  refreshIntervalHours?: number,
  isLocalFile?: boolean,
  isSingleStream?: boolean
): Promise<M3uSource> {
  return invoke<M3uSource>('add_m3u_source', {
    input: { name, url, refreshIntervalHours, isLocalFile, isSingleStream }
  });
}

/**
 * Get all M3U sources
 *
 * @returns List of all M3U sources
 */
export async function getM3uSources(): Promise<M3uSource[]> {
  return invoke<M3uSource[]>('get_m3u_sources');
}

/**
 * Refresh an M3U source (re-fetch and parse the playlist)
 *
 * @param sourceId - Source ID to refresh
 * @returns The updated M3U source
 */
export async function refreshM3uSource(sourceId: number): Promise<M3uSource> {
  return invoke<M3uSource>('refresh_m3u_source', { sourceId });
}

/**
 * Delete an M3U source and all its channels
 *
 * @param sourceId - Source ID to delete
 */
export async function deleteM3uSource(sourceId: number): Promise<void> {
  return invoke<void>('delete_m3u_source', { sourceId });
}

/**
 * Get all channels for an M3U source
 *
 * @param sourceId - Source ID to get channels for
 * @returns List of M3U channels
 */
export async function getM3uChannels(sourceId: number): Promise<M3uChannel[]> {
  return invoke<M3uChannel[]>('get_m3u_channels', { sourceId });
}

/**
 * Toggle M3U source active state
 *
 * @param sourceId - Source ID to toggle
 * @param active - New active state
 * @returns The updated source
 */
export async function toggleM3uSource(sourceId: number, active: boolean): Promise<M3uSource> {
  return invoke<M3uSource>('toggle_m3u_source', { sourceId, isActive: active });
}

/** Request type for updating an M3U source */
export interface UpdateM3uSourceRequest {
  name?: string;
  url?: string;
  refreshIntervalHours?: number;
}

/**
 * Update an existing M3U source
 *
 * @param sourceId - Source ID to update
 * @param data - Updated source data (name, url, refreshIntervalHours)
 * @returns The updated M3U source
 */
export async function updateM3uSource(
  sourceId: number,
  data: UpdateM3uSourceRequest
): Promise<M3uSource> {
  return invoke<M3uSource>('update_m3u_source', { sourceId, input: data });
}

// ============================================================================
// Acestream Source Management (Multi-Source Support)
// ============================================================================

/** Acestream source response type */
export interface AcestreamSource {
  id: number;
  name: string;
  contentId: string;
  isActive: boolean;
  createdAt: string;
  /** Pre-computed stream URL for display */
  streamUrl: string | null;
  /** "linked" | "orphan" | "promoted" */
  linkStatus: LinkStatus;
  /** XMLTV channel IDs this source is linked to */
  linkedXmltvIds: number[];
}

/** Acestream engine status */
export interface AcestreamStatus {
  isSupported: boolean;
  platform: string;
  engineAvailable: boolean;
  engineUrl: string;
}

/**
 * Check the status of the Acestream engine
 *
 * @returns Acestream engine status
 */
export async function checkAcestreamStatus(): Promise<AcestreamStatus> {
  return invoke<AcestreamStatus>('check_acestream_status');
}

/**
 * Add a new Acestream source
 *
 * @param name - Display name for the source
 * @param contentIdOrUrl - Acestream content ID (40-char hex) or acestream:// URL
 * @returns The created Acestream source
 */
export async function addAcestreamSource(name: string, contentIdOrUrl: string): Promise<AcestreamSource> {
  return invoke<AcestreamSource>('add_acestream_source', {
    input: { name, contentIdOrUrl }
  });
}

/**
 * Get all Acestream sources
 *
 * @returns List of all Acestream sources
 */
export async function getAcestreamSources(): Promise<AcestreamSource[]> {
  return invoke<AcestreamSource[]>('get_acestream_sources');
}

/**
 * Delete an Acestream source
 *
 * @param sourceId - Source ID to delete
 */
export async function deleteAcestreamSource(sourceId: number): Promise<void> {
  return invoke<void>('delete_acestream_source', { sourceId });
}

/**
 * Toggle Acestream source active state
 *
 * @param sourceId - Source ID to toggle
 * @param active - New active state
 * @returns The updated source
 */
export async function toggleAcestreamSource(
  sourceId: number,
  active: boolean
): Promise<AcestreamSource> {
  return invoke<AcestreamSource>('toggle_acestream_source', { sourceId, isActive: active });
}

/** Request type for updating an Acestream source */
export interface UpdateAcestreamSourceRequest {
  name?: string;
}

/**
 * Update an existing Acestream source
 *
 * @param sourceId - Source ID to update
 * @param data - Updated source data (name only, contentId cannot be changed)
 * @returns The updated Acestream source
 */
export async function updateAcestreamSource(
  sourceId: number,
  data: UpdateAcestreamSourceRequest
): Promise<AcestreamSource> {
  return invoke<AcestreamSource>('update_acestream_source', { sourceId, input: data });
}

// ============================================================================
// Multi-Source Channel Mappings
// ============================================================================

/** M3U stream match response type */
export interface M3uStreamMatch {
  id: number;
  mappingId: number;
  name: string;
  streamUrl: string;
  tvgLogo: string | null;
  groupTitle: string | null;
  isPrimary: boolean;
  streamPriority: number;
}

/** Acestream match response type */
export interface AcestreamMatch {
  id: number;
  mappingId: number;
  name: string;
  contentId: string;
  isPrimary: boolean;
  streamPriority: number;
}

/** All channel mappings across source types */
export interface AllChannelMappings {
  xmltvChannelId: number;
  xtreamMatches: XtreamStreamMatch[];
  m3uMatches: M3uStreamMatch[];
  acestreamMatches: AcestreamMatch[];
}

/**
 * Add an M3U channel mapping to an XMLTV channel
 *
 * @param xmltvChannelId - XMLTV channel to map to
 * @param m3uChannelId - M3U channel ID to map
 * @param setAsPrimary - Whether to set as primary stream
 * @returns All mappings for the XMLTV channel
 */
export async function addM3uChannelMapping(
  xmltvChannelId: number,
  m3uChannelId: number,
  setAsPrimary: boolean
): Promise<AllChannelMappings> {
  return invoke<AllChannelMappings>('add_m3u_channel_mapping', {
    xmltvChannelId,
    m3uChannelId,
    setAsPrimary,
  });
}

/**
 * Add an Acestream source mapping to an XMLTV channel
 *
 * @param xmltvChannelId - XMLTV channel to map to
 * @param acestreamSourceId - Acestream source ID to map
 * @param setAsPrimary - Whether to set as primary stream
 * @returns All mappings for the XMLTV channel
 */
export async function addAcestreamChannelMapping(
  xmltvChannelId: number,
  acestreamSourceId: number,
  setAsPrimary: boolean
): Promise<AllChannelMappings> {
  return invoke<AllChannelMappings>('add_acestream_channel_mapping', {
    xmltvChannelId,
    acestreamSourceId,
    setAsPrimary,
  });
}

/**
 * Get all channel mappings for an XMLTV channel (all source types)
 *
 * @param xmltvChannelId - XMLTV channel ID
 * @returns All mappings grouped by source type
 */
export async function getAllChannelMappings(xmltvChannelId: number): Promise<AllChannelMappings> {
  return invoke<AllChannelMappings>('get_all_channel_mappings', { xmltvChannelId });
}
