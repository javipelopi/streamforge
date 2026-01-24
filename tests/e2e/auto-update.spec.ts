import { test, expect } from '@playwright/test';
import {
  injectUpdateAvailableMock,
  injectUpdateNotAvailableMock,
  injectUpdateMockWithSettings,
} from '../support/fixtures/update.fixture';

/**
 * E2E Tests for Story 6.5: Auto-Update Mechanism
 *
 * Tests the automatic update functionality including:
 * - Settings UI for update configuration
 * - Update check functionality
 * - Update notification and release notes
 * - Auto-check on launch
 * - Remind Later functionality
 *
 * Run with: pnpm test -- tests/e2e/auto-update.spec.ts
 */

test.describe('Auto-Update - Settings View', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: Inject update mock before navigation
    await injectUpdateNotAvailableMock(page);

    // Navigate to Settings view
    await page.goto('/');
    await page.click('[data-testid="settings-nav-link"]');
    await expect(page).toHaveURL('/settings');
  });

  test('should display Updates section with all required elements', async ({ page }) => {
    // GIVEN: User is on Settings view (from beforeEach)

    // WHEN: Settings view loads
    // (navigation already complete)

    // THEN: Updates section is visible with all required elements
    const updatesSection = page.locator('[data-testid="updates-section"]');
    await expect(updatesSection).toBeVisible();

    // Current version display
    const versionDisplay = page.locator('[data-testid="current-version-display"]');
    await expect(versionDisplay).toBeVisible();
    await expect(versionDisplay).toContainText('1.1.0'); // Mock version

    // Check for Updates button
    const checkButton = page.locator('[data-testid="check-for-updates-button"]');
    await expect(checkButton).toBeVisible();
    await expect(checkButton).toHaveText(/check.*updates/i);

    // Auto-check toggle
    const autoCheckToggle = page.locator('[data-testid="auto-check-updates-toggle"]');
    await expect(autoCheckToggle).toBeVisible();

    // Last check timestamp (may not be visible initially)
    const lastCheckDisplay = page.locator('[data-testid="last-update-check-display"]');
    // Note: This may not be visible if no check has been performed yet
  });

  test('should display current version correctly', async ({ page }) => {
    // GIVEN: User is on Settings view
    // (from beforeEach)

    // WHEN: Updates section loads
    const versionDisplay = page.locator('[data-testid="current-version-display"]');
    await expect(versionDisplay).toBeVisible();

    // THEN: Current version is displayed (from mock)
    await expect(versionDisplay).toContainText('1.1.0');
  });
});

test.describe('Auto-Update - Check for Updates', () => {
  test.beforeEach(async ({ page }) => {
    // Inject update mock before navigation
    await injectUpdateNotAvailableMock(page);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should trigger update check when button clicked', async ({ page }) => {
    // GIVEN: User is on Settings view
    const checkButton = page.locator('[data-testid="check-for-updates-button"]');
    await expect(checkButton).toBeVisible();

    // WHEN: User clicks Check for Updates button
    await checkButton.click();

    // THEN: Loading state is shown
    const spinner = page.locator('[data-testid="update-checking-spinner"]');
    await expect(spinner).toBeVisible();

    // AND: Last check timestamp is updated after check completes
    // Wait for spinner to disappear
    await expect(spinner).not.toBeVisible({ timeout: 5000 });

    const lastCheckDisplay = page.locator('[data-testid="last-update-check-display"]');
    await expect(lastCheckDisplay).toBeVisible();
  });

  test('should show success message when no update available', async ({ page }) => {
    // GIVEN: User is on Settings view with no update available
    // (mock already injected in beforeEach)

    // WHEN: User clicks Check for Updates
    await page.click('[data-testid="check-for-updates-button"]');

    // Wait for check to complete
    await page.waitForTimeout(200);

    // THEN: Success/info message appears
    // Note: Implementation may use toast or inline message
    // This test will need adjustment based on actual UI design
    const message = page.locator('text=/up to date|no.*update/i');
    await expect(message).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Auto-Update - Auto-Check Toggle', () => {
  test.beforeEach(async ({ page }) => {
    // Inject update mock with auto-check enabled
    await injectUpdateMockWithSettings(page, { autoCheck: true });
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should persist auto-check setting when toggled', async ({ page }) => {
    // GIVEN: Auto-check is currently enabled
    const autoCheckToggle = page.locator('[data-testid="auto-check-updates-toggle"]');
    await expect(autoCheckToggle).toBeVisible({ timeout: 1000 });
    await expect(autoCheckToggle).toHaveAttribute('aria-checked', 'true');

    // WHEN: User disables auto-check (click on the toggle's parent label for sr-only inputs)
    const toggleLabel = page.locator('label:has([data-testid="auto-check-updates-toggle"])');
    await toggleLabel.click();
    await expect(autoCheckToggle).toHaveAttribute('aria-checked', 'false');

    // Save settings (may be auto-save or explicit save button)
    // Check if save button exists
    const saveButton = page.locator('[data-testid="save-settings-button"]');
    const saveButtonExists = await saveButton.count() > 0;
    if (saveButtonExists) {
      await saveButton.click();
    }

    // THEN: Reload page and verify setting persisted
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Auto-check toggle should remain disabled
    await expect(autoCheckToggle).toHaveAttribute('aria-checked', 'false');
  });

  test('should enable auto-check when toggled on', async ({ page }) => {
    // Re-inject with auto-check disabled
    await injectUpdateMockWithSettings(page, { autoCheck: false });
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // GIVEN: Auto-check is currently disabled
    const autoCheckToggle = page.locator('[data-testid="auto-check-updates-toggle"]');
    await expect(autoCheckToggle).toHaveAttribute('aria-checked', 'false');

    // WHEN: User enables auto-check (click on the toggle's parent label for sr-only inputs)
    const toggleLabel = page.locator('label:has([data-testid="auto-check-updates-toggle"])');
    await toggleLabel.click();
    await expect(autoCheckToggle).toHaveAttribute('aria-checked', 'true');

    // Save if needed
    const saveButton = page.locator('[data-testid="save-settings-button"]');
    const saveButtonExists = await saveButton.count() > 0;
    if (saveButtonExists) {
      await saveButton.click();
    }

    // THEN: Setting is persisted
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(autoCheckToggle).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('Auto-Update - Update Notification', () => {
  test.beforeEach(async ({ page }) => {
    // Inject mock with update available
    await injectUpdateAvailableMock(page);
  });

  test('should display update notification when update available', async ({ page }) => {
    // GIVEN: Update is available (mock injected in beforeEach)

    // WHEN: User navigates to app (triggers auto-check on launch)
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for auto-check to complete (delayed slightly after launch)
    await page.waitForTimeout(2500);

    // THEN: Update notification dialog appears
    const notificationDialog = page.locator('[data-testid="update-notification-dialog"]');
    await expect(notificationDialog).toBeVisible({ timeout: 5000 });

    // AND: New version is displayed
    const versionDisplay = page.locator('[data-testid="update-version-display"]');
    await expect(versionDisplay).toBeVisible();
    await expect(versionDisplay).toContainText('1.2.0');
  });

  test('should display release notes when View Release Notes clicked', async ({ page }) => {
    // GIVEN: Update notification is visible
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);

    const notificationDialog = page.locator('[data-testid="update-notification-dialog"]');
    await expect(notificationDialog).toBeVisible({ timeout: 5000 });

    // WHEN: User clicks View Release Notes button
    const releaseNotesButton = page.locator('[data-testid="update-release-notes-button"]');
    await expect(releaseNotesButton).toBeVisible();
    await releaseNotesButton.click();

    // THEN: Release notes content is displayed
    const releaseNotesContent = page.locator('[data-testid="update-release-notes-content"]');
    await expect(releaseNotesContent).toBeVisible();
    await expect(releaseNotesContent).toContainText('Auto-update mechanism');
  });

  test('should have Download & Install button', async ({ page }) => {
    // GIVEN: Update notification is visible
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);

    const notificationDialog = page.locator('[data-testid="update-notification-dialog"]');
    await expect(notificationDialog).toBeVisible({ timeout: 5000 });

    // WHEN: User looks at the dialog
    // (already visible)

    // THEN: Download & Install button is present
    const installButton = page.locator('[data-testid="update-download-install-button"]');
    await expect(installButton).toBeVisible();
    await expect(installButton).toHaveText(/download.*install/i);
  });
});

test.describe('Auto-Update - Remind Later', () => {
  test.beforeEach(async ({ page }) => {
    // Inject mock with update available
    await injectUpdateAvailableMock(page);
  });

  test('should dismiss notification when Remind Later clicked', async ({ page }) => {
    // GIVEN: Update notification is visible
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);

    const notificationDialog = page.locator('[data-testid="update-notification-dialog"]');
    await expect(notificationDialog).toBeVisible({ timeout: 5000 });

    // WHEN: User clicks Remind Later button
    const remindLaterButton = page.locator('[data-testid="update-remind-later-button"]');
    await expect(remindLaterButton).toBeVisible();
    await remindLaterButton.click();

    // THEN: Notification dialog is dismissed
    await expect(notificationDialog).not.toBeVisible();
  });

  test('should not show notification again immediately after Remind Later', async ({ page }) => {
    // GIVEN: User has dismissed notification with Remind Later
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);

    const notificationDialog = page.locator('[data-testid="update-notification-dialog"]');
    await expect(notificationDialog).toBeVisible({ timeout: 5000 });

    const remindLaterButton = page.locator('[data-testid="update-remind-later-button"]');
    await remindLaterButton.click();
    await expect(notificationDialog).not.toBeVisible();

    // WHEN: User reloads the app immediately
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);

    // THEN: Notification does not appear (snoozed)
    // Use a shorter timeout since we expect it NOT to appear
    await expect(notificationDialog).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('Auto-Update - Last Check Timestamp', () => {
  test.beforeEach(async ({ page }) => {
    await injectUpdateNotAvailableMock(page);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should display last check timestamp after manual check', async ({ page }) => {
    // GIVEN: User is on Settings view
    const checkButton = page.locator('[data-testid="check-for-updates-button"]');
    await expect(checkButton).toBeVisible();

    // WHEN: User performs a manual update check
    await checkButton.click();

    // Wait for check to complete
    await page.waitForTimeout(300);

    // THEN: Last check timestamp is displayed
    const lastCheckDisplay = page.locator('[data-testid="last-update-check-display"]');
    await expect(lastCheckDisplay).toBeVisible();

    // Should show relative time or absolute timestamp
    // Examples: "Just now", "1 minute ago", "2026-01-24 10:30 AM"
    await expect(lastCheckDisplay).toContainText(/just now|ago|checked/i);
  });
});
