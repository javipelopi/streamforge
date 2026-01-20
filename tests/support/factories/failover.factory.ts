import { faker } from '@faker-js/faker';

/**
 * Data Factory: Stream Failover
 * Story 4-5: Automatic Stream Failover
 *
 * Creates test data for failover scenarios with primary + backup streams.
 * Supports multiple backup streams with priority ordering.
 */

export interface FailoverStream {
  xtream_channel_id: number;
  stream_id: number;
  stream_priority: number;
  is_primary: boolean;
  qualities: string[];
  server_url: string;
  account_id: number;
  is_active: boolean;
}

export interface FailoverScenario {
  xmltv_channel_id: number;
  xmltv_channel_name: string;
  is_enabled: boolean;
  streams: FailoverStream[];
}

/**
 * Create a single failover stream
 * @param overrides - Optional field overrides
 */
export function createFailoverStream(overrides: Partial<FailoverStream> = {}): FailoverStream {
  return {
    xtream_channel_id: faker.number.int({ min: 1, max: 1000 }),
    stream_id: faker.number.int({ min: 1, max: 10000 }),
    stream_priority: faker.number.int({ min: 0, max: 5 }),
    is_primary: false,
    qualities: ['4K', 'FHD', 'HD', 'SD'],
    server_url: `http://${faker.internet.ip()}:${faker.internet.port()}`,
    account_id: faker.number.int({ min: 1, max: 100 }),
    is_active: true,
    ...overrides,
  };
}

/**
 * Create primary stream with highest priority
 */
export function createPrimaryStream(overrides: Partial<FailoverStream> = {}): FailoverStream {
  return createFailoverStream({
    stream_priority: 0,
    is_primary: true,
    qualities: ['4K', 'FHD', 'HD', 'SD'],
    ...overrides,
  });
}

/**
 * Create backup stream with lower priority
 */
export function createBackupStream(priority: number, overrides: Partial<FailoverStream> = {}): FailoverStream {
  return createFailoverStream({
    stream_priority: priority,
    is_primary: false,
    ...overrides,
  });
}

/**
 * Create unreachable stream (server down)
 */
export function createUnreachableStream(priority: number = 0): FailoverStream {
  return createFailoverStream({
    stream_priority: priority,
    server_url: 'http://192.0.2.1:9999', // TEST-NET-1 (unreachable)
    is_active: true,
  });
}

/**
 * Create stream from inactive account
 */
export function createInactiveStream(priority: number = 1): FailoverStream {
  return createFailoverStream({
    stream_priority: priority,
    is_active: false,
  });
}

/**
 * Create complete failover scenario with primary + backups
 * @param backupCount - Number of backup streams (default: 2)
 */
export function createFailoverScenario(
  backupCount: number = 2,
  overrides: Partial<FailoverScenario> = {}
): FailoverScenario {
  const streams: FailoverStream[] = [
    createPrimaryStream(), // Priority 0
  ];

  // Add backup streams with increasing priority
  for (let i = 1; i <= backupCount; i++) {
    streams.push(createBackupStream(i));
  }

  return {
    xmltv_channel_id: faker.number.int({ min: 1, max: 1000 }),
    xmltv_channel_name: faker.company.buzzNoun(),
    is_enabled: true,
    streams,
    ...overrides,
  };
}

/**
 * Create scenario where primary fails but backup succeeds
 */
export function createPrimaryFailsScenario(): FailoverScenario {
  return createFailoverScenario(1, {
    streams: [
      createUnreachableStream(0), // Primary fails
      createBackupStream(1), // Backup succeeds
    ],
  });
}

/**
 * Create scenario where all streams fail
 */
export function createAllStreamsFailScenario(): FailoverScenario {
  return createFailoverScenario(2, {
    streams: [
      createUnreachableStream(0), // Primary fails
      createUnreachableStream(1), // Backup 1 fails
      createUnreachableStream(2), // Backup 2 fails
    ],
  });
}

/**
 * Create scenario with no backup streams
 */
export function createNoBackupsScenario(): FailoverScenario {
  return createFailoverScenario(0, {
    streams: [
      createPrimaryStream(), // Only primary, no backups
    ],
  });
}

/**
 * Create scenario with same quality across all streams
 */
export function createSameQualityScenario(): FailoverScenario {
  const quality = ['HD', 'SD'];
  return createFailoverScenario(2, {
    streams: [
      createPrimaryStream({ qualities: quality }),
      createBackupStream(1, { qualities: quality }),
      createBackupStream(2, { qualities: quality }),
    ],
  });
}

/**
 * Create scenario with mixed quality backups
 */
export function createMixedQualityScenario(): FailoverScenario {
  return createFailoverScenario(2, {
    streams: [
      createPrimaryStream({ qualities: ['4K', 'FHD', 'HD', 'SD'] }),
      createBackupStream(1, { qualities: ['FHD', 'HD', 'SD'] }), // No 4K
      createBackupStream(2, { qualities: ['HD', 'SD'] }), // Lower quality
    ],
  });
}

/**
 * Create scenario with inactive account backup
 */
export function createInactiveBackupScenario(): FailoverScenario {
  return createFailoverScenario(2, {
    streams: [
      createUnreachableStream(0), // Primary fails
      createInactiveStream(1), // Backup 1 inactive (should be skipped)
      createBackupStream(2), // Backup 2 active (should be used)
    ],
  });
}

/**
 * Create scenario with out-of-order priorities
 */
export function createUnorderedPriorityScenario(): FailoverScenario {
  return createFailoverScenario(0, {
    streams: [
      createBackupStream(2), // Out of order
      createPrimaryStream({ stream_priority: 0 }),
      createBackupStream(1), // Out of order
    ],
  });
}

/**
 * Create multiple failover scenarios for bulk testing
 */
export function createFailoverScenarios(count: number): FailoverScenario[] {
  return Array.from({ length: count }, (_, i) => createFailoverScenario(2, {
    xmltv_channel_id: i + 1,
    xmltv_channel_name: `Channel ${i + 1}`,
  }));
}

/**
 * Create failover event log entry
 */
export interface FailoverEvent {
  level: 'warn' | 'error';
  category: string;
  message: string;
  details: {
    channel_id: number;
    from_stream_id: number;
    to_stream_id: number | null;
    reason: string;
    timestamp: string;
  };
  created_at: string;
}

export function createFailoverEvent(overrides: Partial<FailoverEvent> = {}): FailoverEvent {
  const channelId = faker.number.int({ min: 1, max: 100 });
  const fromStreamId = faker.number.int({ min: 1, max: 1000 });
  const toStreamId = faker.number.int({ min: 1, max: 1000 });
  const timestamp = faker.date.recent().toISOString();

  return {
    level: 'warn',
    category: 'stream',
    message: `Stream failover for channel ${channelId}`,
    details: {
      channel_id: channelId,
      from_stream_id: fromStreamId,
      to_stream_id: toStreamId,
      reason: 'ConnectionTimeout',
      timestamp,
    },
    created_at: timestamp,
    ...overrides,
  };
}

export function createFailoverFailedEvent(channelId: number, fromStreamId: number): FailoverEvent {
  return createFailoverEvent({
    level: 'error',
    message: `All streams failed for channel ${channelId}`,
    details: {
      channel_id: channelId,
      from_stream_id: fromStreamId,
      to_stream_id: null, // No backup available
      reason: 'AllStreamsExhausted',
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Create connection timeout event
 */
export function createTimeoutFailoverEvent(): FailoverEvent {
  return createFailoverEvent({
    details: {
      channel_id: faker.number.int({ min: 1, max: 100 }),
      from_stream_id: faker.number.int({ min: 1, max: 1000 }),
      to_stream_id: faker.number.int({ min: 1, max: 1000 }),
      reason: 'ConnectionTimeout',
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Create HTTP error event
 */
export function createHttpErrorFailoverEvent(statusCode: number = 404): FailoverEvent {
  return createFailoverEvent({
    details: {
      channel_id: faker.number.int({ min: 1, max: 100 }),
      from_stream_id: faker.number.int({ min: 1, max: 1000 }),
      to_stream_id: faker.number.int({ min: 1, max: 1000 }),
      reason: `HttpError(${statusCode})`,
      timestamp: new Date().toISOString(),
    },
  });
}
