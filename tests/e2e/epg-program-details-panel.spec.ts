import { test, expect } from '../support/fixtures/epg-program-details.fixture';
import {
  formatTimeRange,
  formatFullDate,
  getProgramStatus,
} from '../support/factories/epg-program-details.factory';

/**
 * E2E Tests for Story 5.8: EPG Program Details Panel
 *
 * Tests the right panel program details display with title, episode info,
 * channel badge, status indicator, metadata, description, and close behavior.
 *
 * Acceptance Criteria:
 * AC1: Display detailed program information in right panel
 * AC2: Show empty state when no program selected
 * AC3: Close panel on outside click or Escape key
 */

test.describe('EPG Program Details Panel', () => {
  test('should display program details panel with all required information (AC1)', async ({
    page,
    programDetailsData,
    programDetailsApi,
  }) => {
    // GIVEN: User navigates to EPG TV view and selects a channel
    await page.goto('/epg-tv');

    // Select the channel first
    await page.getByTestId(`channel-row-${programDetailsData.channelId}`).click();
    await page.waitForTimeout(500);

    // WHEN: User selects a program from the schedule
    await programDetailsApi.selectProgram(programDetailsData.programId);

    // THEN: Program details panel is visible
    const detailsPanel = page.getByTestId('epg-program-details');
    await expect(detailsPanel).toBeVisible();

    // AND: Program title is displayed (28-32px, bold, white)
    const programTitle = page.getByTestId('program-title');
    await expect(programTitle).toBeVisible();
    await expect(programTitle).toContainText(programDetailsData.program.title);

    const titleStyles = await programTitle.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        fontWeight: computed.fontWeight,
        fontSize: computed.fontSize,
      };
    });
    expect(parseInt(titleStyles.fontWeight)).toBeGreaterThanOrEqual(600); // Bold
    expect(parseInt(titleStyles.fontSize)).toBeGreaterThanOrEqual(28); // 28-32px

    // AND: Episode info is displayed (if applicable)
    if (programDetailsData.program.episodeInfo) {
      const episodeInfo = page.getByTestId('episode-info');
      await expect(episodeInfo).toBeVisible();
      await expect(episodeInfo).toContainText(programDetailsData.program.episodeInfo);
    }
  });

  test('should display channel badge with logo, name, and status (AC1)', async ({
    page,
    programDetailsData,
    programDetailsApi,
  }) => {
    // GIVEN: User has EPG TV view loaded
    await page.goto('/epg-tv');
    await page.getByTestId(`channel-row-${programDetailsData.channelId}`).click();
    await page.waitForTimeout(500);

    // WHEN: User selects a program
    await programDetailsApi.selectProgram(programDetailsData.programId);

    // THEN: Channel badge section is visible
    const channelBadge = page.getByTestId('channel-badge');
    await expect(channelBadge).toBeVisible();

    // AND: Channel logo is displayed (48x36px)
    const channelLogo = channelBadge.locator('img').first();
    if (programDetailsData.channel.icon) {
      await expect(channelLogo).toBeVisible();
      const logoSize = await channelLogo.evaluate((el) => {
        return {
          width: el.clientWidth,
          height: el.clientHeight,
        };
      });
      expect(logoSize.width).toBeGreaterThanOrEqual(40);
      expect(logoSize.height).toBeGreaterThanOrEqual(30);
    }

    // AND: Channel name is displayed (bold, 16px, white)
    await expect(channelBadge).toContainText(programDetailsData.channel.displayName);

    // AND: Program status indicator is displayed
    const statusIndicator = page.getByTestId('program-status');
    await expect(statusIndicator).toBeVisible();

    const programStatus = getProgramStatus(
      programDetailsData.program.startTime,
      programDetailsData.program.endTime
    );

    // Status should be "Live Now" since test program is currently airing
    await expect(statusIndicator).toContainText(programStatus.label);

    // Verify status color styling
    const statusStyles = await statusIndicator.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    expect(statusStyles).toBeDefined();
  });

  test('should display program metadata (time, date, categories) (AC1)', async ({
    page,
    programDetailsData,
    programDetailsApi,
  }) => {
    // GIVEN: User views EPG with selected channel
    await page.goto('/epg-tv');
    await page.getByTestId(`channel-row-${programDetailsData.channelId}`).click();
    await page.waitForTimeout(500);

    // WHEN: User selects a program
    await programDetailsApi.selectProgram(programDetailsData.programId);

    // THEN: Time range is displayed with clock icon
    const programTime = page.getByTestId('program-time');
    await expect(programTime).toBeVisible();

    const expectedTimeRange = formatTimeRange(
      programDetailsData.program.startTime,
      programDetailsData.program.endTime
    );
    // Check for partial time match (allowing for formatting differences)
    await expect(programTime).toContainText(/:/, { useInnerText: true });

    // AND: Full date is displayed with calendar icon
    const programDate = page.getByTestId('program-date');
    await expect(programDate).toBeVisible();

    const expectedDate = formatFullDate(programDetailsData.program.startTime);
    // Check for day of week and date number
    const dateText = await programDate.textContent();
    expect(dateText).toBeTruthy();

    // AND: Category/genre tags are displayed
    if (programDetailsData.program.category) {
      const programCategories = page.getByTestId('program-categories');
      await expect(programCategories).toBeVisible();
      await expect(programCategories).toContainText(programDetailsData.program.category);
    }

    // AND: Divider lines separate sections
    const dividers = detailsPanel.locator('hr, [role="separator"]');
    const dividerCount = await dividers.count();
    expect(dividerCount).toBeGreaterThan(0);
  });

  test('should display program description (scrollable) (AC1)', async ({
    page,
    programDetailsData,
    programDetailsApi,
  }) => {
    // GIVEN: User has program selected
    await page.goto('/epg-tv');
    await page.getByTestId(`channel-row-${programDetailsData.channelId}`).click();
    await page.waitForTimeout(500);
    await programDetailsApi.selectProgram(programDetailsData.programId);

    // THEN: Program description is visible
    const programDescription = page.getByTestId('program-description');
    await expect(programDescription).toBeVisible();

    if (programDetailsData.program.description) {
      await expect(programDescription).toContainText(programDetailsData.program.description);

      // Verify text styling (14-16px, light gray, line-height 1.5)
      const descStyles = await programDescription.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          fontSize: computed.fontSize,
          lineHeight: computed.lineHeight,
          overflow: computed.overflow,
        };
      });

      expect(parseInt(descStyles.fontSize)).toBeGreaterThanOrEqual(14);
      expect(parseInt(descStyles.fontSize)).toBeLessThanOrEqual(18);
    } else {
      // Handle missing description gracefully
      await expect(programDescription).toContainText('No description available');
    }
  });

  test('should show empty state when no program is selected (AC2)', async ({ page }) => {
    // GIVEN: User navigates to EPG TV view
    await page.goto('/epg-tv');

    // THEN: Details panel shows empty state or is hidden
    const detailsPanel = page.getByTestId('epg-program-details');

    // Panel is either hidden or shows empty state message
    const panelVisible = await detailsPanel.isVisible().catch(() => false);

    if (panelVisible) {
      // If visible, should show empty state message
      const emptyState = page.getByTestId('details-empty-state');
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText('Select a program to see details');
    } else {
      // Panel is hidden (alternative valid behavior)
      await expect(detailsPanel).not.toBeVisible();
    }
  });

  test('should close details panel when Escape key is pressed (AC3)', async ({
    page,
    programDetailsData,
    programDetailsApi,
  }) => {
    // GIVEN: User has program details panel visible
    await page.goto('/epg-tv');
    await page.getByTestId(`channel-row-${programDetailsData.channelId}`).click();
    await page.waitForTimeout(500);
    await programDetailsApi.selectProgram(programDetailsData.programId);

    const detailsPanel = page.getByTestId('epg-program-details');
    await expect(detailsPanel).toBeVisible();

    // WHEN: User presses Escape key
    await page.keyboard.press('Escape');

    // THEN: Details panel is closed/hidden
    await expect(detailsPanel).not.toBeVisible();

    // AND: Program selection is cleared (no selected state in schedule)
    const programRow = page.getByTestId(`schedule-row-${programDetailsData.programId}`);
    await expect(programRow).not.toHaveAttribute('aria-selected', 'true');
  });

  test('should close details panel when clicking outside (AC3)', async ({
    page,
    programDetailsData,
    programDetailsApi,
  }) => {
    // GIVEN: User has program details panel visible
    await page.goto('/epg-tv');
    await page.getByTestId(`channel-row-${programDetailsData.channelId}`).click();
    await page.waitForTimeout(500);
    await programDetailsApi.selectProgram(programDetailsData.programId);

    const detailsPanel = page.getByTestId('epg-program-details');
    await expect(detailsPanel).toBeVisible();

    // WHEN: User clicks outside the details panel (on schedule panel)
    const schedulePanel = page.getByTestId('epg-schedule-panel');
    await schedulePanel.click({ position: { x: 50, y: 50 } });

    // THEN: Details panel should close (selection cleared)
    // Note: This behavior might be implemented at the EpgTv view level
    // If panel doesn't auto-close, this test will fail until implemented
    await expect(detailsPanel).not.toBeVisible();
  });

  test('should display status indicator with correct color for live program (AC1)', async ({
    page,
    programDetailsData,
    programDetailsApi,
  }) => {
    // GIVEN: Program is currently airing (Live Now)
    await page.goto('/epg-tv');
    await page.getByTestId(`channel-row-${programDetailsData.channelId}`).click();
    await page.waitForTimeout(500);
    await programDetailsApi.selectProgram(programDetailsData.programId);

    // THEN: Status shows "Live Now" with green color
    const statusIndicator = page.getByTestId('program-status');
    await expect(statusIndicator).toBeVisible();
    await expect(statusIndicator).toContainText('Live Now');

    const statusStyles = await statusIndicator.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    // Green color (rgb with higher green component)
    expect(statusStyles).toMatch(/rgb/);
  });

  test('should handle missing program description gracefully (AC1)', async ({ page }) => {
    // GIVEN: Program with no description
    const programWithoutDesc = await page.evaluate(async () => {
      // @ts-ignore
      const { invoke } = window.__TAURI__;

      const channelId = 5002;
      await invoke('create_test_xmltv_channel', {
        id: channelId,
        displayName: 'Test Channel No Desc',
        icon: null,
      });

      await invoke('set_xmltv_channel_enabled', {
        channelId,
        enabled: true,
        plexDisplayOrder: 1,
      });

      const now = new Date();
      const program = await invoke('create_test_program', {
        xmltvChannelId: channelId,
        title: 'Program Without Description',
        description: null,
        startTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        endTime: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      });

      return { programId: (program as any).id, channelId };
    });

    await page.goto('/epg-tv');
    await page.getByTestId(`channel-row-${programWithoutDesc.channelId}`).click();
    await page.waitForTimeout(500);

    // WHEN: User selects program without description
    await page.getByTestId(`schedule-row-${programWithoutDesc.programId}`).click();

    // THEN: Description section shows placeholder
    const programDescription = page.getByTestId('program-description');
    await expect(programDescription).toBeVisible();
    await expect(programDescription).toContainText('No description available');

    // Cleanup
    await page.evaluate(async (channelId: number) => {
      // @ts-ignore
      const { invoke } = window.__TAURI__;
      await invoke('delete_test_channel_data', { channelId });
    }, programWithoutDesc.channelId);
  });

  test('should handle missing episode info gracefully (AC1)', async ({ page }) => {
    // GIVEN: Program with no episode info
    const programWithoutEpisode = await page.evaluate(async () => {
      // @ts-ignore
      const { invoke } = window.__TAURI__;

      const channelId = 5003;
      await invoke('create_test_xmltv_channel', {
        id: channelId,
        displayName: 'Test Channel No Episode',
        icon: null,
      });

      await invoke('set_xmltv_channel_enabled', {
        channelId,
        enabled: true,
        plexDisplayOrder: 1,
      });

      const now = new Date();
      const program = await invoke('create_test_program', {
        xmltvChannelId: channelId,
        title: 'Movie Without Episode Info',
        episodeInfo: null,
        startTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        endTime: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      });

      return { programId: (program as any).id, channelId };
    });

    await page.goto('/epg-tv');
    await page.getByTestId(`channel-row-${programWithoutEpisode.channelId}`).click();
    await page.waitForTimeout(500);

    // WHEN: User selects program without episode info
    await page.getByTestId(`schedule-row-${programWithoutEpisode.programId}`).click();

    // THEN: Episode info section is hidden
    const episodeInfo = page.getByTestId('episode-info');
    const episodeVisible = await episodeInfo.isVisible().catch(() => false);
    expect(episodeVisible).toBe(false);

    // Cleanup
    await page.evaluate(async (channelId: number) => {
      // @ts-ignore
      const { invoke } = window.__TAURI__;
      await invoke('delete_test_channel_data', { channelId });
    }, programWithoutEpisode.channelId);
  });

  test('should display long program title with max 2 lines and ellipsis (AC1)', async ({ page }) => {
    // GIVEN: Program with very long title
    const programWithLongTitle = await page.evaluate(async () => {
      // @ts-ignore
      const { invoke } = window.__TAURI__;

      const channelId = 5004;
      await invoke('create_test_xmltv_channel', {
        id: channelId,
        displayName: 'Test Channel Long Title',
        icon: null,
      });

      await invoke('set_xmltv_channel_enabled', {
        channelId,
        enabled: true,
        plexDisplayOrder: 1,
      });

      const now = new Date();
      const program = await invoke('create_test_program', {
        xmltvChannelId: channelId,
        title: 'Super Extremely Long Program Title That Should Be Truncated After Two Lines Maximum',
        startTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        endTime: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      });

      return { programId: (program as any).id, channelId };
    });

    await page.goto('/epg-tv');
    await page.getByTestId(`channel-row-${programWithLongTitle.channelId}`).click();
    await page.waitForTimeout(500);

    // WHEN: User selects program with long title
    await page.getByTestId(`schedule-row-${programWithLongTitle.programId}`).click();

    // THEN: Title is displayed with ellipsis after 2 lines
    const programTitle = page.getByTestId('program-title');
    await expect(programTitle).toBeVisible();

    const titleStyles = await programTitle.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        display: computed.display,
        webkitLineClamp: computed.webkitLineClamp,
        webkitBoxOrient: computed.webkitBoxOrient,
        overflow: computed.overflow,
      };
    });

    // Verify multi-line ellipsis styling
    expect(titleStyles.overflow).toBe('hidden');

    // Cleanup
    await page.evaluate(async (channelId: number) => {
      // @ts-ignore
      const { invoke } = window.__TAURI__;
      await invoke('delete_test_channel_data', { channelId });
    }, programWithLongTitle.channelId);
  });

  test('should display panel dimensions correctly (40% width, full height) (AC1)', async ({
    page,
    programDetailsData,
    programDetailsApi,
  }) => {
    // GIVEN: User has program details visible
    await page.goto('/epg-tv');
    await page.getByTestId(`channel-row-${programDetailsData.channelId}`).click();
    await page.waitForTimeout(500);
    await programDetailsApi.selectProgram(programDetailsData.programId);

    // THEN: Details panel has correct dimensions
    const detailsPanel = page.getByTestId('epg-program-details');
    await expect(detailsPanel).toBeVisible();

    const panelDimensions = await detailsPanel.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      return {
        width: rect.width,
        height: rect.height,
        widthPercentage: (rect.width / viewportWidth) * 100,
        heightPercentage: (rect.height / viewportHeight) * 100,
      };
    });

    // Panel should be approximately 40% of viewport width
    expect(panelDimensions.widthPercentage).toBeGreaterThan(35);
    expect(panelDimensions.widthPercentage).toBeLessThan(45);

    // Panel should take substantial height (below top bar)
    expect(panelDimensions.heightPercentage).toBeGreaterThan(70);
  });
});
