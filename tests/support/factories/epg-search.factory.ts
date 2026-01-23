import { faker } from '@faker-js/faker';

/**
 * EPG Search Result Factory
 *
 * Creates test data for EPG search functionality.
 * Follows data-factories.md patterns with faker for randomization.
 *
 * Story: 5.2 - EPG Search Functionality
 */

export type EpgSearchResult = {
  programId: number;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  category?: string;
  channelId: number;
  channelName: string;
  channelIcon?: string;
  /** Match type for relevance: 'title', 'channel', 'description' */
  matchType: 'title' | 'channel' | 'description';
  /** Match score 0-1 for relevance ordering */
  relevanceScore: number;
};

/**
 * Create a single EPG search result
 * @param overrides - Partial EpgSearchResult to override defaults
 * @returns Complete search result object
 */
export const createEpgSearchResult = (
  overrides: Partial<EpgSearchResult> = {}
): EpgSearchResult => {
  const matchType = overrides.matchType || faker.helpers.arrayElement(['title', 'channel', 'description']);

  // Relevance score based on match type
  const baseScore = matchType === 'title' ? 1.0 : matchType === 'channel' ? 0.7 : 0.5;
  const relevanceScore = overrides.relevanceScore ?? baseScore;

  const startTime = faker.date.soon({ days: 7 });
  const durationMinutes = faker.number.int({ min: 30, max: 180 });
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  return {
    programId: faker.number.int({ min: 1, max: 100000 }),
    title: faker.helpers.arrayElement([
      'Breaking News Tonight',
      'Sports Center Live',
      'Movie Marathon',
      'Documentary: Nature',
      'Comedy Special',
      'Drama Series: Season Finale',
      'News Update',
      'Late Night Talk Show',
      'Reality TV Competition',
      'Kids Cartoons',
    ]),
    description: faker.datatype.boolean()
      ? faker.lorem.sentence({ min: 10, max: 20 })
      : undefined,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    category: faker.helpers.arrayElement([
      'News',
      'Sports',
      'Movies',
      'Documentary',
      'Entertainment',
      'Kids',
    ]),
    channelId: faker.number.int({ min: 1, max: 1000 }),
    channelName: faker.helpers.arrayElement([
      'ABC News',
      'NBC Sports',
      'HBO',
      'ESPN',
      'CNN',
      'Fox Sports',
      'Discovery Channel',
      'National Geographic',
      'Comedy Central',
    ]),
    channelIcon: faker.datatype.boolean() ? faker.image.url() : undefined,
    matchType,
    relevanceScore,
    ...overrides,
  };
};

/**
 * Create multiple EPG search results with varied relevance
 * @param count - Number of results to create
 * @returns Array of search results sorted by relevance
 */
export const createEpgSearchResults = (count: number): EpgSearchResult[] => {
  const results = Array.from({ length: count }, () => createEpgSearchResult());

  // Sort by relevance score (highest first)
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
};

/**
 * Create realistic search results matching a specific query
 * @param query - Search query string
 * @param channels - Available channels to search
 * @param programs - Available programs to search
 * @returns Array of matching search results with relevance scoring
 */
export const createSearchResultsForQuery = (
  query: string,
  channels: Array<{ id: number; name: string; icon?: string; isEnabled: boolean }>,
  programs: Array<{
    id: number;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    category?: string;
    channelId: number;
  }>
): EpgSearchResult[] => {
  const lowerQuery = query.toLowerCase();
  const results: EpgSearchResult[] = [];

  // Filter to only enabled channels
  const enabledChannelIds = new Set(
    channels.filter((ch) => ch.isEnabled).map((ch) => ch.id)
  );

  for (const program of programs) {
    // Only search programs from enabled channels
    if (!enabledChannelIds.has(program.channelId)) {
      continue;
    }

    const channel = channels.find((ch) => ch.id === program.channelId);
    if (!channel) continue;

    let matchType: 'title' | 'channel' | 'description' | null = null;
    let relevanceScore = 0;

    // Check title match (highest relevance)
    if (program.title.toLowerCase().includes(lowerQuery)) {
      matchType = 'title';
      relevanceScore = 1.0;
    }
    // Check channel name match (medium relevance)
    else if (channel.name.toLowerCase().includes(lowerQuery)) {
      matchType = 'channel';
      relevanceScore = 0.7;
    }
    // Check description match (lowest relevance)
    else if (program.description?.toLowerCase().includes(lowerQuery)) {
      matchType = 'description';
      relevanceScore = 0.5;
    }

    if (matchType) {
      results.push({
        programId: program.id,
        title: program.title,
        description: program.description,
        startTime: program.startTime,
        endTime: program.endTime,
        category: program.category,
        channelId: channel.id,
        channelName: channel.name,
        channelIcon: channel.icon,
        matchType,
        relevanceScore,
      });
    }
  }

  // Sort by relevance (highest first), then by start time
  return results
    .sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    })
    .slice(0, 50); // Limit to 50 results for performance
};

/**
 * Create search results with specific match types for testing
 * @param titleMatches - Number of title matches
 * @param channelMatches - Number of channel matches
 * @param descriptionMatches - Number of description matches
 * @returns Array of search results with specified distribution
 */
export const createSearchResultsByMatchType = (
  titleMatches: number,
  channelMatches: number,
  descriptionMatches: number
): EpgSearchResult[] => {
  const results: EpgSearchResult[] = [];

  // Create title matches
  for (let i = 0; i < titleMatches; i++) {
    results.push(
      createEpgSearchResult({
        matchType: 'title',
        relevanceScore: 1.0,
      })
    );
  }

  // Create channel matches
  for (let i = 0; i < channelMatches; i++) {
    results.push(
      createEpgSearchResult({
        matchType: 'channel',
        relevanceScore: 0.7,
      })
    );
  }

  // Create description matches
  for (let i = 0; i < descriptionMatches; i++) {
    results.push(
      createEpgSearchResult({
        matchType: 'description',
        relevanceScore: 0.5,
      })
    );
  }

  // Sort by relevance
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
};
