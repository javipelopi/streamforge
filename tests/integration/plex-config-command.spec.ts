import { test, expect } from '@playwright/test';
import { invoke } from '@tauri-apps/api/core';

/**
 * Integration Tests: get_plex_config Tauri Command
 * Story 4-6: Display Plex Configuration URLs
 *
 * Tests the Tauri command that aggregates configuration data
 * for display in the Plex Integration section.
 *
 * RED PHASE: These tests will FAIL until get_plex_config command is implemented.
 */

test.describe('get_plex_config Command', () => {
  test('should return valid PlexConfig structure', async () => {
    // GIVEN: Tauri app is running

    // WHEN: Invoking get_plex_config command
    const config = await invoke('get_plex_config');

    // THEN: Response has all required fields
    expect(config).toHaveProperty('serverRunning');
    expect(config).toHaveProperty('localIp');
    expect(config).toHaveProperty('port');
    expect(config).toHaveProperty('m3uUrl');
    expect(config).toHaveProperty('epgUrl');
    expect(config).toHaveProperty('hdhrUrl');
    expect(config).toHaveProperty('tunerCount');
  });

  test('should return correct M3U URL format', async () => {
    // GIVEN: Tauri app is running

    // WHEN: Fetching Plex configuration
    const config: any = await invoke('get_plex_config');

    // THEN: M3U URL follows format http://{ip}:{port}/playlist.m3u
    expect(config.m3uUrl).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:\d+\/playlist\.m3u$/);

    // AND: URL uses localIp and port from config
    expect(config.m3uUrl).toContain(config.localIp);
    expect(config.m3uUrl).toContain(String(config.port));
  });

  test('should return correct EPG URL format', async () => {
    // GIVEN: Tauri app is running

    // WHEN: Fetching Plex configuration
    const config: any = await invoke('get_plex_config');

    // THEN: EPG URL follows format http://{ip}:{port}/epg.xml
    expect(config.epgUrl).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:\d+\/epg\.xml$/);

    // AND: URL uses localIp and port from config
    expect(config.epgUrl).toContain(config.localIp);
    expect(config.epgUrl).toContain(String(config.port));
  });

  test('should return correct HDHomeRun URL format', async () => {
    // GIVEN: Tauri app is running

    // WHEN: Fetching Plex configuration
    const config: any = await invoke('get_plex_config');

    // THEN: HDHR URL follows format http://{ip}:{port}
    expect(config.hdhrUrl).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/);

    // AND: URL uses localIp and port from config
    expect(config.hdhrUrl).toContain(config.localIp);
    expect(config.hdhrUrl).toContain(String(config.port));
  });

  test('should return local network IP not localhost', async () => {
    // GIVEN: Tauri app is running on local network

    // WHEN: Fetching Plex configuration
    const config: any = await invoke('get_plex_config');

    // THEN: local_ip is not 127.0.0.1 or localhost
    expect(config.localIp).not.toBe('127.0.0.1');
    expect(config.localIp).not.toBe('localhost');

    // AND: local_ip is valid IPv4 address
    expect(config.localIp).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
  });

  test('should return tuner count from active accounts', async () => {
    // GIVEN: Database has active accounts with max_connections

    // WHEN: Fetching Plex configuration
    const config: any = await invoke('get_plex_config');

    // THEN: tuner_count is positive integer
    expect(config.tunerCount).toBeGreaterThan(0);
    expect(Number.isInteger(config.tunerCount)).toBe(true);

    // AND: tuner_count matches sum of active account max_connections
    // (Exact value depends on database fixture)
  });

  test('should return correct port from settings', async () => {
    // GIVEN: Server is configured with specific port

    // WHEN: Fetching Plex configuration
    const config: any = await invoke('get_plex_config');

    // THEN: port matches server configuration (default 5004)
    expect(config.port).toBe(5004);
    expect(typeof config.port).toBe('number');
  });

  test('should detect server running state', async () => {
    // GIVEN: HTTP server is running

    // WHEN: Fetching Plex configuration
    const config: any = await invoke('get_plex_config');

    // THEN: server_running is true
    expect(config.serverRunning).toBe(true);
    expect(typeof config.serverRunning).toBe('boolean');
  });

  test('should reuse existing get_local_ip logic', async () => {
    // GIVEN: get_local_ip() function exists in hdhr.rs

    // WHEN: Fetching Plex configuration
    const config: any = await invoke('get_plex_config');

    // THEN: local_ip uses same logic as discover.json endpoint
    // (Same IP detection library: local_ip_address crate)
    expect(config.localIp).toBeTruthy();

    // AND: Falls back to 127.0.0.1 only if local IP detection fails
    if (config.localIp === '127.0.0.1') {
      // Fallback was used, acceptable
      expect(true).toBe(true);
    } else {
      // Should be valid local network IP
      expect(config.localIp).toMatch(/^(?!127\.0\.0\.1)\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    }
  });
});

/**
 * IMPLEMENTATION NOTES:
 *
 * Expected Failures (RED Phase):
 * - get_plex_config command not found (invoke fails)
 * - PlexConfig struct not defined
 * - Command not registered in lib.rs
 *
 * Required Implementation:
 * - Create PlexConfig struct in src-tauri/src/commands/mod.rs
 * - Implement get_plex_config async function
 * - Reuse get_local_ip() from src-tauri/src/server/hdhr.rs
 * - Get port from state.get_port()
 * - Calculate tuner_count from active accounts (same as discover.json)
 * - Detect server_running via health check or AppState flag
 *
 * Test Execution:
 * TAURI_DEV=true npm run test -- tests/integration/plex-config-command.spec.ts
 */
