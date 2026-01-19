import { faker } from '@faker-js/faker';

/**
 * Event Log Factories
 *
 * Factory functions for creating event log test data.
 * Used in Story 3-4 event logging tests.
 */

export type EventLevel = 'info' | 'warn' | 'error';
export type EventCategory =
  | 'connection'
  | 'stream'
  | 'match'
  | 'epg'
  | 'system'
  | 'provider';

export interface EventLog {
  id?: number;
  timestamp?: string;
  level: EventLevel;
  category: EventCategory;
  message: string;
  details?: string;
  is_read?: boolean;
}

/**
 * Create generic event log entry
 *
 * @param overrides - Optional field overrides
 * @returns EventLog object
 *
 * @example
 * const event = createEventLog({
 *   level: 'error',
 *   category: 'connection',
 *   message: 'Failed to connect to IPTV provider'
 * });
 */
export const createEventLog = (overrides: Partial<EventLog> = {}): EventLog => ({
  id: overrides.id || faker.number.int({ min: 1, max: 10000 }),
  timestamp: overrides.timestamp || new Date().toISOString(),
  level: overrides.level || faker.helpers.arrayElement(['info', 'warn', 'error']),
  category: overrides.category || faker.helpers.arrayElement([
    'connection',
    'stream',
    'match',
    'epg',
    'system',
    'provider',
  ]),
  message: overrides.message || faker.lorem.sentence(),
  details: overrides.details || JSON.stringify({
    context: faker.lorem.words(3),
    additionalInfo: faker.lorem.sentence(),
  }),
  is_read: overrides.is_read !== undefined ? overrides.is_read : false,
});

/**
 * Create provider category event (Story 3-4 specific)
 *
 * @param overrides - Optional field overrides
 * @returns EventLog with provider category
 *
 * @example
 * const providerEvent = createProviderEvent({
 *   message: 'Provider changes detected: 5 new, 2 removed'
 * });
 */
export const createProviderEvent = (
  overrides: Partial<EventLog> = {}
): EventLog => {
  const newStreams = faker.number.int({ min: 0, max: 20 });
  const removedStreams = faker.number.int({ min: 0, max: 10 });
  const changedStreams = faker.number.int({ min: 0, max: 15 });

  const details = overrides.details || JSON.stringify({
    newStreams,
    removedStreams,
    changedStreams,
    affectedXmltvChannels: faker.number.int({ min: 0, max: 30 }),
    scanDurationMs: faker.number.int({ min: 1000, max: 30000 }),
  });

  return createEventLog({
    level: 'info',
    category: 'provider',
    message: overrides.message || `Provider changes detected: ${newStreams} new, ${removedStreams} removed, ${changedStreams} changed`,
    details,
    ...overrides,
  });
};

/**
 * Create info level event
 *
 * @param overrides - Optional field overrides
 * @returns EventLog with info level
 *
 * @example
 * const infoEvent = createInfoEvent({
 *   category: 'system',
 *   message: 'Application started successfully'
 * });
 */
export const createInfoEvent = (overrides: Partial<EventLog> = {}): EventLog => {
  return createEventLog({
    level: 'info',
    ...overrides,
  });
};

/**
 * Create warning level event
 *
 * @param overrides - Optional field overrides
 * @returns EventLog with warn level
 *
 * @example
 * const warnEvent = createWarnEvent({
 *   category: 'stream',
 *   message: 'Stream quality degraded'
 * });
 */
export const createWarnEvent = (overrides: Partial<EventLog> = {}): EventLog => {
  return createEventLog({
    level: 'warn',
    message: overrides.message || faker.helpers.arrayElement([
      'Connection timeout increased',
      'Stream buffering detected',
      'EPG data outdated',
      'Manual match for unavailable stream',
    ]),
    ...overrides,
  });
};

/**
 * Create error level event
 *
 * @param overrides - Optional field overrides
 * @returns EventLog with error level
 *
 * @example
 * const errorEvent = createErrorEvent({
 *   category: 'connection',
 *   message: 'Failed to authenticate with IPTV provider'
 * });
 */
export const createErrorEvent = (
  overrides: Partial<EventLog> = {}
): EventLog => {
  return createEventLog({
    level: 'error',
    message: overrides.message || faker.helpers.arrayElement([
      'Failed to connect to IPTV provider',
      'Authentication failed',
      'EPG refresh failed',
      'Database connection lost',
      'Stream playback error',
    ]),
    details: overrides.details || JSON.stringify({
      error: faker.lorem.sentence(),
      stackTrace: faker.lorem.lines(3),
      timestamp: new Date().toISOString(),
    }),
    ...overrides,
  });
};

/**
 * Create connection event
 *
 * @param success - Whether connection was successful
 * @param overrides - Optional field overrides
 * @returns EventLog for connection category
 *
 * @example
 * const connectionEvent = createConnectionEvent(false, {
 *   message: 'Connection timeout'
 * });
 */
export const createConnectionEvent = (
  success: boolean,
  overrides: Partial<EventLog> = {}
): EventLog => {
  return createEventLog({
    level: success ? 'info' : 'error',
    category: 'connection',
    message: success
      ? 'Connected to IPTV provider successfully'
      : 'Failed to connect to IPTV provider',
    details: JSON.stringify({
      provider: faker.internet.url(),
      attemptNumber: faker.number.int({ min: 1, max: 5 }),
      responseTimeMs: success ? faker.number.int({ min: 100, max: 3000 }) : null,
    }),
    ...overrides,
  });
};

/**
 * Create stream event
 *
 * @param overrides - Optional field overrides
 * @returns EventLog for stream category
 *
 * @example
 * const streamEvent = createStreamEvent({
 *   message: 'Stream started successfully'
 * });
 */
export const createStreamEvent = (
  overrides: Partial<EventLog> = {}
): EventLog => {
  return createEventLog({
    category: 'stream',
    message: overrides.message || faker.helpers.arrayElement([
      'Stream started successfully',
      'Stream stopped',
      'Stream quality changed',
      'Stream buffering',
    ]),
    details: JSON.stringify({
      streamId: faker.number.int({ min: 1000, max: 99999 }),
      streamName: faker.company.name(),
      quality: faker.helpers.arrayElement(['HD', 'FHD', '4K', 'SD']),
    }),
    ...overrides,
  });
};

/**
 * Create EPG event
 *
 * @param overrides - Optional field overrides
 * @returns EventLog for EPG category
 *
 * @example
 * const epgEvent = createEpgEvent({
 *   message: 'EPG data refreshed successfully'
 * });
 */
export const createEpgEvent = (overrides: Partial<EventLog> = {}): EventLog => {
  return createEventLog({
    category: 'epg',
    message: overrides.message || faker.helpers.arrayElement([
      'EPG data refreshed successfully',
      'EPG refresh failed',
      'EPG source added',
      'EPG data outdated',
    ]),
    details: JSON.stringify({
      sourceUrl: faker.internet.url(),
      channelsUpdated: faker.number.int({ min: 0, max: 500 }),
      programsAdded: faker.number.int({ min: 0, max: 10000 }),
    }),
    ...overrides,
  });
};

/**
 * Create batch of unread events
 *
 * @param count - Number of events to create
 * @returns Array of unread EventLog objects
 *
 * @example
 * const unreadEvents = createUnreadEvents(10);
 */
export const createUnreadEvents = (count: number): EventLog[] => {
  return Array.from({ length: count }, () =>
    createEventLog({
      is_read: false,
    })
  );
};

/**
 * Create batch of read events
 *
 * @param count - Number of events to create
 * @returns Array of read EventLog objects
 *
 * @example
 * const readEvents = createReadEvents(5);
 */
export const createReadEvents = (count: number): EventLog[] => {
  return Array.from({ length: count }, () =>
    createEventLog({
      is_read: true,
    })
  );
};

/**
 * Create mixed batch of read/unread events
 *
 * @param totalCount - Total number of events
 * @param unreadCount - Number of unread events
 * @returns Array of mixed EventLog objects
 *
 * @example
 * const mixedEvents = createMixedEvents(20, 8);
 * // Returns 20 events, 8 unread and 12 read
 */
export const createMixedEvents = (
  totalCount: number,
  unreadCount: number
): EventLog[] => {
  const unread = createUnreadEvents(unreadCount);
  const read = createReadEvents(totalCount - unreadCount);
  return [...unread, ...read].sort(() => Math.random() - 0.5);
};

/**
 * Create rematch complete event (Story 3-4 specific)
 *
 * @param changes - Change summary details
 * @returns EventLog for rematch completion
 *
 * @example
 * const rematchEvent = createRematchCompleteEvent({
 *   newMatchesCreated: 5,
 *   mappingsRemoved: 2,
 *   mappingsUpdated: 1
 * });
 */
export const createRematchCompleteEvent = (changes: {
  newMatchesCreated: number;
  mappingsRemoved: number;
  mappingsUpdated: number;
  manualMatchesPreserved: number;
}): EventLog => {
  return createProviderEvent({
    message: `Auto-rematch complete: ${changes.newMatchesCreated} new matches, ${changes.mappingsRemoved} removed, ${changes.mappingsUpdated} updated`,
    details: JSON.stringify(changes),
  });
};
