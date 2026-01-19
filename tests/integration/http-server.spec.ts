import { test, expect } from '@playwright/test';

/**
 * Integration Tests: Axum HTTP Server Foundation
 * Story 1-5: Create Axum HTTP Server Foundation
 *
 * These tests verify the embedded Axum HTTP server runs correctly
 * and exposes the health check endpoint on localhost.
 *
 * RED PHASE: These tests will FAIL until the server is implemented.
 */

test.describe('HTTP Server - Health Check Endpoint', () => {
  const DEFAULT_PORT = 5004;
  const BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

  test('should have HTTP server running on configured port', async ({ request }) => {
    // GIVEN: Application has started
    // (Assuming Tauri app is running via webServer config)

    // WHEN: Making a request to verify server is running
    // THEN: Server should be accessible on default port 5004
    try {
      const response = await request.get(`${BASE_URL}/health`);
      expect(response.ok()).toBe(true);
    } catch (error) {
      throw new Error(
        `HTTP server is not running on ${BASE_URL}. ` +
          `Expected server to be accessible but got: ${error}`
      );
    }
  });

  test('should respond to /health endpoint with 200 OK', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Requesting the health check endpoint
    const response = await request.get(`${BASE_URL}/health`);

    // THEN: Server returns 200 OK status
    expect(response.status()).toBe(200);
  });

  test('should return JSON response from /health endpoint', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Requesting the health check endpoint
    const response = await request.get(`${BASE_URL}/health`);

    // THEN: Response should be valid JSON
    expect(response.headers()['content-type']).toContain('application/json');

    // AND: Response body should contain health status
    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body.status).toBe('healthy');
  });

  test('should only bind to localhost (127.0.0.1)', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Attempting to access via localhost
    const localhostResponse = await request.get(`http://127.0.0.1:${DEFAULT_PORT}/health`);

    // THEN: Request succeeds
    expect(localhostResponse.status()).toBe(200);

    // NOTE: Testing external IP binding requires network setup
    // This test verifies localhost works. Security test for external blocking
    // would require additional infrastructure (Docker network, etc.)
    // For now, we rely on manual verification that server config binds to 127.0.0.1
  });

  test('should return 404 for unknown routes', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Requesting a non-existent endpoint
    const response = await request.get(`${BASE_URL}/nonexistent`);

    // THEN: Server returns 404 Not Found
    expect(response.status()).toBe(404);
  });
});

test.describe('HTTP Server - Initialization', () => {
  const DEFAULT_PORT = 5004;
  const BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

  test('should start automatically when application launches', async ({ request }) => {
    // GIVEN: Tauri application has been launched (via webServer config)

    // WHEN: Application initialization completes
    // THEN: HTTP server should be accessible immediately
    const response = await request.get(`${BASE_URL}/health`);

    expect(response.ok()).toBe(true);
    // Server must be running - if this fails, server didn't start on app launch
  });

  test('should run on Tokio async runtime without blocking', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Making multiple concurrent requests
    const requests = Array.from({ length: 5 }, () =>
      request.get(`${BASE_URL}/health`)
    );

    const responses = await Promise.all(requests);

    // THEN: All requests succeed (server handles concurrency)
    responses.forEach((response) => {
      expect(response.status()).toBe(200);
    });

    // AND: Server responds quickly (not blocking)
    // If server was blocking, these concurrent requests would timeout
  });
});

test.describe('HTTP Server - Port Configuration', () => {
  test('should use default port 5004', async ({ request }) => {
    // GIVEN: Application starts with no custom port configuration

    // WHEN: Checking which port server is running on
    const response = await request.get('http://127.0.0.1:5004/health');

    // THEN: Server responds on default port 5004
    expect(response.status()).toBe(200);
  });

  test.skip('should read port from settings table', async () => {
    // TODO: This test requires database query capability
    // Will be implemented when settings CRUD is available

    // GIVEN: Database settings table contains server_port setting
    // WHEN: Server starts
    // THEN: Server uses port from settings (default 5004)

    // For now: Manual verification that port is read from DB
    // Future: Add database fixture to verify port configuration
  });

  test.skip('should allow port configuration via settings', async () => {
    // TODO: This test requires settings update capability
    // Will be implemented when set_server_port Tauri command exists

    // GIVEN: Server is running on default port
    // WHEN: User updates server_port setting to 5005
    // AND: Application restarts
    // THEN: Server runs on new port 5005

    // Note: This requires app restart testing infrastructure
  });
});

/**
 * IMPLEMENTATION NOTES:
 *
 * Expected Failures (RED Phase):
 * - All tests will fail with connection refused errors
 * - /health endpoint returns 404 or connection timeout
 * - Server not starting on application launch
 *
 * Expected Behavior After Implementation (GREEN Phase):
 * - Server starts automatically in Tauri setup
 * - /health endpoint returns {"status": "healthy"}
 * - Server binds to 127.0.0.1:5004 only
 * - Concurrent requests handled properly
 *
 * Test Execution:
 * npm run test:integration -- http-server.spec.ts
 */
