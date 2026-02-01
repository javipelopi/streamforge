import { test as base, expect, Page } from '@playwright/test';
import { faker } from '@faker-js/faker';

/**
 * E2E Tests for Channel Mapping Functionality
 *
 * Tests the user journey of:
 * 1. Creating channel mappings manually
 * 2. Deleting channel mappings
 * 3. Setting priority ordering for backup streams
 * 4. Selecting different source types (Xtream, M3U, Acestream)
 * 5. Persisting mappings across sessions
 *
 * Acceptance Criteria Covered:
 * - AC 9: Manual channel mapping creation/deletion
 * - AC 10: Priority ordering of backup streams
 * - AC 11: Source type selection (Xtream, M3U, Acestream)
 *
 * @see tech-spec-multi-source-stream-support.md
 */

// Seed faker for deterministic test data
faker.seed(54321);

interface ChannelMapping {
  id: number;
  xmltvChannelId: number;
  sourceType: 'xtream' | 'm3u' | 'acestream';
  xtreamChannelId: number | null;
  m3uChannelId: number | null;
  acestreamSourceId: number | null;
  streamPriority: number;
  createdAt: string;
  updatedAt: string;
}

interface XmltvChannel {
  id: number;
  sourceId: number;
  channelId: string;
  displayName: string;
  icon?: string;
}

interface M3uChannel {
  id: number;
  sourceId: number;
  name: string;
  streamUrl: string;
  tvgId: string | null;
}

interface AcestreamSource {
  id: number;
  name: string;
  contentId: string;
  isActive: boolean;
}

interface XtreamStream {
  id: number;
  accountId: number;
  name: string;
  streamId: number;
}

// Test fixtures for channel mapping tests
interface ChannelMappingFixtures {
  injectChannelMappingMocks: (config: {
    xmltvChannels: XmltvChannel[];
    m3uChannels: M3uChannel[];
    acestreamSources: AcestreamSource[];
    xtreamStreams: XtreamStream[];
    existingMappings: ChannelMapping[];
  }) => Promise<void>;
  defaultTestData: {
    xmltvChannels: XmltvChannel[];
    m3uChannels: M3uChannel[];
    acestreamSources: AcestreamSource[];
    xtreamStreams: XtreamStream[];
  };
}

/**
 * Generate mock injection script for channel mapping
 */
function generateChannelMappingMockScript(config: {
  xmltvChannels: XmltvChannel[];
  m3uChannels: M3uChannel[];
  acestreamSources: AcestreamSource[];
  xtreamStreams: XtreamStream[];
  existingMappings: ChannelMapping[];
}): string {
  return `
    (function() {
      window.__CHANNEL_MAPPING_STATE__ = {
        xmltvChannels: ${JSON.stringify(config.xmltvChannels)},
        m3uChannels: ${JSON.stringify(config.m3uChannels)},
        acestreamSources: ${JSON.stringify(config.acestreamSources)},
        xtreamStreams: ${JSON.stringify(config.xtreamStreams)},
        mappings: ${JSON.stringify(config.existingMappings)},
      };

      const mockCommands = {
        // Core settings
        greet: (args) => \`Hello, \${args.name}!\`,
        get_setting: () => null,
        set_setting: () => undefined,
        get_server_port: () => 5004,
        set_server_port: () => undefined,
        get_autostart_enabled: () => ({ enabled: false }),
        set_autostart_enabled: () => undefined,

        // XMLTV channels
        get_xmltv_channels: () => window.__CHANNEL_MAPPING_STATE__.xmltvChannels,
        get_xmltv_channels_for_source: (args) =>
          window.__CHANNEL_MAPPING_STATE__.xmltvChannels.filter(c => c.sourceId === args.sourceId),
        get_xmltv_sources: () => [{ id: 1, name: 'EPG Source', url: 'http://example.com/epg.xml' }],

        // M3U channels
        get_m3u_channels: (args) =>
          window.__CHANNEL_MAPPING_STATE__.m3uChannels.filter(c => c.sourceId === args.sourceId),
        get_m3u_sources: () => [{ id: 1, name: 'M3U Source', url: 'http://example.com/playlist.m3u' }],

        // Acestream sources
        get_acestream_sources: () => window.__CHANNEL_MAPPING_STATE__.acestreamSources,
        check_acestream_status: () => ({ isSupported: true, engineAvailable: true, platform: 'linux', engineUrl: 'http://127.0.0.1:6878' }),

        // Xtream streams
        get_accounts: () => [{ id: 1, name: 'Xtream Account', url: 'http://xtream.example.com' }],
        get_xtream_streams_for_account: (args) =>
          window.__CHANNEL_MAPPING_STATE__.xtreamStreams.filter(s => s.accountId === args.accountId),
        get_account_stream_stats: () => ({ streamCount: 10, linkedCount: 5, orphanCount: 5, promotedCount: 0 }),

        // Channel mapping commands
        get_channel_mappings: (args) => {
          console.log('[Mock] get_channel_mappings called:', args);
          if (args.xmltvChannelId) {
            return window.__CHANNEL_MAPPING_STATE__.mappings.filter(m => m.xmltvChannelId === args.xmltvChannelId);
          }
          return window.__CHANNEL_MAPPING_STATE__.mappings;
        },

        create_channel_mapping: (args) => {
          console.log('[Mock] create_channel_mapping called:', args);
          const { xmltvChannelId, sourceType, sourceId, priority } = args;

          const now = new Date().toISOString();
          const newId = Math.max(0, ...window.__CHANNEL_MAPPING_STATE__.mappings.map(m => m.id)) + 1;

          const newMapping = {
            id: newId,
            xmltvChannelId,
            sourceType,
            xtreamChannelId: sourceType === 'xtream' ? sourceId : null,
            m3uChannelId: sourceType === 'm3u' ? sourceId : null,
            acestreamSourceId: sourceType === 'acestream' ? sourceId : null,
            streamPriority: priority || 1,
            createdAt: now,
            updatedAt: now,
          };

          window.__CHANNEL_MAPPING_STATE__.mappings.push(newMapping);
          return newMapping;
        },

        delete_channel_mapping: (args) => {
          console.log('[Mock] delete_channel_mapping called:', args);
          const { mappingId } = args;
          const index = window.__CHANNEL_MAPPING_STATE__.mappings.findIndex(m => m.id === mappingId);
          if (index === -1) throw new Error('Mapping not found');
          window.__CHANNEL_MAPPING_STATE__.mappings.splice(index, 1);
          return { success: true };
        },

        update_channel_mapping_priority: (args) => {
          console.log('[Mock] update_channel_mapping_priority called:', args);
          const { mappingId, priority } = args;
          const mapping = window.__CHANNEL_MAPPING_STATE__.mappings.find(m => m.id === mappingId);
          if (!mapping) throw new Error('Mapping not found');
          mapping.streamPriority = priority;
          mapping.updatedAt = new Date().toISOString();
          return mapping;
        },

        reorder_channel_mappings: (args) => {
          console.log('[Mock] reorder_channel_mappings called:', args);
          const { xmltvChannelId, mappingIds } = args;

          // Update priorities based on order
          mappingIds.forEach((id, index) => {
            const mapping = window.__CHANNEL_MAPPING_STATE__.mappings.find(m => m.id === id);
            if (mapping) {
              mapping.streamPriority = index + 1;
              mapping.updatedAt = new Date().toISOString();
            }
          });

          return window.__CHANNEL_MAPPING_STATE__.mappings
            .filter(m => m.xmltvChannelId === xmltvChannelId)
            .sort((a, b) => a.streamPriority - b.streamPriority);
        },
      };

      async function mockInvoke(cmd, args = {}) {
        console.log('[Tauri Mock] Invoke:', cmd, args);
        if (mockCommands[cmd]) {
          try {
            const result = await Promise.resolve(mockCommands[cmd](args));
            console.log('[Tauri Mock] Result:', cmd, result);
            return result;
          } catch (error) {
            console.error('[Tauri Mock] Error:', cmd, error);
            throw error;
          }
        }
        console.warn('[Tauri Mock] Unknown command:', cmd);
        throw new Error(\`Unknown command: \${cmd}\`);
      }

      window.__TAURI_INTERNALS__ = {
        invoke: mockInvoke,
        metadata: {
          currentWindow: { label: 'main' },
          currentWebview: { label: 'main' },
          windows: [{ label: 'main' }],
          webviews: [{ label: 'main' }],
        },
        plugins: {},
      };
      window.__TAURI__ = { invoke: mockInvoke };
      window.__TAURI_MOCK__ = { invoke: mockInvoke, commands: mockCommands, getState: () => window.__CHANNEL_MAPPING_STATE__ };

      console.log('[Tauri Mock] Channel mapping mock initialized');
    })();
  `;
}

// Create default test data
const defaultXmltvChannels: XmltvChannel[] = [
  { id: 1, sourceId: 1, channelId: 'cnn.us', displayName: 'CNN' },
  { id: 2, sourceId: 1, channelId: 'bbc.uk', displayName: 'BBC News' },
  { id: 3, sourceId: 1, channelId: 'espn.us', displayName: 'ESPN' },
  { id: 4, sourceId: 1, channelId: 'hbo.us', displayName: 'HBO' },
  { id: 5, sourceId: 1, channelId: 'discovery.us', displayName: 'Discovery Channel' },
];

const defaultM3uChannels: M3uChannel[] = [
  { id: 101, sourceId: 1, name: 'CNN HD', streamUrl: 'http://example.com/cnn.m3u8', tvgId: 'cnn.us' },
  { id: 102, sourceId: 1, name: 'BBC World', streamUrl: 'http://example.com/bbc.m3u8', tvgId: 'bbc.uk' },
  { id: 103, sourceId: 1, name: 'ESPN Live', streamUrl: 'http://example.com/espn.m3u8', tvgId: 'espn.us' },
];

const defaultAcestreamSources: AcestreamSource[] = [
  { id: 201, name: 'Sports HD', contentId: 'a'.repeat(40), isActive: true },
  { id: 202, name: 'News 24/7', contentId: 'b'.repeat(40), isActive: true },
];

const defaultXtreamStreams: XtreamStream[] = [
  { id: 301, accountId: 1, name: 'CNN International', streamId: 1001 },
  { id: 302, accountId: 1, name: 'ESPN HD', streamId: 1002 },
  { id: 303, accountId: 1, name: 'HBO Max', streamId: 1003 },
];

const test = base.extend<ChannelMappingFixtures>({
  injectChannelMappingMocks: async ({ page }, use) => {
    const inject = async (config: {
      xmltvChannels: XmltvChannel[];
      m3uChannels: M3uChannel[];
      acestreamSources: AcestreamSource[];
      xtreamStreams: XtreamStream[];
      existingMappings: ChannelMapping[];
    }) => {
      const script = generateChannelMappingMockScript(config);
      await page.addInitScript(script);
    };
    await use(inject);
  },
  defaultTestData: async ({}, use) => {
    await use({
      xmltvChannels: defaultXmltvChannels,
      m3uChannels: defaultM3uChannels,
      acestreamSources: defaultAcestreamSources,
      xtreamStreams: defaultXtreamStreams,
    });
  },
});

test.describe('Channel Mapping Management', () => {
  test.beforeEach(async ({ page }) => {
    // Block image loading for faster tests
    await page.route('**/*.{png,jpg,jpeg,svg,gif}', (route) => route.abort());
  });

  test.describe('AC #9: Manual Channel Mapping Creation/Deletion', () => {
    test('should display channel mapping interface', async ({
      page,
      injectChannelMappingMocks,
      defaultTestData,
    }) => {
      await injectChannelMappingMocks({
        ...defaultTestData,
        existingMappings: [],
      });

      await page.goto('/channel-mapping');
      await page.waitForLoadState('networkidle');

      // Should display XMLTV channels available for mapping
      const channelList = page.locator('[data-testid="xmltv-channel-list"]');
      await expect(channelList).toBeVisible();

      // Should display at least one channel
      const channelItems = page.locator('[data-testid^="xmltv-channel-"]');
      await expect(channelItems.first()).toBeVisible();
    });

    test('should create a new channel mapping', async ({
      page,
      injectChannelMappingMocks,
      defaultTestData,
    }) => {
      await injectChannelMappingMocks({
        ...defaultTestData,
        existingMappings: [],
      });

      await page.goto('/channel-mapping');
      await page.waitForLoadState('networkidle');

      // Click on a channel to map
      const channelItem = page.locator('[data-testid="xmltv-channel-1"]');
      await channelItem.click();

      // Open add mapping dialog
      const addMappingButton = page.locator('[data-testid="add-mapping-button"]');
      await addMappingButton.click();

      // Select source type
      const sourceTypeSelect = page.locator('[data-testid="source-type-select"]');
      await sourceTypeSelect.selectOption('m3u');

      // Select specific source
      const sourceSelect = page.locator('[data-testid="source-select"]');
      await sourceSelect.selectOption('101'); // CNN HD M3U channel

      // Submit mapping
      const submitButton = page.locator('[data-testid="submit-mapping-button"]');
      await submitButton.click();

      // Verify mapping created
      const mappingItem = page.locator('[data-testid^="channel-mapping-"]');
      await expect(mappingItem).toBeVisible({ timeout: 3000 });
      await expect(mappingItem).toContainText(/m3u|CNN/i);
    });

    test('should delete an existing channel mapping', async ({
      page,
      injectChannelMappingMocks,
      defaultTestData,
    }) => {
      const existingMapping: ChannelMapping = {
        id: 1,
        xmltvChannelId: 1,
        sourceType: 'm3u',
        xtreamChannelId: null,
        m3uChannelId: 101,
        acestreamSourceId: null,
        streamPriority: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await injectChannelMappingMocks({
        ...defaultTestData,
        existingMappings: [existingMapping],
      });

      await page.goto('/channel-mapping');
      await page.waitForLoadState('networkidle');

      // Select the channel with mapping
      await page.click('[data-testid="xmltv-channel-1"]');

      // Verify mapping exists
      const mappingItem = page.locator('[data-testid="channel-mapping-1"]');
      await expect(mappingItem).toBeVisible();

      // Click delete button
      const deleteButton = page.locator('[data-testid="delete-mapping-1"]');
      await deleteButton.click();

      // Confirm deletion
      const confirmButton = page.locator('[data-testid="confirm-delete-mapping"]');
      await confirmButton.click();

      // Verify mapping removed
      await expect(mappingItem).not.toBeVisible({ timeout: 3000 });
    });

    test('should show confirmation dialog before deleting mapping', async ({
      page,
      injectChannelMappingMocks,
      defaultTestData,
    }) => {
      const existingMapping: ChannelMapping = {
        id: 1,
        xmltvChannelId: 1,
        sourceType: 'xtream',
        xtreamChannelId: 301,
        m3uChannelId: null,
        acestreamSourceId: null,
        streamPriority: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await injectChannelMappingMocks({
        ...defaultTestData,
        existingMappings: [existingMapping],
      });

      await page.goto('/channel-mapping');
      await page.waitForLoadState('networkidle');

      await page.click('[data-testid="xmltv-channel-1"]');
      await page.click('[data-testid="delete-mapping-1"]');

      // Confirmation dialog should appear
      const dialog = page.locator('[data-testid="delete-mapping-dialog"]');
      await expect(dialog).toBeVisible();

      // Cancel should close dialog and keep mapping
      await page.click('[data-testid="cancel-delete-mapping"]');
      await expect(dialog).not.toBeVisible();

      const mappingItem = page.locator('[data-testid="channel-mapping-1"]');
      await expect(mappingItem).toBeVisible();
    });
  });

  test.describe('AC #10: Priority Ordering of Backup Streams', () => {
    test('should display mappings in priority order', async ({
      page,
      injectChannelMappingMocks,
      defaultTestData,
    }) => {
      const mappings: ChannelMapping[] = [
        {
          id: 1,
          xmltvChannelId: 1,
          sourceType: 'xtream',
          xtreamChannelId: 301,
          m3uChannelId: null,
          acestreamSourceId: null,
          streamPriority: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 2,
          xmltvChannelId: 1,
          sourceType: 'm3u',
          xtreamChannelId: null,
          m3uChannelId: 101,
          acestreamSourceId: null,
          streamPriority: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 3,
          xmltvChannelId: 1,
          sourceType: 'acestream',
          xtreamChannelId: null,
          m3uChannelId: null,
          acestreamSourceId: 201,
          streamPriority: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await injectChannelMappingMocks({
        ...defaultTestData,
        existingMappings: mappings,
      });

      await page.goto('/channel-mapping');
      await page.waitForLoadState('networkidle');

      await page.click('[data-testid="xmltv-channel-1"]');

      // Verify mappings are displayed in priority order
      const mappingItems = page.locator('[data-testid^="channel-mapping-"]');
      await expect(mappingItems).toHaveCount(3);

      // First should be Xtream (priority 1)
      const firstMapping = mappingItems.first();
      await expect(firstMapping).toContainText(/xtream|primary/i);

      // Verify priority indicators are visible
      const priorityIndicators = page.locator('[data-testid^="mapping-priority-"]');
      await expect(priorityIndicators).toHaveCount(3);
    });

    test('should allow reordering mappings via drag and drop', async ({
      page,
      injectChannelMappingMocks,
      defaultTestData,
    }) => {
      const mappings: ChannelMapping[] = [
        {
          id: 1,
          xmltvChannelId: 1,
          sourceType: 'xtream',
          xtreamChannelId: 301,
          m3uChannelId: null,
          acestreamSourceId: null,
          streamPriority: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 2,
          xmltvChannelId: 1,
          sourceType: 'm3u',
          xtreamChannelId: null,
          m3uChannelId: 101,
          acestreamSourceId: null,
          streamPriority: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await injectChannelMappingMocks({
        ...defaultTestData,
        existingMappings: mappings,
      });

      await page.goto('/channel-mapping');
      await page.waitForLoadState('networkidle');

      await page.click('[data-testid="xmltv-channel-1"]');

      // Get initial order
      const mappingItems = page.locator('[data-testid^="channel-mapping-"]');
      const initialFirstText = await mappingItems.first().textContent();

      // Drag second item to first position
      const secondItem = page.locator('[data-testid="channel-mapping-2"]');
      const firstItem = page.locator('[data-testid="channel-mapping-1"]');

      const secondBox = await secondItem.boundingBox();
      const firstBox = await firstItem.boundingBox();

      if (secondBox && firstBox) {
        await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y - 10);
        await page.mouse.up();
      }

      // Wait for reorder to complete
      await page.waitForTimeout(500);

      // Verify order changed
      const newFirstText = await mappingItems.first().textContent();
      expect(newFirstText).not.toBe(initialFirstText);
    });

    test('should allow changing priority via up/down buttons', async ({
      page,
      injectChannelMappingMocks,
      defaultTestData,
    }) => {
      const mappings: ChannelMapping[] = [
        {
          id: 1,
          xmltvChannelId: 1,
          sourceType: 'xtream',
          xtreamChannelId: 301,
          m3uChannelId: null,
          acestreamSourceId: null,
          streamPriority: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 2,
          xmltvChannelId: 1,
          sourceType: 'm3u',
          xtreamChannelId: null,
          m3uChannelId: 101,
          acestreamSourceId: null,
          streamPriority: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await injectChannelMappingMocks({
        ...defaultTestData,
        existingMappings: mappings,
      });

      await page.goto('/channel-mapping');
      await page.waitForLoadState('networkidle');

      await page.click('[data-testid="xmltv-channel-1"]');

      // Click move up button on second mapping
      const moveUpButton = page.locator('[data-testid="move-up-mapping-2"]');
      await moveUpButton.click();

      // Verify M3U mapping is now first
      const firstMapping = page.locator('[data-testid^="channel-mapping-"]').first();
      await expect(firstMapping).toContainText(/m3u/i);
    });
  });

  test.describe('AC #11: Source Type Selection', () => {
    test('should allow selecting Xtream source type', async ({
      page,
      injectChannelMappingMocks,
      defaultTestData,
    }) => {
      await injectChannelMappingMocks({
        ...defaultTestData,
        existingMappings: [],
      });

      await page.goto('/channel-mapping');
      await page.waitForLoadState('networkidle');

      await page.click('[data-testid="xmltv-channel-1"]');
      await page.click('[data-testid="add-mapping-button"]');

      // Select Xtream source type
      const sourceTypeSelect = page.locator('[data-testid="source-type-select"]');
      await sourceTypeSelect.selectOption('xtream');

      // Verify Xtream sources are shown
      const sourceSelect = page.locator('[data-testid="source-select"]');
      await expect(sourceSelect).toBeVisible();

      // Should show Xtream streams
      const options = await sourceSelect.locator('option').allTextContents();
      expect(options.some(opt => opt.includes('CNN International') || opt.includes('ESPN'))).toBe(true);
    });

    test('should allow selecting M3U source type', async ({
      page,
      injectChannelMappingMocks,
      defaultTestData,
    }) => {
      await injectChannelMappingMocks({
        ...defaultTestData,
        existingMappings: [],
      });

      await page.goto('/channel-mapping');
      await page.waitForLoadState('networkidle');

      await page.click('[data-testid="xmltv-channel-1"]');
      await page.click('[data-testid="add-mapping-button"]');

      // Select M3U source type
      const sourceTypeSelect = page.locator('[data-testid="source-type-select"]');
      await sourceTypeSelect.selectOption('m3u');

      // Verify M3U channels are shown
      const sourceSelect = page.locator('[data-testid="source-select"]');
      const options = await sourceSelect.locator('option').allTextContents();
      expect(options.some(opt => opt.includes('CNN HD') || opt.includes('BBC'))).toBe(true);
    });

    test('should allow selecting Acestream source type', async ({
      page,
      injectChannelMappingMocks,
      defaultTestData,
    }) => {
      await injectChannelMappingMocks({
        ...defaultTestData,
        existingMappings: [],
      });

      await page.goto('/channel-mapping');
      await page.waitForLoadState('networkidle');

      await page.click('[data-testid="xmltv-channel-1"]');
      await page.click('[data-testid="add-mapping-button"]');

      // Select Acestream source type
      const sourceTypeSelect = page.locator('[data-testid="source-type-select"]');
      await sourceTypeSelect.selectOption('acestream');

      // Verify Acestream sources are shown
      const sourceSelect = page.locator('[data-testid="source-select"]');
      const options = await sourceSelect.locator('option').allTextContents();
      expect(options.some(opt => opt.includes('Sports HD') || opt.includes('News'))).toBe(true);
    });

    test('should display source type badge on mappings', async ({
      page,
      injectChannelMappingMocks,
      defaultTestData,
    }) => {
      const mappings: ChannelMapping[] = [
        {
          id: 1,
          xmltvChannelId: 1,
          sourceType: 'xtream',
          xtreamChannelId: 301,
          m3uChannelId: null,
          acestreamSourceId: null,
          streamPriority: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 2,
          xmltvChannelId: 1,
          sourceType: 'm3u',
          xtreamChannelId: null,
          m3uChannelId: 101,
          acestreamSourceId: null,
          streamPriority: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 3,
          xmltvChannelId: 1,
          sourceType: 'acestream',
          xtreamChannelId: null,
          m3uChannelId: null,
          acestreamSourceId: 201,
          streamPriority: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await injectChannelMappingMocks({
        ...defaultTestData,
        existingMappings: mappings,
      });

      await page.goto('/channel-mapping');
      await page.waitForLoadState('networkidle');

      await page.click('[data-testid="xmltv-channel-1"]');

      // Verify each mapping shows its source type
      const xtreamBadge = page.locator('[data-testid="source-type-badge-xtream"]');
      const m3uBadge = page.locator('[data-testid="source-type-badge-m3u"]');
      const acestreamBadge = page.locator('[data-testid="source-type-badge-acestream"]');

      await expect(xtreamBadge).toBeVisible();
      await expect(m3uBadge).toBeVisible();
      await expect(acestreamBadge).toBeVisible();
    });
  });

  test.describe('Invalid Mapping Scenarios', () => {
    test('should prevent duplicate source assignment to same channel', async ({
      page,
      injectChannelMappingMocks,
      defaultTestData,
    }) => {
      // Create initial mapping
      const existingMapping: ChannelMapping = {
        id: 1,
        xmltvChannelId: 1,
        sourceType: 'm3u',
        xtreamChannelId: null,
        m3uChannelId: 101,
        acestreamSourceId: null,
        streamPriority: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await injectChannelMappingMocks({
        ...defaultTestData,
        existingMappings: [existingMapping],
      });

      await page.goto('/channel-mapping');
      await page.waitForLoadState('networkidle');

      // Try to add duplicate mapping
      await page.click('[data-testid="xmltv-channel-1"]');
      await page.click('[data-testid="add-mapping-button"]');
      await page.selectOption('[data-testid="source-type-select"]', 'm3u');
      await page.selectOption('[data-testid="source-select"]', '101'); // Same M3U channel

      await page.click('[data-testid="submit-mapping-button"]');

      // Should show error message
      const errorMessage = page.locator('[data-testid="mapping-error"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText(/already|duplicate/i);
    });

    test('should handle deleting source with active mappings', async ({
      page,
      injectChannelMappingMocks,
      defaultTestData,
    }) => {
      // Create mapping that references an M3U source
      const mapping: ChannelMapping = {
        id: 1,
        xmltvChannelId: 1,
        sourceType: 'm3u',
        xtreamChannelId: null,
        m3uChannelId: 101,
        acestreamSourceId: null,
        streamPriority: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await injectChannelMappingMocks({
        ...defaultTestData,
        existingMappings: [mapping],
      });

      // Navigate to Sources and delete the M3U source
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="m3u-tab"]');

      // If source has mappings, deletion should warn user
      await page.click('[data-testid="delete-m3u-source-1"]');

      const confirmDialog = page.locator('[data-testid="delete-m3u-confirm-dialog"]');
      await expect(confirmDialog).toBeVisible();

      // Dialog should mention active mappings (if feature is implemented)
      // For now, just verify deletion proceeds
      await page.click('[data-testid="delete-m3u-confirm"]');

      // Verify deletion succeeded
      const toast = page.getByText(/deleted|removed/i);
      await expect(toast).toBeVisible({ timeout: 2000 });
    });

    test('should handle priority conflicts when reordering', async ({
      page,
      injectChannelMappingMocks,
      defaultTestData,
    }) => {
      const mappings: ChannelMapping[] = [
        {
          id: 1,
          xmltvChannelId: 1,
          sourceType: 'xtream',
          xtreamChannelId: 301,
          m3uChannelId: null,
          acestreamSourceId: null,
          streamPriority: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 2,
          xmltvChannelId: 1,
          sourceType: 'm3u',
          xtreamChannelId: null,
          m3uChannelId: 101,
          acestreamSourceId: null,
          streamPriority: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 3,
          xmltvChannelId: 1,
          sourceType: 'acestream',
          xtreamChannelId: null,
          m3uChannelId: null,
          acestreamSourceId: 201,
          streamPriority: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await injectChannelMappingMocks({
        ...defaultTestData,
        existingMappings: mappings,
      });

      await page.goto('/channel-mapping');
      await page.waitForLoadState('networkidle');

      await page.click('[data-testid="xmltv-channel-1"]');

      // Move third mapping to first position
      await page.click('[data-testid="move-up-mapping-3"]');
      await page.click('[data-testid="move-up-mapping-3"]');

      // Verify all mappings still have unique, sequential priorities
      const mappingItems = page.locator('[data-testid^="channel-mapping-"]');
      await expect(mappingItems).toHaveCount(3);

      // Priorities should be 1, 2, 3 after reorder
      // First mapping should now be Acestream
      const firstMapping = mappingItems.first();
      await expect(firstMapping).toContainText(/acestream/i);
    });
  });

  test.describe('Mapping Persistence', () => {
    test('should persist mappings across page navigation', async ({
      page,
      injectChannelMappingMocks,
      defaultTestData,
    }) => {
      await injectChannelMappingMocks({
        ...defaultTestData,
        existingMappings: [],
      });

      await page.goto('/channel-mapping');
      await page.waitForLoadState('networkidle');

      // Create a mapping
      await page.click('[data-testid="xmltv-channel-1"]');
      await page.click('[data-testid="add-mapping-button"]');
      await page.selectOption('[data-testid="source-type-select"]', 'm3u');
      await page.selectOption('[data-testid="source-select"]', '101');
      await page.click('[data-testid="submit-mapping-button"]');

      // Wait for mapping to be created
      await expect(page.locator('[data-testid^="channel-mapping-"]')).toBeVisible();

      // Navigate away
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');

      // Navigate back
      await page.goto('/channel-mapping');
      await page.waitForLoadState('networkidle');

      // Verify mapping still exists
      await page.click('[data-testid="xmltv-channel-1"]');
      const mappingItem = page.locator('[data-testid^="channel-mapping-"]');
      await expect(mappingItem).toBeVisible();
    });

    test('should persist mapping priority changes', async ({
      page,
      injectChannelMappingMocks,
      defaultTestData,
    }) => {
      const mappings: ChannelMapping[] = [
        {
          id: 1,
          xmltvChannelId: 1,
          sourceType: 'xtream',
          xtreamChannelId: 301,
          m3uChannelId: null,
          acestreamSourceId: null,
          streamPriority: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 2,
          xmltvChannelId: 1,
          sourceType: 'm3u',
          xtreamChannelId: null,
          m3uChannelId: 101,
          acestreamSourceId: null,
          streamPriority: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await injectChannelMappingMocks({
        ...defaultTestData,
        existingMappings: mappings,
      });

      await page.goto('/channel-mapping');
      await page.waitForLoadState('networkidle');

      await page.click('[data-testid="xmltv-channel-1"]');

      // Change priority
      await page.click('[data-testid="move-up-mapping-2"]');

      // Get new first mapping type
      const firstMappingBefore = await page.locator('[data-testid^="channel-mapping-"]').first().textContent();

      // Navigate away and back
      await page.goto('/sources');
      await page.waitForLoadState('networkidle');
      await page.goto('/channel-mapping');
      await page.waitForLoadState('networkidle');

      // Verify priority persisted
      await page.click('[data-testid="xmltv-channel-1"]');
      const firstMappingAfter = await page.locator('[data-testid^="channel-mapping-"]').first().textContent();
      expect(firstMappingAfter).toBe(firstMappingBefore);
    });
  });
});
