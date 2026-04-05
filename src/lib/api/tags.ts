import { invoke } from './invoke';

/**
 * Get all unique tags across all channels (for autocomplete).
 */
export async function getAllTags(): Promise<string[]> {
  return invoke<string[]>('get_all_tags');
}

/**
 * Get tags for a specific channel.
 */
export async function getChannelTags(channelId: number): Promise<string[]> {
  return invoke<string[]>('get_channel_tags', { id: channelId });
}

/**
 * Set tags for a channel (replaces existing).
 */
export async function setChannelTags(channelId: number, tags: string[]): Promise<string[]> {
  return invoke<string[]>('set_channel_tags', { id: channelId, tags });
}
