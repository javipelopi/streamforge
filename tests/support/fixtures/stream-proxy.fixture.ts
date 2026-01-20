import { test as base, APIRequestContext } from '@playwright/test';

/**
 * Stream Proxy Test Fixture (Story 4-4)
 *
 * Provides test data seeding for stream proxy integration tests.
 * Seeds the database with:
 * - XMLTV channels (enabled and disabled)
 * - Xtream accounts (active and inactive)
 * - Xtream channels with various qualities
 * - Channel mappings (XMLTV → Xtream)
 * - XMLTV channel settings (enabled/disabled)
 *
 * IMPORTANT: These tests require the Tauri app to be running with TAURI_DEV=true
 * The fixture seeds data via Tauri invoke commands.
 */

const DEFAULT_PORT = 5004;
const BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

/**
 * Test channel IDs used in stream-proxy.spec.ts
 *
 * These IDs must match the expectations in the test file.
 * The tests assume specific channels exist with specific configurations:
 *
 * Channel 1: Valid enabled channel with primary mapping (expect 200)
 * Channel 2: Disabled channel (expect 404)
 * Channel 3: Enabled channel without primary mapping (expect 404)
 * Channel 4: Channel with 4K quality available
 * Channel 5: Channel with HD only (no 4K)
 * Channel 6: Channel with SD only
 * Channel 7: Channel with no quality info (null qualities)
 * Channel 8: Channel with FHD quality
 * Channel 9: Channel mapped to unreachable Xtream server (expect 503)
 * Channel 10: Channel with inactive account (expect 503)
 * Channel 11: Channel with multiple mappings, one primary
 * Channel 12: Channel with primary + failover mappings
 * Channel 13: Channel with special characters in credentials
 * Channel 14: Channel with HTTP Xtream server
 * Channel 15: Channel with HTTPS Xtream server
 * Channel 16: Channel for AES decryption fallback test
 */

interface StreamProxyTestData {
  /**
   * Seeds the database with test data for stream proxy tests.
   * Must be called before running stream tests.
   */
  seedStreamProxyData: () => Promise<void>;

  /**
   * Cleans up test data after tests complete.
   */
  cleanupStreamProxyData: () => Promise<void>;

  /**
   * Waits for the HTTP server to be ready.
   */
  waitForServer: (request: APIRequestContext) => Promise<void>;
}

/**
 * SQL statements to seed test data
 *
 * Since we can't directly execute SQL from Playwright, we need to use
 * Tauri commands or a test-specific endpoint. For now, we'll document
 * the expected data structure and note that tests require manual setup
 * or a test mode that pre-seeds this data.
 */
const TEST_DATA_SQL = `
-- Account 1: Active account with max_connections = 2
INSERT OR REPLACE INTO accounts (id, name, server_url, username, password_encrypted, max_connections, is_active, created_at, updated_at)
VALUES (1, 'Test IPTV Provider', 'http://test-xtream.local:8080', 'testuser', X'0102030405', 2, 1, datetime('now'), datetime('now'));

-- Account 2: Inactive account for testing 503 on inactive
INSERT OR REPLACE INTO accounts (id, name, server_url, username, password_encrypted, max_connections, is_active, created_at, updated_at)
VALUES (2, 'Inactive Provider', 'http://inactive.local:8080', 'inactive', X'0102030405', 1, 0, datetime('now'), datetime('now'));

-- Account 3: Account with unreachable server
INSERT OR REPLACE INTO accounts (id, name, server_url, username, password_encrypted, max_connections, is_active, created_at, updated_at)
VALUES (3, 'Unreachable Provider', 'http://192.0.2.1:9999', 'noreachuser', X'0102030405', 1, 1, datetime('now'), datetime('now'));

-- XMLTV Source
INSERT OR REPLACE INTO xmltv_sources (id, name, url, format, is_active, last_refresh, refresh_interval_hours, created_at, updated_at)
VALUES (1, 'Test EPG Source', 'http://test-epg.local/epg.xml', 'xmltv', 1, datetime('now'), 24, datetime('now'), datetime('now'));

-- XMLTV Channels (1-16 as used in tests)
INSERT OR REPLACE INTO xmltv_channels (id, xmltv_source_id, channel_id, display_name, icon, is_synthetic, created_at)
VALUES
  (1, 1, 'test.channel.1', 'Test Channel 1', 'http://icons.local/ch1.png', 0, datetime('now')),
  (2, 1, 'test.channel.2', 'Test Channel 2 (Disabled)', 'http://icons.local/ch2.png', 0, datetime('now')),
  (3, 1, 'test.channel.3', 'Test Channel 3 (No Mapping)', 'http://icons.local/ch3.png', 0, datetime('now')),
  (4, 1, 'test.channel.4', 'Test Channel 4K', 'http://icons.local/ch4.png', 0, datetime('now')),
  (5, 1, 'test.channel.5', 'Test Channel HD', 'http://icons.local/ch5.png', 0, datetime('now')),
  (6, 1, 'test.channel.6', 'Test Channel SD', 'http://icons.local/ch6.png', 0, datetime('now')),
  (7, 1, 'test.channel.7', 'Test Channel NoQuality', 'http://icons.local/ch7.png', 0, datetime('now')),
  (8, 1, 'test.channel.8', 'Test Channel FHD', 'http://icons.local/ch8.png', 0, datetime('now')),
  (9, 1, 'test.channel.9', 'Test Channel Unreachable', 'http://icons.local/ch9.png', 0, datetime('now')),
  (10, 1, 'test.channel.10', 'Test Channel Inactive Account', 'http://icons.local/ch10.png', 0, datetime('now')),
  (11, 1, 'test.channel.11', 'Test Channel Multi-Mapping', 'http://icons.local/ch11.png', 0, datetime('now')),
  (12, 1, 'test.channel.12', 'Test Channel Primary+Failover', 'http://icons.local/ch12.png', 0, datetime('now')),
  (13, 1, 'test.channel.13', 'Test Channel Special Chars', 'http://icons.local/ch13.png', 0, datetime('now')),
  (14, 1, 'test.channel.14', 'Test Channel HTTP', 'http://icons.local/ch14.png', 0, datetime('now')),
  (15, 1, 'test.channel.15', 'Test Channel HTTPS', 'http://icons.local/ch15.png', 0, datetime('now')),
  (16, 1, 'test.channel.16', 'Test Channel AES Fallback', 'http://icons.local/ch16.png', 0, datetime('now'));

-- XMLTV Channel Settings (is_enabled controls which channels appear in lineup)
INSERT OR REPLACE INTO xmltv_channel_settings (xmltv_channel_id, is_enabled, plex_display_order, created_at, updated_at)
VALUES
  (1, 1, 1, datetime('now'), datetime('now')),   -- Enabled
  (2, 0, 2, datetime('now'), datetime('now')),   -- Disabled
  (3, 1, 3, datetime('now'), datetime('now')),   -- Enabled but no primary mapping
  (4, 1, 4, datetime('now'), datetime('now')),   -- Enabled 4K
  (5, 1, 5, datetime('now'), datetime('now')),   -- Enabled HD
  (6, 1, 6, datetime('now'), datetime('now')),   -- Enabled SD
  (7, 1, 7, datetime('now'), datetime('now')),   -- Enabled NoQuality
  (8, 1, 8, datetime('now'), datetime('now')),   -- Enabled FHD
  (9, 1, 9, datetime('now'), datetime('now')),   -- Enabled Unreachable
  (10, 1, 10, datetime('now'), datetime('now')), -- Enabled Inactive
  (11, 1, 11, datetime('now'), datetime('now')), -- Enabled Multi
  (12, 1, 12, datetime('now'), datetime('now')), -- Enabled Failover
  (13, 1, 13, datetime('now'), datetime('now')), -- Enabled Special
  (14, 1, 14, datetime('now'), datetime('now')), -- Enabled HTTP
  (15, 1, 15, datetime('now'), datetime('now')), -- Enabled HTTPS
  (16, 1, 16, datetime('now'), datetime('now')); -- Enabled AES

-- Xtream Channels (stream sources)
INSERT OR REPLACE INTO xtream_channels (id, account_id, stream_id, name, stream_icon, qualities, category_id, created_at, updated_at)
VALUES
  (1001, 1, 1001, 'Xtream Ch1', 'http://icons.local/x1.png', '["4K","HD","SD"]', 1, datetime('now'), datetime('now')),
  (1004, 1, 1004, 'Xtream Ch4 4K', 'http://icons.local/x4.png', '["4K","FHD","HD","SD"]', 1, datetime('now'), datetime('now')),
  (1005, 1, 1005, 'Xtream Ch5 HD', 'http://icons.local/x5.png', '["HD","SD"]', 1, datetime('now'), datetime('now')),
  (1006, 1, 1006, 'Xtream Ch6 SD', 'http://icons.local/x6.png', '["SD"]', 1, datetime('now'), datetime('now')),
  (1007, 1, 1007, 'Xtream Ch7 NoQ', 'http://icons.local/x7.png', NULL, 1, datetime('now'), datetime('now')),
  (1008, 1, 1008, 'Xtream Ch8 FHD', 'http://icons.local/x8.png', '["FHD","HD","SD"]', 1, datetime('now'), datetime('now')),
  (1009, 3, 1009, 'Xtream Ch9 Unreachable', 'http://icons.local/x9.png', '["HD"]', 1, datetime('now'), datetime('now')),
  (1010, 2, 1010, 'Xtream Ch10 Inactive', 'http://icons.local/x10.png', '["HD"]', 1, datetime('now'), datetime('now')),
  (1011, 1, 1011, 'Xtream Ch11 Primary', 'http://icons.local/x11.png', '["4K"]', 1, datetime('now'), datetime('now')),
  (1012, 1, 1012, 'Xtream Ch11 Alt', 'http://icons.local/x12.png', '["HD"]', 1, datetime('now'), datetime('now')),
  (1013, 1, 1013, 'Xtream Ch12 Primary', 'http://icons.local/x13.png', '["4K"]', 1, datetime('now'), datetime('now')),
  (1014, 1, 1014, 'Xtream Ch12 Failover', 'http://icons.local/x14.png', '["HD"]', 1, datetime('now'), datetime('now')),
  (1015, 1, 1015, 'Xtream Ch13 Special', 'http://icons.local/x15.png', '["HD"]', 1, datetime('now'), datetime('now')),
  (1016, 1, 1016, 'Xtream Ch14 HTTP', 'http://icons.local/x16.png', '["HD"]', 1, datetime('now'), datetime('now')),
  (1017, 1, 1017, 'Xtream Ch15 HTTPS', 'http://icons.local/x17.png', '["HD"]', 1, datetime('now'), datetime('now')),
  (1018, 1, 1018, 'Xtream Ch16 AES', 'http://icons.local/x18.png', '["HD"]', 1, datetime('now'), datetime('now'));

-- Channel Mappings (XMLTV → Xtream with primary flag)
INSERT OR REPLACE INTO channel_mappings (id, xmltv_channel_id, xtream_channel_id, match_confidence, is_manual, is_primary, stream_priority, created_at, updated_at)
VALUES
  (1, 1, 1001, 0.95, 0, 1, 0, datetime('now'), datetime('now')),   -- Ch1 → Xtream primary
  -- Ch2 is disabled, no mapping needed for test
  -- Ch3 has NO primary mapping (is_primary = 0 only)
  (3, 3, 1001, 0.85, 0, 0, 1, datetime('now'), datetime('now')),   -- Ch3 → Xtream non-primary
  (4, 4, 1004, 0.98, 0, 1, 0, datetime('now'), datetime('now')),   -- Ch4 → 4K stream
  (5, 5, 1005, 0.97, 0, 1, 0, datetime('now'), datetime('now')),   -- Ch5 → HD stream
  (6, 6, 1006, 0.96, 0, 1, 0, datetime('now'), datetime('now')),   -- Ch6 → SD stream
  (7, 7, 1007, 0.95, 0, 1, 0, datetime('now'), datetime('now')),   -- Ch7 → NoQ stream
  (8, 8, 1008, 0.94, 0, 1, 0, datetime('now'), datetime('now')),   -- Ch8 → FHD stream
  (9, 9, 1009, 0.93, 0, 1, 0, datetime('now'), datetime('now')),   -- Ch9 → Unreachable
  (10, 10, 1010, 0.92, 0, 1, 0, datetime('now'), datetime('now')), -- Ch10 → Inactive account
  (11, 11, 1011, 0.99, 0, 1, 0, datetime('now'), datetime('now')), -- Ch11 → Primary mapping
  (12, 11, 1012, 0.88, 0, 0, 1, datetime('now'), datetime('now')), -- Ch11 → Alt mapping
  (13, 12, 1013, 0.99, 0, 1, 0, datetime('now'), datetime('now')), -- Ch12 → Primary
  (14, 12, 1014, 0.85, 0, 0, 1, datetime('now'), datetime('now')), -- Ch12 → Failover
  (15, 13, 1015, 0.95, 0, 1, 0, datetime('now'), datetime('now')), -- Ch13 → Special chars
  (16, 14, 1016, 0.95, 0, 1, 0, datetime('now'), datetime('now')), -- Ch14 → HTTP
  (17, 15, 1017, 0.95, 0, 1, 0, datetime('now'), datetime('now')), -- Ch15 → HTTPS
  (18, 16, 1018, 0.95, 0, 1, 0, datetime('now'), datetime('now')); -- Ch16 → AES test
`;

export const test = base.extend<StreamProxyTestData>({
  seedStreamProxyData: async ({}, use) => {
    const seedFn = async (): Promise<void> => {
      // NOTE: In a production test setup, this would:
      // 1. Use a Tauri test command to seed data, OR
      // 2. Connect directly to the SQLite database, OR
      // 3. Use a test-mode flag that auto-seeds on startup
      //
      // For now, this fixture documents what data is expected.
      // The actual seeding must be done manually or via a setup script.
      //
      // To run tests with seeded data:
      // 1. Start the app in test mode: IPTV_TEST_MODE=1 pnpm dev
      // 2. Manually insert the test data via sqlite3 CLI
      // 3. Or implement a /test/seed endpoint (only in dev builds)
      console.log('[StreamProxy Fixture] Test data seeding not yet implemented');
      console.log('[StreamProxy Fixture] Expected SQL:', TEST_DATA_SQL.slice(0, 500) + '...');
    };

    await use(seedFn);
  },

  cleanupStreamProxyData: async ({}, use) => {
    const cleanupFn = async (): Promise<void> => {
      // Cleanup would delete test data created by seedStreamProxyData
      console.log('[StreamProxy Fixture] Test data cleanup not yet implemented');
    };

    await use(cleanupFn);
  },

  waitForServer: async ({}, use) => {
    const waitFn = async (request: APIRequestContext): Promise<void> => {
      const maxRetries = 30;
      const retryDelay = 1000;

      for (let i = 0; i < maxRetries; i++) {
        try {
          const response = await request.get(`${BASE_URL}/health`);
          if (response.ok()) {
            return;
          }
        } catch {
          // Server not ready yet
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }

      throw new Error('Server did not become ready within timeout');
    };

    await use(waitFn);
  },
});

export { expect } from '@playwright/test';

/**
 * IMPLEMENTATION NOTES:
 *
 * The stream-proxy integration tests require actual database records to test against.
 * This fixture provides the test data schema but does not yet implement actual seeding.
 *
 * To make tests pass, one of the following approaches is needed:
 *
 * 1. **Test Mode with Auto-Seeding:**
 *    Add a Rust function that seeds test data when IPTV_TEST_MODE=1 is set.
 *    This would run on app startup and insert the test records.
 *
 * 2. **Test Endpoint:**
 *    Add a POST /test/seed endpoint (only compiled in debug/test builds)
 *    that inserts the test data via API call.
 *
 * 3. **Database Access from Tests:**
 *    Install better-sqlite3 in the test project and directly write to
 *    the SQLite database from Playwright tests.
 *
 * 4. **Tauri Commands:**
 *    Add Tauri test commands (only in test builds) to create test data.
 *
 * The recommended approach is #1 or #2 for CI/CD compatibility.
 */
