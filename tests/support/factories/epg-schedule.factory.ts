/**
 * Data Factory: EPG Schedule
 * Story: 2-6 - Implement Scheduled EPG Refresh
 *
 * Factory pattern for generating test EPG schedule data
 * Uses faker for unique, random data to prevent collisions in parallel tests
 */

import { faker } from '@faker-js/faker';

export interface EpgSchedule {
  hour: number;
  minute: number;
  enabled: boolean;
}

export interface EpgScheduleSettings {
  epg_refresh_hour: string;
  epg_refresh_minute: string;
  epg_refresh_enabled: string;
  epg_last_scheduled_refresh?: string;
}

/**
 * Create a single EPG schedule with optional overrides
 * Defaults to 4:00 AM enabled schedule
 *
 * @param overrides - Partial EpgSchedule to override defaults
 * @returns Complete EpgSchedule object
 *
 * @example
 * // Create default schedule (4:00 AM)
 * const schedule = createEpgSchedule();
 *
 * @example
 * // Create specific schedule (2:30 AM)
 * const schedule = createEpgSchedule({ hour: 2, minute: 30 });
 *
 * @example
 * // Create disabled schedule
 * const schedule = createEpgSchedule({ enabled: false });
 */
export const createEpgSchedule = (overrides: Partial<EpgSchedule> = {}): EpgSchedule => ({
  hour: faker.number.int({ min: 0, max: 23 }),
  minute: faker.helpers.arrayElement([0, 15, 30, 45]),
  enabled: true,
  ...overrides,
});

/**
 * Create default EPG schedule (4:00 AM enabled)
 * Matches the story's default configuration
 *
 * @returns Default EpgSchedule object
 */
export const createDefaultEpgSchedule = (): EpgSchedule => ({
  hour: 4,
  minute: 0,
  enabled: true,
});

/**
 * Convert EpgSchedule to database settings format
 * Settings table stores values as strings
 *
 * @param schedule - EpgSchedule object
 * @returns EpgScheduleSettings for database storage
 *
 * @example
 * const schedule = createEpgSchedule({ hour: 4, minute: 0, enabled: true });
 * const settings = scheduleToSettings(schedule);
 * // { epg_refresh_hour: '4', epg_refresh_minute: '0', epg_refresh_enabled: 'true' }
 */
export const scheduleToSettings = (schedule: EpgSchedule): Omit<EpgScheduleSettings, 'epg_last_scheduled_refresh'> => ({
  epg_refresh_hour: schedule.hour.toString(),
  epg_refresh_minute: schedule.minute.toString(),
  epg_refresh_enabled: schedule.enabled.toString(),
});

/**
 * Convert database settings to EpgSchedule format
 * Parses string values from database
 *
 * @param settings - EpgScheduleSettings from database
 * @returns EpgSchedule object
 */
export const settingsToSchedule = (settings: EpgScheduleSettings): EpgSchedule => ({
  hour: parseInt(settings.epg_refresh_hour, 10),
  minute: parseInt(settings.epg_refresh_minute, 10),
  enabled: settings.epg_refresh_enabled === 'true',
});

/**
 * Format schedule time for display
 * Returns human-readable time string
 *
 * @param schedule - EpgSchedule object
 * @returns Formatted time string (e.g., "04:00", "14:30")
 */
export const formatScheduleTime = (schedule: EpgSchedule): string => {
  const hour = schedule.hour.toString().padStart(2, '0');
  const minute = schedule.minute.toString().padStart(2, '0');
  return `${hour}:${minute}`;
};
