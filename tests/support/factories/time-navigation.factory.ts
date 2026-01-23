import { faker } from '@faker-js/faker';

/**
 * Time Navigation Factory
 *
 * Creates test data for time navigation controls and time windows.
 * Follows data-factories.md patterns with faker for randomization.
 */

export type TimeWindow = {
  startTime: Date;
  endTime: Date;
  durationHours: number;
};

/**
 * Create a time window with start/end times
 * @param overrides - Partial TimeWindow to override defaults
 * @returns Complete time window object
 */
export const createTimeWindow = (
  overrides: Partial<TimeWindow> & { startTime?: Date; durationHours?: number } = {}
): TimeWindow => {
  const durationHours = overrides.durationHours || 3;
  const startTime = overrides.startTime || new Date();
  const endTime =
    overrides.endTime || new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

  return {
    startTime,
    endTime,
    durationHours,
    ...overrides,
  };
};

/**
 * Create time window centered on current time
 * Default: 1.5 hours before and after current time (3 hours total)
 * @param durationHours - Total duration of window (default: 3)
 * @returns Time window centered on now
 */
export const getCurrentTimeWindow = (durationHours: number = 3): TimeWindow => {
  const now = new Date();
  const halfDuration = (durationHours / 2) * 60 * 60 * 1000;

  const startTime = new Date(now.getTime() - halfDuration);
  const endTime = new Date(now.getTime() + halfDuration);

  return {
    startTime,
    endTime,
    durationHours,
  };
};

/**
 * Create time window for tonight (7 PM - 10 PM prime time)
 * @returns Time window for tonight's prime time
 */
export const getTonightTimeWindow = (): TimeWindow => {
  const today = new Date();
  today.setHours(19, 0, 0, 0); // 7:00 PM

  const endTime = new Date(today);
  endTime.setHours(22, 0, 0, 0); // 10:00 PM

  return {
    startTime: today,
    endTime,
    durationHours: 3,
  };
};

/**
 * Create time window for tomorrow morning (6 AM - 12 PM)
 * @returns Time window for tomorrow morning
 */
export const getTomorrowTimeWindow = (): TimeWindow => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 0, 0, 0); // 6:00 AM

  const endTime = new Date(tomorrow);
  endTime.setHours(12, 0, 0, 0); // 12:00 PM

  return {
    startTime: tomorrow,
    endTime,
    durationHours: 6,
  };
};

/**
 * Create time window for a specific day offset from today
 * @param dayOffset - Number of days from today (positive = future, negative = past)
 * @param startHour - Starting hour (default: 6 AM)
 * @param durationHours - Duration in hours (default: 6)
 * @returns Time window for the specified day
 */
export const getTimeWindowForDay = (
  dayOffset: number,
  startHour: number = 6,
  durationHours: number = 6
): TimeWindow => {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + dayOffset);
  targetDate.setHours(startHour, 0, 0, 0);

  const endTime = new Date(targetDate.getTime() + durationHours * 60 * 60 * 1000);

  return {
    startTime: targetDate,
    endTime,
    durationHours,
  };
};

/**
 * Create random time window within the next 7 days
 * @param durationHours - Duration in hours (default: random 2-6 hours)
 * @returns Random time window within valid range
 */
export const createRandomTimeWindow = (durationHours?: number): TimeWindow => {
  const duration = durationHours || faker.number.int({ min: 2, max: 6 });

  // Random day within next 7 days
  const dayOffset = faker.number.int({ min: 0, max: 7 });

  // Random start hour
  const startHour = faker.number.int({ min: 0, max: 23 });

  return getTimeWindowForDay(dayOffset, startHour, duration);
};
