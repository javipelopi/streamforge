/**
 * Data Factory: Setting
 * Story: 1-2 - Set Up SQLite Database with Diesel ORM
 *
 * Factory pattern for generating test Setting data
 * Uses faker for unique, random data to prevent collisions in parallel tests
 */

import { faker } from '@faker-js/faker';

export interface Setting {
  key: string;
  value: string;
}

/**
 * Create a single Setting with optional overrides
 * Uses faker to generate unique keys to avoid collisions
 *
 * @param overrides - Partial Setting to override defaults
 * @returns Complete Setting object
 *
 * @example
 * // Create random setting
 * const setting = createSetting();
 *
 * @example
 * // Create specific setting
 * const serverPort = createSetting({ key: 'server_port', value: '5004' });
 */
export const createSetting = (overrides: Partial<Setting> = {}): Setting => ({
  key: faker.string.alphanumeric(16),
  value: faker.string.alphanumeric(32),
  ...overrides,
});

/**
 * Create multiple Settings
 *
 * @param count - Number of settings to create
 * @returns Array of Setting objects
 *
 * @example
 * const settings = createSettings(5); // Generate 5 random settings
 */
export const createSettings = (count: number): Setting[] =>
  Array.from({ length: count }, () => createSetting());

/**
 * Create default app settings
 * Matches the initial settings inserted by the migration
 *
 * @returns Array of default Setting objects
 */
export const createDefaultSettings = (): Setting[] => [
  createSetting({ key: 'server_port', value: '5004' }),
  createSetting({ key: 'auto_start', value: 'false' }),
];
