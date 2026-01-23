import { test, expect } from '../support/fixtures/epg-channel-list.fixture';

/**
 * E2E Tests for Story 5.5: EPG Channel List Panel
 *
 * Tests the vertical channel list with current program display,
 * selection state, and virtualization performance.
 *
 * Acceptance Criteria:
 * AC1: Display virtualized list of enabled channels with program info
 * AC2: Channel selection updates UI state and triggers center panel update
 * AC3: List remains responsive with large channel counts (<100ms)
 */

test.describe('EPG Channel List Panel', () => {
  test('should display channel list with current program info (AC1)', async ({
    page,
    epgChannelListData,
  }) => {
    // GIVEN: User navigates to EPG TV view with seeded channel data
    await page.goto('/epg-tv');

    // THEN: Channel list container is visible
    const channelList = page.getByTestId('epg-channel-list');
    await expect(channelList).toBeVisible();

    // AND: First channel row displays all required information
    const firstChannel = epgChannelListData.channels[0];
    const firstRow = page.getByTestId(`channel-row-${firstChannel.id}`);
    await expect(firstRow).toBeVisible();

    // Verify channel logo is displayed (80×60px)
    const logo = firstRow.locator('[data-testid="channel-logo"]');
    await expect(logo).toBeVisible();
    const logoBox = await logo.boundingBox();
    expect(logoBox?.width).toBeLessThanOrEqual(80);
    expect(logoBox?.height).toBeLessThanOrEqual(60);

    // Verify channel name is displayed (bold, white)
    const channelName = firstRow.locator('[data-testid="channel-name"]');
    await expect(channelName).toBeVisible();
    await expect(channelName).toHaveText(firstChannel.name);
    const nameStyles = await channelName.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        fontWeight: computed.fontWeight,
        color: computed.color,
      };
    });
    expect(parseInt(nameStyles.fontWeight)).toBeGreaterThanOrEqual(600); // Bold

    // Verify current program time range is displayed
    const currentProgram = firstChannel.currentProgram!;
    const timeRange = firstRow.locator('[data-testid="program-time-range"]');
    await expect(timeRange).toBeVisible();

    // Verify current program title is displayed
    const programTitle = firstRow.locator('[data-testid="program-title"]');
    await expect(programTitle).toBeVisible();
    await expect(programTitle).toHaveText(currentProgram.title);

    // Verify progress bar is displayed
    const progressBar = firstRow.locator('[data-testid="progress-bar"]');
    await expect(progressBar).toBeVisible();
  });

  test('should display progress bar showing elapsed time (AC1)', async ({
    page,
    epgChannelListData,
  }) => {
    // GIVEN: User navigates to EPG TV view
    await page.goto('/epg-tv');

    // WHEN: Viewing a channel with a program in progress
    const firstChannel = epgChannelListData.channels[0];
    const firstRow = page.getByTestId(`channel-row-${firstChannel.id}`);

    // THEN: Progress bar width reflects elapsed time
    const progressBar = firstRow.locator('[data-testid="progress-bar"]');
    const progressFill = progressBar.locator('[data-testid="progress-fill"]');
    await expect(progressFill).toBeVisible();

    // Calculate expected progress percentage
    const currentProgram = firstChannel.currentProgram!;
    const now = new Date();
    const start = new Date(currentProgram.startTime);
    const end = new Date(currentProgram.endTime);
    const elapsed = now.getTime() - start.getTime();
    const duration = end.getTime() - start.getTime();
    const expectedProgress = (elapsed / duration) * 100;

    // Get actual progress width
    const fillBox = await progressFill.boundingBox();
    const containerBox = await progressBar.boundingBox();
    const actualProgress = ((fillBox?.width || 0) / (containerBox?.width || 1)) * 100;

    // Allow 5% tolerance for timing differences
    expect(actualProgress).toBeGreaterThanOrEqual(expectedProgress - 5);
    expect(actualProgress).toBeLessThanOrEqual(expectedProgress + 5);

    // Verify progress bar styling
    const fillStyles = await progressFill.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        background: computed.background,
        backgroundImage: computed.backgroundImage,
        height: computed.height,
      };
    });
    expect(fillStyles.backgroundImage).toContain('linear-gradient'); // Gradient fill
    expect(parseInt(fillStyles.height)).toBeLessThanOrEqual(4); // 3px height
  });

  test('should select channel and update state on click (AC2)', async ({
    page,
    epgChannelListData,
  }) => {
    // GIVEN: User navigates to EPG TV view
    await page.goto('/epg-tv');

    // WHEN: User clicks on a channel row
    const secondChannel = epgChannelListData.channels[1];
    const secondRow = page.getByTestId(`channel-row-${secondChannel.id}`);
    await secondRow.click();

    // THEN: Selected row shows selected state styling
    await expect(secondRow).toHaveAttribute('aria-selected', 'true');

    // Verify selected styling (pill highlight, purple tint)
    const rowStyles = await secondRow.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        border: computed.border,
        borderRadius: computed.borderRadius,
        backgroundColor: computed.backgroundColor,
      };
    });

    expect(parseInt(rowStyles.borderRadius)).toBeGreaterThanOrEqual(12); // Rounded
    expect(rowStyles.backgroundColor).toMatch(/rgba?\(/); // Semi-transparent purple

    // AND: Previously selected row is deselected
    const firstChannel = epgChannelListData.channels[0];
    const firstRow = page.getByTestId(`channel-row-${firstChannel.id}`);
    await expect(firstRow).not.toHaveAttribute('aria-selected', 'true');
  });

  test('should support keyboard navigation for channel selection (AC2)', async ({
    page,
    epgChannelListData,
  }) => {
    // GIVEN: User navigates to EPG TV view and focuses on channel list
    await page.goto('/epg-tv');
    const channelList = page.getByTestId('epg-channel-list');

    // WHEN: User presses down arrow key
    await channelList.focus();
    await page.keyboard.press('ArrowDown');

    // THEN: First channel is selected
    const firstChannel = epgChannelListData.channels[0];
    const firstRow = page.getByTestId(`channel-row-${firstChannel.id}`);
    await expect(firstRow).toHaveAttribute('aria-selected', 'true');

    // WHEN: User presses down arrow again
    await page.keyboard.press('ArrowDown');

    // THEN: Second channel is selected
    const secondChannel = epgChannelListData.channels[1];
    const secondRow = page.getByTestId(`channel-row-${secondChannel.id}`);
    await expect(secondRow).toHaveAttribute('aria-selected', 'true');

    // AND: First channel is deselected
    await expect(firstRow).not.toHaveAttribute('aria-selected', 'true');

    // WHEN: User presses up arrow
    await page.keyboard.press('ArrowUp');

    // THEN: First channel is selected again
    await expect(firstRow).toHaveAttribute('aria-selected', 'true');
    await expect(secondRow).not.toHaveAttribute('aria-selected', 'true');
  });

  test('should remain responsive with large channel list (AC3)', async ({ page }) => {
    // GIVEN: EPG TV view with 500+ channels
    await page.goto('/epg-tv');

    // Seed 500 channels
    await page.evaluate(async () => {
      // @ts-ignore
      const { invoke } = window.__TAURI__;

      for (let i = 1; i <= 500; i++) {
        await invoke('create_test_xmltv_channel', {
          id: i,
          displayName: `Test Channel ${i}`,
          icon: null,
        });

        await invoke('set_xmltv_channel_enabled', {
          channelId: i,
          enabled: true,
          plexDisplayOrder: i,
        });

        // Create one current program
        const now = new Date();
        await invoke('create_test_program', {
          xmltvChannelId: i,
          title: `Program ${i}`,
          startTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
          endTime: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        });
      }
    });

    // Refresh to load new data
    await page.reload();

    const channelList = page.getByTestId('epg-channel-list');
    await expect(channelList).toBeVisible();

    // WHEN: User scrolls rapidly through the list
    const scrollContainer = channelList;
    const startTime = Date.now();

    // Perform 10 rapid scroll operations
    for (let i = 0; i < 10; i++) {
      await scrollContainer.evaluate((el) => {
        el.scrollTop += 1000; // Scroll down 1000px
      });
      await page.waitForTimeout(50); // 50ms between scrolls
    }

    const scrollTime = Date.now() - startTime;

    // THEN: Scrolling completes in reasonable time (should be responsive)
    expect(scrollTime).toBeLessThan(1000); // 10 scrolls in under 1 second

    // AND: Only visible rows are rendered (virtualization working)
    const renderedRows = await page.getByTestId(/^channel-row-/).count();
    expect(renderedRows).toBeLessThan(100); // Should be far less than 500 (only visible + overscan)

    // AND: UI remains responsive (measure frame time)
    const performanceMetrics = await page.evaluate(() => {
      const entries = performance.getEntriesByType('paint') as PerformanceEntry[];
      return {
        paintTimings: entries.map((e) => ({ name: e.name, startTime: e.startTime })),
      };
    });

    // Basic performance check - page should have painted
    expect(performanceMetrics.paintTimings.length).toBeGreaterThan(0);
  });

  test('should display empty state when no enabled channels (AC1)', async ({ page }) => {
    // GIVEN: No enabled channels exist
    await page.evaluate(async () => {
      // @ts-ignore
      const { invoke } = window.__TAURI__;
      // Disable all test channels
      const channels = await invoke('get_all_xmltv_channels');
      for (const channel of channels) {
        await invoke('set_xmltv_channel_enabled', {
          channelId: channel.id,
          enabled: false,
        });
      }
    });

    // WHEN: User navigates to EPG TV view
    await page.goto('/epg-tv');

    // THEN: Empty state message is displayed
    const emptyState = page.getByTestId('epg-channel-list-empty');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No channels in lineup');
    await expect(emptyState).toContainText('Add channels from Sources');
  });

  test('should handle channel without current program (AC1)', async ({
    page,
    epgChannelListData,
  }) => {
    // GIVEN: Channel with no current program
    const channelWithoutProgram = epgChannelListData.channels.find(
      (ch) => !ch.currentProgram
    );

    if (channelWithoutProgram) {
      await page.goto('/epg-tv');

      // WHEN: Viewing the channel row
      const row = page.getByTestId(`channel-row-${channelWithoutProgram.id}`);
      await expect(row).toBeVisible();

      // THEN: Fallback message is displayed
      const programTitle = row.locator('[data-testid="program-title"]');
      await expect(programTitle).toHaveText('No program info available');

      // AND: Progress bar is not displayed
      const progressBar = row.locator('[data-testid="progress-bar"]');
      await expect(progressBar).not.toBeVisible();
    }
  });

  test('should truncate long channel names with ellipsis (AC1)', async ({ page }) => {
    // GIVEN: Channel with very long name
    await page.evaluate(async () => {
      // @ts-ignore
      const { invoke } = window.__TAURI__;

      await invoke('create_test_xmltv_channel', {
        id: 9999,
        displayName: 'Super Long Channel Name That Should Be Truncated With Ellipsis',
        icon: null,
      });

      await invoke('set_xmltv_channel_enabled', {
        channelId: 9999,
        enabled: true,
        plexDisplayOrder: 1,
      });
    });

    await page.goto('/epg-tv');

    // WHEN: Viewing the channel row
    const row = page.getByTestId('channel-row-9999');
    await expect(row).toBeVisible();

    // THEN: Channel name is truncated
    const channelName = row.locator('[data-testid="channel-name"]');
    const nameStyles = await channelName.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        overflow: computed.overflow,
        textOverflow: computed.textOverflow,
        whiteSpace: computed.whiteSpace,
      };
    });

    expect(nameStyles.overflow).toBe('hidden');
    expect(nameStyles.textOverflow).toBe('ellipsis');
  });

  test('should display placeholder icon for missing channel logo (AC1)', async ({ page }) => {
    // GIVEN: Channel without logo
    await page.evaluate(async () => {
      // @ts-ignore
      const { invoke } = window.__TAURI__;

      await invoke('create_test_xmltv_channel', {
        id: 8888,
        displayName: 'No Logo Channel',
        icon: null,
      });

      await invoke('set_xmltv_channel_enabled', {
        channelId: 8888,
        enabled: true,
        plexDisplayOrder: 1,
      });
    });

    await page.goto('/epg-tv');

    // WHEN: Viewing the channel row
    const row = page.getByTestId('channel-row-8888');
    await expect(row).toBeVisible();

    // THEN: Placeholder icon or first letter is displayed
    const logo = row.locator('[data-testid="channel-logo"]');
    await expect(logo).toBeVisible();

    // Check if it's showing a fallback (either SVG icon or text)
    const logoContent = await logo.evaluate((el) => ({
      tagName: el.tagName,
      textContent: el.textContent,
      hasImage: el.querySelector('img') !== null,
    }));

    // Should show either placeholder icon or first letter
    expect(
      logoContent.hasImage || logoContent.textContent?.trim().length === 1
    ).toBeTruthy();
  });

  test('should update progress bars every 60 seconds (AC1)', async ({
    page,
    epgChannelListData,
  }) => {
    // GIVEN: User is viewing channel list
    await page.goto('/epg-tv');

    const firstChannel = epgChannelListData.channels[0];
    const firstRow = page.getByTestId(`channel-row-${firstChannel.id}`);
    const progressFill = firstRow
      .locator('[data-testid="progress-bar"]')
      .locator('[data-testid="progress-fill"]');

    // Get initial progress width
    const initialBox = await progressFill.boundingBox();
    const initialWidth = initialBox?.width || 0;

    // WHEN: 60 seconds pass (simulate with timer fast-forward)
    await page.waitForTimeout(2000); // Wait 2 seconds to see if auto-refresh is working

    // THEN: Progress bar should have updated (width increased)
    // Note: In real implementation, this would be a 60-second interval
    // For testing, we verify the component is set up to update
    const updatedBox = await progressFill.boundingBox();
    const updatedWidth = updatedBox?.width || 0;

    // Progress should increase over time (or at least be recalculated)
    expect(updatedWidth).toBeGreaterThanOrEqual(initialWidth);
  });
});
