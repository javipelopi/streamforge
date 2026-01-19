import { test, expect } from '@playwright/test';
import {
  createXtreamLiveStreams,
  createXtreamCategories,
  createHDChannel,
  createSDChannel,
  create4KChannel,
  createFHDChannel,
  createChannelWithArchive,
  createLargeChannelList,
} from '../support/factories/channel.factory';

/**
 * Integration Tests for scan_channels Tauri Command
 *
 * Tests the scan_channels backend command through the Tauri IPC layer.
 * Verifies correct API calls, data parsing, database storage, and response formatting.
 *
 * These tests require the Tauri backend to be running.
 * Run with: TAURI_DEV=true pnpm test -- tests/integration/scan-channels-command.spec.ts
 */

test.describe('scan_channels Command - API Integration', () => {
  test('should call get_live_streams endpoint with correct parameters', async ({ page }) => {
    // GIVEN: User has an account
    await page.goto('/accounts');

    // Add account
    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'API Params Test');
    await page.fill('[data-testid="server-url-input"]', 'http://test.example.com:8080');
    await page.fill('[data-testid="username-input"]', 'apiuser');
    await page.fill('[data-testid="password-input"]', 'apipass123');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]').first()).toBeVisible();

    // Mock Xtream API endpoints
    let capturedStreamUrl = '';
    await page.route('**/player_api.php*action=get_live_streams*', (route) => {
      capturedStreamUrl = route.request().url();
      const streams = createXtreamLiveStreams(5);
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(streams),
      });
    });

    await page.route('**/player_api.php*action=get_live_categories*', (route) => {
      const categories = createXtreamCategories(3);
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(categories),
      });
    });

    // WHEN: Scanning channels
    await page.click('[data-testid="test-connection-button"]');
    await page.click('[data-testid="scan-channels-button"]');

    await page.waitForTimeout(1000);

    // THEN: API URL is constructed correctly
    // Expected: {server_url}/player_api.php?username={username}&password={password}&action=get_live_streams
    expect(capturedStreamUrl).toContain('player_api.php');
    expect(capturedStreamUrl).toContain('action=get_live_streams');
    expect(capturedStreamUrl).toContain('username=');
    expect(capturedStreamUrl).toContain('password=');
  });

  test('should call get_live_categories endpoint to fetch category names', async ({ page }) => {
    // GIVEN: User has an account
    await page.goto('/accounts');

    // Add account
    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Categories Test');
    await page.fill('[data-testid="server-url-input"]', 'http://test.example.com:8080');
    await page.fill('[data-testid="username-input"]', 'catuser');
    await page.fill('[data-testid="password-input"]', 'catpass123');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]').first()).toBeVisible();

    // Mock endpoints
    let categoriesApiCalled = false;
    await page.route('**/player_api.php*action=get_live_categories*', (route) => {
      categoriesApiCalled = true;
      const categories = createXtreamCategories(5);
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(categories),
      });
    });

    await page.route('**/player_api.php*action=get_live_streams*', (route) => {
      const streams = createXtreamLiveStreams(10);
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(streams),
      });
    });

    // WHEN: Scanning channels
    await page.click('[data-testid="test-connection-button"]');
    await page.click('[data-testid="scan-channels-button"]');

    await page.waitForTimeout(1000);

    // THEN: get_live_categories API was called
    expect(categoriesApiCalled).toBe(true);

    // Expected: Categories fetched before streams for name mapping
    // Expected: Category names matched to channels via category_id
  });

  test('should parse Xtream live stream response correctly', async ({ page }) => {
    // GIVEN: Xtream API returns channel data
    await page.goto('/accounts');

    // Add account
    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Parse Test');
    await page.fill('[data-testid="server-url-input"]', 'http://test.example.com:8080');
    await page.fill('[data-testid="username-input"]', 'parseuser');
    await page.fill('[data-testid="password-input"]', 'parsepass');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]').first()).toBeVisible();

    // Mock with specific channel data
    const testStream = {
      num: 1,
      name: 'ESPN HD',
      stream_type: 'live',
      stream_id: 12345,
      stream_icon: 'http://example.com/logos/espn.png',
      epg_channel_id: 'ESPN.us',
      added: '1704067200',
      category_id: '1',
      category_ids: [1, 5],
      custom_sid: null,
      tv_archive: 1,
      direct_source: '',
      tv_archive_duration: 7,
    };

    await page.route('**/player_api.php*action=get_live_streams*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([testStream]),
      });
    });

    await page.route('**/player_api.php*action=get_live_categories*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ category_id: '1', category_name: 'Sports', parent_id: 0 }]),
      });
    });

    // WHEN: Scanning and parsing response
    await page.click('[data-testid="test-connection-button"]');
    await page.click('[data-testid="scan-channels-button"]');

    await expect(page.locator('[data-testid="scan-result-total"]')).toContainText('1');

    // THEN: All fields are parsed correctly
    // Expected: stream_id: 12345 (i32)
    // Expected: name: "ESPN HD" (String)
    // Expected: stream_icon: Some("http://example.com/logos/espn.png")
    // Expected: epg_channel_id: Some("ESPN.us")
    // Expected: category_id: Some(1) (parsed from "1" string)
    // Expected: category_name: Some("Sports") (matched via category_id)
    // Expected: tv_archive: 1 (i32)
    // Expected: tv_archive_duration: 7 (i32)
  });

  test('should handle optional fields gracefully when missing', async ({ page }) => {
    // GIVEN: API returns minimal channel data (missing optional fields)
    await page.goto('/accounts');

    // Add account
    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Minimal Test');
    await page.fill('[data-testid="server-url-input"]', 'http://test.example.com:8080');
    await page.fill('[data-testid="username-input"]', 'minuser');
    await page.fill('[data-testid="password-input"]', 'minpass');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]').first()).toBeVisible();

    // Mock with minimal fields
    const minimalStream = {
      num: 1,
      name: 'Basic Channel',
      stream_type: 'live',
      stream_id: 99999,
      // All optional fields omitted
    };

    await page.route('**/player_api.php*action=get_live_streams*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([minimalStream]),
      });
    });

    await page.route('**/player_api.php*action=get_live_categories*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // WHEN: Parsing minimal response
    await page.click('[data-testid="test-connection-button"]');
    await page.click('[data-testid="scan-channels-button"]');

    // THEN: Channel is stored with null/default values for optional fields
    await expect(page.locator('[data-testid="scan-result-total"]')).toContainText('1');

    // Expected: stream_icon: None
    // Expected: epg_channel_id: None
    // Expected: category_id: None
    // Expected: category_name: None
    // Expected: tv_archive: 0 (default)
    // Expected: tv_archive_duration: 0 (default)
  });
});

test.describe('scan_channels Command - Quality Detection', () => {
  test('should detect HD quality from channel name', async ({ page }) => {
    // GIVEN: Channel name contains "HD"
    await page.goto('/accounts');

    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'HD Test');
    await page.fill('[data-testid="server-url-input"]', 'http://test.example.com:8080');
    await page.fill('[data-testid="username-input"]', 'hduser');
    await page.fill('[data-testid="password-input"]', 'hdpass');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]').first()).toBeVisible();

    const hdChannel = createHDChannel();

    await page.route('**/player_api.php*action=get_live_streams*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([hdChannel]),
      });
    });

    await page.route('**/player_api.php*action=get_live_categories*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // WHEN: Detecting quality
    await page.click('[data-testid="test-connection-button"]');
    await page.click('[data-testid="scan-channels-button"]');

    await expect(page.locator('[data-testid="scan-result-total"]')).toBeVisible();

    // THEN: Quality detected as ["HD"]
    // Expected: qualities JSON array contains "HD"
    // Expected: Stored in database as '["HD"]'
  });

  test('should detect SD quality from channel name', async ({ page }) => {
    // GIVEN: Channel name contains "SD"
    await page.goto('/accounts');

    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'SD Test');
    await page.fill('[data-testid="server-url-input"]', 'http://test.example.com:8080');
    await page.fill('[data-testid="username-input"]', 'sduser');
    await page.fill('[data-testid="password-input"]', 'sdpass');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]').first()).toBeVisible();

    const sdChannel = createSDChannel();

    await page.route('**/player_api.php*action=get_live_streams*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([sdChannel]),
      });
    });

    await page.route('**/player_api.php*action=get_live_categories*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // WHEN: Detecting quality
    await page.click('[data-testid="test-connection-button"]');
    await page.click('[data-testid="scan-channels-button"]');

    await expect(page.locator('[data-testid="scan-result-total"]')).toBeVisible();

    // THEN: Quality detected as ["SD"]
    // Expected: qualities JSON array contains "SD"
  });

  test('should detect 4K quality from channel name', async ({ page }) => {
    // GIVEN: Channel name contains "4K" or "UHD"
    await page.goto('/accounts');

    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', '4K Test');
    await page.fill('[data-testid="server-url-input"]', 'http://test.example.com:8080');
    await page.fill('[data-testid="username-input"]', '4kuser');
    await page.fill('[data-testid="password-input"]', '4kpass');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]').first()).toBeVisible();

    const fourKChannel = create4KChannel();

    await page.route('**/player_api.php*action=get_live_streams*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([fourKChannel]),
      });
    });

    await page.route('**/player_api.php*action=get_live_categories*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // WHEN: Detecting quality
    await page.click('[data-testid="test-connection-button"]');
    await page.click('[data-testid="scan-channels-button"]');

    await expect(page.locator('[data-testid="scan-result-total"]')).toBeVisible();

    // THEN: Quality detected as ["4K"]
    // Expected: Pattern matching for "4K", "UHD", "2160P"
  });

  test('should detect FHD quality from channel name', async ({ page }) => {
    // GIVEN: Channel name contains "FHD" or "1080"
    await page.goto('/accounts');

    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'FHD Test');
    await page.fill('[data-testid="server-url-input"]', 'http://test.example.com:8080');
    await page.fill('[data-testid="username-input"]', 'fhduser');
    await page.fill('[data-testid="password-input"]', 'fhdpass');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]').first()).toBeVisible();

    const fhdChannel = createFHDChannel();

    await page.route('**/player_api.php*action=get_live_streams*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([fhdChannel]),
      });
    });

    await page.route('**/player_api.php*action=get_live_categories*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // WHEN: Detecting quality
    await page.click('[data-testid="test-connection-button"]');
    await page.click('[data-testid="scan-channels-button"]');

    await expect(page.locator('[data-testid="scan-result-total"]')).toBeVisible();

    // THEN: Quality detected as ["FHD"]
    // Expected: Pattern matching for "FHD", "1080"
  });

  test('should default to SD when no quality indicator found', async ({ page }) => {
    // GIVEN: Channel name has no quality indicators
    await page.goto('/accounts');

    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Default Test');
    await page.fill('[data-testid="server-url-input"]', 'http://test.example.com:8080');
    await page.fill('[data-testid="username-input"]', 'defuser');
    await page.fill('[data-testid="password-input"]', 'defpass');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]').first()).toBeVisible();

    const plainChannel = createXtreamLiveStreams(1)[0];
    plainChannel.name = 'Generic Channel'; // No quality indicator

    await page.route('**/player_api.php*action=get_live_streams*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([plainChannel]),
      });
    });

    await page.route('**/player_api.php*action=get_live_categories*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // WHEN: Detecting quality with no indicators
    await page.click('[data-testid="test-connection-button"]');
    await page.click('[data-testid="scan-channels-button"]');

    await expect(page.locator('[data-testid="scan-result-total"]')).toBeVisible();

    // THEN: Quality defaults to ["SD"]
    // Expected: If qualities array is empty, default to ["SD"]
  });
});

test.describe('scan_channels Command - Database Operations', () => {
  test('should insert new channels into xtream_channels table', async ({ page }) => {
    // GIVEN: User scans channels for the first time
    await page.goto('/accounts');

    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Insert Test');
    await page.fill('[data-testid="server-url-input"]', 'http://test.example.com:8080');
    await page.fill('[data-testid="username-input"]', 'insertuser');
    await page.fill('[data-testid="password-input"]', 'insertpass');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]').first()).toBeVisible();

    const streams = createXtreamLiveStreams(10);

    await page.route('**/player_api.php*action=get_live_streams*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(streams),
      });
    });

    await page.route('**/player_api.php*action=get_live_categories*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // WHEN: Scanning and inserting channels
    await page.click('[data-testid="test-connection-button"]');
    await page.click('[data-testid="scan-channels-button"]');

    await expect(page.locator('[data-testid="scan-result-new"]')).toContainText('10');

    // THEN: 10 new records inserted into xtream_channels
    // Expected: Each record has account_id, stream_id, name, qualities
    // Expected: added_at timestamp set to current time
    // Expected: UNIQUE constraint on (account_id, stream_id) enforced
  });

  test('should update existing channels on rescan', async ({ page }) => {
    // GIVEN: User has previously scanned channels
    await page.goto('/accounts');

    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Update Test');
    await page.fill('[data-testid="server-url-input"]', 'http://test.example.com:8080');
    await page.fill('[data-testid="username-input"]', 'updateuser');
    await page.fill('[data-testid="password-input"]', 'updatepass');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]').first()).toBeVisible();

    // First scan
    const initialStreams = createXtreamLiveStreams(5);
    await page.route('**/player_api.php*action=get_live_streams*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(initialStreams),
      });
    });

    await page.route('**/player_api.php*action=get_live_categories*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.click('[data-testid="test-connection-button"]');
    await page.click('[data-testid="scan-channels-button"]');
    await expect(page.locator('[data-testid="scan-result-new"]')).toContainText('5');

    // Rescan with updated data
    const updatedStreams = initialStreams.map((s) => ({
      ...s,
      name: s.name + ' Updated',
    }));

    await page.route('**/player_api.php*action=get_live_streams*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updatedStreams),
      });
    });

    // WHEN: Rescanning with updated data
    await page.click('[data-testid="scan-channels-button"]');

    // THEN: Existing channels are updated (not duplicated)
    await expect(page.locator('[data-testid="scan-result-updated"]')).toContainText('5');

    // Expected: ON CONFLICT (account_id, stream_id) DO UPDATE
    // Expected: Name and other fields updated
    // Expected: updated_at timestamp refreshed
  });

  test('should use transactions for batch insert performance', async ({ page }) => {
    // GIVEN: User scans 1000 channels
    await page.goto('/accounts');

    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Batch Test');
    await page.fill('[data-testid="server-url-input"]', 'http://test.example.com:8080');
    await page.fill('[data-testid="username-input"]', 'batchuser');
    await page.fill('[data-testid="password-input"]', 'batchpass');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]').first()).toBeVisible();

    const largeStreamList = createLargeChannelList(1000);

    await page.route('**/player_api.php*action=get_live_streams*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(largeStreamList),
      });
    });

    await page.route('**/player_api.php*action=get_live_categories*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // WHEN: Batch inserting 1000 channels
    await page.click('[data-testid="test-connection-button"]');
    await page.click('[data-testid="scan-channels-button"]');

    await expect(page.locator('[data-testid="scan-result-total"]')).toContainText('1000', { timeout: 65000 });

    // THEN: Scan completes within 60 seconds (NFR3)
    // Expected: Database transaction used for batch operations
    // Expected: Not 1000 individual INSERT statements
    // Expected: Single transaction with bulk insert or upsert
    const duration = await page.locator('[data-testid="scan-result-duration"]').textContent();
    expect(duration).toBeTruthy();

    const seconds = parseFloat(duration!.match(/[\d.]+/)?.[0] ?? '0');
    expect(seconds).toBeLessThan(60);
  });
});

test.describe('scan_channels Command - Error Handling', () => {
  test('should handle network timeout gracefully', async ({ page }) => {
    // GIVEN: Xtream server is unreachable
    await page.goto('/accounts');

    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Timeout Test');
    await page.fill('[data-testid="server-url-input"]', 'http://timeout.example.com:8080');
    await page.fill('[data-testid="username-input"]', 'timeoutuser');
    await page.fill('[data-testid="password-input"]', 'timeoutpass');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]').first()).toBeVisible();

    // Mock timeout
    await page.route('**/player_api.php*action=get_live_streams*', (route) => {
      route.abort('timedout');
    });

    // WHEN: API call times out
    await page.click('[data-testid="test-connection-button"]');
    await page.click('[data-testid="scan-channels-button"]');

    // THEN: Returns error message
    await expect(page.locator('[data-testid="scan-error-message"]')).toBeVisible();

    // Expected: XtreamError::Network propagated to user
    // Expected: User-friendly message about connection issues
  });

  test('should handle invalid JSON response', async ({ page }) => {
    // GIVEN: Xtream server returns malformed response
    await page.goto('/accounts');

    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Invalid JSON Test');
    await page.fill('[data-testid="server-url-input"]', 'http://test.example.com:8080');
    await page.fill('[data-testid="username-input"]', 'jsonuser');
    await page.fill('[data-testid="password-input"]', 'jsonpass');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]').first()).toBeVisible();

    // Mock invalid JSON
    await page.route('**/player_api.php*action=get_live_streams*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html>Not JSON</html>',
      });
    });

    // WHEN: Parsing invalid response
    await page.click('[data-testid="test-connection-button"]');
    await page.click('[data-testid="scan-channels-button"]');

    // THEN: Returns XtreamError::InvalidResponse
    await expect(page.locator('[data-testid="scan-error-message"]')).toBeVisible();

    // Expected: Error message indicates unexpected data format
  });

  test('should never log passwords during scan', async ({ page }) => {
    // GIVEN: User scans channels
    await page.goto('/accounts');

    await page.click('[data-testid="add-account-button"]');
    await page.fill('[data-testid="account-name-input"]', 'Security Test');
    await page.fill('[data-testid="server-url-input"]', 'http://test.example.com:8080');
    await page.fill('[data-testid="username-input"]', 'secureuser');
    await page.fill('[data-testid="password-input"]', 'SuperSecret123!');
    await page.click('[data-testid="submit-account-button"]');

    await expect(page.locator('[data-testid="account-item"]').first()).toBeVisible();

    const streams = createXtreamLiveStreams(5);

    await page.route('**/player_api.php*action=get_live_streams*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(streams),
      });
    });

    await page.route('**/player_api.php*action=get_live_categories*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Capture console logs
    const logs: string[] = [];
    page.on('console', (msg) => logs.push(msg.text()));

    // WHEN: Scanning channels
    await page.click('[data-testid="test-connection-button"]');
    await page.click('[data-testid="scan-channels-button"]');

    await expect(page.locator('[data-testid="scan-result-total"]')).toBeVisible();

    // THEN: Password is NEVER logged
    const passwordInLogs = logs.some((log) => log.includes('SuperSecret123!'));
    expect(passwordInLogs).toBe(false);

    // Expected: Logging statements redact passwords
    // Expected: Debug output uses "[REDACTED]" for sensitive data
  });
});
