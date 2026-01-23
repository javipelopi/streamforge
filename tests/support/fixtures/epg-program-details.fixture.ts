import { test as base } from '@playwright/test';
import { createProgramWithChannel } from '../factories/epg-program-details.factory';

/**
 * Fixture for EPG Program Details Panel tests
 * Provides mock program data and helper utilities
 */

type ProgramDetailsFixture = {
  programDetailsData: {
    programId: number;
    channelId: number;
    program: {
      id: number;
      xmltvChannelId: number;
      title: string;
      description: string;
      startTime: string;
      endTime: string;
      category: string;
      episodeInfo: string;
    };
    channel: {
      id: number;
      displayName: string;
      icon: string;
    };
  };
  programDetailsApi: {
    selectProgram: (programId: number) => Promise<void>;
    clearSelection: () => Promise<void>;
  };
};

export const test = base.extend<ProgramDetailsFixture>({
  programDetailsData: async ({ page }, use) => {
    // Create test program with channel data
    const mockData = await page.evaluate(async () => {
      // @ts-ignore
      const { invoke } = window.__TAURI__;

      // Create test channel
      const channelId = 5001;
      await invoke('create_test_xmltv_channel', {
        id: channelId,
        displayName: 'Test Channel Details',
        icon: 'https://example.com/channel-icon.png',
      });

      await invoke('set_xmltv_channel_enabled', {
        channelId,
        enabled: true,
        plexDisplayOrder: 1,
      });

      // Create test program (currently airing)
      const now = new Date();
      const programData = {
        xmltvChannelId: channelId,
        title: 'Breaking Bad: Pilot',
        description: 'A high school chemistry teacher is diagnosed with terminal lung cancer and turns to cooking methamphetamine to secure his family\'s financial future.',
        startTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        endTime: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        category: 'Drama',
        episodeInfo: 'Season 1, Episode 1',
      };

      const program = await invoke('create_test_program', programData);

      return {
        programId: (program as any).id,
        channelId,
        program: program as any,
        channel: {
          id: channelId,
          displayName: 'Test Channel Details',
          icon: 'https://example.com/channel-icon.png',
        },
      };
    });

    await use(mockData);

    // Cleanup
    await page.evaluate(async (channelId: number) => {
      // @ts-ignore
      const { invoke } = window.__TAURI__;
      await invoke('delete_test_channel_data', { channelId });
    }, mockData.channelId);
  },

  programDetailsApi: async ({ page }, use) => {
    const api = {
      selectProgram: async (programId: number) => {
        // Select program by clicking on schedule row
        const programRow = page.getByTestId(`schedule-row-${programId}`);
        await programRow.click();
        // Wait for details panel to appear
        await page.getByTestId('epg-program-details').waitFor({ state: 'visible' });
      },
      clearSelection: async () => {
        // Click outside or press Escape to clear selection
        await page.keyboard.press('Escape');
        // Wait for details panel to hide
        await page.getByTestId('epg-program-details').waitFor({ state: 'hidden' });
      },
    };

    await use(api);
  },
});

export { expect } from '@playwright/test';
