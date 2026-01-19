/**
 * Component Test: Sidebar Navigation
 * Story: 1-3 - Create React GUI Shell with Routing
 *
 * RED Phase - These tests MUST FAIL initially
 * Test creation date: 2026-01-19
 *
 * Knowledge Base Patterns Applied:
 * - Component TDD (red-green-refactor)
 * - Provider isolation (fresh router context per test)
 * - Accessibility testing (ARIA roles, keyboard navigation)
 * - One assertion per test
 */

import { test, expect } from '@playwright/experimental-ct-react';
import { Sidebar } from '../../src/components/layout/Sidebar';
import { MemoryRouter } from 'react-router-dom';

test.describe('Sidebar Component', () => {
  /**
   * Rendering tests
   */
  test('should render all navigation menu items', async ({ mount }) => {
    // GIVEN: Sidebar component is mounted with router context
    const component = await mount(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    // WHEN: Component renders
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
      await expect(component.getByRole('link', { name: item })).toBeVisible();
    }
  });

  test('should render app logo or title', async ({ mount }) => {
    // GIVEN: Sidebar component is mounted
    const component = await mount(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    // WHEN: Component renders
    // THEN: App logo/title is visible
    await expect(component.getByText('iptv')).toBeVisible();
  });

  test('should render navigation items with icons', async ({ mount }) => {
    // GIVEN: Sidebar component is mounted
    const component = await mount(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    // WHEN: Component renders
    // THEN: Each navigation item has an icon
    const dashboardLink = component.getByRole('link', { name: /Dashboard/i });
    const icon = dashboardLink.locator('svg'); // Assuming icons are SVG
    await expect(icon).toBeVisible();
  });

  /**
   * Navigation behavior tests
   */
  test('should highlight active route', async ({ mount }) => {
    // GIVEN: Sidebar is mounted with current route at /channels
    const component = await mount(
      <MemoryRouter initialEntries={['/channels']}>
        <Sidebar />
      </MemoryRouter>
    );

    // WHEN: User is on Channels route
    const channelsLink = component.getByRole('link', { name: 'Channels' });

    // THEN: Channels link has active styling
    await expect(channelsLink).toHaveClass(/active|bg-blue/);
  });

  test('should not highlight inactive routes', async ({ mount }) => {
    // GIVEN: Sidebar is mounted with current route at /
    const component = await mount(
      <MemoryRouter initialEntries={['/']}>
        <Sidebar />
      </MemoryRouter>
    );

    // WHEN: User is on Dashboard route
    const channelsLink = component.getByRole('link', { name: 'Channels' });

    // THEN: Channels link does not have active styling
    await expect(channelsLink).not.toHaveClass(/active|bg-blue/);
  });

  /**
   * Accessibility tests
   */
  test('should have proper ARIA navigation role', async ({ mount }) => {
    // GIVEN: Sidebar component is mounted
    const component = await mount(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    // WHEN: Component renders
    // THEN: Navigation has proper role
    const nav = component.getByRole('navigation');
    await expect(nav).toBeVisible();
  });

  test('should have accessible navigation labels', async ({ mount }) => {
    // GIVEN: Sidebar component is mounted
    const component = await mount(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    // WHEN: Component renders
    // THEN: Navigation has aria-label
    const nav = component.getByRole('navigation');
    await expect(nav).toHaveAttribute('aria-label', /main navigation|sidebar/i);
  });

  test('should support keyboard navigation with Tab', async ({ mount, page }) => {
    // GIVEN: Sidebar component is mounted and focused
    const component = await mount(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    // WHEN: User tabs through navigation items
    const dashboardLink = component.getByRole('link', { name: 'Dashboard' });
    await dashboardLink.focus();
    await page.keyboard.press('Tab');

    // THEN: Next navigation item receives focus
    const channelsLink = component.getByRole('link', { name: 'Channels' });
    await expect(channelsLink).toBeFocused();
  });

  test('should support keyboard activation with Enter', async ({ mount, page }) => {
    // GIVEN: Sidebar component is mounted
    let navigated = false;
    const component = await mount(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    // WHEN: User focuses link and presses Enter
    const channelsLink = component.getByRole('link', { name: 'Channels' });
    await channelsLink.focus();
    await page.keyboard.press('Enter');

    // THEN: Navigation occurs (link is activated)
    // Note: Actual navigation will be tested in E2E tests
    // Component test just verifies the element is interactive
    await expect(channelsLink).toHaveAttribute('href', '/channels');
  });

  /**
   * Responsive behavior tests
   */
  test('should render in collapsed state when collapsed prop is true', async ({ mount }) => {
    // GIVEN: Sidebar component with collapsed prop
    const component = await mount(
      <MemoryRouter>
        <Sidebar collapsed={true} />
      </MemoryRouter>
    );

    // WHEN: Component renders
    // THEN: Sidebar has collapsed styling
    const sidebar = component.locator('[data-testid="sidebar"]');
    await expect(sidebar).toHaveClass(/collapsed|w-16/);
  });

  test('should render in expanded state when collapsed prop is false', async ({ mount }) => {
    // GIVEN: Sidebar component with collapsed prop false
    const component = await mount(
      <MemoryRouter>
        <Sidebar collapsed={false} />
      </MemoryRouter>
    );

    // WHEN: Component renders
    // THEN: Sidebar has expanded styling
    const sidebar = component.locator('[data-testid="sidebar"]');
    await expect(sidebar).not.toHaveClass(/collapsed/);
    await expect(sidebar).toHaveClass(/w-64/);
  });

  test('should show full text labels in expanded state', async ({ mount }) => {
    // GIVEN: Sidebar component in expanded state
    const component = await mount(
      <MemoryRouter>
        <Sidebar collapsed={false} />
      </MemoryRouter>
    );

    // WHEN: Component renders
    // THEN: Text labels are visible
    await expect(component.getByText('Dashboard')).toBeVisible();
    await expect(component.getByText('Channels')).toBeVisible();
  });

  test('should hide text labels in collapsed state', async ({ mount }) => {
    // GIVEN: Sidebar component in collapsed state
    const component = await mount(
      <MemoryRouter>
        <Sidebar collapsed={true} />
      </MemoryRouter>
    );

    // WHEN: Component renders
    // THEN: Text labels are hidden (only icons visible)
    const dashboardText = component.getByText('Dashboard');
    await expect(dashboardText).toHaveClass(/sr-only|hidden/);
  });

  /**
   * Styling tests
   */
  test('should have dark theme styling', async ({ mount }) => {
    // GIVEN: Sidebar component is mounted
    const component = await mount(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    // WHEN: Component renders
    // THEN: Sidebar has dark background
    const sidebar = component.locator('[data-testid="sidebar"]');
    await expect(sidebar).toHaveClass(/bg-gray-900|bg-slate-900|dark/);
  });

  test('should have fixed positioning', async ({ mount }) => {
    // GIVEN: Sidebar component is mounted
    const component = await mount(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    // WHEN: Component renders
    // THEN: Sidebar has fixed position
    const sidebar = component.locator('[data-testid="sidebar"]');
    await expect(sidebar).toHaveClass(/fixed/);
  });

  test('should span full height', async ({ mount }) => {
    // GIVEN: Sidebar component is mounted
    const component = await mount(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    // WHEN: Component renders
    // THEN: Sidebar spans full viewport height
    const sidebar = component.locator('[data-testid="sidebar"]');
    await expect(sidebar).toHaveClass(/h-screen|h-full/);
  });
});
