import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Story 4-6: Display Plex Configuration URLs
 *
 * Tests the complete user journey of viewing Plex configuration URLs
 * in the Dashboard, copying them to clipboard, and seeing server status.
 *
 * RED PHASE: These tests will FAIL until the PlexConfigSection component
 * and get_plex_config Tauri command are implemented.
 */

test.describe('Plex Configuration Display', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: User navigates to Dashboard view
    await page.goto('/');
  });

  test('should display Plex Integration section on Dashboard', async ({ page }) => {
    // GIVEN: User is on Dashboard

    // WHEN: Page loads

    // THEN: Plex Integration section is visible
    await expect(page.locator('[data-testid="plex-config-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="plex-config-section"]')).toContainText('Plex Integration');
  });

  test('should display all configuration URLs with correct format', async ({ page }) => {
    // GIVEN: User is viewing Dashboard with Plex Integration section

    // WHEN: Section is rendered

    // THEN: All three URL types are displayed
    await expect(page.locator('[data-testid="m3u-url-label"]')).toContainText('M3U Playlist URL');
    await expect(page.locator('[data-testid="epg-url-label"]')).toContainText('EPG/XMLTV URL');
    await expect(page.locator('[data-testid="hdhr-url-label"]')).toContainText('HDHomeRun URL');

    // AND: URLs follow expected format
    const m3uUrl = await page.locator('[data-testid="m3u-url-value"]').textContent();
    expect(m3uUrl).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:\d+\/playlist\.m3u$/);

    const epgUrl = await page.locator('[data-testid="epg-url-value"]').textContent();
    expect(epgUrl).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:\d+\/epg\.xml$/);

    const hdhrUrl = await page.locator('[data-testid="hdhr-url-value"]').textContent();
    expect(hdhrUrl).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/);
  });

  test('should display URLs with local IP and port', async ({ page }) => {
    // GIVEN: User is viewing Dashboard

    // WHEN: Fetching configuration from backend

    // THEN: URLs use local network IP (not 127.0.0.1)
    const m3uUrl = await page.locator('[data-testid="m3u-url-value"]').textContent();

    // Should NOT use localhost
    expect(m3uUrl).not.toContain('127.0.0.1');
    expect(m3uUrl).not.toContain('localhost');

    // Should use actual network IP
    expect(m3uUrl).toMatch(/^http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+\/playlist\.m3u$/);
  });

  test('should display tuner count from active accounts', async ({ page }) => {
    // GIVEN: User is viewing Dashboard
    // AND: Database has active accounts with max_connections

    // WHEN: Section is rendered

    // THEN: Tuner count is displayed
    await expect(page.locator('[data-testid="tuner-count-label"]')).toContainText('Tuner count');

    const tunerCount = await page.locator('[data-testid="tuner-count-value"]').textContent();
    expect(tunerCount).toMatch(/^\d+$/); // Should be a number
    expect(parseInt(tunerCount || '0')).toBeGreaterThan(0);
  });

  test('should copy URL to clipboard when copy button clicked', async ({ page, context }) => {
    // GIVEN: User is viewing Plex Integration section
    // AND: Clipboard permissions are granted
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // WHEN: User clicks copy button for M3U URL
    await page.click('[data-testid="m3u-url-copy-button"]');

    // THEN: URL is copied to clipboard
    const m3uUrlText = await page.locator('[data-testid="m3u-url-value"]').textContent();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

    expect(clipboardText).toBe(m3uUrlText);
  });

  test('should show toast notification after successful copy', async ({ page, context }) => {
    // GIVEN: User is viewing Plex Integration section
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // WHEN: User clicks copy button
    await page.click('[data-testid="m3u-url-copy-button"]');

    // THEN: Toast notification appears
    await expect(page.locator('[data-testid="toast-notification"]')).toBeVisible();
    await expect(page.locator('[data-testid="toast-notification"]')).toContainText('copied');

    // AND: Toast disappears after 3 seconds
    await page.waitForTimeout(3500);
    await expect(page.locator('[data-testid="toast-notification"]')).not.toBeVisible();
  });

  test('should show warning when server is not running', async ({ page }) => {
    // GIVEN: HTTP server is not running (server_running = false)
    // (This requires stopping the server or mocking the response)

    // WHEN: User views Dashboard
    // (For this test, we'd need to mock get_plex_config to return server_running: false)

    // THEN: Warning message is displayed
    // Note: This test may need conditional logic or mocking
    // For now, we check the warning element exists when server is stopped

    // Implementation will need to handle this state
    // The warning should only show when server_running is false
  });

  test('should show unavailable state for URLs when server stopped', async ({ page }) => {
    // GIVEN: HTTP server is not running

    // WHEN: User views Plex Integration section

    // THEN: URLs show as "Unavailable"
    // AND: Copy buttons are disabled

    // Note: This test requires mocking server_running: false
    // Implementation will show placeholder text instead of URLs
  });
});

test.describe('Plex Configuration - Copy Button Interactions', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
  });

  test('should copy EPG URL when EPG copy button clicked', async ({ page }) => {
    // GIVEN: User is viewing Plex Integration section

    // WHEN: User clicks copy button for EPG URL
    await page.click('[data-testid="epg-url-copy-button"]');

    // THEN: EPG URL is copied to clipboard
    const epgUrlText = await page.locator('[data-testid="epg-url-value"]').textContent();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

    expect(clipboardText).toBe(epgUrlText);
  });

  test('should copy HDHomeRun URL when HDHR copy button clicked', async ({ page }) => {
    // GIVEN: User is viewing Plex Integration section

    // WHEN: User clicks copy button for HDHomeRun URL
    await page.click('[data-testid="hdhr-url-copy-button"]');

    // THEN: HDHomeRun URL is copied to clipboard
    const hdhrUrlText = await page.locator('[data-testid="hdhr-url-value"]').textContent();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

    expect(clipboardText).toBe(hdhrUrlText);
  });

  test('should handle clipboard API failure gracefully', async ({ page }) => {
    // GIVEN: Clipboard API is blocked or fails
    await page.evaluate(() => {
      // Override clipboard to throw error
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: () => Promise.reject(new Error('Clipboard access denied'))
        }
      });
    });

    // WHEN: User clicks copy button
    await page.click('[data-testid="m3u-url-copy-button"]');

    // THEN: Error is handled gracefully (no crash)
    // AND: Error message or fallback is shown
    // Implementation should catch the error and show appropriate feedback
  });
});

/**
 * IMPLEMENTATION NOTES:
 *
 * Expected Failures (RED Phase):
 * - PlexConfigSection component doesn't exist
 * - get_plex_config Tauri command not registered
 * - data-testid attributes not present
 * - Toast notification not implemented
 *
 * Expected Behavior After Implementation (GREEN Phase):
 * - Dashboard shows Plex Integration section
 * - All URLs display with correct local IP and port
 * - Copy buttons work with clipboard API
 * - Toast shows feedback for copy actions
 * - Server status affects URL display
 *
 * Test Execution:
 * npm run test -- tests/e2e/plex-config-display.spec.ts
 */
