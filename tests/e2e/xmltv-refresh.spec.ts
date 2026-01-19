import { test, expect } from '@playwright/test';
import { createNewXmltvSource } from '../support/factories/xmltv-source.factory';

/**
 * E2E Tests for Story 2-5: Parse and Store XMLTV EPG Data
 *
 * These tests verify the complete user journey for refreshing EPG data
 * in the Accounts view. All tests are in RED phase - they will fail until
 * the implementation is complete.
 *
 * Test Strategy:
 * - E2E level: Tests full user interactions from Accounts view
 * - Given-When-Then format for clarity
 * - data-testid selectors for resilience
 * - Focuses on UI feedback and state updates
 */

test.describe('EPG Refresh User Interface', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: User navigates to Accounts view
    await page.goto('/accounts');

    // Wait for page to be ready
    await page.waitForLoadState('networkidle');

    // GIVEN: User has at least one EPG source configured
    // Add a test source if none exists
    const addButton = page.getByTestId('add-epg-source-button');
    if (await addButton.isVisible()) {
      const newSource = createNewXmltvSource({
        name: 'Test EPG Source',
        url: 'https://example.com/test-epg.xml',
        format: 'xml',
      });

      await addButton.click();
      await page.getByTestId('epg-source-name').fill(newSource.name);
      await page.getByTestId('epg-source-url').fill(newSource.url);
      await page.getByTestId('epg-source-format').selectOption(newSource.format);
      await page.getByTestId('epg-source-submit').click();

      // Wait for dialog to close
      await expect(page.getByTestId('epg-source-dialog')).not.toBeVisible();
    }
  });

  test('should display Refresh EPG button for each source', async ({ page }) => {
    // GIVEN: User is viewing EPG sources list
    const sourcesList = page.getByTestId('epg-sources-list');
    await expect(sourcesList).toBeVisible();

    // WHEN: User looks for refresh controls
    const sourceItem = sourcesList.locator('[data-testid^="epg-source-item-"]').first();
    await expect(sourceItem).toBeVisible();

    // THEN: Each source has a Refresh EPG button
    const refreshButton = sourceItem.getByTestId(/refresh-epg-source-/);
    await expect(refreshButton).toBeVisible();
    await expect(refreshButton).toHaveText(/Refresh|Refresh EPG/i);

    // THEN: Each source displays last refresh status
    const lastRefreshDisplay = sourceItem.getByTestId(/epg-source-last-refresh-/);
    await expect(lastRefreshDisplay).toBeVisible();

    // THEN: Each source displays EPG stats (channels/programs count)
    const statsDisplay = sourceItem.getByTestId(/epg-source-stats-/);
    await expect(statsDisplay).toBeVisible();
  });

  test('should refresh EPG and show updated data in UI', async ({ page }) => {
    // GIVEN: User is viewing an EPG source
    const sourcesList = page.getByTestId('epg-sources-list');
    const sourceItem = sourcesList.locator('[data-testid^="epg-source-item-"]').first();

    // Get initial stats if displayed
    const statsDisplay = sourceItem.getByTestId(/epg-source-stats-/);
    const initialStatsText = await statsDisplay.textContent();

    // WHEN: User clicks Refresh EPG button
    const refreshButton = sourceItem.getByTestId(/refresh-epg-source-/);
    await refreshButton.click();

    // THEN: Loading state is displayed during refresh
    const loadingSpinner = sourceItem.getByTestId(/epg-source-refreshing-/);
    await expect(loadingSpinner).toBeVisible({ timeout: 1000 });

    // THEN: Loading state disappears when refresh completes
    await expect(loadingSpinner).not.toBeVisible({ timeout: 35000 }); // Max 30s + buffer

    // THEN: Success notification is shown
    const successToast = page.locator('.toast, [role="status"], [data-testid="toast"]').filter({
      hasText: /success|refreshed|updated/i,
    });
    await expect(successToast).toBeVisible({ timeout: 2000 });

    // THEN: Last refresh timestamp is updated
    const lastRefreshDisplay = sourceItem.getByTestId(/epg-source-last-refresh-/);
    const lastRefreshText = await lastRefreshDisplay.textContent();
    expect(lastRefreshText).toMatch(/just now|seconds ago|minutes ago/i);

    // THEN: EPG stats are displayed (channels and programs count)
    const updatedStatsText = await statsDisplay.textContent();
    expect(updatedStatsText).toMatch(/\d+\s+(channel|channels)/i);
    expect(updatedStatsText).toMatch(/\d+\s+(program|programs)/i);
  });

  test('should show error notification when refresh fails', async ({ page }) => {
    // GIVEN: User has an EPG source with invalid/unreachable URL
    const invalidSource = createNewXmltvSource({
      name: 'Invalid EPG Source',
      url: 'https://nonexistent-domain-12345.invalid/epg.xml',
      format: 'xml',
    });

    // Add invalid source
    await page.getByTestId('add-epg-source-button').click();
    await page.getByTestId('epg-source-name').fill(invalidSource.name);
    await page.getByTestId('epg-source-url').fill(invalidSource.url);
    await page.getByTestId('epg-source-format').selectOption(invalidSource.format);
    await page.getByTestId('epg-source-submit').click();

    // Wait for source to appear
    await expect(page.getByTestId('epg-sources-list')).toContainText(invalidSource.name);

    // WHEN: User clicks Refresh EPG button for invalid source
    const sourceItem = page.getByTestId('epg-sources-list')
      .locator('[data-testid^="epg-source-item-"]')
      .filter({ hasText: invalidSource.name });

    const refreshButton = sourceItem.getByTestId(/refresh-epg-source-/);
    await refreshButton.click();

    // THEN: Error notification is shown
    const errorToast = page.locator('.toast, [role="status"], [data-testid="toast"]').filter({
      hasText: /error|failed|unable/i,
    });
    await expect(errorToast).toBeVisible({ timeout: 35000 });

    // THEN: Error message describes the problem
    const errorText = await errorToast.textContent();
    expect(errorText).toMatch(/download|fetch|connect|network/i);
  });

  test('should display Refresh All button for bulk refresh', async ({ page }) => {
    // GIVEN: User has multiple EPG sources
    const sourcesList = page.getByTestId('epg-sources-list');

    // WHEN: User looks for bulk refresh option
    const refreshAllButton = page.getByTestId('refresh-all-epg-sources');

    // THEN: Refresh All button is visible
    await expect(refreshAllButton).toBeVisible();
    await expect(refreshAllButton).toHaveText(/Refresh All|Refresh All Sources/i);
  });

  test('should refresh all sources when Refresh All is clicked', async ({ page }) => {
    // GIVEN: User has multiple EPG sources
    // Add second source if needed
    const sourcesList = page.getByTestId('epg-sources-list');
    const sourceCount = await sourcesList.locator('[data-testid^="epg-source-item-"]').count();

    if (sourceCount < 2) {
      const secondSource = createNewXmltvSource({
        name: 'Second EPG Source',
        url: 'https://example.com/second-epg.xml',
        format: 'xml',
      });

      await page.getByTestId('add-epg-source-button').click();
      await page.getByTestId('epg-source-name').fill(secondSource.name);
      await page.getByTestId('epg-source-url').fill(secondSource.url);
      await page.getByTestId('epg-source-format').selectOption(secondSource.format);
      await page.getByTestId('epg-source-submit').click();
      await expect(page.getByTestId('epg-source-dialog')).not.toBeVisible();
    }

    // WHEN: User clicks Refresh All button
    const refreshAllButton = page.getByTestId('refresh-all-epg-sources');
    await refreshAllButton.click();

    // THEN: Loading state is shown for all sources
    const sourceItems = sourcesList.locator('[data-testid^="epg-source-item-"]');
    const firstItem = sourceItems.first();
    const loadingSpinner = firstItem.getByTestId(/epg-source-refreshing-/);
    await expect(loadingSpinner).toBeVisible({ timeout: 2000 });

    // THEN: Success notification is shown when complete
    const successToast = page.locator('.toast, [role="status"], [data-testid="toast"]').filter({
      hasText: /success|refreshed|completed/i,
    });
    await expect(successToast).toBeVisible({ timeout: 60000 }); // Longer timeout for bulk

    // THEN: All sources show updated last refresh timestamps
    const allItems = await sourceItems.all();
    for (const item of allItems) {
      const lastRefreshDisplay = item.getByTestId(/epg-source-last-refresh-/);
      const lastRefreshText = await lastRefreshDisplay.textContent();
      expect(lastRefreshText).toMatch(/just now|seconds ago|minutes ago/i);
    }
  });
});
