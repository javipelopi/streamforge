import { test, expect } from '@playwright/test';
import { createXmltvChannel } from '../support/factories/xmltv-channel.factory';
import { createChannel } from '../support/factories/channel.factory';
import {
  createChannelMapping,
  createMatchStats,
  createESPNChannelSet,
} from '../support/factories/channel-mapping.factory';

/**
 * Integration Tests for Channel Matching Algorithm (Story 3-1)
 *
 * Test Level: Integration (Tauri commands + database)
 * Framework: Playwright Test
 * Focus: Fuzzy matching algorithm, one-to-many mappings, confidence thresholds
 *
 * RED PHASE: These tests MUST fail initially (missing implementation)
 * Expected failures: Commands not registered, database tables missing, matching logic not implemented
 */

test.describe('Channel Matching Algorithm', () => {
  test.beforeEach(async () => {
    // GIVEN: Clean database state before each test
    // NOTE: This will fail until database migrations are created
    // Expected error: "no such table: channel_mappings"
  });

  test('AC1.1: should run fuzzy matching for XMLTV and Xtream channels', async () => {
    // GIVEN: XMLTV channels and Xtream channels exist in database
    const xmltvChannel = createXmltvChannel({
      id: 1,
      channelId: 'espn.us',
      displayName: 'ESPN',
    });

    const xtreamChannelHD = createChannel({
      id: 101,
      name: 'ESPN HD',
      epgChannelId: 'espn.us',
    });

    const xtreamChannelSD = createChannel({
      id: 102,
      name: 'ESPN SD',
      epgChannelId: 'espn.us',
    });

    // NOTE: Database seeding will be needed here
    // await seedDatabase({ xmltvChannels: [xmltvChannel], xtreamChannels: [xtreamChannelHD, xtreamChannelSD] });

    // WHEN: Matching is triggered
    // @ts-expect-error - Command does not exist yet (RED phase)
    const result = await window.__TAURI__.invoke('run_channel_matching', {
      threshold: 0.85,
    });

    // THEN: Algorithm runs and creates mappings
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.matchedCount).toBeGreaterThan(0);

    // Expected failure: Error: Unknown command: run_channel_matching
  });

  test('AC1.2: should normalize channel names before matching', async () => {
    // GIVEN: Channels with HD/SD/FHD suffixes and punctuation
    const testCases = [
      { input: 'ESPN HD', expected: 'espn' },
      { input: 'ESPN FHD', expected: 'espn' },
      { input: 'ESPN - 4K', expected: 'espn' },
      { input: 'BBC One (UK)', expected: 'bbc one uk' },
      { input: 'CNN  News', expected: 'cnn news' },
      { input: 'FOX Sports 1', expected: 'fox sports 1' },
    ];

    for (const testCase of testCases) {
      // WHEN: Name normalization is applied
      // @ts-expect-error - Command does not exist yet (RED phase)
      const normalized = await window.__TAURI__.invoke('normalize_channel_name', {
        name: testCase.input,
      });

      // THEN: Name is properly normalized
      expect(normalized).toBe(testCase.expected);
    }

    // Expected failure: Error: Unknown command: normalize_channel_name
  });

  test('AC1.3: should calculate Jaro-Winkler similarity scores', async () => {
    // GIVEN: Channel name pairs
    const pairs = [
      { xmltv: 'ESPN', xtream: 'ESPN HD', expectedScore: 0.9 }, // High similarity
      { xmltv: 'ESPN', xtream: 'ESPN', expectedScore: 1.0 }, // Exact match
      { xmltv: 'CNN', xtream: 'Fox News', expectedScore: 0.3 }, // Low similarity
    ];

    for (const pair of pairs) {
      // WHEN: Similarity score is calculated
      // @ts-expect-error - Command does not exist yet (RED phase)
      const score = await window.__TAURI__.invoke('calculate_match_score', {
        xmltvName: pair.xmltv,
        xtreamName: pair.xtream,
        epgIdMatch: false,
        exactNameMatch: false,
      });

      // THEN: Score matches expected range
      expect(score).toBeGreaterThanOrEqual(pair.expectedScore - 0.1);
      expect(score).toBeLessThanOrEqual(1.0);
    }

    // Expected failure: Error: Unknown command: calculate_match_score
  });

  test('AC1.4: should boost score for exact EPG ID matches', async () => {
    // GIVEN: Xtream channel with matching EPG ID
    const xmltvName = 'ESPN';
    const xtreamName = 'ESPN HD';

    // WHEN: Score calculated with EPG ID match
    // @ts-expect-error - Command does not exist yet (RED phase)
    const scoreWithEpgMatch = await window.__TAURI__.invoke('calculate_match_score', {
      xmltvName,
      xtreamName,
      epgIdMatch: true,
      exactNameMatch: false,
    });

    // @ts-expect-error - Command does not exist yet (RED phase)
    const scoreWithoutEpgMatch = await window.__TAURI__.invoke('calculate_match_score', {
      xmltvName,
      xtreamName,
      epgIdMatch: false,
      exactNameMatch: false,
    });

    // THEN: EPG ID match boosts score by 0.15
    expect(scoreWithEpgMatch).toBeGreaterThan(scoreWithoutEpgMatch);
    expect(scoreWithEpgMatch - scoreWithoutEpgMatch).toBeCloseTo(0.15, 2);

    // Expected failure: Error: Unknown command: calculate_match_score
  });

  test('AC1.5: should apply confidence threshold (default: 0.85)', async () => {
    // GIVEN: XMLTV and Xtream channels with varying similarities
    const xmltvChannel = createXmltvChannel({
      id: 1,
      displayName: 'ESPN',
    });

    const highMatchChannel = createChannel({
      id: 101,
      name: 'ESPN HD', // Should match (score > 0.85)
    });

    const lowMatchChannel = createChannel({
      id: 102,
      name: 'Fox Sports', // Should NOT match (score < 0.85)
    });

    // NOTE: Database seeding needed
    // await seedDatabase({ xmltvChannels: [xmltvChannel], xtreamChannels: [highMatchChannel, lowMatchChannel] });

    // WHEN: Matching runs with default threshold
    // @ts-expect-error - Command does not exist yet (RED phase)
    const result = await window.__TAURI__.invoke('run_channel_matching', {
      threshold: 0.85,
    });

    // THEN: Only high-confidence matches are stored
    // @ts-expect-error - Command does not exist yet (RED phase)
    const mappings = await window.__TAURI__.invoke('get_channel_mappings', {
      xmltvChannelId: 1,
    });

    expect(mappings.length).toBe(1);
    expect(mappings[0].xtreamChannelId).toBe(101);
    expect(mappings[0].matchConfidence).toBeGreaterThanOrEqual(0.85);

    // Expected failure: Error: Unknown command: run_channel_matching
  });
});

test.describe('One-to-Many Mappings (AC2)', () => {
  test('AC2.1: should create multiple mappings for one XMLTV channel', async () => {
    // GIVEN: One XMLTV channel matches multiple Xtream streams
    const xmltvChannel = createXmltvChannel({
      id: 1,
      channelId: 'espn.us',
      displayName: 'ESPN',
    });

    const xtreamChannels = [
      createChannel({ id: 101, name: 'ESPN HD', epgChannelId: 'espn.us' }),
      createChannel({ id: 102, name: 'ESPN SD', epgChannelId: 'espn.us' }),
      createChannel({ id: 103, name: 'ESPN 4K', epgChannelId: 'espn.us' }),
    ];

    // NOTE: Database seeding needed
    // await seedDatabase({ xmltvChannels: [xmltvChannel], xtreamChannels });

    // WHEN: Matching completes
    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('run_channel_matching', { threshold: 0.85 });

    // THEN: All matching streams are stored
    // @ts-expect-error - Command does not exist yet (RED phase)
    const mappings = await window.__TAURI__.invoke('get_channel_mappings', {
      xmltvChannelId: 1,
    });

    expect(mappings.length).toBe(3);
    expect(mappings.map((m: any) => m.xtreamChannelId)).toEqual([101, 102, 103]);

    // Expected failure: Error: Unknown command: run_channel_matching
  });

  test('AC2.2: should mark highest-confidence match as primary', async () => {
    // GIVEN: Multiple Xtream streams match one XMLTV channel
    const channelSet = createESPNChannelSet();

    // NOTE: Database seeding needed
    // await seedDatabase({ xmltvChannelId: channelSet.xmltvChannelId, mappings: channelSet.mappings });

    // WHEN: Matching completes
    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('run_channel_matching', { threshold: 0.85 });

    // THEN: Best match is marked as primary
    // @ts-expect-error - Command does not exist yet (RED phase)
    const mappings = await window.__TAURI__.invoke('get_channel_mappings', {
      xmltvChannelId: channelSet.xmltvChannelId,
    });

    const primaryMapping = mappings.find((m: any) => m.isPrimary === true);
    expect(primaryMapping).toBeDefined();
    expect(primaryMapping.streamPriority).toBe(0);
    expect(primaryMapping.matchConfidence).toBeGreaterThan(0.95);

    // Expected failure: Error: Unknown command: run_channel_matching
  });

  test('AC2.3: should store failover sources with priority ordering', async () => {
    // GIVEN: Multiple matches for one XMLTV channel
    const channelSet = createESPNChannelSet();

    // NOTE: Database seeding needed

    // WHEN: Matching completes
    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('run_channel_matching', { threshold: 0.85 });

    // THEN: Non-primary matches are available as failover
    // @ts-expect-error - Command does not exist yet (RED phase)
    const mappings = await window.__TAURI__.invoke('get_channel_mappings', {
      xmltvChannelId: channelSet.xmltvChannelId,
    });

    const failoverMappings = mappings.filter((m: any) => m.isPrimary === false);
    expect(failoverMappings.length).toBeGreaterThan(0);

    // Verify priority ordering (0, 1, 2...)
    const priorities = failoverMappings.map((m: any) => m.streamPriority);
    expect(priorities).toEqual(priorities.slice().sort((a: number, b: number) => a - b));

    // Expected failure: Error: Unknown command: run_channel_matching
  });
});

test.describe('Unmatched Channels (AC3)', () => {
  test('AC3.1: should handle XMLTV channels with no matches', async () => {
    // GIVEN: XMLTV channel with no matching Xtream streams
    const xmltvChannel = createXmltvChannel({
      id: 1,
      displayName: 'Obscure Local Channel',
    });

    const xtreamChannel = createChannel({
      id: 101,
      name: 'Completely Different Channel',
    });

    // NOTE: Database seeding needed
    // await seedDatabase({ xmltvChannels: [xmltvChannel], xtreamChannels: [xtreamChannel] });

    // WHEN: Matching completes
    // @ts-expect-error - Command does not exist yet (RED phase)
    const result = await window.__TAURI__.invoke('run_channel_matching', {
      threshold: 0.85,
    });

    // THEN: XMLTV channel exists with no mapped streams
    // @ts-expect-error - Command does not exist yet (RED phase)
    const mappings = await window.__TAURI__.invoke('get_channel_mappings', {
      xmltvChannelId: 1,
    });

    expect(mappings.length).toBe(0);

    // Expected failure: Error: Unknown command: run_channel_matching
  });

  test('AC3.2: should set is_enabled = false for unmatched channels', async () => {
    // GIVEN: XMLTV channel with no matches
    const xmltvChannel = createXmltvChannel({
      id: 1,
      displayName: 'Unmatched Channel',
    });

    // NOTE: Database seeding needed
    // await seedDatabase({ xmltvChannels: [xmltvChannel], xtreamChannels: [] });

    // WHEN: Matching completes
    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('run_channel_matching', { threshold: 0.85 });

    // THEN: Channel settings created with is_enabled = false
    // @ts-expect-error - Command does not exist yet (RED phase)
    const settings = await window.__TAURI__.invoke('get_xmltv_channel_settings', {
      xmltvChannelId: 1,
    });

    expect(settings.isEnabled).toBe(false);

    // Expected failure: Error: Unknown command: run_channel_matching
  });

  test('AC3.3: should show unmatched status in match stats', async () => {
    // GIVEN: Mix of matched and unmatched XMLTV channels
    const xmltvChannels = [
      createXmltvChannel({ id: 1, displayName: 'ESPN' }),
      createXmltvChannel({ id: 2, displayName: 'Unmatched Channel' }),
    ];

    const xtreamChannels = [
      createChannel({ id: 101, name: 'ESPN HD' }), // Matches xmltv #1
    ];

    // NOTE: Database seeding needed
    // await seedDatabase({ xmltvChannels, xtreamChannels });

    // WHEN: Matching completes
    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('run_channel_matching', { threshold: 0.85 });

    // THEN: Match stats show unmatched count
    // @ts-expect-error - Command does not exist yet (RED phase)
    const stats = await window.__TAURI__.invoke('get_match_stats');

    expect(stats.totalXmltv).toBe(2);
    expect(stats.matched).toBe(1);
    expect(stats.unmatched).toBe(1);

    // Expected failure: Error: Unknown command: run_channel_matching
  });
});

test.describe('Performance Requirements (AC4)', () => {
  test('AC4: should match 1000+ channels within 60 seconds', async () => {
    // GIVEN: 1000 XMLTV channels and 1000 Xtream channels
    const xmltvChannels = Array.from({ length: 1000 }, (_, i) =>
      createXmltvChannel({
        id: i + 1,
        displayName: `Channel ${i + 1}`,
      })
    );

    const xtreamChannels = Array.from({ length: 1000 }, (_, i) =>
      createChannel({
        id: i + 1001,
        name: `Channel ${i + 1} HD`,
      })
    );

    // NOTE: Database seeding needed
    // await seedDatabase({ xmltvChannels, xtreamChannels });

    // WHEN: Matching runs
    const startTime = Date.now();

    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('run_channel_matching', { threshold: 0.85 });

    const duration = Date.now() - startTime;

    // THEN: Completes within 60 seconds (NFR3)
    expect(duration).toBeLessThan(60000);

    // Expected failure: Error: Unknown command: run_channel_matching
  }, 120000); // 2 minute timeout for test
});

test.describe('Match Statistics API', () => {
  test('should return current matching statistics', async () => {
    // GIVEN: Channels have been matched
    // NOTE: Database seeding needed with various match scenarios

    // WHEN: Getting match stats
    // @ts-expect-error - Command does not exist yet (RED phase)
    const stats = await window.__TAURI__.invoke('get_match_stats');

    // THEN: Stats include all required fields
    expect(stats).toHaveProperty('totalXmltv');
    expect(stats).toHaveProperty('totalXtream');
    expect(stats).toHaveProperty('matched');
    expect(stats).toHaveProperty('unmatched');
    expect(stats.totalXmltv).toBeGreaterThanOrEqual(0);

    // Expected failure: Error: Unknown command: get_match_stats
  });
});

test.describe('Configurable Threshold', () => {
  test('should get/set matching threshold', async () => {
    // GIVEN: Default threshold is 0.85
    // @ts-expect-error - Command does not exist yet (RED phase)
    const defaultThreshold = await window.__TAURI__.invoke('get_match_threshold');
    expect(defaultThreshold).toBe(0.85);

    // WHEN: Setting new threshold
    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('set_match_threshold', { threshold: 0.90 });

    // THEN: Threshold is updated
    // @ts-expect-error - Command does not exist yet (RED phase)
    const newThreshold = await window.__TAURI__.invoke('get_match_threshold');
    expect(newThreshold).toBe(0.90);

    // Expected failure: Error: Unknown command: get_match_threshold
  });
});
