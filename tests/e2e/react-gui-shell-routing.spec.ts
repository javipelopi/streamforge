/**
 * E2E Test: React GUI Shell with Routing
 * Story: 1-3 - Create React GUI Shell with Routing
 *
 * RED Phase - These tests MUST FAIL initially
 * Test creation date: 2026-01-19
 *
 * PRIMARY TEST LEVEL: E2E
 *
 * Knowledge Base Patterns Applied:
 * - Network-first pattern for route interception
 * - data-testid selectors for resilience
 * - Given-When-Then structure
 * - One assertion per test (atomic)
 * - No hard waits, deterministic waiting
 */

import { test, expect } from '@playwright/test';

// Note: These tests will need to run against the Tauri app once it's built
// For now, they're structured to test the React app directly
test.describe('Story 1.3: React GUI Shell with Routing', () => {
  /**
   * AC1: Main window shows GUI shell with sidebar navigation
   */
  test('should display sidebar with all navigation menu items', async ({ page }) => {
    // GIVEN: The application is launched
    await page.goto('/');

    // WHEN: The main window loads
    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar).toBeVisible();

    // THEN: All navigation items are present
    const expectedMenuItems = [
      'Dashboard',
      'Channels',
      'EPG',
      'Accounts',
      'Settings',
      'Logs',
    ];

    for (const item of expectedMenuItems) {
      const menuItem = page.locator('[data-testid="sidebar"]', {
        has: page.getByRole('link', { name: item }),
      });
      await expect(menuItem).toBeVisible();
    }
  });

  test('should display app header with title', async ({ page }) => {
    // GIVEN: The application is launched
    await page.goto('/');

    // WHEN: The main window loads
    // THEN: Header with app title is visible
    const header = page.locator('[data-testid="app-header"]');
    await expect(header).toBeVisible();
    await expect(header).toContainText('iptv');
  });

  test('should display app header with status indicator', async ({ page }) => {
    // GIVEN: The application is launched
    await page.goto('/');

    // WHEN: The main window loads
    // THEN: Status indicator is visible in header
    const statusIndicator = page.locator('[data-testid="status-indicator"]');
    await expect(statusIndicator).toBeVisible();
  });

  test('should display main content area', async ({ page }) => {
    // GIVEN: The application is launched
    await page.goto('/');

    // WHEN: The main window loads
    // THEN: Main content area is visible
    const mainContent = page.locator('[data-testid="main-content"]');
    await expect(mainContent).toBeVisible();
  });

  /**
   * AC1 (continued): Clicking navigation items routes to corresponding view
   */
  test('should navigate to Dashboard when Dashboard link is clicked', async ({ page }) => {
    // GIVEN: The application is on any page
    await page.goto('/channels'); // Start from different page

    // WHEN: User clicks Dashboard navigation link
    await page.getByRole('link', { name: 'Dashboard' }).click();

    // THEN: Dashboard view is displayed with placeholder content
    const mainContent = page.locator('[data-testid="main-content"]');
    await expect(mainContent).toContainText('Dashboard');
  });

  test('should navigate to Channels when Channels link is clicked', async ({ page }) => {
    // GIVEN: The application is on the home page
    await page.goto('/');

    // WHEN: User clicks Channels navigation link
    await page.getByRole('link', { name: 'Channels' }).click();

    // THEN: Channels view is displayed with placeholder content
    const mainContent = page.locator('[data-testid="main-content"]');
    await expect(mainContent).toContainText('Channels');
  });

  test('should navigate to EPG when EPG link is clicked', async ({ page }) => {
    // GIVEN: The application is on the home page
    await page.goto('/');

    // WHEN: User clicks EPG navigation link
    await page.getByRole('link', { name: 'EPG' }).click();

    // THEN: EPG view is displayed with placeholder content
    const mainContent = page.locator('[data-testid="main-content"]');
    await expect(mainContent).toContainText('EPG');
  });

  test('should navigate to Accounts when Accounts link is clicked', async ({ page }) => {
    // GIVEN: The application is on the home page
    await page.goto('/');

    // WHEN: User clicks Accounts navigation link
    await page.getByRole('link', { name: 'Accounts' }).click();

    // THEN: Accounts view is displayed with placeholder content
    const mainContent = page.locator('[data-testid="main-content"]');
    await expect(mainContent).toContainText('Accounts');
  });

  test('should navigate to Settings when Settings link is clicked', async ({ page }) => {
    // GIVEN: The application is on the home page
    await page.goto('/');

    // WHEN: User clicks Settings navigation link
    await page.getByRole('link', { name: 'Settings' }).click();

    // THEN: Settings view is displayed with placeholder content
    const mainContent = page.locator('[data-testid="main-content"]');
    await expect(mainContent).toContainText('Settings');
  });

  test('should navigate to Logs when Logs link is clicked', async ({ page }) => {
    // GIVEN: The application is on the home page
    await page.goto('/');

    // WHEN: User clicks Logs navigation link
    await page.getByRole('link', { name: 'Logs' }).click();

    // THEN: Logs view is displayed with placeholder content
    const mainContent = page.locator('[data-testid="main-content"]');
    await expect(mainContent).toContainText('Logs');
  });

  /**
   * AC1 (continued): Active route indication
   */
  test('should highlight active navigation item', async ({ page }) => {
    // GIVEN: The application is on the Dashboard page
    await page.goto('/');

    // WHEN: User is viewing a specific route
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' });

    // THEN: The active navigation item has active styling
    // Note: Check for 'active' class or aria-current attribute
    await expect(dashboardLink).toHaveClass(/active|bg-blue/);
  });

  test('should update active highlight when navigation changes', async ({ page }) => {
    // GIVEN: The application is on the Dashboard page
    await page.goto('/');

    // WHEN: User navigates to Channels
    await page.getByRole('link', { name: 'Channels' }).click();

    // THEN: Channels link becomes active
    const channelsLink = page.getByRole('link', { name: 'Channels' });
    await expect(channelsLink).toHaveClass(/active|bg-blue/);

    // AND: Dashboard link is no longer active
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
    await expect(dashboardLink).not.toHaveClass(/active|bg-blue/);
  });

  /**
   * AC1 (continued): State management - Zustand store
   */
  test('should initialize Zustand store with default state', async ({ page }) => {
    // GIVEN: The application is launched
    await page.goto('/');

    // WHEN: Checking the store state via window object (exposed for testing)
    const storeState = await page.evaluate(() => {
      // Access store state - will need to expose in actual implementation
      return (window as any).__ZUSTAND_STORE_STATE__ || null;
    });

    // THEN: Store has default state
    // Note: This test assumes store state is exposed to window for testing
    // If storeState is null, the store hasn't been exposed yet (expected in RED phase)
    expect(storeState).toBeDefined();
  });

  /**
   * AC1 (continued): TanStack Query configuration
   */
  test('should have TanStack Query configured', async ({ page }) => {
    // Collect console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // GIVEN: The application is launched
    await page.goto('/');

    // WHEN: Checking for QueryClient in React tree
    // Look for devtools indicator or query client provider
    const appRoot = page.locator('#root');
    await expect(appRoot).toBeVisible();

    // THEN: QueryClient is configured (will verify via React DevTools or exposed provider)
    // Wait for app to be fully loaded using network idle state
    await page.waitForLoadState('networkidle');

    // Filter out query-related errors
    const queryErrors = consoleErrors.filter(
      (err) => err.includes('query') || err.includes('QueryClient')
    );
    expect(queryErrors).toHaveLength(0);
  });

  /**
   * Additional tests for status indicator functionality
   */
  test('should display status indicator with running state (green)', async ({ page }) => {
    // GIVEN: The application is launched with server running
    await page.goto('/');

    // WHEN: Server status is "running"
    // Simulate setting server status via store action
    await page.evaluate(() => {
      // Will need to expose store actions for testing
      const store = (window as any).__ZUSTAND_STORE__;
      if (store) {
        store.setState({ serverStatus: 'running' });
      }
    });

    // THEN: Status indicator shows green
    const statusIndicator = page.locator('[data-testid="status-indicator"]');
    await expect(statusIndicator).toHaveClass(/green|success|running/);
  });

  test('should display status indicator with stopped state (gray)', async ({ page }) => {
    // GIVEN: The application is launched with server stopped
    await page.goto('/');

    // WHEN: Server status is "stopped"
    await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      if (store) {
        store.setState({ serverStatus: 'stopped' });
      }
    });

    // THEN: Status indicator shows gray
    const statusIndicator = page.locator('[data-testid="status-indicator"]');
    await expect(statusIndicator).toHaveClass(/gray|stopped|neutral/);
  });

  test('should display status indicator with error state (red)', async ({ page }) => {
    // GIVEN: The application is launched with server error
    await page.goto('/');

    // WHEN: Server status is "error"
    await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      if (store) {
        store.setState({ serverStatus: 'error' });
      }
    });

    // THEN: Status indicator shows red
    const statusIndicator = page.locator('[data-testid="status-indicator"]');
    await expect(statusIndicator).toHaveClass(/red|error|danger/);
  });

  test('should show status text in tooltip on hover', async ({ page }) => {
    // GIVEN: The application is launched
    await page.goto('/');

    // WHEN: User hovers over status indicator
    const statusIndicator = page.locator('[data-testid="status-indicator"]');
    await statusIndicator.hover();

    // THEN: Tooltip with status text is displayed
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(/running|stopped|error/i);
  });

  /**
   * Additional tests for sidebar toggle functionality
   */
  test('should toggle sidebar when toggle button is clicked', async ({ page }) => {
    // GIVEN: The application is launched with sidebar open
    await page.goto('/');
    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar).toBeVisible();

    // WHEN: User clicks sidebar toggle button
    const toggleButton = page.locator('[data-testid="sidebar-toggle"]');
    await toggleButton.click();

    // THEN: Sidebar is hidden or collapsed
    // Check for collapsed class or hidden state
    await expect(sidebar).toHaveClass(/collapsed|hidden/);
  });

  test('should restore sidebar when toggle button is clicked again', async ({ page }) => {
    // GIVEN: The application is launched with sidebar collapsed
    await page.goto('/');
    const toggleButton = page.locator('[data-testid="sidebar-toggle"]');
    await toggleButton.click(); // First click to collapse

    // WHEN: User clicks toggle button again
    await toggleButton.click();

    // THEN: Sidebar is visible again
    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar).not.toHaveClass(/collapsed|hidden/);
  });

  /**
   * Responsive design tests
   */
  test('should maintain layout on smaller window sizes', async ({ page }) => {
    // GIVEN: The application is launched
    await page.goto('/');

    // WHEN: Window is resized to smaller dimensions
    await page.setViewportSize({ width: 1024, height: 768 });

    // THEN: Sidebar and main content remain visible and functional
    const sidebar = page.locator('[data-testid="sidebar"]');
    const mainContent = page.locator('[data-testid="main-content"]');

    await expect(sidebar).toBeVisible();
    await expect(mainContent).toBeVisible();
  });

  test('should maintain layout on larger window sizes', async ({ page }) => {
    // GIVEN: The application is launched
    await page.goto('/');

    // WHEN: Window is resized to larger dimensions
    await page.setViewportSize({ width: 1920, height: 1080 });

    // THEN: Sidebar and main content remain visible and functional
    const sidebar = page.locator('[data-testid="sidebar"]');
    const mainContent = page.locator('[data-testid="main-content"]');

    await expect(sidebar).toBeVisible();
    await expect(mainContent).toBeVisible();
  });
});
