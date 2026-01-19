import { faker } from '@faker-js/faker';

/**
 * Test Connection Response Factory
 *
 * Generates mock test_connection command responses for testing.
 * Matches the TestConnectionResponse type from the Tauri backend.
 */

export interface TestConnectionResponse {
  success: boolean;
  status?: string;
  expiryDate?: string; // ISO 8601 format
  maxConnections?: number;
  activeConnections?: number;
  errorMessage?: string;
  suggestions?: string[];
}

/**
 * Create a successful test connection response
 */
export const createTestConnectionSuccess = (
  overrides: Partial<TestConnectionResponse> = {}
): TestConnectionResponse => {
  const expiryDate = faker.date.future();

  return {
    success: true,
    status: 'Active',
    expiryDate: expiryDate.toISOString(),
    maxConnections: faker.number.int({ min: 1, max: 5 }),
    activeConnections: 0,
    errorMessage: undefined,
    suggestions: undefined,
    ...overrides,
  };
};

/**
 * Create a failed test connection response
 */
export const createTestConnectionFailure = (
  errorType: 'network' | 'authentication' | 'timeout' | 'invalid-response' | 'http-error' = 'authentication',
  overrides: Partial<TestConnectionResponse> = {}
): TestConnectionResponse => {
  const errorMessages = {
    network: 'Cannot connect to server. Check your internet connection.',
    authentication: 'Invalid username or password.',
    timeout: 'Connection timed out. Server may be offline or unreachable.',
    'invalid-response': 'Server returned unexpected data format.',
    'http-error': 'Server returned error (HTTP 500)',
  };

  const suggestionsByType = {
    network: [
      'Check your internet connection',
      'Verify the server URL is correct',
      'The server may be temporarily down',
    ],
    authentication: [
      'Double-check your username and password',
      'Ensure your subscription is active',
      'Contact your provider if issues persist',
    ],
    timeout: [
      'Check your internet connection',
      'Verify the server URL is correct',
      'The server may be temporarily down',
    ],
    'invalid-response': [
      'The server may not be an Xtream Codes server',
      'Verify the server URL',
    ],
    'http-error': [
      'Server is experiencing issues',
      'Try again later',
    ],
  };

  return {
    success: false,
    status: undefined,
    expiryDate: undefined,
    maxConnections: undefined,
    activeConnections: undefined,
    errorMessage: errorMessages[errorType],
    suggestions: suggestionsByType[errorType],
    ...overrides,
  };
};

/**
 * Create test connection response (generic builder)
 */
export const createTestConnectionResponse = (
  overrides: Partial<TestConnectionResponse> = {}
): TestConnectionResponse => {
  return {
    success: faker.datatype.boolean(),
    status: faker.helpers.arrayElement(['Active', 'Expired', 'Banned', undefined]),
    expiryDate: faker.date.future().toISOString(),
    maxConnections: faker.number.int({ min: 1, max: 5 }),
    activeConnections: faker.number.int({ min: 0, max: 3 }),
    errorMessage: undefined,
    suggestions: undefined,
    ...overrides,
  };
};

/**
 * Create response for expired account
 */
export const createTestConnectionExpired = (): TestConnectionResponse => {
  const pastDate = faker.date.past({ years: 1 });

  return createTestConnectionSuccess({
    status: 'Expired',
    expiryDate: pastDate.toISOString(),
  });
};

/**
 * Create response with active connections
 */
export const createTestConnectionWithActiveConnections = (
  active: number,
  max: number
): TestConnectionResponse => {
  return createTestConnectionSuccess({
    activeConnections: active,
    maxConnections: max,
  });
};

/**
 * Create response for banned account
 */
export const createTestConnectionBanned = (): TestConnectionResponse => {
  return createTestConnectionFailure('authentication', {
    errorMessage: 'Account has been banned.',
    suggestions: [
      'Contact your service provider',
      'Your account may have violated terms of service',
    ],
  });
};

/**
 * Create response for server unavailable
 */
export const createTestConnectionServerDown = (): TestConnectionResponse => {
  return createTestConnectionFailure('timeout', {
    errorMessage: 'Server is not responding.',
    suggestions: [
      'The server may be temporarily offline',
      'Check server status with your provider',
      'Try again in a few minutes',
    ],
  });
};

/**
 * Create response with custom error
 */
export const createTestConnectionCustomError = (
  message: string,
  suggestions: string[]
): TestConnectionResponse => {
  return {
    success: false,
    status: undefined,
    expiryDate: undefined,
    maxConnections: undefined,
    activeConnections: undefined,
    errorMessage: message,
    suggestions,
  };
};
