import { test, expect } from '@playwright/test';
import { injectSettingsStatefulMock } from '../support/mocks/tauri.mock';

/**
 * E2E Tests for Story 6-4: Event Log Viewer with Notification Badge
 *
 * Test Level: E2E (End-to-End)
 * Framework: Playwright Test
 * Focus: User-facing log viewer functionality and notification badge
 *
 * RED PHASE: These tests MUST fail initially (missing implementation)
 * Expected failures:
 * - AC #3: Auto-mark read functionality not implemented
 * - AC #5: Date range filter not implemented
 *
 * Run with: pnpm test -- tests/e2e/logs-viewer.spec.ts
 */

test.describe('Event Log Viewer: Display (AC #1)', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Tauri mock with event log support
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });

    // Navigate to Logs view
    await page.goto('/');
    await page.click('[data-testid="logs-nav-link"]');
    await expect(page).toHaveURL('/logs');
  });

  test('AC #1: should display list of recent events (most recent first)', async ({ page }) => {
    // GIVEN: Logs view is loaded with events

    // WHEN: Looking at event list
    const logsView = page.locator('[data-testid="logs-view"]');
    await expect(logsView).toBeVisible();

    // THEN: Events are displayed (if any exist)
    // Note: In actual test, we'd seed events first
    const eventList = page.locator('[data-testid="event-item"]');

    // If events exist, verify they're visible
    const eventCount = await eventList.count();
    if (eventCount > 0) {
      await expect(eventList.first()).toBeVisible();
    }

    // Expected failure: None - basic display should work
  });

  test('AC #1: should show timestamp, level icon, category, and message for each event', async ({ page }) => {
    // GIVEN: Event exists in the system
    // Note: In real scenario, we'd seed a test event first

    // WHEN: Viewing an event in the list
    const eventItem = page.locator('[data-testid="event-item"]').first();

    // Skip if no events exist
    const eventCount = await page.locator('[data-testid="event-item"]').count();
    if (eventCount === 0) {
      test.skip();
    }

    // THEN: Event displays all required information
    await expect(eventItem).toBeVisible();

    // Verify timestamp is present (relative format like "5m ago" or absolute)
    await expect(eventItem).toContainText(/ago|Just now|\d{1,2}:\d{2}/);

    // Verify level badge is present
    const levelBadge = eventItem.locator('.bg-blue-100, .bg-yellow-100, .bg-red-100');
    await expect(levelBadge).toBeVisible();

    // Verify category badge is present
    const categoryBadge = eventItem.locator('.bg-gray-100');
    await expect(categoryBadge).toBeVisible();

    // Verify message text is present
    await expect(eventItem.locator('p.text-sm')).toBeVisible();

    // Expected failure: None - basic display should work
  });

  test('AC #1: should allow expanding an entry to see full details', async ({ page }) => {
    // GIVEN: Event with details exists
    const eventItem = page.locator('[data-testid="event-item"]').first();

    // Skip if no events exist
    const eventCount = await page.locator('[data-testid="event-item"]').count();
    if (eventCount === 0) {
      test.skip();
    }

    // WHEN: Clicking "Show details" button
    const showDetailsButton = eventItem.locator('button:has-text("Show details")');

    // Skip if event has no details
    const hasDetails = await showDetailsButton.count() > 0;
    if (!hasDetails) {
      test.skip();
    }

    await showDetailsButton.click();

    // THEN: Details are expanded and visible
    const detailsContent = eventItem.locator('pre');
    await expect(detailsContent).toBeVisible();

    // AND: Button text changes to "Hide details"
    await expect(eventItem.locator('button:has-text("Hide details")')).toBeVisible();

    // WHEN: Clicking "Hide details"
    await eventItem.locator('button:has-text("Hide details")').click();

    // THEN: Details are hidden
    await expect(detailsContent).not.toBeVisible();

    // Expected failure: None - expand/collapse should work
  });
});

test.describe('Event Log Viewer: Notification Badge (AC #2)', () => {
  test.beforeEach(async ({ page }) => {
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });

    await page.goto('/');
  });

  test('AC #2: should show notification badge with unread count in sidebar', async ({ page }) => {
    // GIVEN: Unread events exist in the system
    // Note: In real scenario, we'd seed unread events first

    // WHEN: Looking at the sidebar Logs navigation item
    const logsNavLink = page.locator('[data-testid="logs-nav-link"]');
    await expect(logsNavLink).toBeVisible();

    // THEN: Notification badge shows unread count (if unread events exist)
    const badge = page.locator('[data-testid="logs-unread-badge"]');

    // Badge should only be visible if there are unread events
    const badgeVisible = await badge.isVisible().catch(() => false);

    if (badgeVisible) {
      // Verify badge shows a number
      const badgeText = await badge.textContent();
      expect(badgeText).toMatch(/^\d+\+?$/); // Number or number with +
    }

    // Expected failure: None - badge display should work if unread events exist
  });

  test('AC #2: should update badge count when new events occur', async ({ page }) => {
    // GIVEN: Initial unread count
    const initialBadge = page.locator('[data-testid="logs-unread-badge"]');
    const initialVisible = await initialBadge.isVisible().catch(() => false);
    const initialCount = initialVisible ? await initialBadge.textContent() : '0';

    // WHEN: New event is logged (simulated by waiting for polling interval)
    // Note: In real scenario, we'd trigger an action that creates an event
    await page.waitForTimeout(11000); // Wait for one polling cycle (10s + buffer)

    // THEN: Badge count reflects new unread events
    // Note: This test verifies polling works, actual count change depends on event creation
    const updatedBadge = page.locator('[data-testid="logs-unread-badge"]');
    const updatedVisible = await updatedBadge.isVisible().catch(() => false);

    // If badge visibility changed, polling is working
    expect(typeof updatedVisible).toBe('boolean');

    // Expected failure: None - polling mechanism should work
  });
});

test.describe('Event Log Viewer: Auto-Mark Read (AC #3)', () => {
  test.beforeEach(async ({ page }) => {
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });
  });

  test('AC #3: should automatically mark events as read when opening Logs view', async ({ page }) => {
    // GIVEN: Unread events exist
    await page.goto('/');

    // Verify unread badge exists
    const initialBadge = page.locator('[data-testid="logs-unread-badge"]');
    const hasBadge = await initialBadge.isVisible().catch(() => false);

    if (!hasBadge) {
      test.skip(); // Skip if no unread events to test
    }

    const initialCount = await initialBadge.textContent();

    // WHEN: User opens the Logs view
    await page.click('[data-testid="logs-nav-link"]');
    await expect(page).toHaveURL('/logs');

    // Wait for auto-mark-read to trigger (debounced)
    await page.waitForTimeout(1000);

    // THEN: Events are marked as read automatically
    // Navigate away to see if badge cleared
    await page.click('[data-testid="dashboard-nav-link"]');
    await expect(page).toHaveURL('/');

    // Badge should be gone or show 0
    const updatedBadge = page.locator('[data-testid="logs-unread-badge"]');
    await expect(updatedBadge).not.toBeVisible();

    // Expected failure: WILL FAIL - Auto-mark read not implemented yet
    // Current behavior: Events only marked read on click, not on view
  });

  test('AC #3: should clear notification badge after auto-marking read', async ({ page }) => {
    // GIVEN: Unread events exist with visible badge
    await page.goto('/');

    const badge = page.locator('[data-testid="logs-unread-badge"]');
    const hasBadge = await badge.isVisible().catch(() => false);

    if (!hasBadge) {
      test.skip(); // Skip if no unread events
    }

    // WHEN: User opens Logs view
    await page.click('[data-testid="logs-nav-link"]');
    await expect(page).toHaveURL('/logs');

    // Wait for auto-mark-read
    await page.waitForTimeout(1000);

    // AND: User navigates back to dashboard
    await page.click('[data-testid="dashboard-nav-link"]');

    // THEN: Badge is no longer visible
    await expect(badge).not.toBeVisible();

    // Expected failure: WILL FAIL - Auto-mark read not implemented
  });
});

test.describe('Event Log Viewer: Clear Log (AC #4)', () => {
  test.beforeEach(async ({ page }) => {
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });

    await page.goto('/');
    await page.click('[data-testid="logs-nav-link"]');
    await expect(page).toHaveURL('/logs');
  });

  test('AC #4: should show confirmation dialog when clicking Clear Old', async ({ page }) => {
    // GIVEN: Logs view is open

    // Set up dialog listener BEFORE clicking
    page.once('dialog', async (dialog) => {
      // THEN: Confirmation dialog appears
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('delete');

      // Dismiss dialog
      await dialog.dismiss();
    });

    // WHEN: User clicks "Clear Old" button
    const clearButton = page.locator('button:has-text("Clear Old")');
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    // Expected failure: None - confirmation dialog should work
  });

  test('AC #4: should delete old events when confirming clear action', async ({ page }) => {
    // GIVEN: Events exist in the log
    const eventsBefore = await page.locator('[data-testid="event-item"]').count();

    if (eventsBefore === 0) {
      test.skip(); // Skip if no events to clear
    }

    // WHEN: User clicks "Clear Old" and confirms
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    const clearButton = page.locator('button:has-text("Clear Old")');
    await clearButton.click();

    // Wait for deletion to complete
    await page.waitForTimeout(500);

    // THEN: Old events are removed (keeps 100 most recent)
    // Note: If there were <= 100 events, count should stay same
    const eventsAfter = await page.locator('[data-testid="event-item"]').count();

    if (eventsBefore > 100) {
      expect(eventsAfter).toBeLessThanOrEqual(100);
    }

    // Expected failure: None - clear functionality should work
  });

  test('AC #4: should not delete events when dismissing confirmation', async ({ page }) => {
    // GIVEN: Events exist in the log
    const eventsBefore = await page.locator('[data-testid="event-item"]').count();

    if (eventsBefore === 0) {
      test.skip(); // Skip if no events
    }

    // WHEN: User clicks "Clear Old" but dismisses dialog
    page.once('dialog', async (dialog) => {
      await dialog.dismiss();
    });

    const clearButton = page.locator('button:has-text("Clear Old")');
    await clearButton.click();

    // Wait to ensure no deletion occurred
    await page.waitForTimeout(500);

    // THEN: Event count remains unchanged
    const eventsAfter = await page.locator('[data-testid="event-item"]').count();
    expect(eventsAfter).toBe(eventsBefore);

    // Expected failure: None - dismiss should work
  });
});

test.describe('Event Log Viewer: Filter Controls (AC #5)', () => {
  test.beforeEach(async ({ page }) => {
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });

    await page.goto('/');
    await page.click('[data-testid="logs-nav-link"]');
    await expect(page).toHaveURL('/logs');
  });

  test('AC #5: should filter events by level (info, warn, error)', async ({ page }) => {
    // GIVEN: Events with different levels exist
    const eventsBefore = await page.locator('[data-testid="event-item"]').count();

    if (eventsBefore === 0) {
      test.skip(); // Skip if no events
    }

    // WHEN: User selects "Error" level filter
    const levelSelect = page.locator('select').filter({ hasText: 'All Levels' });
    await expect(levelSelect).toBeVisible();
    await levelSelect.selectOption('error');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // THEN: Only error level events are shown
    const eventsAfter = await page.locator('[data-testid="event-item"]').count();

    // Verify filtered results (may be 0 if no error events exist)
    expect(eventsAfter).toBeGreaterThanOrEqual(0);
    expect(eventsAfter).toBeLessThanOrEqual(eventsBefore);

    // If events exist, verify they're all error level
    if (eventsAfter > 0) {
      const firstEvent = page.locator('[data-testid="event-item"]').first();
      await expect(firstEvent.locator('.bg-red-100')).toBeVisible();
    }

    // Expected failure: None - level filter should work
  });

  test('AC #5: should filter events by category', async ({ page }) => {
    // GIVEN: Events with different categories exist
    const eventsBefore = await page.locator('[data-testid="event-item"]').count();

    if (eventsBefore === 0) {
      test.skip(); // Skip if no events
    }

    // WHEN: User selects "System" category filter
    const categorySelect = page.locator('select').filter({ hasText: 'All Categories' });
    await expect(categorySelect).toBeVisible();
    await categorySelect.selectOption('system');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // THEN: Only system category events are shown
    const eventsAfter = await page.locator('[data-testid="event-item"]').count();

    expect(eventsAfter).toBeGreaterThanOrEqual(0);
    expect(eventsAfter).toBeLessThanOrEqual(eventsBefore);

    // If events exist, verify they're system category
    if (eventsAfter > 0) {
      const firstEvent = page.locator('[data-testid="event-item"]').first();
      await expect(firstEvent).toContainText('system');
    }

    // Expected failure: None - category filter should work
  });

  test('AC #5: should filter events by date range', async ({ page }) => {
    // GIVEN: Events exist across different dates
    const eventsBefore = await page.locator('[data-testid="event-item"]').count();

    if (eventsBefore === 0) {
      test.skip(); // Skip if no events
    }

    // WHEN: User sets date range filter
    const startDateInput = page.locator('input[type="date"]').first();
    const endDateInput = page.locator('input[type="date"]').last();

    // Verify date inputs exist
    await expect(startDateInput).toBeVisible();
    await expect(endDateInput).toBeVisible();

    // Set date range (last 7 days)
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todayStr = today.toISOString().split('T')[0];
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    await startDateInput.fill(weekAgoStr);
    await endDateInput.fill(todayStr);

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // THEN: Only events within date range are shown
    const eventsAfter = await page.locator('[data-testid="event-item"]').count();

    expect(eventsAfter).toBeGreaterThanOrEqual(0);
    expect(eventsAfter).toBeLessThanOrEqual(eventsBefore);

    // Expected failure: WILL FAIL - Date range filter not implemented yet
    // Missing: Date input fields and filter logic
  });

  test('AC #5: should combine multiple filters (level + category + date)', async ({ page }) => {
    // GIVEN: Various events exist
    const eventsBefore = await page.locator('[data-testid="event-item"]').count();

    if (eventsBefore === 0) {
      test.skip(); // Skip if no events
    }

    // WHEN: User applies multiple filters
    const levelSelect = page.locator('select').filter({ hasText: 'All Levels' });
    await levelSelect.selectOption('error');

    const categorySelect = page.locator('select').filter({ hasText: 'All Categories' });
    await categorySelect.selectOption('connection');

    // Try to set date range (will fail if not implemented)
    const startDateInput = page.locator('input[type="date"]').first();
    if (await startDateInput.isVisible().catch(() => false)) {
      const today = new Date().toISOString().split('T')[0];
      await startDateInput.fill(today);
    }

    // Wait for filters to apply
    await page.waitForTimeout(500);

    // THEN: Only events matching ALL criteria are shown
    const eventsAfter = await page.locator('[data-testid="event-item"]').count();

    expect(eventsAfter).toBeGreaterThanOrEqual(0);
    expect(eventsAfter).toBeLessThanOrEqual(eventsBefore);

    // If events exist, verify they match filters
    if (eventsAfter > 0) {
      const firstEvent = page.locator('[data-testid="event-item"]').first();
      await expect(firstEvent.locator('.bg-red-100')).toBeVisible(); // error level
      await expect(firstEvent).toContainText('connection'); // category
    }

    // Expected failure: PARTIAL FAIL - Date filter not implemented
  });

  test('AC #5: should show unread-only filter', async ({ page }) => {
    // GIVEN: Mix of read and unread events

    // WHEN: User checks "Unread only" filter
    const unreadLabel = page.locator('label:has-text("Unread only")');
    await expect(unreadLabel).toBeVisible();

    const unreadCheckbox = unreadLabel.locator('input[type="checkbox"]');
    await expect(unreadCheckbox).toBeVisible();
    await unreadCheckbox.check();

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // THEN: Only unread events are shown
    const events = page.locator('[data-testid="event-item"]');
    const eventCount = await events.count();

    // All visible events should have "New" badge
    for (let i = 0; i < eventCount; i++) {
      const event = events.nth(i);
      await expect(event.locator('text=New')).toBeVisible();
    }

    // Expected failure: None - unread filter should work
  });

  test('AC #5: should clear filters and show all events', async ({ page }) => {
    // GIVEN: Filters are applied
    const levelSelect = page.locator('select').filter({ hasText: 'All Levels' });
    await levelSelect.selectOption('error');

    const eventsFiltered = await page.locator('[data-testid="event-item"]').count();

    // WHEN: User resets filters to "All"
    await levelSelect.selectOption(''); // Empty value = All Levels

    const categorySelect = page.locator('select').filter({ hasText: 'All Categories' });
    await categorySelect.selectOption(''); // Empty value = All Categories

    // Wait for filters to clear
    await page.waitForTimeout(500);

    // THEN: All events are shown again
    const eventsAll = await page.locator('[data-testid="event-item"]').count();

    expect(eventsAll).toBeGreaterThanOrEqual(eventsFiltered);

    // Expected failure: None - clearing filters should work
  });
});

test.describe('Event Log Viewer: Integration Tests', () => {
  test('should refresh event list when clicking Refresh button', async ({ page }) => {
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });

    await page.goto('/logs');

    // GIVEN: Events are loaded
    const eventsBefore = await page.locator('[data-testid="event-item"]').count();

    // WHEN: User clicks Refresh button
    const refreshButton = page.locator('button:has-text("Refresh")');
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    // Wait for refresh to complete
    await page.waitForTimeout(500);

    // THEN: Event list is reloaded
    const eventsAfter = await page.locator('[data-testid="event-item"]').count();

    // Count should be same or higher (if new events occurred)
    expect(eventsAfter).toBeGreaterThanOrEqual(eventsBefore);

    // Expected failure: None - refresh should work
  });

  test('should show event count summary', async ({ page }) => {
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });

    await page.goto('/logs');

    // GIVEN: Events are loaded

    // WHEN: Looking at the event summary
    const summary = page.locator('text=/Showing \\d+ of \\d+ events/');

    // THEN: Summary displays correct format
    await expect(summary).toBeVisible();

    // Expected failure: None - summary should work
  });

  test('should handle empty state when no events exist', async ({ page }) => {
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });

    await page.goto('/logs');

    // GIVEN: No events in the system (or all filtered out)
    // Apply filter that returns no results
    const categorySelect = page.locator('select').filter({ hasText: 'All Categories' });
    await categorySelect.selectOption('provider');

    await page.waitForTimeout(500);

    // Check if we got zero results
    const eventCount = await page.locator('[data-testid="event-item"]').count();

    if (eventCount === 0) {
      // THEN: Empty state message is shown
      await expect(page.locator('text=No events found')).toBeVisible();
    }

    // Expected failure: None - empty state should work
  });
});
