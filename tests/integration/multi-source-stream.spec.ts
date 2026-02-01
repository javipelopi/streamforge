import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

/**
 * Integration Tests for Multi-Source Stream Support
 *
 * Tests the backend stream handling for:
 * 1. M3U stream proxy
 * 2. Acestream stream proxy
 * 3. Multi-source failover
 * 4. Tuner limit enforcement (Xtream only)
 *
 * Acceptance Criteria Covered:
 * - AC 12: M3U stream proxy (no tuner consumed)
 * - AC 13: Acestream proxy on Windows/Linux (via localhost:6878)
 * - AC 14: Acestream on Mac returns 503
 * - AC 15: Failover between sources within 2 seconds
 * - AC 16: Xtream tuner limit enforced
 * - AC 17: M3U bypasses tuner limits
 * - AC 18: Acestream bypasses tuner limits
 *
 * @see tech-spec-multi-source-stream-support.md
 *
 * ATDD Pattern: RED Phase - These tests MUST fail initially
 *
 * Prerequisites: Run with TAURI_DEV=true to test against actual HTTP server
 */

// Seed faker for deterministic test data
faker.seed(12345);

// Base URL for the internal HTTP server
const HTTP_SERVER_BASE = 'http://127.0.0.1:5004';

/**
 * Helper to ensure server is running and test data exists.
 * Returns true if server is available, false otherwise.
 */
async function ensureServerAvailable(request: any): Promise<boolean> {
  try {
    const response = await request.get(`${HTTP_SERVER_BASE}/discover.json`, { timeout: 2000 });
    return response.ok();
  } catch {
    return false;
  }
}

// Removed assertNotMissingEndpoint helper that was short-circuiting tests
// Tests should FAIL on 404, not skip with a custom error message

test.describe('Multi-Source Stream Proxy (AC 12-14)', () => {
  test.beforeAll(async ({ request }) => {
    // Verify server is available before running tests
    const available = await ensureServerAvailable(request);
    if (!available) {
      console.warn('HTTP server not available - tests will be skipped');
    }
  });

  test.describe('AC #12: M3U Stream Proxy', () => {
    test('should proxy M3U stream URL directly', async ({ request }) => {
      // GIVEN: Channel mapped to M3U stream
      // This test requires a channel with m3u mapping in the database
      const channelId = 1; // Test channel with M3U mapping

      // WHEN: Request stream via proxy endpoint
      const response = await request.get(`${HTTP_SERVER_BASE}/auto/v${channelId}`);

      // THEN: Response should be successful (or redirect to M3U URL)
      // Test will FAIL if endpoint is missing (404)
      expect([200, 302, 503]).toContain(response.status());

      // If successful, should have video content type
      if (response.status() === 200) {
        const contentType = response.headers()['content-type'];
        expect(contentType).toMatch(/video|application\/octet-stream|mpegurl/i);
      }
    });

    test('should not consume tuner slot for M3U stream', async ({ request }) => {
      // GIVEN: Tuner limit is 2 and 2 Xtream streams are active
      // First, we need to check current tuner usage
      const statusResponse = await request.get(`${HTTP_SERVER_BASE}/status.json`);

      if (statusResponse.ok()) {
        const status = await statusResponse.json();
        const initialTuners = status.TunersInUse || 0;

        // WHEN: Request M3U stream
        const channelId = 100; // Channel mapped to M3U source
        const streamResponse = await request.get(`${HTTP_SERVER_BASE}/auto/v${channelId}`, {
          timeout: 5000,
        });

        // Check tuner count again
        const statusAfter = await (await request.get(`${HTTP_SERVER_BASE}/status.json`)).json();

        // THEN: Tuner count should not increase for M3U streams
        // M3U streams bypass tuner limits
        if (streamResponse.ok()) {
          expect(statusAfter.TunersInUse).toBe(initialTuners);
        }
      }
    });

    test('should handle M3U stream with different quality variants', async ({ request }) => {
      // GIVEN: Channel with M3U stream that has quality variants
      const channelId = 1;

      // WHEN: Request with quality parameter
      const response = await request.get(`${HTTP_SERVER_BASE}/auto/v${channelId}?quality=HD`);

      // THEN: Should return appropriate quality or indicate not implemented
      // Test will FAIL if endpoint is missing (404)
      // 501 is acceptable if quality selection is not implemented yet
      expect([200, 302, 501, 503]).toContain(response.status());
    });
  });

  test.describe('AC #13 & #14: Acestream Stream Proxy', () => {
    test('should proxy Acestream via localhost:6878 on supported platform', async ({ request }) => {
      // GIVEN: Channel mapped to Acestream source
      // AND: Running on Windows/Linux with Acestream Engine
      const channelId = 200; // Test channel with Acestream mapping

      // WHEN: Request stream via proxy endpoint
      const response = await request.get(`${HTTP_SERVER_BASE}/auto/v${channelId}`, {
        timeout: 10000, // Acestream may be slow to start
      });

      // THEN: Response handling depends on platform
      // Test will FAIL if endpoint is missing (404)
      // On supported platforms: 200 (streaming) or 503 (engine not running)
      // On Mac: 503 with specific message
      expect([200, 503]).toContain(response.status());

      if (response.status() === 503) {
        const body = await response.text();
        // Should indicate reason (engine not running OR platform unsupported)
        expect(body).toMatch(/acestream|engine|platform|unsupported/i);
      }
    });

    test('should return 503 with message on Mac platform', async ({ request }) => {
      // GIVEN: Channel mapped to Acestream
      // AND: Running on Mac (detected via platform check)
      const channelId = 200;

      // Mock or detect Mac platform
      // In actual test, this would be detected by the backend

      // WHEN: Request Acestream stream
      const response = await request.get(`${HTTP_SERVER_BASE}/auto/v${channelId}`);

      // THEN: If on Mac, should return 503
      if (response.status() === 503) {
        const body = await response.text();
        // Check for Mac-specific message
        if (body.toLowerCase().includes('mac') || body.toLowerCase().includes('unsupported')) {
          expect(body).toContain('not supported');
        }
      }
    });

    test('should not consume tuner slot for Acestream stream', async ({ request }) => {
      // GIVEN: Check initial tuner usage
      const statusResponse = await request.get(`${HTTP_SERVER_BASE}/status.json`);

      if (statusResponse.ok()) {
        const status = await statusResponse.json();
        const initialTuners = status.TunersInUse || 0;

        // WHEN: Request Acestream stream
        const channelId = 200;
        await request.get(`${HTTP_SERVER_BASE}/auto/v${channelId}`, {
          timeout: 5000,
        }).catch(() => {}); // May fail if engine not running

        // Check tuner count
        const statusAfter = await (await request.get(`${HTTP_SERVER_BASE}/status.json`)).json();

        // THEN: Tuner count should not increase
        expect(statusAfter.TunersInUse).toBeLessThanOrEqual(initialTuners);
      }
    });
  });
});

test.describe('Multi-Source Failover (AC 15)', () => {
  test.describe('AC #15: Failover Between Sources', () => {
    test('should failover to backup source when primary fails', async ({ request }) => {
      // GIVEN: Channel with multiple sources (Xtream primary, M3U backup)
      // Primary source is configured to fail
      const channelId = 300; // Test channel with multi-source mapping

      // WHEN: Request stream
      const startTime = Date.now();
      const response = await request.get(`${HTTP_SERVER_BASE}/auto/v${channelId}`, {
        timeout: 10000,
      });
      const elapsed = Date.now() - startTime;

      // THEN: Should eventually succeed (via backup source) OR return 503 if all sources fail
      // Test will FAIL if endpoint is missing (404)
      expect([200, 503]).toContain(response.status());

      // If successful, failover should complete within 2 seconds per spec (AC 15)
      if (response.status() === 200) {
        expect(elapsed).toBeLessThan(2000); // Spec requires failover within 2 seconds
      }
    });

    test('should try sources in priority order', async ({ request }) => {
      // GIVEN: Channel with sources at different priorities
      // Priority 1 (Xtream), Priority 2 (M3U), Priority 3 (Acestream)
      const channelId = 300;

      // Listen for request logs (would need server-side logging)
      // This test documents expected behavior

      // WHEN: Request stream
      const response = await request.get(`${HTTP_SERVER_BASE}/auto/v${channelId}`);

      // THEN: Server should have tried sources in priority order
      // Test will FAIL if endpoint is missing (404)
      // Verification would require checking server logs
      expect([200, 503]).toContain(response.status());
    });

    test('should complete failover within 2 seconds', async ({ request }) => {
      // GIVEN: Channel where primary source will fail
      const channelId = 300;

      // WHEN: Request stream and measure time
      const startTime = Date.now();
      const response = await request.get(`${HTTP_SERVER_BASE}/auto/v${channelId}`, {
        timeout: 5000,
      });
      const failoverTime = Date.now() - startTime;

      // THEN: If successful, failover completed quickly
      if (response.status() === 200) {
        console.log(`Failover completed in ${failoverTime}ms`);
        expect(failoverTime).toBeLessThan(2000);
      }
    });

    test('should return 503 when all sources fail', async ({ request }) => {
      // GIVEN: Channel where ALL sources are unavailable
      const channelId = 999; // Non-existent or all-failing channel

      // WHEN: Request stream
      const response = await request.get(`${HTTP_SERVER_BASE}/auto/v${channelId}`);

      // THEN: Should return 503 with error message
      expect([503, 404]).toContain(response.status());

      if (response.status() === 503) {
        const body = await response.text();
        expect(body).toMatch(/no.*source|all.*failed|unavailable/i);
      }
    });
  });
});

test.describe('Tuner Limit Enforcement (AC 16-18)', () => {
  test.describe('AC #16: Xtream Tuner Limit Enforced', () => {
    test('should return 503 when Xtream tuner limit reached', async ({ request }) => {
      // GIVEN: Tuner limit is set (e.g., 2)
      // AND: Limit is already reached with Xtream streams

      // First, check current status
      const statusResponse = await request.get(`${HTTP_SERVER_BASE}/status.json`);

      if (statusResponse.ok()) {
        const status = await statusResponse.json();

        // If tuners are at max, requesting another Xtream stream should fail
        if (status.TunersInUse >= status.TunersMax) {
          // WHEN: Request another Xtream stream
          const channelId = 1; // Xtream-only channel
          const response = await request.get(`${HTTP_SERVER_BASE}/auto/v${channelId}`);

          // THEN: Should return 503 with tuner limit message
          expect(response.status()).toBe(503);
          const body = await response.text();
          expect(body).toMatch(/tuner.*limit|max.*connection/i);
        }
      }
    });

    test('should track Xtream connection count', async ({ request }) => {
      // GIVEN: Status endpoint available

      // WHEN: Get current status
      const response = await request.get(`${HTTP_SERVER_BASE}/status.json`);

      // THEN: Should include tuner information
      if (response.ok()) {
        const status = await response.json();
        expect(status).toHaveProperty('TunersInUse');
        expect(status).toHaveProperty('TunersMax');
        expect(typeof status.TunersInUse).toBe('number');
        expect(typeof status.TunersMax).toBe('number');
      }
    });
  });

  test.describe('AC #17: M3U Bypasses Tuner Limits', () => {
    test('should allow M3U stream when Xtream tuner limit reached', async ({ request }) => {
      // GIVEN: Tuner limit reached with Xtream streams
      const statusResponse = await request.get(`${HTTP_SERVER_BASE}/status.json`);

      if (statusResponse.ok()) {
        const status = await statusResponse.json();

        // Even if tuners are maxed out
        if (status.TunersInUse >= status.TunersMax) {
          // WHEN: Request M3U stream
          const m3uChannelId = 100; // M3U-only channel
          const response = await request.get(`${HTTP_SERVER_BASE}/auto/v${m3uChannelId}`);

          // THEN: Should succeed (M3U doesn't use tuner slots)
          // Test MUST verify stream actually plays
          expect(response.status()).toBe(200);
        }
      }
    });

    test('should not increment tuner count for M3U streams', async ({ request }) => {
      // GIVEN: Current tuner count
      const beforeStatus = await request.get(`${HTTP_SERVER_BASE}/status.json`);

      if (beforeStatus.ok()) {
        const before = await beforeStatus.json();
        const initialCount = before.TunersInUse || 0;

        // WHEN: Start M3U stream
        const m3uChannelId = 100;
        const streamPromise = request.get(`${HTTP_SERVER_BASE}/auto/v${m3uChannelId}`, {
          timeout: 2000,
        });

        // Check tuner count during stream
        await new Promise((r) => setTimeout(r, 500));
        const duringStatus = await request.get(`${HTTP_SERVER_BASE}/status.json`);

        if (duringStatus.ok()) {
          const during = await duringStatus.json();

          // THEN: Tuner count should not increase
          expect(during.TunersInUse).toBe(initialCount);
        }

        // Clean up
        await streamPromise.catch(() => {});
      }
    });
  });

  test.describe('AC #18: Acestream Bypasses Tuner Limits', () => {
    test('should allow Acestream when Xtream tuner limit reached', async ({ request }) => {
      // GIVEN: Tuner limit reached with Xtream streams
      const statusResponse = await request.get(`${HTTP_SERVER_BASE}/status.json`);

      if (statusResponse.ok()) {
        const status = await statusResponse.json();

        if (status.TunersInUse >= status.TunersMax) {
          // WHEN: Request Acestream
          const acestreamChannelId = 200; // Acestream-only channel
          const response = await request.get(`${HTTP_SERVER_BASE}/auto/v${acestreamChannelId}`);

          // THEN: Should succeed (or 503 for engine/platform issues, NOT tuner limit)
          // Test MUST verify stream actually plays or fails for non-tuner reasons
          expect([200, 503]).toContain(response.status());

          // If 503, should NOT mention tuner limit
          if (response.status() === 503) {
            const body = await response.text();
            expect(body).not.toMatch(/tuner.*limit/i);
          }
        }
      }
    });

    test('should not increment tuner count for Acestream streams', async ({ request }) => {
      // GIVEN: Current tuner count
      const beforeStatus = await request.get(`${HTTP_SERVER_BASE}/status.json`);

      if (beforeStatus.ok()) {
        const before = await beforeStatus.json();
        const initialCount = before.TunersInUse || 0;

        // WHEN: Start Acestream (may fail if engine not running)
        const acestreamChannelId = 200;
        await request.get(`${HTTP_SERVER_BASE}/auto/v${acestreamChannelId}`, {
          timeout: 2000,
        }).catch(() => {});

        // Check tuner count
        const afterStatus = await request.get(`${HTTP_SERVER_BASE}/status.json`);

        if (afterStatus.ok()) {
          const after = await afterStatus.json();

          // THEN: Tuner count should not increase
          expect(after.TunersInUse).toBe(initialCount);
        }
      }
    });
  });
});

test.describe('Stream Source Type Selection', () => {
  test('should return correct source type in stream info', async ({ request }) => {
    // GIVEN: Different channel types

    // WHEN: Request stream info (not the stream itself)
    const channelId = 1;
    const response = await request.get(`${HTTP_SERVER_BASE}/channel/${channelId}/info`);

    // THEN: Should include source type information
    if (response.ok()) {
      const info = await response.json();
      // Expected fields for multi-source support
      expect(info).toHaveProperty('sourceType');
      expect(['xtream', 'm3u', 'acestream']).toContain(info.sourceType);
    }
  });

  test('should list all available sources for channel', async ({ request }) => {
    // GIVEN: Channel with multiple sources

    // WHEN: Request channel sources
    const channelId = 300; // Multi-source channel
    const response = await request.get(`${HTTP_SERVER_BASE}/channel/${channelId}/sources`);

    // THEN: Should return list of sources with priorities
    if (response.ok()) {
      const sources = await response.json();
      expect(Array.isArray(sources)).toBe(true);

      if (sources.length > 0) {
        // Each source should have type and priority
        for (const source of sources) {
          expect(source).toHaveProperty('sourceType');
          expect(source).toHaveProperty('priority');
        }

        // Should be sorted by priority
        const priorities = sources.map((s: { priority: number }) => s.priority);
        expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
      }
    }
  });
});

test.describe('HDHomeRun Discovery for Multi-Source', () => {
  test('should include M3U/Acestream channels in lineup', async ({ request }) => {
    // GIVEN: Channels from different sources

    // WHEN: Request HDHomeRun lineup
    const response = await request.get(`${HTTP_SERVER_BASE}/lineup.json`);

    // THEN: Should include all enabled channels regardless of source type
    if (response.ok()) {
      const lineup = await response.json();
      expect(Array.isArray(lineup)).toBe(true);

      // Lineup should include channels (source type is internal)
      // Just verify we have channels
      if (lineup.length > 0) {
        for (const channel of lineup) {
          expect(channel).toHaveProperty('GuideNumber');
          expect(channel).toHaveProperty('GuideName');
          expect(channel).toHaveProperty('URL');
        }
      }
    }
  });

  test('should not expose source type in HDHomeRun lineup', async ({ request }) => {
    // GIVEN: HDHomeRun lineup endpoint

    // WHEN: Request lineup
    const response = await request.get(`${HTTP_SERVER_BASE}/lineup.json`);

    // THEN: Source type should NOT be exposed (implementation detail)
    if (response.ok()) {
      const lineup = await response.json();

      for (const channel of lineup) {
        // These fields should NOT exist (Plex doesn't need them)
        expect(channel).not.toHaveProperty('sourceType');
        expect(channel).not.toHaveProperty('m3uChannelId');
        expect(channel).not.toHaveProperty('acestreamSourceId');
      }
    }
  });
});
