import { test as base, APIRequestContext } from '@playwright/test';

/**
 * Server Fixture
 *
 * Provides utilities for testing the embedded Axum HTTP server.
 * Includes base URL configuration and health check utilities.
 */

type ServerFixtures = {
  serverBaseUrl: string;
  waitForServerReady: (request: APIRequestContext, timeoutMs?: number) => Promise<void>;
};

export const test = base.extend<ServerFixtures>({
  /**
   * Base URL for the HTTP server
   * Default: http://127.0.0.1:5004
   */
  serverBaseUrl: async ({}, use) => {
    const DEFAULT_PORT = process.env.SERVER_PORT || '5004';
    const baseUrl = `http://127.0.0.1:${DEFAULT_PORT}`;
    await use(baseUrl);
  },

  /**
   * Wait for server to be ready and responsive
   * Polls /health endpoint until successful response
   *
   * @param request - Playwright APIRequestContext
   * @param timeoutMs - Maximum time to wait (default: 30000ms)
   */
  waitForServerReady: async ({ serverBaseUrl }, use) => {
    const waitForServerReady = async (
      request: APIRequestContext,
      timeoutMs: number = 30000
    ): Promise<void> => {
      const startTime = Date.now();
      const pollInterval = 500; // Check every 500ms

      while (Date.now() - startTime < timeoutMs) {
        try {
          const response = await request.get(`${serverBaseUrl}/health`, {
            timeout: 1000,
          });

          if (response.ok()) {
            // Server is ready
            return;
          }
        } catch (error) {
          // Server not ready yet, continue polling
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      throw new Error(
        `Server did not become ready within ${timeoutMs}ms. ` +
          `Expected /health endpoint at ${serverBaseUrl} to respond.`
      );
    };

    await use(waitForServerReady);
  },
});

export { expect } from '@playwright/test';
