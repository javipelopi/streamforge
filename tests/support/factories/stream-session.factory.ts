import { faker } from '@faker-js/faker';

/**
 * Stream Session Factory
 *
 * Generates test data for stream sessions and stream proxy testing.
 * Used for Story 4-4: Stream Proxy with Quality Selection.
 */

export interface StreamSession {
  sessionId: string;
  xmltvChannelId: number;
  xtreamStreamId: number;
  currentQuality: string;
  startedAt: string;
  accountId: number;
}

export interface XtreamStreamWithQuality {
  id: number;
  accountId: number;
  streamId: number;
  name: string;
  streamIcon: string | null;
  qualities: string[]; // e.g., ["4K", "HD", "SD"]
  category: string;
  epgChannelId: string | null;
}

export interface StreamRequest {
  xmltvChannelId: number;
  clientIp: string;
  userAgent: string;
  requestedAt: string;
}

/**
 * Create a stream session with random data
 */
export const createStreamSession = (overrides: Partial<StreamSession> = {}): StreamSession => {
  return {
    sessionId: faker.string.uuid(),
    xmltvChannelId: faker.number.int({ min: 1, max: 10000 }),
    xtreamStreamId: faker.number.int({ min: 1000, max: 99999 }),
    currentQuality: faker.helpers.arrayElement(['4K', 'FHD', 'HD', 'SD']),
    startedAt: faker.date.recent().toISOString(),
    accountId: faker.number.int({ min: 1, max: 100 }),
    ...overrides,
  };
};

/**
 * Create multiple stream sessions
 */
export const createStreamSessions = (count: number): StreamSession[] => {
  return Array.from({ length: count }, () => createStreamSession());
};

/**
 * Create Xtream stream with quality information
 */
export const createXtreamStreamWithQuality = (
  overrides: Partial<XtreamStreamWithQuality> = {}
): XtreamStreamWithQuality => {
  return {
    id: faker.number.int({ min: 1, max: 100000 }),
    accountId: faker.number.int({ min: 1, max: 100 }),
    streamId: faker.number.int({ min: 1000, max: 99999 }),
    name: faker.company.name() + ' TV',
    streamIcon: faker.datatype.boolean() ? faker.image.url() : null,
    qualities: faker.helpers.arrayElements(['4K', 'FHD', 'HD', 'SD'], { min: 1, max: 4 }),
    category: faker.helpers.arrayElement(['Sports', 'News', 'Entertainment', 'Movies']),
    epgChannelId: faker.datatype.boolean() ? `${faker.company.name().toLowerCase()}.tv` : null,
    ...overrides,
  };
};

/**
 * Create Xtream stream with 4K quality
 */
export const createXtream4KStream = (overrides: Partial<XtreamStreamWithQuality> = {}): XtreamStreamWithQuality => {
  return createXtreamStreamWithQuality({
    qualities: ['4K', 'FHD', 'HD', 'SD'],
    ...overrides,
  });
};

/**
 * Create Xtream stream with HD quality (no 4K)
 */
export const createXtreamHDStream = (overrides: Partial<XtreamStreamWithQuality> = {}): XtreamStreamWithQuality => {
  return createXtreamStreamWithQuality({
    qualities: ['FHD', 'HD', 'SD'],
    ...overrides,
  });
};

/**
 * Create Xtream stream with SD only
 */
export const createXtreamSDStream = (overrides: Partial<XtreamStreamWithQuality> = {}): XtreamStreamWithQuality => {
  return createXtreamStreamWithQuality({
    qualities: ['SD'],
    ...overrides,
  });
};

/**
 * Create Xtream stream with no quality information
 */
export const createXtreamStreamWithoutQuality = (
  overrides: Partial<XtreamStreamWithQuality> = {}
): XtreamStreamWithQuality => {
  return createXtreamStreamWithQuality({
    qualities: [],
    ...overrides,
  });
};

/**
 * Create stream request metadata
 */
export const createStreamRequest = (overrides: Partial<StreamRequest> = {}): StreamRequest => {
  return {
    xmltvChannelId: faker.number.int({ min: 1, max: 10000 }),
    clientIp: faker.internet.ip(),
    userAgent: faker.internet.userAgent(),
    requestedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
};

/**
 * Create multiple stream requests
 */
export const createStreamRequests = (count: number): StreamRequest[] => {
  return Array.from({ length: count }, () => createStreamRequest());
};

/**
 * Create stream session for specific channel and quality
 */
export const createStreamSessionForChannel = (
  xmltvChannelId: number,
  quality: string,
  overrides: Partial<StreamSession> = {}
): StreamSession => {
  return createStreamSession({
    xmltvChannelId,
    currentQuality: quality,
    ...overrides,
  });
};

/**
 * Create concurrent stream sessions (for testing connection limits)
 */
export const createConcurrentSessions = (count: number, accountId: number): StreamSession[] => {
  return Array.from({ length: count }, () =>
    createStreamSession({
      accountId,
      startedAt: faker.date.recent({ days: 0.1 }).toISOString(), // All started recently
    })
  );
};

/**
 * Create Xtream stream set with multiple qualities (ESPN example)
 */
export const createMultiQualityStreamSet = (accountId: number) => {
  const baseStreamId = faker.number.int({ min: 10000, max: 90000 });
  const baseName = faker.company.name();

  return {
    stream4K: createXtreamStreamWithQuality({
      accountId,
      streamId: baseStreamId,
      name: `${baseName} 4K`,
      qualities: ['4K'],
    }),
    streamHD: createXtreamStreamWithQuality({
      accountId,
      streamId: baseStreamId + 1,
      name: `${baseName} HD`,
      qualities: ['HD'],
    }),
    streamSD: createXtreamStreamWithQuality({
      accountId,
      streamId: baseStreamId + 2,
      name: `${baseName} SD`,
      qualities: ['SD'],
    }),
  };
};

/**
 * Generate Xtream stream URL for testing
 */
export const generateXtreamStreamUrl = (
  serverUrl: string,
  username: string,
  password: string,
  streamId: number,
  format: string = 'ts'
): string => {
  return `${serverUrl}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${streamId}.${format}`;
};

/**
 * Create stream URL with special characters in credentials
 */
export const createStreamUrlWithSpecialChars = () => {
  const serverUrl = `http://${faker.internet.domainName()}:8080`;
  const username = `user+${faker.string.alphanumeric(5)}@test`;
  const password = `pass&word=${faker.string.alphanumeric(8)}`;
  const streamId = faker.number.int({ min: 1000, max: 99999 });

  return {
    serverUrl,
    username,
    password,
    streamId,
    expectedUrl: generateXtreamStreamUrl(serverUrl, username, password, streamId),
  };
};

/**
 * Quality priority levels for testing
 */
export const QUALITY_PRIORITIES = {
  '4K': 0,
  FHD: 1,
  HD: 2,
  SD: 3,
} as const;

/**
 * Get expected quality based on available qualities
 */
export const getExpectedQuality = (availableQualities: string[]): string => {
  const priorityOrder: (keyof typeof QUALITY_PRIORITIES)[] = ['4K', 'FHD', 'HD', 'SD'];

  for (const quality of priorityOrder) {
    if (availableQualities.includes(quality)) {
      return quality;
    }
  }

  return 'SD'; // Default fallback
};

/**
 * Create test scenario for quality selection
 */
export const createQualitySelectionScenario = () => {
  const scenarios = [
    { qualities: ['4K', 'FHD', 'HD', 'SD'], expected: '4K' },
    { qualities: ['FHD', 'HD', 'SD'], expected: 'FHD' },
    { qualities: ['HD', 'SD'], expected: 'HD' },
    { qualities: ['SD'], expected: 'SD' },
    { qualities: [], expected: 'SD' }, // No quality info, default to SD
  ];

  return faker.helpers.arrayElement(scenarios);
};
