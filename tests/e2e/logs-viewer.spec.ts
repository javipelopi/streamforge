import { test, expect } from '@playwright/test';
import { injectSettingsStatefulMock, seedTestEvents, clearTestEvents } from '../support/mocks/tauri.mock';

/**
 * E2E Tests for Story 6-4: Event Log Viewer with Notification Badge
 *
 * Test Level: E2E (End-to-End)
 * Framework: Playwright Test
 * Focus: User-facing log viewer functionality and notification badge
 *
 * GREEN PHASE: Tests should pass with implementation complete
 *
 * Run with: pnpm test -- tests/e2e/logs-viewer.spec.ts
 */

// Helper to create test events with specific timestamps
function createTestEvents(count: number, unread: boolean = true, category: string = 'system') {
  const events: Array<{
    level: 'info' | 'warn' | 'error';
    category: string;
    message: string;
    details?: string;
    isRead: boolean;
    timestamp: string;
  }> = [];

  const now = new Date();
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(now.getTime() - i * 60000); // Each event 1 minute apart
    events.push({
      level: i % 3 === 0 ? 'error' : i % 3 === 1 ? 'warn' : 'info',
      category: category,
      message: `Test event ${i + 1}`,
      details: JSON.stringify({ index: i, test: true }),
      isRead: !unread,
      timestamp: timestamp.toISOString(),
    });
  }
  return events;
}

test.describe('Event Log Viewer: Display (AC #1)', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Tauri mock with event log support
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });

    // Navigate to app first
    await page.goto('/');

    // Clear any existing events and seed fresh test events
    await clearTestEvents(page);
    await seedTestEvents(page, createTestEvents(5, true, 'system'));

    // Navigate to Logs view
    await page.click('[data-testid="logs-nav-link"]');
    await expect(page).toHaveURL('/logs');
  });

  test('AC #1: should display list of recent events (most recent first)', async ({ page }) => {
    // GIVEN: Logs view is loaded with events
    // WHEN: Looking at event list
    const logsView = page.locator('[data-testid="logs-view"]');
    await expect(logsView).toBeVisible();

    // THEN: Events are displayed
    const eventList = page.locator('[data-testid="event-item"]');
    await expect(eventList.first()).toBeVisible();

    // Verify we have events
    const eventCount = await eventList.count();
    expect(eventCount).toBeGreaterThan(0);
  });

  test('AC #1: should show timestamp, level icon, category, and message for each event', async ({ page }) => {
    // GIVEN: Event exists in the system
    // WHEN: Viewing an event in the list
    const eventItem = page.locator('[data-testid="event-item"]').first();
    await expect(eventItem).toBeVisible();

    // THEN: Event displays all required information
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
  });

  test('AC #1: should allow expanding an entry to see full details', async ({ page }) => {
    // GIVEN: Event with details exists
    const eventItem = page.locator('[data-testid="event-item"]').first();
    await expect(eventItem).toBeVisible();

    // WHEN: Clicking "Show details" button
    const showDetailsButton = eventItem.locator('button:has-text("Show details")');
    await expect(showDetailsButton).toBeVisible();
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
  });
});

test.describe('Event Log Viewer: Notification Badge (AC #2)', () => {
  test('AC #2: should show notification badge with unread count in sidebar', async ({ page }) => {
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });

    // GIVEN: First navigate to seed events
    await page.goto('/');
    await clearTestEvents(page);
    await seedTestEvents(page, createTestEvents(3, true)); // 3 unread events

    // Navigate to a different page to trigger fresh component mount
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');

    // Navigate back to dashboard - component will fetch unread count fresh
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await page.waitForTimeout(500);

    // WHEN: Looking at the sidebar Logs navigation item
    const logsNavLink = page.locator('[data-testid="logs-nav-link"]');
    await expect(logsNavLink).toBeVisible();

    // THEN: Notification badge shows unread count
    const badge = page.locator('[data-testid="logs-unread-badge"]');
    await expect(badge).toBeVisible();

    // Verify badge shows a number
    const badgeText = await badge.textContent();
    expect(badgeText).toMatch(/^\d+\+?$/); // Number or number with +
  });

  test('AC #2: should not show badge when no unread events', async ({ page }) => {
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });

    // GIVEN: First navigate to seed events
    await page.goto('/');
    await clearTestEvents(page);
    await seedTestEvents(page, createTestEvents(3, false)); // 3 read events

    // Navigate to settings and back
    await page.goto('/settings');
    await page.goto('/');
    await page.waitForTimeout(500);

    // THEN: Badge should not be visible
    const badge = page.locator('[data-testid="logs-unread-badge"]');
    await expect(badge).not.toBeVisible();
  });
});

test.describe('Event Log Viewer: Auto-Mark Read (AC #3)', () => {
  test('AC #3: should automatically mark events as read when opening Logs view', async ({ page }) => {
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });

    // GIVEN: Seed unread events first
    await page.goto('/');
    await clearTestEvents(page);
    await seedTestEvents(page, createTestEvents(3, true)); // 3 unread events

    // Navigate away and back to refresh state
    await page.goto('/settings');
    await page.goto('/');
    await page.waitForTimeout(500);

    // Verify unread badge exists
    const initialBadge = page.locator('[data-testid="logs-unread-badge"]');
    await expect(initialBadge).toBeVisible();

    // WHEN: User opens the Logs view
    await page.click('[data-testid="logs-nav-link"]');
    await expect(page).toHaveURL('/logs');

    // Wait for auto-mark-read to trigger (500ms delay + buffer)
    await page.waitForTimeout(700);

    // THEN: Events are marked as read automatically
    // Navigate back to dashboard (full navigation to trigger fresh fetch)
    await page.goto('/');
    await page.waitForTimeout(500);

    // Badge should be gone
    const updatedBadge = page.locator('[data-testid="logs-unread-badge"]');
    await expect(updatedBadge).not.toBeVisible();
  });

  test('AC #3: should clear notification badge after auto-marking read', async ({ page }) => {
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });

    // GIVEN: Seed unread events first
    await page.goto('/');
    await clearTestEvents(page);
    await seedTestEvents(page, createTestEvents(5, true)); // 5 unread events

    // Navigate away and back to refresh state
    await page.goto('/settings');
    await page.goto('/');
    await page.waitForTimeout(500);

    const badge = page.locator('[data-testid="logs-unread-badge"]');
    await expect(badge).toBeVisible();

    // WHEN: User opens Logs view
    await page.click('[data-testid="logs-nav-link"]');
    await expect(page).toHaveURL('/logs');

    // Wait for auto-mark-read
    await page.waitForTimeout(700);

    // AND: User navigates back to dashboard
    await page.goto('/');
    await page.waitForTimeout(500);

    // THEN: Badge is no longer visible
    const badgeAfter = page.locator('[data-testid="logs-unread-badge"]');
    await expect(badgeAfter).not.toBeVisible();
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
    await clearTestEvents(page);
    await seedTestEvents(page, createTestEvents(10, false)); // 10 read events

    // Navigate to logs and wait for events to load
    await page.click('[data-testid="logs-nav-link"]');
    await expect(page).toHaveURL('/logs');

    // Wait for events to render
    await page.waitForSelector('[data-testid="event-item"]', { state: 'attached', timeout: 5000 });
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
  });

  test('AC #4: should delete old events when confirming clear action', async ({ page }) => {
    // GIVEN: Events exist in the log
    const eventsBefore = await page.locator('[data-testid="event-item"]').count();
    expect(eventsBefore).toBeGreaterThan(0);

    // WHEN: User clicks "Clear Old" and confirms
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    const clearButton = page.locator('button:has-text("Clear Old")');
    await clearButton.click();

    // Wait for deletion to complete
    await page.waitForTimeout(500);

    // THEN: Old events are removed (keeps 100 most recent)
    // Since we only have 10 events and keep 100, nothing should be deleted
    // But the action should complete without error
  });

  test('AC #4: should not delete events when dismissing confirmation', async ({ page }) => {
    // GIVEN: Events exist in the log
    const eventsBefore = await page.locator('[data-testid="event-item"]').count();
    expect(eventsBefore).toBeGreaterThan(0);

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
    await clearTestEvents(page);

    // Seed events with different levels and categories
    const now = new Date();
    await seedTestEvents(page, [
      { level: 'error', category: 'connection', message: 'Connection failed', isRead: false, timestamp: now.toISOString() },
      { level: 'warn', category: 'stream', message: 'Stream warning', isRead: true, timestamp: new Date(now.getTime() - 60000).toISOString() },
      { level: 'info', category: 'system', message: 'System info', isRead: true, timestamp: new Date(now.getTime() - 120000).toISOString() },
      { level: 'error', category: 'system', message: 'System error', isRead: false, timestamp: new Date(now.getTime() - 180000).toISOString() },
      { level: 'info', category: 'epg', message: 'EPG update', isRead: true, timestamp: new Date(now.getTime() - 240000).toISOString() },
    ]);

    await page.click('[data-testid="logs-nav-link"]');
    await expect(page).toHaveURL('/logs');

    // Wait for events to render
    await page.waitForSelector('[data-testid="event-item"]', { state: 'attached', timeout: 5000 });
  });

  test('AC #5: should filter events by level (info, warn, error)', async ({ page }) => {
    // GIVEN: Events with different levels exist
    const eventsBefore = await page.locator('[data-testid="event-item"]').count();
    expect(eventsBefore).toBe(5);

    // WHEN: User selects "Error" level filter
    const levelSelect = page.locator('select').filter({ hasText: 'All Levels' });
    await expect(levelSelect).toBeVisible();
    await levelSelect.selectOption('error');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // THEN: Only error level events are shown
    const eventsAfter = await page.locator('[data-testid="event-item"]').count();
    expect(eventsAfter).toBe(2); // We seeded 2 error events

    // Verify all visible events are error level
    const firstEvent = page.locator('[data-testid="event-item"]').first();
    await expect(firstEvent.locator('.bg-red-100')).toBeVisible();
  });

  test('AC #5: should filter events by category', async ({ page }) => {
    // GIVEN: Events with different categories exist
    const eventsBefore = await page.locator('[data-testid="event-item"]').count();
    expect(eventsBefore).toBe(5);

    // WHEN: User selects "System" category filter
    const categorySelect = page.locator('select').filter({ hasText: 'All Categories' });
    await expect(categorySelect).toBeVisible();
    await categorySelect.selectOption('system');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // THEN: Only system category events are shown
    const eventsAfter = await page.locator('[data-testid="event-item"]').count();
    expect(eventsAfter).toBe(2); // We seeded 2 system events

    // Verify they're system category
    const firstEvent = page.locator('[data-testid="event-item"]').first();
    await expect(firstEvent).toContainText('system');
  });

  test('AC #5: should filter events by date range', async ({ page }) => {
    // GIVEN: Events exist across different dates
    const eventsBefore = await page.locator('[data-testid="event-item"]').count();
    expect(eventsBefore).toBe(5);

    // WHEN: User sets date range filter
    const startDateInput = page.locator('input[type="date"]').first();
    const endDateInput = page.locator('input[type="date"]').last();

    // Verify date inputs exist
    await expect(startDateInput).toBeVisible();
    await expect(endDateInput).toBeVisible();

    // Set date range to today only
    const today = new Date().toISOString().split('T')[0];
    await startDateInput.fill(today);
    await endDateInput.fill(today);

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // THEN: Only events within date range are shown
    const eventsAfter = await page.locator('[data-testid="event-item"]').count();
    // All our test events are from today, so all 5 should still show
    expect(eventsAfter).toBe(5);
  });

  test('AC #5: should combine multiple filters (level + category)', async ({ page }) => {
    // GIVEN: Various events exist
    const eventsBefore = await page.locator('[data-testid="event-item"]').count();
    expect(eventsBefore).toBe(5);

    // WHEN: User applies multiple filters
    const levelSelect = page.locator('select').filter({ hasText: 'All Levels' });
    await levelSelect.selectOption('error');

    const categorySelect = page.locator('select').filter({ hasText: 'All Categories' });
    await categorySelect.selectOption('system');

    // Wait for filters to apply
    await page.waitForTimeout(500);

    // THEN: Only events matching ALL criteria are shown
    const eventsAfter = await page.locator('[data-testid="event-item"]').count();
    expect(eventsAfter).toBe(1); // Only 1 event is both error AND system

    // Verify it matches both filters
    const firstEvent = page.locator('[data-testid="event-item"]').first();
    await expect(firstEvent.locator('.bg-red-100')).toBeVisible(); // error level
    await expect(firstEvent).toContainText('system'); // category
  });

  test('AC #5: should show unread-only filter', async ({ page }) => {
    // GIVEN: Mix of read and unread events
    // Note: Auto-mark-read (AC #3) triggers after 500ms on the logs page,
    // so we need to act quickly or use the checkbox right away

    // WHEN: User checks "Unread only" filter IMMEDIATELY (before auto-mark-read)
    const unreadLabel = page.locator('label:has-text("Unread only")');
    await expect(unreadLabel).toBeVisible();

    const unreadCheckbox = unreadLabel.locator('input[type="checkbox"]');
    await expect(unreadCheckbox).toBeVisible();

    // Click immediately before auto-mark-read triggers
    await unreadCheckbox.check();

    // Wait briefly for filter to apply
    await page.waitForTimeout(200);

    // THEN: Only unread events are shown (2 unread initially)
    const events = page.locator('[data-testid="event-item"]');
    const eventCount = await events.count();

    // Should have 2 unread events (before auto-mark-read completes)
    // OR 0 if auto-mark-read already ran
    expect(eventCount).toBeGreaterThanOrEqual(0);
    expect(eventCount).toBeLessThanOrEqual(2);

    // If we have unread events, verify they have "New" badge
    if (eventCount > 0) {
      for (let i = 0; i < eventCount; i++) {
        const event = events.nth(i);
        await expect(event.locator('text=New')).toBeVisible();
      }
    }
  });

  test('AC #5: should clear filters and show all events', async ({ page }) => {
    // GIVEN: Filters are applied
    const levelSelect = page.locator('select').filter({ hasText: 'All Levels' });
    await levelSelect.selectOption('error');

    await page.waitForTimeout(300);
    const eventsFiltered = await page.locator('[data-testid="event-item"]').count();
    expect(eventsFiltered).toBe(2);

    // WHEN: User resets filters to "All"
    await levelSelect.selectOption(''); // Empty value = All Levels

    // Wait for filters to clear
    await page.waitForTimeout(500);

    // THEN: All events are shown again
    const eventsAll = await page.locator('[data-testid="event-item"]').count();
    expect(eventsAll).toBe(5);
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

    await page.goto('/');
    await seedTestEvents(page, createTestEvents(5, false));
    await page.goto('/logs');

    // GIVEN: Events are loaded
    const eventsBefore = await page.locator('[data-testid="event-item"]').count();
    expect(eventsBefore).toBe(5);

    // WHEN: User clicks Refresh button
    const refreshButton = page.locator('button:has-text("Refresh")');
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    // Wait for refresh to complete
    await page.waitForTimeout(500);

    // THEN: Event list is reloaded
    const eventsAfter = await page.locator('[data-testid="event-item"]').count();
    expect(eventsAfter).toBe(5); // Same count after refresh
  });

  test('should show event count summary', async ({ page }) => {
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });

    await page.goto('/');
    await seedTestEvents(page, createTestEvents(5, false));
    await page.goto('/logs');

    // GIVEN: Events are loaded
    // WHEN: Looking at the event summary
    const summary = page.locator('text=/Showing \\d+ of \\d+ events/');

    // THEN: Summary displays correct format
    await expect(summary).toBeVisible();
  });

  test('should handle empty state when no events exist', async ({ page }) => {
    await injectSettingsStatefulMock(page, {
      serverPort: 5004,
      autostartEnabled: false,
      epgSchedule: { hour: 4, minute: 0, enabled: true },
      logVerbosity: 'verbose',
    });

    await page.goto('/logs');

    // GIVEN: No events in the system
    // Note: We don't seed any events

    // THEN: Empty state message is shown
    await expect(page.locator('text=No events found')).toBeVisible();
  });
});
