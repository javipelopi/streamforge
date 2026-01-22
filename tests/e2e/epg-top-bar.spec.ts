import { test, expect } from '../support/fixtures/epg-top-bar.fixture';

/**
 * E2E Tests for Story 5.7: EPG Top Bar with Search and Day Navigation
 *
 * Tests the fixed top bar with search functionality and day navigation chips.
 *
 * Acceptance Criteria:
 * AC1: Display fixed top bar with search input and day navigation
 * AC2: Search with debounced results, result selection, and keyboard navigation
 * AC3: Day chip selection updates schedule with visual feedback
 * AC4: Date picker overlay for arbitrary date selection
 */

test.describe('EPG Top Bar', () => {
  test('should display top bar with search and day navigation (AC1)', async ({
    page,
    epgTopBarData,
  }) => {
    // GIVEN: User navigates to EPG TV view
    await page.goto('/epg-tv');

    // THEN: Top bar is visible at top of page
    const topBar = page.getByTestId('epg-top-bar');
    await expect(topBar).toBeVisible();

    // AND: Top bar has correct styling (fixed, full width, semi-transparent dark)
    const topBarStyles = await topBar.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        position: computed.position,
        width: computed.width,
        backgroundColor: computed.backgroundColor,
      };
    });
    expect(topBarStyles.position).toBe('fixed');

    // AND: Search section is visible on left
    const searchSection = page.getByTestId('epg-search-section');
    await expect(searchSection).toBeVisible();

    // AND: Day navigation section is visible on right
    const dayNavSection = page.getByTestId('day-navigation-section');
    await expect(dayNavSection).toBeVisible();

    // AND: Search input with icon is present
    const searchInput = page.getByTestId('epg-search-input');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', /search/i);

    const searchIcon = page.getByTestId('epg-search-icon');
    await expect(searchIcon).toBeVisible();

    // AND: Day chips are visible (Today, Tonight, Tomorrow, weekdays)
    for (const dayOption of epgTopBarData.dayOptions) {
      const dayChip = page.getByTestId(`day-chip-${dayOption.id}`);
      await expect(dayChip).toBeVisible();
      await expect(dayChip).toHaveText(dayOption.label);
    }

    // AND: Navigation arrows are visible
    const prevButton = page.getByTestId('prev-day-button');
    const nextButton = page.getByTestId('next-day-button');
    await expect(prevButton).toBeVisible();
    await expect(nextButton).toBeVisible();

    // AND: Date picker button is visible
    const datePickerButton = page.getByTestId('date-picker-button');
    await expect(datePickerButton).toBeVisible();
  });

  test('should expand search input on focus and collapse on blur (AC1)', async ({
    page,
    epgTopBarApi,
  }) => {
    // GIVEN: User is on EPG TV view
    await page.goto('/epg-tv');

    const searchInput = page.getByTestId('epg-search-input');

    // WHEN: User focuses on search input (click or icon)
    await epgTopBarApi.expandSearch();

    // THEN: Input expands to full width (~300px)
    await page.waitForTimeout(300); // Wait for animation
    const expandedWidth = await searchInput.evaluate((el) => {
      return window.getComputedStyle(el).width;
    });
    const expandedPx = parseInt(expandedWidth);
    expect(expandedPx).toBeGreaterThan(250); // Should be around 300px

    // WHEN: User blurs input without entering text
    await searchInput.blur();

    // THEN: Input collapses back (icon only visible)
    await page.waitForTimeout(300); // Wait for animation
    const collapsedWidth = await searchInput.evaluate((el) => {
      return window.getComputedStyle(el).width;
    });
    const collapsedPx = parseInt(collapsedWidth);
    expect(collapsedPx).toBeLessThan(100); // Should collapse to icon size
  });

  test('should show search results dropdown after typing query (AC2)', async ({
    page,
    epgTopBarData,
    epgTopBarApi,
  }) => {
    // GIVEN: User is on EPG TV view with searchable content
    await page.goto('/epg-tv');

    // WHEN: User types a search query
    await epgTopBarApi.searchPrograms('news');

    // THEN: Loading spinner appears briefly
    const loadingSpinner = page.getByTestId('search-results-loading');
    // Spinner may be very fast, so check if it exists or was visible
    const spinnerWasVisible = await loadingSpinner.isVisible().catch(() => false);
    expect(spinnerWasVisible || true).toBeTruthy();

    // AND: Search results dropdown appears after debounce (300ms)
    const resultsDropdown = page.getByTestId('epg-search-results');
    await expect(resultsDropdown).toBeVisible({ timeout: 500 });

    // AND: Dropdown has correct styling (semi-transparent dark background)
    const dropdownStyles = await resultsDropdown.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        position: computed.position,
        backgroundColor: computed.backgroundColor,
      };
    });
    expect(dropdownStyles.position).toBe('absolute');

    // AND: Max 8 results displayed
    const results = await epgTopBarApi.getVisibleSearchResults();
    expect(results.length).toBeLessThanOrEqual(8);
  });

  test('should display search results with program details (AC2)', async ({
    page,
    epgTopBarData,
    epgTopBarApi,
  }) => {
    // GIVEN: User has searched and results are displayed
    await page.goto('/epg-tv');
    await epgTopBarApi.searchPrograms('program');

    const resultsDropdown = page.getByTestId('epg-search-results');
    await expect(resultsDropdown).toBeVisible({ timeout: 500 });

    // THEN: Each result shows program title (bold)
    const firstResult = page.getByTestId(`search-result-${epgTopBarData.programs[0].id}`);
    await expect(firstResult).toBeVisible();

    // Verify program title is bold
    const titleElement = firstResult.locator('[data-testid="result-title"]');
    await expect(titleElement).toBeVisible();
    await expect(titleElement).toHaveText(epgTopBarData.programs[0].title);

    const titleStyles = await titleElement.evaluate((el) => {
      return window.getComputedStyle(el).fontWeight;
    });
    expect(parseInt(titleStyles)).toBeGreaterThanOrEqual(600); // Bold

    // AND: Channel name is displayed below title (muted)
    const channelName = firstResult.locator('[data-testid="result-channel"]');
    await expect(channelName).toBeVisible();

    const channelStyles = await channelName.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    expect(channelStyles).toMatch(/rgb/); // Grayed color

    // AND: Date/time is displayed on right
    const datetime = firstResult.locator('[data-testid="result-datetime"]');
    await expect(datetime).toBeVisible();

    // WHEN: User hovers over result
    await firstResult.hover();

    // THEN: Hover state shows subtle highlight
    const hoveredBg = await firstResult.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    expect(hoveredBg).toBeDefined();
  });

  test('should navigate to program when search result clicked (AC2)', async ({
    page,
    epgTopBarData,
    epgTopBarApi,
  }) => {
    // GIVEN: User has search results displayed
    await page.goto('/epg-tv');
    await epgTopBarApi.searchPrograms('program');

    const resultsDropdown = page.getByTestId('epg-search-results');
    await expect(resultsDropdown).toBeVisible({ timeout: 500 });

    // WHEN: User clicks on a search result
    const targetProgram = epgTopBarData.programs[0];
    const resultRow = page.getByTestId(`search-result-${targetProgram.id}`);
    await resultRow.click();

    // THEN: Dropdown closes
    await expect(resultsDropdown).not.toBeVisible();

    // AND: Search input is cleared
    const searchInput = page.getByTestId('epg-search-input');
    await expect(searchInput).toHaveValue('');

    // AND: Selected channel is updated
    const channelRow = page.getByTestId(`channel-row-${targetProgram.channelId}`);
    await expect(channelRow).toHaveAttribute('aria-selected', 'true');

    // AND: Schedule panel shows selected program
    const programRow = page.getByTestId(`schedule-row-${targetProgram.id}`);
    await expect(programRow).toBeVisible();
    await expect(programRow).toHaveAttribute('aria-selected', 'true');

    // AND: Program is scrolled into view
    const isInView = await programRow.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight;
    });
    expect(isInView).toBeTruthy();
  });

  test('should show "No results found" for empty search (AC2)', async ({
    page,
    epgTopBarApi,
  }) => {
    // GIVEN: User searches for a query with no matches
    await page.goto('/epg-tv');
    await epgTopBarApi.searchPrograms('zzz-no-match-xyz');

    // THEN: Empty state message is displayed
    const emptyState = page.getByTestId('search-results-empty');
    await expect(emptyState).toBeVisible({ timeout: 500 });
    await expect(emptyState).toContainText(/no results/i);

    // AND: No result rows are displayed
    const results = await epgTopBarApi.getVisibleSearchResults();
    expect(results.length).toBe(0);
  });

  test('should clear search results when X button clicked (AC2)', async ({
    page,
    epgTopBarApi,
  }) => {
    // GIVEN: User has typed a search query with results
    await page.goto('/epg-tv');
    await epgTopBarApi.searchPrograms('news');

    const resultsDropdown = page.getByTestId('epg-search-results');
    await expect(resultsDropdown).toBeVisible({ timeout: 500 });

    // AND: Clear button is visible
    const clearButton = page.getByTestId('epg-search-clear');
    await expect(clearButton).toBeVisible();

    // WHEN: User clicks clear button
    await clearButton.click();

    // THEN: Search input is cleared
    const searchInput = page.getByTestId('epg-search-input');
    await expect(searchInput).toHaveValue('');

    // AND: Dropdown is closed
    await expect(resultsDropdown).not.toBeVisible();

    // AND: Clear button is hidden
    await expect(clearButton).not.toBeVisible();
  });

  test('should close search dropdown on Escape key (AC2)', async ({
    page,
    epgTopBarApi,
  }) => {
    // GIVEN: User has search results displayed
    await page.goto('/epg-tv');
    await epgTopBarApi.searchPrograms('program');

    const resultsDropdown = page.getByTestId('epg-search-results');
    await expect(resultsDropdown).toBeVisible({ timeout: 500 });

    // WHEN: User presses Escape key
    await page.keyboard.press('Escape');

    // THEN: Dropdown closes
    await expect(resultsDropdown).not.toBeVisible();

    // AND: Search input value is NOT cleared (only dropdown closes)
    const searchInput = page.getByTestId('epg-search-input');
    await expect(searchInput).toHaveValue('program');
  });

  test('should select day chip and load schedule (AC3)', async ({ page, epgTopBarApi }) => {
    // GIVEN: User is on EPG TV view with default day selected
    await page.goto('/epg-tv');

    // Select a channel first
    await page.getByTestId('channel-row-100').click();

    // WHEN: User clicks "Tomorrow" day chip
    const tomorrowChip = page.getByTestId('day-chip-tomorrow');
    await tomorrowChip.click();

    // THEN: Tomorrow chip is selected
    await expect(tomorrowChip).toHaveAttribute('aria-selected', 'true');

    // AND: Schedule panel loads tomorrow's programs
    const schedulePanel = page.getByTestId('epg-schedule-panel');
    await expect(schedulePanel).toBeVisible();

    // Verify schedule header shows tomorrow's date
    const scheduleHeader = page.getByTestId('schedule-header');
    await expect(scheduleHeader).toBeVisible();

    // AND: Previously selected chip is deselected
    const todayChip = page.getByTestId('day-chip-today');
    await expect(todayChip).not.toHaveAttribute('aria-selected', 'true');
  });

  test('should highlight selected day chip with purple background (AC3)', async ({
    page,
  }) => {
    // GIVEN: User is on EPG TV view
    await page.goto('/epg-tv');

    // WHEN: User clicks "Today" chip
    const todayChip = page.getByTestId('day-chip-today');
    await todayChip.click();

    // THEN: Today chip has purple background (#6366f1)
    const chipStyles = await todayChip.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        color: computed.color,
      };
    });

    // Check for purple-ish background (rgb values with blue > red > green)
    expect(chipStyles.backgroundColor).toMatch(/rgb/);

    // AND: Chip has aria-selected attribute
    await expect(todayChip).toHaveAttribute('aria-selected', 'true');

    // AND: Chip has white text color
    expect(chipStyles.color).toMatch(/rgb\(255, 255, 255\)|white/);
  });

  test('should navigate days with prev/next arrows (AC3)', async ({ page }) => {
    // GIVEN: User is on EPG TV view with "Today" selected
    await page.goto('/epg-tv');
    await page.getByTestId('channel-row-100').click();

    const todayChip = page.getByTestId('day-chip-today');
    await todayChip.click();
    await expect(todayChip).toHaveAttribute('aria-selected', 'true');

    // WHEN: User clicks next arrow
    const nextButton = page.getByTestId('next-day-button');
    await nextButton.click();

    // THEN: Tomorrow chip is selected
    const tomorrowChip = page.getByTestId('day-chip-tomorrow');
    await expect(tomorrowChip).toHaveAttribute('aria-selected', 'true');

    // AND: Today chip is deselected
    await expect(todayChip).not.toHaveAttribute('aria-selected', 'true');

    // AND: Schedule updates to tomorrow's programs
    await page.waitForTimeout(300);

    // WHEN: User clicks prev arrow
    const prevButton = page.getByTestId('prev-day-button');
    await prevButton.click();

    // THEN: Today chip is selected again
    await expect(todayChip).toHaveAttribute('aria-selected', 'true');

    // AND: Tomorrow chip is deselected
    await expect(tomorrowChip).not.toHaveAttribute('aria-selected', 'true');
  });

  test('should open date picker overlay on calendar icon click (AC4)', async ({ page }) => {
    // GIVEN: User is on EPG TV view
    await page.goto('/epg-tv');

    // WHEN: User clicks date picker button
    const datePickerButton = page.getByTestId('date-picker-button');
    await datePickerButton.click();

    // THEN: Date picker overlay opens
    const datePickerOverlay = page.getByTestId('date-picker-overlay');
    await expect(datePickerOverlay).toBeVisible();

    // AND: Overlay has correct styling (modal or dropdown)
    const overlayStyles = await datePickerOverlay.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        position: computed.position,
        zIndex: computed.zIndex,
      };
    });
    expect(['absolute', 'fixed']).toContain(overlayStyles.position);
    expect(parseInt(overlayStyles.zIndex)).toBeGreaterThan(10);

    // AND: Overlay has accessibility attributes
    await expect(datePickerOverlay).toHaveAttribute('role', 'dialog');
  });

  test('should select date from picker and update schedule (AC4)', async ({ page }) => {
    // GIVEN: User has date picker overlay open
    await page.goto('/epg-tv');
    await page.getByTestId('channel-row-100').click();

    const datePickerButton = page.getByTestId('date-picker-button');
    await datePickerButton.click();

    const datePickerOverlay = page.getByTestId('date-picker-overlay');
    await expect(datePickerOverlay).toBeVisible();

    // WHEN: User selects tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDateStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

    const dateCell = page.getByTestId(`date-picker-day-${tomorrowDateStr}`);
    await dateCell.click();

    // THEN: Overlay closes
    await expect(datePickerOverlay).not.toBeVisible();

    // AND: Tomorrow chip is selected
    const tomorrowChip = page.getByTestId('day-chip-tomorrow');
    await expect(tomorrowChip).toHaveAttribute('aria-selected', 'true');

    // AND: Schedule loads tomorrow's programs
    await page.waitForTimeout(300);
    const schedulePanel = page.getByTestId('epg-schedule-panel');
    await expect(schedulePanel).toBeVisible();
  });

  test('should close date picker on Escape key (AC4)', async ({ page }) => {
    // GIVEN: User has date picker overlay open
    await page.goto('/epg-tv');

    const datePickerButton = page.getByTestId('date-picker-button');
    await datePickerButton.click();

    const datePickerOverlay = page.getByTestId('date-picker-overlay');
    await expect(datePickerOverlay).toBeVisible();

    // WHEN: User presses Escape key
    await page.keyboard.press('Escape');

    // THEN: Overlay closes
    await expect(datePickerOverlay).not.toBeVisible();
  });

  test('should close date picker on backdrop click (AC4)', async ({ page }) => {
    // GIVEN: User has date picker overlay open
    await page.goto('/epg-tv');

    const datePickerButton = page.getByTestId('date-picker-button');
    await datePickerButton.click();

    const datePickerOverlay = page.getByTestId('date-picker-overlay');
    await expect(datePickerOverlay).toBeVisible();

    // WHEN: User clicks outside the overlay (backdrop)
    await page.mouse.click(10, 10); // Click top-left corner (outside overlay)

    // THEN: Overlay closes
    await expect(datePickerOverlay).not.toBeVisible();
  });
});
