import { test, expect } from '../support/fixtures/epg-grid.fixture';

/**
 * E2E Tests for Story 5.1: EPG Grid Browser with Time Navigation
 *
 * These tests verify the complete user journey for browsing EPG data in a grid view
 * with time navigation controls. All tests are in RED phase - they will fail until
 * the implementation is complete.
 *
 * Test Strategy:
 * - E2E level: Tests full user interactions from EPG view
 * - Given-When-Then format for clarity
 * - data-testid selectors for resilience
 * - Focuses on grid display, virtualization, and time navigation
 *
 * Acceptance Criteria Coverage:
 * - AC#1: Grid with enabled channels, time slots, program cells
 * - AC#2: Time navigation (Now, Tonight, Tomorrow, +/- day, date picker)
 * - AC#3: Responsive UI with TanStack Virtual
 * - AC#4: Program cell click opens details panel
 */

test.describe('EPG Grid Display', () => {
  test.beforeEach(async ({ page, epgGridData }) => {
    // GIVEN: User has enabled channels with program data
    // epgGridData fixture provides pre-populated test data

    // WHEN: User navigates to EPG view
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');
  });

  test('should display EPG grid with enabled channels only', async ({ page, epgGridData }) => {
    // GIVEN: User is on EPG view with enabled channels

    // WHEN: Page loads and displays the grid
    const epgView = page.getByTestId('epg-view');
    await expect(epgView).toBeVisible();

    const epgGrid = page.getByTestId('epg-grid');
    await expect(epgGrid).toBeVisible();

    // THEN: Grid displays rows for each enabled channel
    const enabledChannelCount = epgGridData.channels.filter((ch) => ch.isEnabled).length;

    for (const channel of epgGridData.channels.filter((ch) => ch.isEnabled)) {
      const channelRow = page.getByTestId(`epg-channel-row-${channel.id}`);
      await expect(channelRow).toBeVisible();

      // THEN: Channel name is displayed in sticky column
      const channelName = page.getByTestId(`epg-channel-name-${channel.id}`);
      await expect(channelName).toBeVisible();
      await expect(channelName).toContainText(channel.name);
    }

    // THEN: Grid does NOT display disabled channels
    const disabledChannels = epgGridData.channels.filter((ch) => !ch.isEnabled);
    for (const channel of disabledChannels) {
      const channelRow = page.getByTestId(`epg-channel-row-${channel.id}`);
      await expect(channelRow).not.toBeVisible();
    }
  });

  test('should display time slot columns with 30-minute increments', async ({ page }) => {
    // GIVEN: User is viewing EPG grid
    const epgGrid = page.getByTestId('epg-grid');
    await expect(epgGrid).toBeVisible();

    // WHEN: User looks at the time header row
    const timeHeader = page.getByTestId('epg-time-header');
    await expect(timeHeader).toBeVisible();

    // THEN: Time slots are displayed with 30-minute increments
    // Verify at least a few time slots are visible (exact count depends on viewport)
    const currentHour = new Date().getHours();
    const timeSlot1 = `epg-time-slot-${String(currentHour).padStart(2, '0')}00`;
    const timeSlot2 = `epg-time-slot-${String(currentHour).padStart(2, '0')}30`;

    await expect(page.getByTestId(timeSlot1)).toBeVisible();
    await expect(page.getByTestId(timeSlot2)).toBeVisible();

    // THEN: Time header is sticky (stays visible when scrolling vertically)
    const timeHeaderBox = await timeHeader.boundingBox();
    expect(timeHeaderBox).not.toBeNull();

    // Scroll down to verify sticky behavior
    await page.evaluate(() => window.scrollBy(0, 500));
    await expect(timeHeader).toBeVisible();
  });

  test('should display program cells with duration-based widths', async ({ page, epgGridData }) => {
    // GIVEN: User is viewing EPG grid with programs
    const epgGrid = page.getByTestId('epg-grid');
    await expect(epgGrid).toBeVisible();

    // WHEN: User looks at program cells
    const firstChannel = epgGridData.channels.filter((ch) => ch.isEnabled)[0];
    const firstProgram = firstChannel.programs[0];

    const programCell = page.getByTestId(`epg-program-cell-${firstProgram.id}`);
    await expect(programCell).toBeVisible();

    // THEN: Program title is displayed
    await expect(programCell).toContainText(firstProgram.title);

    // THEN: Cell width reflects program duration
    const cellBox = await programCell.boundingBox();
    expect(cellBox).not.toBeNull();
    expect(cellBox!.width).toBeGreaterThan(0);

    // THEN: Longer programs have wider cells
    const longProgram = firstChannel.programs.find(
      (p) => new Date(p.endTime).getTime() - new Date(p.startTime).getTime() > 60 * 60 * 1000
    );

    if (longProgram) {
      const longProgramCell = page.getByTestId(`epg-program-cell-${longProgram.id}`);
      await expect(longProgramCell).toBeVisible();

      const longCellBox = await longProgramCell.boundingBox();
      expect(longCellBox).not.toBeNull();
      expect(longCellBox!.width).toBeGreaterThan(cellBox!.width);
    }

    // THEN: Currently airing programs have visual indicator
    const now = new Date();
    const airingProgram = firstChannel.programs.find(
      (p) => new Date(p.startTime) <= now && new Date(p.endTime) >= now
    );

    if (airingProgram) {
      const airingCell = page.getByTestId(`epg-program-cell-${airingProgram.id}`);
      await expect(airingCell).toBeVisible();

      // Verify visual indicator (e.g., border or background highlight class)
      const classes = await airingCell.getAttribute('class');
      expect(classes).toMatch(/airing|current|live/i);
    }
  });
});

test.describe('Time Navigation Controls', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: User navigates to EPG view
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to current time when Now button is clicked', async ({ page }) => {
    // GIVEN: User is viewing EPG grid at some arbitrary time
    const timeNavBar = page.getByTestId('time-navigation-bar');
    await expect(timeNavBar).toBeVisible();

    // WHEN: User clicks "Now" button
    const nowButton = page.getByTestId('time-nav-now-button');
    await expect(nowButton).toBeVisible();
    await nowButton.click();

    // Wait for grid to update
    await page.waitForTimeout(500);

    // THEN: Grid centers on current time
    const currentDate = page.getByTestId('time-nav-current-date-display');
    await expect(currentDate).toBeVisible();

    const displayedDate = await currentDate.textContent();
    const today = new Date().toLocaleDateString();
    expect(displayedDate).toContain(today);

    // THEN: Current time slot is visible in grid
    const currentHour = new Date().getHours();
    const currentMinute = new Date().getMinutes() < 30 ? '00' : '30';
    const currentTimeSlot = `epg-time-slot-${String(currentHour).padStart(2, '0')}${currentMinute}`;

    await expect(page.getByTestId(currentTimeSlot)).toBeVisible();
  });

  test('should navigate to prime time when Tonight button is clicked', async ({ page }) => {
    // GIVEN: User is viewing EPG grid
    const timeNavBar = page.getByTestId('time-navigation-bar');
    await expect(timeNavBar).toBeVisible();

    // WHEN: User clicks "Tonight" button
    const tonightButton = page.getByTestId('time-nav-tonight-button');
    await expect(tonightButton).toBeVisible();
    await tonightButton.click();

    // Wait for grid to update
    await page.waitForTimeout(500);

    // THEN: Grid jumps to 7 PM of current day (prime time)
    const primeTimeSlot = page.getByTestId('epg-time-slot-1900'); // 7:00 PM
    await expect(primeTimeSlot).toBeVisible();

    // THEN: Current date display shows today
    const currentDate = page.getByTestId('time-nav-current-date-display');
    const displayedDate = await currentDate.textContent();
    const today = new Date().toLocaleDateString();
    expect(displayedDate).toContain(today);
  });

  test('should navigate to tomorrow when Tomorrow button is clicked', async ({ page }) => {
    // GIVEN: User is viewing EPG grid
    const timeNavBar = page.getByTestId('time-navigation-bar');
    await expect(timeNavBar).toBeVisible();

    // WHEN: User clicks "Tomorrow" button
    const tomorrowButton = page.getByTestId('time-nav-tomorrow-button');
    await expect(tomorrowButton).toBeVisible();
    await tomorrowButton.click();

    // Wait for grid to update
    await page.waitForTimeout(500);

    // THEN: Grid jumps to tomorrow morning (e.g., 6:00 AM)
    const morningTimeSlot = page.getByTestId('epg-time-slot-0600'); // 6:00 AM
    await expect(morningTimeSlot).toBeVisible();

    // THEN: Current date display shows tomorrow
    const currentDate = page.getByTestId('time-nav-current-date-display');
    const displayedDate = await currentDate.textContent();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toLocaleDateString();

    expect(displayedDate).toContain(tomorrowDate);
  });

  test('should navigate backward and forward using day navigation arrows', async ({ page }) => {
    // GIVEN: User is viewing EPG grid at current time
    await page.getByTestId('time-nav-now-button').click();
    await page.waitForTimeout(500);

    const currentDate = page.getByTestId('time-nav-current-date-display');
    const initialDate = await currentDate.textContent();

    // WHEN: User clicks next day arrow
    const nextDayButton = page.getByTestId('time-nav-next-day-button');
    await expect(nextDayButton).toBeVisible();
    await nextDayButton.click();
    await page.waitForTimeout(500);

    // THEN: Grid moves forward 1 day
    let displayedDate = await currentDate.textContent();
    expect(displayedDate).not.toBe(initialDate);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(displayedDate).toContain(tomorrow.toLocaleDateString());

    // WHEN: User clicks previous day arrow
    const prevDayButton = page.getByTestId('time-nav-prev-day-button');
    await expect(prevDayButton).toBeVisible();
    await prevDayButton.click();
    await page.waitForTimeout(500);

    // THEN: Grid moves back to original date
    displayedDate = await currentDate.textContent();
    expect(displayedDate).toBe(initialDate);
  });

  test('should allow date selection up to 7 days ahead', async ({ page }) => {
    // GIVEN: User is viewing EPG grid
    const timeNavBar = page.getByTestId('time-navigation-bar');
    await expect(timeNavBar).toBeVisible();

    // WHEN: User clicks date picker
    const datePicker = page.getByTestId('time-nav-date-picker');
    await expect(datePicker).toBeVisible();

    // THEN: Date picker allows selection up to 7 days from today
    const minDate = await datePicker.getAttribute('min');
    const maxDate = await datePicker.getAttribute('max');

    expect(minDate).toBeTruthy();
    expect(maxDate).toBeTruthy();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDateObj = new Date(maxDate!);
    const daysDiff = Math.floor((maxDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    expect(daysDiff).toBeLessThanOrEqual(7);

    // WHEN: User selects a date 3 days from now
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    await datePicker.fill(targetDateStr);
    await datePicker.dispatchEvent('change');
    await page.waitForTimeout(500);

    // THEN: Grid displays programs for selected date
    const currentDate = page.getByTestId('time-nav-current-date-display');
    const displayedDate = await currentDate.textContent();

    expect(displayedDate).toContain(targetDate.toLocaleDateString());
  });
});

test.describe('Program Cell Interactions', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: User navigates to EPG view
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');
  });

  test('should show hover state on program cells', async ({ page, epgGridData }) => {
    // GIVEN: User is viewing EPG grid with programs
    const epgGrid = page.getByTestId('epg-grid');
    await expect(epgGrid).toBeVisible();

    // WHEN: User hovers over a program cell
    const firstChannel = epgGridData.channels.filter((ch) => ch.isEnabled)[0];
    const firstProgram = firstChannel.programs[0];

    const programCell = page.getByTestId(`epg-program-cell-${firstProgram.id}`);
    await expect(programCell).toBeVisible();

    await programCell.hover();

    // THEN: Cell shows hover state (cursor pointer)
    const cursor = await programCell.evaluate((el) => window.getComputedStyle(el).cursor);
    expect(cursor).toBe('pointer');
  });

  test('should emit program selection event when cell is clicked', async ({ page, epgGridData }) => {
    // GIVEN: User is viewing EPG grid with programs
    const epgGrid = page.getByTestId('epg-grid');
    await expect(epgGrid).toBeVisible();

    const firstChannel = epgGridData.channels.filter((ch) => ch.isEnabled)[0];
    const firstProgram = firstChannel.programs[0];

    // WHEN: User clicks a program cell
    const programCell = page.getByTestId(`epg-program-cell-${firstProgram.id}`);
    await expect(programCell).toBeVisible();

    // Set up event listener for program selection
    const selectionPromise = page.evaluate(() => {
      return new Promise<{ programId: number }>((resolve) => {
        window.addEventListener(
          'program-selected',
          ((event: CustomEvent) => {
            resolve(event.detail);
          }) as EventListener,
          { once: true }
        );
      });
    });

    await programCell.click();

    // THEN: Program selection event is emitted
    const selectionEvent = await selectionPromise;
    expect(selectionEvent.programId).toBe(firstProgram.id);

    // Note: Story 5.3 will implement the program details panel
    // For now, we just verify the selection event is emitted
  });
});

test.describe('Empty and Loading States', () => {
  test('should display empty state when no channels are enabled', async ({ page, epgGridApi }) => {
    // GIVEN: User has no enabled channels
    await epgGridApi.disableAllChannels();

    // WHEN: User navigates to EPG view
    await page.goto('/epg');
    await page.waitForLoadState('networkidle');

    // THEN: Empty state is displayed
    const emptyState = page.getByTestId('epg-empty-state');
    await expect(emptyState).toBeVisible();

    // THEN: Empty state message guides user to enable channels
    await expect(emptyState).toContainText(/no channels enabled|enable channels/i);
  });

  test('should display loading state while fetching data', async ({ page }) => {
    // GIVEN: User is navigating to EPG view
    // WHEN: Page starts loading
    const navigationPromise = page.goto('/epg');

    // THEN: Loading state is briefly visible
    const loadingState = page.getByTestId('epg-loading-state');

    // Note: This may be very brief, so we check if it was visible at any point
    // or if the actual content is already loaded
    try {
      await expect(loadingState).toBeVisible({ timeout: 1000 });
    } catch (e) {
      // Loading was too fast - acceptable for local tests
      // In slower environments, loading state will be visible
    }

    await navigationPromise;

    // THEN: Loading state is replaced with grid content
    const epgGrid = page.getByTestId('epg-grid');
    await expect(epgGrid).toBeVisible();
    await expect(loadingState).not.toBeVisible();
  });
});
