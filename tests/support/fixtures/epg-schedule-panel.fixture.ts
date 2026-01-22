import { test as base } from '@playwright/test';
import {
  createDaySchedule,
  createScheduleWithTimeDistribution,
  type EpgScheduleData,
} from '../factories/epg-schedule-panel.factory';

/**
 * Fixture for managing EPG schedule panel data (Story 5.6)
 *
 * Provides pre-populated schedule data for a selected channel
 * with automatic cleanup after tests complete.
 */
export const test = base.extend<{
  epgScheduleData: EpgScheduleData;
  epgSchedulePanelApi: {
    selectChannel: (channelId: number) => Promise<void>;
    selectProgram: (programId: number) => Promise<void>;
    getScheduleForChannel: (channelId: number) => Promise<any[]>;
    getCurrentProgram: (channelId: number) => Promise<any>;
    scrollToCurrentProgram: () => Promise<void>;
  };
}>({
  epgScheduleData: async ({ page }, use) => {
    // Setup: Create a channel with a full day schedule
    const channelId = 100; // Use specific ID for testing
    const scheduleData = createDaySchedule(channelId, {
      channelName: 'Test Channel 100',
      channelIcon: undefined,
      programCount: 30, // 30 programs covering the day
      includeCurrentProgram: true,
    });

    // Seed test data into the app via Tauri commands
    await page.evaluate(
      async (data) => {
        // @ts-ignore - Tauri invoke available in Tauri context
        const { invoke } = window.__TAURI__;

        // Create test channel
        await invoke('create_test_xmltv_channel', {
          id: data.channelId,
          displayName: data.channelName,
          icon: data.channelIcon || null,
        });

        // Enable channel
        await invoke('set_xmltv_channel_enabled', {
          channelId: data.channelId,
          enabled: true,
          plexDisplayOrder: 1,
        });

        // Create all programs for the schedule
        for (const program of data.programs) {
          await invoke('create_test_program', {
            xmltvChannelId: data.channelId,
            title: program.title,
            startTime: program.startTime,
            endTime: program.endTime,
            category: program.category,
            description: program.description,
          });
        }
      },
      scheduleData
    );

    // Provide to test
    await use(scheduleData);

    // Cleanup: Delete all test data
    await page.evaluate(async (data) => {
      // @ts-ignore
      const { invoke } = window.__TAURI__;

      // Delete channel and all its programs
      await invoke('delete_test_channel_data', { channelId: data.channelId });
    }, scheduleData);
  },

  epgSchedulePanelApi: async ({ page }, use) => {
    const api = {
      /**
       * Select a channel in the channel list
       */
      selectChannel: async (channelId: number): Promise<void> => {
        await page.getByTestId(`channel-row-${channelId}`).click();
        // Wait for schedule to load
        await page.getByTestId('epg-schedule-panel').waitFor({ state: 'visible' });
      },

      /**
       * Select a program in the schedule panel
       */
      selectProgram: async (programId: number): Promise<void> => {
        await page.getByTestId(`schedule-row-${programId}`).click();
      },

      /**
       * Get all programs for a specific channel
       */
      getScheduleForChannel: async (channelId: number): Promise<any[]> => {
        return page.evaluate(
          async ({ channelId }) => {
            // @ts-ignore
            const { invoke } = window.__TAURI__;

            const now = new Date();
            const startOfDay = new Date(now);
            startOfDay.setHours(6, 0, 0, 0); // 6 AM today

            const endOfDay = new Date(now);
            endOfDay.setHours(30, 0, 0, 0); // 6 AM tomorrow (24 hours from 6 AM today)

            // Get programs for the channel
            const channels = await invoke('get_enabled_channels_with_programs', {
              startTime: startOfDay.toISOString(),
              endTime: endOfDay.toISOString(),
            });

            const channel = channels.find((ch: any) => ch.channelId === channelId);
            return channel?.programs || [];
          },
          { channelId }
        );
      },

      /**
       * Get the current program for a specific channel
       */
      getCurrentProgram: async (channelId: number): Promise<any> => {
        return page.evaluate(
          async ({ channelId }) => {
            // @ts-ignore
            const { invoke } = window.__TAURI__;

            const now = new Date();
            const programs = await invoke('get_programs_in_time_range', {
              channelId,
              startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
              endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
            });

            // Find the program that's currently airing
            const currentProgram = programs.find((p: any) => {
              const start = new Date(p.startTime);
              const end = new Date(p.endTime);
              return now >= start && now <= end;
            });

            return currentProgram || null;
          },
          { channelId }
        );
      },

      /**
       * Scroll to the current program in the schedule
       */
      scrollToCurrentProgram: async (): Promise<void> => {
        // Find the NOW program row
        const nowRow = page.locator('[data-testid^="schedule-row-"]').filter({
          has: page.locator('[data-testid="now-indicator"]'),
        });

        if (await nowRow.count() > 0) {
          await nowRow.scrollIntoViewIfNeeded();
        }
      },
    };

    // Provide API to test (no setup needed)
    await use(api);

    // No cleanup needed (read-only operations)
  },
});

export { expect } from '@playwright/test';
