import {
  test,
  expect,
  createAcestreamSource,
  generateAcestreamContentId,
  AcestreamSource,
  AcestreamStatus,
} from '../support/fixtures/sources-acestream.fixture';

/**
 * E2E Tests for Multi-Source Stream Support: Acestream Source Management
 *
 * Tests the user journey of:
 * 1. Viewing Acestream tab in Sources view
 * 2. Platform detection (Mac unsupported warning)
 * 3. Acestream Engine status display
 * 4. Adding Acestream sources
 * 5. Deleting Acestream sources
 *
 * Acceptance Criteria Covered:
 * - AC 5: Add Acestream on Windows/Linux → stored and available for mapping
 * - AC 6: Mac warning banner → explains Acestream unsupported
 * - AC 7: Engine available → "Engine Available" shown
 * - AC 8: Engine not running → "Engine Not Found" with instructions
 *
 * @see tech-spec-multi-source-stream-support.md
 *
 * ATDD Pattern: RED Phase - These tests MUST fail initially
 */

test.describe('Sources View - Acestream Tab (Multi-Source Support)', () => {
  test.beforeEach(async ({ page }) => {
    // Block image loading for faster tests
    await page.route('**/*.{png,jpg,jpeg,svg,gif}', (route) => route.abort());
  });

  test.describe('Acestream Tab Display', () => {
    test('should display Acestream tab in Sources view', async ({
      page,
      acestreamSourcesSupported,
    }) => {
      // GIVEN: Sources view with Acestream tab
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // THEN: Acestream tab is visible
      const acestreamTab = page.locator('[data-testid="acestream-tab"]');
      await expect(acestreamTab).toBeVisible();
      await expect(acestreamTab).not.toBeDisabled();
    });

    test('should switch to Acestream tab when clicked', async ({
      page,
      acestreamSourcesSupported,
    }) => {
      // GIVEN: Sources view with multiple tabs
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // WHEN: Click Acestream tab
      const acestreamTab = page.locator('[data-testid="acestream-tab"]');
      await acestreamTab.click();

      // THEN: Acestream tab becomes active
      await expect(acestreamTab).toHaveAttribute('aria-selected', 'true');

      // AND: Acestream tab panel is displayed
      const acestreamPanel = page.locator('[data-testid="acestream-sources-tab"]');
      await expect(acestreamPanel).toBeVisible();
    });

    test('should display Acestream sources as list items', async ({
      page,
      acestreamSourcesSupported,
    }) => {
      // GIVEN: Multiple Acestream sources configured
      const { sources } = acestreamSourcesSupported;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');

      // THEN: Each source displays as list item
      for (const source of sources) {
        const sourceItem = page.locator(`[data-testid="acestream-source-item-${source.id}"]`);
        await expect(sourceItem).toBeVisible();

        // Source name is displayed
        await expect(sourceItem).toContainText(source.name);
      }
    });

    test('should display content ID (truncated) in source item', async ({
      page,
      acestreamSourcesSupported,
    }) => {
      // GIVEN: Acestream source
      const { sources } = acestreamSourcesSupported;
      const source = sources[0];

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');

      // THEN: Content ID is displayed (truncated or partial)
      const sourceItem = page.locator(`[data-testid="acestream-source-item-${source.id}"]`);
      // Should show at least first 8 chars of content ID
      const shortId = source.contentId.substring(0, 8);
      await expect(sourceItem).toContainText(shortId);
    });
  });

  test.describe('AC #6: Mac Warning Banner', () => {
    test('should display warning banner on Mac platform', async ({
      page,
      acestreamSourcesMac,
    }) => {
      // GIVEN: Mac platform (Acestream unsupported)
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');

      // THEN: Warning banner is displayed
      const warningBanner = page.locator('[data-testid="acestream-mac-warning"]');
      await expect(warningBanner).toBeVisible();

      // Banner explains Acestream is unsupported on Mac
      await expect(warningBanner).toContainText(/not supported|unsupported|mac/i);
    });

    test('should disable add button on Mac platform', async ({
      page,
      acestreamSourcesMac,
    }) => {
      // GIVEN: Mac platform
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');

      // THEN: Add button is disabled
      const addButton = page.locator('[data-testid="add-acestream-source-button"]');
      await expect(addButton).toBeDisabled();
    });

    test('should NOT show Mac warning on Windows/Linux', async ({
      page,
      acestreamSourcesSupported,
    }) => {
      // GIVEN: Windows/Linux platform
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');

      // THEN: Mac warning is NOT displayed
      const warningBanner = page.locator('[data-testid="acestream-mac-warning"]');
      await expect(warningBanner).not.toBeVisible();

      // AND: Add button is enabled
      const addButton = page.locator('[data-testid="add-acestream-source-button"]');
      await expect(addButton).toBeEnabled();
    });
  });

  test.describe('AC #7 & #8: Engine Status Display', () => {
    test('should show "Engine Available" when engine is running', async ({
      page,
      acestreamSourcesSupported,
    }) => {
      // GIVEN: Acestream engine is running
      const { status } = acestreamSourcesSupported;
      expect(status.engineAvailable).toBe(true);

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');

      // THEN: Engine status shows "Available"
      const engineStatus = page.locator('[data-testid="acestream-engine-status"]');
      await expect(engineStatus).toBeVisible();
      await expect(engineStatus).toContainText(/available|running|connected/i);

      // Status indicator uses data-status attribute for reliable testing
      await expect(engineStatus).toHaveAttribute('data-status', 'available');

      // Also verify the indicator has appropriate aria-label
      const statusIndicator = page.locator('[data-testid="acestream-engine-indicator"]');
      await expect(statusIndicator).toHaveAttribute('aria-label', /available/i);
    });

    test('should show "Engine Not Found" when engine is not running', async ({
      page,
      acestreamSourcesNoEngine,
    }) => {
      // GIVEN: Acestream engine is NOT running
      const { status } = acestreamSourcesNoEngine;
      expect(status.engineAvailable).toBe(false);

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');

      // THEN: Engine status shows "Not Found"
      const engineStatus = page.locator('[data-testid="acestream-engine-status"]');
      await expect(engineStatus).toBeVisible();
      await expect(engineStatus).toContainText(/not found|not running|unavailable/i);

      // Status indicator uses data-status attribute for reliable testing
      await expect(engineStatus).toHaveAttribute('data-status', 'unavailable');

      // Also verify the indicator has appropriate aria-label
      const statusIndicator = page.locator('[data-testid="acestream-engine-indicator"]');
      await expect(statusIndicator).toHaveAttribute('aria-label', /not available/i);
    });

    test('should display instructions when engine not found', async ({
      page,
      acestreamSourcesNoEngine,
    }) => {
      // GIVEN: Acestream engine is NOT running
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');

      // THEN: Instructions are displayed
      const instructions = page.locator('[data-testid="acestream-engine-instructions"]');
      await expect(instructions).toBeVisible();

      // Instructions mention how to start/install engine
      await expect(instructions).toContainText(/install|start|acestream/i);
    });

    test('should have refresh status button', async ({
      page,
      acestreamSourcesNoEngine,
    }) => {
      // GIVEN: Acestream tab open
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');

      // THEN: Refresh status button is visible
      const refreshButton = page.locator('[data-testid="refresh-acestream-status"]');
      await expect(refreshButton).toBeVisible();
    });

    test('should update status when refresh clicked', async ({
      page,
      acestreamSourcesNoEngine,
    }) => {
      // GIVEN: Acestream tab with engine not found
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');

      // WHEN: Click refresh button
      const refreshButton = page.locator('[data-testid="refresh-acestream-status"]');
      await refreshButton.click();

      // THEN: Status is refreshed (button may show loading briefly)
      await expect(refreshButton).toBeDisabled();
      await expect(refreshButton).toBeEnabled({ timeout: 2000 });
    });
  });

  test.describe('AC #5: Add Acestream Source Flow', () => {
    test('should open Add Acestream dialog when button clicked', async ({
      page,
      acestreamSourcesSupported,
    }) => {
      // GIVEN: Acestream tab on supported platform
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');

      // WHEN: Click "Add Acestream Source" button
      const addButton = page.locator('[data-testid="add-acestream-source-button"]');
      await addButton.click();

      // THEN: Dialog opens with form fields
      const dialog = page.locator('[data-testid="add-acestream-dialog"]');
      await expect(dialog).toBeVisible({ timeout: 2000 });

      // Name input field
      const nameInput = page.locator('[data-testid="acestream-name-input"]');
      await expect(nameInput).toBeVisible();

      // Content ID input field
      const contentIdInput = page.locator('[data-testid="acestream-content-id-input"]');
      await expect(contentIdInput).toBeVisible();

      // Submit button
      const submitButton = page.locator('[data-testid="add-acestream-submit"]');
      await expect(submitButton).toBeVisible();
    });

    test('should accept acestream:// URL and parse content ID', async ({
      page,
      acestreamSourcesSupported,
    }) => {
      // GIVEN: Add Acestream dialog open
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');
      await page.click('[data-testid="add-acestream-source-button"]');

      // WHEN: Paste acestream:// URL
      const contentId = generateAcestreamContentId();
      const acestreamUrl = `acestream://${contentId}`;

      const contentIdInput = page.locator('[data-testid="acestream-content-id-input"]');
      await contentIdInput.fill(acestreamUrl);

      // THEN: Content ID is parsed and shown
      // Input should contain just the content ID (40 hex chars) or the URL is parsed
      await expect(contentIdInput).toHaveValue(new RegExp(`${contentId}|${acestreamUrl}`));
    });

    test('should validate content ID format (40 hex chars)', async ({
      page,
      acestreamSourcesSupported,
    }) => {
      // GIVEN: Add Acestream dialog open
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');
      await page.click('[data-testid="add-acestream-source-button"]');

      // WHEN: Enter invalid content ID (too short)
      const nameInput = page.locator('[data-testid="acestream-name-input"]');
      await nameInput.fill('Test Stream');

      const contentIdInput = page.locator('[data-testid="acestream-content-id-input"]');
      await contentIdInput.fill('abc123'); // Invalid - too short

      const submitButton = page.locator('[data-testid="add-acestream-submit"]');
      await submitButton.click();

      // THEN: Validation error is shown
      const error = page.locator('[data-testid="acestream-content-id-error"]');
      await expect(error).toBeVisible();
      await expect(error).toContainText(/invalid|40.*character|hex/i);
    });

    test('should add Acestream source on valid input', async ({
      page,
      acestreamSourcesSupported,
    }) => {
      // GIVEN: Add Acestream dialog with valid input
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');
      await page.click('[data-testid="add-acestream-source-button"]');

      // WHEN: Fill form and submit
      const contentId = generateAcestreamContentId();

      const nameInput = page.locator('[data-testid="acestream-name-input"]');
      await nameInput.fill('My Acestream Channel');

      const contentIdInput = page.locator('[data-testid="acestream-content-id-input"]');
      await contentIdInput.fill(contentId);

      const submitButton = page.locator('[data-testid="add-acestream-submit"]');
      await submitButton.click();

      // THEN: Success toast is displayed
      const toast = page.getByText(/added|success/i);
      await expect(toast).toBeVisible({ timeout: 3000 });

      // AND: Dialog closes
      const dialog = page.locator('[data-testid="add-acestream-dialog"]');
      await expect(dialog).not.toBeVisible({ timeout: 2000 });

      // AND: New source appears in list
      const sourceItems = page.locator('[data-testid^="acestream-source-item-"]');
      const count = await sourceItems.count();
      expect(count).toBeGreaterThan(3); // 3 existing + 1 new
    });

    test('should reject duplicate content ID', async ({
      page,
      injectAcestreamSourcesMocks,
    }) => {
      // GIVEN: Existing Acestream source
      const existingSource = createAcestreamSource({ id: 1, contentId: 'a'.repeat(40) });
      const status = { isSupported: true, engineAvailable: true, platform: 'linux', engineUrl: 'http://127.0.0.1:6878' };
      await injectAcestreamSourcesMocks([existingSource], status);

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');
      await page.click('[data-testid="add-acestream-source-button"]');

      // WHEN: Try to add duplicate content ID
      await page.fill('[data-testid="acestream-name-input"]', 'Duplicate Stream');
      await page.fill('[data-testid="acestream-content-id-input"]', existingSource.contentId);
      await page.click('[data-testid="add-acestream-submit"]');

      // THEN: Error is shown
      const error = page.locator('[data-testid="acestream-content-id-error"]');
      await expect(error).toBeVisible({ timeout: 2000 });
      await expect(error).toContainText(/already exists|duplicate/i);
    });
  });

  test.describe('Delete Acestream Source Flow', () => {
    test('should display delete button for each source', async ({
      page,
      acestreamSourcesSupported,
    }) => {
      // GIVEN: Acestream sources exist
      const { sources } = acestreamSourcesSupported;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');

      // THEN: Delete button is visible for each source
      for (const source of sources) {
        const deleteButton = page.locator(`[data-testid="delete-acestream-source-${source.id}"]`);
        await expect(deleteButton).toBeVisible();
      }
    });

    test('should show confirmation dialog when delete clicked', async ({
      page,
      acestreamSourcesSupported,
    }) => {
      // GIVEN: Acestream source
      const { sources } = acestreamSourcesSupported;
      const source = sources[0];

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');

      // WHEN: Click delete button
      await page.click(`[data-testid="delete-acestream-source-${source.id}"]`);

      // THEN: Confirmation dialog appears
      const dialog = page.locator('[data-testid="delete-acestream-confirm-dialog"]');
      await expect(dialog).toBeVisible({ timeout: 2000 });

      // Dialog mentions source name
      await expect(dialog).toContainText(source.name);

      // Has confirm and cancel buttons
      await expect(page.locator('[data-testid="delete-acestream-confirm"]')).toBeVisible();
      await expect(page.locator('[data-testid="delete-acestream-cancel"]')).toBeVisible();
    });

    test('should delete source when confirmed', async ({
      page,
      acestreamSourcesSupported,
    }) => {
      // GIVEN: Delete confirmation dialog open
      const { sources } = acestreamSourcesSupported;
      const sourceToDelete = sources[0];

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');
      await page.click(`[data-testid="delete-acestream-source-${sourceToDelete.id}"]`);

      // WHEN: Confirm deletion
      await page.click('[data-testid="delete-acestream-confirm"]');

      // THEN: Success toast is displayed
      const toast = page.getByText(/deleted|removed/i);
      await expect(toast).toBeVisible({ timeout: 2000 });

      // AND: Source no longer appears in list
      const deletedItem = page.locator(`[data-testid="acestream-source-item-${sourceToDelete.id}"]`);
      await expect(deletedItem).not.toBeVisible({ timeout: 2000 });
    });

    test('should cancel deletion when cancel clicked', async ({
      page,
      acestreamSourcesSupported,
    }) => {
      // GIVEN: Delete confirmation dialog open
      const { sources } = acestreamSourcesSupported;
      const source = sources[0];

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');
      await page.click(`[data-testid="delete-acestream-source-${source.id}"]`);

      // WHEN: Cancel deletion
      await page.click('[data-testid="delete-acestream-cancel"]');

      // THEN: Dialog closes
      const dialog = page.locator('[data-testid="delete-acestream-confirm-dialog"]');
      await expect(dialog).not.toBeVisible({ timeout: 1000 });

      // AND: Source still exists
      const sourceItem = page.locator(`[data-testid="acestream-source-item-${source.id}"]`);
      await expect(sourceItem).toBeVisible();
    });
  });

  test.describe('Empty State', () => {
    test('should display empty state when no Acestream sources', async ({
      page,
      emptyAcestreamState,
    }) => {
      // GIVEN: No Acestream sources (but engine available)
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');

      // THEN: Empty state is displayed
      const emptyState = page.locator('[data-testid="acestream-empty-state"]');
      await expect(emptyState).toBeVisible();

      const message = page.locator('[data-testid="acestream-empty-state-message"]');
      await expect(message).toBeVisible();
      await expect(message).toContainText(/no acestream/i);

      // AND: Add button is visible
      const addButton = page.locator('[data-testid="add-acestream-source-button"]');
      await expect(addButton).toBeVisible();
      await expect(addButton).toBeEnabled();
    });
  });

  test.describe('Engine Health Check Failures', () => {
    test('should handle engine timeout gracefully', async ({
      page,
      acestreamSourcesSupported,
    }) => {
      // GIVEN: Acestream tab loaded
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');

      // WHEN: Mock slow engine response (timeout scenario)
      await page.route('**/check_acestream_status', async route => {
        await new Promise(resolve => setTimeout(resolve, 6000)); // Longer than 5s timeout
        await route.fulfill({ status: 408 }); // Request timeout
      });

      // Trigger status check by clicking refresh
      const refreshButton = page.locator('[data-testid="refresh-acestream-status"]');
      await refreshButton.click();

      // THEN: Should show error state, not crash
      const engineStatus = page.locator('[data-testid="acestream-engine-status"]');
      await expect(engineStatus).toBeVisible({ timeout: 10000 });

      // Error state should be indicated (either via status attribute or error message)
      const hasErrorIndication = await Promise.race([
        engineStatus.getAttribute('data-status').then(status =>
          status === 'unavailable' || status === 'error'
        ),
        page.locator('[data-testid="acestream-status-error"]').isVisible(),
        page.getByText(/timeout|error|failed/i).isVisible(),
      ]);

      expect(hasErrorIndication).toBeTruthy();
    });

    test('should handle engine returning invalid response', async ({
      page,
      acestreamSourcesSupported,
    }) => {
      // GIVEN: Acestream tab loaded
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');

      // WHEN: Mock invalid JSON response
      await page.route('**/check_acestream_status', route => {
        route.fulfill({
          status: 200,
          body: 'not valid json'
        });
      });

      // Trigger status check by clicking refresh
      const refreshButton = page.locator('[data-testid="refresh-acestream-status"]');
      await refreshButton.click();

      // THEN: Should handle gracefully without crashing
      await page.waitForTimeout(1000); // Give time for error to surface

      // Page should still be functional
      const acestreamTab = page.locator('[data-testid="acestream-tab"]');
      await expect(acestreamTab).toBeVisible();

      // Should show some form of error indication
      const hasErrorIndication = await Promise.race([
        page.locator('[data-testid="acestream-status-error"]').isVisible().catch(() => false),
        page.getByText(/error|failed|invalid/i).isVisible().catch(() => false),
        // At minimum, the button should be re-enabled (not stuck in loading)
        refreshButton.isEnabled().then(enabled => enabled === true),
      ]);

      expect(hasErrorIndication).toBeTruthy();
    });
  });

  test.describe('Platform Detection (documented limitations)', () => {
    test.skip('Real platform detection requires running on actual platform', async () => {
      // This test documents that platform detection cannot be fully tested in E2E
      // because std::env::consts::OS is determined at compile time.
      //
      // Platform behavior is tested via:
      // 1. Rust unit tests in src-tauri/src/acestream/mod.rs
      // 2. CI/CD matrix running on different platforms
      //
      // E2E tests mock the platform for UI behavior testing only.
      //
      // To test platform detection:
      // - Windows: Build and run on Windows, verify no Mac warning
      // - Linux: Build and run on Linux, verify no Mac warning
      // - macOS: Build and run on macOS, verify Mac warning appears
      //
      // This is handled by the CI/CD pipeline which runs on all three platforms.
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible Acestream tab with ARIA attributes', async ({
      page,
      acestreamSourcesSupported,
    }) => {
      // GIVEN: Sources view
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // THEN: Acestream tab has proper ARIA attributes
      const acestreamTab = page.locator('[data-testid="acestream-tab"]');
      await expect(acestreamTab).toHaveAttribute('role', 'tab');

      // WHEN: Click tab
      await acestreamTab.click();

      // THEN: aria-selected updates
      await expect(acestreamTab).toHaveAttribute('aria-selected', 'true');
    });

    test('should have accessible status indicators', async ({
      page,
      acestreamSourcesSupported,
    }) => {
      // GIVEN: Acestream tab
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');

      // THEN: Status indicator has ARIA label
      const statusIndicator = page.locator('[data-testid="acestream-engine-indicator"]');
      await expect(statusIndicator).toHaveAttribute('aria-label', /.+/);
    });

    test('should announce Mac warning to screen readers', async ({
      page,
      acestreamSourcesMac,
    }) => {
      // GIVEN: Mac platform
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="acestream-tab"]');

      // THEN: Warning has alert role
      const warningBanner = page.locator('[data-testid="acestream-mac-warning"]');
      await expect(warningBanner).toHaveAttribute('role', 'alert');
    });
  });
});
