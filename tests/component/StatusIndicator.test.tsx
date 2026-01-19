/**
 * Component Test: Status Indicator
 * Story: 1-3 - Create React GUI Shell with Routing
 *
 * RED Phase - These tests MUST FAIL initially
 * Test creation date: 2026-01-19
 *
 * Knowledge Base Patterns Applied:
 * - Component TDD (red-green-refactor)
 * - Visual state testing (color, appearance)
 * - Accessibility testing (tooltips, ARIA attributes)
 * - One assertion per test
 */

import { test, expect } from '@playwright/experimental-ct-react';
import { StatusIndicator } from '../../src/components/ui/StatusIndicator';

test.describe('StatusIndicator Component', () => {
  /**
   * Rendering tests for different states
   */
  test('should render green indicator for running status', async ({ mount }) => {
    // GIVEN: StatusIndicator with "running" status
    const component = await mount(<StatusIndicator status="running" />);

    // WHEN: Component renders
    // THEN: Indicator has green color
    const indicator = component.locator('[data-testid="status-indicator"]');
    await expect(indicator).toHaveClass(/green|bg-green|success/);
  });

  test('should render red indicator for error status', async ({ mount }) => {
    // GIVEN: StatusIndicator with "error" status
    const component = await mount(<StatusIndicator status="error" />);

    // WHEN: Component renders
    // THEN: Indicator has red color
    const indicator = component.locator('[data-testid="status-indicator"]');
    await expect(indicator).toHaveClass(/red|bg-red|error|danger/);
  });

  test('should render gray indicator for stopped status', async ({ mount }) => {
    // GIVEN: StatusIndicator with "stopped" status
    const component = await mount(<StatusIndicator status="stopped" />);

    // WHEN: Component renders
    // THEN: Indicator has gray color
    const indicator = component.locator('[data-testid="status-indicator"]');
    await expect(indicator).toHaveClass(/gray|bg-gray|neutral|stopped/);
  });

  /**
   * Tooltip tests
   */
  test('should show "Running" tooltip on hover for running status', async ({ mount }) => {
    // GIVEN: StatusIndicator with "running" status
    const component = await mount(<StatusIndicator status="running" />);

    // WHEN: User hovers over indicator
    const indicator = component.locator('[data-testid="status-indicator"]');
    await indicator.hover();

    // THEN: Tooltip shows "Running" text
    const tooltip = component.locator('[role="tooltip"]');
    await expect(tooltip).toContainText(/running/i);
  });

  test('should show "Stopped" tooltip on hover for stopped status', async ({ mount }) => {
    // GIVEN: StatusIndicator with "stopped" status
    const component = await mount(<StatusIndicator status="stopped" />);

    // WHEN: User hovers over indicator
    const indicator = component.locator('[data-testid="status-indicator"]');
    await indicator.hover();

    // THEN: Tooltip shows "Stopped" text
    const tooltip = component.locator('[role="tooltip"]');
    await expect(tooltip).toContainText(/stopped/i);
  });

  test('should show "Error" tooltip on hover for error status', async ({ mount }) => {
    // GIVEN: StatusIndicator with "error" status
    const component = await mount(<StatusIndicator status="error" />);

    // WHEN: User hovers over indicator
    const indicator = component.locator('[data-testid="status-indicator"]');
    await indicator.hover();

    // THEN: Tooltip shows "Error" text
    const tooltip = component.locator('[role="tooltip"]');
    await expect(tooltip).toContainText(/error/i);
  });

  test('should hide tooltip when not hovering', async ({ mount }) => {
    // GIVEN: StatusIndicator is rendered
    const component = await mount(<StatusIndicator status="running" />);

    // WHEN: Indicator is not being hovered
    // THEN: Tooltip is not visible
    const tooltip = component.locator('[role="tooltip"]');
    await expect(tooltip).not.toBeVisible();
  });

  /**
   * Visual appearance tests
   */
  test('should render as circular indicator', async ({ mount }) => {
    // GIVEN: StatusIndicator is rendered
    const component = await mount(<StatusIndicator status="running" />);

    // WHEN: Component renders
    // THEN: Indicator has rounded appearance
    const indicator = component.locator('[data-testid="status-indicator"]');
    await expect(indicator).toHaveClass(/rounded-full|circle/);
  });

  test('should have appropriate size', async ({ mount }) => {
    // GIVEN: StatusIndicator is rendered
    const component = await mount(<StatusIndicator status="running" />);

    // WHEN: Component renders
    // THEN: Indicator has fixed width and height
    const indicator = component.locator('[data-testid="status-indicator"]');
    await expect(indicator).toHaveClass(/w-3|w-4|h-3|h-4/);
  });

  /**
   * Accessibility tests
   */
  test('should have accessible label for screen readers', async ({ mount }) => {
    // GIVEN: StatusIndicator with "running" status
    const component = await mount(<StatusIndicator status="running" />);

    // WHEN: Component renders
    // THEN: Indicator has aria-label
    const indicator = component.locator('[data-testid="status-indicator"]');
    await expect(indicator).toHaveAttribute('aria-label', /status|running/i);
  });

  test('should have accessible label for error status', async ({ mount }) => {
    // GIVEN: StatusIndicator with "error" status
    const component = await mount(<StatusIndicator status="error" />);

    // WHEN: Component renders
    // THEN: Indicator has aria-label with error
    const indicator = component.locator('[data-testid="status-indicator"]');
    await expect(indicator).toHaveAttribute('aria-label', /error/i);
  });

  test('should have role="status" for accessibility', async ({ mount }) => {
    // GIVEN: StatusIndicator is rendered
    const component = await mount(<StatusIndicator status="running" />);

    // WHEN: Component renders
    // THEN: Indicator has role="status"
    const indicator = component.locator('[data-testid="status-indicator"]');
    await expect(indicator).toHaveAttribute('role', 'status');
  });

  /**
   * Interactive tests
   */
  test('should update appearance when status prop changes', async ({ mount }) => {
    // GIVEN: StatusIndicator with "running" status
    const component = await mount(<StatusIndicator status="running" />);
    const indicator = component.locator('[data-testid="status-indicator"]');

    // WHEN: Status changes to "error"
    await component.update(<StatusIndicator status="error" />);

    // THEN: Indicator updates to red color
    await expect(indicator).toHaveClass(/red|bg-red|error|danger/);
  });

  test('should support custom className prop', async ({ mount }) => {
    // GIVEN: StatusIndicator with custom className
    const component = await mount(
      <StatusIndicator status="running" className="custom-indicator" />
    );

    // WHEN: Component renders
    // THEN: Custom className is applied
    const indicator = component.locator('[data-testid="status-indicator"]');
    await expect(indicator).toHaveClass(/custom-indicator/);
  });

  /**
   * Animation tests (optional, for visual polish)
   */
  test('should have pulse animation for running status', async ({ mount }) => {
    // GIVEN: StatusIndicator with "running" status
    const component = await mount(<StatusIndicator status="running" />);

    // WHEN: Component renders
    // THEN: Indicator has pulse or animation class
    const indicator = component.locator('[data-testid="status-indicator"]');
    await expect(indicator).toHaveClass(/animate-pulse|pulse/);
  });

  test('should not have animation for stopped status', async ({ mount }) => {
    // GIVEN: StatusIndicator with "stopped" status
    const component = await mount(<StatusIndicator status="stopped" />);

    // WHEN: Component renders
    // THEN: Indicator does not have animation
    const indicator = component.locator('[data-testid="status-indicator"]');
    await expect(indicator).not.toHaveClass(/animate-pulse|pulse/);
  });
});
