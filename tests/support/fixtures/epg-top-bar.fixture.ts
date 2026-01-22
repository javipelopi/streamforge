import { test as base } from '@playwright/test';
import {
  createDayOptions,
  createTopBarTestData,
  type EpgTopBarTestData,
} from '../factories/epg-top-bar.factory';

/**
 * Fixture for managing EPG top bar data (Story 5.7)
 *
 * Provides pre-populated day options, searchable programs, and test channels
 * with automatic cleanup after tests complete.
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
    getVisibleSearchResults: () => Promise<number>;
  };
}>({
  epgTopBarData: async ({ page }, use) => {
    // Setup: Create test data with day options, channels, and programs
    const testData = createTopBarTestData({
      channelCount: 5,
      programsPerChannel: 20,
    });

    // Seed test data into the app via Tauri commands
    await page.evaluate(
      async (data) => {
        // @ts-ignore - Tauri invoke available in Tauri context
        const { invoke } = window.__TAURI__;

        // Create test channels
        for (const channel of data.channels) {
          await invoke('create_test_xmltv_channel', {
            id: channel.id,
            displayName: channel.name,
            icon: channel.icon || null,
          });

          await invoke('set_xmltv_channel_enabled', {
            channelId: channel.id,
            enabled: true,
            plexDisplayOrder: channel.id - 99, // Order by ID
          });
        }

        // Create programs for each channel
        for (const program of data.programs) {
          await invoke('create_test_program', {
            xmltvChannelId: program.channelId,
            title: program.title,
            startTime: program.startTime,
            endTime: program.endTime,
            category: program.category,
            description: program.description,
          });
        }
      },
      testData
    );

    // Provide to test
    await use(testData);

    // Cleanup: Delete all test data
    await page.evaluate(async (data) => {
      // @ts-ignore
      const { invoke } = window.__TAURI__;

      // Delete each channel and its programs
      for (const channel of data.channels) {
        await invoke('delete_test_channel_data', { channelId: channel.id });
      }
    }, testData);
  },

  epgTopBarApi: async ({ page }, use) => {
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
        const searchInput = page.getByTestId('epg-search-input');
        await searchInput.click();
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
       * Get count of visible search results
       */
      getVisibleSearchResults: async (): Promise<number> => {
        const resultsDropdown = page.getByTestId('epg-search-results');
        const isVisible = await resultsDropdown.isVisible().catch(() => false);

        if (!isVisible) {
          return 0;
        }

        // Count result rows
        const results = page.locator('[data-testid^="search-result-"]');
        return await results.count();
      },
    };

    // Provide API to test (no setup needed)
    await use(api);

    // No cleanup needed (read-only operations)
  },
});

export { expect } from '@playwright/test';
