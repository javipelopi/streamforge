import { faker } from '@faker-js/faker';

/**
 * XMLTV Source Channel with lineup status and match information
 * Used for Sources view display (Story 3-10)
 */
export type XmltvSourceChannel = {
  id: number;
  channelId: string;
  displayName: string;
  icon: string | null;
  isSynthetic: boolean;
  isEnabled: boolean; // true = in lineup, false = not in lineup
  matchCount: number; // number of matched Xtream streams (0 = no streams warning)
};

/**
 * Create a single XMLTV source channel with randomized data
 * @param overrides - Partial XmltvSourceChannel to override defaults
 * @returns Complete XmltvSourceChannel object with unique values
 */
export const createXmltvSourceChannel = (overrides: Partial<XmltvSourceChannel> = {}): XmltvSourceChannel => {
  const id = overrides.id ?? faker.number.int({ min: 1, max: 100000 });
  const hasIcon = faker.datatype.boolean();
  const channelName = faker.helpers.arrayElement([
    'CNN', 'BBC', 'ESPN', 'Discovery', 'National Geographic',
    'Fox News', 'MSNBC', 'HBO', 'Showtime', 'AMC',
    'Comedy Central', 'MTV', 'Nickelodeon', 'Cartoon Network',
    'History Channel', 'A&E', 'Syfy', 'USA Network'
  ]);
  const qualifier = faker.helpers.arrayElement(['HD', '4K', 'Plus', 'World', 'East', 'West', '']);

  return {
    id,
    channelId: overrides.channelId ?? `${faker.string.alpha({ length: 3, casing: 'lower' })}-${faker.string.alphanumeric({ length: 6, casing: 'lower' })}`,
    displayName: overrides.displayName ?? `${channelName} ${qualifier}`.trim(),
    icon: overrides.icon ?? (hasIcon ? `https://example.com/icons/${faker.string.alphanumeric({ length: 8 })}.png` : null),
    isSynthetic: overrides.isSynthetic ?? false,
    isEnabled: overrides.isEnabled ?? faker.datatype.boolean(), // random enabled/disabled by default
    matchCount: overrides.matchCount ?? faker.number.int({ min: 0, max: 5 }), // 0-5 matched streams
    ...overrides,
  };
};

/**
 * Create multiple XMLTV source channels with unique data
 * @param count - Number of channels to create
 * @param overrides - Common overrides to apply to all channels
 * @returns Array of XmltvSourceChannel objects
 */
export const createXmltvSourceChannels = (
  count: number,
  overrides: Partial<XmltvSourceChannel> = {}
): XmltvSourceChannel[] => {
  return Array.from({ length: count }, (_, i) =>
    createXmltvSourceChannel({
      id: (overrides.id ?? 1000) + i, // Sequential IDs starting from override or 1000
      ...overrides,
    })
  );
};

/**
 * Create enabled XMLTV channel (in lineup)
 * @param overrides - Partial XmltvSourceChannel to override defaults
 * @returns XmltvSourceChannel with isEnabled = true
 */
export const createEnabledXmltvChannel = (overrides: Partial<XmltvSourceChannel> = {}): XmltvSourceChannel => {
  return createXmltvSourceChannel({
    isEnabled: true,
    matchCount: overrides.matchCount ?? faker.number.int({ min: 1, max: 5 }), // Enabled channels usually have matches
    ...overrides,
  });
};

/**
 * Create disabled XMLTV channel (not in lineup)
 * @param overrides - Partial XmltvSourceChannel to override defaults
 * @returns XmltvSourceChannel with isEnabled = false
 */
export const createDisabledXmltvChannel = (overrides: Partial<XmltvSourceChannel> = {}): XmltvSourceChannel => {
  return createXmltvSourceChannel({
    isEnabled: false,
    ...overrides,
  });
};

/**
 * Create unmatched XMLTV channel (no stream sources)
 * Used to test "No streams" warning and disabled "Add to Lineup" button
 * @param overrides - Partial XmltvSourceChannel to override defaults
 * @returns XmltvSourceChannel with matchCount = 0
 */
export const createUnmatchedXmltvChannel = (overrides: Partial<XmltvSourceChannel> = {}): XmltvSourceChannel => {
  return createXmltvSourceChannel({
    matchCount: 0,
    isEnabled: false, // Cannot enable channel without matches
    ...overrides,
  });
};

/**
 * Create matched XMLTV channel (has stream sources)
 * @param overrides - Partial XmltvSourceChannel to override defaults
 * @returns XmltvSourceChannel with matchCount > 0
 */
export const createMatchedXmltvChannel = (overrides: Partial<XmltvSourceChannel> = {}): XmltvSourceChannel => {
  return createXmltvSourceChannel({
    matchCount: overrides.matchCount ?? faker.number.int({ min: 1, max: 5 }),
    ...overrides,
  });
};

/**
 * Create synthetic XMLTV channel (promoted orphan)
 * @param overrides - Partial XmltvSourceChannel to override defaults
 * @returns XmltvSourceChannel with isSynthetic = true
 */
export const createSyntheticXmltvChannel = (overrides: Partial<XmltvSourceChannel> = {}): XmltvSourceChannel => {
  return createXmltvSourceChannel({
    isSynthetic: true,
    matchCount: overrides.matchCount ?? faker.number.int({ min: 1, max: 3 }), // Synthetic channels usually have matches
    ...overrides,
  });
};

/**
 * Create a realistic mix of channels for a source
 * @param totalCount - Total number of channels to create
 * @returns Array with realistic distribution: some enabled, some disabled, some unmatched
 */
export const createRealisticChannelMix = (totalCount: number): XmltvSourceChannel[] => {
  const enabledCount = Math.floor(totalCount * 0.3); // 30% enabled
  const unmatchedCount = Math.floor(totalCount * 0.15); // 15% without streams
  const disabledCount = totalCount - enabledCount - unmatchedCount;

  return [
    ...createXmltvSourceChannels(enabledCount, { isEnabled: true, matchCount: faker.number.int({ min: 1, max: 5 }) }),
    ...createXmltvSourceChannels(unmatchedCount, { isEnabled: false, matchCount: 0 }),
    ...createXmltvSourceChannels(disabledCount, { isEnabled: false, matchCount: faker.number.int({ min: 1, max: 3 }) }),
  ];
};
