import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for IPTV Project
 *
 * Supports two test modes:
 * 1. UI/E2E tests - Use Vite dev server for frontend testing
 * 2. Integration tests - Use full Tauri app for HTTP server testing
 *
 * For HTTP server tests, the Tauri app must be running separately:
 *   pnpm dev (in another terminal)
 *
 * Or run tests with the Tauri app auto-started (slower but automated):
 *   TAURI_DEV=true pnpm test -- tests/integration/http-server.spec.ts
 */

const useTauriDev = process.env.TAURI_DEV === 'true';

export default defineConfig({
  testDir: './tests',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`.
    baseURL: 'http://localhost:1420', // Tauri default dev server port

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
  },

  // Configure projects for major browsers (for future UI tests)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Web server configuration
  // - Default: Start Vite dev server only (for frontend tests)
  // - TAURI_DEV=true: Start full Tauri app (for HTTP server integration tests)
  webServer: useTauriDev
    ? {
        command: 'pnpm dev',
        url: 'http://127.0.0.1:5004/health', // Wait for HTTP server to be ready
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000, // Tauri takes longer to start
        stdout: 'pipe',
        stderr: 'pipe',
      }
    : {
        command: 'pnpm dev:vite',
        url: 'http://localhost:1420',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
});
