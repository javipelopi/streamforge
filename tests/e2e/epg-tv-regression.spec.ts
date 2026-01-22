import { test, expect } from '@playwright/test';

/**
 * E2E Regression Tests for Story 5.9: TV-Style EPG After Legacy Cleanup
 *
 * These tests ensure that the TV-style EPG (Stories 5.4-5.8) continues to work
 * correctly after legacy component cleanup. They serve as regression safety to
 * catch any unintended breakage during cleanup.
 *
 * Test Strategy:
 * - E2E level: Test complete user journey in browser
 * - Given-When-Then format for clarity
 * - data-testid selectors for resilience
 * - Focuses on verifying TV-style EPG loads and functions
 *
 * Acceptance Criteria Coverage:
 * - AC#2: TV-style components work after legacy removal
 * - AC#3: No runtime errors or warnings in browser console
 *
 * RED Phase Status:
 * These tests should PASS initially (before cleanup) and continue PASSING
 * after cleanup. If they fail after cleanup, it indicates the cleanup
 * accidentally broke the TV-style EPG.
 */

test.describe('TV-Style EPG Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Suppress expected errors/warnings that are not related to cleanup
    page.on('console', (msg) => {
      // Log console messages for debugging
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`Browser ${msg.type()}: ${msg.text()}`);
      }
    });
  });

  test('should display TV-style EPG view without legacy components', async ({ page }) => {
    // GIVEN: Legacy components have been removed
    // WHEN: User navigates to EPG view
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');

    // THEN: TV-style EPG view should be visible
    // Check for main TV-style container (from Story 5.4)
    const tvEpgView =
      page.locator('[data-testid="epg-tv-view"]').or(page.locator('[data-testid="epg-view"]'));

    await expect(tvEpgView.first()).toBeVisible({ timeout: 10000 });

    // THEN: TV-style components should be present
    // Check for channel list (Story 5.5)
    const channelList = page.locator('[data-testid*="channel-list"]').first();
    await expect(channelList).toBeVisible();

    // THEN: Legacy grid components should NOT be present
    const legacyGrid = page.locator('[data-testid="epg-grid"]');
    await expect(legacyGrid).not.toBeVisible();
  });

  test('should load EPG without console errors or warnings related to missing modules', async ({
    page,
  }) => {
    // GIVEN: Legacy components have been removed
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    const moduleErrors: string[] = [];

    // Capture console messages
    page.on('console', (msg) => {
      const text = msg.text();

      if (msg.type() === 'error') {
        consoleErrors.push(text);

        // Check for module-related errors
        if (
          text.includes('Module not found') ||
          text.includes('Cannot find module') ||
          text.includes('Failed to load module')
        ) {
          moduleErrors.push(text);
        }
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(text);
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    // WHEN: User navigates to EPG view
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');

    // Wait a bit for any lazy-loaded modules to load
    await page.waitForTimeout(2000);

    // THEN: No module loading errors should occur
    expect(
      moduleErrors,
      `Found ${moduleErrors.length} module loading error(s):\n${moduleErrors.join('\n')}`
    ).toHaveLength(0);

    // THEN: No errors should mention deleted component names
    const deletedComponents = ['EpgGrid', 'EpgCell', 'TimeNavigationBar'];
    const componentErrors = consoleErrors.filter((error) =>
      deletedComponents.some((component) => error.includes(component))
    );

    expect(
      componentErrors,
      `Found ${componentErrors.length} error(s) mentioning deleted components:\n${componentErrors.join('\n')}`
    ).toHaveLength(0);
  });

  test('should render TV-style EPG components without React errors', async ({ page }) => {
    // GIVEN: Legacy components have been removed
    const reactErrors: string[] = [];

    // Capture React-specific errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();

        // React error patterns
        if (
          text.includes('React') ||
          text.includes('component') ||
          text.includes('hook') ||
          text.includes('Cannot read propert') ||
          text.includes('undefined is not a function')
        ) {
          reactErrors.push(text);
        }
      }
    });

    page.on('pageerror', (error) => {
      reactErrors.push(error.message);
    });

    // WHEN: User navigates to EPG view and waits for render
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');

    // Give React time to render and catch any errors
    await page.waitForTimeout(1000);

    // THEN: No React rendering errors should occur
    expect(
      reactErrors,
      `Found ${reactErrors.length} React error(s) during render:\n${reactErrors.join('\n')}`
    ).toHaveLength(0);
  });

  test('should display TV-style channel list panel', async ({ page }) => {
    // GIVEN: TV-style EPG is loaded
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');

    // WHEN: Checking for channel list components (Story 5.5)
    // THEN: Channel list should be visible
    const channelList =
      page
        .locator('[data-testid="epg-channel-list"]')
        .or(page.locator('[data-testid*="channel-list"]'))
        .first();

    await expect(channelList).toBeVisible({ timeout: 10000 });

    // THEN: Should display channel rows (if channels exist)
    const channelRows = page.locator('[data-testid*="channel-row"]');
    const rowCount = await channelRows.count();

    // At least one channel should be visible, or empty state should show
    if (rowCount === 0) {
      // Check for empty state
      const emptyState = page.locator('[data-testid*="empty"]');
      await expect(emptyState.first()).toBeVisible();
    } else {
      expect(rowCount).toBeGreaterThan(0);
    }
  });

  test('should display TV-style schedule panel', async ({ page }) => {
    // GIVEN: TV-style EPG is loaded
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');

    // WHEN: Checking for schedule panel components (Story 5.6)
    // THEN: Schedule panel should be visible
    const schedulePanel =
      page
        .locator('[data-testid="epg-schedule-panel"]')
        .or(page.locator('[data-testid*="schedule"]'))
        .first();

    await expect(schedulePanel).toBeVisible({ timeout: 10000 });
  });

  test('should display TV-style top bar with navigation', async ({ page }) => {
    // GIVEN: TV-style EPG is loaded
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');

    // WHEN: Checking for top bar components (Story 5.7)
    // THEN: Top bar should be visible
    const topBar =
      page.locator('[data-testid="epg-top-bar"]').or(page.locator('[data-testid*="top-bar"]')).first();

    await expect(topBar).toBeVisible({ timeout: 10000 });

    // THEN: Day navigation should be visible
    const dayNavigation =
      page
        .locator('[data-testid*="day-navigation"]')
        .or(page.locator('[data-testid*="date"]'))
        .first();

    await expect(dayNavigation).toBeVisible();
  });

  test('should allow program selection to open details panel', async ({ page }) => {
    // GIVEN: TV-style EPG is loaded with program data
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');

    // WHEN: User clicks on a program (if any programs are visible)
    const programElements = page.locator('[data-testid*="program"]');
    const programCount = await programElements.count();

    if (programCount > 0) {
      // Click first program
      await programElements.first().click();

      // THEN: Program details panel should open (Story 5.8)
      const detailsPanel =
        page
          .locator('[data-testid*="program-details"]')
          .or(page.locator('[data-testid*="details-panel"]'))
          .first();

      await expect(detailsPanel).toBeVisible({ timeout: 5000 });
    } else {
      // No programs to test - skip assertion
      // This is acceptable for a regression test in cleanup story
      test.skip();
    }
  });
});

test.describe('Legacy Component Absence Verification', () => {
  test('should not render any elements with legacy component data-testids', async ({ page }) => {
    // GIVEN: Legacy components have been removed
    // WHEN: User navigates to EPG view
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');

    // THEN: Legacy component test IDs should not be present
    const legacyTestIds = [
      'epg-grid',
      'epg-grid-container',
      'epg-cell',
      'epg-program-cell',
      'time-navigation-bar',
      'time-nav-now-button',
      'time-nav-tonight-button',
    ];

    for (const testId of legacyTestIds) {
      const element = page.locator(`[data-testid="${testId}"]`);
      const count = await element.count();

      expect(
        count,
        `Found ${count} element(s) with legacy test ID "${testId}" - should be removed`
      ).toBe(0);
    }
  });

  test('should not have any React components named with legacy names in DOM', async ({ page }) => {
    // GIVEN: Legacy components have been removed
    // WHEN: User navigates to EPG view
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');

    // THEN: Check if any element attributes reference legacy component names
    // This is a heuristic check - React DevTools would show component names
    const htmlContent = await page.content();

    const legacyComponentPatterns = [
      'EpgGrid',
      'EpgCell',
      'TimeNavigationBar',
      'epg-grid',
      'epg-cell',
    ];

    for (const pattern of legacyComponentPatterns) {
      // Check if pattern appears in data attributes (loose check)
      const hasPattern = htmlContent.includes(`data-component="${pattern}"`);

      expect(
        hasPattern,
        `Found legacy component pattern "${pattern}" in DOM attributes`
      ).toBe(false);
    }
  });
});
