import { test as base } from '@playwright/test';
import { createEpgGridData, type EpgGridData } from '../factories/epg-grid-data.factory';

/**
 * Fixture for managing EPG grid data via Tauri commands
 * Provides pre-populated test data and API helpers with automatic cleanup
 *
 * Story: 5.1 - EPG Grid Browser with Time Navigation
 */
export const test = base.extend<{
  epgGridData: EpgGridData;
  epgGridApi: {
    getPrograms: (channelId: number, startTime: Date, endTime: Date) => Promise<any[]>;
    getEnabledChannels: () => Promise<any[]>;
    getProgramsInTimeRange: (startTime: Date, endTime: Date) => Promise<any[]>;
    disableAllChannels: () => Promise<void>;
  };
}>({
  epgGridData: async ({ page }, use) => {
    // Setup: Create EPG grid data for current time window (3 hours)
    const now = new Date();
    const gridData = createEpgGridData({
      channelCount: 20,
      startTime: new Date(now.getTime() - 1.5 * 60 * 60 * 1000), // 1.5 hours ago
      endTime: new Date(now.getTime() + 1.5 * 60 * 60 * 1000), // 1.5 hours from now
      includeDisabledChannels: true, // Include some disabled channels for filtering tests
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
            icon: channel.icon,
          });

          // Set channel enabled/disabled state
          await invoke('set_xmltv_channel_enabled', {
            channelId: channel.id,
            enabled: channel.isEnabled,
            plexDisplayOrder: channel.plexDisplayOrder,
          });

          // Create programs for this channel
          for (const program of channel.programs) {
            await invoke('create_test_program', {
              xmltvChannelId: channel.id,
              title: program.title,
              startTime: program.startTime,
              endTime: program.endTime,
              category: program.category,
              description: program.description,
            });
          }
        }
      },
      gridData
    );

    // Provide to test
    await use(gridData);

    // Cleanup: Delete test data
    await page.evaluate(async (data) => {
      // @ts-ignore
      const { invoke } = window.__TAURI__;

      // Delete all test programs and channels
      for (const channel of data.channels) {
        await invoke('delete_test_channel_data', { channelId: channel.id });
      }
    }, gridData);
  },

  epgGridApi: async ({ page }, use) => {
    const api = {
      getPrograms: async (
        channelId: number,
        startTime: Date,
        endTime: Date
      ): Promise<any[]> => {
        return page.evaluate(
          async ({ channelId, startTime, endTime }) => {
            // @ts-ignore
            return window.__TAURI__.invoke('get_programs_in_time_range', {
              channelId,
              startTime: startTime,
              endTime: endTime,
            });
          },
          { channelId, startTime: startTime.toISOString(), endTime: endTime.toISOString() }
        );
      },

      getEnabledChannels: async (): Promise<any[]> => {
        return page.evaluate(async () => {
          // @ts-ignore
          return window.__TAURI__.invoke('get_enabled_channels');
        });
      },

      getProgramsInTimeRange: async (startTime: Date, endTime: Date): Promise<any[]> => {
        return page.evaluate(
          async ({ startTime, endTime }) => {
            // @ts-ignore
            return window.__TAURI__.invoke('get_enabled_channels_with_programs', {
              startTime: startTime,
              endTime: endTime,
            });
          },
          { startTime: startTime.toISOString(), endTime: endTime.toISOString() }
        );
      },

      disableAllChannels: async (): Promise<void> => {
        return page.evaluate(async () => {
          // @ts-ignore
          const { invoke } = window.__TAURI__;

          // Get all channels and disable them
          const channels = await invoke('get_all_xmltv_channels');

          for (const channel of channels) {
            await invoke('set_xmltv_channel_enabled', {
              channelId: channel.id,
              enabled: false,
            });
          }
        });
      },
    };

    // Provide API to test (no setup needed)
    await use(api);

    // No cleanup needed (read-only operations)
  },
});

export { expect } from '@playwright/test';
