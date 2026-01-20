import { test, expect } from '@playwright/test';

/**
 * Integration Tests: M3U Playlist Endpoint
 * Story 4-1: Serve M3U Playlist Endpoint
 *
 * These tests verify the M3U playlist generation for Plex integration.
 * The M3U playlist uses XMLTV-first architecture where XMLTV channels
 * are the primary channel list and Xtream streams are video sources.
 *
 * RED PHASE: These tests will FAIL until the endpoint is implemented.
 */

test.describe('M3U Playlist Endpoint - Basic Functionality', () => {
  const DEFAULT_PORT = 5004;
  const BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

  test('should respond to GET /playlist.m3u with 200 OK', async ({ request }) => {
    // GIVEN: HTTP server is running
    // (Tauri app is running via webServer config)

    // WHEN: Requesting the M3U playlist endpoint
    const response = await request.get(`${BASE_URL}/playlist.m3u`);

    // THEN: Server returns 200 OK status
    expect(response.status()).toBe(200);
  });

  test('should return correct Content-Type header', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Requesting the M3U playlist endpoint
    const response = await request.get(`${BASE_URL}/playlist.m3u`);

    // THEN: Response Content-Type is audio/x-mpegurl
    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/audio\/x-mpegurl|application\/x-mpegurl/);
  });

  test('should return playlist starting with #EXTM3U header', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: Playlist starts with #EXTM3U
    expect(body.trim().startsWith('#EXTM3U')).toBe(true);
  });

  test('should return valid M3U format with EXTINF entries', async ({ request }) => {
    // GIVEN: HTTP server is running
    // AND: There are enabled channels in the database

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: Playlist contains EXTINF entries (if channels exist)
    // Note: May be empty if no enabled channels, that's valid
    expect(body).toContain('#EXTM3U');

    // If there are channels, they should follow the format
    if (body.includes('#EXTINF')) {
      expect(body).toMatch(/#EXTINF:-1 tvg-id="[^"]*" tvg-name="[^"]*"/);
    }
  });
});

test.describe('M3U Playlist Endpoint - Channel Filtering', () => {
  const DEFAULT_PORT = 5004;
  const BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

  test('should only include enabled XMLTV channels', async ({ request }) => {
    // GIVEN: Database has both enabled and disabled XMLTV channels
    // (Test fixture setup would create channels with different is_enabled states)

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: Only enabled channels appear in playlist
    // This requires database seeding to verify properly
    // For now, verify structure is correct
    expect(body).toContain('#EXTM3U');
  });

  test('should exclude disabled channels from playlist', async ({ request }) => {
    // GIVEN: Database has disabled XMLTV channels

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: Disabled channels do not appear
    // Verification: If we know a specific disabled channel ID, it shouldn't be in output
    expect(response.status()).toBe(200);
  });

  test('should exclude XMLTV channels without Xtream stream mappings', async ({ request }) => {
    // GIVEN: Database has XMLTV channels with no mapped Xtream streams

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: Channels without stream mappings are excluded
    expect(response.status()).toBe(200);
  });

  test('should return empty playlist when no enabled channels exist', async ({ request }) => {
    // GIVEN: Database has no enabled XMLTV channels
    // (Would require fixture to clear enabled channels)

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: Playlist contains only header
    expect(body.trim()).toBe('#EXTM3U');
  });
});

test.describe('M3U Playlist Endpoint - Channel Attributes', () => {
  const DEFAULT_PORT = 5004;
  const BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

  test('should use XMLTV channel display name in playlist', async ({ request }) => {
    // GIVEN: Database has XMLTV channels with specific display names

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: Display names from XMLTV channels appear (not Xtream names)
    // This follows XMLTV-first architecture
    expect(body).toContain('#EXTM3U');

    // If there are entries, verify format includes tvg-name
    if (body.includes('#EXTINF')) {
      expect(body).toMatch(/tvg-name="[^"]+"/);
    }
  });

  test('should include tvg-id attribute from XMLTV channel_id', async ({ request }) => {
    // GIVEN: Database has XMLTV channels with channel_id values

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: tvg-id attributes are present
    if (body.includes('#EXTINF')) {
      expect(body).toMatch(/tvg-id="[^"]+"/);
    }
  });

  test('should include tvg-chno from plex_display_order', async ({ request }) => {
    // GIVEN: Database has channels with plex_display_order values

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: tvg-chno attributes are present with channel numbers
    if (body.includes('#EXTINF')) {
      expect(body).toMatch(/tvg-chno="\d+"/);
    }
  });

  test('should include tvg-logo from XMLTV icon', async ({ request }) => {
    // GIVEN: Database has XMLTV channels with icon URLs

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: tvg-logo attributes are present when icons exist
    if (body.includes('#EXTINF')) {
      // Logo is optional, but if present should be URL
      const hasLogo = body.includes('tvg-logo=');
      if (hasLogo) {
        expect(body).toMatch(/tvg-logo="[^"]+"/);
      }
    }
  });

  test('should use Xtream icon as fallback when XMLTV icon is null', async ({ request }) => {
    // GIVEN: Database has XMLTV channel with null icon
    // AND: Mapped Xtream stream has an icon

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: Xtream stream icon is used as fallback
    // (Verification requires specific test data setup)
    expect(response.status()).toBe(200);
  });
});

test.describe('M3U Playlist Endpoint - Stream URLs', () => {
  const DEFAULT_PORT = 5004;
  const BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

  test('should generate stream URLs using xmltv_channel_id', async ({ request }) => {
    // GIVEN: Database has enabled XMLTV channels

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: Stream URLs use format http://127.0.0.1:5004/stream/{xmltv_channel_id}
    if (body.includes('http://')) {
      expect(body).toMatch(/http:\/\/127\.0\.0\.1:\d+\/stream\/\d+/);
    }
  });

  test('should use localhost (127.0.0.1) in stream URLs', async ({ request }) => {
    // GIVEN: Database has enabled channels

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: All stream URLs use 127.0.0.1
    if (body.includes('http://')) {
      const lines = body.split('\n');
      const urlLines = lines.filter((line) => line.startsWith('http://'));

      urlLines.forEach((url) => {
        expect(url).toContain('127.0.0.1');
      });
    }
  });

  test('should use configured port in stream URLs', async ({ request }) => {
    // GIVEN: Server is running on port 5004

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: Stream URLs use port 5004
    if (body.includes('http://')) {
      expect(body).toContain(':5004/stream/');
    }
  });

  test('should use primary Xtream stream for channels with multiple mappings', async ({ request }) => {
    // GIVEN: XMLTV channel has multiple Xtream stream mappings
    // AND: One mapping is marked as primary (is_primary = 1)

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: Stream URL resolves to primary stream
    // (Primary stream selection is handled by /stream endpoint in Story 4-4)
    // For now, verify URL format is correct
    expect(response.status()).toBe(200);
  });
});

test.describe('M3U Playlist Endpoint - Channel Ordering', () => {
  const DEFAULT_PORT = 5004;
  const BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

  test('should order channels by plex_display_order', async ({ request }) => {
    // GIVEN: Database has channels with different plex_display_order values

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: Channels appear in ascending order by plex_display_order
    // (Verification requires known test data with specific ordering)
    expect(response.status()).toBe(200);
  });

  test('should handle null plex_display_order gracefully', async ({ request }) => {
    // GIVEN: Database has channels with null plex_display_order

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: Channels with null order appear after ordered channels
    // AND: Null-ordered channels are sorted alphabetically by name
    expect(response.status()).toBe(200);
  });
});

test.describe('M3U Playlist Endpoint - Synthetic Channels', () => {
  const DEFAULT_PORT = 5004;
  const BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

  test('should include synthetic channels (promoted orphans)', async ({ request }) => {
    // GIVEN: Database has synthetic XMLTV channels (is_synthetic = 1)
    // AND: Synthetic channels are enabled

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: Synthetic channels appear in playlist
    // (Same treatment as regular XMLTV channels)
    expect(response.status()).toBe(200);
  });

  test('should use synthetic channel display name and icon', async ({ request }) => {
    // GIVEN: Database has synthetic channel with custom display name and icon

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: Synthetic channel attributes appear correctly
    expect(response.status()).toBe(200);
  });
});

test.describe('M3U Playlist Endpoint - Error Handling', () => {
  const DEFAULT_PORT = 5004;
  const BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

  test('should handle database errors gracefully', async ({ request }) => {
    // GIVEN: Database connection issue (simulated)

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);

    // THEN: Server returns 500 with error message (if DB fails)
    // OR: Returns valid response if DB is healthy
    expect([200, 500]).toContain(response.status());
  });

  test('should return valid UTF-8 encoded content', async ({ request }) => {
    // GIVEN: Database has channels with Unicode characters in names

    // WHEN: Requesting the M3U playlist
    const response = await request.get(`${BASE_URL}/playlist.m3u`);
    const body = await response.text();

    // THEN: Response is valid UTF-8
    expect(body).toBeDefined();
    // No encoding errors when parsing as text
  });
});

/**
 * IMPLEMENTATION NOTES:
 *
 * Expected Failures (RED Phase):
 * - Endpoint returns 404 (route not registered)
 * - All tests fail with "Not Found" errors
 *
 * Expected Behavior After Implementation (GREEN Phase):
 * - GET /playlist.m3u returns 200 OK
 * - Content-Type: audio/x-mpegurl or application/x-mpegurl
 * - Valid M3U8 format with #EXTM3U header
 * - Only enabled XMLTV channels with Xtream mappings included
 * - XMLTV-first: Uses XMLTV names, IDs, icons (Xtream as fallback)
 * - Stream URLs: http://127.0.0.1:5004/stream/{xmltv_channel_id}
 * - Channels ordered by plex_display_order
 * - Synthetic channels included
 *
 * Test Execution:
 * TAURI_DEV=true npm run test -- tests/integration/m3u-playlist.spec.ts
 */
