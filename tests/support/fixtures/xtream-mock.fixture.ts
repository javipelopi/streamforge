import { test as base, Page } from '@playwright/test';
import {
  createXtreamAuthResponse,
  createXtreamAuthFailure,
  createMalformedXtreamResponse,
  XtreamAuthResponse,
} from '../factories/xtream.factory';

/**
 * Xtream Mock Server Fixture
 *
 * Provides route interception for Xtream API endpoints with configurable responses.
 * Follows fixture architecture patterns:
 * - Isolated setup/teardown
 * - Composable with other fixtures
 * - Type-safe interface
 */

type ResponseType = 'success' | 'failure' | 'timeout' | 'malformed' | 'http-error';

interface XtreamMockServer {
  /**
   * Configure mock Xtream API to return specific response type
   */
  respondWith: (
    type: ResponseType,
    overrides?: {
      user_info?: Partial<XtreamAuthResponse['user_info']>;
      server_info?: Partial<XtreamAuthResponse['server_info']>;
    }
  ) => Promise<void>;

  /**
   * Configure mock to return custom response
   */
  respondWithCustom: (response: Record<string, unknown>) => Promise<void>;

  /**
   * Verify mock was called with expected credentials
   */
  getCapturedCredentials: () => { username: string | null; password: string | null };

  /**
   * Clear all route interceptions
   */
  clear: () => Promise<void>;
}

export const test = base.extend<{ mockXtreamServer: XtreamMockServer }>({
  mockXtreamServer: async ({ page }, use) => {
    let capturedUsername: string | null = null;
    let capturedPassword: string | null = null;
    let activeRoutes: Array<() => Promise<void>> = [];

    const mockServer: XtreamMockServer = {
      async respondWith(type, overrides = {}) {
        await page.route('**/player_api.php**', (route) => {
          // Capture credentials from request
          const url = new URL(route.request().url());
          capturedUsername = url.searchParams.get('username');
          capturedPassword = url.searchParams.get('password');

          switch (type) {
            case 'success': {
              const response = createXtreamAuthResponse(overrides);
              route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(response),
              });
              break;
            }

            case 'failure': {
              const response = createXtreamAuthFailure();
              route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(response),
              });
              break;
            }

            case 'timeout': {
              // Simulate timeout by delaying indefinitely
              // In real implementation, the client's timeout will fire
              setTimeout(() => {
                route.abort('timedout');
              }, 15000); // Beyond typical 10s timeout
              break;
            }

            case 'malformed': {
              const response = createMalformedXtreamResponse();
              route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(response),
              });
              break;
            }

            case 'http-error': {
              route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Internal Server Error' }),
              });
              break;
            }
          }
        });

        activeRoutes.push(async () => {
          await page.unroute('**/player_api.php**');
        });
      },

      async respondWithCustom(response) {
        await page.route('**/player_api.php**', (route) => {
          const url = new URL(route.request().url());
          capturedUsername = url.searchParams.get('username');
          capturedPassword = url.searchParams.get('password');

          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response),
          });
        });

        activeRoutes.push(async () => {
          await page.unroute('**/player_api.php**');
        });
      },

      getCapturedCredentials() {
        return { username: capturedUsername, password: capturedPassword };
      },

      async clear() {
        for (const clearRoute of activeRoutes) {
          await clearRoute();
        }
        activeRoutes = [];
        capturedUsername = null;
        capturedPassword = null;
      },
    };

    // Provide mock server to test
    await use(mockServer);

    // Cleanup: Clear all routes
    await mockServer.clear();
  },
});

export { expect } from '@playwright/test';
