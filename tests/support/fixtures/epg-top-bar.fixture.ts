import { test as base, type Page } from '@playwright/test';
import {
  createDayOptions,
  createTopBarTestData,
  type EpgTopBarTestData,
} from '../factories/epg-top-bar.factory';
import { injectTauriMock } from '../mocks/tauri.mock';

/**
 * Inject shared Tauri mocks for EPG top bar testing
 * Includes search and channel/schedule data mocks
 */
async function injectEpgTopBarMocks(page: Page): Promise<void> {
  await injectTauriMock(page, {
    commands: {
      // Mock search_epg_programs command - returns search results matching test data
      search_epg_programs: (args: { query: string }) => {
        const query = (args.query || '').toLowerCase();

        // Return empty for specific no-match query
        if (!query || query === 'zzz-no-match-xyz') {
          return [];
        }

        // Create mock results using consistent IDs with test data
        // Test data uses channelId * 1000 + index + 1 for program IDs
        const now = new Date();
        const mockPrograms = [
          {
            programId: 100001,
            title: 'Program 1',
            description: 'First program of the day',
            startTime: now.toISOString(),
            endTime: new Date(now.getTime() + 3600000).toISOString(),
            category: 'News',
            channelId: 100,
            channelName: 'Test Channel 100',
            channelIcon: null,
            matchType: 'title',
            relevanceScore: 1.0,
          },
          {
            programId: 100002,
            title: 'Program 2',
            description: 'Second program of the day',
            startTime: new Date(now.getTime() + 3600000).toISOString(),
            endTime: new Date(now.getTime() + 7200000).toISOString(),
            category: 'News',
            channelId: 100,
            channelName: 'Test Channel 100',
            channelIcon: null,
            matchType: 'title',
            relevanceScore: 0.9,
          },
          {
            programId: 100003,
            title: 'Program 3',
            description: 'Third program',
            startTime: new Date(now.getTime() + 7200000).toISOString(),
            endTime: new Date(now.getTime() + 10800000).toISOString(),
            category: 'Entertainment',
            channelId: 100,
            channelName: 'Test Channel 100',
            channelIcon: null,
            matchType: 'title',
            relevanceScore: 0.8,
          },
          {
            programId: 101001,
            title: 'News Hour',
            description: 'Evening news coverage',
            startTime: now.toISOString(),
            endTime: new Date(now.getTime() + 3600000).toISOString(),
            category: 'News',
            channelId: 101,
            channelName: 'Test Channel 101',
            channelIcon: null,
            matchType: 'title',
            relevanceScore: 0.85,
          },
        ];

        // Filter by query - match title, description, or channel name
        return mockPrograms.filter(
          (p) =>
            p.title.toLowerCase().includes(query) ||
            p.description.toLowerCase().includes(query) ||
            p.channelName.toLowerCase().includes(query)
        );
      },
      // Mock get_enabled_channels_with_programs for schedule loading
      get_enabled_channels_with_programs: () => {
        const now = new Date();
        return [
          {
            channelId: 100,
            channelName: 'Test Channel 100',
            channelIcon: null,
            plexDisplayOrder: 1,
            programs: [
              {
                id: 100001,
                title: 'Program 1',
                description: 'First program of the day',
                startTime: now.toISOString(),
                endTime: new Date(now.getTime() + 3600000).toISOString(),
                category: 'News',
              },
              {
                id: 100002,
                title: 'Program 2',
                description: 'Second program',
                startTime: new Date(now.getTime() + 3600000).toISOString(),
                endTime: new Date(now.getTime() + 7200000).toISOString(),
                category: 'News',
              },
            ],
          },
          {
            channelId: 101,
            channelName: 'Test Channel 101',
            channelIcon: null,
            plexDisplayOrder: 2,
            programs: [
              {
                id: 101001,
                title: 'News Hour',
                description: 'Evening news coverage',
                startTime: now.toISOString(),
                endTime: new Date(now.getTime() + 3600000).toISOString(),
                category: 'News',
              },
            ],
          },
        ];
      },
    },
  });
}

/**
 * Fixture for managing EPG top bar data (Story 5.7)
 *
 * Provides pre-populated day options, searchable programs, and test channels
 * with automatic cleanup after tests complete.
 *
 * IMPORTANT: All tests in files using this fixture will automatically get
 * Tauri mocks injected via the page fixture override below.
 */
export const test = base.extend<{
  epgTopBarData: EpgTopBarTestData;
  epgTopBarApi: {
    expandSearch: () => Promise<void>;
    collapseSearch: () => Promise<void>;
    searchPrograms: (query: string) => Promise<void>;
    selectDayChip: (dayId: string) => Promise<void>;
    selectDate: (date: Date) => Promise<void>;
    clearSearch: () => Promise<void>;
    getVisibleSearchResults: () => Promise<string[]>;
  };
}>({
  // Override the base page fixture to always inject Tauri mocks
  // This ensures mocks are available even for tests that don't use other fixtures
  page: async ({ page }, use) => {
    await injectEpgTopBarMocks(page);
    await use(page);
  },

  epgTopBarData: async ({ page }, use) => {
    // Setup: Create test data with day options, channels, and programs
    const testData = createTopBarTestData({
      channelCount: 5,
      programsPerChannel: 20,
    });

    // Note: Mocks are now injected by page fixture override above
    // Provide to test
    await use(testData);

    // No cleanup needed - mocks are reset per test
  },

  epgTopBarApi: async ({ page }, use) => {
    // Note: Mocks are now injected by page fixture override above

    const api = {
      /**
       * Expand search input by clicking icon or focusing
       */
      expandSearch: async (): Promise<void> => {
        const searchIcon = page.getByTestId('epg-search-icon');
        await searchIcon.click();
        await page.waitForTimeout(100); // Wait for animation
      },

      /**
       * Collapse search input by blurring
       */
      collapseSearch: async (): Promise<void> => {
        const searchInput = page.getByTestId('epg-search-input');
        await searchInput.blur();
        await page.waitForTimeout(100); // Wait for animation
      },

      /**
       * Type a search query and wait for results
       */
      searchPrograms: async (query: string): Promise<void> => {
        // First expand the search input by clicking the icon
        const searchIcon = page.getByTestId('epg-search-icon');
        await searchIcon.click();
        await page.waitForTimeout(100); // Wait for expand animation

        // Then fill the input
        const searchInput = page.getByTestId('epg-search-input');
        await searchInput.fill(query);
        await page.waitForTimeout(400); // Wait for debounce (300ms) + buffer
      },

      /**
       * Select a day chip by ID
       */
      selectDayChip: async (dayId: string): Promise<void> => {
        const dayChip = page.getByTestId(`day-chip-${dayId}`);
        await dayChip.click();
        await page.waitForTimeout(200); // Wait for schedule update
      },

      /**
       * Select a date from the date picker
       */
      selectDate: async (date: Date): Promise<void> => {
        // Open date picker
        const datePickerButton = page.getByTestId('date-picker-button');
        await datePickerButton.click();

        // Wait for overlay
        const overlay = page.getByTestId('date-picker-overlay');
        await overlay.waitFor({ state: 'visible' });

        // Click date cell
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const dateCell = page.getByTestId(`date-picker-day-${dateStr}`);
        await dateCell.click();

        await page.waitForTimeout(200); // Wait for schedule update
      },

      /**
       * Clear search input
       */
      clearSearch: async (): Promise<void> => {
        const clearButton = page.getByTestId('epg-search-clear');
        await clearButton.click();
      },

      /**
       * Get visible search results as an array of locators
       */
      getVisibleSearchResults: async (): Promise<string[]> => {
        const resultsDropdown = page.getByTestId('epg-search-results');
        const isVisible = await resultsDropdown.isVisible().catch(() => false);

        if (!isVisible) {
          return [];
        }

        // Get all result row testids
        const results = page.locator('[data-testid^="search-result-"]');
        const count = await results.count();
        const testIds: string[] = [];
        for (let i = 0; i < count; i++) {
          const testId = await results.nth(i).getAttribute('data-testid');
          if (testId) {
            testIds.push(testId);
          }
        }
        return testIds;
      },
    };

    // Provide API to test (no setup needed)
    await use(api);

    // No cleanup needed (read-only operations)
  },
});

export { expect } from '@playwright/test';
