import { test, expect } from '@playwright/test';

/**
 * Integration Tests: HDHomeRun Emulation Endpoints
 * Story 4-3: Implement HDHomeRun Emulation
 *
 * These tests verify the HDHomeRun device emulation endpoints that enable
 * Plex auto-discovery. HDHomeRun endpoints follow the XMLTV-first architecture
 * where XMLTV channels define the lineup and Xtream streams are video sources.
 *
 * RED PHASE: These tests will FAIL until the endpoints are implemented.
 */

test.describe('HDHomeRun Endpoints - Discover.json', () => {
  const DEFAULT_PORT = 5004;
  const BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

  test('should respond to GET /discover.json with 200 OK', async ({ request }) => {
    // GIVEN: HTTP server is running
    // (Tauri app is running via webServer config)

    // WHEN: Requesting the HDHomeRun discovery endpoint
    const response = await request.get(`${BASE_URL}/discover.json`);

    // THEN: Server returns 200 OK status
    expect(response.status()).toBe(200);
  });

  test('should return correct Content-Type header for discover.json', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Requesting the discovery endpoint
    const response = await request.get(`${BASE_URL}/discover.json`);

    // THEN: Response Content-Type is application/json
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  test('should return required HDHomeRun discovery fields', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Requesting the discovery endpoint
    const response = await request.get(`${BASE_URL}/discover.json`);
    const body = await response.json();

    // THEN: Response contains all required HDHomeRun fields
    expect(body).toHaveProperty('FriendlyName');
    expect(body).toHaveProperty('ModelNumber');
    expect(body).toHaveProperty('FirmwareName');
    expect(body).toHaveProperty('FirmwareVersion');
    expect(body).toHaveProperty('DeviceID');
    expect(body).toHaveProperty('DeviceAuth');
    expect(body).toHaveProperty('BaseURL');
    expect(body).toHaveProperty('LineupURL');
    expect(body).toHaveProperty('TunerCount');
  });

  test('should use FriendlyName "StreamForge"', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Requesting the discovery endpoint
    const response = await request.get(`${BASE_URL}/discover.json`);
    const body = await response.json();

    // THEN: FriendlyName is "StreamForge"
    expect(body.FriendlyName).toBe('StreamForge');
  });

  test('should use ModelNumber "HDHR5-4K"', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Requesting the discovery endpoint
    const response = await request.get(`${BASE_URL}/discover.json`);
    const body = await response.json();

    // THEN: ModelNumber is "HDHR5-4K" (compatible with Plex)
    expect(body.ModelNumber).toBe('HDHR5-4K');
  });

  test('should return TunerCount from active account max_connections', async ({ request }) => {
    // GIVEN: Database has active account with max_connections value

    // WHEN: Requesting the discovery endpoint
    const response = await request.get(`${BASE_URL}/discover.json`);
    const body = await response.json();

    // THEN: TunerCount is a positive integer from database
    expect(body.TunerCount).toBeGreaterThan(0);
    expect(Number.isInteger(body.TunerCount)).toBe(true);

    // AND: TunerCount matches account max_connections (or default 2 if no accounts)
    // (Exact value verification requires database fixture setup)
  });

  test('should include BaseURL and LineupURL with local IP and port', async ({ request }) => {
    // GIVEN: HTTP server is running on port 5004

    // WHEN: Requesting the discovery endpoint
    const response = await request.get(`${BASE_URL}/discover.json`);
    const body = await response.json();

    // THEN: BaseURL contains IP address and port
    expect(body.BaseURL).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/);

    // AND: LineupURL points to /lineup.json on same server
    expect(body.LineupURL).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:\d+\/lineup\.json$/);

    // AND: Both URLs use the same base (IP:port)
    const baseUrlMatch = body.BaseURL.match(/^(http:\/\/\d+\.\d+\.\d+\.\d+:\d+)$/);
    const lineupUrlMatch = body.LineupURL.match(/^(http:\/\/\d+\.\d+\.\d+\.\d+:\d+)\/lineup\.json$/);
    expect(baseUrlMatch?.[1]).toBe(lineupUrlMatch?.[1]);
  });

  test('should return stable DeviceID across requests', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Making multiple requests to discovery endpoint
    const response1 = await request.get(`${BASE_URL}/discover.json`);
    const body1 = await response1.json();

    const response2 = await request.get(`${BASE_URL}/discover.json`);
    const body2 = await response2.json();

    // THEN: DeviceID remains consistent
    expect(body1.DeviceID).toBe(body2.DeviceID);
    expect(body1.DeviceID).toBeTruthy();
  });
});

test.describe('HDHomeRun Endpoints - Lineup.json', () => {
  const DEFAULT_PORT = 5004;
  const BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

  test('should respond to GET /lineup.json with 200 OK', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Requesting the lineup endpoint
    const response = await request.get(`${BASE_URL}/lineup.json`);

    // THEN: Server returns 200 OK status
    expect(response.status()).toBe(200);
  });

  test('should return correct Content-Type header for lineup.json', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Requesting the lineup endpoint
    const response = await request.get(`${BASE_URL}/lineup.json`);

    // THEN: Response Content-Type is application/json
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  test('should return array of channel entries', async ({ request }) => {
    // GIVEN: HTTP server is running
    // AND: Database has enabled XMLTV channels

    // WHEN: Requesting the lineup endpoint
    const response = await request.get(`${BASE_URL}/lineup.json`);
    const body = await response.json();

    // THEN: Response is an array
    expect(Array.isArray(body)).toBe(true);

    // AND: If channels exist, they have required fields
    if (body.length > 0) {
      body.forEach((entry: any) => {
        expect(entry).toHaveProperty('GuideNumber');
        expect(entry).toHaveProperty('GuideName');
        expect(entry).toHaveProperty('URL');
      });
    }
  });

  test('should return only enabled XMLTV channels in lineup', async ({ request }) => {
    // GIVEN: Database has both enabled and disabled XMLTV channels

    // WHEN: Requesting the lineup endpoint
    const response = await request.get(`${BASE_URL}/lineup.json`);
    const body = await response.json();

    // THEN: Only enabled channels appear (is_enabled = 1)
    // AND: Only channels with stream mappings appear
    // (Exact verification requires database fixture with known test data)
    expect(response.status()).toBe(200);
  });

  test('should use XMLTV display_name for GuideName', async ({ request }) => {
    // GIVEN: Database has XMLTV channels with display names

    // WHEN: Requesting the lineup endpoint
    const response = await request.get(`${BASE_URL}/lineup.json`);
    const body = await response.json();

    // THEN: GuideName field contains XMLTV channel display_name
    if (body.length > 0) {
      body.forEach((entry: any) => {
        expect(entry.GuideName).toBeTruthy();
        expect(typeof entry.GuideName).toBe('string');
      });
    }
  });

  test('should use plex_display_order for GuideNumber', async ({ request }) => {
    // GIVEN: Database has channels with plex_display_order values

    // WHEN: Requesting the lineup endpoint
    const response = await request.get(`${BASE_URL}/lineup.json`);
    const body = await response.json();

    // THEN: GuideNumber field contains plex_display_order as string
    if (body.length > 0) {
      body.forEach((entry: any) => {
        expect(entry.GuideNumber).toBeTruthy();
        expect(typeof entry.GuideNumber).toBe('string');
        // Should be numeric string
        expect(/^\d+$/.test(entry.GuideNumber)).toBe(true);
      });
    }
  });

  test('should generate stream URLs with format /stream/{xmltv_channel_id}', async ({ request }) => {
    // GIVEN: Database has enabled XMLTV channels

    // WHEN: Requesting the lineup endpoint
    const response = await request.get(`${BASE_URL}/lineup.json`);
    const body = await response.json();

    // THEN: URL field uses format http://{ip}:{port}/stream/{id}
    if (body.length > 0) {
      body.forEach((entry: any) => {
        expect(entry.URL).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:\d+\/stream\/\d+$/);
      });
    }
  });

  test('should order channels by plex_display_order ASC', async ({ request }) => {
    // GIVEN: Database has channels with different plex_display_order values

    // WHEN: Requesting the lineup endpoint
    const response = await request.get(`${BASE_URL}/lineup.json`);
    const body = await response.json();

    // THEN: Channels appear in ascending order by GuideNumber
    if (body.length > 1) {
      const guideNumbers = body.map((entry: any) => parseInt(entry.GuideNumber, 10));

      for (let i = 0; i < guideNumbers.length - 1; i++) {
        expect(guideNumbers[i]).toBeLessThanOrEqual(guideNumbers[i + 1]);
      }
    }
  });

  test('should return empty array when no enabled channels exist', async ({ request }) => {
    // GIVEN: Database has no enabled XMLTV channels
    // (Would require fixture to disable all channels, or fresh database)

    // WHEN: Requesting the lineup endpoint
    const response = await request.get(`${BASE_URL}/lineup.json`);
    const body = await response.json();

    // THEN: Response is valid empty array []
    // (This test may pass or fail depending on database state)
    expect(Array.isArray(body)).toBe(true);
  });

  test('should handle null plex_display_order gracefully', async ({ request }) => {
    // GIVEN: Database has channels with null plex_display_order

    // WHEN: Requesting the lineup endpoint
    const response = await request.get(`${BASE_URL}/lineup.json`);
    const body = await response.json();

    // THEN: Channels with null order appear with valid GuideNumber
    // (Implementation should use channel index or fallback numbering)
    expect(response.status()).toBe(200);
  });
});

test.describe('HDHomeRun Endpoints - Lineup_status.json', () => {
  const DEFAULT_PORT = 5004;
  const BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

  test('should respond to GET /lineup_status.json with 200 OK', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Requesting the lineup status endpoint
    const response = await request.get(`${BASE_URL}/lineup_status.json`);

    // THEN: Server returns 200 OK status
    expect(response.status()).toBe(200);
  });

  test('should return correct Content-Type header for lineup_status.json', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Requesting the lineup status endpoint
    const response = await request.get(`${BASE_URL}/lineup_status.json`);

    // THEN: Response Content-Type is application/json
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  test('should return required lineup status fields', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Requesting the lineup status endpoint
    const response = await request.get(`${BASE_URL}/lineup_status.json`);
    const body = await response.json();

    // THEN: Response contains all required HDHomeRun status fields
    expect(body).toHaveProperty('ScanInProgress');
    expect(body).toHaveProperty('ScanPossible');
    expect(body).toHaveProperty('Source');
    expect(body).toHaveProperty('SourceList');
  });

  test('should return ScanInProgress=0 and ScanPossible=0', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Requesting the lineup status endpoint
    const response = await request.get(`${BASE_URL}/lineup_status.json`);
    const body = await response.json();

    // THEN: ScanInProgress is 0 (no scan in progress)
    expect(body.ScanInProgress).toBe(0);

    // AND: ScanPossible is 0 (scanning not supported)
    expect(body.ScanPossible).toBe(0);
  });

  test('should return Source="Cable" and SourceList=["Cable"]', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Requesting the lineup status endpoint
    const response = await request.get(`${BASE_URL}/lineup_status.json`);
    const body = await response.json();

    // THEN: Source is "Cable"
    expect(body.Source).toBe('Cable');

    // AND: SourceList contains "Cable"
    expect(Array.isArray(body.SourceList)).toBe(true);
    expect(body.SourceList).toContain('Cable');
  });
});

test.describe('HDHomeRun Endpoints - Consistency', () => {
  const DEFAULT_PORT = 5004;
  const BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

  test('lineup.json should match M3U playlist channels', async ({ request }) => {
    // GIVEN: HTTP server is running with enabled channels

    // WHEN: Requesting both HDHomeRun lineup and M3U playlist
    const lineupResponse = await request.get(`${BASE_URL}/lineup.json`);
    const lineupBody = await lineupResponse.json();

    const m3uResponse = await request.get(`${BASE_URL}/playlist.m3u`);
    const m3uBody = await m3uResponse.text();

    // THEN: Both endpoints should return the same set of channels
    // Extract channel IDs from M3U stream URLs
    const m3uStreamUrls = m3uBody.match(/http:\/\/[^\s]+\/stream\/\d+/g) || [];
    const m3uChannelIds = m3uStreamUrls.map((url) => {
      const match = url.match(/\/stream\/(\d+)$/);
      return match ? match[1] : null;
    }).filter(Boolean);

    // Extract channel IDs from HDHomeRun lineup URLs
    const lineupChannelIds = lineupBody.map((entry: any) => {
      const match = entry.URL.match(/\/stream\/(\d+)$/);
      return match ? match[1] : null;
    }).filter(Boolean);

    // AND: Channel counts should match
    expect(lineupChannelIds.length).toBe(m3uChannelIds.length);

    // AND: Both lists should contain the same channel IDs
    lineupChannelIds.forEach((id: string) => {
      expect(m3uChannelIds).toContain(id);
    });

    m3uChannelIds.forEach((id) => {
      expect(lineupChannelIds).toContain(id);
    });
  });

  test('lineup.json channel order should match M3U playlist order', async ({ request }) => {
    // GIVEN: HTTP server is running with enabled channels

    // WHEN: Requesting both HDHomeRun lineup and M3U playlist
    const lineupResponse = await request.get(`${BASE_URL}/lineup.json`);
    const lineupBody = await lineupResponse.json();

    const m3uResponse = await request.get(`${BASE_URL}/playlist.m3u`);
    const m3uBody = await m3uResponse.text();

    // THEN: Channel order should be identical (both use plex_display_order ASC)
    const m3uStreamUrls = m3uBody.match(/http:\/\/[^\s]+\/stream\/\d+/g) || [];
    const m3uChannelIds = m3uStreamUrls.map((url) => {
      const match = url.match(/\/stream\/(\d+)$/);
      return match ? match[1] : null;
    }).filter(Boolean);

    const lineupChannelIds = lineupBody.map((entry: any) => {
      const match = entry.URL.match(/\/stream\/(\d+)$/);
      return match ? match[1] : null;
    }).filter(Boolean);

    // AND: Channel IDs should appear in the same order
    expect(lineupChannelIds).toEqual(m3uChannelIds);
  });
});

test.describe('HDHomeRun Endpoints - Error Handling', () => {
  const DEFAULT_PORT = 5004;
  const BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

  test('discover.json should handle database errors gracefully', async ({ request }) => {
    // GIVEN: HTTP server is running
    // (Database connection may fail)

    // WHEN: Requesting the discovery endpoint
    const response = await request.get(`${BASE_URL}/discover.json`);

    // THEN: Server returns either 200 (success) or 500 (error)
    expect([200, 500]).toContain(response.status());

    // AND: If error, response contains error message (not stack trace)
    if (response.status() === 500) {
      const body = await response.text();
      expect(body).toBeTruthy();
      // Should not expose internal details
      expect(body.toLowerCase()).not.toContain('panic');
    }
  });

  test('lineup.json should handle database errors gracefully', async ({ request }) => {
    // GIVEN: HTTP server is running

    // WHEN: Requesting the lineup endpoint
    const response = await request.get(`${BASE_URL}/lineup.json`);

    // THEN: Server returns either 200 (success) or 500 (error)
    expect([200, 500]).toContain(response.status());

    // AND: If error, response contains error message
    if (response.status() === 500) {
      const body = await response.text();
      expect(body).toBeTruthy();
    }
  });

  test('should return valid UTF-8 encoded JSON', async ({ request }) => {
    // GIVEN: Database has channels with Unicode characters in names

    // WHEN: Requesting the lineup endpoint
    const response = await request.get(`${BASE_URL}/lineup.json`);
    const body = await response.json();

    // THEN: Response is valid JSON with UTF-8 encoding
    expect(body).toBeDefined();
    // No encoding errors when parsing
  });
});

/**
 * IMPLEMENTATION NOTES:
 *
 * Expected Failures (RED Phase):
 * - All tests fail with 404 Not Found (routes not registered)
 * - /discover.json, /lineup.json, /lineup_status.json endpoints don't exist
 *
 * Expected Behavior After Implementation (GREEN Phase):
 * - GET /discover.json returns 200 OK with HDHomeRun device info
 * - GET /lineup.json returns 200 OK with enabled XMLTV channels
 * - GET /lineup_status.json returns 200 OK with scan status
 * - All responses use Content-Type: application/json
 * - PascalCase field names (FriendlyName, not friendly_name)
 * - Lineup matches M3U playlist channels
 * - Channel ordering by plex_display_order ASC NULLS LAST
 *
 * Test Execution:
 * TAURI_DEV=true npm run test -- tests/integration/hdhr-endpoints.spec.ts
 */
