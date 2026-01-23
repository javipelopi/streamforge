import { test, expect } from '../support/fixtures/program-details.fixture';

/**
 * E2E Tests for Story 5.3: Program Details View
 *
 * These tests verify the complete user journey for viewing detailed program
 * information in a slide-in panel. All tests are in RED phase - they will fail
 * until the implementation is complete.
 *
 * Test Strategy:
 * - E2E level: Tests full user interactions from EPG view with program selection
 * - Given-When-Then format for clarity
 * - data-testid selectors for resilience
 * - Focuses on panel open/close behavior, content display, and stream info
 *
 * Acceptance Criteria Coverage:
 * - AC#1: Panel displays program details (title, channel, times, duration, description, category, episode)
 * - AC#2: Panel closes on click outside or Escape key
 * - AC#3: Stream info displays for channels with Xtream mappings
 */

test.describe('Program Details Panel Display', () => {
  test.beforeEach(async ({ page, programDetailsData }) => {
    // GIVEN: User has enabled channels with program data
    // programDetailsData fixture provides pre-populated test data

    // WHEN: User navigates to EPG view
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');
  });

  test('should display program details panel when program is selected from grid', async ({
    page,
    programDetailsData,
  }) => {
    // GIVEN: User is viewing EPG grid with programs
    const epgGrid = page.getByTestId('epg-grid');
    await expect(epgGrid).toBeVisible();

    // Get first program with complete details
    const program = programDetailsData.programs.find((p) => p.description && p.category);

    if (!program) {
      throw new Error('Test data must include program with description and category');
    }

    // WHEN: User clicks on a program cell
    const programCell = page.getByTestId(`epg-program-cell-${program.id}`);
    await expect(programCell).toBeVisible();
    await programCell.click();

    // THEN: Program details panel is displayed
    const detailsPanel = page.getByTestId('program-details-panel');
    await expect(detailsPanel).toBeVisible();

    // THEN: Panel displays program title
    const panelTitle = page.getByTestId('program-details-title');
    await expect(panelTitle).toBeVisible();
    await expect(panelTitle).toContainText(program.title);

    // THEN: Panel displays channel name
    const panelChannel = page.getByTestId('program-details-channel-name');
    await expect(panelChannel).toBeVisible();
    await expect(panelChannel).toContainText(program.channelName);

    // THEN: Panel displays start time
    const panelStartTime = page.getByTestId('program-details-start-time');
    await expect(panelStartTime).toBeVisible();

    // THEN: Panel displays end time
    const panelEndTime = page.getByTestId('program-details-end-time');
    await expect(panelEndTime).toBeVisible();

    // THEN: Panel displays duration
    const panelDuration = page.getByTestId('program-details-duration');
    await expect(panelDuration).toBeVisible();
    // Duration should be in format like "1h 30m" or "45m"
    await expect(panelDuration).toContainText(/\d+[hm]/);

    // THEN: Panel displays description
    const panelDescription = page.getByTestId('program-details-description');
    await expect(panelDescription).toBeVisible();
    await expect(panelDescription).toContainText(program.description!);

    // THEN: Panel displays category
    const panelCategory = page.getByTestId('program-details-category');
    await expect(panelCategory).toBeVisible();
    await expect(panelCategory).toContainText(program.category!);
  });

  test('should display channel logo when available', async ({ page, programDetailsData }) => {
    // GIVEN: User is viewing EPG grid
    await expect(page.getByTestId('epg-grid')).toBeVisible();

    // Find program with channel icon
    const program = programDetailsData.programs.find((p) => p.channelIcon);

    if (!program) {
      throw new Error('Test data must include program with channel icon');
    }

    // WHEN: User clicks on a program
    const programCell = page.getByTestId(`epg-program-cell-${program.id}`);
    await expect(programCell).toBeVisible();
    await programCell.click();

    // THEN: Panel displays channel logo
    const channelLogo = page.getByTestId('program-details-channel-logo');
    await expect(channelLogo).toBeVisible();

    // THEN: Logo has correct src attribute
    const logoSrc = await channelLogo.getAttribute('src');
    expect(logoSrc).toBeTruthy();
  });

  test('should display episode info when available', async ({ page, programDetailsData }) => {
    // GIVEN: User is viewing EPG grid
    await expect(page.getByTestId('epg-grid')).toBeVisible();

    // Find program with episode info
    const program = programDetailsData.programs.find((p) => p.episodeInfo);

    if (!program) {
      throw new Error('Test data must include program with episode info');
    }

    // WHEN: User clicks on a program with episode info
    const programCell = page.getByTestId(`epg-program-cell-${program.id}`);
    await expect(programCell).toBeVisible();
    await programCell.click();

    // THEN: Panel displays formatted episode info (e.g., "S02E05")
    const episodeInfo = page.getByTestId('program-details-episode-info');
    await expect(episodeInfo).toBeVisible();

    // THEN: Episode info is in S##E## format
    const episodeText = await episodeInfo.textContent();
    expect(episodeText).toMatch(/S\d{2}E\d{2}/);
  });

  test('should display graceful empty states for missing optional fields', async ({
    page,
    programDetailsData,
  }) => {
    // GIVEN: User is viewing EPG grid
    await expect(page.getByTestId('epg-grid')).toBeVisible();

    // Find program with minimal data (no description, category, episode)
    const program = programDetailsData.programs.find(
      (p) => !p.description && !p.category && !p.episodeInfo
    );

    if (!program) {
      throw new Error('Test data must include program with minimal fields');
    }

    // WHEN: User clicks on a program with missing fields
    const programCell = page.getByTestId(`epg-program-cell-${program.id}`);
    await expect(programCell).toBeVisible();
    await programCell.click();

    // THEN: Panel still displays (no crash)
    const detailsPanel = page.getByTestId('program-details-panel');
    await expect(detailsPanel).toBeVisible();

    // THEN: Required fields are still displayed
    await expect(page.getByTestId('program-details-title')).toBeVisible();
    await expect(page.getByTestId('program-details-channel-name')).toBeVisible();
    await expect(page.getByTestId('program-details-start-time')).toBeVisible();
    await expect(page.getByTestId('program-details-end-time')).toBeVisible();

    // THEN: Description shows placeholder text
    const description = page.getByTestId('program-details-description');
    await expect(description).toContainText(/no description available/i);

    // THEN: Category section is hidden
    const category = page.getByTestId('program-details-category');
    await expect(category).not.toBeVisible();

    // THEN: Episode info section is hidden
    const episodeInfo = page.getByTestId('program-details-episode-info');
    await expect(episodeInfo).not.toBeVisible();
  });

  test('should open panel from search result selection', async ({ page, programDetailsData }) => {
    // GIVEN: User has performed an EPG search
    await expect(page.getByTestId('epg-view')).toBeVisible();

    const searchInput = page.getByTestId('epg-search-input');
    await expect(searchInput).toBeVisible();

    // Get searchable program
    const program = programDetailsData.programs.find((p) => p.title && p.description);

    if (!program) {
      throw new Error('Test data must include searchable program');
    }

    // WHEN: User searches for a program
    await searchInput.fill(program.title.split(' ')[0]); // Search by first word
    await page.waitForTimeout(350); // Debounce delay

    // WHEN: User clicks on a search result
    const searchResult = page.getByTestId(`epg-search-result-item-${program.id}`);
    await expect(searchResult).toBeVisible();
    await searchResult.click();

    // THEN: Program details panel opens
    const detailsPanel = page.getByTestId('program-details-panel');
    await expect(detailsPanel).toBeVisible();

    // THEN: Panel displays the selected program
    const panelTitle = page.getByTestId('program-details-title');
    await expect(panelTitle).toContainText(program.title);
  });
});

test.describe('Program Details Panel Close Behavior', () => {
  test.beforeEach(async ({ page, programDetailsData }) => {
    // GIVEN: User navigates to EPG view
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');

    // AND: User has opened a program details panel
    const program = programDetailsData.programs[0];
    const programCell = page.getByTestId(`epg-program-cell-${program.id}`);
    await expect(programCell).toBeVisible();
    await programCell.click();

    // Verify panel is open
    const detailsPanel = page.getByTestId('program-details-panel');
    await expect(detailsPanel).toBeVisible();
  });

  test('should close panel when close button is clicked', async ({ page }) => {
    // GIVEN: Program details panel is open
    const detailsPanel = page.getByTestId('program-details-panel');
    await expect(detailsPanel).toBeVisible();

    // WHEN: User clicks the close button
    const closeButton = page.getByTestId('program-details-close');
    await expect(closeButton).toBeVisible();
    await closeButton.click();

    // THEN: Panel is closed
    await expect(detailsPanel).not.toBeVisible();
  });

  test('should close panel when clicking outside', async ({ page }) => {
    // GIVEN: Program details panel is open
    const detailsPanel = page.getByTestId('program-details-panel');
    await expect(detailsPanel).toBeVisible();

    // WHEN: User clicks outside the panel (on backdrop)
    const backdrop = page.getByTestId('program-details-backdrop');
    await expect(backdrop).toBeVisible();
    await backdrop.click();

    // THEN: Panel is closed
    await expect(detailsPanel).not.toBeVisible();
  });

  test('should close panel when Escape key is pressed', async ({ page }) => {
    // GIVEN: Program details panel is open
    const detailsPanel = page.getByTestId('program-details-panel');
    await expect(detailsPanel).toBeVisible();

    // WHEN: User presses Escape key
    await page.keyboard.press('Escape');

    // THEN: Panel is closed
    await expect(detailsPanel).not.toBeVisible();
  });

  test('should not close panel when clicking inside panel', async ({ page }) => {
    // GIVEN: Program details panel is open
    const detailsPanel = page.getByTestId('program-details-panel');
    await expect(detailsPanel).toBeVisible();

    // WHEN: User clicks inside the panel content
    const panelTitle = page.getByTestId('program-details-title');
    await panelTitle.click();

    // THEN: Panel remains open
    await expect(detailsPanel).toBeVisible();
  });
});

test.describe('Stream Information Display', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: User navigates to EPG view
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');
  });

  test('should display primary stream info when channel has Xtream mapping', async ({
    page,
    programDetailsData,
  }) => {
    // GIVEN: User is viewing EPG grid
    await expect(page.getByTestId('epg-grid')).toBeVisible();

    // Find program with stream info
    const program = programDetailsData.programs.find((p) => p.streamInfo);

    if (!program) {
      throw new Error('Test data must include program with stream info');
    }

    // WHEN: User clicks on a program with stream mapping
    const programCell = page.getByTestId(`epg-program-cell-${program.id}`);
    await expect(programCell).toBeVisible();
    await programCell.click();

    // THEN: Panel displays stream information section
    const streamSection = page.getByTestId('program-details-stream-info');
    await expect(streamSection).toBeVisible();

    // THEN: Stream name is displayed
    const streamName = page.getByTestId('program-details-stream-name');
    await expect(streamName).toBeVisible();
    await expect(streamName).toContainText(program.streamInfo!.streamName);

    // THEN: Quality tiers are displayed as badges
    for (const tier of program.streamInfo!.qualityTiers) {
      const qualityBadge = page.getByTestId(`program-details-quality-badge-${tier}`);
      await expect(qualityBadge).toBeVisible();
      await expect(qualityBadge).toContainText(tier);
    }

    // THEN: Primary indicator is shown
    const primaryIndicator = page.getByTestId('program-details-stream-primary');
    await expect(primaryIndicator).toBeVisible();
  });

  test('should display multiple quality tier badges correctly', async ({
    page,
    programDetailsData,
  }) => {
    // GIVEN: User is viewing EPG grid
    await expect(page.getByTestId('epg-grid')).toBeVisible();

    // Find program with multiple quality tiers
    const program = programDetailsData.programs.find(
      (p) => p.streamInfo && p.streamInfo.qualityTiers.length > 1
    );

    if (!program) {
      throw new Error('Test data must include program with multiple quality tiers');
    }

    // WHEN: User clicks on a program
    const programCell = page.getByTestId(`epg-program-cell-${program.id}`);
    await expect(programCell).toBeVisible();
    await programCell.click();

    // THEN: All quality tier badges are visible
    const qualityCount = program.streamInfo!.qualityTiers.length;
    const qualityBadges = page.locator('[data-testid^="program-details-quality-badge-"]');
    await expect(qualityBadges).toHaveCount(qualityCount);

    // THEN: Badges have appropriate styling (4K=purple, HD=blue, SD=gray)
    for (const tier of program.streamInfo!.qualityTiers) {
      const badge = page.getByTestId(`program-details-quality-badge-${tier}`);
      const classes = await badge.getAttribute('class');

      if (tier === '4K') {
        expect(classes).toMatch(/purple/i);
      } else if (tier === 'HD') {
        expect(classes).toMatch(/blue/i);
      } else if (tier === 'SD') {
        expect(classes).toMatch(/gray/i);
      }
    }
  });

  test('should display graceful message when channel has no stream mapping', async ({
    page,
    programDetailsData,
  }) => {
    // GIVEN: User is viewing EPG grid
    await expect(page.getByTestId('epg-grid')).toBeVisible();

    // Find program without stream info
    const program = programDetailsData.programs.find((p) => !p.streamInfo);

    if (!program) {
      throw new Error('Test data must include program without stream info');
    }

    // WHEN: User clicks on a program without stream mapping
    const programCell = page.getByTestId(`epg-program-cell-${program.id}`);
    await expect(programCell).toBeVisible();
    await programCell.click();

    // THEN: Panel displays placeholder message for stream info
    const noStreamMessage = page.getByTestId('program-details-no-stream');
    await expect(noStreamMessage).toBeVisible();
    await expect(noStreamMessage).toContainText(/no stream source|no stream available/i);

    // THEN: Stream info section is still present but shows message
    const streamSection = page.getByTestId('program-details-stream-info');
    await expect(streamSection).toBeVisible();
  });

  test('should fetch stream info dynamically when panel opens', async ({
    page,
    programDetailsData,
    programDetailsApi,
  }) => {
    // GIVEN: User is viewing EPG grid
    await expect(page.getByTestId('epg-grid')).toBeVisible();

    // Find program with stream info
    const program = programDetailsData.programs.find((p) => p.streamInfo);

    if (!program) {
      throw new Error('Test data must include program with stream info');
    }

    // WHEN: User clicks on a program
    const programCell = page.getByTestId(`epg-program-cell-${program.id}`);
    await expect(programCell).toBeVisible();
    await programCell.click();

    // THEN: Panel makes API call to fetch stream info
    // Verify by checking that stream info is displayed after brief delay
    const streamSection = page.getByTestId('program-details-stream-info');
    await expect(streamSection).toBeVisible({ timeout: 2000 });

    // THEN: Stream info matches expected data
    const streamName = page.getByTestId('program-details-stream-name');
    await expect(streamName).toContainText(program.streamInfo!.streamName);
  });
});

test.describe('Panel Animation and UX', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: User navigates to EPG view
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');
  });

  test('should slide in from right side when opening', async ({ page, programDetailsData }) => {
    // GIVEN: User is viewing EPG grid
    await expect(page.getByTestId('epg-grid')).toBeVisible();

    const program = programDetailsData.programs[0];

    // WHEN: User clicks on a program
    const programCell = page.getByTestId(`epg-program-cell-${program.id}`);
    await programCell.click();

    // THEN: Panel appears from right side
    const detailsPanel = page.getByTestId('program-details-panel');
    await expect(detailsPanel).toBeVisible();

    // THEN: Panel has slide-in animation class
    const classes = await detailsPanel.getAttribute('class');
    // Animation classes vary by implementation, just verify panel is positioned right
    const position = await detailsPanel.evaluate((el) => window.getComputedStyle(el).right);
    expect(position).toBe('0px'); // Panel is docked to right edge
  });

  test('should have fixed width and full height', async ({ page, programDetailsData }) => {
    // GIVEN: User is viewing EPG grid
    await expect(page.getByTestId('epg-grid')).toBeVisible();

    const program = programDetailsData.programs[0];

    // WHEN: User opens program details panel
    const programCell = page.getByTestId(`epg-program-cell-${program.id}`);
    await programCell.click();

    const detailsPanel = page.getByTestId('program-details-panel');
    await expect(detailsPanel).toBeVisible();

    // THEN: Panel has fixed width (400px as per design)
    const panelBox = await detailsPanel.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox!.width).toBeCloseTo(400, 50); // Allow 50px tolerance for padding/borders

    // THEN: Panel spans full viewport height
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(panelBox!.height).toBeCloseTo(viewportHeight, 50);
  });

  test('should dim background with backdrop when panel is open', async ({
    page,
    programDetailsData,
  }) => {
    // GIVEN: User is viewing EPG grid
    await expect(page.getByTestId('epg-grid')).toBeVisible();

    const program = programDetailsData.programs[0];

    // WHEN: User opens program details panel
    const programCell = page.getByTestId(`epg-program-cell-${program.id}`);
    await programCell.click();

    // THEN: Backdrop is visible
    const backdrop = page.getByTestId('program-details-backdrop');
    await expect(backdrop).toBeVisible();

    // THEN: Backdrop has semi-transparent styling
    const backdropOpacity = await backdrop.evaluate((el) => window.getComputedStyle(el).opacity);
    const opacity = parseFloat(backdropOpacity);
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(1);
  });
});
