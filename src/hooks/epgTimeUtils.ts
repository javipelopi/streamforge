/**
 * EPG Time Window Utilities
 *
 * Utility functions for working with time windows in the EPG.
 * Story 5.9: Extracted during legacy cleanup.
 */

/**
 * Time window for EPG display
 */
export interface TimeWindow {
  startTime: Date;
  endTime: Date;
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
