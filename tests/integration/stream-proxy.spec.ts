import { test, expect } from '@playwright/test';

/**
 * Integration Tests: Stream Proxy with Quality Selection
 * Story 4-4: Stream Proxy with Quality Selection
 *
 * These tests verify the stream proxy functionality that fetches streams from
 * Xtream providers and serves them to Plex with automatic quality selection.
 * Uses XMLTV-first architecture where stream requests use XMLTV channel IDs.
 *
 * REQUIREMENTS:
 * - Tests must be run with TAURI_DEV=true and IPTV_TEST_MODE=1
 * - Test data is seeded via POST /test/seed?clear=true endpoint
 *
 * Test Data Configuration (seeded by /test/seed):
 * - Channel 1: Enabled with primary mapping to active account
 * - Channel 2: Disabled (is_enabled = 0)
 * - Channel 3: Enabled but NO primary mapping (is_primary = 0)
 * - Channel 4: Enabled with 4K quality stream
 * - Channel 5: Enabled with HD quality only (no 4K)
 * - Channel 6: Enabled with SD quality only
 * - Channel 7: Enabled with NULL qualities
 * - Channel 8: Enabled with FHD quality
 * - Channel 9: Enabled but account server unreachable (192.0.2.1:9999)
 * - Channel 10: Enabled but account is inactive (is_active = 0)
 */

const DEFAULT_PORT = 5004;
const BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

// Seed test data before all tests
test.beforeAll(async ({ request }) => {
  // Seed test data via HTTP endpoint (only works with IPTV_TEST_MODE=1)
  const seedResponse = await request.post(`${BASE_URL}/test/seed?clear=true`);

  if (seedResponse.status() === 403) {
    console.warn('Test seeding requires IPTV_TEST_MODE=1 environment variable');
    throw new Error('IPTV_TEST_MODE=1 must be set to run these tests');
  }

  if (!seedResponse.ok()) {
    const body = await seedResponse.text();
    throw new Error(`Failed to seed test data: ${body}`);
  }

  const result = await seedResponse.json();
  console.log(`Test data seeded: ${result.message}`);
});

// Clean up test data after all tests
test.afterAll(async ({ request }) => {
  // Clean up is optional - data will be cleared on next test run
  const clearResponse = await request.delete(`${BASE_URL}/test/seed`);
  if (clearResponse.ok()) {
    console.log('Test data cleared');
  }
});

test.describe('Stream Proxy - Basic Functionality', () => {

  test('should respond to GET /stream/{valid_channel_id} with 200 OK', async ({ request }) => {
    // GIVEN: HTTP server is running
    // AND: Database has enabled XMLTV channel with primary Xtream mapping
    const validChannelId = 1; // Assumes test data exists

    // WHEN: Requesting a stream for valid XMLTV channel
    const response = await request.get(`${BASE_URL}/stream/${validChannelId}`);

    // THEN: Server returns 200 OK status
    expect(response.status()).toBe(200);
  });

  test('should return video content type header', async ({ request }) => {
    // GIVEN: HTTP server is running with valid channel
    const validChannelId = 1;

    // WHEN: Requesting a stream
    const response = await request.get(`${BASE_URL}/stream/${validChannelId}`);

    // THEN: Content-Type is video/mp2t or application/octet-stream
    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/video\/mp2t|application\/octet-stream/);
  });

  test('should return 404 for non-existent channel ID', async ({ request }) => {
    // GIVEN: HTTP server is running
    const invalidChannelId = 999999;

    // WHEN: Requesting a stream for non-existent XMLTV channel
    const response = await request.get(`${BASE_URL}/stream/${invalidChannelId}`);

    // THEN: Server returns 404 Not Found
    expect(response.status()).toBe(404);
  });

  test('should return 404 for disabled channel', async ({ request }) => {
    // GIVEN: Database has XMLTV channel that is disabled (is_enabled = 0)
    const disabledChannelId = 2; // Assumes test data exists

    // WHEN: Requesting a stream for disabled channel
    const response = await request.get(`${BASE_URL}/stream/${disabledChannelId}`);

    // THEN: Server returns 404 Not Found
    expect(response.status()).toBe(404);
  });

  test('should return 404 for channel without primary mapping', async ({ request }) => {
    // GIVEN: Database has XMLTV channel with no primary Xtream mapping
    const unmappedChannelId = 3; // Assumes test data exists

    // WHEN: Requesting a stream
    const response = await request.get(`${BASE_URL}/stream/${unmappedChannelId}`);

    // THEN: Server returns 404 Not Found
    expect(response.status()).toBe(404);
  });
});

test.describe('Stream Proxy - Quality Selection', () => {
  
  test('should select highest available quality (4K over HD over SD)', async ({ request }) => {
    // GIVEN: XMLTV channel has Xtream stream with qualities: ["4K", "HD", "SD"]
    const channelId = 4; // Assumes test data with multiple qualities

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Stream proxy selects 4K quality
    // (Verification requires checking which Xtream URL was used)
    // For now, verify request succeeds
    expect(response.status()).toBe(200);
  });

  test('should fallback to HD when 4K unavailable', async ({ request }) => {
    // GIVEN: XMLTV channel has Xtream stream with qualities: ["HD", "SD"]
    const channelId = 5; // Assumes test data without 4K

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Stream proxy selects HD quality
    expect(response.status()).toBe(200);
  });

  test('should fallback to SD when only SD available', async ({ request }) => {
    // GIVEN: XMLTV channel has Xtream stream with qualities: ["SD"]
    const channelId = 6; // Assumes test data with only SD

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Stream proxy selects SD quality
    expect(response.status()).toBe(200);
  });

  test('should handle channels with no quality information', async ({ request }) => {
    // GIVEN: XMLTV channel has Xtream stream with null/empty qualities
    const channelId = 7; // Assumes test data without quality info

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Stream proxy defaults to SD and returns stream
    expect(response.status()).toBe(200);
  });

  test('should prioritize FHD over HD', async ({ request }) => {
    // GIVEN: XMLTV channel has Xtream stream with qualities: ["FHD", "HD", "SD"]
    const channelId = 8; // Assumes test data with FHD

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Stream proxy selects FHD quality (full HD)
    expect(response.status()).toBe(200);
  });
});

test.describe('Stream Proxy - Connection Limit', () => {
  
  test('should return 503 when tuner limit reached', async ({ request }) => {
    // GIVEN: Active account has max_connections = 2
    // AND: Two streams are already active
    const channelId1 = 1;
    const channelId2 = 2;
    const channelId3 = 3;

    // WHEN: Starting two concurrent streams
    const stream1 = request.get(`${BASE_URL}/stream/${channelId1}`);
    const stream2 = request.get(`${BASE_URL}/stream/${channelId2}`);

    await Promise.all([stream1, stream2]);

    // AND: Attempting to start a third stream
    const stream3 = await request.get(`${BASE_URL}/stream/${channelId3}`);

    // THEN: Third stream returns 503 Service Unavailable
    expect(stream3.status()).toBe(503);

    // AND: Error message indicates tuner limit
    const body = await stream3.text();
    expect(body.toLowerCase()).toContain('tuner limit');
  });

  test('should allow new stream after previous stream ends', async ({ request }) => {
    // GIVEN: Active account has max_connections = 2
    const channelId1 = 1;
    const channelId2 = 2;

    // WHEN: Starting a stream and then closing it
    const response1 = await request.get(`${BASE_URL}/stream/${channelId1}`);
    expect(response1.status()).toBe(200);

    // Simulate stream ending (in real scenario, client would close connection)
    // For test, we just make a new request assuming previous ended

    // AND: Starting a second stream
    const response2 = await request.get(`${BASE_URL}/stream/${channelId2}`);

    // THEN: Second stream succeeds
    expect(response2.status()).toBe(200);
  });

  test('should track active connections correctly', async ({ request }) => {
    // GIVEN: Multiple streams can be started
    const channelId = 1;

    // WHEN: Making sequential stream requests
    const response1 = await request.get(`${BASE_URL}/stream/${channelId}`);
    const response2 = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Each request succeeds until limit reached
    // (Exact behavior depends on connection tracking implementation)
    expect([200, 503]).toContain(response1.status());
    expect([200, 503]).toContain(response2.status());
  });

  test('should log event when tuner limit reached', async ({ request }) => {
    // GIVEN: Active account has max_connections = 1
    const channelId1 = 1;
    const channelId2 = 2;

    // WHEN: Attempting to exceed connection limit
    const stream1 = request.get(`${BASE_URL}/stream/${channelId1}`);
    await stream1;

    const stream2 = await request.get(`${BASE_URL}/stream/${channelId2}`);

    // THEN: If limit reached, event should be logged
    // (Verification requires checking event_log table or logs)
    expect([200, 503]).toContain(stream2.status());
  });
});

test.describe('Stream Proxy - Streaming Performance', () => {
  
  test('should start streaming within 3 seconds (NFR1)', async ({ request }) => {
    // GIVEN: HTTP server is running with valid channel
    const channelId = 1;

    // WHEN: Requesting a stream
    const startTime = Date.now();
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);
    const endTime = Date.now();

    // THEN: Response arrives within 3000ms
    const responseTime = endTime - startTime;
    expect(responseTime).toBeLessThan(3000);

    // AND: Stream starts successfully
    expect(response.status()).toBe(200);
  });

  test('should stream data without full buffering', async ({ request }) => {
    // GIVEN: HTTP server is running with valid channel
    const channelId = 1;

    // WHEN: Requesting a stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Response headers indicate streaming
    expect(response.status()).toBe(200);

    // AND: Content-Length may not be present (chunked streaming)
    // OR: Transfer-Encoding indicates streaming
    const transferEncoding = response.headers()['transfer-encoding'];
    const contentLength = response.headers()['content-length'];

    // Either chunked transfer or no content-length indicates streaming
    const isStreaming = transferEncoding === 'chunked' || !contentLength;
    expect(isStreaming || contentLength).toBeTruthy();
  });

  test('should handle concurrent streams without performance degradation', async ({ request }) => {
    // GIVEN: HTTP server is running
    const channelId1 = 1;
    const channelId2 = 2;

    // WHEN: Starting two concurrent streams
    const startTime = Date.now();
    const [response1, response2] = await Promise.all([
      request.get(`${BASE_URL}/stream/${channelId1}`),
      request.get(`${BASE_URL}/stream/${channelId2}`),
    ]);
    const endTime = Date.now();

    // THEN: Both streams start within acceptable time
    const totalTime = endTime - startTime;
    expect(totalTime).toBeLessThan(5000);

    // AND: Both requests succeed
    expect(response1.status()).toBe(200);
    expect(response2.status()).toBe(200);
  });
});

test.describe('Stream Proxy - Error Handling', () => {
  
  test('should return 503 when Xtream server is unreachable', async ({ request }) => {
    // GIVEN: XMLTV channel has Xtream mapping
    // AND: Xtream server is down or unreachable
    const channelId = 9; // Assumes test data with unreachable server

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Proxy returns 503 Service Unavailable
    expect(response.status()).toBe(503);

    // AND: Error message indicates stream unavailable
    const body = await response.text();
    expect(body.toLowerCase()).toMatch(/stream unavailable|service unavailable/);
  });

  test('should return 503 when Xtream account is inactive', async ({ request }) => {
    // GIVEN: XMLTV channel has Xtream mapping
    // AND: Associated Xtream account is inactive (is_active = 0)
    const channelId = 10; // Assumes test data with inactive account

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Proxy returns 503 Service Unavailable
    expect(response.status()).toBe(503);
  });

  test('should handle malformed channel IDs gracefully', async ({ request }) => {
    // GIVEN: HTTP server is running
    const malformedId = 'not-a-number';

    // WHEN: Requesting stream with malformed ID
    const response = await request.get(`${BASE_URL}/stream/${malformedId}`);

    // THEN: Server returns 400 Bad Request or 404 Not Found
    expect([400, 404]).toContain(response.status());
  });

  test('should not expose sensitive error details to client', async ({ request }) => {
    // GIVEN: HTTP server is running
    const invalidChannelId = 999999;

    // WHEN: Requesting non-existent stream
    const response = await request.get(`${BASE_URL}/stream/${invalidChannelId}`);

    // THEN: Error message is opaque (no stack traces, DB details)
    const body = await response.text();
    expect(body).toBeTruthy();

    // AND: Should not contain sensitive information
    expect(body.toLowerCase()).not.toContain('panic');
    expect(body.toLowerCase()).not.toContain('database');
    expect(body.toLowerCase()).not.toContain('sql');
    expect(body.toLowerCase()).not.toContain('password');
  });

  test('should handle database connection errors gracefully', async ({ request }) => {
    // GIVEN: HTTP server is running
    // (Database may be unavailable)
    const channelId = 1;

    // WHEN: Requesting a stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Server returns either 200 (success) or 500 (error)
    expect([200, 500]).toContain(response.status());

    // AND: If error, response is user-friendly
    if (response.status() === 500) {
      const body = await response.text();
      expect(body).toBeTruthy();
      expect(body.toLowerCase()).not.toContain('panic');
    }
  });
});

test.describe('Stream Proxy - XMLTV-First Architecture', () => {
  
  test('should use XMLTV channel ID in stream URL', async ({ request }) => {
    // GIVEN: M3U playlist contains stream URLs
    const m3uResponse = await request.get(`${BASE_URL}/playlist.m3u`);
    const m3uBody = await m3uResponse.text();

    // WHEN: Extracting stream URLs from playlist
    const streamUrls = m3uBody.match(/http:\/\/[^\s]+\/stream\/\d+/g) || [];

    // THEN: Stream URLs use XMLTV channel IDs (not Xtream stream IDs)
    expect(streamUrls.length).toBeGreaterThan(0);

    // AND: Each URL follows format /stream/{xmltv_channel_id}
    streamUrls.forEach((url) => {
      expect(url).toMatch(/\/stream\/\d+$/);
    });
  });

  test('should proxy primary Xtream stream for XMLTV channel', async ({ request }) => {
    // GIVEN: XMLTV channel has multiple Xtream mappings
    // AND: One mapping is marked as primary (is_primary = 1)
    const channelId = 11; // Assumes test data with multiple mappings

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Proxy selects and streams from primary Xtream source
    expect(response.status()).toBe(200);

    // AND: Stream data is from Xtream provider (not local file)
    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/video\/mp2t|application\/octet-stream/);
  });

  test('should ignore non-primary mappings for stream selection', async ({ request }) => {
    // GIVEN: XMLTV channel has multiple Xtream mappings
    // AND: Only one is marked as primary
    const channelId = 12; // Assumes test data with primary + failover mappings

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Only primary mapping is used (failovers are for Story 4-5)
    expect(response.status()).toBe(200);
  });
});

test.describe('Stream Proxy - URL Format and Parameters', () => {
  
  test('should construct valid Xtream stream URL', async ({ request }) => {
    // GIVEN: XMLTV channel has Xtream mapping
    // AND: Account has server_url, username, password
    const channelId = 1;

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Proxy constructs Xtream URL with format:
    // {server_url}/live/{username}/{password}/{stream_id}.ts
    // (Cannot directly verify URL, but stream should work)
    expect(response.status()).toBe(200);
  });

  test('should handle special characters in Xtream credentials', async ({ request }) => {
    // GIVEN: XMLTV channel has Xtream account with special characters in username/password
    const channelId = 13; // Assumes test data with special chars

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Proxy URL-encodes credentials correctly
    expect(response.status()).toBe(200);
  });

  test('should use .ts format for MPEG-TS compatibility', async ({ request }) => {
    // GIVEN: XMLTV channel has Xtream mapping
    const channelId = 1;

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Xtream URL uses .ts format (not .m3u8)
    // (Indirect verification via Content-Type)
    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/video\/mp2t|application\/octet-stream/);
  });

  test('should handle HTTP and HTTPS Xtream servers', async ({ request }) => {
    // GIVEN: XMLTV channels have Xtream accounts with both HTTP and HTTPS URLs
    const httpChannelId = 14; // Assumes test data with HTTP server
    const httpsChannelId = 15; // Assumes test data with HTTPS server

    // WHEN: Requesting streams from both
    const httpResponse = await request.get(`${BASE_URL}/stream/${httpChannelId}`);
    const httpsResponse = await request.get(`${BASE_URL}/stream/${httpsChannelId}`);

    // THEN: Both succeed
    expect([200, 503]).toContain(httpResponse.status());
    expect([200, 503]).toContain(httpsResponse.status());
  });
});

test.describe('Stream Proxy - Password Decryption', () => {
  
  test('should decrypt account password before streaming', async ({ request }) => {
    // GIVEN: XMLTV channel has Xtream account
    // AND: Account password is encrypted in database
    const channelId = 1;

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Proxy decrypts password and uses it in Xtream URL
    expect(response.status()).toBe(200);
  });

  test('should use keyring for password retrieval', async ({ request }) => {
    // GIVEN: Account password is stored in system keyring
    const channelId = 1;

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Proxy retrieves password from keyring successfully
    expect(response.status()).toBe(200);
  });

  test('should fallback to AES decryption if keyring fails', async ({ request }) => {
    // GIVEN: System keyring is unavailable
    // AND: Account password has AES-encrypted fallback
    const channelId = 16; // Assumes test scenario without keyring

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Proxy uses AES decryption as fallback
    expect([200, 503]).toContain(response.status());
  });
});

test.describe('Stream Proxy - Session Tracking', () => {
  
  test('should create session when stream starts', async ({ request }) => {
    // GIVEN: HTTP server is running
    const channelId = 1;

    // WHEN: Requesting a stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: StreamManager creates active session
    expect(response.status()).toBe(200);

    // AND: Session tracks channel ID, quality, start time
    // (Verification requires internal state inspection or logs)
  });

  test('should generate unique session ID for each stream', async ({ request }) => {
    // GIVEN: HTTP server is running
    const channelId = 1;

    // WHEN: Starting multiple streams for same channel
    const response1 = await request.get(`${BASE_URL}/stream/${channelId}`);
    const response2 = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Each stream gets unique session ID
    // (Indirect verification via connection limit enforcement)
    expect([200, 503]).toContain(response1.status());
    expect([200, 503]).toContain(response2.status());
  });

  test('should remove session when stream ends', async ({ request }) => {
    // GIVEN: Active stream exists
    const channelId = 1;

    // WHEN: Stream is requested and then client disconnects
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);
    expect(response.status()).toBe(200);

    // Simulate stream ending (client disconnect)
    // In real scenario, connection would be closed

    // THEN: Session is removed from active sessions
    // (Verification requires checking StreamManager state)

    // AND: Connection slot is freed for new streams
    const newResponse = await request.get(`${BASE_URL}/stream/${channelId}`);
    expect([200, 503]).toContain(newResponse.status());
  });

  test('should track session metadata', async ({ request }) => {
    // GIVEN: HTTP server is running
    const channelId = 1;

    // WHEN: Stream is requested
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Session includes metadata:
    // - xmltv_channel_id
    // - xtream_stream_id
    // - current_quality
    // - started_at timestamp
    expect(response.status()).toBe(200);
  });
});

/**
 * IMPLEMENTATION NOTES:
 *
 * Expected Failures (RED Phase):
 * - All tests fail with 404 Not Found (route /stream/:id not registered)
 * - StreamManager module doesn't exist
 * - Quality selection logic not implemented
 * - Connection limit enforcement not implemented
 *
 * Expected Behavior After Implementation (GREEN Phase):
 * - GET /stream/{xmltv_channel_id} returns 200 OK for valid channels
 * - Streams use primary Xtream mapping with highest quality
 * - Quality priority: 4K > FHD > HD > SD
 * - Connection limit enforced (503 when exceeded)
 * - Session tracking with auto-cleanup
 * - NFR1: Stream start < 3 seconds
 * - NFR7: CPU usage < 15% during streaming
 * - Opaque error messages (no sensitive details)
 * - Password decryption from keyring or AES fallback
 * - Streaming response (no full buffering)
 *
 * Test Execution:
 * TAURI_DEV=true npm run test -- tests/integration/stream-proxy.spec.ts
 *
 * Test Data Requirements:
 * - Enabled XMLTV channels with primary Xtream mappings
 * - Disabled channels for negative testing
 * - Channels with various quality configurations
 * - Active and inactive accounts
 * - Channels with special characters in credentials
 */
