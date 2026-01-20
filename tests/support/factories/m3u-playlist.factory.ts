import { faker } from '@faker-js/faker';

/**
 * M3U Playlist Factory
 *
 * Generates test data for M3U playlist generation and validation.
 * Supports creating M3U channels with all required attributes for Plex integration.
 */

export interface M3uChannel {
  xmltvChannelId: number;
  displayName: string;
  channelNumber: number;
  logoUrl: string | null;
  tvgId: string;
  streamUrl: string;
}

export interface M3uPlaylistData {
  channels: M3uChannel[];
  header: string;
  totalChannels: number;
}

export interface EnabledChannelWithMapping {
  xmltvChannelId: number;
  xmltvChannelChannelId: string; // tvg-id
  xmltvDisplayName: string;
  xmltvIcon: string | null;
  isSynthetic: boolean;
  plexDisplayOrder: number | null;
  xtreamChannelId: number;
  xtreamStreamIcon: string | null;
  isPrimary: boolean;
  streamPriority: number;
}

/**
 * Create a random M3U channel entry
 */
export const createM3uChannel = (overrides: Partial<M3uChannel> = {}): M3uChannel => {
  const channelId = faker.number.int({ min: 1, max: 10000 });
  const port = 5004;
  const channelTypes = ['Sports', 'News', 'Entertainment', 'Movies', 'Kids'];
  const channelType = faker.helpers.arrayElement(channelTypes);

  return {
    xmltvChannelId: channelId,
    displayName: `${channelType} ${faker.company.name()}`,
    channelNumber: faker.number.int({ min: 1, max: 999 }),
    logoUrl: faker.helpers.maybe(() => faker.image.url(), { probability: 0.7 }) ?? null,
    tvgId: `${faker.helpers.slugify(channelType.toLowerCase())}.${faker.location.countryCode().toLowerCase()}`,
    streamUrl: `http://127.0.0.1:${port}/stream/${channelId}`,
    ...overrides,
  };
};

/**
 * Create multiple M3U channels
 */
export const createM3uChannels = (count: number): M3uChannel[] => {
  return Array.from({ length: count }, (_, index) =>
    createM3uChannel({
      channelNumber: index + 1, // Sequential channel numbers
    })
  );
};

/**
 * Create M3U channel without logo (tests fallback logic)
 */
export const createM3uChannelWithoutLogo = (overrides: Partial<M3uChannel> = {}): M3uChannel => {
  return createM3uChannel({
    logoUrl: null,
    ...overrides,
  });
};

/**
 * Create M3U channel with specific channel number
 */
export const createM3uChannelWithNumber = (
  channelNumber: number,
  overrides: Partial<M3uChannel> = {}
): M3uChannel => {
  return createM3uChannel({
    channelNumber,
    ...overrides,
  });
};

/**
 * Create ordered M3U channel list
 */
export const createOrderedM3uChannels = (count: number): M3uChannel[] => {
  return Array.from({ length: count }, (_, index) =>
    createM3uChannelWithNumber(index + 1)
  );
};

/**
 * Create M3U playlist data structure
 */
export const createM3uPlaylistData = (channelCount: number = 10): M3uPlaylistData => {
  const channels = createOrderedM3uChannels(channelCount);

  return {
    channels,
    header: '#EXTM3U',
    totalChannels: channelCount,
  };
};

/**
 * Generate M3U playlist text from channels
 * Useful for testing playlist parsing and validation
 */
export const generateM3uPlaylistText = (channels: M3uChannel[]): string => {
  let playlist = '#EXTM3U\n';

  channels.forEach((channel) => {
    const logoAttr = channel.logoUrl ? ` tvg-logo="${channel.logoUrl}"` : '';

    playlist += `#EXTINF:-1 tvg-id="${channel.tvgId}" tvg-name="${channel.displayName}"${logoAttr} tvg-chno="${channel.channelNumber}",${channel.displayName}\n`;
    playlist += `${channel.streamUrl}\n`;
  });

  return playlist;
};

/**
 * Create enabled channel with Xtream mapping (database query result format)
 */
export const createEnabledChannelWithMapping = (
  overrides: Partial<EnabledChannelWithMapping> = {}
): EnabledChannelWithMapping => {
  const channelType = faker.helpers.arrayElement(['Sports', 'News', 'Entertainment', 'Movies']);
  const domain = faker.internet.domainName();
  const slug = faker.helpers.slugify(channelType.toLowerCase());

  return {
    xmltvChannelId: faker.number.int({ min: 1, max: 10000 }),
    xmltvChannelChannelId: `${slug}.${domain}`,
    xmltvDisplayName: `${channelType} ${faker.company.name()}`,
    xmltvIcon: faker.helpers.maybe(() => faker.image.url(), { probability: 0.6 }) ?? null,
    isSynthetic: false,
    plexDisplayOrder: faker.number.int({ min: 1, max: 999 }),
    xtreamChannelId: faker.number.int({ min: 1, max: 10000 }),
    xtreamStreamIcon: faker.helpers.maybe(() => faker.image.url(), { probability: 0.7 }) ?? null,
    isPrimary: true,
    streamPriority: 0,
    ...overrides,
  };
};

/**
 * Create enabled channel without XMLTV icon (tests Xtream fallback)
 */
export const createEnabledChannelWithXtreamIconFallback = (): EnabledChannelWithMapping => {
  return createEnabledChannelWithMapping({
    xmltvIcon: null,
    xtreamStreamIcon: faker.image.url(), // Fallback icon from Xtream
  });
};

/**
 * Create synthetic channel (promoted orphan)
 */
export const createSyntheticChannel = (overrides: Partial<EnabledChannelWithMapping> = {}): EnabledChannelWithMapping => {
  return createEnabledChannelWithMapping({
    isSynthetic: true,
    xmltvDisplayName: `${faker.company.name()} [Synthetic]`,
    xmltvIcon: faker.image.url(), // Synthetic channels use Xtream icon
    ...overrides,
  });
};

/**
 * Create channel with null plex_display_order
 */
export const createChannelWithoutOrder = (): EnabledChannelWithMapping => {
  return createEnabledChannelWithMapping({
    plexDisplayOrder: null,
  });
};

/**
 * Create multiple enabled channels with mappings
 */
export const createEnabledChannelsWithMappings = (count: number): EnabledChannelWithMapping[] => {
  return Array.from({ length: count }, (_, index) =>
    createEnabledChannelWithMapping({
      plexDisplayOrder: index + 1, // Sequential ordering
    })
  );
};

/**
 * Create test dataset with ordered and unordered channels
 */
export const createMixedOrderChannels = () => {
  return [
    // Ordered channels (should appear first)
    createEnabledChannelWithMapping({ plexDisplayOrder: 100 }),
    createEnabledChannelWithMapping({ plexDisplayOrder: 50 }),
    createEnabledChannelWithMapping({ plexDisplayOrder: 200 }),

    // Unordered channels (should appear after, alphabetically)
    createChannelWithoutOrder(),
    createChannelWithoutOrder(),
  ];
};

/**
 * Create ESPN-style multi-quality channel set (for testing primary stream selection)
 */
export const createESPNMultiQualitySet = () => {
  const xmltvId = faker.number.int({ min: 1, max: 10000 });
  const baseOrder = faker.number.int({ min: 100, max: 200 });

  return {
    // Primary HD stream
    primary: createEnabledChannelWithMapping({
      xmltvChannelId: xmltvId,
      xmltvDisplayName: 'ESPN HD',
      plexDisplayOrder: baseOrder,
      isPrimary: true,
      streamPriority: 0,
    }),

    // Failover streams (not used in M3U, but exist in DB)
    failovers: [
      createEnabledChannelWithMapping({
        xmltvChannelId: xmltvId,
        xmltvDisplayName: 'ESPN HD', // Same XMLTV channel
        isPrimary: false,
        streamPriority: 1,
      }),
      createEnabledChannelWithMapping({
        xmltvChannelId: xmltvId,
        xmltvDisplayName: 'ESPN HD',
        isPrimary: false,
        streamPriority: 2,
      }),
    ],
  };
};

/**
 * Parse M3U playlist text into structured data
 * Useful for validating generated playlists
 */
export const parseM3uPlaylist = (playlistText: string): M3uChannel[] => {
  const channels: M3uChannel[] = [];
  const lines = playlistText.trim().split('\n');

  for (let i = 1; i < lines.length; i += 2) {
    const infoLine = lines[i];
    const urlLine = lines[i + 1];

    if (!infoLine.startsWith('#EXTINF') || !urlLine) {
      continue;
    }

    // Extract attributes using regex
    const tvgIdMatch = infoLine.match(/tvg-id="([^"]*)"/);
    const tvgNameMatch = infoLine.match(/tvg-name="([^"]*)"/);
    const tvgLogoMatch = infoLine.match(/tvg-logo="([^"]*)"/);
    const tvgChnoMatch = infoLine.match(/tvg-chno="([^"]*)"/);
    const displayNameMatch = infoLine.match(/,(.+)$/);

    // Extract xmltv_channel_id from stream URL
    const streamIdMatch = urlLine.match(/\/stream\/(\d+)/);

    channels.push({
      xmltvChannelId: streamIdMatch ? parseInt(streamIdMatch[1], 10) : 0,
      displayName: displayNameMatch ? displayNameMatch[1].trim() : '',
      channelNumber: tvgChnoMatch ? parseInt(tvgChnoMatch[1], 10) : 0,
      logoUrl: tvgLogoMatch ? tvgLogoMatch[1] : null,
      tvgId: tvgIdMatch ? tvgIdMatch[1] : '',
      streamUrl: urlLine.trim(),
    });
  }

  return channels;
};

/**
 * Validate M3U playlist format
 */
export const validateM3uPlaylist = (playlistText: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Must start with #EXTM3U
  if (!playlistText.trim().startsWith('#EXTM3U')) {
    errors.push('Playlist must start with #EXTM3U header');
  }

  // Check for proper line structure
  const lines = playlistText.trim().split('\n');
  for (let i = 1; i < lines.length; i += 2) {
    const infoLine = lines[i];
    const urlLine = lines[i + 1];

    if (!infoLine?.startsWith('#EXTINF')) {
      errors.push(`Line ${i + 1} should be #EXTINF entry`);
    }

    if (!urlLine?.startsWith('http://')) {
      errors.push(`Line ${i + 2} should be stream URL`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
