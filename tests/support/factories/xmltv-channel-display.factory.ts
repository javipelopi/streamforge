import { faker } from '@faker-js/faker';

/**
 * Factory for XMLTV Channel Display (Story 3.2)
 *
 * Generates test data for displaying XMLTV channels with their matched
 * Xtream streams. Follows XMLTV-first architecture.
 *
 * Best Practices:
 * - All data randomly generated with faker
 * - Supports overrides for specific test scenarios
 * - Generates complete valid objects
 */

export interface XtreamStreamMatch {
  id: number;
  mappingId: number;
  name: string;
  streamIcon: string | null;
  qualities: string[];
  matchConfidence: number;
  isPrimary: boolean;
  isManual: boolean;
  streamPriority: number;
}

/**
 * Xtream stream for search dropdown (Story 3-3)
 */
export interface XtreamStreamSearchResult {
  id: number;
  streamId: number;
  name: string;
  streamIcon: string | null;
  qualities: string[];
  categoryName: string | null;
  matchedToXmltvIds: number[];
}

export interface XmltvChannelWithMappings {
  id: number;
  sourceId: number;
  channelId: string;
  displayName: string;
  icon: string | null;
  isSynthetic: boolean;
  // Settings
  isEnabled: boolean;
  plexDisplayOrder: number | null;
  // Matches
  matchCount: number;
  matches: XtreamStreamMatch[];
}

/**
 * Create a matched Xtream stream with realistic data
 */
export const createXtreamStreamMatch = (overrides: Partial<XtreamStreamMatch> = {}): XtreamStreamMatch => {
  const qualityOptions = ['SD', 'HD', '4K', 'FHD'];
  const randomQualities = faker.helpers.arrayElements(qualityOptions, { min: 1, max: 2 });

  return {
    id: faker.number.int({ min: 1, max: 100000 }),
    mappingId: faker.number.int({ min: 1, max: 100000 }),
    name: faker.company.name() + ' ' + faker.helpers.arrayElement(['HD', 'SD', '4K', 'TV']),
    streamIcon: faker.helpers.maybe(() => faker.image.url(), { probability: 0.7 }) ?? null,
    qualities: randomQualities,
    matchConfidence: faker.number.float({ min: 0.85, max: 1.0, fractionDigits: 2 }),
    isPrimary: false,
    isManual: false,
    streamPriority: 1,
    ...overrides,
  };
};

/**
 * Create an XMLTV channel with mapped Xtream streams
 */
export const createXmltvChannelWithMappings = (
  overrides: Partial<XmltvChannelWithMappings> = {}
): XmltvChannelWithMappings => {
  const matchCount = overrides.matchCount ?? faker.number.int({ min: 1, max: 5 });

  // Generate matches if not provided
  const matches = overrides.matches ?? Array.from({ length: matchCount }, (_, index) => {
    return createXtreamStreamMatch({
      isPrimary: index === 0, // First match is primary
      streamPriority: index,
    });
  });

  const domain = faker.internet.domainName();
  const slug = faker.helpers.slugify(faker.company.name().toLowerCase());

  return {
    id: faker.number.int({ min: 1, max: 100000 }),
    sourceId: faker.number.int({ min: 1, max: 1000 }),
    channelId: `${slug}.${domain}`,
    displayName: faker.company.name() + ' TV',
    icon: faker.helpers.maybe(() => faker.image.url(), { probability: 0.8 }) ?? null,
    isSynthetic: false,
    isEnabled: faker.datatype.boolean(),
    plexDisplayOrder: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 1000 }), { probability: 0.7 }) ?? null,
    matchCount,
    matches,
    ...overrides,
  };
};

/**
 * Create an XMLTV channel with multiple quality tiers (HD/SD/4K)
 * Example: ESPN with ESPN HD, ESPN SD, ESPN 4K
 */
export const createXmltvChannelWithMultipleMatches = (
  overrides: Partial<XmltvChannelWithMappings> = {}
): XmltvChannelWithMappings => {
  const baseChannelName = overrides.displayName ?? faker.company.name();

  const matches = overrides.matches ?? [
    createXtreamStreamMatch({
      name: `${baseChannelName} HD`,
      qualities: ['HD'],
      matchConfidence: 0.95,
      isPrimary: true,
      isManual: false,
      streamPriority: 0,
    }),
    createXtreamStreamMatch({
      name: `${baseChannelName} SD`,
      qualities: ['SD'],
      matchConfidence: 0.92,
      isPrimary: false,
      isManual: false,
      streamPriority: 1,
    }),
    createXtreamStreamMatch({
      name: `${baseChannelName} 4K`,
      qualities: ['4K'],
      matchConfidence: 0.88,
      isPrimary: false,
      isManual: false,
      streamPriority: 2,
    }),
  ];

  return createXmltvChannelWithMappings({
    displayName: baseChannelName,
    matchCount: matches.length,
    matches,
    isEnabled: true,
    ...overrides,
  });
};

/**
 * Create an XMLTV channel with NO matched streams
 * Should show warning and be disabled by default
 */
export const createXmltvChannelWithNoMatches = (
  overrides: Partial<Omit<XmltvChannelWithMappings, 'matches' | 'matchCount'>> = {}
): XmltvChannelWithMappings => {
  return createXmltvChannelWithMappings({
    matchCount: 0,
    matches: [],
    isEnabled: false, // Disabled by default when no matches
    ...overrides,
  });
};

/**
 * Create a large list of XMLTV channels for performance testing
 * Mix of matched and unmatched channels
 */
export const createLargeXmltvChannelList = (count: number): XmltvChannelWithMappings[] => {
  return Array.from({ length: count }, (_, index) => {
    // 85% matched, 15% unmatched (realistic ratio)
    const hasMatches = faker.datatype.boolean({ probability: 0.85 });

    if (hasMatches) {
      return createXmltvChannelWithMappings({
        id: index + 1,
        displayName: `${faker.company.name()} ${index + 1}`,
      });
    } else {
      return createXmltvChannelWithNoMatches({
        id: index + 1,
        displayName: `${faker.company.name()} ${index + 1}`,
      });
    }
  });
};

/**
 * Create ESPN-style channel set (realistic example)
 * One XMLTV channel → Multiple Xtream quality tiers
 */
export const createESPNChannelExample = (): XmltvChannelWithMappings => {
  return createXmltvChannelWithMultipleMatches({
    displayName: 'ESPN',
    channelId: 'espn.sportschannel.com',
    icon: 'https://example.com/espn-logo.png',
    isEnabled: true,
    plexDisplayOrder: 1,
  });
};

/**
 * Create CNN-style channel set (news channel)
 * Typically 2 streams: HD and SD
 */
export const createCNNChannelExample = (): XmltvChannelWithMappings => {
  return createXmltvChannelWithMappings({
    displayName: 'CNN',
    channelId: 'cnn.newschannel.com',
    matches: [
      createXtreamStreamMatch({
        name: 'CNN HD',
        qualities: ['HD'],
        matchConfidence: 0.98,
        isPrimary: true,
        isManual: false,
        streamPriority: 0,
      }),
      createXtreamStreamMatch({
        name: 'CNN SD',
        qualities: ['SD'],
        matchConfidence: 0.96,
        isPrimary: false,
        isManual: false,
        streamPriority: 1,
      }),
    ],
    matchCount: 2,
    isEnabled: true,
  });
};

/**
 * Create realistic channel list for demo/testing
 * Mix of popular channels with different match scenarios
 */
export const createRealisticChannelList = (): XmltvChannelWithMappings[] => {
  return [
    createESPNChannelExample(),
    createCNNChannelExample(),
    createXmltvChannelWithMultipleMatches({ displayName: 'HBO', isEnabled: true }),
    createXmltvChannelWithMappings({ displayName: 'NBC', matchCount: 2, isEnabled: true }),
    createXmltvChannelWithMappings({ displayName: 'ABC', matchCount: 1, isEnabled: true }),
    createXmltvChannelWithNoMatches({ displayName: 'Local News Channel 5' }),
    createXmltvChannelWithNoMatches({ displayName: 'Community Access TV' }),
    createXmltvChannelWithMappings({ displayName: 'Discovery', matchCount: 3, isEnabled: false }),
  ];
};

/**
 * Create channels filtered by match status
 */
export const createChannelsByMatchStatus = (matched: number, unmatched: number) => {
  const matchedChannels = Array.from({ length: matched }, (_, i) =>
    createXmltvChannelWithMappings({ id: i + 1, displayName: `Channel ${i + 1}` })
  );

  const unmatchedChannels = Array.from({ length: unmatched }, (_, i) =>
    createXmltvChannelWithNoMatches({ id: matched + i + 1, displayName: `Unmatched ${i + 1}` })
  );

  return [...matchedChannels, ...unmatchedChannels];
};

// ============================================================================
// Story 3-3: Manual Match Override via Search Dropdown
// ============================================================================

/**
 * Create an Xtream stream for the search dropdown
 */
export const createXtreamStreamSearchResult = (
  overrides: Partial<XtreamStreamSearchResult> = {}
): XtreamStreamSearchResult => {
  const qualityOptions = ['SD', 'HD', '4K', 'FHD'];
  const randomQualities = faker.helpers.arrayElements(qualityOptions, { min: 1, max: 2 });

  return {
    id: faker.number.int({ min: 1, max: 100000 }),
    streamId: faker.number.int({ min: 1, max: 100000 }),
    name: faker.company.name() + ' ' + faker.helpers.arrayElement(['HD', 'SD', '4K', 'TV']),
    streamIcon: faker.helpers.maybe(() => faker.image.url(), { probability: 0.7 }) ?? null,
    qualities: randomQualities,
    categoryName: faker.helpers.maybe(
      () => faker.helpers.arrayElement(['Sports', 'News', 'Entertainment', 'Movies', 'Kids']),
      { probability: 0.8 }
    ) ?? null,
    matchedToXmltvIds: [],
    ...overrides,
  };
};

/**
 * Create a large list of Xtream streams for the search dropdown
 */
export const createLargeXtreamStreamList = (count: number): XtreamStreamSearchResult[] => {
  return Array.from({ length: count }, (_, index) => {
    return createXtreamStreamSearchResult({
      id: index + 1,
      streamId: index + 1,
      name: `${faker.company.name()} ${index + 1}`,
    });
  });
};

/**
 * Create a manual match (for testing manual match functionality)
 */
export const createManualMatch = (overrides: Partial<XtreamStreamMatch> = {}): XtreamStreamMatch => {
  return createXtreamStreamMatch({
    matchConfidence: 1.0, // Manual matches always have 100% confidence
    isManual: true,
    ...overrides,
  });
};

/**
 * Create an XMLTV channel with a manual match
 */
export const createXmltvChannelWithManualMatch = (
  overrides: Partial<XmltvChannelWithMappings> = {}
): XmltvChannelWithMappings => {
  const manualMatch = createManualMatch({
    isPrimary: true,
    streamPriority: 0,
  });

  return createXmltvChannelWithMappings({
    matchCount: 1,
    matches: [manualMatch],
    isEnabled: true,
    ...overrides,
  });
};
