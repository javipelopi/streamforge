import { invoke } from './invoke';

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
