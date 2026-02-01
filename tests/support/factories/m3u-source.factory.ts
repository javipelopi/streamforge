import { faker } from '@faker-js/faker';

/**
 * M3U Source Data Factories
 *
 * Generates mock M3U source and channel data for testing.
 * Follows data factory best practices:
 * - Uses seeded faker for deterministic test data
 * - Supports overrides for specific test scenarios
 * - Generates complete valid objects matching database schema
 *
 * IMPORTANT: Faker is seeded for deterministic tests. If you need random
 * data for a specific test, call faker.seed() with a different value.
 *
 * @see tech-spec-multi-source-stream-support.md
 */

// Seed faker for deterministic test data - this ensures tests are reproducible
faker.seed(12345);

// ============================================================================
// Types
// ============================================================================

export interface M3uSource {
  id: number;
  name: string;
  url: string;
  refreshIntervalHours: number;
  lastRefresh: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface M3uChannel {
  id: number;
  sourceId: number;
  streamUrl: string;
  name: string;
  tvgId: string | null;
  tvgName: string | null;
  tvgLogo: string | null;
  groupTitle: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface M3uChannelEntry {
  streamUrl: string;
  name: string;
  tvgId?: string;
  tvgName?: string;
  tvgLogo?: string;
  groupTitle?: string;
}

export interface M3uSourceWithChannels {
  source: M3uSource;
  channels: M3uChannel[];
}

// ============================================================================
// M3U Source Factories
// ============================================================================

/**
 * Create a single M3U source with sensible defaults.
 * Uses deterministic values based on the seeded faker instance.
 */
export const createM3uSource = (overrides: Partial<M3uSource> = {}): M3uSource => {
  const now = new Date().toISOString();
  const id = overrides.id ?? faker.number.int({ min: 1, max: 10000 });

  // Use fixed patterns for critical fields to reduce flakiness
  const sourceName = overrides.name ?? `Test IPTV Source ${id}`;
  const sourceUrl = overrides.url ?? `https://iptv-test-${id}.example.com/playlist.m3u`;

  return {
    id,
    name: sourceName,
    url: sourceUrl,
    refreshIntervalHours: overrides.refreshIntervalHours ?? 24,
    lastRefresh: overrides.lastRefresh !== undefined ? overrides.lastRefresh : new Date(Date.now() - 3600000).toISOString(),
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? new Date(Date.now() - 86400000).toISOString(),
    updatedAt: now,
    ...overrides,
  };
};

/**
 * Create multiple M3U sources
 */
export const createM3uSources = (count: number, overrides: Partial<M3uSource> = {}): M3uSource[] =>
  Array.from({ length: count }, (_, i) =>
    createM3uSource({ id: i + 1, ...overrides })
  );

/**
 * Create an inactive M3U source
 */
export const createInactiveM3uSource = (overrides: Partial<M3uSource> = {}): M3uSource =>
  createM3uSource({ isActive: false, ...overrides });

/**
 * Create M3U source that has never been refreshed
 */
export const createUnrefreshedM3uSource = (overrides: Partial<M3uSource> = {}): M3uSource =>
  createM3uSource({ lastRefresh: null, ...overrides });

// ============================================================================
// M3U Channel Factories
// ============================================================================

// Fixed channel names for deterministic testing
const FIXED_CHANNEL_NAMES = [
  'CNN HD',
  'BBC News',
  'ESPN',
  'Fox Sports',
  'Discovery Channel',
  'HBO',
  'Netflix',
  'National Geographic',
  'MTV',
  'Comedy Central',
];

const FIXED_GROUP_TITLES = ['News', 'Sports', 'Entertainment', 'Movies', 'Kids', 'Music'];

/**
 * Create a single M3U channel with deterministic defaults.
 * Uses fixed patterns based on ID for reproducibility.
 */
export const createM3uChannel = (overrides: Partial<M3uChannel> = {}): M3uChannel => {
  const now = new Date().toISOString();
  const id = overrides.id ?? faker.number.int({ min: 1, max: 100000 });
  const sourceId = overrides.sourceId ?? 1;

  // Use deterministic channel name based on ID
  const channelIndex = id % FIXED_CHANNEL_NAMES.length;
  const channelName = overrides.name ?? FIXED_CHANNEL_NAMES[channelIndex];
  const groupIndex = id % FIXED_GROUP_TITLES.length;

  return {
    id,
    sourceId,
    streamUrl: overrides.streamUrl ?? `https://stream-test.example.com/live/channel-${id}.m3u8`,
    name: channelName,
    tvgId: overrides.tvgId !== undefined ? overrides.tvgId : `ch${id}.example`,
    tvgName: overrides.tvgName !== undefined ? overrides.tvgName : channelName,
    tvgLogo: overrides.tvgLogo !== undefined ? overrides.tvgLogo : `https://logos.example.com/${id}.png`,
    groupTitle: overrides.groupTitle !== undefined ? overrides.groupTitle : FIXED_GROUP_TITLES[groupIndex],
    createdAt: overrides.createdAt ?? new Date(Date.now() - 86400000).toISOString(),
    updatedAt: now,
    ...overrides,
  };
};

/**
 * Create multiple M3U channels for a source
 */
export const createM3uChannels = (
  count: number,
  sourceId: number,
  overrides: Partial<M3uChannel> = {}
): M3uChannel[] =>
  Array.from({ length: count }, (_, i) =>
    createM3uChannel({ id: i + 1, sourceId, ...overrides })
  );

/**
 * Create M3U channel with full EXTINF attributes (for testing parser)
 */
export const createM3uChannelWithFullAttributes = (overrides: Partial<M3uChannel> = {}): M3uChannel => {
  const channelName = faker.helpers.arrayElement(['CNN International', 'BBC World', 'ESPN HD']);
  return createM3uChannel({
    tvgId: `channel.${faker.string.alphanumeric(4)}`,
    tvgName: channelName,
    tvgLogo: `https://cdn.example.com/logos/${faker.string.alphanumeric(8)}.png`,
    groupTitle: faker.helpers.arrayElement(['News', 'Sports', 'Entertainment']),
    name: channelName,
    ...overrides,
  });
};

/**
 * Create M3U channel with minimal attributes (missing tvg-id, logo, etc.)
 */
export const createM3uChannelMinimal = (overrides: Partial<M3uChannel> = {}): M3uChannel =>
  createM3uChannel({
    tvgId: null,
    tvgName: null,
    tvgLogo: null,
    groupTitle: null,
    ...overrides,
  });

// ============================================================================
// M3U Playlist Content Factories (for parser testing)
// ============================================================================

/**
 * Create raw M3U playlist content (string) for testing parser
 */
export const createM3uPlaylistContent = (entries: M3uChannelEntry[]): string => {
  const header = '#EXTM3U';
  const lines = entries.map((entry) => {
    const extinf = buildExtinfLine(entry);
    return `${extinf}\n${entry.streamUrl}`;
  });
  return `${header}\n${lines.join('\n')}`;
};

/**
 * Build EXTINF line from channel entry
 */
function buildExtinfLine(entry: M3uChannelEntry): string {
  const attributes: string[] = [];

  if (entry.tvgId) attributes.push(`tvg-id="${entry.tvgId}"`);
  if (entry.tvgName) attributes.push(`tvg-name="${entry.tvgName}"`);
  if (entry.tvgLogo) attributes.push(`tvg-logo="${entry.tvgLogo}"`);
  if (entry.groupTitle) attributes.push(`group-title="${entry.groupTitle}"`);

  const attrString = attributes.length > 0 ? ` ${attributes.join(' ')}` : '';
  return `#EXTINF:-1${attrString},${entry.name}`;
}

/**
 * Create M3U channel entries for playlist content
 */
export const createM3uChannelEntry = (overrides: Partial<M3uChannelEntry> = {}): M3uChannelEntry => {
  const channelName = faker.helpers.arrayElement(['CNN', 'BBC', 'ESPN', 'Fox']) + ' HD';
  return {
    streamUrl: `https://${faker.internet.domainName()}/live/${faker.string.alphanumeric(8)}.m3u8`,
    name: channelName,
    tvgId: faker.datatype.boolean() ? `${faker.string.alphanumeric(6)}` : undefined,
    tvgName: faker.datatype.boolean() ? channelName : undefined,
    tvgLogo: faker.datatype.boolean() ? faker.image.url() : undefined,
    groupTitle: faker.helpers.arrayElement(['News', 'Sports', 'Entertainment', undefined]),
    ...overrides,
  };
};

/**
 * Create multiple M3U channel entries
 */
export const createM3uChannelEntries = (count: number): M3uChannelEntry[] =>
  Array.from({ length: count }, () => createM3uChannelEntry());

/**
 * Create a realistic M3U playlist with various channel types
 */
export const createRealisticM3uPlaylist = (channelCount = 20): string => {
  const entries: M3uChannelEntry[] = [
    // Channels with full attributes
    ...Array.from({ length: Math.floor(channelCount * 0.6) }, () =>
      createM3uChannelEntry({
        tvgId: `ch.${faker.string.alphanumeric(4)}`,
        tvgName: faker.helpers.arrayElement(['CNN HD', 'BBC News', 'ESPN']),
        tvgLogo: faker.image.url(),
        groupTitle: faker.helpers.arrayElement(['News', 'Sports']),
      })
    ),
    // Channels with partial attributes
    ...Array.from({ length: Math.floor(channelCount * 0.3) }, () =>
      createM3uChannelEntry({
        tvgId: undefined,
        tvgLogo: undefined,
      })
    ),
    // Channels with minimal attributes
    ...Array.from({ length: Math.floor(channelCount * 0.1) }, () =>
      createM3uChannelEntry({
        tvgId: undefined,
        tvgName: undefined,
        tvgLogo: undefined,
        groupTitle: undefined,
      })
    ),
  ];

  return createM3uPlaylistContent(entries);
};

// ============================================================================
// Edge Case Factories (for error testing)
// ============================================================================

/**
 * Create malformed M3U content (missing header)
 */
export const createMalformedM3uContent = (): string => {
  return `#EXTINF:-1,Channel 1
http://example.com/stream1.m3u8`;
};

/**
 * Create M3U content with unicode channel names
 */
export const createUnicodeM3uContent = (): string => {
  return `#EXTM3U
#EXTINF:-1 tvg-name="日本テレビ",日本テレビ
http://example.com/ntv.m3u8
#EXTINF:-1 tvg-name="Россия 1",Россия 1
http://example.com/russia1.m3u8
#EXTINF:-1 tvg-name="القناة الأولى",القناة الأولى
http://example.com/arabic1.m3u8`;
};

/**
 * Create empty M3U content (header only)
 */
export const createEmptyM3uContent = (): string => '#EXTM3U\n';

// ============================================================================
// Combined Factories
// ============================================================================

/**
 * Create M3U source with associated channels
 */
export const createM3uSourceWithChannels = (
  channelCount: number,
  sourceOverrides: Partial<M3uSource> = {},
  channelOverrides: Partial<M3uChannel> = {}
): M3uSourceWithChannels => {
  const source = createM3uSource(sourceOverrides);
  const channels = createM3uChannels(channelCount, source.id, channelOverrides);
  return { source, channels };
};

/**
 * Create multiple M3U sources with channels
 */
export const createM3uSourcesWithChannels = (
  sourcesConfig: Array<{ sourceOverrides?: Partial<M3uSource>; channelCount: number }>
): M3uSourceWithChannels[] =>
  sourcesConfig.map((config, i) =>
    createM3uSourceWithChannels(
      config.channelCount,
      { id: i + 1, ...config.sourceOverrides }
    )
  );
