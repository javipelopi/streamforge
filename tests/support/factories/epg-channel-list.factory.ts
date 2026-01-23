import { faker } from '@faker-js/faker';

/**
 * EPG Channel List Factory
 *
 * Creates test data for the EPG channel list panel (Story 5.5).
 * Generates channels with current program information and progress data.
 */

export type EpgChannelWithCurrentProgram = {
  id: number;
  channelId: number;
  channelName: string;
  channelIcon?: string;
  plexDisplayOrder: number;
  currentProgram?: {
    id: number;
    title: string;
    startTime: string; // ISO 8601
    endTime: string; // ISO 8601
    category?: string;
    description?: string;
    progressPercent: number; // 0-100
  };
};

export type EpgChannelListData = {
  channels: EpgChannelWithCurrentProgram[];
  timestamp: Date;
};

/**
 * Calculate progress percentage for a program
 * @param startTime - Program start time
 * @param endTime - Program end time
 * @param currentTime - Current time (defaults to now)
 * @returns Progress percentage (0-100)
 */
export const calculateProgramProgress = (
  startTime: string,
  endTime: string,
  currentTime: Date = new Date()
): number => {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (currentTime < start) return 0; // Program hasn't started
  if (currentTime > end) return 100; // Program has ended

  const elapsed = currentTime.getTime() - start.getTime();
  const duration = end.getTime() - start.getTime();
  return (elapsed / duration) * 100;
};

/**
 * Create a channel with a current program
 * @param overrides - Partial channel data to override defaults
 * @returns Channel with current program info
 */
export const createEpgChannelWithCurrentProgram = (
  overrides: Partial<EpgChannelWithCurrentProgram> = {}
): EpgChannelWithCurrentProgram => {
  const channelId = overrides.channelId || faker.number.int({ min: 1, max: 10000 });
  const now = new Date();

  // Create a program that's currently airing (started 30 min ago, ends 30 min from now)
  const programStartTime = new Date(now.getTime() - 30 * 60 * 1000);
  const programEndTime = new Date(now.getTime() + 30 * 60 * 1000);

  const currentProgram = overrides.currentProgram || {
    id: faker.number.int({ min: 1, max: 100000 }),
    title: faker.helpers.arrayElement([
      'Breaking News',
      'The Late Show',
      'Sports Tonight',
      'Movie: Action Hero',
      'Documentary Series',
      'Comedy Special',
      'Live Concert',
      'Game Show',
      'Reality TV',
      'Cooking Show',
    ]),
    startTime: programStartTime.toISOString(),
    endTime: programEndTime.toISOString(),
    category: faker.helpers.arrayElement([
      'News',
      'Sports',
      'Movies',
      'Entertainment',
      'Documentary',
    ]),
    description: faker.lorem.sentence(),
    progressPercent: calculateProgramProgress(
      programStartTime.toISOString(),
      programEndTime.toISOString()
    ),
  };

  return {
    id: channelId,
    channelId,
    channelName: faker.helpers.arrayElement([
      'ABC News',
      'NBC Sports',
      'HBO Max',
      'ESPN',
      'CNN International',
      'Fox Sports',
      'Discovery Channel',
      'National Geographic',
      'Comedy Central',
      'MTV',
      'Nickelodeon',
      'Cartoon Network',
      'BBC One',
      'Sky News',
      'TNT',
      'USA Network',
    ]),
    channelIcon: faker.datatype.boolean() ? faker.image.url() : undefined,
    plexDisplayOrder: faker.number.int({ min: 1, max: 1000 }),
    currentProgram,
    ...overrides,
  };
};

/**
 * Create a channel without a current program
 * @param overrides - Partial channel data
 * @returns Channel without current program
 */
export const createEpgChannelWithoutProgram = (
  overrides: Partial<Omit<EpgChannelWithCurrentProgram, 'currentProgram'>> = {}
): EpgChannelWithCurrentProgram => {
  const channelId = overrides.channelId || faker.number.int({ min: 1, max: 10000 });

  return {
    id: channelId,
    channelId,
    channelName: overrides.channelName || faker.company.name() + ' TV',
    channelIcon: overrides.channelIcon,
    plexDisplayOrder: overrides.plexDisplayOrder || faker.number.int({ min: 1, max: 1000 }),
    currentProgram: undefined,
  };
};

/**
 * Create multiple channels with current programs
 * @param count - Number of channels to create
 * @returns Array of channels
 */
export const createEpgChannelsWithPrograms = (count: number): EpgChannelWithCurrentProgram[] => {
  return Array.from({ length: count }, (_, index) =>
    createEpgChannelWithCurrentProgram({
      channelId: index + 1,
      plexDisplayOrder: index + 1,
    })
  );
};

/**
 * Create complete EPG channel list data
 * @param overrides - Configuration options
 * @returns Complete channel list data structure
 */
export const createEpgChannelListData = (
  overrides: {
    channelCount?: number;
    includeChannelsWithoutPrograms?: boolean;
    withoutProgramCount?: number;
  } = {}
): EpgChannelListData => {
  const channelCount = overrides.channelCount || 20;
  const withoutProgramCount = overrides.withoutProgramCount || 0;

  // Create channels with current programs
  const channelsWithPrograms = createEpgChannelsWithPrograms(channelCount);

  // Optionally add channels without programs
  const channelsWithoutPrograms = overrides.includeChannelsWithoutPrograms
    ? Array.from({ length: withoutProgramCount }, (_, index) =>
        createEpgChannelWithoutProgram({
          channelId: channelCount + index + 1,
          plexDisplayOrder: channelCount + index + 1,
        })
      )
    : [];

  return {
    channels: [...channelsWithPrograms, ...channelsWithoutPrograms],
    timestamp: new Date(),
  };
};

/**
 * Create a channel with a program at specific progress
 * @param progressPercent - Progress percentage (0-100)
 * @param overrides - Additional channel overrides
 * @returns Channel with program at specified progress
 */
export const createEpgChannelAtProgress = (
  progressPercent: number,
  overrides: Partial<EpgChannelWithCurrentProgram> = {}
): EpgChannelWithCurrentProgram => {
  const now = new Date();
  const totalDuration = 60 * 60 * 1000; // 1 hour program

  // Calculate start time based on desired progress
  const elapsedTime = (progressPercent / 100) * totalDuration;
  const startTime = new Date(now.getTime() - elapsedTime);
  const endTime = new Date(startTime.getTime() + totalDuration);

  return createEpgChannelWithCurrentProgram({
    ...overrides,
    currentProgram: {
      id: faker.number.int({ min: 1, max: 100000 }),
      title: faker.lorem.words(3),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      category: faker.helpers.arrayElement(['News', 'Sports', 'Movies']),
      description: faker.lorem.sentence(),
      progressPercent,
    },
  });
};

/**
 * Create channels with varying progress percentages
 * @param count - Number of channels to create
 * @returns Channels with varied progress (0-100%)
 */
export const createEpgChannelsWithVariedProgress = (
  count: number
): EpgChannelWithCurrentProgram[] => {
  return Array.from({ length: count }, (_, index) => {
    const progressPercent = (index / count) * 100; // Spread from 0% to 100%
    return createEpgChannelAtProgress(progressPercent, {
      channelId: index + 1,
      plexDisplayOrder: index + 1,
    });
  });
};
