import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Rematch Notification UI (Story 3-4, AC5)
 *
 * Test Level: E2E (Full UI workflow)
 * Framework: Playwright Test
 * Focus: Notification badge, toast messages, user-facing feedback
 *
 * RED PHASE: These tests MUST fail initially (missing implementation)
 * Expected failures: UI components not implemented, enhanced scan response missing
 *
 * Run with: pnpm test -- tests/e2e/rematch-notification.spec.ts --headed
 */

test.describe('Rematch Notifications: Badge Display (AC5.5)', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: User navigates to app
    await page.goto('/');
  });

  test('AC5.5: should display notification badge when events occur', async ({ page }) => {
    // GIVEN: User is on main page
    // WHEN: No unread events exist initially
    const badge = page.locator('[data-testid="notification-badge"]');

    // THEN: Badge is not visible or shows 0
    await expect(badge).not.toBeVisible();
    // OR: await expect(badge).toHaveText('0');

    // WHEN: Provider changes trigger events
    // Simulate event creation (via backend or mock)
    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('log_event', {
      level: 'info',
      category: 'provider',
      message: 'Provider changes detected',
    });

    // THEN: Notification badge appears with count
    await expect(badge).toBeVisible();
    await expect(page.locator('[data-testid="badge-count"]')).toHaveText('1');

    // Expected failure: Error: Element [data-testid="notification-badge"] not found
  });

  test('should update badge count when multiple events occur', async ({ page }) => {
    // GIVEN: App is running
    const badge = page.locator('[data-testid="notification-badge"]');
    const badgeCount = page.locator('[data-testid="badge-count"]');

    // WHEN: Multiple events are logged
    for (let i = 1; i <= 3; i++) {
      // @ts-expect-error - Command does not exist yet (RED phase)
      await window.__TAURI__.invoke('log_event', {
        level: 'info',
        category: 'provider',
        message: `Event ${i}`,
      });

      // Wait for UI to update (TanStack Query refetch)
      await page.waitForTimeout(100);
    }

    // THEN: Badge shows accumulated count
    await expect(badge).toBeVisible();
    await expect(badgeCount).toHaveText('3');

    // Expected failure: Error: Element [data-testid="notification-badge"] not found
  });

  test('should clear badge when user visits Logs page', async ({ page }) => {
    // GIVEN: Unread events exist
    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('log_event', {
      level: 'info',
      category: 'provider',
      message: 'Test event',
    });

    await page.waitForTimeout(100);

    const badge = page.locator('[data-testid="notification-badge"]');
    await expect(badge).toBeVisible();

    // WHEN: User clicks Logs nav item
    await page.click('[data-testid="logs-nav-item"]');

    // THEN: Badge disappears or shows 0
    await expect(page).toHaveURL(/\/logs/);
    await expect(badge).not.toBeVisible();
    // OR: await expect(badge).toHaveText('0');

    // Expected failure: Error: Element [data-testid="logs-nav-item"] not found
  });

  test('should show badge on sidebar Logs navigation item', async ({ page }) => {
    // GIVEN: Sidebar is visible
    const logsNavItem = page.locator('[data-testid="logs-nav-item"]');
    await expect(logsNavItem).toBeVisible();

    // WHEN: Event is logged
    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('log_event', {
      level: 'warn',
      category: 'provider',
      message: 'Provider issue detected',
    });

    await page.waitForTimeout(100);

    // THEN: Badge appears within or near Logs nav item
    const badge = logsNavItem.locator('[data-testid="notification-badge"]');
    await expect(badge).toBeVisible();

    // Expected failure: Error: Element [data-testid="notification-badge"] not found within logs-nav-item
  });
});

test.describe('Rematch Notifications: Scan Toast (AC5.6)', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: User has an account configured
    await page.goto('/accounts');

    // Mock Xtream API for scan
    await page.route('**/player_api.php*action=get_live_streams*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            num: 1,
            name: 'Test Channel HD',
            stream_id: 1001,
            stream_icon: 'http://test.com/icon.png',
            epg_channel_id: 'test.us',
            category_id: '1',
            tv_archive: 0,
          },
        ]),
      });
    });

    await page.route('**/player_api.php*action=get_live_categories*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            category_id: '1',
            category_name: 'Entertainment',
            parent_id: 0,
          },
        ]),
      });
    });
  });

  test('AC5.6: should show change summary in scan toast', async ({ page }) => {
    // GIVEN: Account exists
    // Assume account is already configured or add one here

    // WHEN: User scans channels
    const scanButton = page.locator('[data-testid="scan-channels-button"]');
    await scanButton.click();

    // Wait for scan to complete
    const toast = page.locator('[data-testid="scan-result-toast"]');
    await expect(toast).toBeVisible({ timeout: 10000 });

    // THEN: Toast shows enhanced summary
    const changeSummary = page.locator('[data-testid="change-summary-text"]');
    await expect(changeSummary).toBeVisible();

    // Expected format: "Scanned X channels. Y new matches, Z removed, W updated."
    const summaryText = await changeSummary.textContent();
    expect(summaryText).toMatch(/Scanned \d+ channels/);
    expect(summaryText).toMatch(/\d+ new matches?/);
    expect(summaryText).toMatch(/\d+ removed/);
    expect(summaryText).toMatch(/\d+ updated/);

    // Expected failure: Error: Enhanced scan response not implemented
  });

  test('should show breakdown of provider changes', async ({ page }) => {
    // GIVEN: Provider scan detects changes
    // WHEN: Scan completes
    const scanButton = page.locator('[data-testid="scan-channels-button"]');
    await scanButton.click();

    const toast = page.locator('[data-testid="scan-result-toast"]');
    await expect(toast).toBeVisible({ timeout: 10000 });

    // THEN: Change details are visible
    const changeSummary = page.locator('[data-testid="change-summary-text"]');
    const summaryText = await changeSummary.textContent();

    // Verify numeric values are present
    expect(summaryText).toBeTruthy();
    expect(summaryText).toMatch(/\d+/); // Contains at least one number

    // Expected failure: Error: Element [data-testid="change-summary-text"] not found
  });

  test('should distinguish between new channels and new matches', async ({ page }) => {
    // GIVEN: Scan returns new streams and creates new matches
    // WHEN: Scan completes
    const scanButton = page.locator('[data-testid="scan-channels-button"]');
    await scanButton.click();

    const toast = page.locator('[data-testid="scan-result-toast"]');
    await expect(toast).toBeVisible({ timeout: 10000 });

    // THEN: Toast shows both channel count and match count
    const changeSummary = page.locator('[data-testid="change-summary-text"]');
    const summaryText = await changeSummary.textContent();

    // Format should mention both:
    // - Total channels scanned (raw provider data)
    // - New matches created (XMLTV channel mappings)
    expect(summaryText).toMatch(/Scanned \d+ channels/);
    expect(summaryText).toMatch(/\d+ new matches?/);

    // Expected failure: Error: Enhanced scan response not implemented
  });

  test('should handle scan with no changes gracefully', async ({ page }) => {
    // GIVEN: Re-scanning same provider (no changes)
    // First scan
    await page.locator('[data-testid="scan-channels-button"]').click();
    await page.locator('[data-testid="scan-result-toast"]').waitFor({ state: 'visible' });

    // Wait for toast to disappear
    await page.waitForTimeout(3000);

    // WHEN: Second scan (no changes expected)
    await page.locator('[data-testid="scan-channels-button"]').click();

    const toast = page.locator('[data-testid="scan-result-toast"]');
    await expect(toast).toBeVisible({ timeout: 10000 });

    // THEN: Toast shows "0 new, 0 removed, 0 updated"
    const changeSummary = page.locator('[data-testid="change-summary-text"]');
    const summaryText = await changeSummary.textContent();

    expect(summaryText).toMatch(/0 new matches?/);
    expect(summaryText).toMatch(/0 removed/);

    // Expected failure: Error: Element [data-testid="change-summary-text"] not found
  });
});

test.describe('Rematch Notifications: Event Log View', () => {
  test('should display provider change events in Logs view', async ({ page }) => {
    // GIVEN: Provider change events exist
    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('log_event', {
      level: 'info',
      category: 'provider',
      message: 'Provider changes detected: 5 new, 2 removed, 1 changed',
      details: JSON.stringify({
        newStreams: 5,
        removedStreams: 2,
        changedStreams: 1,
      }),
    });

    // WHEN: User navigates to Logs view
    await page.goto('/logs');

    // THEN: Events are displayed
    const eventList = page.locator('[data-testid="event-list"]');
    await expect(eventList).toBeVisible();

    const eventItem = page.locator('[data-testid*="event-item"]').first();
    await expect(eventItem).toBeVisible();

    // Verify event details
    const eventMessage = eventItem.locator('[data-testid="event-message"]');
    await expect(eventMessage).toContainText('Provider changes detected');

    const eventLevel = eventItem.locator('[data-testid="event-level-info"]');
    await expect(eventLevel).toBeVisible();

    // Expected failure: Error: Element [data-testid="event-list"] not found
  });

  test('should show event details on expand/click', async ({ page }) => {
    // GIVEN: Event with details exists
    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('log_event', {
      level: 'info',
      category: 'provider',
      message: 'Provider update',
      details: JSON.stringify({
        newStreams: 10,
        removedStreams: 5,
        affectedChannels: ['ESPN', 'CNN', 'Fox News'],
      }),
    });

    await page.goto('/logs');

    // WHEN: User clicks event item
    const eventItem = page.locator('[data-testid*="event-item"]').first();
    await eventItem.click();

    // THEN: Event details are expanded/visible
    const eventDetails = page.locator('[data-testid="event-details"]');
    await expect(eventDetails).toBeVisible();

    // Details should show JSON content
    await expect(eventDetails).toContainText('newStreams');
    await expect(eventDetails).toContainText('10');

    // Expected failure: Error: Element [data-testid="event-details"] not found
  });
});
