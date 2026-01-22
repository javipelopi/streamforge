import { faker } from '@faker-js/faker';
import { createProgram, createProgramsForToday } from './program.factory';

/**
 * EPG Grid Data Factory
 *
 * Creates test data for EPG grid components and tests.
 * Follows data-factories.md patterns with faker for randomization.
 */

export type EpgChannelRow = {
  id: number;
  name: string;
  icon?: string;
  isEnabled: boolean;
  plexDisplayOrder: number;
  programs: Array<{
    id: number;
    title: string;
    startTime: string;
    endTime: string;
    category?: string;
    description?: string;
  }>;
};

export type EpgGridData = {
  channels: EpgChannelRow[];
  timeWindow: {
    startTime: Date;
    endTime: Date;
  };
};

export type TimeWindow = {
  startTime: Date;
  endTime: Date;
  durationHours: number;
};

/**
 * Create a single EPG channel row with programs
 * @param overrides - Partial EpgChannelRow to override defaults
 * @returns Complete channel row with programs
 */
export const createEpgChannelRow = (
  overrides: Partial<EpgChannelRow> & { programCount?: number } = {}
): EpgChannelRow => {
  const channelId = overrides.id || faker.number.int({ min: 1, max: 10000 });
  const programCount = overrides.programCount || faker.number.int({ min: 3, max: 10 });

  // Generate sequential non-overlapping programs
  const programs = createProgramsForToday(channelId, programCount).map((p) => ({
    id: p.id,
    title: p.title,
    startTime: p.startTime,
    endTime: p.endTime,
    category: p.category,
    description: p.description,
  }));

  return {
    id: channelId,
    name: faker.helpers.arrayElement([
      'ABC News',
      'NBC Sports',
      'HBO',
      'ESPN',
      'CNN',
      'Fox Sports',
      'Discovery Channel',
      'National Geographic',
      'Comedy Central',
      'MTV',
      'Nickelodeon',
      'Cartoon Network',
      'BBC One',
      'Sky News',
    ]),
    icon: faker.datatype.boolean() ? faker.image.url() : undefined,
    isEnabled: true,
    plexDisplayOrder: faker.number.int({ min: 1, max: 1000 }),
    programs,
    ...overrides,
  };
};

/**
 * Create multiple enabled channels
 * @param count - Number of channels to create
 * @returns Array of enabled channels
 */
export const createEnabledChannels = (count: number): EpgChannelRow[] => {
  return Array.from({ length: count }, (_, index) =>
    createEpgChannelRow({
      isEnabled: true,
      plexDisplayOrder: index + 1,
    })
  );
};

/**
 * Create programs in a specific time range for a channel
 * @param channelId - Channel ID
 * @param startTime - Start of time range
 * @param endTime - End of time range
 * @param count - Number of programs to create
 * @returns Array of sequential programs within time range
 */
export const createProgramsInTimeRange = (
  channelId: number,
  startTime: Date,
  endTime: Date,
  count?: number
): Array<{
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  category?: string;
  description?: string;
}> => {
  const timeRangeDuration = endTime.getTime() - startTime.getTime();
  const programCount = count || Math.floor(timeRangeDuration / (60 * 60 * 1000)); // Default: 1-hour programs

  const programs: Array<{
    id: number;
    title: string;
    startTime: string;
    endTime: string;
    category?: string;
    description?: string;
  }> = [];

  let currentTime = new Date(startTime);

  for (let i = 0; i < programCount; i++) {
    const remainingTime = endTime.getTime() - currentTime.getTime();
    const maxDuration = Math.min(remainingTime, 2 * 60 * 60 * 1000); // Max 2 hours
    const minDuration = Math.min(30 * 60 * 1000, remainingTime); // Min 30 minutes

    if (maxDuration <= 0) break;

    const durationMs = faker.number.int({ min: minDuration, max: maxDuration });
    const programEndTime = new Date(currentTime.getTime() + durationMs);

    const program = createProgram({
      xmltvChannelId: channelId,
      startTime: currentTime.toISOString(),
      endTime: programEndTime.toISOString(),
    });

    programs.push({
      id: program.id,
      title: program.title,
      startTime: program.startTime,
      endTime: program.endTime,
      category: program.category,
      description: program.description,
    });

    currentTime = programEndTime;

    if (currentTime >= endTime) break;
  }

  return programs;
};

/**
 * Create complete EPG grid data structure
 * @param overrides - Configuration for grid data
 * @returns Complete grid data with channels and time window
 */
export const createEpgGridData = (
  overrides: {
    channelCount?: number;
    startTime?: Date;
    endTime?: Date;
    durationHours?: number;
    includeDisabledChannels?: boolean;
  } = {}
): EpgGridData => {
  const channelCount = overrides.channelCount || 20;
  const startTime = overrides.startTime || new Date();
  const durationHours = overrides.durationHours || 3;
  const endTime =
    overrides.endTime || new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

  // Create enabled channels with programs in time range
  const channels = Array.from({ length: channelCount }, (_, index) => {
    const channelId = index + 1;
    const programs = createProgramsInTimeRange(channelId, startTime, endTime);

    return createEpgChannelRow({
      id: channelId,
      isEnabled: true,
      plexDisplayOrder: index + 1,
      programs,
    });
  });

  // Optionally add some disabled channels (for testing filtering)
  if (overrides.includeDisabledChannels) {
    const disabledCount = Math.floor(channelCount * 0.2); // 20% disabled
    const disabledChannels = Array.from({ length: disabledCount }, (_, index) =>
      createEpgChannelRow({
        id: channelCount + index + 1,
        isEnabled: false,
        programs: createProgramsInTimeRange(
          channelCount + index + 1,
          startTime,
          endTime
        ),
      })
    );

    channels.push(...disabledChannels);
  }

  return {
    channels,
    timeWindow: {
      startTime,
      endTime,
    },
  };
};
