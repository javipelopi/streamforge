import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Story 5.4: EPG TV-Style Layout Foundation
 *
 * Tests the basic three-panel layout structure with gradient background
 * and conditional visibility of the right details panel.
 */

test.describe('EPG TV-Style Layout', () => {
  test('should display three-panel layout with gradient background', async ({ page }) => {
    // GIVEN: User navigates to EPG TV view
    await page.goto('/epg-tv');

    // THEN: Gradient background is visible
    const background = page.getByTestId('epg-background');
    await expect(background).toBeVisible();

    // Verify gradient is applied
    const bgStyles = await background.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        position: computed.position,
        background: computed.background,
        backgroundImage: computed.backgroundImage,
      };
    });
    expect(bgStyles.position).toBe('fixed');
    expect(bgStyles.backgroundImage).toContain('linear-gradient');

    // AND: Three panels are visible with correct structure
    const leftPanel = page.getByTestId('epg-left-panel');
    const centerPanel = page.getByTestId('epg-center-panel');
    const rightPanel = page.getByTestId('epg-right-panel');

    await expect(leftPanel).toBeVisible();
    await expect(centerPanel).toBeVisible();
    await expect(rightPanel).toBeVisible();

    // AND: Panels have correct relative widths (left ~30%, center ~30%, right ~40%)
    const panelWidths = await page.evaluate(() => {
      const left = document.querySelector('[data-testid="epg-left-panel"]') as HTMLElement;
      const center = document.querySelector('[data-testid="epg-center-panel"]') as HTMLElement;
      const right = document.querySelector('[data-testid="epg-right-panel"]') as HTMLElement;

      return {
        left: left?.offsetWidth || 0,
        center: center?.offsetWidth || 0,
        right: right?.offsetWidth || 0,
      };
    });

    // Verify width proportions (allowing 5% tolerance)
    const total = panelWidths.left + panelWidths.center + panelWidths.right;
    const leftPercent = (panelWidths.left / total) * 100;
    const centerPercent = (panelWidths.center / total) * 100;
    const rightPercent = (panelWidths.right / total) * 100;

    expect(leftPercent).toBeGreaterThan(25); // ~30% target
    expect(leftPercent).toBeLessThan(35);
    expect(centerPercent).toBeGreaterThan(25); // ~30% target
    expect(centerPercent).toBeLessThan(35);
    expect(rightPercent).toBeGreaterThan(35); // ~40% target
    expect(rightPercent).toBeLessThan(45);

    // AND: Panels have semi-transparent dark backgrounds
    const panelBgColors = await page.evaluate(() => {
      const left = document.querySelector('[data-testid="epg-left-panel"]') as HTMLElement;
      const center = document.querySelector('[data-testid="epg-center-panel"]') as HTMLElement;
      const right = document.querySelector('[data-testid="epg-right-panel"]') as HTMLElement;

      return {
        left: window.getComputedStyle(left).backgroundColor,
        center: window.getComputedStyle(center).backgroundColor,
        right: window.getComputedStyle(right).backgroundColor,
      };
    });

    // Verify rgba backgrounds with opacity
    expect(panelBgColors.left).toMatch(/rgba?\(/);
    expect(panelBgColors.center).toMatch(/rgba?\(/);
    expect(panelBgColors.right).toMatch(/rgba?\(/);
  });

  test('should show only gradient background in right panel when no program selected', async ({ page }) => {
    // GIVEN: User navigates to EPG TV view
    await page.goto('/epg-tv');

    // WHEN: No program is selected (initial state)
    const rightPanel = page.getByTestId('epg-right-panel');
    await expect(rightPanel).toBeVisible();

    // THEN: Right panel should show gradient background only (empty state)
    // The details content should not be visible
    const detailsContent = rightPanel.locator('[data-testid="epg-details-content"]');
    await expect(detailsContent).not.toBeVisible();

    // AND: Left and center panels are visible
    await expect(page.getByTestId('epg-left-panel')).toBeVisible();
    await expect(page.getByTestId('epg-center-panel')).toBeVisible();
  });

  test('should display program details in right panel when program is selected', async ({ page }) => {
    // GIVEN: User navigates to EPG TV view
    await page.goto('/epg-tv');

    // WHEN: User toggles the test button to select a program (temporary test mechanism)
    const toggleButton = page.getByTestId('toggle-details-visibility');
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();

    // THEN: Right panel displays program details content
    const rightPanel = page.getByTestId('epg-right-panel');
    await expect(rightPanel).toBeVisible();

    const detailsContent = rightPanel.locator('[data-testid="epg-details-content"]');
    await expect(detailsContent).toBeVisible();

    // AND: Details content shows placeholder text
    await expect(detailsContent).toContainText('Program details');
  });

  test('should render placeholder content in left and center panels', async ({ page }) => {
    // GIVEN: User navigates to EPG TV view
    await page.goto('/epg-tv');

    // THEN: Left panel shows channel list placeholder
    const leftPanel = page.getByTestId('epg-left-panel');
    await expect(leftPanel).toContainText('Channel list');

    // AND: Center panel shows schedule placeholder
    const centerPanel = page.getByTestId('epg-center-panel');
    await expect(centerPanel).toContainText('Schedule panel');
  });

  test('should maintain layout structure on window resize', async ({ page }) => {
    // GIVEN: User navigates to EPG TV view
    await page.goto('/epg-tv');

    // WHEN: Window is resized to a different width
    await page.setViewportSize({ width: 1600, height: 900 });

    // THEN: All three panels remain visible
    await expect(page.getByTestId('epg-left-panel')).toBeVisible();
    await expect(page.getByTestId('epg-center-panel')).toBeVisible();
    await expect(page.getByTestId('epg-right-panel')).toBeVisible();

    // AND: Gradient background remains visible
    await expect(page.getByTestId('epg-background')).toBeVisible();

    // WHEN: Window is resized to smaller width
    await page.setViewportSize({ width: 1280, height: 720 });

    // THEN: Layout still maintains three-panel structure
    await expect(page.getByTestId('epg-left-panel')).toBeVisible();
    await expect(page.getByTestId('epg-center-panel')).toBeVisible();
    await expect(page.getByTestId('epg-right-panel')).toBeVisible();
  });
});
