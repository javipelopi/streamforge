import { faker } from '@faker-js/faker';

/**
 * Xtream API Response Factories
 *
 * Generates mock Xtream Codes API responses for testing.
 * Follows data factory best practices:
 * - All data is randomly generated using faker
 * - Supports overrides for specific test scenarios
 * - Generates complete valid objects matching Xtream API structure
 */

export interface XtreamUserInfo {
  username: string;
  password?: string;
  message?: string;
  auth: number; // 1 = authenticated, 0 = failed
  status?: string; // 'Active', 'Banned', 'Disabled', 'Expired'
  exp_date?: string; // Unix timestamp as string
  is_trial?: string; // '1' or '0'
  active_cons?: string; // Active connections as string
  created_at?: string; // Unix timestamp as string
  max_connections?: string; // Number as string
  allowed_output_formats?: string[];
}

export interface XtreamServerInfo {
  url?: string;
  port?: string;
  https_port?: string;
  server_protocol?: string;
  rtmp_port?: string;
  timestamp_now?: number;
  time_now?: string;
  timezone?: string;
}

export interface XtreamAuthResponse {
  user_info: XtreamUserInfo;
  server_info?: XtreamServerInfo;
}

/**
 * Create a successful Xtream user info response
 */
export const createXtreamUserInfo = (overrides: Partial<XtreamUserInfo> = {}): XtreamUserInfo => {
  const expDate = faker.date.future();
  const unixTimestamp = Math.floor(expDate.getTime() / 1000).toString();

  return {
    username: faker.internet.username(),
    password: faker.internet.password({ length: 16, memorable: false }),
    message: '',
    auth: 1, // Success by default
    status: 'Active',
    exp_date: unixTimestamp,
    is_trial: '0',
    active_cons: '0',
    created_at: Math.floor(faker.date.past().getTime() / 1000).toString(),
    max_connections: faker.number.int({ min: 1, max: 5 }).toString(),
    allowed_output_formats: ['m3u8', 'ts'],
    ...overrides,
  };
};

/**
 * Create Xtream server info
 */
export const createXtreamServerInfo = (overrides: Partial<XtreamServerInfo> = {}): XtreamServerInfo => {
  const domain = faker.internet.domainName();
  const port = faker.number.int({ min: 8000, max: 9000 }).toString();

  return {
    url: `http://${domain}`,
    port,
    https_port: '443',
    server_protocol: 'http',
    rtmp_port: '1935',
    timestamp_now: Math.floor(Date.now() / 1000),
    time_now: new Date().toISOString().replace('T', ' ').substring(0, 19),
    timezone: 'UTC',
    ...overrides,
  };
};

/**
 * Create a successful Xtream authentication response
 */
export const createXtreamAuthResponse = (
  overrides: {
    user_info?: Partial<XtreamUserInfo>;
    server_info?: Partial<XtreamServerInfo>;
  } = {}
): XtreamAuthResponse => {
  return {
    user_info: createXtreamUserInfo(overrides.user_info),
    server_info: createXtreamServerInfo(overrides.server_info),
  };
};

/**
 * Create a failed Xtream authentication response (auth: 0)
 */
export const createXtreamAuthFailure = (message = 'Invalid credentials'): XtreamAuthResponse => {
  return {
    user_info: {
      username: faker.internet.username(),
      auth: 0,
      message,
    },
  };
};

/**
 * Create an expired account response
 */
export const createXtreamExpiredAccount = (): XtreamAuthResponse => {
  const pastDate = faker.date.past({ years: 1 });
  const unixTimestamp = Math.floor(pastDate.getTime() / 1000).toString();

  return createXtreamAuthResponse({
    user_info: {
      status: 'Expired',
      exp_date: unixTimestamp,
    },
  });
};

/**
 * Create a banned account response
 */
export const createXtreamBannedAccount = (): XtreamAuthResponse => {
  return createXtreamAuthResponse({
    user_info: {
      auth: 0,
      status: 'Banned',
      message: 'Account has been banned',
    },
  });
};

/**
 * Create a trial account response
 */
export const createXtreamTrialAccount = (): XtreamAuthResponse => {
  const trialExpiry = faker.date.soon({ days: 7 });
  const unixTimestamp = Math.floor(trialExpiry.getTime() / 1000).toString();

  return createXtreamAuthResponse({
    user_info: {
      status: 'Active',
      is_trial: '1',
      exp_date: unixTimestamp,
      max_connections: '1', // Trial accounts typically have 1 connection
    },
  });
};

/**
 * Create account with active connections
 */
export const createXtreamActiveConnections = (activeCount: number, maxCount: number): XtreamAuthResponse => {
  return createXtreamAuthResponse({
    user_info: {
      active_cons: activeCount.toString(),
      max_connections: maxCount.toString(),
    },
  });
};

/**
 * Create malformed Xtream response for error testing
 */
export const createMalformedXtreamResponse = (): Record<string, unknown> => {
  return {
    error: 'Unexpected error',
    data: null,
    // Missing user_info field - should trigger InvalidResponse error
  };
};

/**
 * Create Xtream response with missing optional fields
 */
export const createMinimalXtreamResponse = (): XtreamAuthResponse => {
  return {
    user_info: {
      username: faker.internet.username(),
      auth: 1,
      // All optional fields omitted - tests default handling
    },
  };
};

/**
 * Helper to create response with specific expiry date
 */
export const createXtreamWithExpiry = (expiryDate: Date): XtreamAuthResponse => {
  const unixTimestamp = Math.floor(expiryDate.getTime() / 1000).toString();

  return createXtreamAuthResponse({
    user_info: {
      exp_date: unixTimestamp,
    },
  });
};

/**
 * Helper to create response for testing date parsing edge cases
 */
export const createXtreamWithInvalidExpiry = (): XtreamAuthResponse => {
  return createXtreamAuthResponse({
    user_info: {
      exp_date: 'invalid-timestamp', // Should be handled gracefully
    },
  });
};
