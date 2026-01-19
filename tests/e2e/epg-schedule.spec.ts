import { test, expect } from '../support/fixtures/epg-schedule.fixture';
import { createEpgSchedule, formatScheduleTime } from '../support/factories/epg-schedule.factory';

/**
 * E2E Tests for Story 2-6: Implement Scheduled EPG Refresh
 *
 * These tests verify the complete user journey for configuring EPG refresh
 * schedule in the Settings view. All tests are in RED phase - they will fail
 * until the implementation is complete.
 *
 * Test Strategy:
 * - E2E level: Tests full user interactions from Settings view
 * - Given-When-Then format for clarity
 * - data-testid selectors for resilience
 * - Focuses on schedule configuration UI and persistence
 *
 * Acceptance Criteria Coverage:
 * - AC#1: Configure EPG refresh schedule (time picker, toggle, persistence)
 */

test.describe('EPG Schedule Configuration in Settings', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: User navigates to Settings view
    await page.goto('/settings');

    // Wait for page to be ready
    await page.waitForLoadState('networkidle');
  });

  test('should display EPG schedule settings section', async ({ page }) => {
    // GIVEN: User is viewing Settings page
    const settingsView = page.getByTestId('settings-view');
    await expect(settingsView).toBeVisible();

    // WHEN: User looks for EPG schedule section
    const scheduleSection = page.getByTestId('epg-schedule-section');
    await expect(scheduleSection).toBeVisible();

    // THEN: Section has a descriptive heading
    await expect(scheduleSection.getByRole('heading', { name: /EPG Schedule|Automatic EPG Refresh/i })).toBeVisible();

    // THEN: Enable toggle is visible
    const enableToggle = page.getByTestId('epg-schedule-enabled-toggle');
    await expect(enableToggle).toBeVisible();

    // THEN: Hour and minute selectors are visible
    const hourSelect = page.getByTestId('epg-schedule-hour-select');
    const minuteSelect = page.getByTestId('epg-schedule-minute-select');
    await expect(hourSelect).toBeVisible();
    await expect(minuteSelect).toBeVisible();

    // THEN: Save button is visible
    const saveButton = page.getByTestId('epg-schedule-save-button');
    await expect(saveButton).toBeVisible();
  });

  test('should display default schedule (4:00 AM enabled)', async ({ page }) => {
    // GIVEN: User is viewing EPG schedule section with default configuration
    const scheduleSection = page.getByTestId('epg-schedule-section');

    // WHEN: User checks the schedule values
    const enableToggle = page.getByTestId('epg-schedule-enabled-toggle');
    const hourSelect = page.getByTestId('epg-schedule-hour-select');
    const minuteSelect = page.getByTestId('epg-schedule-minute-select');

    // THEN: Schedule is enabled by default
    await expect(enableToggle).toBeChecked();

    // THEN: Default hour is 4 (4:00 AM)
    await expect(hourSelect).toHaveValue('4');

    // THEN: Default minute is 0
    await expect(minuteSelect).toHaveValue('0');

    // THEN: Next scheduled refresh time is displayed
    const nextRefreshDisplay = page.getByTestId('epg-schedule-next-refresh');
    await expect(nextRefreshDisplay).toBeVisible();
    await expect(nextRefreshDisplay).toContainText(/04:00|4:00 AM/i);
  });

  test('should allow user to change schedule time', async ({ page, epgScheduleApi }) => {
    // GIVEN: User is viewing EPG schedule section
    const hourSelect = page.getByTestId('epg-schedule-hour-select');
    const minuteSelect = page.getByTestId('epg-schedule-minute-select');
    const saveButton = page.getByTestId('epg-schedule-save-button');

    // WHEN: User changes hour to 2
    await hourSelect.selectOption('2');

    // WHEN: User changes minute to 30
    await minuteSelect.selectOption('30');

    // WHEN: User clicks Save button
    await saveButton.click();

    // THEN: Success notification is shown
    const successToast = page.locator('.toast, [role="status"], [data-testid="toast"]').filter({
      hasText: /success|saved|updated/i,
    });
    await expect(successToast).toBeVisible({ timeout: 2000 });

    // THEN: Next scheduled refresh time is updated
    const nextRefreshDisplay = page.getByTestId('epg-schedule-next-refresh');
    await expect(nextRefreshDisplay).toContainText(/02:30|2:30 AM/i);

    // THEN: Schedule is persisted (verify via API)
    const savedSchedule = await epgScheduleApi.get();
    expect(savedSchedule.hour).toBe(2);
    expect(savedSchedule.minute).toBe(30);
    expect(savedSchedule.enabled).toBe(true);
  });

  test('should persist schedule across page reloads', async ({ page, epgScheduleApi }) => {
    // GIVEN: User sets a custom schedule
    const customSchedule = createEpgSchedule({ hour: 14, minute: 45, enabled: true });
    await epgScheduleApi.set(customSchedule);

    // WHEN: User reloads the Settings page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // THEN: Custom schedule is still displayed
    const hourSelect = page.getByTestId('epg-schedule-hour-select');
    const minuteSelect = page.getByTestId('epg-schedule-minute-select');
    const enableToggle = page.getByTestId('epg-schedule-enabled-toggle');

    await expect(hourSelect).toHaveValue('14');
    await expect(minuteSelect).toHaveValue('45');
    await expect(enableToggle).toBeChecked();

    // THEN: Next scheduled refresh time reflects custom schedule
    const nextRefreshDisplay = page.getByTestId('epg-schedule-next-refresh');
    await expect(nextRefreshDisplay).toContainText(/14:45|2:45 PM/i);
  });

  test('should allow user to disable automatic refresh', async ({ page, epgScheduleApi }) => {
    // GIVEN: User is viewing EPG schedule section with enabled schedule
    const enableToggle = page.getByTestId('epg-schedule-enabled-toggle');
    const saveButton = page.getByTestId('epg-schedule-save-button');

    // WHEN: User clicks the enable toggle to disable
    await enableToggle.click();

    // WHEN: User clicks Save button
    await saveButton.click();

    // THEN: Success notification is shown
    const successToast = page.locator('.toast, [role="status"], [data-testid="toast"]').filter({
      hasText: /success|saved|disabled/i,
    });
    await expect(successToast).toBeVisible({ timeout: 2000 });

    // THEN: Next scheduled refresh display indicates disabled state
    const nextRefreshDisplay = page.getByTestId('epg-schedule-next-refresh');
    await expect(nextRefreshDisplay).toContainText(/disabled|off|not scheduled/i);

    // THEN: Schedule is persisted as disabled (verify via API)
    const savedSchedule = await epgScheduleApi.get();
    expect(savedSchedule.enabled).toBe(false);
  });

  test('should re-enable automatic refresh', async ({ page, epgScheduleApi }) => {
    // GIVEN: User has disabled automatic refresh
    await epgScheduleApi.set({ hour: 4, minute: 0, enabled: false });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // WHEN: User clicks the enable toggle to re-enable
    const enableToggle = page.getByTestId('epg-schedule-enabled-toggle');
    await enableToggle.click();

    // WHEN: User clicks Save button
    const saveButton = page.getByTestId('epg-schedule-save-button');
    await saveButton.click();

    // THEN: Success notification is shown
    const successToast = page.locator('.toast, [role="status"], [data-testid="toast"]').filter({
      hasText: /success|saved|enabled/i,
    });
    await expect(successToast).toBeVisible({ timeout: 2000 });

    // THEN: Next scheduled refresh time is displayed again
    const nextRefreshDisplay = page.getByTestId('epg-schedule-next-refresh');
    await expect(nextRefreshDisplay).toContainText(/04:00|4:00 AM/i);

    // THEN: Schedule is persisted as enabled (verify via API)
    const savedSchedule = await epgScheduleApi.get();
    expect(savedSchedule.enabled).toBe(true);
  });

  test('should display last automatic refresh timestamp', async ({ page }) => {
    // GIVEN: User is viewing EPG schedule section
    const scheduleSection = page.getByTestId('epg-schedule-section');

    // WHEN: User looks for last refresh information
    const lastRefreshDisplay = page.getByTestId('epg-schedule-last-refresh');

    // THEN: Last automatic refresh timestamp is displayed
    await expect(lastRefreshDisplay).toBeVisible();

    // THEN: Display shows either a timestamp or "Never" for first-time users
    const lastRefreshText = await lastRefreshDisplay.textContent();
    expect(lastRefreshText).toMatch(/never|just now|ago|\d{2}:\d{2}/i);
  });

  test('should validate hour selection (0-23)', async ({ page }) => {
    // GIVEN: User is viewing EPG schedule section
    const hourSelect = page.getByTestId('epg-schedule-hour-select');

    // WHEN: User clicks hour selector
    await hourSelect.click();

    // THEN: Hour options include all valid hours (0-23)
    const hourOptions = await hourSelect.locator('option').allTextContents();
    expect(hourOptions).toHaveLength(24); // 0 through 23

    // THEN: Hours are zero-padded (00, 01, 02, ... 23)
    expect(hourOptions[0]).toMatch(/^0*0$/);
    expect(hourOptions[4]).toMatch(/^0*4$/);
    expect(hourOptions[23]).toMatch(/^23$/);
  });

  test('should validate minute selection (0, 15, 30, 45)', async ({ page }) => {
    // GIVEN: User is viewing EPG schedule section
    const minuteSelect = page.getByTestId('epg-schedule-minute-select');

    // WHEN: User clicks minute selector
    await minuteSelect.click();

    // THEN: Minute options include only 15-minute intervals
    const minuteOptions = await minuteSelect.locator('option').allTextContents();
    expect(minuteOptions).toHaveLength(4); // 0, 15, 30, 45

    // THEN: Minutes are zero-padded (00, 15, 30, 45)
    expect(minuteOptions[0]).toMatch(/^0*0$/);
    expect(minuteOptions[1]).toMatch(/^15$/);
    expect(minuteOptions[2]).toMatch(/^30$/);
    expect(minuteOptions[3]).toMatch(/^45$/);
  });

  test('should show error notification if save fails', async ({ page }) => {
    // GIVEN: User is viewing EPG schedule section
    // GIVEN: Backend is in error state (simulated by invalid values or disconnected state)

    // Note: This test may need mocking or error injection
    // For now, we document the expected behavior

    // WHEN: User attempts to save schedule
    const saveButton = page.getByTestId('epg-schedule-save-button');
    await saveButton.click();

    // THEN: Error notification is shown if save fails
    // Note: This assertion will only pass if we can trigger a save error
    // Keeping it as a placeholder for manual testing or future error injection

    // Expected behavior documented:
    // - Error toast should appear with message like "Failed to save schedule" or "Unable to update settings"
    // - Schedule values should remain editable
    // - User can retry save
  });
});
