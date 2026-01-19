/**
 * Autostart Setting Factory
 *
 * Factory for creating autostart setting objects for testing.
 *
 * Story 1.6: Add Auto-Start on Boot Capability
 *
 * This factory creates setting objects that match the database schema
 * for the settings table (key-value pairs).
 */

export interface AutostartSetting {
  key: string;
  value: string;
}

/**
 * Creates an autostart setting object with optional overrides
 *
 * @param overrides - Optional partial object to override defaults
 * @returns AutostartSetting object
 *
 * @example
 * // Create setting with autostart enabled
 * const setting = createAutostartSetting({ value: 'true' });
 *
 * @example
 * // Create setting with autostart disabled (default)
 * const setting = createAutostartSetting();
 */
export function createAutostartSetting(
  overrides: Partial<AutostartSetting> = {}
): AutostartSetting {
  return {
    key: 'autostart_enabled',
    value: 'false', // Default: autostart disabled
    ...overrides,
  };
}

/**
 * Helper to create an enabled autostart setting
 *
 * @returns AutostartSetting with value: 'true'
 *
 * @example
 * const setting = createEnabledAutostartSetting();
 * // Returns: { key: 'autostart_enabled', value: 'true' }
 */
export function createEnabledAutostartSetting(): AutostartSetting {
  return createAutostartSetting({ value: 'true' });
}

/**
 * Helper to create a disabled autostart setting
 *
 * @returns AutostartSetting with value: 'false'
 *
 * @example
 * const setting = createDisabledAutostartSetting();
 * // Returns: { key: 'autostart_enabled', value: 'false' }
 */
export function createDisabledAutostartSetting(): AutostartSetting {
  return createAutostartSetting({ value: 'false' });
}
