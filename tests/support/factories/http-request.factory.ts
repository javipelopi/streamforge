/**
 * HTTP Request Factory
 *
 * Factory functions for creating test HTTP request configurations.
 * Provides consistent request setup across integration tests.
 */

type RequestConfig = {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  timeout?: number;
};

const DEFAULT_PORT = 5004;
const BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

/**
 * Create a health check request configuration
 */
export const createHealthCheckRequest = (): RequestConfig => ({
  url: `${BASE_URL}/health`,
  method: 'GET',
  timeout: 5000,
});

/**
 * Create a generic server request with overrides
 *
 * @param overrides - Partial request config to override defaults
 */
export const createServerRequest = (
  overrides: Partial<RequestConfig> = {}
): RequestConfig => ({
  url: BASE_URL,
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000,
  ...overrides,
});

/**
 * Create a request to a specific endpoint
 *
 * @param endpoint - Endpoint path (e.g., '/health', '/playlist.m3u')
 * @param overrides - Additional request config
 */
export const createEndpointRequest = (
  endpoint: string,
  overrides: Partial<RequestConfig> = {}
): RequestConfig => ({
  ...createServerRequest(overrides),
  url: `${BASE_URL}${endpoint}`,
});
