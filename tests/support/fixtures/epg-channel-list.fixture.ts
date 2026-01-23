import { test as base } from '@playwright/test';
import {
  createEpgChannelListData,
  type EpgChannelListData,
} from '../factories/epg-channel-list.factory';

/**
 * Fixture for managing EPG channel list data (Story 5.5)
 *
 * Provides pre-populated channel list data with current programs
 * and automatic cleanup after tests complete.
 */
export const test = base.extend<{
  epgChannelListData: EpgChannelListData;
  epgChannelListApi: {
    getEnabledChannelsWithPrograms: () => Promise<any[]>;
    selectChannel: (channelId: number) => Promise<void>;
    getCurrentProgram: (channelId: number) => Promise<any>;
    refreshChannelList: () => Promise<void>;
  };
}>({
  epgChannelListData: async ({ page }, use) => {
    // Setup: Create channel list data with current programs
    const now = new Date();
    const channelListData = createEpgChannelListData({
      channelCount: 20,
      includeChannelsWithoutPrograms: true,
      withoutProgramCount: 3, // Include 3 channels without current programs
    });

    // Seed test data into the app via Tauri commands
    await page.evaluate(
      async (data) => {
        // @ts-ignore - Tauri invoke available in Tauri context
        const { invoke } = window.__TAURI__;

        // Create test channels with current programs
        for (const channel of data.channels) {
          // Create channel
          await invoke('create_test_xmltv_channel', {
            id: channel.channelId,
            displayName: channel.channelName,
            icon: channel.channelIcon || null,
          });

          // Enable channel with display order
          await invoke('set_xmltv_channel_enabled', {
            channelId: channel.channelId,
            enabled: true,
            plexDisplayOrder: channel.plexDisplayOrder,
          });

          // Create current program if it exists
          if (channel.currentProgram) {
            await invoke('create_test_program', {
              xmltvChannelId: channel.channelId,
              title: channel.currentProgram.title,
              startTime: channel.currentProgram.startTime,
              endTime: channel.currentProgram.endTime,
              category: channel.currentProgram.category,
              description: channel.currentProgram.description,
            });
          }
        }
      },
      channelListData
    );

    // Provide to test
    await use(channelListData);

    // Cleanup: Delete all test data
    await page.evaluate(async (data) => {
      // @ts-ignore
      const { invoke } = window.__TAURI__;

      // Delete all test channels and their programs
      for (const channel of data.channels) {
        await invoke('delete_test_channel_data', { channelId: channel.channelId });
      }
    }, channelListData);
  },

  epgChannelListApi: async ({ page }, use) => {
    const api = {
      /**
       * Get all enabled channels with their current programs
       */
      getEnabledChannelsWithPrograms: async (): Promise<any[]> => {
        return page.evaluate(async () => {
          // @ts-ignore
          const { invoke } = window.__TAURI__;

          const now = new Date();
          const startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
          const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now

          return invoke('get_enabled_channels_with_programs', {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          });
        });
      },

      /**
       * Simulate selecting a channel in the UI
       */
      selectChannel: async (channelId: number): Promise<void> => {
        await page.getByTestId(`channel-row-${channelId}`).click();
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
              startTime: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
              endTime: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
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
       * Trigger a refresh of the channel list data
       */
      refreshChannelList: async (): Promise<void> => {
        // Force a re-render by navigating away and back
        await page.goto('/');
        await page.goto('/epg-tv');
        await page.waitForLoadState('networkidle');
      },
    };

    // Provide API to test (no setup needed)
    await use(api);

    // No cleanup needed (read-only operations)
  },
});

export { expect } from '@playwright/test';
