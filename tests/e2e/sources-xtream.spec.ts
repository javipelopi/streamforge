import { Page } from '@playwright/test';
import {
  test,
  expect,
  createXtreamAccountStream,
  createXtreamAccountStreams,
  createLinkedStream,
  createOrphanStream,
  createPromotedStream,
  createRealisticStreamMix,
  createAccount,
  createAccounts,
  XtreamAccountStream,
  Account,
} from '../support/fixtures/sources-xtream.fixture';

/**
 * E2E Tests for Story 3.11: Implement Sources View Xtream Tab
 *
 * Tests the user journey of:
 * 1. Enabling the Xtream tab in Sources view
 * 2. Viewing Xtream accounts as expandable accordion sections
 * 3. Lazy-loading streams when expanding an account
 * 4. Viewing stream mapping status with badges (linked/orphan/promoted)
 * 5. Managing stream actions (link, promote, unlink)
 * 6. Viewing linked channels and editing promoted streams
 *
 * ATDD Pattern: RED Phase - These tests MUST fail initially
 */

test.describe('Sources View - Xtream Tab (Story 3-11)', () => {
  test.beforeEach(async ({ page }) => {
    // Block image loading for faster tests
    await page.route('**/*.{png,jpg,jpeg,svg,gif}', (route) => route.abort());
  });

  test.describe('AC #1: Xtream Tab Enabled with Account Display', () => {
    test('should enable Xtream tab (remove disabled state)', async ({
      page,
      xtreamSourcesWithStreams,
    }) => {
      // GIVEN: Sources view with Xtream tab
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // THEN: Xtream tab is no longer disabled
      const xtreamTab = page.locator('[data-testid="xtream-tab"]');
      await expect(xtreamTab).toBeVisible();
      await expect(xtreamTab).not.toBeDisabled();

      // AND: "Soon" badge is removed
      await expect(xtreamTab).not.toContainText(/soon/i);
    });

    test('should switch to Xtream tab when clicked', async ({
      page,
      xtreamSourcesWithStreams,
    }) => {
      // GIVEN: Sources view with both tabs
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // WHEN: Click Xtream tab
      const xtreamTab = page.locator('[data-testid="xtream-tab"]');
      await xtreamTab.click();

      // THEN: Xtream tab becomes active
      await expect(xtreamTab).toHaveAttribute('aria-selected', 'true');

      // AND: XMLTV tab becomes inactive
      const xmltvTab = page.locator('[data-testid="xmltv-tab"]');
      await expect(xmltvTab).toHaveAttribute('aria-selected', 'false');

      // AND: Xtream tab panel is displayed
      const xtreamPanel = page.locator('[data-testid="xtream-sources-tab"]');
      await expect(xtreamPanel).toBeVisible();
    });

    test('should display Xtream accounts as accordion sections', async ({
      page,
      xtreamSourcesWithStreams,
    }) => {
      // GIVEN: Multiple Xtream accounts configured
      const { accounts } = xtreamSourcesWithStreams;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');

      // THEN: Each account displays as accordion section
      for (const account of accounts) {
        const accordion = page.locator(`[data-testid="xtream-account-accordion-${account.id}"]`);
        await expect(accordion).toBeVisible();

        // Accordion header shows account name
        const header = page.locator(`[data-testid="xtream-account-header-${account.id}"]`);
        await expect(header).toBeVisible();
        await expect(header).toContainText(account.name);
      }
    });

    test('should display stream count in accordion header', async ({
      page,
      injectXtreamSourcesMocks,
    }) => {
      // GIVEN: Account with known stream count
      const accounts = [createAccount({ id: 1, name: 'Test Provider' })];
      const streamCount = 42;
      const streams = createXtreamAccountStreams(streamCount);
      const streamsByAccountId = new Map([[1, streams]]);
      await injectXtreamSourcesMocks(accounts, streamsByAccountId);

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');

      // THEN: Header displays stream count
      const header = page.locator(`[data-testid="xtream-account-header-1"]`);
      await expect(header).toContainText(`${streamCount}`);
      await expect(header).toContainText(/stream/i);
    });

    test('should display orphan count badge in accordion header', async ({
      page,
      injectXtreamSourcesMocks,
    }) => {
      // GIVEN: Account with orphan streams
      const accounts = [createAccount({ id: 1, name: 'Test Provider' })];
      const streams = [
        ...Array.from({ length: 5 }, () => createOrphanStream()),
        ...Array.from({ length: 3 }, () => createLinkedStream()),
      ];
      const streamsByAccountId = new Map([[1, streams]]);
      await injectXtreamSourcesMocks(accounts, streamsByAccountId);

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');

      // THEN: Header displays orphan count with amber badge
      const header = page.locator(`[data-testid="xtream-account-header-1"]`);
      await expect(header).toContainText('5');
      await expect(header).toContainText(/orphan/i);

      // Badge should have amber/warning styling
      const orphanBadge = page.locator('[data-testid="orphan-count-badge-1"]');
      await expect(orphanBadge).toBeVisible();
      const badgeClasses = await orphanBadge.getAttribute('class');
      expect(badgeClasses).toMatch(/amber|yellow/i);
    });

    test('should display empty state when no Xtream accounts configured', async ({
      page,
      emptyXtreamState,
    }) => {
      // GIVEN: No Xtream accounts
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');

      // THEN: Empty state is displayed
      const emptyState = page.locator('[data-testid="xtream-empty-state"]');
      await expect(emptyState).toBeVisible();

      const message = page.locator('[data-testid="xtream-empty-state-message"]');
      await expect(message).toBeVisible();
      await expect(message).toContainText('No Xtream accounts configured');
      await expect(message).toContainText('Add accounts in Accounts');

      // AND: Link to Accounts section
      const accountsLink = page.locator('[data-testid="go-to-accounts-button"]');
      await expect(accountsLink).toBeVisible();
    });
  });

  test.describe('AC #2: Lazy-Load Streams with Status Display', () => {
    test('should NOT load streams until account is expanded', async ({
      page,
      injectXtreamSourcesMocks,
    }) => {
      // GIVEN: Account with many streams
      const accounts = [createAccount({ id: 1, name: 'Test Provider' })];
      const streams = createXtreamAccountStreams(50);
      const streamsByAccountId = new Map([[1, streams]]);
      await injectXtreamSourcesMocks(accounts, streamsByAccountId);

      // Listen for command invocations
      const commandCalls: string[] = [];
      page.on('console', (msg) => {
        if (msg.text().includes('[Mock] get_xtream_streams_for_account')) {
          commandCalls.push(msg.text());
        }
      });

      // WHEN: Navigate to Xtream tab (accordion collapsed by default)
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');
      await page.waitForLoadState('networkidle');

      // THEN: get_xtream_streams_for_account should NOT be called yet
      await page.waitForTimeout(500); // Give time for any rogue calls
      expect(commandCalls.length).toBe(0);

      // Streams list should not be visible
      const streamsList = page.locator(`[data-testid="xtream-account-streams-1"]`);
      await expect(streamsList).not.toBeVisible();
    });

    test('should lazy-load streams when account accordion is expanded', async ({
      page,
      injectXtreamSourcesMocks,
    }) => {
      // GIVEN: Collapsed account accordion
      const accounts = [createAccount({ id: 1, name: 'Test Provider' })];
      const streams = createXtreamAccountStreams(10);
      const streamsByAccountId = new Map([[1, streams]]);
      await injectXtreamSourcesMocks(accounts, streamsByAccountId);

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');

      // WHEN: Click to expand accordion
      const header = page.locator(`[data-testid="xtream-account-header-1"]`);
      await header.click();

      // THEN: Streams are loaded and displayed
      const streamsList = page.locator(`[data-testid="xtream-account-streams-1"]`);
      await expect(streamsList).toBeVisible({ timeout: 2000 });

      // Verify streams are rendered
      for (const stream of streams.slice(0, 3)) {
        const streamRow = page.locator(`[data-testid="xtream-stream-row-${stream.streamId}"]`);
        await expect(streamRow).toBeVisible();
      }
    });

    test('should display stream with icon, name, and quality badges', async ({
      page,
      injectXtreamSourcesMocks,
    }) => {
      // GIVEN: Account with stream that has all attributes
      const accounts = [createAccount({ id: 1, name: 'Test Provider' })];
      const stream = createXtreamAccountStream({
        streamId: 12345,
        name: 'CNN HD',
        streamIcon: 'https://example.com/cnn.png',
        qualities: ['4K', 'HD'],
      });
      const streamsByAccountId = new Map([[1, [stream]]]);
      await injectXtreamSourcesMocks(accounts, streamsByAccountId);

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');
      await page.click(`[data-testid="xtream-account-header-1"]`);

      // THEN: Stream row displays all elements
      const streamRow = page.locator(`[data-testid="xtream-stream-row-${stream.streamId}"]`);
      await expect(streamRow).toBeVisible();

      // Icon is displayed (or placeholder)
      const icon = page.locator(`[data-testid="xtream-stream-icon-${stream.streamId}"]`);
      await expect(icon).toBeVisible();

      // Display name is shown
      const name = page.locator(`[data-testid="xtream-stream-name-${stream.streamId}"]`);
      await expect(name).toBeVisible();
      await expect(name).toContainText('CNN HD');

      // Quality badges are displayed
      await expect(streamRow).toContainText('4K');
      await expect(streamRow).toContainText('HD');
    });

    test('should display "Linked" badge (blue) for linked streams', async ({
      page,
      xtreamSourcesWithStreams,
    }) => {
      // GIVEN: Linked stream
      const { linkedStream } = xtreamSourcesWithStreams;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');
      await page.click(`[data-testid="xtream-account-header-1"]`);

      // THEN: "Linked" badge is visible with blue styling
      const badge = page.locator(
        `[data-testid="xtream-stream-linked-badge-${linkedStream.streamId}"]`
      );
      await expect(badge).toBeVisible();
      await expect(badge).toContainText(/linked/i);

      // Badge should have blue styling
      const badgeClasses = await badge.getAttribute('class');
      expect(badgeClasses).toMatch(/blue/i);
    });

    test('should display "Orphan" badge (amber) for orphan streams', async ({
      page,
      xtreamSourcesWithStreams,
    }) => {
      // GIVEN: Orphan stream
      const { orphanStream } = xtreamSourcesWithStreams;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');
      await page.click(`[data-testid="xtream-account-header-1"]`);

      // THEN: "Orphan" badge is visible with amber styling
      const badge = page.locator(
        `[data-testid="xtream-stream-orphan-badge-${orphanStream.streamId}"]`
      );
      await expect(badge).toBeVisible();
      await expect(badge).toContainText(/orphan/i);

      // Badge should have amber/warning styling
      const badgeClasses = await badge.getAttribute('class');
      expect(badgeClasses).toMatch(/amber|yellow/i);
    });

    test('should display "Promoted" badge (green) for promoted streams', async ({
      page,
      xtreamSourcesWithStreams,
    }) => {
      // GIVEN: Promoted stream
      const { promotedStream } = xtreamSourcesWithStreams;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');
      await page.click(`[data-testid="xtream-account-header-1"]`);

      // THEN: "Promoted" badge is visible with green styling
      const badge = page.locator(
        `[data-testid="xtream-stream-promoted-badge-${promotedStream.streamId}"]`
      );
      await expect(badge).toBeVisible();
      await expect(badge).toContainText(/promoted/i);

      // Badge should have green styling
      const badgeClasses = await badge.getAttribute('class');
      expect(badgeClasses).toMatch(/green/i);
    });

    test('should load 500 streams quickly (performance check)', async ({
      page,
      largeXtreamAccount,
    }) => {
      // GIVEN: Account with large stream count
      const { account } = largeXtreamAccount;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');

      // WHEN: Expand accordion and measure load time
      const startTime = Date.now();
      const header = page.locator(`[data-testid="xtream-account-header-${account.id}"]`);
      await header.click();

      // Wait for streams to be visible
      const streamsList = page.locator(`[data-testid="xtream-account-streams-${account.id}"]`);
      await expect(streamsList).toBeVisible({ timeout: 1000 });

      const firstStream = page.locator('[data-testid^="xtream-stream-row-"]').first();
      await expect(firstStream).toBeVisible();

      const loadTime = Date.now() - startTime;

      // THEN: Load time is under 500ms
      console.log(`Loaded 500 streams in ${loadTime}ms`);
      expect(loadTime).toBeLessThan(500);
    });
  });

  test.describe('AC #3: Linked Stream Actions', () => {
    test('should open action menu when clicking linked stream', async ({
      page,
      xtreamSourcesWithStreams,
    }) => {
      // GIVEN: Linked stream
      const { linkedStream } = xtreamSourcesWithStreams;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');
      await page.click(`[data-testid="xtream-account-header-1"]`);

      // WHEN: Click action menu trigger
      const actionsTrigger = page.locator(
        `[data-testid="xtream-stream-actions-${linkedStream.streamId}"]`
      );
      await expect(actionsTrigger).toBeVisible();
      await actionsTrigger.click();

      // THEN: Action menu opens with options
      const viewLinkedButton = page.locator(
        `[data-testid="view-linked-channels-${linkedStream.streamId}"]`
      );
      await expect(viewLinkedButton).toBeVisible();
      await expect(viewLinkedButton).toContainText(/view linked/i);

      const unlinkButton = page.locator(
        `[data-testid="unlink-stream-${linkedStream.streamId}"]`
      );
      await expect(unlinkButton).toBeVisible();
      await expect(unlinkButton).toContainText(/unlink/i);
    });

    test('should display linked XMLTV channels when "View Linked" clicked', async ({
      page,
      xtreamSourcesWithStreams,
    }) => {
      // GIVEN: Linked stream with XMLTV channel IDs
      const { linkedStream } = xtreamSourcesWithStreams;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');
      await page.click(`[data-testid="xtream-account-header-1"]`);

      // Open action menu
      await page.click(`[data-testid="xtream-stream-actions-${linkedStream.streamId}"]`);

      // WHEN: Click "View Linked Channels"
      const viewLinkedButton = page.locator(
        `[data-testid="view-linked-channels-${linkedStream.streamId}"]`
      );
      await viewLinkedButton.click();

      // THEN: Popover/modal shows linked channel information
      const linkedPopover = page.locator('[data-testid="linked-channels-popover"]');
      await expect(linkedPopover).toBeVisible({ timeout: 2000 });

      // Should display XMLTV channel IDs (in a real scenario, would show names)
      for (const xmltvId of linkedStream.linkedXmltvIds) {
        await expect(linkedPopover).toContainText(xmltvId.toString());
      }
    });

    test('should unlink stream and update badge when "Unlink" clicked', async ({
      page,
      xtreamSourcesWithStreams,
    }) => {
      // GIVEN: Linked stream
      const { linkedStream } = xtreamSourcesWithStreams;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');
      await page.click(`[data-testid="xtream-account-header-1"]`);

      // Verify "Linked" badge initially
      const linkedBadge = page.locator(
        `[data-testid="xtream-stream-linked-badge-${linkedStream.streamId}"]`
      );
      await expect(linkedBadge).toBeVisible();

      // Open action menu
      await page.click(`[data-testid="xtream-stream-actions-${linkedStream.streamId}"]`);

      // WHEN: Click "Unlink"
      const unlinkButton = page.locator(
        `[data-testid="unlink-stream-${linkedStream.streamId}"]`
      );
      await unlinkButton.click();

      // THEN: Success toast is displayed
      const toast = page.getByText(/unlinked/i);
      await expect(toast).toBeVisible({ timeout: 2000 });

      // AND: Badge changes from "Linked" to "Orphan" (optimistic UI)
      const orphanBadge = page.locator(
        `[data-testid="xtream-stream-orphan-badge-${linkedStream.streamId}"]`
      );
      await expect(orphanBadge).toBeVisible({ timeout: 1000 });
    });
  });

  test.describe('AC #4: Orphan Stream Actions', () => {
    test('should open action menu for orphan stream with promote and link options', async ({
      page,
      xtreamSourcesWithStreams,
    }) => {
      // GIVEN: Orphan stream
      const { orphanStream } = xtreamSourcesWithStreams;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');
      await page.click(`[data-testid="xtream-account-header-1"]`);

      // WHEN: Click action menu trigger
      const actionsTrigger = page.locator(
        `[data-testid="xtream-stream-actions-${orphanStream.streamId}"]`
      );
      await actionsTrigger.click();

      // THEN: Action menu shows orphan-specific options
      const promoteButton = page.locator(
        `[data-testid="promote-to-lineup-${orphanStream.streamId}"]`
      );
      await expect(promoteButton).toBeVisible();
      await expect(promoteButton).toContainText(/promote to lineup/i);

      const linkButton = page.locator(
        `[data-testid="link-to-xmltv-${orphanStream.streamId}"]`
      );
      await expect(linkButton).toBeVisible();
      await expect(linkButton).toContainText(/link to xmltv/i);
    });

    test('should open promote dialog when "Promote to Lineup" clicked', async ({
      page,
      xtreamSourcesWithStreams,
    }) => {
      // GIVEN: Orphan stream
      const { orphanStream } = xtreamSourcesWithStreams;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');
      await page.click(`[data-testid="xtream-account-header-1"]`);

      // Open action menu
      await page.click(`[data-testid="xtream-stream-actions-${orphanStream.streamId}"]`);

      // WHEN: Click "Promote to Lineup"
      const promoteButton = page.locator(
        `[data-testid="promote-to-lineup-${orphanStream.streamId}"]`
      );
      await promoteButton.click();

      // THEN: Promote dialog opens
      const dialog = page.locator('[data-testid="promote-orphan-dialog"]');
      await expect(dialog).toBeVisible({ timeout: 2000 });

      // Dialog has form fields pre-filled
      const nameInput = page.locator('[data-testid="promote-display-name"]');
      await expect(nameInput).toBeVisible();
      await expect(nameInput).toHaveValue(orphanStream.name);

      // Has submit button
      const submitButton = page.locator('[data-testid="promote-submit-button"]');
      await expect(submitButton).toBeVisible();
    });

    test('should promote orphan and update badge when dialog submitted', async ({
      page,
      xtreamSourcesWithStreams,
    }) => {
      // GIVEN: Orphan stream with promote dialog open
      const { orphanStream } = xtreamSourcesWithStreams;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');
      await page.click(`[data-testid="xtream-account-header-1"]`);

      // Open promote dialog
      await page.click(`[data-testid="xtream-stream-actions-${orphanStream.streamId}"]`);
      await page.click(`[data-testid="promote-to-lineup-${orphanStream.streamId}"]`);

      // WHEN: Submit promote dialog
      const submitButton = page.locator('[data-testid="promote-submit-button"]');
      await submitButton.click();

      // THEN: Success toast is displayed
      const toast = page.getByText(/promoted to lineup/i);
      await expect(toast).toBeVisible({ timeout: 2000 });

      // AND: Badge changes from "Orphan" to "Promoted" (optimistic UI)
      const promotedBadge = page.locator(
        `[data-testid="xtream-stream-promoted-badge-${orphanStream.streamId}"]`
      );
      await expect(promotedBadge).toBeVisible({ timeout: 1000 });
    });

    test('should open stream search dropdown when "Link to XMLTV" clicked', async ({
      page,
      xtreamSourcesWithStreams,
    }) => {
      // GIVEN: Orphan stream
      const { orphanStream } = xtreamSourcesWithStreams;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');
      await page.click(`[data-testid="xtream-account-header-1"]`);

      // Open action menu
      await page.click(`[data-testid="xtream-stream-actions-${orphanStream.streamId}"]`);

      // WHEN: Click "Link to XMLTV Channel"
      const linkButton = page.locator(
        `[data-testid="link-to-xmltv-${orphanStream.streamId}"]`
      );
      await linkButton.click();

      // THEN: Stream search dropdown opens
      const searchDropdown = page.locator('[data-testid="stream-search-dropdown"]');
      await expect(searchDropdown).toBeVisible({ timeout: 2000 });

      // Has search input
      const searchInput = page.locator('[data-testid="stream-search-input"]');
      await expect(searchInput).toBeVisible();
    });
  });

  test.describe('Promoted Stream Actions', () => {
    test('should show "View in Lineup" and "Edit Channel" actions for promoted streams', async ({
      page,
      xtreamSourcesWithStreams,
    }) => {
      // GIVEN: Promoted stream
      const { promotedStream } = xtreamSourcesWithStreams;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');
      await page.click(`[data-testid="xtream-account-header-1"]`);

      // WHEN: Click action menu trigger
      const actionsTrigger = page.locator(
        `[data-testid="xtream-stream-actions-${promotedStream.streamId}"]`
      );
      await actionsTrigger.click();

      // THEN: Promoted-specific actions are visible
      const viewInLineupButton = page.locator(
        `[data-testid="view-in-lineup-${promotedStream.streamId}"]`
      );
      await expect(viewInLineupButton).toBeVisible();
      await expect(viewInLineupButton).toContainText(/view in lineup/i);

      const editButton = page.locator(
        `[data-testid="edit-channel-${promotedStream.streamId}"]`
      );
      await expect(editButton).toBeVisible();
      await expect(editButton).toContainText(/edit/i);
    });

    test('should navigate to Target Lineup when "View in Lineup" clicked', async ({
      page,
      xtreamSourcesWithStreams,
    }) => {
      // GIVEN: Promoted stream with action menu open
      const { promotedStream } = xtreamSourcesWithStreams;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');
      await page.click(`[data-testid="xtream-account-header-1"]`);
      await page.click(`[data-testid="xtream-stream-actions-${promotedStream.streamId}"]`);

      // WHEN: Click "View in Lineup"
      const viewInLineupButton = page.locator(
        `[data-testid="view-in-lineup-${promotedStream.streamId}"]`
      );
      await viewInLineupButton.click();

      // THEN: Navigate to Target Lineup view
      await expect(page).toHaveURL(/\/target-lineup/, { timeout: 2000 });
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible Xtream tab with ARIA attributes', async ({
      page,
      xtreamSourcesWithStreams,
    }) => {
      // GIVEN: Sources view with tabs
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // THEN: Xtream tab has proper ARIA attributes
      const xtreamTab = page.locator('[data-testid="xtream-tab"]');
      await expect(xtreamTab).toHaveAttribute('role', 'tab');
      await expect(xtreamTab).toHaveAttribute('aria-selected', 'false');
      await expect(xtreamTab).toHaveAttribute('aria-controls', 'xtream-tab-panel');

      // WHEN: Click tab
      await xtreamTab.click();

      // THEN: aria-selected updates
      await expect(xtreamTab).toHaveAttribute('aria-selected', 'true');
    });

    test('should have accessible accordion with ARIA attributes', async ({
      page,
      xtreamSourcesWithStreams,
    }) => {
      // GIVEN: Xtream account accordion
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');

      // THEN: Accordion header has aria-expanded
      const header = page.locator(`[data-testid="xtream-account-header-1"]`);
      await expect(header).toHaveAttribute('aria-expanded', 'false');

      // WHEN: Expand accordion
      await header.click();

      // THEN: aria-expanded updates
      await expect(header).toHaveAttribute('aria-expanded', 'true');

      // AND: aria-controls points to content ID
      const controlsId = await header.getAttribute('aria-controls');
      expect(controlsId).toBeTruthy();

      const content = page.locator(`#${controlsId}`);
      await expect(content).toBeVisible();
    });

    test('should have accessible action menus with ARIA attributes', async ({
      page,
      xtreamSourcesWithStreams,
    }) => {
      // GIVEN: Stream with action menu
      const { orphanStream } = xtreamSourcesWithStreams;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');
      await page.click(`[data-testid="xtream-account-header-1"]`);

      // THEN: Action trigger has aria-haspopup
      const actionsTrigger = page.locator(
        `[data-testid="xtream-stream-actions-${orphanStream.streamId}"]`
      );
      await expect(actionsTrigger).toHaveAttribute('aria-haspopup', 'menu');
    });
  });

  test.describe('Integration with Navigation', () => {
    test('should preserve Xtream tab state when navigating back from Target Lineup', async ({
      page,
      xtreamSourcesWithStreams,
    }) => {
      // GIVEN: User is on Xtream tab with expanded accordion
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="xtream-tab"]');
      await page.click(`[data-testid="xtream-account-header-1"]`);

      // WHEN: Navigate to Target Lineup
      await page.goto('/target-lineup');
      await page.waitForLoadState('networkidle');

      // AND: Navigate back to Sources
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // THEN: Should return to default state (XMLTV tab active, accordions collapsed)
      // This tests that state doesn't leak across navigation
      const xmltvTab = page.locator('[data-testid="xmltv-tab"]');
      await expect(xmltvTab).toHaveAttribute('aria-selected', 'true');
    });
  });
});
