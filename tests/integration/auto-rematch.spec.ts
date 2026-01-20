import { test, expect } from '@playwright/test';
import { createXmltvChannel } from '../support/factories/xmltv-channel.factory';
import { createChannel } from '../support/factories/channel.factory';
import { createChannelMapping } from '../support/factories/channel-mapping.factory';
import {
  createProviderChanges,
  createNewStream,
  createRemovedStreamMapping,
  createChangedStream,
} from '../support/factories/provider-changes.factory';

/**
 * Integration Tests for Auto-Rematch on Provider Changes (Story 3-4)
 *
 * Test Level: Integration (Tauri commands + database)
 * Framework: Playwright Test
 * Focus: Provider change detection, auto-rematch, manual match preservation
 *
 * RED PHASE: These tests MUST fail initially (missing implementation)
 * Expected failures: Commands not registered, auto_rematch module missing, event_log table missing
 *
 * Run with: TAURI_DEV=true pnpm test -- tests/integration/auto-rematch.spec.ts
 */

test.describe('Auto-Rematch: Provider Change Detection (AC1)', () => {
  test('AC1.1: should detect new Xtream streams not in database', async () => {
    // GIVEN: Database has existing channels from previous scan
    const existingStream = createChannel({
      stream_id: 100,
      name: 'ESPN HD',
    });

    // Simulated database state (would be seeded via API/fixture)
    // await seedDatabase({ xtreamChannels: [existingStream] });

    // WHEN: New scan returns additional streams
    const currentStreams = [
      existingStream,
      createChannel({ stream_id: 200, name: 'CNN HD' }), // NEW
      createChannel({ stream_id: 300, name: 'Fox News HD' }), // NEW
    ];

    // @ts-expect-error - Command does not exist yet (RED phase)
    const changes = await window.__TAURI__.invoke('detect_provider_changes', {
      accountId: 1,
      currentStreams: currentStreams,
    });

    // THEN: New streams are detected
    expect(changes.newStreams).toHaveLength(2);
    expect(changes.newStreams[0].stream_id).toBe(200);
    expect(changes.newStreams[1].stream_id).toBe(300);

    // Expected failure: Error: Unknown command: detect_provider_changes
  });

  test('AC1.2: should detect removed Xtream streams missing from provider', async () => {
    // GIVEN: Database has streams that provider no longer offers
    const removedStream1 = createChannel({ stream_id: 100, name: 'Old Channel 1' });
    const removedStream2 = createChannel({ stream_id: 101, name: 'Old Channel 2' });
    const stillActiveStream = createChannel({ stream_id: 102, name: 'Active Channel' });

    // Simulated database state
    // await seedDatabase({ xtreamChannels: [removedStream1, removedStream2, stillActiveStream] });

    // WHEN: New scan returns fewer streams
    const currentStreams = [
      stillActiveStream, // Only this one remains
    ];

    // @ts-expect-error - Command does not exist yet (RED phase)
    const changes = await window.__TAURI__.invoke('detect_provider_changes', {
      accountId: 1,
      currentStreams: currentStreams,
    });

    // THEN: Removed streams are detected
    expect(changes.removedStreamIds).toHaveLength(2);
    expect(changes.removedStreamIds).toContain(100);
    expect(changes.removedStreamIds).toContain(101);

    // Expected failure: Error: Unknown command: detect_provider_changes
  });

  test('AC1.3: should detect changed Xtream streams (name/icon/qualities)', async () => {
    // GIVEN: Database has stream with old metadata
    const oldVersion = createChannel({
      stream_id: 100,
      name: 'ESPN',
      stream_icon: 'http://old.com/espn.png',
      qualities: JSON.stringify(['HD']),
    });

    // Simulated database state
    // await seedDatabase({ xtreamChannels: [oldVersion] });

    // WHEN: New scan returns same stream_id with updated metadata
    const newVersion = createChannel({
      stream_id: 100,
      name: 'ESPN Sports Network', // Name changed
      stream_icon: 'http://new.com/espn.png', // Icon changed
      qualities: JSON.stringify(['HD', '4K']), // Qualities changed
    });

    const currentStreams = [newVersion];

    // @ts-expect-error - Command does not exist yet (RED phase)
    const changes = await window.__TAURI__.invoke('detect_provider_changes', {
      accountId: 1,
      currentStreams: currentStreams,
    });

    // THEN: Changed streams are detected
    expect(changes.changedStreams).toHaveLength(1);
    expect(changes.changedStreams[0].oldStream.name).toBe('ESPN');
    expect(changes.changedStreams[0].newStream.name).toBe('ESPN Sports Network');

    // Expected failure: Error: Unknown command: detect_provider_changes
  });
});

test.describe('Auto-Rematch: Match New Streams (AC2)', () => {
  test('AC2.1: should auto-match new streams to XMLTV channels', async () => {
    // GIVEN: XMLTV channels exist without matches
    const xmltvESPN = createXmltvChannel({
      id: 1,
      channel_id: 'espn.us',
      display_name: 'ESPN',
    });

    const xmltvCNN = createXmltvChannel({
      id: 2,
      channel_id: 'cnn.us',
      display_name: 'CNN',
    });

    // Simulated database state
    // await seedDatabase({ xmltvChannels: [xmltvESPN, xmltvCNN] });

    // WHEN: New streams are scanned
    const newStreams = [
      createChannel({ stream_id: 200, name: 'ESPN HD' }),
      createChannel({ stream_id: 201, name: 'CNN HD' }),
    ];

    // @ts-expect-error - Command does not exist yet (RED phase)
    const result = await window.__TAURI__.invoke('scan_and_rematch_channels', {
      accountId: 1,
    });

    // THEN: New streams are auto-matched
    expect(result.newMatchesCreated).toBe(2);
    expect(result.changes.newStreams).toBe(2);

    // Verify mappings created with is_manual=false
    // @ts-expect-error - Command does not exist yet (RED phase)
    const mappings = await window.__TAURI__.invoke('get_channel_mappings', {
      xmltvChannelId: 1,
    });

    expect(mappings).toHaveLength(1);
    expect(mappings[0].is_manual).toBe(false);
    expect(mappings[0].match_confidence).toBeGreaterThan(0.85);

    // Expected failure: Error: Unknown command: scan_and_rematch_channels
  });

  test('AC2.2: should add new matches as backups not primary', async () => {
    // GIVEN: XMLTV channel already has a primary match
    const xmltvESPN = createXmltvChannel({
      id: 1,
      channel_id: 'espn.us',
      display_name: 'ESPN',
    });

    const existingStream = createChannel({
      id: 100,
      stream_id: 100,
      name: 'ESPN HD',
    });

    const existingMapping = createChannelMapping({
      xmltv_channel_id: 1,
      xtream_channel_id: 100,
      is_primary: true,
      stream_priority: 0,
      is_manual: false,
    });

    // Simulated database state
    // await seedDatabase({
    //   xmltvChannels: [xmltvESPN],
    //   xtreamChannels: [existingStream],
    //   channelMappings: [existingMapping],
    // });

    // WHEN: New similar stream is discovered
    const newStream = createChannel({
      stream_id: 200,
      name: 'ESPN FHD',
    });

    // @ts-expect-error - Command does not exist yet (RED phase)
    const result = await window.__TAURI__.invoke('scan_and_rematch_channels', {
      accountId: 1,
    });

    // THEN: New match is added as backup
    expect(result.newMatchesCreated).toBe(1);

    // @ts-expect-error - Command does not exist yet (RED phase)
    const mappings = await window.__TAURI__.invoke('get_channel_mappings', {
      xmltvChannelId: 1,
    });

    // Should have 2 mappings now
    expect(mappings).toHaveLength(2);

    // Original remains primary
    const primaryMapping = mappings.find((m: any) => m.is_primary);
    expect(primaryMapping.xtream_channel_id).toBe(100);

    // New mapping is backup
    const backupMapping = mappings.find((m: any) => !m.is_primary);
    expect(backupMapping.xtream_channel_id).toBe(200);
    expect(backupMapping.stream_priority).toBe(1);

    // Expected failure: Error: Unknown command: scan_and_rematch_channels
  });
});

test.describe('Auto-Rematch: Handle Removed Streams (AC3)', () => {
  test('AC3.1: should remove auto-generated mappings for deleted streams', async () => {
    // GIVEN: Channel mapping exists for stream that will be removed
    const xmltvESPN = createXmltvChannel({
      id: 1,
      channel_id: 'espn.us',
      display_name: 'ESPN',
    });

    const removedStream = createChannel({
      id: 100,
      stream_id: 100,
      name: 'ESPN HD',
    });

    const autoMapping = createChannelMapping({
      xmltv_channel_id: 1,
      xtream_channel_id: 100,
      is_manual: false, // Auto-generated
      is_primary: true,
    });

    // Simulated database state
    // await seedDatabase({
    //   xmltvChannels: [xmltvESPN],
    //   xtreamChannels: [removedStream],
    //   channelMappings: [autoMapping],
    // });

    // WHEN: Stream is removed by provider (not in new scan)
    // @ts-expect-error - Command does not exist yet (RED phase)
    const result = await window.__TAURI__.invoke('scan_and_rematch_channels', {
      accountId: 1,
    });

    // THEN: Auto-generated mapping is deleted
    expect(result.mappingsRemoved).toBe(1);
    expect(result.changes.removedStreams).toBe(1);

    // @ts-expect-error - Command does not exist yet (RED phase)
    const mappings = await window.__TAURI__.invoke('get_channel_mappings', {
      xmltvChannelId: 1,
    });

    expect(mappings).toHaveLength(0);

    // Expected failure: Error: Unknown command: scan_and_rematch_channels
  });

  test('AC3.2: should promote backup stream when primary removed', async () => {
    // GIVEN: Channel has primary and backup mappings
    const xmltvESPN = createXmltvChannel({
      id: 1,
      channel_id: 'espn.us',
      display_name: 'ESPN',
    });

    const primaryStream = createChannel({
      id: 100,
      stream_id: 100,
      name: 'ESPN HD',
    });

    const backupStream = createChannel({
      id: 101,
      stream_id: 101,
      name: 'ESPN FHD',
    });

    const primaryMapping = createChannelMapping({
      xmltv_channel_id: 1,
      xtream_channel_id: 100,
      is_primary: true,
      stream_priority: 0,
      match_confidence: 0.95,
      is_manual: false,
    });

    const backupMapping = createChannelMapping({
      xmltv_channel_id: 1,
      xtream_channel_id: 101,
      is_primary: false,
      stream_priority: 1,
      match_confidence: 0.90,
      is_manual: false,
    });

    // Simulated database state
    // await seedDatabase({
    //   xmltvChannels: [xmltvESPN],
    //   xtreamChannels: [primaryStream, backupStream],
    //   channelMappings: [primaryMapping, backupMapping],
    // });

    // WHEN: Primary stream is removed (only backup remains)
    // @ts-expect-error - Command does not exist yet (RED phase)
    const result = await window.__TAURI__.invoke('scan_and_rematch_channels', {
      accountId: 1,
    });

    // THEN: Backup is promoted to primary
    expect(result.mappingsRemoved).toBe(1);

    // @ts-expect-error - Command does not exist yet (RED phase)
    const mappings = await window.__TAURI__.invoke('get_channel_mappings', {
      xmltvChannelId: 1,
    });

    expect(mappings).toHaveLength(1);
    expect(mappings[0].xtream_channel_id).toBe(101); // Backup stream
    expect(mappings[0].is_primary).toBe(true); // Now primary
    expect(mappings[0].stream_priority).toBe(0); // Priority recalculated

    // Expected failure: Error: Unknown command: scan_and_rematch_channels
  });
});

test.describe('Auto-Rematch: Preserve Manual Matches (AC4)', () => {
  test('AC4: should NEVER remove or change manual matches', async () => {
    // GIVEN: Manual match exists for stream that will be removed
    const xmltvESPN = createXmltvChannel({
      id: 1,
      channel_id: 'espn.us',
      display_name: 'ESPN',
    });

    const manuallyMatchedStream = createChannel({
      id: 100,
      stream_id: 100,
      name: 'Some Random Stream', // User manually matched this
    });

    const manualMapping = createChannelMapping({
      xmltv_channel_id: 1,
      xtream_channel_id: 100,
      is_manual: true, // MANUAL match
      is_primary: true,
      match_confidence: 1.0,
    });

    // Simulated database state
    // await seedDatabase({
    //   xmltvChannels: [xmltvESPN],
    //   xtreamChannels: [manuallyMatchedStream],
    //   channelMappings: [manualMapping],
    // });

    // WHEN: Stream is removed by provider (not in new scan)
    // @ts-expect-error - Command does not exist yet (RED phase)
    const result = await window.__TAURI__.invoke('scan_and_rematch_channels', {
      accountId: 1,
    });

    // THEN: Manual match is PRESERVED (not deleted)
    expect(result.manualMatchesPreserved).toBe(1);
    expect(result.mappingsRemoved).toBe(0); // No mappings removed

    // @ts-expect-error - Command does not exist yet (RED phase)
    const mappings = await window.__TAURI__.invoke('get_channel_mappings', {
      xmltvChannelId: 1,
    });

    expect(mappings).toHaveLength(1);
    expect(mappings[0].is_manual).toBe(true);
    expect(mappings[0].xtream_channel_id).toBe(100);

    // Note: UI should show warning that stream is unavailable
    // but mapping is kept because user explicitly created it

    // Expected failure: Error: Unknown command: scan_and_rematch_channels
  });
});

test.describe('Auto-Rematch: Full Workflow Integration', () => {
  test('should handle complex scenario with new, removed, and changed streams', async () => {
    // GIVEN: Complex initial state
    const xmltvChannels = [
      createXmltvChannel({ id: 1, display_name: 'ESPN' }),
      createXmltvChannel({ id: 2, display_name: 'CNN' }),
      createXmltvChannel({ id: 3, display_name: 'Fox News' }),
    ];

    const existingStreams = [
      createChannel({ id: 100, stream_id: 100, name: 'ESPN HD' }), // Will be removed
      createChannel({ id: 101, stream_id: 101, name: 'CNN HD' }), // Will stay
      createChannel({ id: 102, stream_id: 102, name: 'Fox News' }), // Will be changed
    ];

    const existingMappings = [
      createChannelMapping({
        xmltv_channel_id: 1,
        xtream_channel_id: 100,
        is_manual: false,
      }),
      createChannelMapping({
        xmltv_channel_id: 2,
        xtream_channel_id: 101,
        is_manual: true, // Manual match
      }),
      createChannelMapping({
        xmltv_channel_id: 3,
        xtream_channel_id: 102,
        is_manual: false,
      }),
    ];

    // Simulated database state
    // await seedDatabase({
    //   xmltvChannels,
    //   xtreamChannels: existingStreams,
    //   channelMappings: existingMappings,
    // });

    // WHEN: Provider scan returns changes
    // - ESPN HD removed
    // - CNN HD unchanged
    // - Fox News renamed to "Fox News HD"
    // - BBC News HD added (new)
    // @ts-expect-error - Command does not exist yet (RED phase)
    const result = await window.__TAURI__.invoke('scan_and_rematch_channels', {
      accountId: 1,
    });

    // THEN: Changes are properly handled
    expect(result.changes.removedStreams).toBe(1); // ESPN HD
    expect(result.changes.changedStreams).toBe(1); // Fox News
    expect(result.changes.newStreams).toBe(1); // BBC News HD

    expect(result.mappingsRemoved).toBe(1); // ESPN HD auto-match removed
    expect(result.manualMatchesPreserved).toBe(1); // CNN HD manual match kept
    expect(result.mappingsUpdated).toBe(1); // Fox News mapping updated
    expect(result.newMatchesCreated).toBeGreaterThanOrEqual(0); // BBC News might match

    // Expected failure: Error: Unknown command: scan_and_rematch_channels
  });
});
