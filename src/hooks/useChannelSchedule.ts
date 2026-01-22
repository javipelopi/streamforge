/**
 * Channel Schedule Data Hook
 * Story 5.6: EPG Schedule Panel
 *
 * Custom hook for fetching schedule data for a selected channel.
 * Provides programs with NOW/PAST/FUTURE status determination.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getEnabledChannelsWithPrograms, type EpgGridProgram } from '../lib/tauri';

/**
 * Program status relative to current time
 */
export type ProgramStatus = 'NOW' | 'PAST' | 'FUTURE';

/**
 * Schedule program with status
 */
export interface ScheduleProgram extends EpgGridProgram {
  /** Status relative to current time */
  status: ProgramStatus;
}

/**
 * Return type for useChannelSchedule hook
 */
export interface UseChannelScheduleResult {
  /** List of programs with status */
  programs: ScheduleProgram[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** ID of the currently-airing program (if any) */
  currentProgramId: number | null;
  /** Manual refresh function */
  refresh: () => Promise<void>;
}

/**
 * Determine program status relative to current time
 * @param program - Program with start/end times
 * @param now - Current time (defaults to Date.now())
 * @returns Program status
 */
function getProgramStatus(program: EpgGridProgram, now: Date = new Date()): ProgramStatus {
  const start = new Date(program.startTime);
  const end = new Date(program.endTime);

  if (now >= start && now < end) return 'NOW';
  if (now >= end) return 'PAST';
  return 'FUTURE';
}

/**
 * Refresh interval for updating NOW status (1 minute)
 * Code Review Fix: Live updates for accurate NOW indicator
 */
const NOW_STATUS_REFRESH_INTERVAL_MS = 60_000;

/**
 * Get time window for schedule display (6 AM today to 6 AM tomorrow)
 * @param selectedDate - Optional selected date for day navigation (Story 5.7)
 * @returns Start and end time ISO strings
 */
function getScheduleTimeWindow(selectedDate?: { startTime: string; endTime: string }): { startTime: string; endTime: string } {
  // If a selected date is provided (from day navigation), use it
  if (selectedDate) {
    return selectedDate;
  }

  // Default: 6 AM today to 6 AM tomorrow
  const now = new Date();

  // Start of day at 6 AM
  const startOfDay = new Date(now);
  startOfDay.setHours(6, 0, 0, 0);

  // If current time is before 6 AM, use previous day's 6 AM
  if (now.getHours() < 6) {
    startOfDay.setDate(startOfDay.getDate() - 1);
  }

  // End of day at 6 AM next day (24 hours from start)
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  return {
    startTime: startOfDay.toISOString(),
    endTime: endOfDay.toISOString(),
  };
}

/**
 * Hook for fetching and managing schedule data for a selected channel
 *
 * Story 5.6 Tasks:
 * - 5.1: Create hook
 * - 5.2: Fetch programs for selected channel using getEnabledChannelsWithPrograms
 * - 5.3: Filter to get only the selected channel's programs
 * - 5.4: Time window: Start of day (6 AM) to end of day
 * - 5.5: Provide loading and error states
 * - 5.6: Implement helper to determine if program is NOW, PAST, or FUTURE
 * - 5.7: Sort programs by start time ascending
 *
 * Story 5.7 Enhancement:
 * - Added optional selectedDate parameter for day navigation
 *
 * @param channelId - Selected channel ID (null if no channel selected)
 * @param selectedDate - Optional time window for day navigation (Story 5.7)
 * @returns Schedule data, loading state, error, and refresh function
 */
export function useChannelSchedule(
  channelId: number | null,
  selectedDate?: { startTime: string; endTime: string }
): UseChannelScheduleResult {
  const [programs, setPrograms] = useState<ScheduleProgram[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentProgramId, setCurrentProgramId] = useState<number | null>(null);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Fetch schedule data for the selected channel
   */
  const fetchSchedule = useCallback(async () => {
    if (channelId === null) {
      setPrograms([]);
      setCurrentProgramId(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Prevent concurrent fetches (race condition fix)
    if (isFetchingRef.current) {
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const { startTime, endTime } = getScheduleTimeWindow(selectedDate);
      const channelData = await getEnabledChannelsWithPrograms(startTime, endTime);

      // Only update state if component is still mounted
      if (!isMountedRef.current) {
        return;
      }

      // Find the selected channel's programs
      const selectedChannel = channelData.find((ch) => ch.channelId === channelId);
      const channelPrograms = selectedChannel?.programs || [];

      // Add status to each program and sort by start time
      const now = new Date();
      let foundCurrentId: number | null = null;

      const programsWithStatus: ScheduleProgram[] = channelPrograms
        .map((program) => {
          const status = getProgramStatus(program, now);
          if (status === 'NOW') {
            foundCurrentId = program.id;
          }
          return {
            ...program,
            status,
          };
        })
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      setPrograms(programsWithStatus);
      setCurrentProgramId(foundCurrentId);
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) {
        return;
      }

      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      console.error('Failed to fetch channel schedule:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [channelId, selectedDate]);

  /**
   * Update NOW status for existing programs without re-fetching
   * Code Review Fix: Keep NOW indicator accurate as time progresses
   */
  const updateNowStatus = useCallback(() => {
    if (programs.length === 0) return;

    const now = new Date();
    let foundCurrentId: number | null = null;

    const updatedPrograms = programs.map((program) => {
      const status = getProgramStatus(program, now);
      if (status === 'NOW') {
        foundCurrentId = program.id;
      }
      return {
        ...program,
        status,
      };
    });

    setPrograms(updatedPrograms);
    setCurrentProgramId(foundCurrentId);
  }, [programs]);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async () => {
    await fetchSchedule();
  }, [fetchSchedule]);

  // Fetch schedule when channel changes
  useEffect(() => {
    isMountedRef.current = true;
    fetchSchedule();

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchSchedule]);

  // Set up interval to update NOW status every minute (Code Review Fix)
  useEffect(() => {
    if (programs.length === 0) return;

    refreshIntervalRef.current = setInterval(() => {
      updateNowStatus();
    }, NOW_STATUS_REFRESH_INTERVAL_MS);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [programs.length, updateNowStatus]);

  return {
    programs,
    isLoading,
    error,
    currentProgramId,
    refresh,
  };
}
