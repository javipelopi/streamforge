import { faker } from '@faker-js/faker';

/**
 * Data Factory for Settings
 *
 * Generates test data for application settings including server configuration,
 * startup options, and EPG refresh schedules.
 *
 * Uses faker for random data generation to avoid test collisions.
 */

export interface ServerSettings {
  port: number;
}

export interface StartupSettings {
  autoStart: boolean;
}

export interface EpgSettings {
  refreshTime: string; // HH:MM format
}

export interface AppSettings {
  server: ServerSettings;
  startup: StartupSettings;
  epg: EpgSettings;
}

/**
 * Create server settings with optional overrides
 */
export const createServerSettings = (overrides: Partial<ServerSettings> = {}): ServerSettings => ({
  port: faker.number.int({ min: 5000, max: 5999 }),
  ...overrides,
});

/**
 * Create startup settings with optional overrides
 */
export const createStartupSettings = (overrides: Partial<StartupSettings> = {}): StartupSettings => ({
  autoStart: faker.datatype.boolean(),
  ...overrides,
});

/**
 * Create EPG settings with optional overrides
 */
export const createEpgSettings = (overrides: Partial<EpgSettings> = {}): EpgSettings => {
  const hour = faker.number.int({ min: 0, max: 23 });
  const minute = faker.number.int({ min: 0, max: 59 });
  const defaultTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

  return {
    refreshTime: defaultTime,
    ...overrides,
  };
};

/**
 * Create complete application settings with optional overrides
 */
export const createAppSettings = (overrides: Partial<AppSettings> = {}): AppSettings => ({
  server: createServerSettings(overrides.server),
  startup: createStartupSettings(overrides.startup),
  epg: createEpgSettings(overrides.epg),
});

/**
 * Create settings with default values (matching app defaults)
 */
export const createDefaultSettings = (): AppSettings => ({
  server: { port: 5004 },
  startup: { autoStart: false },
  epg: { refreshTime: '03:00' },
});

/**
 * Create settings with auto-start enabled
 */
export const createSettingsWithAutoStart = (): AppSettings => ({
  ...createDefaultSettings(),
  startup: { autoStart: true },
});

/**
 * Create settings with custom port
 */
export const createSettingsWithCustomPort = (port: number): AppSettings => ({
  ...createDefaultSettings(),
  server: { port },
});

/**
 * Create settings with custom EPG refresh time
 */
export const createSettingsWithCustomEpgTime = (refreshTime: string): AppSettings => ({
  ...createDefaultSettings(),
  epg: { refreshTime },
});

/**
 * Generate random valid port number
 */
export const generateValidPort = (): number => faker.number.int({ min: 1, max: 65535 });

/**
 * Generate random invalid port number (for validation testing)
 */
export const generateInvalidPort = (): number => {
  const options = [
    0,
    -1,
    65536,
    faker.number.int({ min: 65536, max: 99999 }),
  ];
  return faker.helpers.arrayElement(options);
};

/**
 * Generate random time in HH:MM format
 */
export const generateRandomTime = (): string => {
  const hour = faker.number.int({ min: 0, max: 23 });
  const minute = faker.number.int({ min: 0, max: 59 });
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
};

/**
 * Generate invalid time format (for validation testing)
 */
export const generateInvalidTime = (): string => {
  const invalidFormats = [
    '25:00', // Invalid hour
    '12:60', // Invalid minute
    '1:30',  // Missing leading zero
    '12:5',  // Missing leading zero
    'abc',   // Non-numeric
    '',      // Empty
  ];
  return faker.helpers.arrayElement(invalidFormats);
};
