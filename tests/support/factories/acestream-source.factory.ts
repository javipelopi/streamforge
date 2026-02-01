import { faker } from '@faker-js/faker';

/**
 * Acestream Source Data Factories
 *
 * Generates mock Acestream source data for testing.
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
faker.seed(67890);

// ============================================================================
// Types
// ============================================================================

export interface AcestreamSource {
  id: number;
  name: string;
  contentId: string; // 40-character hexadecimal hash
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AcestreamStatus {
  isSupported: boolean;
  platform: string;
  engineAvailable: boolean;
  engineUrl: string;
}

export type StreamSourceType = 'xtream' | 'm3u' | 'acestream';

export interface ChannelMapping {
  id: number;
  xmltvChannelId: number;
  sourceType: StreamSourceType;
  xtreamChannelId: number | null;
  m3uChannelId: number | null;
  acestreamSourceId: number | null;
  streamPriority: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Acestream Source Factories
// ============================================================================

/**
 * Generate a valid Acestream content ID (40-character hex hash)
 */
export const generateAcestreamContentId = (): string =>
  faker.string.hexadecimal({ length: 40, prefix: '' }).toLowerCase();

// Fixed source names for deterministic testing
const FIXED_ACESTREAM_NAMES = [
  'Sports Channel Live',
  'News 24/7',
  'Movie Stream',
  'Music TV',
  'Documentary Channel',
];

/**
 * Create a single Acestream source with deterministic defaults.
 * Uses fixed patterns based on ID for reproducibility.
 */
export const createAcestreamSource = (overrides: Partial<AcestreamSource> = {}): AcestreamSource => {
  const now = new Date().toISOString();
  const id = overrides.id ?? faker.number.int({ min: 1, max: 10000 });

  // Use deterministic name based on ID
  const nameIndex = id % FIXED_ACESTREAM_NAMES.length;
  const sourceName = overrides.name ?? `${FIXED_ACESTREAM_NAMES[nameIndex]} ${id}`;

  // Generate deterministic content ID based on ID
  const contentId = overrides.contentId ?? generateDeterministicContentId(id);

  return {
    id,
    name: sourceName,
    contentId,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? new Date(Date.now() - 86400000).toISOString(),
    updatedAt: now,
    ...overrides,
  };
};

/**
 * Generate a deterministic content ID based on a seed value
 */
function generateDeterministicContentId(seed: number): string {
  // Create a deterministic 40-character hex string based on the seed
  const hexChars = '0123456789abcdef';
  let result = '';
  let value = seed;
  for (let i = 0; i < 40; i++) {
    value = (value * 1103515245 + 12345) & 0x7fffffff;
    result += hexChars[value % 16];
  }
  return result;
}

/**
 * Create multiple Acestream sources
 */
export const createAcestreamSources = (
  count: number,
  overrides: Partial<AcestreamSource> = {}
): AcestreamSource[] =>
  Array.from({ length: count }, (_, i) =>
    createAcestreamSource({ id: i + 1, ...overrides })
  );

/**
 * Create an inactive Acestream source
 */
export const createInactiveAcestreamSource = (overrides: Partial<AcestreamSource> = {}): AcestreamSource =>
  createAcestreamSource({ isActive: false, ...overrides });

// ============================================================================
// Acestream Status Factories
// ============================================================================

/**
 * Create Acestream status for Windows/Linux (supported platform)
 */
export const createAcestreamStatusSupported = (
  engineAvailable = true,
  overrides: Partial<AcestreamStatus> = {}
): AcestreamStatus => ({
  isSupported: true,
  engineAvailable,
  engineUrl: 'http://127.0.0.1:6878',
  platform: faker.helpers.arrayElement(['windows', 'linux']),
  ...overrides,
});

/**
 * Create Acestream status for Mac (unsupported platform)
 */
export const createAcestreamStatusUnsupported = (overrides: Partial<AcestreamStatus> = {}): AcestreamStatus => ({
  isSupported: false,
  engineAvailable: false,
  engineUrl: 'http://127.0.0.1:6878',
  platform: 'darwin',
  ...overrides,
});

/**
 * Create Acestream status with engine not running
 */
export const createAcestreamStatusNoEngine = (overrides: Partial<AcestreamStatus> = {}): AcestreamStatus => ({
  isSupported: true,
  engineAvailable: false,
  engineUrl: 'http://127.0.0.1:6878',
  platform: faker.helpers.arrayElement(['windows', 'linux']),
  ...overrides,
});

// ============================================================================
// Channel Mapping Factories
// ============================================================================

/**
 * Create channel mapping for M3U source
 */
export const createM3uChannelMapping = (overrides: Partial<ChannelMapping> = {}): ChannelMapping => {
  const now = new Date().toISOString();
  return {
    id: faker.number.int({ min: 1, max: 100000 }),
    xmltvChannelId: faker.number.int({ min: 1, max: 10000 }),
    sourceType: 'm3u',
    xtreamChannelId: null,
    m3uChannelId: faker.number.int({ min: 1, max: 10000 }),
    acestreamSourceId: null,
    streamPriority: faker.number.int({ min: 1, max: 10 }),
    createdAt: faker.date.past().toISOString(),
    updatedAt: now,
    ...overrides,
  };
};

/**
 * Create channel mapping for Acestream source
 */
export const createAcestreamChannelMapping = (overrides: Partial<ChannelMapping> = {}): ChannelMapping => {
  const now = new Date().toISOString();
  return {
    id: faker.number.int({ min: 1, max: 100000 }),
    xmltvChannelId: faker.number.int({ min: 1, max: 10000 }),
    sourceType: 'acestream',
    xtreamChannelId: null,
    m3uChannelId: null,
    acestreamSourceId: faker.number.int({ min: 1, max: 10000 }),
    streamPriority: faker.number.int({ min: 1, max: 10 }),
    createdAt: faker.date.past().toISOString(),
    updatedAt: now,
    ...overrides,
  };
};

/**
 * Create channel mapping for Xtream source
 */
export const createXtreamChannelMapping = (overrides: Partial<ChannelMapping> = {}): ChannelMapping => {
  const now = new Date().toISOString();
  return {
    id: faker.number.int({ min: 1, max: 100000 }),
    xmltvChannelId: faker.number.int({ min: 1, max: 10000 }),
    sourceType: 'xtream',
    xtreamChannelId: faker.number.int({ min: 1, max: 10000 }),
    m3uChannelId: null,
    acestreamSourceId: null,
    streamPriority: faker.number.int({ min: 1, max: 10 }),
    createdAt: faker.date.past().toISOString(),
    updatedAt: now,
    ...overrides,
  };
};

/**
 * Create multiple source mappings for a single XMLTV channel (multi-source failover scenario)
 */
export const createMultiSourceMappings = (
  xmltvChannelId: number,
  sources: Array<{ type: StreamSourceType; sourceId: number; priority: number }>
): ChannelMapping[] =>
  sources.map((source, i) => {
    const base: Partial<ChannelMapping> = {
      id: i + 1,
      xmltvChannelId,
      sourceType: source.type,
      streamPriority: source.priority,
    };

    switch (source.type) {
      case 'xtream':
        return createXtreamChannelMapping({ ...base, xtreamChannelId: source.sourceId });
      case 'm3u':
        return createM3uChannelMapping({ ...base, m3uChannelId: source.sourceId });
      case 'acestream':
        return createAcestreamChannelMapping({ ...base, acestreamSourceId: source.sourceId });
    }
  });

// ============================================================================
// URL Builders (for testing stream proxy)
// ============================================================================

/**
 * Build Acestream engine URL for a content ID
 */
export const buildAcestreamUrl = (contentId: string, port = 6878): string =>
  `http://127.0.0.1:${port}/ace/getstream?id=${contentId}`;

/**
 * Parse Acestream content ID from acestream:// URL
 */
export const parseAcestreamUrl = (url: string): string | null => {
  const match = url.match(/^acestream:\/\/([a-f0-9]{40})$/i);
  return match ? match[1].toLowerCase() : null;
};

// ============================================================================
// Edge Case Factories
// ============================================================================

/**
 * Create Acestream source with invalid content ID format
 */
export const createInvalidAcestreamContentId = (): string =>
  faker.string.alphanumeric(30); // Too short, should be 40 chars

/**
 * Create acestream:// URL for testing URL parsing
 */
export const createAcestreamProtocolUrl = (contentId?: string): string =>
  `acestream://${contentId ?? generateAcestreamContentId()}`;
