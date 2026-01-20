import { faker } from '@faker-js/faker';
import { createChannel } from './channel.factory';

/**
 * Provider Changes Factories
 *
 * Factory functions for creating provider change test data.
 * Used in Story 3-4 auto-rematch tests.
 */

export interface ProviderChanges {
  newStreams: XtreamChannel[];
  removedStreamIds: number[];
  changedStreams: ChangedStream[];
}

export interface XtreamChannel {
  id?: number;
  account_id?: number;
  stream_id: number;
  name: string;
  stream_icon?: string;
  category_id?: number;
  category_name?: string;
  qualities?: string;
  epg_channel_id?: string;
  tv_archive?: number;
  tv_archive_duration?: number;
  added_at?: string;
  updated_at?: string;
}

export interface ChangedStream {
  oldStream: XtreamChannel;
  newStream: XtreamChannel;
}

export interface RemovedStreamMapping {
  xmltv_channel_id: number;
  xtream_channel_id: number;
  stream_id: number;
  is_manual: boolean;
  is_primary: boolean;
}

/**
 * Create provider changes summary
 *
 * @param overrides - Optional field overrides
 * @returns ProviderChanges object
 *
 * @example
 * const changes = createProviderChanges({
 *   newStreams: [createNewStream({ name: 'CNN HD' })],
 *   removedStreamIds: [101, 102],
 * });
 */
export const createProviderChanges = (
  overrides: Partial<ProviderChanges> = {}
): ProviderChanges => ({
  newStreams: overrides.newStreams || [],
  removedStreamIds: overrides.removedStreamIds || [],
  changedStreams: overrides.changedStreams || [],
});

/**
 * Create new Xtream stream (not in database)
 *
 * @param overrides - Optional field overrides
 * @returns XtreamChannel object
 *
 * @example
 * const newStream = createNewStream({
 *   name: 'BBC News HD',
 *   epg_channel_id: 'bbc.uk'
 * });
 */
export const createNewStream = (
  overrides: Partial<XtreamChannel> = {}
): XtreamChannel => ({
  stream_id: overrides.stream_id || faker.number.int({ min: 1000, max: 99999 }),
  name: overrides.name || `${faker.company.name()} ${faker.helpers.arrayElement(['HD', 'FHD', '4K', 'SD'])}`,
  stream_icon: overrides.stream_icon || faker.image.url(),
  category_id: overrides.category_id || faker.number.int({ min: 1, max: 20 }),
  category_name: overrides.category_name || faker.helpers.arrayElement([
    'Sports',
    'News',
    'Entertainment',
    'Movies',
    'Documentary',
  ]),
  qualities: overrides.qualities || JSON.stringify(
    faker.helpers.arrayElements(['HD', 'SD', 'FHD', '4K'], { min: 1, max: 3 })
  ),
  epg_channel_id: overrides.epg_channel_id || `${faker.string.alpha({ length: 3, casing: 'lower' })}.${faker.location.countryCode().toLowerCase()}`,
  tv_archive: overrides.tv_archive !== undefined ? overrides.tv_archive : faker.datatype.boolean() ? 1 : 0,
  tv_archive_duration: overrides.tv_archive_duration || faker.number.int({ min: 0, max: 14 }),
  added_at: overrides.added_at || new Date().toISOString(),
  updated_at: overrides.updated_at || new Date().toISOString(),
  ...overrides,
});

/**
 * Create mapping for removed stream
 *
 * @param overrides - Optional field overrides
 * @returns RemovedStreamMapping object
 *
 * @example
 * const removedMapping = createRemovedStreamMapping({
 *   is_manual: true, // Manual match should be preserved
 *   is_primary: true,
 * });
 */
export const createRemovedStreamMapping = (
  overrides: Partial<RemovedStreamMapping> = {}
): RemovedStreamMapping => ({
  xmltv_channel_id: overrides.xmltv_channel_id || faker.number.int({ min: 1, max: 100 }),
  xtream_channel_id: overrides.xtream_channel_id || faker.number.int({ min: 1, max: 1000 }),
  stream_id: overrides.stream_id || faker.number.int({ min: 1000, max: 99999 }),
  is_manual: overrides.is_manual !== undefined ? overrides.is_manual : false,
  is_primary: overrides.is_primary !== undefined ? overrides.is_primary : true,
});

/**
 * Create changed stream (same stream_id, different metadata)
 *
 * @param overrides - Optional field overrides
 * @returns ChangedStream object
 *
 * @example
 * const changed = createChangedStream({
 *   oldName: 'ESPN',
 *   newName: 'ESPN Sports Network'
 * });
 */
export const createChangedStream = (
  overrides: {
    oldStream?: Partial<XtreamChannel>;
    newStream?: Partial<XtreamChannel>;
    oldName?: string;
    newName?: string;
  } = {}
): ChangedStream => {
  const streamId = faker.number.int({ min: 1000, max: 99999 });
  const oldName = overrides.oldName || `${faker.company.name()} Channel`;
  const newName = overrides.newName || `${oldName} HD`;

  const oldStream: XtreamChannel = {
    stream_id: streamId,
    name: oldName,
    stream_icon: faker.image.url(),
    qualities: JSON.stringify(['HD']),
    ...overrides.oldStream,
  };

  const newStream: XtreamChannel = {
    stream_id: streamId, // Same stream_id
    name: newName,
    stream_icon: faker.image.url(),
    qualities: JSON.stringify(['HD', '4K']),
    ...overrides.newStream,
  };

  return {
    oldStream,
    newStream,
  };
};

/**
 * Create scenario with new streams
 *
 * @param count - Number of new streams to create
 * @returns Array of new streams
 *
 * @example
 * const newStreams = createNewStreamsScenario(5);
 */
export const createNewStreamsScenario = (count: number): XtreamChannel[] => {
  return Array.from({ length: count }, () => createNewStream());
};

/**
 * Create scenario with removed streams
 *
 * @param count - Number of removed stream IDs
 * @returns Array of stream IDs
 *
 * @example
 * const removedIds = createRemovedStreamsScenario(3);
 */
export const createRemovedStreamsScenario = (count: number): number[] => {
  return Array.from({ length: count }, () =>
    faker.number.int({ min: 1000, max: 99999 })
  );
};

/**
 * Create scenario with changed streams
 *
 * @param count - Number of changed streams
 * @returns Array of changed stream pairs
 *
 * @example
 * const changedStreams = createChangedStreamsScenario(2);
 */
export const createChangedStreamsScenario = (count: number): ChangedStream[] => {
  return Array.from({ length: count }, () => createChangedStream());
};

/**
 * Create complex provider change scenario
 *
 * @param options - Configuration for scenario
 * @returns Complete ProviderChanges with all change types
 *
 * @example
 * const complexChanges = createComplexChangeScenario({
 *   newCount: 5,
 *   removedCount: 2,
 *   changedCount: 3,
 * });
 */
export const createComplexChangeScenario = (options: {
  newCount?: number;
  removedCount?: number;
  changedCount?: number;
} = {}): ProviderChanges => {
  const { newCount = 3, removedCount = 2, changedCount = 1 } = options;

  return {
    newStreams: createNewStreamsScenario(newCount),
    removedStreamIds: createRemovedStreamsScenario(removedCount),
    changedStreams: createChangedStreamsScenario(changedCount),
  };
};
