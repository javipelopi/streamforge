import { faker } from '@faker-js/faker';

/**
 * Xtream Account Stream Factory (Story 3-11)
 *
 * Generates random stream data with mapping status for testing the Xtream tab
 * in the Sources view. Follows data factory best practices:
 * - All data is randomly generated using faker
 * - Supports overrides for specific test scenarios
 * - Generates complete valid objects
 */

export interface XtreamAccountStream {
  id: number;
  streamId: number;
  name: string;
  streamIcon: string | null;
  qualities: string[];
  categoryName: string | null;
  /** "linked" | "orphan" | "promoted" */
  linkStatus: 'linked' | 'orphan' | 'promoted';
  /** XMLTV channel IDs this stream is linked to */
  linkedXmltvIds: number[];
  /** If promoted, the synthetic channel ID */
  syntheticChannelId: number | null;
}

export interface AccountStreamStats {
  streamCount: number;
  linkedCount: number;
  orphanCount: number;
  promotedCount: number;
}

/**
 * Create a single Xtream stream with random data
 */
export const createXtreamAccountStream = (
  overrides: Partial<XtreamAccountStream> = {}
): XtreamAccountStream => {
  const id = overrides.id ?? faker.number.int({ min: 1, max: 10000 });
  const streamId = overrides.streamId ?? faker.number.int({ min: 1000, max: 99999 });

  // Random qualities (HD, SD, 4K, FHD)
  const possibleQualities = ['SD', 'HD', 'FHD', '4K'];
  const qualityCount = faker.number.int({ min: 1, max: 2 });
  const qualities = faker.helpers.arrayElements(possibleQualities, qualityCount);

  // Default to orphan status if not specified
  const linkStatus = overrides.linkStatus ?? 'orphan';

  return {
    id,
    streamId,
    name: overrides.name ?? faker.helpers.arrayElement([
      `${faker.company.name()} TV`,
      `${faker.location.city()} News`,
      `${faker.word.adjective().toUpperCase()} Sports`,
      `Channel ${streamId}`,
      `${faker.word.noun()} HD`,
    ]),
    streamIcon: overrides.streamIcon !== undefined
      ? overrides.streamIcon
      : faker.datatype.boolean()
        ? `https://example.com/icons/${streamId}.png`
        : null,
    qualities,
    categoryName: overrides.categoryName !== undefined
      ? overrides.categoryName
      : faker.helpers.arrayElement(['Sports', 'News', 'Entertainment', 'Movies', null]),
    linkStatus,
    linkedXmltvIds: overrides.linkedXmltvIds ?? [],
    syntheticChannelId: overrides.syntheticChannelId ?? null,
    ...overrides,
  };
};

/**
 * Create multiple streams with random data
 */
export const createXtreamAccountStreams = (count: number): XtreamAccountStream[] => {
  return Array.from({ length: count }, (_, i) => createXtreamAccountStream({ id: 5000 + i }));
};

/**
 * Create a linked stream (mapped to XMLTV channel)
 */
export const createLinkedStream = (
  overrides: Partial<XtreamAccountStream> = {}
): XtreamAccountStream => {
  return createXtreamAccountStream({
    linkStatus: 'linked',
    linkedXmltvIds: overrides.linkedXmltvIds ?? [faker.number.int({ min: 1, max: 1000 })],
    syntheticChannelId: null,
    ...overrides,
  });
};

/**
 * Create an orphan stream (not mapped to any channel)
 */
export const createOrphanStream = (
  overrides: Partial<XtreamAccountStream> = {}
): XtreamAccountStream => {
  return createXtreamAccountStream({
    linkStatus: 'orphan',
    linkedXmltvIds: [],
    syntheticChannelId: null,
    ...overrides,
  });
};

/**
 * Create a promoted stream (has synthetic channel)
 */
export const createPromotedStream = (
  overrides: Partial<XtreamAccountStream> = {}
): XtreamAccountStream => {
  return createXtreamAccountStream({
    linkStatus: 'promoted',
    linkedXmltvIds: [faker.number.int({ min: 1, max: 1000 })], // Synthetic channel ID
    syntheticChannelId: overrides.syntheticChannelId ?? faker.number.int({ min: 2000, max: 3000 }),
    ...overrides,
  });
};

/**
 * Create a stream linked to multiple XMLTV channels
 */
export const createMultiLinkedStream = (
  xmltvChannelIds: number[]
): XtreamAccountStream => {
  return createXtreamAccountStream({
    linkStatus: 'linked',
    linkedXmltvIds: xmltvChannelIds,
    syntheticChannelId: null,
  });
};

/**
 * Create a realistic mix of streams with different statuses
 */
export const createRealisticStreamMix = (totalCount = 20): XtreamAccountStream[] => {
  const linkedCount = Math.floor(totalCount * 0.4); // 40% linked
  const promotedCount = Math.floor(totalCount * 0.1); // 10% promoted
  const orphanCount = totalCount - linkedCount - promotedCount; // Remaining are orphans

  const streams: XtreamAccountStream[] = [];

  // Create linked streams
  for (let i = 0; i < linkedCount; i++) {
    streams.push(createLinkedStream({ id: 5000 + i }));
  }

  // Create promoted streams
  for (let i = 0; i < promotedCount; i++) {
    streams.push(createPromotedStream({ id: 5000 + linkedCount + i }));
  }

  // Create orphan streams
  for (let i = 0; i < orphanCount; i++) {
    streams.push(createOrphanStream({ id: 5000 + linkedCount + promotedCount + i }));
  }

  return streams;
};

/**
 * Create account stream stats from stream array
 */
export const createStreamStats = (streams: XtreamAccountStream[]): AccountStreamStats => {
  return {
    streamCount: streams.length,
    linkedCount: streams.filter(s => s.linkStatus === 'linked').length,
    orphanCount: streams.filter(s => s.linkStatus === 'orphan').length,
    promotedCount: streams.filter(s => s.linkStatus === 'promoted').length,
  };
};

/**
 * Create custom account stream stats
 */
export const createAccountStreamStats = (
  overrides: Partial<AccountStreamStats> = {}
): AccountStreamStats => {
  const streamCount = overrides.streamCount ?? faker.number.int({ min: 10, max: 100 });
  const orphanCount = overrides.orphanCount ?? Math.floor(streamCount * 0.3);
  const promotedCount = overrides.promotedCount ?? Math.floor(streamCount * 0.1);
  const linkedCount = overrides.linkedCount ?? (streamCount - orphanCount - promotedCount);

  return {
    streamCount,
    linkedCount,
    orphanCount,
    promotedCount,
    ...overrides,
  };
};

/**
 * Create streams with specific quality badge for testing
 */
export const create4KStream = (): XtreamAccountStream => {
  return createXtreamAccountStream({
    name: 'Premium 4K Channel',
    qualities: ['4K', 'FHD', 'HD'],
  });
};

export const createHDStream = (): XtreamAccountStream => {
  return createXtreamAccountStream({
    name: 'HD Channel',
    qualities: ['HD'],
  });
};

export const createSDStream = (): XtreamAccountStream => {
  return createXtreamAccountStream({
    name: 'SD Channel',
    qualities: ['SD'],
  });
};
