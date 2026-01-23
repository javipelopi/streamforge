import { test as base } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { createProgram } from '../factories/program.factory';

/**
 * Fixture for managing EPG search test data
 * Provides pre-populated channels and programs optimized for search testing
 *
 * Story: 5.2 - EPG Search Functionality
 */

type EpgSearchChannel = {
  id: number;
  name: string;
  icon?: string;
  isEnabled: boolean;
  programs: Array<{
    id: number;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    category?: string;
    channelId: number;
  }>;
};

type EpgSearchData = {
  channels: EpgSearchChannel[];
  programs: Array<{
    id: number;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    category?: string;
    channelId: number;
  }>;
  queries: {
    news: string;
    sports: string;
    movies: string;
    documentary: string;
  };
};

export const test = base.extend<{
  epgSearchData: EpgSearchData;
  epgSearchApi: {
    searchPrograms: (query: string) => Promise<any[]>;
    getSearchableChannels: () => Promise<any[]>;
    clearSearchCache: () => Promise<void>;
  };
}>({
  epgSearchData: async ({ page }, use) => {
    // Setup: Create diverse channels and programs for search testing
    const now = new Date();
    const channels: EpgSearchChannel[] = [];
    const allPrograms: Array<{
      id: number;
      title: string;
      description?: string;
      startTime: string;
      endTime: string;
      category?: string;
      channelId: number;
    }> = [];

    // Create 30 channels with varied content
    const channelNames = [
      'ABC News',
      'NBC Sports',
      'HBO',
      'ESPN',
      'CNN',
      'Fox Sports',
      'Discovery Channel',
      'National Geographic',
      'Comedy Central',
      'MTV',
      'Nickelodeon',
      'Cartoon Network',
      'BBC One',
      'Sky News',
      'Food Network',
      'HGTV',
      'History Channel',
      'Travel Channel',
      'TBS',
      'TNT',
      'USA Network',
      'FX',
      'AMC',
      'Syfy',
      'Bravo',
      'E!',
      'Lifetime',
      'A&E',
      'TLC',
      'Animal Planet',
    ];

    const programTitles = {
      news: [
        'Breaking News Tonight',
        'Evening News Report',
        'World News Update',
        'News at Nine',
        'Morning News Briefing',
      ],
      sports: [
        'Sports Center Live',
        'Monday Night Football',
        'NBA Championship',
        'World Cup Soccer',
        'Sports Highlights',
      ],
      movies: [
        'Movie Marathon',
        'Classic Films',
        'Action Movie Night',
        'Romantic Comedy',
        'Thriller Movie',
      ],
      documentary: [
        'Documentary: Nature',
        'Documentary: History',
        'Documentary: Science',
        'Wildlife Documentary',
        'Documentary Special',
      ],
      entertainment: [
        'Late Night Talk Show',
        'Reality TV Competition',
        'Drama Series: Season Finale',
        'Comedy Special',
        'Award Show',
      ],
    };

    let programIdCounter = 1;

    for (let i = 0; i < channelNames.length; i++) {
      const channelId = i + 1;
      const isEnabled = i < 25; // First 25 channels enabled, last 5 disabled

      // Create 10 programs per channel spanning next 7 days
      const channelPrograms: Array<{
        id: number;
        title: string;
        description?: string;
        startTime: string;
        endTime: string;
        category?: string;
        channelId: number;
      }> = [];

      for (let j = 0; j < 10; j++) {
        const startTime = new Date(now.getTime() + j * 3 * 60 * 60 * 1000); // Every 3 hours
        const durationMinutes = faker.number.int({ min: 30, max: 180 });
        const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

        // Select program category based on channel
        let category: string;
        let titleArray: string[];

        if (channelNames[i].includes('News')) {
          category = 'News';
          titleArray = programTitles.news;
        } else if (channelNames[i].includes('Sports') || channelNames[i].includes('ESPN')) {
          category = 'Sports';
          titleArray = programTitles.sports;
        } else if (channelNames[i].includes('HBO') || channelNames[i].includes('AMC')) {
          category = 'Movies';
          titleArray = programTitles.movies;
        } else if (
          channelNames[i].includes('Discovery') ||
          channelNames[i].includes('National Geographic') ||
          channelNames[i].includes('History')
        ) {
          category = 'Documentary';
          titleArray = programTitles.documentary;
        } else {
          category = 'Entertainment';
          titleArray = programTitles.entertainment;
        }

        const program = {
          id: programIdCounter++,
          title: faker.helpers.arrayElement(titleArray),
          description: faker.lorem.sentence({ min: 10, max: 20 }),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          category,
          channelId,
        };

        channelPrograms.push(program);
        allPrograms.push(program);
      }

      channels.push({
        id: channelId,
        name: channelNames[i],
        icon: faker.datatype.boolean() ? faker.image.url() : undefined,
        isEnabled,
        programs: channelPrograms,
      });
    }

    // Seed test data into the app via Tauri commands
    await page.evaluate(
      async ({ channels }) => {
        // @ts-ignore - Tauri invoke available in Tauri context
        const { invoke } = window.__TAURI__;

        // Create test channels
        for (const channel of channels) {
          await invoke('create_test_xmltv_channel', {
            id: channel.id,
            displayName: channel.name,
            icon: channel.icon,
          });

          // Set channel enabled/disabled state
          await invoke('set_xmltv_channel_enabled', {
            channelId: channel.id,
            enabled: channel.isEnabled,
            plexDisplayOrder: channel.id,
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
      { channels }
    );

    const searchData: EpgSearchData = {
      channels,
      programs: allPrograms,
      queries: {
        news: 'news',
        sports: 'sports',
        movies: 'movie',
        documentary: 'documentary',
      },
    };

    // Provide to test
    await use(searchData);

    // Cleanup: Delete test data
    await page.evaluate(async ({ channels }) => {
      // @ts-ignore
      const { invoke } = window.__TAURI__;

      // Delete all test programs and channels
      for (const channel of channels) {
        await invoke('delete_test_channel_data', { channelId: channel.id });
      }
    }, { channels });
  },

  epgSearchApi: async ({ page }, use) => {
    const api = {
      searchPrograms: async (query: string): Promise<any[]> => {
        return page.evaluate(
          async ({ query }) => {
            // @ts-ignore
            return window.__TAURI__.invoke('search_epg_programs', { query });
          },
          { query }
        );
      },

      getSearchableChannels: async (): Promise<any[]> => {
        return page.evaluate(async () => {
          // @ts-ignore
          return window.__TAURI__.invoke('get_enabled_channels');
        });
      },

      clearSearchCache: async (): Promise<void> => {
        return page.evaluate(async () => {
          // @ts-ignore
          // Clear any cached search results (if caching is implemented)
          return window.__TAURI__.invoke('clear_search_cache');
        });
      },
    };

    // Provide API to test (no setup needed)
    await use(api);

    // No cleanup needed (read-only operations)
  },
});

export { expect } from '@playwright/test';
