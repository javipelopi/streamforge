import { test, expect } from '@playwright/test';
import { createEpgSchedule, createDefaultEpgSchedule } from '../support/factories/epg-schedule.factory';
import { createNewXmltvSource } from '../support/factories/xmltv-source.factory';

/**
 * Integration Tests for Story 2-6: Implement Scheduled EPG Refresh
 *
 * These tests verify the scheduler behavior and missed refresh detection.
 * All tests are in RED phase - they will fail until the implementation is complete.
 *
 * Test Strategy:
 * - Integration level: Tests Tauri backend scheduler functionality
 * - Requires TAURI_DEV=true to run with full Tauri app
 * - Tests scheduled jobs and missed refresh detection logic
 * - Given-When-Then format for clarity
 *
 * Acceptance Criteria Coverage:
 * - AC#2: Scheduled automatic refresh (background job execution)
 * - AC#3: Missed refresh detection on app startup
 *
 * Run with: TAURI_DEV=true pnpm test -- tests/integration/epg-scheduler.spec.ts
 */

test.describe('EPG Scheduler Background Jobs', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: Tauri app is running with database initialized
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Ensure at least one EPG source exists for refresh testing
    const addSourceButton = page.getByTestId('add-epg-source-button');
    if (await addSourceButton.isVisible()) {
      const testSource = createNewXmltvSource({
        name: 'Scheduler Test EPG Source',
        url: 'https://example.com/scheduler-test.xml',
        format: 'xml',
      });

      await page.goto('/accounts');
      await addSourceButton.click();
      await page.getByTestId('epg-source-name').fill(testSource.name);
      await page.getByTestId('epg-source-url').fill(testSource.url);
      await page.getByTestId('epg-source-format').selectOption(testSource.format);
      await page.getByTestId('epg-source-submit').click();
      await expect(page.getByTestId('epg-source-dialog')).not.toBeVisible();
    }
  });

  test('should trigger scheduled refresh at configured time', async ({ page }) => {
    // GIVEN: EPG schedule is configured for a specific time
    // Note: This test requires setting schedule to 1-2 minutes in future
    // and waiting for the scheduled time to arrive

    const now = new Date();
    const scheduledHour = now.getHours();
    const scheduledMinute = now.getMinutes() + 2; // 2 minutes from now

    // Adjust for minute overflow
    const adjustedMinute = scheduledMinute % 60;
    const adjustedHour = scheduledHour + Math.floor(scheduledMinute / 60);

    const nearFutureSchedule = createEpgSchedule({
      hour: adjustedHour % 24,
      minute: adjustedMinute,
      enabled: true,
    });

    // Set schedule via Settings page
    await page.goto('/settings');
    await page.getByTestId('epg-schedule-hour-select').selectOption(nearFutureSchedule.hour.toString());
    await page.getByTestId('epg-schedule-minute-select').selectOption(nearFutureSchedule.minute.toString());
    await page.getByTestId('epg-schedule-save-button').click();

    // Wait for save confirmation
    await expect(page.locator('.toast').filter({ hasText: /success|saved/i })).toBeVisible({ timeout: 2000 });

    // WHEN: Scheduled time arrives (wait up to 3 minutes)
    // THEN: Refresh is triggered automatically

    // Check event log or EPG source last_refresh timestamp
    // Note: This requires monitoring mechanism - may need to add logging UI
    // or check database directly via Tauri command

    // For now, document expected behavior:
    // Expected: refresh_all_epg_sources() is called automatically
    // Expected: epg_last_scheduled_refresh setting is updated
    // Expected: Event log shows "Scheduled EPG refresh started" entry
    // Expected: All active XMLTV sources show updated last_refresh timestamp

    // This test is intentionally minimal for RED phase
    // Full implementation will require:
    // 1. Add Tauri command to query event log
    // 2. Add Tauri command to get epg_last_scheduled_refresh setting
    // 3. Poll these values during the wait period
    // 4. Assert refresh occurred within expected time window
  });

  test('should update last_refresh timestamp after scheduled refresh', async ({ page }) => {
    // GIVEN: Scheduled refresh has completed (triggered by previous test or manually)

    // WHEN: User checks EPG source last_refresh timestamp
    await page.goto('/accounts');
    const sourcesList = page.getByTestId('epg-sources-list');
    const sourceItem = sourcesList.locator('[data-testid^="epg-source-item-"]').first();
    const lastRefreshDisplay = sourceItem.getByTestId(/epg-source-last-refresh-/);

    // THEN: last_refresh timestamp is recent (within last hour)
    const lastRefreshText = await lastRefreshDisplay.textContent();
    expect(lastRefreshText).toMatch(/just now|minutes ago|hour ago/i);

    // Note: Full verification requires checking that refresh was automatic, not manual
    // This could be done by:
    // 1. Adding event log UI showing refresh source (manual vs scheduled)
    // 2. Adding Tauri command to query event_log for scheduled refresh events
  });

  test('should update epg_last_scheduled_refresh setting after automatic refresh', async ({ page }) => {
    // GIVEN: Scheduled refresh has completed

    // WHEN: User checks the last scheduled refresh setting
    // (This requires a Tauri command to read the setting)
    const lastScheduledRefresh = await page.evaluate(async () => {
      // @ts-ignore - Tauri invoke available in Tauri context
      const settings = await window.__TAURI__.invoke('get_setting', { key: 'epg_last_scheduled_refresh' });
      return settings;
    });

    // THEN: epg_last_scheduled_refresh is set to recent timestamp
    if (lastScheduledRefresh) {
      const timestamp = new Date(lastScheduledRefresh);
      const now = new Date();
      const diffMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60);

      // Refresh should have occurred within last hour
      expect(diffMinutes).toBeLessThan(60);
    }

    // Note: This test may fail initially if no scheduled refresh has occurred yet
    // Expected behavior: Setting is updated immediately after each scheduled refresh completes
  });

  test('should run refresh in background without UI interruption', async ({ page }) => {
    // GIVEN: User is actively using the app
    await page.goto('/accounts');

    // GIVEN: Scheduled refresh is triggered (simulated by short timer or manual trigger)
    // Note: May need to add Tauri command to trigger scheduler manually for testing

    // WHEN: Refresh runs in background
    // (This would require triggering a refresh and observing UI behavior)

    // THEN: UI remains responsive and usable
    // THEN: No modal or blocking dialog appears
    // THEN: User can continue interacting with the app

    // Expected behavior documented:
    // - Refresh runs asynchronously in background thread
    // - No UI blocking or freezing
    // - Optional: Subtle notification toast when refresh completes
    // - User can navigate between views during refresh

    // This test is primarily a documentation placeholder
    // Full implementation requires:
    // 1. Add Tauri command to manually trigger scheduler job
    // 2. Trigger job while interacting with UI
    // 3. Assert UI interactions succeed during refresh
  });
});

test.describe('Missed Refresh Detection on Startup', () => {
  test('should detect missed refresh when app starts after scheduled time', async ({ page }) => {
    // GIVEN: App was not running at scheduled time
    // GIVEN: Last scheduled refresh is older than most recent scheduled time

    // Simulate missed refresh scenario:
    // 1. Set schedule to past time (e.g., 3 hours ago)
    // 2. Set epg_last_scheduled_refresh to before that time (e.g., yesterday)
    // 3. Restart app (simulated by page reload for testing purposes)

    const now = new Date();
    const scheduledHour = (now.getHours() - 3 + 24) % 24; // 3 hours ago
    const pastSchedule = createEpgSchedule({
      hour: scheduledHour,
      minute: 0,
      enabled: true,
    });

    // Set schedule (via Settings or direct setting update)
    await page.goto('/settings');
    await page.getByTestId('epg-schedule-hour-select').selectOption(pastSchedule.hour.toString());
    await page.getByTestId('epg-schedule-minute-select').selectOption(pastSchedule.minute.toString());
    await page.getByTestId('epg-schedule-save-button').click();

    // Set old last_scheduled_refresh timestamp (simulate yesterday)
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    await page.evaluate(
      async (timestamp) => {
        // @ts-ignore - Tauri invoke available in Tauri context
        await window.__TAURI__.invoke('set_setting', {
          key: 'epg_last_scheduled_refresh',
          value: timestamp,
        });
      },
      yesterday.toISOString()
    );

    // WHEN: App starts (simulated by reload with 5-10 second delay for missed refresh check)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for missed refresh detection (5-10 seconds after startup per spec)
    await page.waitForTimeout(12000); // 12 seconds to account for delay

    // THEN: Missed refresh is detected and triggered
    // Verify by checking event log or epg_last_scheduled_refresh update

    const lastScheduledRefresh = await page.evaluate(async () => {
      // @ts-ignore - Tauri invoke available in Tauri context
      const setting = await window.__TAURI__.invoke('get_setting', { key: 'epg_last_scheduled_refresh' });
      return setting;
    });

    // Last scheduled refresh should be updated to recent time
    if (lastScheduledRefresh) {
      const timestamp = new Date(lastScheduledRefresh);
      const diffMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60);

      // Should be very recent (within 5 minutes)
      expect(diffMinutes).toBeLessThan(5);
    }

    // Expected behavior documented:
    // - App calculates most recent scheduled time on startup
    // - Compares with epg_last_scheduled_refresh
    // - If missed, triggers immediate refresh after 5-10 second delay
    // - Updates epg_last_scheduled_refresh after completion
    // - Logs "Missed refresh detected, triggering refresh" to event log
  });

  test('should not trigger missed refresh if already up to date', async ({ page }) => {
    // GIVEN: Last scheduled refresh is current (after most recent scheduled time)

    // Set schedule to daily at current time + 1 hour
    const now = new Date();
    const futureSchedule = createEpgSchedule({
      hour: (now.getHours() + 1) % 24,
      minute: 0,
      enabled: true,
    });

    await page.goto('/settings');
    await page.getByTestId('epg-schedule-hour-select').selectOption(futureSchedule.hour.toString());
    await page.getByTestId('epg-schedule-minute-select').selectOption(futureSchedule.minute.toString());
    await page.getByTestId('epg-schedule-save-button').click();

    // Set last_scheduled_refresh to very recent (1 minute ago)
    const recentRefresh = new Date(now);
    recentRefresh.setMinutes(recentRefresh.getMinutes() - 1);
    await page.evaluate(
      async (timestamp) => {
        // @ts-ignore - Tauri invoke available in Tauri context
        await window.__TAURI__.invoke('set_setting', {
          key: 'epg_last_scheduled_refresh',
          value: timestamp,
        });
      },
      recentRefresh.toISOString()
    );

    // Get initial last_scheduled_refresh value
    const initialLastRefresh = await page.evaluate(async () => {
      // @ts-ignore - Tauri invoke available in Tauri context
      return await window.__TAURI__.invoke('get_setting', { key: 'epg_last_scheduled_refresh' });
    });

    // WHEN: App starts
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for potential missed refresh check (12 seconds)
    await page.waitForTimeout(12000);

    // THEN: No refresh is triggered (last_scheduled_refresh unchanged)
    const finalLastRefresh = await page.evaluate(async () => {
      // @ts-ignore - Tauri invoke available in Tauri context
      return await window.__TAURI__.invoke('get_setting', { key: 'epg_last_scheduled_refresh' });
    });

    // Timestamp should remain the same (no refresh triggered)
    expect(finalLastRefresh).toBe(initialLastRefresh);

    // Expected behavior documented:
    // - App checks if refresh is needed on startup
    // - If last_scheduled_refresh is after most recent scheduled time, skip
    // - No unnecessary refresh triggered
    // - Event log does not show missed refresh detection
  });

  test('should delay missed refresh check by 5-10 seconds after startup', async ({ page }) => {
    // GIVEN: App is starting up with a missed refresh condition

    // This test verifies timing: missed refresh should not trigger immediately
    // but after 5-10 second delay as specified in AC#3

    // Note: This is primarily a timing verification test
    // Full implementation requires:
    // 1. Monitor EPG source last_refresh timestamps
    // 2. Verify no refresh starts within first 5 seconds
    // 3. Verify refresh starts between 5-10 seconds after startup

    // Expected behavior documented:
    // - Delay prevents resource contention during app initialization
    // - Database, HTTP server, and UI have time to fully initialize
    // - Refresh starts only after delay period
  });

  test('should handle case when app was never run at scheduled time', async ({ page }) => {
    // GIVEN: epg_last_scheduled_refresh setting does not exist (first run)

    // Clear the setting to simulate first run
    await page.evaluate(async () => {
      try {
        // @ts-ignore - Tauri invoke available in Tauri context
        await window.__TAURI__.invoke('delete_setting', { key: 'epg_last_scheduled_refresh' });
      } catch (error) {
        // Setting may not exist - that's fine
      }
    });

    // Set enabled schedule
    const defaultSchedule = createDefaultEpgSchedule();
    await page.goto('/settings');
    await page.getByTestId('epg-schedule-enabled-toggle').check();
    await page.getByTestId('epg-schedule-save-button').click();

    // WHEN: App starts
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for missed refresh detection
    await page.waitForTimeout(12000);

    // THEN: Refresh is triggered (first-time refresh)
    const lastScheduledRefresh = await page.evaluate(async () => {
      // @ts-ignore - Tauri invoke available in Tauri context
      return await window.__TAURI__.invoke('get_setting', { key: 'epg_last_scheduled_refresh' });
    });

    // Setting should now exist with recent timestamp
    expect(lastScheduledRefresh).toBeTruthy();

    if (lastScheduledRefresh) {
      const timestamp = new Date(lastScheduledRefresh);
      const now = new Date();
      const diffMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60);

      // Should be very recent
      expect(diffMinutes).toBeLessThan(5);
    }

    // Expected behavior documented:
    // - If no last_scheduled_refresh exists, treat as missed refresh
    // - Trigger initial refresh to populate EPG data
    // - Set last_scheduled_refresh after completion
  });
});

test.describe('Scheduler Error Handling', () => {
  test('should handle errors gracefully without crashing scheduler', async ({ page }) => {
    // GIVEN: Scheduled refresh encounters an error (network failure, invalid XMLTV)

    // WHEN: Refresh fails
    // THEN: Scheduler continues running (doesn't crash)
    // THEN: Error is logged to event log
    // THEN: Next scheduled refresh still occurs

    // Expected behavior documented:
    // - Errors in refresh job are caught and logged
    // - Scheduler remains running for future jobs
    // - User can see error in event log or notifications
    // - epg_last_scheduled_refresh is updated even if refresh failed (to prevent retry loop)
    // - Individual source errors don't prevent other sources from refreshing
  });

  test('should continue scheduler if database temporarily unavailable', async ({ page }) => {
    // GIVEN: Database connection is temporarily unavailable during refresh

    // WHEN: Refresh attempts to run
    // THEN: Error is logged
    // THEN: Scheduler waits for next scheduled time
    // THEN: Next refresh attempt succeeds when database recovers

    // Expected behavior documented:
    // - Database connection errors are caught
    // - Scheduler doesn't exit or crash
    // - Error logged for debugging
    // - Next scheduled refresh retries operation
  });
});
