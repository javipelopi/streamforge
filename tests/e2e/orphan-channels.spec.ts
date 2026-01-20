import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Story 3.8: Manage Orphan Xtream Channels
 *
 * Tests the user journey of:
 * 1. Viewing Xtream streams that don't match any XMLTV channel
 * 2. Promoting orphan streams to synthetic XMLTV channels
 * 3. Seeing synthetic badge and editing synthetic channels
 *
 * ATDD Pattern: RED Phase - These tests MUST fail initially
 */

// Mock orphan stream data
interface MockOrphanStream {
  id: number;
  streamId: number;
  name: string;
  streamIcon: string | null;
  qualities: string[];
  categoryName: string | null;
}

interface MockXmltvChannel {
  id: number;
  sourceId: number;
  channelId: string;
  displayName: string;
  icon: string | null;
  isSynthetic: boolean;
  isEnabled: boolean;
  plexDisplayOrder: number | null;
  matchCount: number;
  matches: Array<{
    id: number;
    mappingId: number;
    name: string;
    streamIcon: string | null;
    qualities: string[];
    matchConfidence: number;
    isPrimary: boolean;
    isManual: boolean;
    streamPriority: number;
    isOrphaned: boolean;
  }>;
}

/**
 * Create mock orphan stream data
 */
function createMockOrphanStreams(count: number = 3): MockOrphanStream[] {
  return Array.from({ length: count }, (_, i) => ({
    id: 100 + i,
    streamId: 1000 + i,
    name: `Orphan Channel ${i + 1}`,
    streamIcon: i % 2 === 0 ? `https://example.com/icon${i}.png` : null,
    qualities: i % 3 === 0 ? ['HD', 'SD'] : ['HD'],
    categoryName: i % 2 === 0 ? 'Entertainment' : 'Sports',
  }));
}

/**
 * Create mock XMLTV channel (regular or synthetic)
 */
function createMockXmltvChannel(overrides: Partial<MockXmltvChannel> = {}): MockXmltvChannel {
  const id = overrides.id ?? 1;
  return {
    id,
    sourceId: overrides.isSynthetic ? -1 : 1,
    channelId: overrides.isSynthetic ? `synthetic-${id}` : `xmltv-${id}`,
    displayName: overrides.displayName ?? 'Test Channel',
    icon: overrides.icon ?? null,
    isSynthetic: overrides.isSynthetic ?? false,
    isEnabled: overrides.isEnabled ?? false,
    plexDisplayOrder: overrides.plexDisplayOrder ?? null,
    matchCount: overrides.matchCount ?? 1,
    matches: overrides.matches ?? [
      {
        id: 200 + id,
        mappingId: 300 + id,
        name: `Stream for ${overrides.displayName ?? 'Test Channel'}`,
        streamIcon: null,
        qualities: ['HD'],
        matchConfidence: 1.0,
        isPrimary: true,
        isManual: true,
        streamPriority: 0,
        isOrphaned: false,
      },
    ],
  };
}

/**
 * Inject Tauri mock with orphan channel management commands
 */
async function injectOrphanChannelMocks(
  page: Page,
  orphanStreams: MockOrphanStream[],
  xmltvChannels: MockXmltvChannel[] = []
): Promise<void> {
  const mockScript = `
    (function() {
      // State storage
      window.__ORPHAN_STATE__ = {
        orphanStreams: ${JSON.stringify(orphanStreams)},
        xmltvChannels: ${JSON.stringify(xmltvChannels)},
        nextChannelId: 1000,
      };

      const mockCommands = {
        // Existing commands that may be needed
        greet: (args) => \`Hello, \${args.name}! Welcome to StreamForge.\`,
        get_setting: () => null,
        set_setting: () => undefined,
        get_server_port: () => 5004,
        set_server_port: () => undefined,
        get_autostart_enabled: () => ({ enabled: false }),
        set_autostart_enabled: () => undefined,
        get_accounts: () => [],

        // Get XMLTV channels with mappings
        get_xmltv_channels_with_mappings: () => {
          console.log('[Mock] get_xmltv_channels_with_mappings called');
          // Return a new array to ensure TanStack Query detects changes
          return [...window.__ORPHAN_STATE__.xmltvChannels];
        },

        // Story 3-8: Get orphan Xtream streams
        get_orphan_xtream_streams: () => {
          console.log('[Mock] get_orphan_xtream_streams called');
          return window.__ORPHAN_STATE__.orphanStreams;
        },

        // Story 3-8: Promote orphan to Plex
        promote_orphan_to_plex: (args) => {
          console.log('[Mock] promote_orphan_to_plex:', args);
          const { xtreamChannelId, displayName, iconUrl } = args;

          // Find the orphan stream
          const streamIndex = window.__ORPHAN_STATE__.orphanStreams.findIndex(
            s => s.id === xtreamChannelId
          );

          if (streamIndex === -1) {
            throw new Error('Orphan stream not found');
          }

          const stream = window.__ORPHAN_STATE__.orphanStreams[streamIndex];

          // Remove from orphan list
          window.__ORPHAN_STATE__.orphanStreams.splice(streamIndex, 1);

          // Create synthetic channel
          const newChannelId = window.__ORPHAN_STATE__.nextChannelId++;
          const newChannel = {
            id: newChannelId,
            sourceId: -1,
            channelId: \`synthetic-\${xtreamChannelId}\`,
            displayName: displayName,
            icon: iconUrl,
            isSynthetic: true,
            isEnabled: false,
            plexDisplayOrder: null,
            matchCount: 1,
            matches: [{
              id: stream.id,
              mappingId: 400 + newChannelId,
              name: stream.name,
              streamIcon: stream.streamIcon,
              qualities: stream.qualities,
              matchConfidence: 1.0,
              isPrimary: true,
              isManual: true,
              streamPriority: 0,
              isOrphaned: false,
            }],
          };

          // Add to channels list
          window.__ORPHAN_STATE__.xmltvChannels.push(newChannel);

          return newChannel;
        },

        // Story 3-8: Update synthetic channel
        update_synthetic_channel: (args) => {
          console.log('[Mock] update_synthetic_channel:', args);
          const { channelId, displayName, iconUrl } = args;

          const channel = window.__ORPHAN_STATE__.xmltvChannels.find(
            ch => ch.id === channelId
          );

          if (!channel) {
            throw new Error('Channel not found');
          }

          if (!channel.isSynthetic) {
            throw new Error('Cannot edit non-synthetic channel');
          }

          channel.displayName = displayName;
          channel.icon = iconUrl;

          return channel;
        },

        // Toggle channel enabled status
        toggle_xmltv_channel: (args) => {
          console.log('[Mock] toggle_xmltv_channel:', args);
          const channel = window.__ORPHAN_STATE__.xmltvChannels.find(
            ch => ch.id === args.channelId
          );

          if (channel) {
            channel.isEnabled = !channel.isEnabled;
          }

          return channel;
        },

        // Set primary stream
        set_primary_stream: (args) => {
          console.log('[Mock] set_primary_stream:', args);
          const { xmltvChannelId } = args;
          const channel = window.__ORPHAN_STATE__.xmltvChannels.find(
            ch => ch.id === xmltvChannelId
          );
          return channel ? channel.matches : [];
        },

        // Bulk toggle channels
        bulk_toggle_channels: (args) => {
          console.log('[Mock] bulk_toggle_channels:', args);
          return { successCount: args.channelIds.length, skippedCount: 0, skippedIds: [] };
        },

        // Update channel order
        update_channel_order: () => {
          console.log('[Mock] update_channel_order');
          return undefined;
        },

        // Manual stream mapping commands
        add_manual_stream_mapping: (args) => {
          console.log('[Mock] add_manual_stream_mapping:', args);
          return [];
        },

        remove_stream_mapping: (args) => {
          console.log('[Mock] remove_stream_mapping:', args);
          return [];
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

      // Set up Tauri V2 internals mock
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

      window.__TAURI__ = {
        invoke: mockInvoke,
      };

      window.__TAURI_MOCK__ = {
        invoke: mockInvoke,
        commands: mockCommands,
        getState: () => window.__ORPHAN_STATE__,
      };

      console.log('[Tauri Mock] Orphan channels mock initialized');
    })();
  `;

  await page.addInitScript(mockScript);
}

test.describe('Manage Orphan Xtream Channels (Story 3-8)', () => {
  test.beforeEach(async ({ page }) => {
    // Block image loading for faster tests
    await page.route('**/*.{png,jpg,jpeg,svg,gif}', (route) => route.abort());
  });

  test.describe('AC #1: Display Unmatched Xtream Streams Section', () => {
    test('should show orphan streams section with count badge', async ({ page }) => {
      // GIVEN: Orphan Xtream streams exist
      const orphanStreams = createMockOrphanStreams(3);
      await injectOrphanChannelMocks(page, orphanStreams);

      // WHEN: Navigate to Channels view
      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');

      // THEN: Orphan section is visible with count
      const orphanSection = page.locator('[data-testid="orphan-xtream-section"]');
      await expect(orphanSection).toBeVisible();
      await expect(orphanSection).toContainText('3');
    });

    test('should display each orphan stream with name, icon, and category', async ({ page }) => {
      // GIVEN: Orphan streams with various data
      const orphanStreams = createMockOrphanStreams(2);
      await injectOrphanChannelMocks(page, orphanStreams);

      // WHEN: Navigate to Channels view
      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');

      // THEN: Each orphan stream is displayed with its info
      const stream1 = page.locator('[data-testid="orphan-stream-100"]');
      await expect(stream1).toBeVisible();
      await expect(stream1).toContainText('Orphan Channel 1');

      const stream2 = page.locator('[data-testid="orphan-stream-101"]');
      await expect(stream2).toBeVisible();
      await expect(stream2).toContainText('Orphan Channel 2');
    });

    test('should show "Promote to Plex" button for each orphan stream', async ({ page }) => {
      // GIVEN: Orphan streams exist
      const orphanStreams = createMockOrphanStreams(2);
      await injectOrphanChannelMocks(page, orphanStreams);

      // WHEN: Navigate to Channels view
      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');

      // THEN: Each stream has a Promote button
      await expect(page.locator('[data-testid="promote-button-100"]')).toBeVisible();
      await expect(page.locator('[data-testid="promote-button-101"]')).toBeVisible();
    });

    test('should hide orphan section when no orphan streams exist', async ({ page }) => {
      // GIVEN: No orphan streams
      await injectOrphanChannelMocks(page, []);

      // WHEN: Navigate to Channels view
      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');

      // THEN: Orphan section is not visible
      await expect(page.locator('[data-testid="orphan-xtream-section"]')).not.toBeVisible();
    });

    test('should show quality tier badges for orphan streams', async ({ page }) => {
      // GIVEN: Orphan stream with multiple qualities
      const orphanStreams = [
        {
          id: 100,
          streamId: 1000,
          name: 'HBO Max HD',
          streamIcon: 'https://example.com/icon.png',
          qualities: ['HD', 'FHD'],
          categoryName: 'Movies',
        },
      ];
      await injectOrphanChannelMocks(page, orphanStreams);

      // WHEN: Navigate to Channels view
      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');

      // THEN: Quality badges are displayed
      const orphanSection = page.locator('[data-testid="orphan-xtream-section"]');
      await expect(orphanSection.getByText('HD').first()).toBeVisible();
      await expect(orphanSection.getByText('FHD')).toBeVisible();
    });

    test('should show category name for orphan streams', async ({ page }) => {
      // GIVEN: Orphan stream with category
      const orphanStreams = [
        {
          id: 100,
          streamId: 1000,
          name: 'ESPN HD',
          streamIcon: null,
          qualities: ['HD'],
          categoryName: 'Sports',
        },
      ];
      await injectOrphanChannelMocks(page, orphanStreams);

      // WHEN: Navigate to Channels view
      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');

      // THEN: Category name is displayed within the orphan section
      const orphanSection = page.locator('[data-testid="orphan-xtream-section"]');
      await expect(orphanSection.getByText('Sports', { exact: true })).toBeVisible();
    });
  });

  test.describe('AC #2: Promote to Plex Dialog', () => {
    test('should open promote dialog when clicking promote button', async ({ page }) => {
      // GIVEN: Orphan streams exist
      const orphanStreams = createMockOrphanStreams(1);
      await injectOrphanChannelMocks(page, orphanStreams);

      // WHEN: Navigate and click Promote
      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="promote-button-100"]');

      // THEN: Dialog opens with pre-filled name
      const dialog = page.locator('[data-testid="promote-dialog"]');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('[data-testid="display-name-input"]')).toHaveValue('Orphan Channel 1');
    });

    test('should pre-fill icon URL from Xtream icon if available', async ({ page }) => {
      // GIVEN: Orphan stream with icon URL
      const orphanStreams = [
        {
          id: 100,
          streamId: 1000,
          name: 'HBO Max HD',
          streamIcon: 'https://example.com/hbo.png',
          qualities: ['HD'],
          categoryName: 'Movies',
        },
      ];
      await injectOrphanChannelMocks(page, orphanStreams);

      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');

      // WHEN: User opens promote dialog
      await page.click('[data-testid="promote-button-100"]');

      // THEN: Icon URL field is pre-filled with Xtream icon
      const iconUrlInput = page.locator('[data-testid="icon-url-input"]');
      await expect(iconUrlInput).toHaveValue('https://example.com/hbo.png');
    });

    test('should allow editing display name before promotion', async ({ page }) => {
      // GIVEN: Orphan stream and open dialog
      const orphanStreams = createMockOrphanStreams(1);
      await injectOrphanChannelMocks(page, orphanStreams);

      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="promote-button-100"]');

      // WHEN: Edit the display name
      const nameInput = page.locator('[data-testid="display-name-input"]');
      await nameInput.fill('My Custom Channel Name');

      // THEN: Input value is updated
      await expect(nameInput).toHaveValue('My Custom Channel Name');
    });

    test('should allow editing icon URL before promotion', async ({ page }) => {
      // GIVEN: Orphan stream and open dialog
      const orphanStreams = createMockOrphanStreams(1);
      await injectOrphanChannelMocks(page, orphanStreams);

      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="promote-button-100"]');

      // WHEN: Edit the icon URL
      const iconInput = page.locator('[data-testid="icon-url-input"]');
      await iconInput.fill('https://example.com/custom-icon.png');

      // THEN: Input value is updated
      await expect(iconInput).toHaveValue('https://example.com/custom-icon.png');
    });

    test('should close dialog on cancel', async ({ page }) => {
      // GIVEN: Open promote dialog
      const orphanStreams = createMockOrphanStreams(1);
      await injectOrphanChannelMocks(page, orphanStreams);

      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="promote-button-100"]');
      await expect(page.locator('[data-testid="promote-dialog"]')).toBeVisible();

      // WHEN: Click cancel
      await page.click('[data-testid="cancel-button"]');

      // THEN: Dialog closes
      await expect(page.locator('[data-testid="promote-dialog"]')).not.toBeVisible();
    });
  });

  test.describe('AC #3: Synthetic Channel Creation', () => {
    test('should create synthetic channel when confirming promotion', async ({ page }) => {
      // GIVEN: Orphan stream
      const orphanStreams = createMockOrphanStreams(1);
      await injectOrphanChannelMocks(page, orphanStreams);

      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');

      // WHEN: Promote the stream
      await page.click('[data-testid="promote-button-100"]');
      await page.click('[data-testid="confirm-promote-button"]');

      // THEN: Orphan stream is removed from orphan list
      await expect(page.locator('[data-testid="orphan-stream-100"]')).not.toBeVisible();
    });

    test('should show synthetic channel in channels list after promotion', async ({ page }) => {
      // GIVEN: Orphan stream
      const orphanStreams = createMockOrphanStreams(1);
      await injectOrphanChannelMocks(page, orphanStreams);

      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');

      // WHEN: Promote with custom name
      await page.click('[data-testid="promote-button-100"]');
      await page.locator('[data-testid="display-name-input"]').fill('My Promoted Channel');
      await page.click('[data-testid="confirm-promote-button"]');

      // Wait for dialog to close and success toast to appear (indicates mutation completed)
      await expect(page.getByText(/promoted successfully/i)).toBeVisible({ timeout: 5000 });

      // THEN: Channel appears in list with synthetic badge (query should have refetched)
      // Wait for the "No XMLTV channels" message to disappear, indicating channels have loaded
      await expect(page.getByText('No XMLTV channels found')).not.toBeVisible({ timeout: 10000 });

      // Now check for the promoted channel
      await expect(page.locator('[data-testid="xmltv-channels-list"]')).toContainText(
        'My Promoted Channel'
      );
    });

    test('should display success message after promotion', async ({ page }) => {
      // GIVEN: Orphan stream
      const orphanStreams = createMockOrphanStreams(1);
      await injectOrphanChannelMocks(page, orphanStreams);

      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');

      // Verify orphan section is visible (ensures mock is working)
      await expect(page.locator('[data-testid="orphan-xtream-section"]')).toBeVisible({ timeout: 5000 });

      // WHEN: Promote the stream
      await page.click('[data-testid="promote-button-100"]');
      await expect(page.locator('[data-testid="promote-dialog"]')).toBeVisible();
      await page.click('[data-testid="confirm-promote-button"]');

      // Wait for dialog to close (mutation started)
      await expect(page.locator('[data-testid="promote-dialog"]')).not.toBeVisible({ timeout: 5000 });

      // THEN: Success message is displayed
      await expect(page.getByText(/promoted successfully/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('AC #4: Placeholder EPG', () => {
    test('should display info about placeholder EPG in promote dialog', async ({ page }) => {
      // GIVEN: Orphan stream and open dialog
      const orphanStreams = createMockOrphanStreams(1);
      await injectOrphanChannelMocks(page, orphanStreams);

      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="promote-button-100"]');

      // THEN: Dialog shows info about placeholder EPG
      const dialog = page.locator('[data-testid="promote-dialog"]');
      await expect(dialog).toContainText('Placeholder EPG');
      await expect(dialog).toContainText('7 days');
      await expect(dialog).toContainText('Live Programming');
    });
  });

  test.describe('AC #5: Synthetic Channel Badge and Edit', () => {
    test('should display "Synthetic" badge on synthetic channels', async ({ page }) => {
      // GIVEN: A synthetic channel exists
      const syntheticChannel = createMockXmltvChannel({
        id: 1,
        displayName: 'Synthetic Test Channel',
        isSynthetic: true,
      });
      await injectOrphanChannelMocks(page, [], [syntheticChannel]);

      // WHEN: Navigate to Channels view
      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');

      // THEN: Synthetic badge is visible
      await expect(page.locator('[data-testid="synthetic-badge-1"]')).toBeVisible();
      await expect(page.locator('[data-testid="synthetic-badge-1"]')).toHaveText('Synthetic');
    });

    test('should not display "Synthetic" badge on regular channels', async ({ page }) => {
      // GIVEN: A regular (non-synthetic) channel exists
      const regularChannel = createMockXmltvChannel({
        id: 1,
        displayName: 'Regular Channel',
        isSynthetic: false,
      });
      await injectOrphanChannelMocks(page, [], [regularChannel]);

      // WHEN: Navigate to Channels view
      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');

      // THEN: No synthetic badge
      await expect(page.locator('[data-testid="synthetic-badge-1"]')).not.toBeVisible();
    });

    test('should show edit button for synthetic channels', async ({ page }) => {
      // GIVEN: A synthetic channel exists
      const syntheticChannel = createMockXmltvChannel({
        id: 1,
        displayName: 'Synthetic Test Channel',
        isSynthetic: true,
      });
      await injectOrphanChannelMocks(page, [], [syntheticChannel]);

      // WHEN: Navigate to Channels view
      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');

      // THEN: Edit button is visible for synthetic channel
      await expect(page.locator('[data-testid="edit-synthetic-button-1"]')).toBeVisible();
    });

    test('should open edit dialog when clicking edit button', async ({ page }) => {
      // GIVEN: A synthetic channel exists
      const syntheticChannel = createMockXmltvChannel({
        id: 1,
        displayName: 'Synthetic Test Channel',
        isSynthetic: true,
        icon: 'https://example.com/icon.png',
      });
      await injectOrphanChannelMocks(page, [], [syntheticChannel]);

      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');

      // WHEN: Click edit button
      await page.click('[data-testid="edit-synthetic-button-1"]');

      // THEN: Edit dialog opens with current values
      const dialog = page.locator('[data-testid="edit-synthetic-dialog"]');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('[data-testid="display-name-input"]')).toHaveValue('Synthetic Test Channel');
    });

    test('should update synthetic channel on save', async ({ page }) => {
      // GIVEN: A synthetic channel and open edit dialog
      const syntheticChannel = createMockXmltvChannel({
        id: 1,
        displayName: 'Original Name',
        isSynthetic: true,
      });
      await injectOrphanChannelMocks(page, [], [syntheticChannel]);

      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="edit-synthetic-button-1"]');

      // WHEN: Edit and save
      await page.locator('[data-testid="display-name-input"]').fill('Updated Name');
      await page.click('[data-testid="save-edit-button"]');

      // THEN: Dialog closes and channel is updated
      await expect(page.locator('[data-testid="edit-synthetic-dialog"]')).not.toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible orphan section with proper ARIA', async ({ page }) => {
      // GIVEN: Orphan streams exist
      const orphanStreams = createMockOrphanStreams(2);
      await injectOrphanChannelMocks(page, orphanStreams);

      // WHEN: Navigate to Channels view
      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');

      // THEN: Section is accessible
      const section = page.locator('[data-testid="orphan-xtream-section"]');
      const expandButton = section.locator('button[aria-expanded]');
      await expect(expandButton).toHaveAttribute('aria-expanded', 'true');
      await expect(expandButton).toHaveAttribute('aria-controls', 'orphan-streams-content');
    });

    test('should close dialog on Escape key', async ({ page }) => {
      // GIVEN: Open promote dialog
      const orphanStreams = createMockOrphanStreams(1);
      await injectOrphanChannelMocks(page, orphanStreams);

      await page.goto('/');
      await page.click('a[href="/channels"]');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="promote-button-100"]');
      await expect(page.locator('[data-testid="promote-dialog"]')).toBeVisible();

      // WHEN: Press Escape
      await page.keyboard.press('Escape');

      // THEN: Dialog closes
      await expect(page.locator('[data-testid="promote-dialog"]')).not.toBeVisible();
    });
  });
});
