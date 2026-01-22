import { faker } from '@faker-js/faker';

/**
 * EPG Top Bar Factory
 *
 * Creates test data for the EPG top bar (Story 5.7).
 * Generates day navigation options, search results, and test programs.
 */

export type DayOption = {
  id: string; // "today", "tonight", "tomorrow", "wed", etc.
  label: string; // "Today", "Tonight", "Tomorrow", "Wed", etc.
  date: Date;
  startTime: Date;
  endTime: Date;
};

export type EpgTopBarTestData = {
  dayOptions: DayOption[];
  channels: Array<{
    id: number;
    name: string;
    icon?: string;
  }>;
  programs: Array<{
    id: number;
    channelId: number;
    title: string;
    startTime: string;
    endTime: string;
    category?: string;
    description?: string;
  }>;
};

/**
 * Create day navigation options (Today, Tonight, Tomorrow, + 4 weekdays)
 * @returns Array of day options
 */
export const createDayOptions = (): DayOption[] => {
  const now = new Date();
  const options: DayOption[] = [];

  // Today (current time onwards)
  const today = new Date(now);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  options.push({
    id: 'today',
    label: 'Today',
    date: new Date(today),
    startTime: new Date(now),
    endTime: todayEnd,
  });

  // Tonight (6 PM onwards)
  const tonight = new Date(now);
  tonight.setHours(18, 0, 0, 0);
  const tonightEnd = new Date(tonight);
  tonightEnd.setHours(23, 59, 59, 999);
  options.push({
    id: 'tonight',
    label: 'Tonight',
    date: new Date(tonight),
    startTime: new Date(tonight),
    endTime: tonightEnd,
  });

  // Tomorrow (6 AM to end of day)
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(29, 59, 59, 999); // 6 AM next day (24 hours from 6 AM)
  options.push({
    id: 'tomorrow',
    label: 'Tomorrow',
    date: new Date(tomorrow),
    startTime: new Date(tomorrow),
    endTime: tomorrowEnd,
  });

  // Next 4 days (weekdays)
  for (let i = 2; i <= 5; i++) {
    const dayDate = new Date(now);
    dayDate.setDate(dayDate.getDate() + i);
    dayDate.setHours(6, 0, 0, 0);

    const dayEnd = new Date(dayDate);
    dayEnd.setHours(29, 59, 59, 999); // 24 hours from 6 AM

    const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
    const dayId = dayName.toLowerCase();

    options.push({
      id: dayId,
      label: dayName,
      date: new Date(dayDate),
      startTime: new Date(dayDate),
      endTime: dayEnd,
    });
  }

  return options;
};

/**
 * Format date as day chip label
 * @param date - Date to format
 * @returns Formatted label (e.g., "Wed", "Thu")
 */
export const formatDayChipLabel = (date: Date): string => {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
};

/**
 * Get time window for a specific day selection
 * @param dayId - Day identifier ("today", "tomorrow", "wed", etc.)
 * @returns Time window with start and end times
 */
export const getTimeWindowForDay = (
  dayId: string
): { startTime: Date; endTime: Date } => {
  const dayOptions = createDayOptions();
  const selectedDay = dayOptions.find((d) => d.id === dayId);

  if (!selectedDay) {
    throw new Error(`Invalid dayId: ${dayId}`);
  }

  return {
    startTime: selectedDay.startTime,
    endTime: selectedDay.endTime,
  };
};

/**
 * Create a test program for search results
 * @param overrides - Partial program data to override defaults
 * @returns Program object
 */
export const createTestProgram = (
  overrides: Partial<{
    id: number;
    channelId: number;
    title: string;
    startTime: Date;
    endTime: Date;
    category: string;
    description: string;
  }> = {}
) => {
  const now = new Date();
  const startTime = overrides.startTime || new Date(now.getTime() + faker.number.int({ min: -120, max: 120 }) * 60 * 1000);
  const endTime = overrides.endTime || new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

  return {
    id: overrides.id || faker.number.int({ min: 1000, max: 99999 }),
    channelId: overrides.channelId || faker.number.int({ min: 100, max: 199 }),
    title:
      overrides.title ||
      faker.helpers.arrayElement([
        'Morning News',
        'Breakfast Show',
        'Sports Tonight',
        'Movie: Action Hero',
        'Documentary Special',
        'Evening News',
        'Prime Time Drama',
        'Late Night Show',
        'Comedy Hour',
        'Science Show',
      ]),
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    category:
      overrides.category ||
      faker.helpers.arrayElement(['News', 'Sports', 'Movies', 'Entertainment', 'Documentary']),
    description:
      overrides.description || faker.lorem.sentence(),
  };
};

/**
 * Create multiple test programs
 * @param count - Number of programs to create
 * @param channelId - Channel ID for all programs
 * @returns Array of programs
 */
export const createTestPrograms = (count: number, channelId: number) => {
  const programs = [];
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(6, 0, 0, 0);

  for (let i = 0; i < count; i++) {
    const startTime = new Date(startOfDay.getTime() + i * 60 * 60 * 1000); // Hourly programs
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

    programs.push(
      createTestProgram({
        id: channelId * 1000 + i + 1,
        channelId,
        title: `Program ${i + 1}`,
        startTime,
        endTime,
      })
    );
  }

  return programs;
};

/**
 * Create complete top bar test data
 * @param config - Configuration for test data generation
 * @returns Complete test data with day options, channels, and programs
 */
export const createTopBarTestData = (config: {
  channelCount?: number;
  programsPerChannel?: number;
} = {}): EpgTopBarTestData => {
  const channelCount = config.channelCount || 5;
  const programsPerChannel = config.programsPerChannel || 20;

  const dayOptions = createDayOptions();
  const channels = [];
  const programs = [];

  // Create test channels
  for (let i = 0; i < channelCount; i++) {
    const channelId = 100 + i;
    channels.push({
      id: channelId,
      name: `Test Channel ${channelId}`,
      icon: undefined,
    });

    // Create programs for this channel
    const channelPrograms = createTestPrograms(programsPerChannel, channelId);
    programs.push(...channelPrograms);
  }

  return {
    dayOptions,
    channels,
    programs,
  };
};

/**
 * Create a search result object (compatible with EpgSearchResult type)
 * @param overrides - Partial search result data
 * @returns Search result object
 */
export const createSearchResult = (
  overrides: Partial<{
    programId: number;
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    category: string;
    channelId: number;
    channelName: string;
    channelIcon: string;
    matchType: 'title' | 'channel' | 'description';
    relevanceScore: number;
  }> = {}
) => {
  const now = new Date();
  const startTime =
    overrides.startTime ||
    new Date(now.getTime() + faker.number.int({ min: -60, max: 120 }) * 60 * 1000).toISOString();
  const endTime =
    overrides.endTime ||
    new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();

  return {
    programId: overrides.programId || faker.number.int({ min: 1000, max: 99999 }),
    title: overrides.title || faker.lorem.words(3),
    description: overrides.description || faker.lorem.sentence(),
    startTime,
    endTime,
    category: overrides.category || 'Entertainment',
    channelId: overrides.channelId || faker.number.int({ min: 100, max: 199 }),
    channelName: overrides.channelName || `Channel ${faker.number.int({ min: 1, max: 100 })}`,
    channelIcon: overrides.channelIcon,
    matchType: overrides.matchType || 'title',
    relevanceScore: overrides.relevanceScore || faker.number.float({ min: 0.5, max: 1.0 }),
  };
};

/**
 * Create multiple search results
 * @param count - Number of results to create
 * @param query - Search query to base titles on
 * @returns Array of search results
 */
export const createSearchResults = (count: number, query?: string) => {
  const results = [];

  for (let i = 0; i < count; i++) {
    const title = query
      ? `${query} Program ${i + 1}`
      : faker.lorem.words(3);

    results.push(
      createSearchResult({
        title,
        relevanceScore: 1.0 - i * 0.05, // Descending relevance
      })
    );
  }

  return results;
};

/**
 * Create empty search results
 * @returns Empty array
 */
export const createEmptySearchResults = () => {
  return [];
};

/**
 * Create search result with long text for truncation testing
 * @returns Search result with very long title
 */
export const createSearchResultWithLongText = () => {
  return createSearchResult({
    title:
      'Super Long Program Title That Should Be Truncated With Ellipsis Because It Is Too Long To Display In A Single Line Without Scrolling',
    description: faker.lorem.paragraphs(3),
  });
};

/**
 * Create top bar state object for testing
 * @param overrides - Partial state data
 * @returns Complete top bar state
 */
export const createTopBarState = (
  overrides: Partial<{
    selectedDay: string;
    searchQuery: string;
    searchResults: any[];
    isSearching: boolean;
    isResultsVisible: boolean;
  }> = {}
) => {
  return {
    selectedDay: overrides.selectedDay || 'today',
    searchQuery: overrides.searchQuery || '',
    searchResults: overrides.searchResults || [],
    isSearching: overrides.isSearching || false,
    isResultsVisible: overrides.isResultsVisible || false,
  };
};
