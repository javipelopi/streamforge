import { faker } from '@faker-js/faker';

/**
 * Channel Factory
 *
 * Generates random Xtream channel data for testing using faker.
 * Follows data factory best practices:
 * - All data is randomly generated (no hardcoded values)
 * - Supports overrides for specific test scenarios
 * - Generates complete valid objects
 */

export interface XtreamLiveStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string | null;
  epg_channel_id: string | null;
  added: string | null;
  category_id: string | null;
  category_ids: number[] | null;
  custom_sid: string | null;
  tv_archive: number;
  direct_source: string;
  tv_archive_duration: number;
}

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface XtreamChannel {
  id: number;
  accountId: number;
  streamId: number;
  name: string;
  streamIcon: string | null;
  categoryId: number | null;
  categoryName: string | null;
  qualities: string[];
  epgChannelId: string | null;
  tvArchive: boolean;
  tvArchiveDuration: number;
  addedAt: string;
}

export interface ScanResult {
  success: boolean;
  totalChannels: number;
  newChannels: number;
  updatedChannels: number;
  removedChannels: number;
  scanDurationMs: number;
  errorMessage?: string;
}

/**
 * Create a random Xtream live stream (API response format)
 */
export const createXtreamLiveStream = (overrides: Partial<XtreamLiveStream> = {}): XtreamLiveStream => {
  const qualities = ['HD', 'SD', 'FHD', '4K'];
  const quality = faker.helpers.arrayElement(qualities);
  const channelTypes = ['Sports', 'News', 'Entertainment', 'Movies', 'Kids'];
  const channelType = faker.helpers.arrayElement(channelTypes);

  return {
    num: faker.number.int({ min: 1, max: 10000 }),
    name: `${channelType} Channel ${quality}`,
    stream_type: 'live',
    stream_id: faker.number.int({ min: 10000, max: 99999 }),
    stream_icon: faker.helpers.maybe(() => faker.image.url(), { probability: 0.7 }) ?? null,
    epg_channel_id: faker.helpers.maybe(() => `${channelType.toLowerCase()}.${faker.location.countryCode().toLowerCase()}`, { probability: 0.6 }) ?? null,
    added: faker.date.past().getTime().toString(),
    category_id: faker.number.int({ min: 1, max: 20 }).toString(),
    category_ids: [faker.number.int({ min: 1, max: 20 })],
    custom_sid: null,
    tv_archive: faker.helpers.arrayElement([0, 1]),
    direct_source: '',
    tv_archive_duration: faker.helpers.arrayElement([0, 3, 7, 14]),
    ...overrides,
  };
};

/**
 * Create multiple random Xtream live streams
 */
export const createXtreamLiveStreams = (count: number): XtreamLiveStream[] => {
  return Array.from({ length: count }, () => createXtreamLiveStream());
};

/**
 * Create HD channel
 */
export const createHDChannel = (overrides: Partial<XtreamLiveStream> = {}): XtreamLiveStream => {
  return createXtreamLiveStream({
    name: `${faker.company.name()} HD`,
    ...overrides,
  });
};

/**
 * Create SD channel
 */
export const createSDChannel = (overrides: Partial<XtreamLiveStream> = {}): XtreamLiveStream => {
  return createXtreamLiveStream({
    name: `${faker.company.name()} SD`,
    ...overrides,
  });
};

/**
 * Create 4K channel
 */
export const create4KChannel = (overrides: Partial<XtreamLiveStream> = {}): XtreamLiveStream => {
  return createXtreamLiveStream({
    name: `${faker.company.name()} 4K`,
    ...overrides,
  });
};

/**
 * Create FHD channel
 */
export const createFHDChannel = (overrides: Partial<XtreamLiveStream> = {}): XtreamLiveStream => {
  return createXtreamLiveStream({
    name: `${faker.company.name()} FHD 1080p`,
    ...overrides,
  });
};

/**
 * Create channel with catchup/archive
 */
export const createChannelWithArchive = (days: number = 7, overrides: Partial<XtreamLiveStream> = {}): XtreamLiveStream => {
  return createXtreamLiveStream({
    tv_archive: 1,
    tv_archive_duration: days,
    ...overrides,
  });
};

/**
 * Create Xtream category (API response format)
 */
export const createXtreamCategory = (overrides: Partial<XtreamCategory> = {}): XtreamCategory => {
  const categories = ['Sports', 'News', 'Entertainment', 'Movies', 'Kids', 'Music', 'Documentary'];

  return {
    category_id: faker.number.int({ min: 1, max: 100 }).toString(),
    category_name: faker.helpers.arrayElement(categories),
    parent_id: 0,
    ...overrides,
  };
};

/**
 * Create multiple random Xtream categories
 */
export const createXtreamCategories = (count: number): XtreamCategory[] => {
  return Array.from({ length: count }, () => createXtreamCategory());
};

/**
 * Create channel model (database/frontend format)
 */
export const createChannel = (overrides: Partial<XtreamChannel> = {}): XtreamChannel => {
  return {
    id: faker.number.int({ min: 1, max: 100000 }),
    accountId: faker.number.int({ min: 1, max: 100 }),
    streamId: faker.number.int({ min: 10000, max: 99999 }),
    name: `${faker.company.name()} HD`,
    streamIcon: faker.helpers.maybe(() => faker.image.url(), { probability: 0.7 }) ?? null,
    categoryId: faker.number.int({ min: 1, max: 20 }),
    categoryName: faker.helpers.arrayElement(['Sports', 'News', 'Entertainment', 'Movies']),
    qualities: ['HD'],
    epgChannelId: faker.helpers.maybe(() => `channel.${faker.location.countryCode().toLowerCase()}`, { probability: 0.6 }) ?? null,
    tvArchive: faker.datatype.boolean(),
    tvArchiveDuration: faker.helpers.arrayElement([0, 3, 7, 14]),
    addedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
};

/**
 * Create multiple channels
 */
export const createChannels = (count: number): XtreamChannel[] => {
  return Array.from({ length: count }, () => createChannel());
};

/**
 * Create successful scan result
 */
export const createSuccessfulScanResult = (overrides: Partial<ScanResult> = {}): ScanResult => {
  const total = overrides.totalChannels ?? faker.number.int({ min: 100, max: 1000 });
  const newChannels = overrides.newChannels ?? faker.number.int({ min: 0, max: total });
  const updated = overrides.updatedChannels ?? faker.number.int({ min: 0, max: total - newChannels });

  return {
    success: true,
    totalChannels: total,
    newChannels,
    updatedChannels: updated,
    removedChannels: 0,
    scanDurationMs: faker.number.int({ min: 500, max: 5000 }),
    ...overrides,
  };
};

/**
 * Create failed scan result
 */
export const createFailedScanResult = (errorMessage: string): ScanResult => {
  return {
    success: false,
    totalChannels: 0,
    newChannels: 0,
    updatedChannels: 0,
    removedChannels: 0,
    scanDurationMs: 0,
    errorMessage,
  };
};

/**
 * Create large channel list for performance testing
 */
export const createLargeChannelList = (count: number = 1000): XtreamLiveStream[] => {
  return Array.from({ length: count }, (_, index) =>
    createXtreamLiveStream({
      num: index + 1,
      stream_id: 10000 + index,
    })
  );
};

/**
 * Create channels grouped by category
 */
export const createChannelsByCategory = (categoriesCount: number = 5, channelsPerCategory: number = 10) => {
  const categories = createXtreamCategories(categoriesCount);
  const channels: XtreamLiveStream[] = [];

  categories.forEach((category) => {
    for (let i = 0; i < channelsPerCategory; i++) {
      channels.push(createXtreamLiveStream({
        category_id: category.category_id,
      }));
    }
  });

  return { categories, channels };
};
