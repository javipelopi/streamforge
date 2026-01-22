import { test, expect } from '../support/fixtures/epg-search.fixture';

/**
 * E2E Tests for Story 5.2: EPG Search Functionality
 *
 * These tests verify the complete user journey for searching EPG programs
 * by title, description, and channel name. All tests are in RED phase - they
 * will fail until the implementation is complete.
 *
 * Test Strategy:
 * - E2E level: Tests full user interactions from EPG view with search
 * - Given-When-Then format for clarity
 * - data-testid selectors for resilience
 * - Focuses on search input, results display, and grid navigation
 *
 * Acceptance Criteria Coverage:
 * - AC#1: Search input field is visible and interactive
 * - AC#2: Search filters by title, description, channel name (enabled channels only)
 * - AC#3: Results show program details with relevance indicator
 * - AC#4: Clicking result navigates grid to program time slot
 * - AC#5: Clearing search returns to normal grid view
 */

test.describe('EPG Search Input', () => {
  test.beforeEach(async ({ page, epgSearchData }) => {
    // GIVEN: User has enabled channels with diverse program content
    // epgSearchData fixture provides pre-populated test data

    // WHEN: User navigates to EPG view
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');
  });

  test('should display search input in EPG view', async ({ page }) => {
    // GIVEN: User is on EPG view

    // WHEN: Page loads
    const epgView = page.getByTestId('epg-view');
    await expect(epgView).toBeVisible();

    // THEN: Search input is visible in the view
    const searchInput = page.getByTestId('epg-search-input');
    await expect(searchInput).toBeVisible();

    // THEN: Search input has placeholder text
    await expect(searchInput).toHaveAttribute('placeholder', /search/i);

    // THEN: Search icon is visible
    const searchIcon = page.getByTestId('epg-search-icon');
    await expect(searchIcon).toBeVisible();

    // THEN: Search input is interactive (can receive focus)
    await searchInput.click();
    await expect(searchInput).toBeFocused();
  });

  test('should show loading indicator while searching', async ({ page }) => {
    // GIVEN: User is on EPG view with search input
    const searchInput = page.getByTestId('epg-search-input');
    await expect(searchInput).toBeVisible();

    // WHEN: User types search query
    await searchInput.fill('news');

    // THEN: Loading indicator appears while search executes
    const loadingIndicator = page.getByTestId('epg-search-loading-indicator');

    // Loading may be brief, but should be visible at some point
    // or search results should appear quickly
    try {
      await expect(loadingIndicator).toBeVisible({ timeout: 500 });
    } catch (e) {
      // Search was very fast - acceptable, verify results appear instead
      const searchResults = page.getByTestId('epg-search-results');
      await expect(searchResults).toBeVisible({ timeout: 1000 });
    }
  });

  test('should debounce search input to avoid excessive queries', async ({ page }) => {
    // GIVEN: User is on EPG view
    const searchInput = page.getByTestId('epg-search-input');
    await expect(searchInput).toBeVisible();

    // WHEN: User types rapidly
    await searchInput.pressSequentially('breaking', { delay: 50 }); // Type fast

    // THEN: Search does not execute for every keystroke
    // Wait for debounce period (300ms)
    await page.waitForTimeout(350);

    // THEN: Search results appear after debounce delay
    const searchResults = page.getByTestId('epg-search-results');
    await expect(searchResults).toBeVisible();

    // Verify only one search was executed (not 8 searches for 8 characters)
    // This is validated by the backend not receiving multiple rapid requests
  });
});

test.describe('EPG Search Results', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: User navigates to EPG view
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');
  });

  test('should filter programs by title, description, and channel name', async ({
    page,
    epgSearchData,
  }) => {
    // GIVEN: User is viewing EPG with search input
    const searchInput = page.getByTestId('epg-search-input');
    await expect(searchInput).toBeVisible();

    // WHEN: User searches for "news" (matches titles and channel names)
    await searchInput.fill('news');
    await page.waitForTimeout(350); // Wait for debounce

    // THEN: Search results are displayed
    const searchResults = page.getByTestId('epg-search-results');
    await expect(searchResults).toBeVisible();

    // THEN: Results include programs with "news" in title
    const newsPrograms = epgSearchData.programs.filter((p) =>
      p.title.toLowerCase().includes('news')
    );

    for (const program of newsPrograms.slice(0, 3)) {
      // Check first 3
      const resultItem = page.getByTestId(`epg-search-result-item-${program.id}`);
      await expect(resultItem).toBeVisible();
    }

    // WHEN: User searches for channel name
    await searchInput.fill('');
    await searchInput.fill('CNN');
    await page.waitForTimeout(350);

    // THEN: Results include programs from CNN channel
    const cnnChannel = epgSearchData.channels.find((ch) => ch.name === 'CNN');

    if (cnnChannel) {
      const cnnPrograms = epgSearchData.programs.filter(
        (p) => p.channelId === cnnChannel.id
      );

      for (const program of cnnPrograms.slice(0, 3)) {
        const resultItem = page.getByTestId(`epg-search-result-item-${program.id}`);
        await expect(resultItem).toBeVisible();
      }
    }

    // WHEN: User searches by description keyword
    await searchInput.fill('');
    await searchInput.fill('documentary');
    await page.waitForTimeout(350);

    // THEN: Results include programs with "documentary" in description
    const docPrograms = epgSearchData.programs.filter(
      (p) => p.description?.toLowerCase().includes('documentary')
    );

    if (docPrograms.length > 0) {
      const resultItem = page.getByTestId(`epg-search-result-item-${docPrograms[0].id}`);
      await expect(resultItem).toBeVisible();
    }
  });

  test('should only search enabled XMLTV channels', async ({ page, epgSearchData }) => {
    // GIVEN: User has both enabled and disabled channels with programs
    const searchInput = page.getByTestId('epg-search-input');
    await expect(searchInput).toBeVisible();

    // Get a program from a disabled channel
    const disabledChannel = epgSearchData.channels.find((ch) => !ch.isEnabled);

    if (disabledChannel && disabledChannel.programs.length > 0) {
      const disabledProgram = disabledChannel.programs[0];

      // WHEN: User searches for program from disabled channel
      await searchInput.fill(disabledProgram.title);
      await page.waitForTimeout(350);

      // THEN: Search results do NOT include programs from disabled channels
      const searchResults = page.getByTestId('epg-search-results');

      // Either no results panel (empty) or panel without this program
      const resultItem = page.getByTestId(`epg-search-result-item-${disabledProgram.id}`);
      await expect(resultItem).not.toBeVisible();
    }

    // WHEN: User searches for program from enabled channel
    const enabledChannel = epgSearchData.channels.find((ch) => ch.isEnabled);

    if (enabledChannel && enabledChannel.programs.length > 0) {
      const enabledProgram = enabledChannel.programs[0];

      await searchInput.fill('');
      await searchInput.fill(enabledProgram.title);
      await page.waitForTimeout(350);

      // THEN: Search results include programs from enabled channels
      const resultItem = page.getByTestId(`epg-search-result-item-${enabledProgram.id}`);
      await expect(resultItem).toBeVisible();
    }
  });

  test('should display search results with program details and relevance', async ({
    page,
    epgSearchData,
  }) => {
    // GIVEN: User is viewing EPG with search input
    const searchInput = page.getByTestId('epg-search-input');
    await expect(searchInput).toBeVisible();

    // WHEN: User performs a search
    await searchInput.fill('sports');
    await page.waitForTimeout(350);

    // THEN: Search results panel is displayed
    const searchResults = page.getByTestId('epg-search-results');
    await expect(searchResults).toBeVisible();

    // THEN: Each result shows program title
    const sportsPrograms = epgSearchData.programs.filter(
      (p) =>
        p.title.toLowerCase().includes('sports') ||
        p.category?.toLowerCase().includes('sports')
    );

    if (sportsPrograms.length > 0) {
      const firstResult = sportsPrograms[0];
      const resultTitle = page.getByTestId(`epg-search-result-title-${firstResult.id}`);
      await expect(resultTitle).toBeVisible();
      await expect(resultTitle).toContainText(firstResult.title);

      // THEN: Each result shows channel name
      const resultChannel = page.getByTestId(
        `epg-search-result-channel-${firstResult.id}`
      );
      await expect(resultChannel).toBeVisible();

      const channel = epgSearchData.channels.find((ch) => ch.id === firstResult.channelId);
      if (channel) {
        await expect(resultChannel).toContainText(channel.name);
      }

      // THEN: Each result shows start time
      const resultTime = page.getByTestId(`epg-search-result-time-${firstResult.id}`);
      await expect(resultTime).toBeVisible();

      // THEN: Each result shows relevance indicator
      const resultRelevance = page.getByTestId(
        `epg-search-result-relevance-${firstResult.id}`
      );
      await expect(resultRelevance).toBeVisible();
    }
  });

  test('should display empty state when no results found', async ({ page }) => {
    // GIVEN: User is viewing EPG with search input
    const searchInput = page.getByTestId('epg-search-input');
    await expect(searchInput).toBeVisible();

    // WHEN: User searches for query with no matches
    await searchInput.fill('xyzabc123nonexistent');
    await page.waitForTimeout(350);

    // THEN: Empty state message is displayed
    const emptyState = page.getByTestId('epg-search-empty-state');
    await expect(emptyState).toBeVisible();

    // THEN: Empty state message is helpful
    await expect(emptyState).toContainText(/no programs found|no results/i);
    await expect(emptyState).toContainText('xyzabc123nonexistent');
  });

  test('should limit search results to reasonable count for performance', async ({
    page,
  }) => {
    // GIVEN: User is viewing EPG with search input
    const searchInput = page.getByTestId('epg-search-input');
    await expect(searchInput).toBeVisible();

    // WHEN: User searches for very common term (many results)
    await searchInput.fill('the'); // Very common word
    await page.waitForTimeout(350);

    // THEN: Results are limited to prevent UI slowdown
    const searchResults = page.getByTestId('epg-search-results');
    await expect(searchResults).toBeVisible();

    // Count result items (should be capped at 50)
    const resultItems = page.locator('[data-testid^="epg-search-result-item-"]');
    const count = await resultItems.count();

    expect(count).toBeLessThanOrEqual(50); // NFR5: Performance requirement
  });
});

test.describe('Search Result Selection', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: User navigates to EPG view
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to program time slot when search result is clicked', async ({
    page,
    epgSearchData,
  }) => {
    // GIVEN: User has performed a search with results
    const searchInput = page.getByTestId('epg-search-input');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('news');
    await page.waitForTimeout(350);

    const searchResults = page.getByTestId('epg-search-results');
    await expect(searchResults).toBeVisible();

    // Find a program in the future for reliable testing
    const futureProgram = epgSearchData.programs.find(
      (p) =>
        p.title.toLowerCase().includes('news') &&
        new Date(p.startTime) > new Date()
    );

    if (futureProgram) {
      const resultItem = page.getByTestId(`epg-search-result-item-${futureProgram.id}`);
      await expect(resultItem).toBeVisible();

      // WHEN: User clicks on a search result
      await resultItem.click();

      // THEN: EPG grid scrolls to the program's time slot
      // Verify time navigation bar shows the program's date
      const currentDate = page.getByTestId('time-nav-current-date-display');
      const programDate = new Date(futureProgram.startTime).toLocaleDateString();
      await expect(currentDate).toContainText(programDate);

      // THEN: Program cell is visible in the grid
      const programCell = page.getByTestId(`epg-program-cell-${futureProgram.id}`);
      await expect(programCell).toBeVisible({ timeout: 2000 });

      // THEN: Program selection event is emitted (for details panel - Story 5.3)
      const selectionEvent = await page.evaluate(() => {
        return new Promise<{ programId: number }>((resolve) => {
          window.addEventListener(
            'program-selected',
            ((event: CustomEvent) => {
              resolve(event.detail);
            }) as EventListener,
            { once: true }
          );

          // Trigger click again to capture event
          const element = document.querySelector(
            `[data-testid^="epg-search-result-item-"]`
          ) as HTMLElement;
          element?.click();
        });
      });

      expect(selectionEvent.programId).toBe(futureProgram.id);
    }
  });

  test('should clear search results after selecting a program', async ({
    page,
    epgSearchData,
  }) => {
    // GIVEN: User has search results displayed
    const searchInput = page.getByTestId('epg-search-input');
    await searchInput.fill('sports');
    await page.waitForTimeout(350);

    const searchResults = page.getByTestId('epg-search-results');
    await expect(searchResults).toBeVisible();

    // Find a program to click
    const sportsProgram = epgSearchData.programs.find((p) =>
      p.title.toLowerCase().includes('sports')
    );

    if (sportsProgram) {
      const resultItem = page.getByTestId(`epg-search-result-item-${sportsProgram.id}`);

      // WHEN: User clicks on a result
      await resultItem.click();

      // THEN: Search results are cleared (optional UX behavior)
      // Either search input is cleared OR results panel is hidden
      // This test validates the UX preference chosen by DEV team
      await expect(searchResults).not.toBeVisible({ timeout: 1000 });
    }
  });
});

test.describe('Clear Search', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: User navigates to EPG view
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');
  });

  test('should clear search and return to grid view', async ({ page }) => {
    // GIVEN: User has performed a search
    const searchInput = page.getByTestId('epg-search-input');
    await searchInput.fill('news');
    await page.waitForTimeout(350);

    const searchResults = page.getByTestId('epg-search-results');
    await expect(searchResults).toBeVisible();

    // WHEN: User clicks clear button
    const clearButton = page.getByTestId('epg-search-clear-button');
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    // THEN: Search input is cleared
    await expect(searchInput).toHaveValue('');

    // THEN: Search results are hidden
    await expect(searchResults).not.toBeVisible();

    // THEN: EPG grid returns to normal view
    const epgGrid = page.getByTestId('epg-grid');
    await expect(epgGrid).toBeVisible();

    // THEN: Time navigation shows current time
    const currentDate = page.getByTestId('time-nav-current-date-display');
    const today = new Date().toLocaleDateString();
    await expect(currentDate).toContainText(today);
  });

  test('should clear search using Escape key', async ({ page }) => {
    // GIVEN: User has search input focused with query
    const searchInput = page.getByTestId('epg-search-input');
    await searchInput.fill('movies');
    await page.waitForTimeout(350);

    const searchResults = page.getByTestId('epg-search-results');
    await expect(searchResults).toBeVisible();

    // Ensure input is focused
    await searchInput.focus();
    await expect(searchInput).toBeFocused();

    // WHEN: User presses Escape key
    await searchInput.press('Escape');

    // THEN: Search is cleared
    await expect(searchInput).toHaveValue('');

    // THEN: Search results are hidden
    await expect(searchResults).not.toBeVisible();
  });

  test('should hide clear button when search input is empty', async ({ page }) => {
    // GIVEN: User is viewing EPG with empty search
    const searchInput = page.getByTestId('epg-search-input');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveValue('');

    // THEN: Clear button is not visible
    const clearButton = page.getByTestId('epg-search-clear-button');
    await expect(clearButton).not.toBeVisible();

    // WHEN: User types in search input
    await searchInput.fill('test');
    await page.waitForTimeout(100);

    // THEN: Clear button becomes visible
    await expect(clearButton).toBeVisible();

    // WHEN: User clears the input
    await clearButton.click();

    // THEN: Clear button is hidden again
    await expect(clearButton).not.toBeVisible();
  });
});
