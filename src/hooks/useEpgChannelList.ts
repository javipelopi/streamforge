/**
 * EPG Channel List Data Hook
 * Story 5.5: EPG Channel List Panel
 *
 * Custom hook for fetching and managing the channel list with current programs.
 * Provides auto-refresh every 60 seconds to keep progress bars updated.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getEnabledChannelsWithPrograms, type EpgGridProgram } from '../lib/tauri';

/**
 * Channel list item with current program info
 */
export interface EpgChannelListItem {
  channelId: number;
  channelName: string;
  channelIcon?: string;
  plexDisplayOrder: number;
  /** Current program (may be undefined if no program is airing) */
  currentProgram?: EpgGridProgram;
}

/**
 * Return type for useEpgChannelList hook
 */
export interface UseEpgChannelListResult {
  /** List of channels with current programs */
  channels: EpgChannelListItem[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Manual refresh function */
  refresh: () => Promise<void>;
}

/**
 * Check if a program is currently airing
 */
function isProgramCurrentlyAiring(program: EpgGridProgram, now: Date = new Date()): boolean {
  const startTime = new Date(program.startTime);
  const endTime = new Date(program.endTime);
  return startTime <= now && endTime > now;
}

/**
 * Find the current program from a list of programs
 */
function findCurrentProgram(
  programs: EpgGridProgram[],
  now: Date = new Date()
): EpgGridProgram | undefined {
  return programs.find((p) => isProgramCurrentlyAiring(p, now));
}

/**
 * Hook for fetching and managing EPG channel list data
 *
 * Story 5.5 Tasks:
 * - 5.1: Create hook
 * - 5.2: Fetch enabled channels using getEnabledChannelsWithPrograms
 * - 5.3: Filter to get only the current program for each channel
 * - 5.4: Provide loading and error states
 * - 5.5: Add auto-refresh interval (every 60 seconds)
 *
 * @returns Channel list data, loading state, error, and refresh function
 */
export function useEpgChannelList(): UseEpgChannelListResult {
  const [channels, setChannels] = useState<EpgChannelListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshIntervalRef = useRef<number | null>(null);

  /**
   * Fetch channel data with current programs
   */
  const fetchChannelList = useCallback(async () => {
    try {
      // Get time window: 1 hour before to 1 hour after current time
      const now = new Date();
      const startTime = new Date(now.getTime() - 60 * 60 * 1000);
      const endTime = new Date(now.getTime() + 60 * 60 * 1000);

      const channelData = await getEnabledChannelsWithPrograms(
        startTime.toISOString(),
        endTime.toISOString()
      );

      // Transform to channel list items with only current program
      const channelListItems: EpgChannelListItem[] = channelData
        .map((channel) => ({
          channelId: channel.channelId,
          channelName: channel.channelName,
          channelIcon: channel.channelIcon,
          plexDisplayOrder: channel.plexDisplayOrder,
          currentProgram: findCurrentProgram(channel.programs, now),
        }))
        // Sort by plex display order
        .sort((a, b) => a.plexDisplayOrder - b.plexDisplayOrder);

      setChannels(channelListItems);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      console.error('Failed to fetch channel list:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchChannelList();
  }, [fetchChannelList]);

  // Initial fetch and auto-refresh setup
  useEffect(() => {
    fetchChannelList();

    // Set up auto-refresh every 60 seconds (Task 5.5)
    refreshIntervalRef.current = window.setInterval(() => {
      fetchChannelList();
    }, 60000);

    // Cleanup on unmount
    return () => {
      if (refreshIntervalRef.current !== null) {
        window.clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchChannelList]);

  return {
    channels,
    isLoading,
    error,
    refresh,
  };
}
