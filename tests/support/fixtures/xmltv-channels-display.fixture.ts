import { test as base, Page } from '@playwright/test';
import {
  createXmltvChannelWithMappings,
  createRealisticChannelList,
  XmltvChannelWithMappings,
} from '../factories/xmltv-channel-display.factory';

/**
 * XMLTV Channels Display Fixture
 *
 * Provides test fixture for XMLTV channel list display testing.
 * Follows fixture architecture best practices:
 * - Auto-setup and auto-cleanup
 * - Composable with other fixtures
 * - Type-safe
 */

type XmltvChannelsDisplayFixtures = {
  /**
   * Pre-seeded XMLTV channels with realistic data
   * Automatically injects Tauri mock with channel data
   */
  seedXmltvChannels: (channels?: XmltvChannelWithMappings[]) => Promise<XmltvChannelWithMappings[]>;

  /**
   * Navigate to channels page with mock data ready
   */
  channelsPage: Page;
};

export const test = base.extend<XmltvChannelsDisplayFixtures>({
  /**
   * Seed XMLTV channels fixture
   * Injects Tauri mock with channel data before test runs
   */
  seedXmltvChannels: async ({ page }, use) => {
    let seededChannels: XmltvChannelWithMappings[] = [];

    const seedFn = async (channels?: XmltvChannelWithMappings[]) => {
      // Use provided channels or generate realistic defaults
      seededChannels = channels ?? createRealisticChannelList();

      // Inject Tauri mock with channels data
      const mockScript = `
        (function() {
          window.__XMLTV_CHANNELS_STATE__ = {
            channels: ${JSON.stringify(seededChannels)},
          };

          const mockCommands = {
            greet: (args) => \`Hello, \${args.name}! Welcome to iptv.\`,
            get_setting: () => null,
            set_setting: () => undefined,

            get_xmltv_channels_with_mappings: () => {
              return window.__XMLTV_CHANNELS_STATE__.channels;
            },

            set_primary_stream: (args) => {
              const { xmltvChannelId, xtreamChannelId } = args;
              const channel = window.__XMLTV_CHANNELS_STATE__.channels.find(
                ch => ch.id === xmltvChannelId
              );

              if (!channel) throw new Error('Channel not found');

              channel.matches.forEach(match => {
                match.isPrimary = match.id === xtreamChannelId;
                match.streamPriority = match.id === xtreamChannelId ? 0 : 1;
              });

              return channel.matches;
            },

            toggle_xmltv_channel: (args) => {
              const channel = window.__XMLTV_CHANNELS_STATE__.channels.find(
                ch => ch.id === args.channelId
              );

              if (channel) {
                channel.isEnabled = !channel.isEnabled;
              }

              return channel;
            },
          };

          async function mockInvoke(cmd, args = {}) {
            if (mockCommands[cmd]) {
              return await Promise.resolve(mockCommands[cmd](args));
            }
            throw new Error(\`Unknown command: \${cmd}\`);
          }

          if (!window.__TAURI__) {
            window.__TAURI__ = {};
          }
          window.__TAURI__.invoke = mockInvoke;
          window.__TAURI_INTERNALS__ = { invoke: mockInvoke };
        })();
      `;

      await page.addInitScript(mockScript);

      return seededChannels;
    };

    // Provide seed function to test
    await use(seedFn);

    // Cleanup: Clear state after test
    await page.evaluate(() => {
      if (window.__XMLTV_CHANNELS_STATE__) {
        delete window.__XMLTV_CHANNELS_STATE__;
      }
    }).catch(() => {
      // Ignore cleanup errors (page may be closed)
    });
  },

  /**
   * Channels page fixture
   * Provides a page that's already navigated to /channels with mock ready
   */
  channelsPage: async ({ page, seedXmltvChannels }, use) => {
    // Setup: Seed default channels and navigate
    await seedXmltvChannels();
    await page.goto('/channels');
    await page.waitForLoadState('networkidle');

    // Provide page to test
    await use(page);

    // Cleanup: None needed (page cleanup handled by Playwright)
  },
});

export { expect } from '@playwright/test';
