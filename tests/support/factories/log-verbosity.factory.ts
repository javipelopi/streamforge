import { faker } from '@faker-js/faker';

/**
 * Log Verbosity Factories
 *
 * Factory functions for creating log verbosity test data.
 * Used in Story 6-3 log verbosity tests.
 */

export type LogVerbosity = 'minimal' | 'verbose';

export interface LogVerbositySetting {
  verbosity: LogVerbosity;
}

/**
 * Create log verbosity setting
 *
 * @param overrides - Optional field overrides
 * @returns LogVerbositySetting object
 *
 * @example
 * const setting = createLogVerbositySetting({ verbosity: 'minimal' });
 */
export const createLogVerbositySetting = (
  overrides: Partial<LogVerbositySetting> = {}
): LogVerbositySetting => ({
  verbosity: overrides.verbosity || faker.helpers.arrayElement(['minimal', 'verbose']),
});

/**
 * Create minimal verbosity setting
 *
 * @returns LogVerbositySetting with minimal mode
 *
 * @example
 * const minimal = createMinimalVerbosity();
 */
export const createMinimalVerbosity = (): LogVerbositySetting => ({
  verbosity: 'minimal',
});

/**
 * Create verbose verbosity setting
 *
 * @returns LogVerbositySetting with verbose mode
 *
 * @example
 * const verbose = createVerboseVerbosity();
 */
export const createVerboseVerbosity = (): LogVerbositySetting => ({
  verbosity: 'verbose',
});

/**
 * Generate test scenarios for verbosity filtering
 *
 * @returns Array of test scenarios with expected outcomes
 *
 * @example
 * const scenarios = createVerbosityTestScenarios();
 */
export const createVerbosityTestScenarios = () => [
  {
    verbosity: 'minimal' as LogVerbosity,
    events: [
      { level: 'info', shouldLog: false },
      { level: 'warn', shouldLog: true },
      { level: 'error', shouldLog: true },
    ],
  },
  {
    verbosity: 'verbose' as LogVerbosity,
    events: [
      { level: 'info', shouldLog: true },
      { level: 'warn', shouldLog: true },
      { level: 'error', shouldLog: true },
    ],
  },
];
