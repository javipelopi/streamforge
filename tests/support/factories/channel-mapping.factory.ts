import { faker } from '@faker-js/faker';

/**
 * Channel Mapping Factory
 *
 * Generates test data for channel_mappings table (XMLTV → Xtream associations).
 * Follows XMLTV-first architecture where XMLTV channels are primary and multiple
 * Xtream streams can map to one XMLTV channel.
 */

export interface ChannelMapping {
  id?: number;
  xmltvChannelId: number;
  xtreamChannelId: number;
  matchConfidence: number | null;
  isManual: boolean;
  isPrimary: boolean;
  streamPriority: number;
  createdAt: string;
}

export interface NewChannelMapping {
  xmltvChannelId: number;
  xtreamChannelId: number;
  matchConfidence: number | null;
  isManual: boolean;
  isPrimary: boolean;
  streamPriority: number;
}

export interface MatchResult {
  xmltvChannelId: number;
  xtreamChannelId: number;
  confidence: number;
  isPrimary: boolean;
  streamPriority: number;
  matchType: 'exact_epg_id' | 'exact_name' | 'fuzzy' | 'none';
}

export interface XmltvChannelSettings {
  id?: number;
  xmltvChannelId: number;
  isEnabled: boolean;
  plexDisplayOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchStats {
  totalXmltv: number;
  totalXtream: number;
  matched: number;
  unmatched: number;
  multipleMatches: number;
}

/**
 * Create a channel mapping with fuzzy match confidence
 */
export const createChannelMapping = (overrides: Partial<ChannelMapping> = {}): ChannelMapping => ({
  id: faker.number.int({ min: 1, max: 100000 }),
  xmltvChannelId: faker.number.int({ min: 1, max: 10000 }),
  xtreamChannelId: faker.number.int({ min: 1, max: 10000 }),
  matchConfidence: faker.number.float({ min: 0.85, max: 1.0, fractionDigits: 3 }),
  isManual: false,
  isPrimary: true,
  streamPriority: 0,
  createdAt: faker.date.recent().toISOString(),
  ...overrides,
});

/**
 * Create new channel mapping for insertion
 */
export const createNewChannelMapping = (overrides: Partial<NewChannelMapping> = {}): NewChannelMapping => ({
  xmltvChannelId: faker.number.int({ min: 1, max: 10000 }),
  xtreamChannelId: faker.number.int({ min: 1, max: 10000 }),
  matchConfidence: faker.number.float({ min: 0.85, max: 1.0, fractionDigits: 3 }),
  isManual: false,
  isPrimary: true,
  streamPriority: 0,
  ...overrides,
});

/**
 * Create primary mapping (highest confidence match)
 */
export const createPrimaryMapping = (
  xmltvChannelId: number,
  xtreamChannelId: number,
  overrides: Partial<ChannelMapping> = {}
): ChannelMapping => {
  return createChannelMapping({
    xmltvChannelId,
    xtreamChannelId,
    matchConfidence: faker.number.float({ min: 0.95, max: 1.0, fractionDigits: 3 }),
    isPrimary: true,
    streamPriority: 0,
    ...overrides,
  });
};

/**
 * Create failover mapping (alternate match)
 */
export const createFailoverMapping = (
  xmltvChannelId: number,
  xtreamChannelId: number,
  priority: number,
  overrides: Partial<ChannelMapping> = {}
): ChannelMapping => {
  return createChannelMapping({
    xmltvChannelId,
    xtreamChannelId,
    matchConfidence: faker.number.float({ min: 0.85, max: 0.94, fractionDigits: 3 }),
    isPrimary: false,
    streamPriority: priority,
    ...overrides,
  });
};

/**
 * Create one-to-many mapping set (1 XMLTV → multiple Xtream)
 * Example: ESPN → [ESPN HD, ESPN SD, ESPN 4K]
 */
export const createOneToManyMappings = (
  xmltvChannelId: number,
  xtreamChannelIds: number[]
): ChannelMapping[] => {
  return xtreamChannelIds.map((xtreamId, index) => {
    if (index === 0) {
      return createPrimaryMapping(xmltvChannelId, xtreamId);
    }
    return createFailoverMapping(xmltvChannelId, xtreamId, index);
  });
};

/**
 * Create manual mapping (user-created)
 */
export const createManualMapping = (
  xmltvChannelId: number,
  xtreamChannelId: number,
  overrides: Partial<ChannelMapping> = {}
): ChannelMapping => {
  return createChannelMapping({
    xmltvChannelId,
    xtreamChannelId,
    matchConfidence: null,
    isManual: true,
    isPrimary: true,
    streamPriority: 0,
    ...overrides,
  });
};

/**
 * Create match result for algorithm output
 */
export const createMatchResult = (overrides: Partial<MatchResult> = {}): MatchResult => ({
  xmltvChannelId: faker.number.int({ min: 1, max: 10000 }),
  xtreamChannelId: faker.number.int({ min: 1, max: 10000 }),
  confidence: faker.number.float({ min: 0.85, max: 1.0, fractionDigits: 3 }),
  isPrimary: true,
  streamPriority: 0,
  matchType: 'fuzzy',
  ...overrides,
});

/**
 * Create XMLTV channel settings
 */
export const createXmltvChannelSettings = (overrides: Partial<XmltvChannelSettings> = {}): XmltvChannelSettings => ({
  id: faker.number.int({ min: 1, max: 100000 }),
  xmltvChannelId: faker.number.int({ min: 1, max: 10000 }),
  isEnabled: false, // Default disabled until user enables
  plexDisplayOrder: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 1000 })) ?? null,
  createdAt: faker.date.recent().toISOString(),
  updatedAt: faker.date.recent().toISOString(),
  ...overrides,
});

/**
 * Create enabled channel settings
 */
export const createEnabledChannelSettings = (xmltvChannelId: number): XmltvChannelSettings => {
  return createXmltvChannelSettings({
    xmltvChannelId,
    isEnabled: true,
  });
};

/**
 * Create disabled channel settings (no matches)
 */
export const createDisabledChannelSettings = (xmltvChannelId: number): XmltvChannelSettings => {
  return createXmltvChannelSettings({
    xmltvChannelId,
    isEnabled: false,
  });
};

/**
 * Create match statistics
 */
export const createMatchStats = (overrides: Partial<MatchStats> = {}): MatchStats => ({
  totalXmltv: faker.number.int({ min: 100, max: 1000 }),
  totalXtream: faker.number.int({ min: 100, max: 1000 }),
  matched: faker.number.int({ min: 50, max: 900 }),
  unmatched: faker.number.int({ min: 0, max: 100 }),
  multipleMatches: faker.number.int({ min: 10, max: 200 }),
  ...overrides,
});

/**
 * Create realistic ESPN-style channel set (multiple qualities)
 */
export const createESPNChannelSet = () => {
  const xmltvId = faker.number.int({ min: 1, max: 10000 });
  const xtreamIds = {
    hd: faker.number.int({ min: 10000, max: 99999 }),
    sd: faker.number.int({ min: 10000, max: 99999 }),
    fourK: faker.number.int({ min: 10000, max: 99999 }),
  };

  return {
    xmltvChannelId: xmltvId,
    mappings: [
      createPrimaryMapping(xmltvId, xtreamIds.hd, { matchConfidence: 0.98 }),
      createFailoverMapping(xmltvId, xtreamIds.sd, 1, { matchConfidence: 0.95 }),
      createFailoverMapping(xmltvId, xtreamIds.fourK, 2, { matchConfidence: 0.92 }),
    ],
    settings: createEnabledChannelSettings(xmltvId),
  };
};
