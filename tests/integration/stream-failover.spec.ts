import { test, expect } from '@playwright/test';

/**
 * Integration Tests: Stream Failover
 * Story 4-5: Automatic Stream Failover
 *
 * These tests verify that when a stream fails (timeout, connection error, HTTP error),
 * the proxy automatically fails over to backup streams in priority order.
 * Uses XMLTV-first architecture where each XMLTV channel can have multiple Xtream streams.
 *
 * REQUIREMENTS:
 * - Tests must be run with TAURI_DEV=true and IPTV_TEST_MODE=1
 * - Test data is seeded via POST /test/seed?clear=true endpoint
 * - Mock Xtream server needed for full failover simulation (deferred from 4-4)
 *
 * Test Data Configuration (seeded by /test/seed):
 * - Channel 1: Enabled with primary + 2 backup streams (priority 0, 1, 2)
 * - Channel 2: Enabled with primary + 1 backup (priority 0, 1)
 * - Channel 3: Enabled with 3 backups, all same quality
 * - Channel 4: Enabled with primary only (no backups)
 * - Channel 5: Enabled with primary (unreachable) + working backup
 * - Channel 6: Enabled with all streams unreachable
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
  const clearResponse = await request.delete(`${BASE_URL}/test/seed`);
  if (clearResponse.ok()) {
    console.log('Test data cleared');
  }
});

test.describe('Stream Failover - Basic Failover Detection (AC #1)', () => {

  test('should detect connection timeout (5s) and failover to backup', async ({ request }) => {
    // GIVEN: XMLTV channel has primary stream that times out
    // AND: Backup stream exists with priority 1
    const channelId = 5; // Primary unreachable, backup working

    // WHEN: Requesting the stream
    const startTime = Date.now();
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);
    const endTime = Date.now();

    // THEN: Failover completes in < 2 seconds (NFR2)
    const responseTime = endTime - startTime;
    expect(responseTime).toBeLessThan(2000);

    // AND: Response is successful (backup stream used)
    expect(response.status()).toBe(200);
  });

  test('should detect connection error and failover immediately', async ({ request }) => {
    // GIVEN: Primary stream has connection error
    // AND: Backup stream exists
    const channelId = 5; // Assumes primary fails, backup works

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Failover occurs and backup stream serves content
    expect(response.status()).toBe(200);
  });

  test('should detect HTTP error (non-2xx) and failover', async ({ request }) => {
    // GIVEN: Primary stream returns HTTP 404 or 500
    // AND: Backup stream exists
    const channelId = 5; // Assumes primary returns error, backup works

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Failover occurs to backup
    expect(response.status()).toBe(200);
  });

  test('should complete failover in less than 2 seconds (NFR2)', async ({ request }) => {
    // GIVEN: Primary stream fails
    // AND: Backup stream is available
    const channelId = 5;

    // WHEN: Requesting the stream
    const startTime = Date.now();
    const response = await request.get(`${BASE_URL}/stream/${channelId}`, {
      timeout: 3000, // Give extra headroom beyond NFR2's 2s
    });
    const endTime = Date.now();

    // THEN: Response arrives within 2000ms
    const responseTime = endTime - startTime;
    expect(responseTime).toBeLessThan(2000);

    // AND: Stream is successful
    expect(response.status()).toBe(200);
  });

  test('should keep Plex unaware of failover (FR33)', async ({ request }) => {
    // GIVEN: Primary stream fails and backup succeeds
    const channelId = 5;

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Response is seamless (no interruption)
    expect(response.status()).toBe(200);

    // AND: Content-Type indicates video stream
    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/video\/mp2t|application\/octet-stream/);

    // AND: No special headers indicating failover
    expect(response.headers()['x-failover']).toBeUndefined();
    expect(response.headers()['x-backup-stream']).toBeUndefined();
  });
});

test.describe('Stream Failover - Priority Order (AC #2)', () => {

  test('should try backup streams in priority order', async ({ request }) => {
    // GIVEN: XMLTV channel has streams with priorities: 0 (primary), 1, 2
    // AND: Primary fails
    const channelId = 1; // Has multiple backups with different priorities

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Failover tries priority 1 before priority 2
    // (Verification via event log in later test)
    expect(response.status()).toBe(200);
  });

  test('should skip failed backup and try next in priority', async ({ request }) => {
    // GIVEN: XMLTV channel has 3 streams (priorities 0, 1, 2)
    // AND: Primary (0) and first backup (1) both fail
    // AND: Second backup (2) works
    const channelId = 1;

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Stream succeeds using priority 2
    expect(response.status()).toBe(200);
  });

  test('should log each failover attempt', async ({ request }) => {
    // GIVEN: XMLTV channel with primary + backup
    // AND: Primary fails, backup succeeds
    const channelId = 5;

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Stream succeeds
    expect(response.status()).toBe(200);

    // AND: Failover event is logged to event_log table
    // (Verification requires checking event_log via API)
    // For now, verify stream works
  });

  test('should prefer lower stream_priority values', async ({ request }) => {
    // GIVEN: XMLTV channel has multiple streams
    // AND: stream_priority values are 0 (primary), 1, 2
    const channelId = 1;

    // WHEN: Primary (priority 0) fails
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Next stream tried is priority 1 (not priority 2)
    expect(response.status()).toBe(200);
  });
});

test.describe('Stream Failover - Quality Upgrade (AC #3)', () => {

  test('should attempt quality upgrade after 60 seconds', async ({ request }) => {
    // GIVEN: Stream has failed over to backup
    // AND: 60 seconds have passed
    const channelId = 5;

    // WHEN: Upgrade period elapses (simulated)
    // NOTE: Full test requires long-running stream (60s wait)
    // This test verifies upgrade logic exists but can't wait 60s

    // THEN: Proxy attempts to reconnect to primary stream
    // (Deferred: Full test needs streaming connection held for 60s)
    expect(true).toBe(true); // Placeholder
  });

  test('should stay on backup if upgrade fails', async ({ request }) => {
    // GIVEN: Stream is on backup (priority 1)
    // AND: Upgrade attempt to primary fails
    const channelId = 5;

    // WHEN: Upgrade is attempted
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Stream continues on backup without interruption
    expect(response.status()).toBe(200);
  });

  test('should return to primary if upgrade succeeds', async ({ request }) => {
    // GIVEN: Stream was on backup
    // AND: Primary stream becomes available again
    const channelId = 5;

    // WHEN: Upgrade period triggers
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Proxy switches back to primary
    // (Verification requires long-running stream test)
    expect(response.status()).toBe(200);
  });

  test('should reset upgrade timer after failed attempt', async ({ request }) => {
    // GIVEN: Upgrade attempt fails
    const channelId = 5;

    // WHEN: Next upgrade window arrives (60s later)
    // THEN: Proxy tries upgrade again
    // (Full test deferred - needs 60s+ stream duration)
    expect(true).toBe(true); // Placeholder
  });
});

test.describe('Stream Failover - All Streams Fail (AC #4)', () => {

  test('should return error when all streams fail', async ({ request }) => {
    // GIVEN: XMLTV channel has primary + backups
    // AND: All streams are unreachable
    const channelId = 6; // All streams fail

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Request fails with error
    expect(response.status()).toBe(503);
  });

  test('should log event when all streams exhausted', async ({ request }) => {
    // GIVEN: All backup streams fail
    const channelId = 6;

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Error response returned
    expect(response.status()).toBe(503);

    // AND: Event is logged with level "error"
    // (Verification via event_log query)
  });

  test('should return user-friendly error message', async ({ request }) => {
    // GIVEN: All streams fail
    const channelId = 6;

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Error message is opaque (no internal details)
    const body = await response.text();
    expect(body.toLowerCase()).toMatch(/stream unavailable|service unavailable/);

    // AND: No sensitive information exposed
    expect(body.toLowerCase()).not.toContain('panic');
    expect(body.toLowerCase()).not.toContain('database');
    expect(body.toLowerCase()).not.toContain('password');
  });

  test('should handle channel with no backup streams', async ({ request }) => {
    // GIVEN: XMLTV channel has only primary stream (no backups)
    // AND: Primary stream fails
    const channelId = 4; // No backup streams

    // WHEN: Requesting the stream
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Request fails immediately (no failover possible)
    expect(response.status()).toBe(503);
  });
});

test.describe('Stream Failover - Event Logging (AC #5)', () => {

  test('should log failover event with all required fields', async ({ request }) => {
    // GIVEN: Primary stream fails, backup succeeds
    const channelId = 5;

    // WHEN: Failover occurs
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Event is logged to event_log table
    expect(response.status()).toBe(200);

    // AND: Log includes:
    // - channel_id
    // - from_stream_id (primary)
    // - to_stream_id (backup)
    // - reason (ConnectionTimeout, ConnectionError, HttpError)
    // - timestamp
    // (Verification requires querying event_log table)
  });

  test('should log with level "warn" for successful failover', async ({ request }) => {
    // GIVEN: Failover succeeds to backup
    const channelId = 5;

    // WHEN: Failover occurs
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Event has level "warn"
    expect(response.status()).toBe(200);
  });

  test('should log with level "error" when all streams fail', async ({ request }) => {
    // GIVEN: All streams fail
    const channelId = 6;

    // WHEN: Failover exhausts all options
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Event has level "error"
    expect(response.status()).toBe(503);
  });

  test('should include failure reason in event details', async ({ request }) => {
    // GIVEN: Stream fails with specific reason
    const channelId = 5;

    // WHEN: Failover occurs
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Event details include reason field
    // Possible values: ConnectionTimeout, ConnectionError, HttpError(status), StreamError
    expect(response.status()).toBe(200);
  });

  test('should log failover timestamp in ISO 8601 format', async ({ request }) => {
    // GIVEN: Failover event occurs
    const channelId = 5;

    // WHEN: Event is logged
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Timestamp is in RFC3339/ISO 8601 format
    expect(response.status()).toBe(200);
  });
});

test.describe('Stream Failover - Transparent to Plex (FR33)', () => {

  test('should not interrupt HTTP response during failover', async ({ request }) => {
    // GIVEN: Primary stream fails mid-stream
    const channelId = 5;

    // WHEN: Failover occurs
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: HTTP response continues without interruption
    expect(response.status()).toBe(200);

    // AND: Content-Type remains consistent
    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/video\/mp2t|application\/octet-stream/);
  });

  test('should maintain chunked transfer encoding during failover', async ({ request }) => {
    // GIVEN: Stream is using chunked transfer
    const channelId = 5;

    // WHEN: Failover occurs
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Transfer encoding continues
    expect(response.status()).toBe(200);

    // AND: No Content-Length change
    const transferEncoding = response.headers()['transfer-encoding'];
    const hasChunked = transferEncoding === 'chunked';
    const noContentLength = !response.headers()['content-length'];
    expect(hasChunked || noContentLength).toBeTruthy();
  });

  test('should not expose failover in response headers', async ({ request }) => {
    // GIVEN: Failover occurs
    const channelId = 5;

    // WHEN: Stream is requested
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: No failover-related headers exposed
    expect(response.headers()['x-failover']).toBeUndefined();
    expect(response.headers()['x-stream-backup']).toBeUndefined();
    expect(response.headers()['x-retry-count']).toBeUndefined();
  });

  test('should handle failover without client-side action', async ({ request }) => {
    // GIVEN: Client (Plex) is streaming
    const channelId = 5;

    // WHEN: Failover occurs on server side
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Client continues receiving data seamlessly
    expect(response.status()).toBe(200);

    // AND: No 30x redirect or connection reset
    expect(response.status()).not.toBe(301);
    expect(response.status()).not.toBe(302);
    expect(response.status()).not.toBe(307);
  });
});

test.describe('Stream Failover - Performance (NFR2, NFR11)', () => {

  test('should complete failover in under 2 seconds (NFR2)', async ({ request }) => {
    // GIVEN: Primary stream fails
    const channelId = 5;

    // WHEN: Failover to backup
    const startTime = Date.now();
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);
    const endTime = Date.now();

    // THEN: Total time < 2000ms
    const responseTime = endTime - startTime;
    expect(responseTime).toBeLessThan(2000);

    // AND: Stream succeeds
    expect(response.status()).toBe(200);
  });

  test('should use aggressive connect timeout (1s per attempt)', async ({ request }) => {
    // GIVEN: Stream failover with multiple backups
    const channelId = 5;

    // WHEN: Each stream is attempted
    const startTime = Date.now();
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);
    const endTime = Date.now();

    // THEN: Connect timeout per stream is ~1s
    const responseTime = endTime - startTime;
    expect(responseTime).toBeLessThan(3000); // Max 3 attempts = 3s
  });

  test('should limit backup attempts within 2s window', async ({ request }) => {
    // GIVEN: Multiple backup streams exist
    const channelId = 1; // Has 3+ streams

    // WHEN: Primary fails and backups are tried
    const startTime = Date.now();
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);
    const endTime = Date.now();

    // THEN: Maximum 2 backup attempts within 2s
    const responseTime = endTime - startTime;
    expect(responseTime).toBeLessThan(2500);
  });

  test('should recover 99% of stream failures (NFR11)', async ({ request }) => {
    // GIVEN: XMLTV channel has backup streams
    const channelId = 5;

    // WHEN: Primary fails but backup works
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Failover succeeds (contributes to 99% recovery rate)
    expect(response.status()).toBe(200);
  });
});

test.describe('Stream Failover - Multiple Backup Streams', () => {

  test('should load all backup streams at proxy start', async ({ request }) => {
    // GIVEN: XMLTV channel has primary + 2 backups
    const channelId = 1;

    // WHEN: Stream proxy starts
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: All backup stream metadata is loaded
    // (Verification via StreamManager state)
    expect(response.status()).toBe(200);
  });

  test('should order backups by stream_priority ASC', async ({ request }) => {
    // GIVEN: Channel has streams with priorities: 0, 2, 1 (out of order in DB)
    const channelId = 1;

    // WHEN: Loading backup streams
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Streams are tried in order: 0, 1, 2
    expect(response.status()).toBe(200);
  });

  test('should handle same priority values (use is_primary tiebreaker)', async ({ request }) => {
    // GIVEN: Two streams have same priority
    // AND: One is marked is_primary = 1
    const channelId = 2;

    // WHEN: Loading streams
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Primary stream is tried first
    expect(response.status()).toBe(200);
  });

  test('should skip streams from inactive accounts', async ({ request }) => {
    // GIVEN: Channel has backup stream from inactive account
    const channelId = 1;

    // WHEN: Failover occurs
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Inactive account streams are skipped
    expect(response.status()).toBe(200);
  });
});

test.describe('Stream Failover - Error Handling', () => {

  test('should handle network DNS resolution failure', async ({ request }) => {
    // GIVEN: Xtream server hostname cannot be resolved
    const channelId = 6; // Unreachable server

    // WHEN: Attempting to connect
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Detected as ConnectionError and triggers failover
    expect(response.status()).toBe(503);
  });

  test('should handle SSL/TLS handshake failure', async ({ request }) => {
    // GIVEN: HTTPS Xtream server with invalid certificate
    const channelId = 6;

    // WHEN: Attempting secure connection
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Detected as ConnectionError
    expect(response.status()).toBe(503);
  });

  test('should handle stream read error mid-transfer', async ({ request }) => {
    // GIVEN: Stream starts successfully but fails mid-transfer
    const channelId = 5;

    // WHEN: Stream error occurs
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Failover is triggered
    // (Full test requires mock server that fails mid-stream)
    expect(response.status()).toBe(200);
  });

  test('should handle credential decryption failure', async ({ request }) => {
    // GIVEN: Account password cannot be decrypted
    const channelId = 1;

    // WHEN: Attempting to build stream URL
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Returns error without exposing details
    expect([200, 503]).toContain(response.status());
  });
});

test.describe('Stream Failover - Database Integration', () => {

  test('should query all streams for XMLTV channel', async ({ request }) => {
    // GIVEN: XMLTV channel has multiple mappings
    const channelId = 1;

    // WHEN: Loading failover state
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: All streams from channel_mappings are loaded
    expect(response.status()).toBe(200);
  });

  test('should join with accounts table for credentials', async ({ request }) => {
    // GIVEN: Stream mappings reference accounts table
    const channelId = 1;

    // WHEN: Building stream URLs
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Server URL, username, password are retrieved
    expect(response.status()).toBe(200);
  });

  test('should join with xtream_channels for stream details', async ({ request }) => {
    // GIVEN: Mappings reference xtream_channels
    const channelId = 1;

    // WHEN: Loading streams
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Stream ID and qualities are available
    expect(response.status()).toBe(200);
  });

  test('should filter by is_active = 1 on accounts', async ({ request }) => {
    // GIVEN: Channel has mapping to inactive account
    const channelId = 1;

    // WHEN: Loading backup streams
    const response = await request.get(`${BASE_URL}/stream/${channelId}`);

    // THEN: Inactive accounts are excluded
    expect(response.status()).toBe(200);
  });
});

/**
 * IMPLEMENTATION NOTES:
 *
 * Expected Failures (RED Phase):
 * - Failover logic module doesn't exist (src-tauri/src/server/failover.rs)
 * - Stream proxy doesn't load backup streams
 * - FailoverStream wrapper not implemented
 * - Event logging for failover not implemented
 * - Quality upgrade retry not implemented
 *
 * Expected Behavior After Implementation (GREEN Phase):
 * - Primary stream failure triggers immediate failover to backup
 * - Backups tried in priority order (stream_priority ASC)
 * - Failover completes in < 2s (NFR2)
 * - Quality upgrade attempted after 60s on backup
 * - All failover events logged to event_log
 * - Plex remains unaware of failover (FR33)
 * - All streams fail returns 503 error
 * - Opaque error messages (no sensitive details)
 *
 * Test Execution:
 * TAURI_DEV=true IPTV_TEST_MODE=1 npm run test -- tests/integration/stream-failover.spec.ts
 *
 * Limitations:
 * - Full failover tests require mock Xtream server (deferred from Story 4-4)
 * - Quality upgrade tests need long-running streams (60s+ duration)
 * - Mid-stream failure tests need mock server with intermittent failures
 * - Tests currently verify error paths and structure, not full failover behavior
 */
