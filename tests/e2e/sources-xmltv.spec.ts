import { Page } from '@playwright/test';
import {
  test,
  expect,
  createXmltvSourceChannel,
  createXmltvSourceChannels,
  createEnabledXmltvChannel,
  createDisabledXmltvChannel,
  createUnmatchedXmltvChannel,
  createMatchedXmltvChannel,
  createXmltvSource,
  createXmltvSources,
  XmltvSourceChannel,
  XmltvSource,
} from '../support/fixtures/sources-xmltv.fixture';

/**
 * E2E Tests for Story 3.10: Implement Sources View with XMLTV Tab
 *
 * Tests the user journey of:
 * 1. Navigating to new Sources view from sidebar
 * 2. Viewing XMLTV tab (default) and disabled Xtream tab
 * 3. Browsing XMLTV sources as expandable accordion sections
 * 4. Lazy-loading channels when expanding a source
 * 5. Viewing channel lineup status, match counts, and warnings
 * 6. Adding/removing channels to/from lineup
 * 7. Handling channels without stream sources
 *
 * ATDD Pattern: RED Phase - These tests MUST fail initially
 */

test.describe('Sources View (Story 3-10)', () => {
  test.beforeEach(async ({ page }) => {
    // Block image loading for faster tests
    await page.route('**/*.{png,jpg,jpeg,svg,gif}', (route) => route.abort());
  });

  test.describe('AC #1: Navigation Changes', () => {
    test('should display "Sources" menu item in sidebar after Target Lineup', async ({
      page,
      injectSourcesMocks,
    }) => {
      // GIVEN: App with Sources navigation
      const sources = createXmltvSources(2);
      const channelsMap = new Map([
        [sources[0].id, createXmltvSourceChannels(5)],
        [sources[1].id, createXmltvSourceChannels(3)],
      ]);
      await injectSourcesMocks(sources, channelsMap);

      // WHEN: Navigate to app
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // THEN: "Sources" menu item exists in sidebar
      const sourcesItem = page.locator('[data-testid="sources-nav-item"]');
      await expect(sourcesItem).toBeVisible();
      await expect(sourcesItem).toContainText('Sources');

      // Verify it has correct aria-label for accessibility
      await expect(sourcesItem).toHaveAttribute('aria-label', /sources/i);
    });

    test('should navigate to Sources view when clicking menu item', async ({
      page,
      injectSourcesMocks,
    }) => {
      // GIVEN: App with Sources in navigation
      const sources = createXmltvSources(1);
      const channelsMap = new Map([[sources[0].id, createXmltvSourceChannels(3)]]);
      await injectSourcesMocks(sources, channelsMap);

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // WHEN: Click "Sources" menu item
      await page.click('[data-testid="sources-nav-item"]');

      // THEN: Navigate to /sources route
      await expect(page).toHaveURL(/\/sources/);

      // AND: Sources view is rendered
      const view = page.locator('[data-testid="sources-view"]');
      await expect(view).toBeVisible();
    });
  });

  test.describe('AC #2: Tab Interface', () => {
    test('should display XMLTV and Xtream tabs with XMLTV active by default', async ({
      page,
      injectSourcesMocks,
    }) => {
      // GIVEN: Sources view with tabbed interface
      const sources = createXmltvSources(1);
      const channelsMap = new Map([[sources[0].id, createXmltvSourceChannels(2)]]);
      await injectSourcesMocks(sources, channelsMap);

      // WHEN: Navigate to Sources view
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // THEN: Both tabs are visible
      const xmltvTab = page.locator('[data-testid="xmltv-tab"]');
      const xtreamTab = page.locator('[data-testid="xtream-tab"]');

      await expect(xmltvTab).toBeVisible();
      await expect(xtreamTab).toBeVisible();

      // AND: XMLTV tab is active (aria-selected = true)
      await expect(xmltvTab).toHaveAttribute('aria-selected', 'true');
      await expect(xtreamTab).toHaveAttribute('aria-selected', 'false');

      // AND: XMLTV tab panel is displayed
      const xmltvPanel = page.locator('[data-testid="xmltv-sources-tab"]');
      await expect(xmltvPanel).toBeVisible();
    });

    test('should disable Xtream tab with "Soon" indicator until story 3-11', async ({
      page,
      injectSourcesMocks,
    }) => {
      // GIVEN: Sources view with tabs
      const sources = createXmltvSources(1);
      const channelsMap = new Map([[sources[0].id, createXmltvSourceChannels(2)]]);
      await injectSourcesMocks(sources, channelsMap);

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // THEN: Xtream tab is disabled
      const xtreamTab = page.locator('[data-testid="xtream-tab"]');
      await expect(xtreamTab).toBeDisabled();

      // AND: Has "Soon" or "Coming soon" indicator
      await expect(xtreamTab).toContainText(/soon/i);

      // AND: Has title attribute explaining it's coming in story 3-11
      await expect(xtreamTab).toHaveAttribute('title', /story 3-11/i);
    });

    test('should switch to Xtream tab when clicked (after story 3-11)', async ({
      page,
      injectSourcesMocks,
    }) => {
      // GIVEN: Sources view with tabs (NOTE: This test will pass after story 3-11)
      const sources = createXmltvSources(1);
      const channelsMap = new Map([[sources[0].id, createXmltvSourceChannels(2)]]);
      await injectSourcesMocks(sources, channelsMap);

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // WHEN: Click Xtream tab (skip if still disabled)
      const xtreamTab = page.locator('[data-testid="xtream-tab"]');
      const isDisabled = await xtreamTab.isDisabled();

      if (isDisabled) {
        // Test passes with skip for now - will work after story 3-11
        test.skip();
        return;
      }

      await xtreamTab.click();

      // THEN: Xtream tab becomes active
      await expect(xtreamTab).toHaveAttribute('aria-selected', 'true');

      // AND: XMLTV tab becomes inactive
      const xmltvTab = page.locator('[data-testid="xmltv-tab"]');
      await expect(xmltvTab).toHaveAttribute('aria-selected', 'false');
    });
  });

  test.describe('AC #3: XMLTV Sources Accordion Display', () => {
    test('should display XMLTV sources as accordion sections', async ({
      page,
      injectSourcesMocks,
    }) => {
      // GIVEN: Multiple XMLTV sources configured
      const sources = [
        createXmltvSource({ id: 1, name: 'IPTV Provider A EPG' }),
        createXmltvSource({ id: 2, name: 'IPTV Provider B EPG' }),
        createXmltvSource({ id: 3, name: 'Local EPG Source' }),
      ];
      const channelsMap = new Map([
        [1, createXmltvSourceChannels(10)],
        [2, createXmltvSourceChannels(25)],
        [3, createXmltvSourceChannels(5)],
      ]);
      await injectSourcesMocks(sources, channelsMap);

      // WHEN: Navigate to Sources view
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // THEN: Each source displays as accordion section
      for (const source of sources) {
        const accordion = page.locator(`[data-testid="xmltv-source-accordion-${source.id}"]`);
        await expect(accordion).toBeVisible();

        // Accordion header shows source name
        const header = page.locator(`[data-testid="xmltv-source-header-${source.id}"]`);
        await expect(header).toBeVisible();
        await expect(header).toContainText(source.name);
      }
    });

    test('should display channel count in accordion header', async ({
      page,
      injectSourcesMocks,
    }) => {
      // GIVEN: Source with known channel count
      const sources = [createXmltvSource({ id: 1, name: 'Test Source' })];
      const channelCount = 42;
      const channelsMap = new Map([[1, createXmltvSourceChannels(channelCount)]]);
      await injectSourcesMocks(sources, channelsMap);

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // THEN: Header displays channel count
      const header = page.locator(`[data-testid="xmltv-source-header-1"]`);
      await expect(header).toContainText(`${channelCount}`);
      await expect(header).toContainText(/channel/i);
    });

    test('should display empty state when no XMLTV sources configured', async ({
      page,
      emptySourcesState,
    }) => {
      // GIVEN: No XMLTV sources (fixture injects empty state)

      // WHEN: Navigate to Sources view
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // THEN: Empty state is displayed
      const emptyState = page.locator('[data-testid="xmltv-empty-state"]');
      await expect(emptyState).toBeVisible();

      const message = page.locator('[data-testid="xmltv-empty-state-message"]');
      await expect(message).toBeVisible();
      await expect(message).toContainText('No XMLTV sources configured');
      await expect(message).toContainText('Add sources in Accounts');

      // AND: Link to Accounts section
      const accountsLink = page.locator('[data-testid="go-to-accounts-button"]');
      await expect(accountsLink).toBeVisible();
    });
  });

  test.describe('AC #4: Lazy-Load Channels on Expand', () => {
    test('should NOT load channels until source is expanded', async ({
      page,
      injectSourcesMocks,
    }) => {
      // GIVEN: Source with many channels
      const sources = [createXmltvSource({ id: 1, name: 'Test Source' })];
      const channelsMap = new Map([[1, createXmltvSourceChannels(50)]]);
      await injectSourcesMocks(sources, channelsMap);

      // Listen for command invocations
      const commandCalls: string[] = [];
      page.on('console', (msg) => {
        if (msg.text().includes('[Mock] get_xmltv_channels_for_source')) {
          commandCalls.push(msg.text());
        }
      });

      // WHEN: Navigate to Sources view (accordion collapsed by default)
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // THEN: get_xmltv_channels_for_source should NOT be called yet
      await page.waitForTimeout(500); // Give time for any rogue calls
      expect(commandCalls.length).toBe(0);

      // Channels list should not be visible
      const channelsList = page.locator(`[data-testid="xmltv-source-channels-1"]`);
      await expect(channelsList).not.toBeVisible();
    });

    test('should lazy-load channels when source accordion is expanded', async ({
      page,
      injectSourcesMocks,
    }) => {
      // GIVEN: Collapsed source accordion
      const sources = [createXmltvSource({ id: 1, name: 'Test Source' })];
      const channels = createXmltvSourceChannels(10);
      const channelsMap = new Map([[1, channels]]);
      await injectSourcesMocks(sources, channelsMap);

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // WHEN: Click to expand accordion
      const header = page.locator(`[data-testid="xmltv-source-header-1"]`);
      await header.click();

      // THEN: Channels are loaded and displayed
      const channelsList = page.locator(`[data-testid="xmltv-source-channels-1"]`);
      await expect(channelsList).toBeVisible({ timeout: 2000 });

      // Verify channels are rendered
      for (const channel of channels.slice(0, 3)) {
        // Check first 3 channels
        const channelRow = page.locator(`[data-testid="xmltv-channel-row-${channel.id}"]`);
        await expect(channelRow).toBeVisible();
      }
    });

    test('should load 500 channels quickly (performance check)', async ({
      page,
      largeSourceWithChannels,
    }) => {
      // GIVEN: Source with large channel count (fixture provides 500 channels)
      const { source } = largeSourceWithChannels;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // WHEN: Expand accordion and measure load time
      const startTime = Date.now();
      const header = page.locator(`[data-testid="xmltv-source-header-${source.id}"]`);
      await header.click();

      // Wait for channels to be visible
      const channelsList = page.locator(`[data-testid="xmltv-source-channels-${source.id}"]`);
      await expect(channelsList).toBeVisible({ timeout: 1000 });

      const firstChannel = page.locator('[data-testid^="xmltv-channel-row-"]').first();
      await expect(firstChannel).toBeVisible();

      const loadTime = Date.now() - startTime;

      // THEN: Load time is under 500ms (performance target: <200ms, but allow buffer for test env)
      console.log(`Loaded 500 channels in ${loadTime}ms`);
      expect(loadTime).toBeLessThan(500);
    });
  });

  test.describe('AC #5: Channel Display with Badges', () => {
    test('should display channel with icon, name, and badges', async ({
      page,
      injectSourcesMocks,
    }) => {
      // GIVEN: Source with channel that has all attributes
      const sources = [createXmltvSource({ id: 1, name: 'Test Source' })];
      const channel = createEnabledXmltvChannel({
        id: 100,
        displayName: 'CNN HD',
        icon: 'https://example.com/cnn.png',
        matchCount: 3,
      });
      const channelsMap = new Map([[1, [channel]]]);
      await injectSourcesMocks(sources, channelsMap);

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // Expand accordion
      await page.click(`[data-testid="xmltv-source-header-1"]`);
      await page.waitForLoadState('networkidle');

      // THEN: Channel row displays all elements
      const channelRow = page.locator(`[data-testid="xmltv-channel-row-${channel.id}"]`);
      await expect(channelRow).toBeVisible();

      // Icon is displayed
      const icon = page.locator(`[data-testid="xmltv-channel-icon-${channel.id}"]`);
      await expect(icon).toBeVisible();

      // Display name is shown
      const name = page.locator(`[data-testid="xmltv-channel-name-${channel.id}"]`);
      await expect(name).toBeVisible();
      await expect(name).toContainText('CNN HD');
    });

    test('should display "In Lineup" badge when channel is enabled', async ({
      page,
      sourcesWithChannels,
    }) => {
      // GIVEN: Enabled channel (fixture provides pre-configured data)
      const { enabledChannel } = sourcesWithChannels;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click(`[data-testid="xmltv-source-header-1"]`);

      // THEN: "In Lineup" badge is visible
      const badge = page.locator(
        `[data-testid="xmltv-channel-in-lineup-badge-${enabledChannel.id}"]`
      );
      await expect(badge).toBeVisible();
      await expect(badge).toContainText(/in lineup/i);

      // Badge should have green styling (check via class or style)
      const badgeClasses = await badge.getAttribute('class');
      expect(badgeClasses).toMatch(/green/i);
    });

    test('should NOT display "In Lineup" badge when channel is disabled', async ({
      page,
      sourcesWithChannels,
    }) => {
      // GIVEN: Disabled channel (fixture provides pre-configured data)
      const { disabledChannel } = sourcesWithChannels;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click(`[data-testid="xmltv-source-header-1"]`);

      // THEN: "In Lineup" badge is NOT visible
      const badge = page.locator(
        `[data-testid="xmltv-channel-in-lineup-badge-${disabledChannel.id}"]`
      );
      await expect(badge).not.toBeVisible();
    });

    test('should display match count badge showing number of streams', async ({
      page,
      injectSourcesMocks,
    }) => {
      // GIVEN: Channel with 3 matched streams
      const sources = [createXmltvSource({ id: 1, name: 'Test Source' })];
      const channel = createMatchedXmltvChannel({ id: 100, matchCount: 3 });
      const channelsMap = new Map([[1, [channel]]]);
      await injectSourcesMocks(sources, channelsMap);

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click(`[data-testid="xmltv-source-header-1"]`);

      // THEN: Match count badge displays "3 streams"
      const badge = page.locator(`[data-testid="xmltv-channel-match-count-${channel.id}"]`);
      await expect(badge).toBeVisible();
      await expect(badge).toContainText('3');
      await expect(badge).toContainText(/stream/i);

      // Badge should have blue styling
      const badgeClasses = await badge.getAttribute('class');
      expect(badgeClasses).toMatch(/blue/i);
    });

    test('should display "No streams" warning when matchCount = 0', async ({
      page,
      sourcesWithChannels,
    }) => {
      // GIVEN: Channel with no matched streams (fixture provides pre-configured data)
      const { unmatchedChannel } = sourcesWithChannels;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click(`[data-testid="xmltv-source-header-1"]`);

      // THEN: "No streams" warning is displayed
      const warning = page.locator(
        `[data-testid="xmltv-channel-no-streams-warning-${unmatchedChannel.id}"]`
      );
      await expect(warning).toBeVisible();
      await expect(warning).toContainText(/no stream/i);

      // Warning should have amber/warning styling
      const warningClasses = await warning.getAttribute('class');
      expect(warningClasses).toMatch(/amber|yellow|warning/i);

      // Tooltip explains the issue
      await expect(warning).toHaveAttribute('title', /no video source/i);
    });
  });

  test.describe('AC #6: Channel Actions', () => {
    test('should open action menu when clicking channel', async ({
      page,
      sourcesWithChannels,
    }) => {
      // GIVEN: Channel in sources list (fixture provides pre-configured data)
      const { disabledChannel } = sourcesWithChannels;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click(`[data-testid="xmltv-source-header-1"]`);

      // WHEN: Click action menu trigger
      const actionsTrigger = page.locator(
        `[data-testid="xmltv-channel-actions-${disabledChannel.id}"]`
      );
      await expect(actionsTrigger).toBeVisible();
      await actionsTrigger.click();

      // THEN: Action menu opens with options
      const addButton = page.locator(
        `[data-testid="xmltv-channel-add-to-lineup-${disabledChannel.id}"]`
      );
      await expect(addButton).toBeVisible();
    });

    test('should enable channel and show success toast when "Add to Lineup" clicked', async ({
      page,
      sourcesWithChannels,
    }) => {
      // GIVEN: Disabled channel with stream matches (fixture provides pre-configured data)
      const { disabledChannel } = sourcesWithChannels;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click(`[data-testid="xmltv-source-header-1"]`);

      // Open action menu
      await page.click(`[data-testid="xmltv-channel-actions-${disabledChannel.id}"]`);

      // WHEN: Click "Add to Lineup"
      const addButton = page.locator(
        `[data-testid="xmltv-channel-add-to-lineup-${disabledChannel.id}"]`
      );
      await addButton.click();

      // THEN: Success toast is displayed
      const toast = page.getByText(/added to lineup/i);
      await expect(toast).toBeVisible({ timeout: 2000 });

      // AND: Channel now shows "In Lineup" badge (optimistic UI)
      const inLineupBadge = page.locator(
        `[data-testid="xmltv-channel-in-lineup-badge-${disabledChannel.id}"]`
      );
      await expect(inLineupBadge).toBeVisible({ timeout: 1000 });
    });

    test('should show error toast when trying to add channel with no streams', async ({
      page,
      sourcesWithChannels,
    }) => {
      // GIVEN: Channel with no stream matches (fixture provides pre-configured data)
      const { unmatchedChannel } = sourcesWithChannels;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click(`[data-testid="xmltv-source-header-1"]`);

      // Open action menu
      await page.click(`[data-testid="xmltv-channel-actions-${unmatchedChannel.id}"]`);

      // WHEN: Click "Add to Lineup" (button should be disabled, but test the error path)
      const addButton = page.locator(
        `[data-testid="xmltv-channel-add-to-lineup-${unmatchedChannel.id}"]`
      );

      // Check if button is disabled (expected behavior)
      const isDisabled = await addButton.isDisabled();
      if (isDisabled) {
        // If properly disabled, test passes - cannot trigger error
        expect(isDisabled).toBe(true);
        return;
      }

      // If not disabled (bug), clicking should show error
      await addButton.click();

      // THEN: Error toast is displayed
      const errorToast = page.getByText(/cannot add.*no stream/i);
      await expect(errorToast).toBeVisible({ timeout: 2000 });
    });

    test('should disable channel and show success toast when "Remove from Lineup" clicked', async ({
      page,
      sourcesWithChannels,
    }) => {
      // GIVEN: Enabled channel (fixture provides pre-configured data)
      const { enabledChannel } = sourcesWithChannels;

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click(`[data-testid="xmltv-source-header-1"]`);

      // Verify "In Lineup" badge is initially visible
      const inLineupBadge = page.locator(
        `[data-testid="xmltv-channel-in-lineup-badge-${enabledChannel.id}"]`
      );
      await expect(inLineupBadge).toBeVisible();

      // Open action menu
      await page.click(`[data-testid="xmltv-channel-actions-${enabledChannel.id}"]`);

      // WHEN: Click "Remove from Lineup"
      const removeButton = page.locator(
        `[data-testid="xmltv-channel-remove-from-lineup-${enabledChannel.id}"]`
      );
      await removeButton.click();

      // THEN: Success toast is displayed
      const toast = page.getByText(/removed from lineup/i);
      await expect(toast).toBeVisible({ timeout: 2000 });

      // AND: "In Lineup" badge is removed (optimistic UI)
      await expect(inLineupBadge).not.toBeVisible({ timeout: 1000 });
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible Sources navigation item with ARIA label', async ({
      page,
      injectSourcesMocks,
    }) => {
      // GIVEN: App with navigation
      const sources = createXmltvSources(1);
      const channelsMap = new Map([[sources[0].id, createXmltvSourceChannels(2)]]);
      await injectSourcesMocks(sources, channelsMap);

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // THEN: Navigation item is accessible
      const navItem = page.locator('[data-testid="sources-nav-item"]');
      await expect(navItem).toHaveAttribute('aria-label', /sources/i);
    });

    test('should have accessible tab interface with ARIA attributes', async ({
      page,
      injectSourcesMocks,
    }) => {
      // GIVEN: Sources view with tabs
      const sources = createXmltvSources(1);
      const channelsMap = new Map([[sources[0].id, createXmltvSourceChannels(2)]]);
      await injectSourcesMocks(sources, channelsMap);

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // THEN: Tabs have proper ARIA attributes
      const xmltvTab = page.locator('[data-testid="xmltv-tab"]');
      await expect(xmltvTab).toHaveAttribute('role', 'tab');
      await expect(xmltvTab).toHaveAttribute('aria-selected', 'true');

      const xtreamTab = page.locator('[data-testid="xtream-tab"]');
      await expect(xtreamTab).toHaveAttribute('role', 'tab');
      await expect(xtreamTab).toHaveAttribute('aria-selected', 'false');
    });

    test('should have accessible accordion with ARIA attributes', async ({
      page,
      injectSourcesMocks,
    }) => {
      // GIVEN: Source accordion
      const sources = [createXmltvSource({ id: 1, name: 'Test Source' })];
      const channelsMap = new Map([[1, createXmltvSourceChannels(2)]]);
      await injectSourcesMocks(sources, channelsMap);

      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // THEN: Accordion header has aria-expanded
      const header = page.locator(`[data-testid="xmltv-source-header-1"]`);
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
  });

  test.describe('Integration with Target Lineup', () => {
    test('should update "Browse Sources" button in Target Lineup to navigate to /sources', async ({
      page,
      injectSourcesMocks,
    }) => {
      // GIVEN: Empty Target Lineup (no enabled channels)
      const sources = createXmltvSources(1);
      const channelsMap = new Map([[sources[0].id, [createDisabledXmltvChannel()]]]);
      await injectSourcesMocks(sources, channelsMap);

      // WHEN: Navigate to Target Lineup
      await page.goto('/target-lineup');
      await page.waitForLoadState('networkidle');

      // THEN: Empty state is shown with "Browse Sources" button
      const browseButton = page.locator('[data-testid="browse-sources-button"]');
      await expect(browseButton).toBeVisible();

      // WHEN: Click "Browse Sources"
      await browseButton.click();

      // THEN: Navigates to /sources (not /accounts)
      await expect(page).toHaveURL(/\/sources/);

      // AND: Sources view is displayed
      const sourcesView = page.locator('[data-testid="sources-view"]');
      await expect(sourcesView).toBeVisible();
    });
  });
});
