import { useState, useEffect, useCallback } from 'react';
import {
  getEnabledChannelsWithPrograms,
  type EpgGridChannel,
  type EpgGridProgram,
} from '../lib/tauri';

/**
 * Time window for EPG grid display
 */
export interface TimeWindow {
  startTime: Date;
  endTime: Date;
}

/**
 * EPG Grid data state
 */
export interface EpgGridData {
  channels: EpgGridChannel[];
  timeWindow: TimeWindow;
}

/**
 * Return type for useEpgGridData hook
 */
export interface UseEpgGridDataResult {
  /** Channel data with programs */
  data: EpgGridData | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh data for current time window */
  refresh: () => Promise<void>;
  /** Update time window and fetch new data */
  setTimeWindow: (startTime: Date, endTime: Date) => void;
}

/**
 * Hook for fetching and managing EPG grid data
 *
 * Story 5.1: EPG Grid Browser with Time Navigation
 * Task 1: Create EPG data fetching hook
 *
 * Features:
 * - Fetches enabled channels with programs in time range
 * - Manages loading and error states
 * - Provides refresh capability
 * - Updates data when time window changes
 *
 * @param initialStartTime - Initial start of time window
 * @param initialEndTime - Initial end of time window
 * @returns EPG grid data, loading state, error, and control functions
 */
export function useEpgGridData(
  initialStartTime: Date,
  initialEndTime: Date
): UseEpgGridDataResult {
  const [data, setData] = useState<EpgGridData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeWindow, setTimeWindowState] = useState<TimeWindow>({
    startTime: initialStartTime,
    endTime: initialEndTime,
  });

  /**
   * Fetch EPG data for the current time window
   */
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const channels = await getEnabledChannelsWithPrograms(
        timeWindow.startTime.toISOString(),
        timeWindow.endTime.toISOString()
      );

      setData({
        channels,
        timeWindow,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      console.error('Failed to fetch EPG data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [timeWindow]);

  /**
   * Refresh data with current time window
   */
  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  /**
   * Update time window and trigger data fetch
   */
  const setTimeWindow = useCallback((startTime: Date, endTime: Date) => {
    setTimeWindowState({ startTime, endTime });
  }, []);

  // Fetch data when time window changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refresh,
    setTimeWindow,
  };
}

/**
 * Helper to create a time window centered on a specific time
 *
 * @param centerTime - Time to center the window on
 * @param durationHours - Total duration of window in hours (default: 3)
 * @returns TimeWindow object
 */
export function createCenteredTimeWindow(
  centerTime: Date,
  durationHours: number = 3
): TimeWindow {
  const halfDuration = (durationHours / 2) * 60 * 60 * 1000;
  return {
    startTime: new Date(centerTime.getTime() - halfDuration),
    endTime: new Date(centerTime.getTime() + halfDuration),
  };
}

/**
 * Helper to create a time window starting from a specific time
 *
 * @param startTime - Start of window
 * @param durationHours - Duration of window in hours (default: 3)
 * @returns TimeWindow object
 */
export function createTimeWindow(
  startTime: Date,
  durationHours: number = 3
): TimeWindow {
  return {
    startTime,
    endTime: new Date(startTime.getTime() + durationHours * 60 * 60 * 1000),
  };
}

/**
 * Get current time window (centered on now)
 *
 * @param durationHours - Duration of window in hours (default: 3)
 * @returns TimeWindow centered on current time
 */
export function getCurrentTimeWindow(durationHours: number = 3): TimeWindow {
  return createCenteredTimeWindow(new Date(), durationHours);
}

/**
 * Get tonight's prime time window (7 PM - 10 PM)
 *
 * @returns TimeWindow for tonight's prime time
 */
export function getTonightTimeWindow(): TimeWindow {
  const today = new Date();
  today.setHours(19, 0, 0, 0); // 7:00 PM

  const endTime = new Date(today);
  endTime.setHours(22, 0, 0, 0); // 10:00 PM

  return {
    startTime: today,
    endTime,
  };
}

/**
 * Get tomorrow morning window (6 AM - 12 PM)
 *
 * @returns TimeWindow for tomorrow morning
 */
export function getTomorrowTimeWindow(): TimeWindow {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 0, 0, 0); // 6:00 AM

  const endTime = new Date(tomorrow);
  endTime.setHours(12, 0, 0, 0); // 12:00 PM

  return {
    startTime: tomorrow,
    endTime,
  };
}

/**
 * Shift time window by a number of days
 *
 * @param window - Current time window
 * @param days - Number of days to shift (positive = forward, negative = backward)
 * @returns New TimeWindow shifted by specified days
 */
export function shiftTimeWindow(window: TimeWindow, days: number): TimeWindow {
  const dayMs = 24 * 60 * 60 * 1000;
  return {
    startTime: new Date(window.startTime.getTime() + days * dayMs),
    endTime: new Date(window.endTime.getTime() + days * dayMs),
  };
}

/**
 * Check if a program is currently airing
 *
 * @param program - Program to check
 * @param now - Current time (default: new Date())
 * @returns True if program is currently airing
 */
export function isProgramCurrentlyAiring(
  program: EpgGridProgram,
  now: Date = new Date()
): boolean {
  const startTime = new Date(program.startTime);
  const endTime = new Date(program.endTime);
  return startTime <= now && endTime > now;
}

/**
 * Calculate program duration in minutes
 *
 * @param program - Program to calculate duration for
 * @returns Duration in minutes
 */
export function getProgramDurationMinutes(program: EpgGridProgram): number {
  const startTime = new Date(program.startTime);
  const endTime = new Date(program.endTime);
  return (endTime.getTime() - startTime.getTime()) / (60 * 1000);
}

/**
 * Calculate number of 30-minute slots a program spans
 *
 * @param program - Program to calculate slots for
 * @returns Number of 30-minute slots
 */
export function getProgramSlotCount(program: EpgGridProgram): number {
  const durationMinutes = getProgramDurationMinutes(program);
  return Math.ceil(durationMinutes / 30);
}
