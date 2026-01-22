import { test as base } from '@playwright/test';
import {
  createProgramDetailsTestData,
  type ProgramDetailsTestData,
  type ProgramDetails,
} from '../factories/program-details.factory';

/**
 * Fixture for managing program details test data via Tauri commands
 * Provides pre-populated test data and API helpers with automatic cleanup
 *
 * Story: 5.3 - Program Details View
 */
export const test = base.extend<{
  programDetailsData: ProgramDetailsTestData;
  programDetailsApi: {
    getChannelStreamInfo: (channelId: number) => Promise<any>;
    selectProgram: (programId: number) => Promise<void>;
    closeDetailsPanel: () => Promise<void>;
  };
}>({
  programDetailsData: async ({ page }, use) => {
    // Setup: Create program details test data
    const testData = createProgramDetailsTestData({
      programCount: 15,
      channelCount: 8,
      includeEdgeCases: true,
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

          // Enable channel
          await invoke('set_xmltv_channel_enabled', {
            channelId: channel.id,
            enabled: channel.isEnabled,
            plexDisplayOrder: channel.plexDisplayOrder,
          });
        }

        // Create test programs
        for (const program of data.programs) {
          await invoke('create_test_program', {
            id: program.id,
            xmltvChannelId: program.channelId,
            title: program.title,
            startTime: program.startTime,
            endTime: program.endTime,
            category: program.category,
            description: program.description,
            episodeInfo: program.episodeInfo,
          });

          // Create stream mapping if streamInfo exists
          if (program.streamInfo) {
            await invoke('create_test_channel_mapping', {
              xmltvChannelId: program.channelId,
              streamName: program.streamInfo.streamName,
              qualityTiers: program.streamInfo.qualityTiers,
              isPrimary: program.streamInfo.isPrimary,
              matchConfidence: program.streamInfo.matchConfidence,
            });
          }
        }
      },
      testData
    );

    // Provide to test
    await use(testData);

    // Cleanup: Delete test data
    await page.evaluate(async (data) => {
      // @ts-ignore
      const { invoke } = window.__TAURI__;

      // Delete all test programs and channels
      for (const channel of data.channels) {
        await invoke('delete_test_channel_data', { channelId: channel.id });
      }

      // Delete test stream mappings
      for (const program of data.programs) {
        if (program.streamInfo) {
          await invoke('delete_test_stream_mapping', { xmltvChannelId: program.channelId });
        }
      }
    }, testData);
  },

  programDetailsApi: async ({ page }, use) => {
    const api = {
      /**
       * Get channel stream info for a given channel
       */
      getChannelStreamInfo: async (channelId: number): Promise<any> => {
        return page.evaluate(
          async (channelId) => {
            // @ts-ignore
            return window.__TAURI__.invoke('get_channel_stream_info', {
              xmltvChannelId: channelId,
            });
          },
          channelId
        );
      },

      /**
       * Programmatically select a program (triggers details panel)
       */
      selectProgram: async (programId: number): Promise<void> => {
        return page.evaluate(
          async (programId) => {
            // Dispatch program selection event (same as clicking program cell)
            window.dispatchEvent(
              new CustomEvent('programSelected', {
                detail: { programId },
              })
            );
          },
          programId
        );
      },

      /**
       * Close the details panel programmatically
       */
      closeDetailsPanel: async (): Promise<void> => {
        return page.evaluate(async () => {
          // Dispatch Escape key event
          const event = new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            bubbles: true,
          });
          document.dispatchEvent(event);
        });
      },
    };

    // Provide API to test (no setup needed)
    await use(api);

    // No cleanup needed (read-only operations)
  },
});

export { expect } from '@playwright/test';
