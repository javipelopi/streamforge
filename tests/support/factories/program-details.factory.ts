import { faker } from '@faker-js/faker';
import { createProgram, type Program } from './program.factory';
import { createEpgChannelRow, type EpgChannelRow } from './epg-grid-data.factory';

/**
 * Program Details Factory
 *
 * Creates test data for program details panel (Story 5.3).
 * Follows data-factories.md patterns with faker for randomization.
 */

export type ProgramDetails = {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  category?: string;
  episodeInfo?: string;
  channelId: number;
  channelName: string;
  channelIcon?: string;
  streamInfo?: ChannelStreamInfo;
};

export type ChannelStreamInfo = {
  streamName: string;
  qualityTiers: string[];
  isPrimary: boolean;
  matchConfidence: number;
};

/**
 * Create channel stream info
 * @param overrides - Partial ChannelStreamInfo to override defaults
 * @returns Complete stream info
 */
export const createChannelStreamInfo = (
  overrides: Partial<ChannelStreamInfo> = {}
): ChannelStreamInfo => {
  const qualities = [
    ['HD', 'SD'],
    ['4K', 'HD', 'SD'],
    ['HD'],
    ['SD'],
    ['4K', 'HD'],
  ];

  return {
    streamName: faker.company.name() + ' ' + faker.helpers.arrayElement(['TV', 'Network', 'Channel']),
    qualityTiers: faker.helpers.arrayElement(qualities),
    isPrimary: true,
    matchConfidence: faker.number.float({ min: 0.7, max: 1.0, fractionDigits: 2 }),
    ...overrides,
  };
};

/**
 * Create program details with channel info
 * @param overrides - Partial ProgramDetails to override defaults
 * @returns Complete program details
 */
export const createProgramDetails = (
  overrides: Partial<ProgramDetails> = {}
): ProgramDetails => {
  const program = createProgram();
  const channel = createEpgChannelRow({ id: program.xmltvChannelId });

  return {
    id: program.id,
    title: program.title,
    startTime: program.startTime,
    endTime: program.endTime,
    description: program.description,
    category: program.category,
    episodeInfo: program.episodeInfo,
    channelId: channel.id,
    channelName: channel.name,
    channelIcon: channel.icon,
    streamInfo: faker.datatype.boolean() ? createChannelStreamInfo() : undefined,
    ...overrides,
  };
};

/**
 * Create program details with specific attributes for testing
 */
export const createProgramDetailsWithEpisode = (): ProgramDetails => {
  return createProgramDetails({
    title: faker.helpers.arrayElement([
      'Breaking Bad',
      'Game of Thrones',
      'The Office',
      'Friends',
      'Stranger Things',
    ]),
    episodeInfo: `${faker.number.int({ min: 0, max: 5 })}.${faker.number.int({ min: 0, max: 20 })}.0/1`, // XMLTV format
    category: faker.helpers.arrayElement(['Drama', 'Comedy', 'Sci-Fi']),
    description: faker.lorem.sentences(2),
  });
};

/**
 * Create program details without optional fields (edge case)
 */
export const createMinimalProgramDetails = (): ProgramDetails => {
  const program = createProgram({ description: undefined, category: undefined, episodeInfo: undefined });
  const channel = createEpgChannelRow({ id: program.xmltvChannelId, icon: undefined });

  return {
    id: program.id,
    title: program.title,
    startTime: program.startTime,
    endTime: program.endTime,
    channelId: channel.id,
    channelName: channel.name,
    // All optional fields omitted
  };
};

/**
 * Create program details with multiple quality streams
 */
export const createProgramDetailsWithMultipleQualities = (): ProgramDetails => {
  return createProgramDetails({
    streamInfo: createChannelStreamInfo({
      qualityTiers: ['4K', 'HD', 'SD'],
    }),
  });
};

/**
 * Create program details without stream mapping
 */
export const createProgramDetailsWithoutStream = (): ProgramDetails => {
  return createProgramDetails({
    streamInfo: undefined,
  });
};

/**
 * Create currently airing program (useful for "Now" tests)
 */
export const createCurrentlyAiringProgram = (): ProgramDetails => {
  const now = new Date();
  const startTime = new Date(now.getTime() - 30 * 60 * 1000); // Started 30 min ago
  const endTime = new Date(now.getTime() + 30 * 60 * 1000); // Ends in 30 min

  return createProgramDetails({
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  });
};

/**
 * Create multiple program details
 * @param count - Number of program details to create
 * @returns Array of program details
 */
export const createMultipleProgramDetails = (count: number): ProgramDetails[] => {
  return Array.from({ length: count }, () => createProgramDetails());
};

/**
 * Create program details data for test fixture
 */
export type ProgramDetailsTestData = {
  programs: ProgramDetails[];
  channels: EpgChannelRow[];
};

export const createProgramDetailsTestData = (
  overrides: {
    programCount?: number;
    channelCount?: number;
    includeEdgeCases?: boolean;
  } = {}
): ProgramDetailsTestData => {
  const programCount = overrides.programCount || 10;
  const channelCount = overrides.channelCount || 5;

  // Create channels first
  const channels = Array.from({ length: channelCount }, (_, index) =>
    createEpgChannelRow({ id: index + 1, isEnabled: true })
  );

  // Create programs associated with these channels
  const programs = Array.from({ length: programCount }, (_, index) => {
    const channel = channels[index % channels.length];
    return createProgramDetails({
      channelId: channel.id,
      channelName: channel.name,
      channelIcon: channel.icon,
    });
  });

  // Add edge cases if requested
  if (overrides.includeEdgeCases) {
    programs.push(
      createMinimalProgramDetails(),
      createProgramDetailsWithEpisode(),
      createProgramDetailsWithoutStream(),
      createProgramDetailsWithMultipleQualities()
    );
  }

  return {
    programs,
    channels,
  };
};
