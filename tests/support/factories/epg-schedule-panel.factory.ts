import { faker } from '@faker-js/faker';

/**
 * EPG Schedule Panel Factory
 *
 * Creates test data for the EPG schedule panel (Story 5.6).
 * Generates programs for a selected channel with time-based status (NOW, PAST, FUTURE).
 */

export type EpgProgramStatus = 'NOW' | 'PAST' | 'FUTURE';

export type EpgScheduleProgram = {
  id: number;
  title: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  category?: string;
  description?: string;
  episodeInfo?: string;
  status: EpgProgramStatus;
};

export type EpgScheduleData = {
  channelId: number;
  channelName: string;
  channelIcon?: string;
  date: string; // Format: "TUE 21 Jan"
  programs: EpgScheduleProgram[];
  currentProgramId?: number;
  timestamp: Date;
};

/**
 * Determine program status relative to current time
 * @param startTime - Program start time (ISO 8601)
 * @param endTime - Program end time (ISO 8601)
 * @param currentTime - Current time (defaults to now)
 * @returns Program status: NOW, PAST, or FUTURE
 */
export const getProgramStatus = (
  startTime: string,
  endTime: string,
  currentTime: Date = new Date()
): EpgProgramStatus => {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (currentTime >= start && currentTime < end) return 'NOW';
  if (currentTime >= end) return 'PAST';
  return 'FUTURE';
};

/**
 * Format time for display (e.g., "8:00 AM")
 * @param isoString - ISO 8601 time string
 * @returns Formatted time string
 */
export const formatTimeDisplay = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Format date for header (e.g., "TUE 21 Jan")
 * @param date - Date object
 * @returns Formatted date header string
 */
export const formatDateHeader = (date: Date = new Date()): string => {
  const day = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dayNum = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  return `${day} ${dayNum} ${month}`;
};

/**
 * Create a single EPG program
 * @param overrides - Partial program data to override defaults
 * @returns Program with status
 */
export const createEpgProgram = (
  overrides: Partial<EpgScheduleProgram> = {}
): EpgScheduleProgram => {
  const now = new Date();
  const startTime =
    overrides.startTime ||
    new Date(now.getTime() + faker.number.int({ min: -120, max: 120 }) * 60 * 1000).toISOString();
  const endTime =
    overrides.endTime ||
    new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString(); // 1 hour duration

  const status = overrides.status || getProgramStatus(startTime, endTime);

  return {
    id: faker.number.int({ min: 1, max: 100000 }),
    title: faker.helpers.arrayElement([
      'Morning News',
      'Breakfast Show',
      'Talk Time',
      'Movie: Action Hero',
      'Sports Roundup',
      'Documentary Special',
      'Evening News',
      'Prime Time Drama',
      'Late Night Show',
      'Overnight Movies',
    ]),
    startTime,
    endTime,
    category: faker.helpers.arrayElement([
      'News',
      'Sports',
      'Movies',
      'Entertainment',
      'Documentary',
      'Talk Show',
    ]),
    description: faker.lorem.sentence(),
    episodeInfo: faker.datatype.boolean()
      ? `S${faker.number.int({ min: 1, max: 10 })}E${faker.number.int({ min: 1, max: 24 })}`
      : undefined,
    status,
    ...overrides,
  };
};

/**
 * Create a program that's currently airing (NOW)
 * @param overrides - Additional overrides
 * @returns Program with NOW status
 */
export const createCurrentProgram = (
  overrides: Partial<EpgScheduleProgram> = {}
): EpgScheduleProgram => {
  const now = new Date();
  const startTime = new Date(now.getTime() - 30 * 60 * 1000).toISOString(); // Started 30 min ago
  const endTime = new Date(now.getTime() + 30 * 60 * 1000).toISOString(); // Ends 30 min from now

  return createEpgProgram({
    startTime,
    endTime,
    status: 'NOW',
    title: overrides.title || 'Current Program',
    ...overrides,
  });
};

/**
 * Create a past program
 * @param minutesAgo - Minutes before now when program started
 * @param duration - Program duration in minutes
 * @param overrides - Additional overrides
 * @returns Program with PAST status
 */
export const createPastProgram = (
  minutesAgo: number = 120,
  duration: number = 60,
  overrides: Partial<EpgScheduleProgram> = {}
): EpgScheduleProgram => {
  const now = new Date();
  const startTime = new Date(now.getTime() - minutesAgo * 60 * 1000).toISOString();
  const endTime = new Date(new Date(startTime).getTime() + duration * 60 * 1000).toISOString();

  return createEpgProgram({
    startTime,
    endTime,
    status: 'PAST',
    ...overrides,
  });
};

/**
 * Create a future program
 * @param minutesFromNow - Minutes from now when program starts
 * @param duration - Program duration in minutes
 * @param overrides - Additional overrides
 * @returns Program with FUTURE status
 */
export const createFutureProgram = (
  minutesFromNow: number = 60,
  duration: number = 60,
  overrides: Partial<EpgScheduleProgram> = {}
): EpgScheduleProgram => {
  const now = new Date();
  const startTime = new Date(now.getTime() + minutesFromNow * 60 * 1000).toISOString();
  const endTime = new Date(new Date(startTime).getTime() + duration * 60 * 1000).toISOString();

  return createEpgProgram({
    startTime,
    endTime,
    status: 'FUTURE',
    ...overrides,
  });
};

/**
 * Create a full day schedule starting from 6 AM
 * @param channelId - Channel ID for the schedule
 * @param overrides - Additional configuration
 * @returns Complete schedule data for one day
 */
export const createDaySchedule = (
  channelId: number,
  overrides: {
    channelName?: string;
    channelIcon?: string;
    programCount?: number;
    includeCurrentProgram?: boolean;
  } = {}
): EpgScheduleData => {
  const now = new Date();
  const today6AM = new Date(now);
  today6AM.setHours(6, 0, 0, 0);

  const programCount = overrides.programCount || 24; // Default 24 programs (1 per hour)
  const programs: EpgScheduleProgram[] = [];
  let currentProgramId: number | undefined;

  // Generate programs for the day
  for (let i = 0; i < programCount; i++) {
    const startTime = new Date(today6AM.getTime() + i * 60 * 60 * 1000); // Hourly programs
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

    const program = createEpgProgram({
      id: channelId * 1000 + i + 1, // Unique ID per channel
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      title: `Program ${i + 1}`,
    });

    programs.push(program);

    // Track current program
    if (program.status === 'NOW') {
      currentProgramId = program.id;
    }
  }

  return {
    channelId,
    channelName: overrides.channelName || `Test Channel ${channelId}`,
    channelIcon: overrides.channelIcon,
    date: formatDateHeader(now),
    programs,
    currentProgramId,
    timestamp: new Date(),
  };
};

/**
 * Create schedule with specific time distribution
 * @param channelId - Channel ID
 * @param config - Configuration for time distribution
 * @returns Schedule with specified PAST/NOW/FUTURE distribution
 */
export const createScheduleWithTimeDistribution = (
  channelId: number,
  config: {
    pastCount: number;
    futureCount: number;
    includeNowProgram: boolean;
    channelName?: string;
  }
): EpgScheduleData => {
  const programs: EpgScheduleProgram[] = [];
  let currentProgramId: number | undefined;
  let programId = channelId * 1000 + 1;

  // Create past programs (in reverse chronological order)
  for (let i = 0; i < config.pastCount; i++) {
    const minutesAgo = (config.pastCount - i) * 60; // 60 minutes per program
    programs.push(
      createPastProgram(minutesAgo, 60, {
        id: programId++,
        title: `Past Program ${i + 1}`,
      })
    );
  }

  // Create current program if requested
  if (config.includeNowProgram) {
    const currentProgram = createCurrentProgram({
      id: programId++,
      title: 'Current Program NOW',
    });
    programs.push(currentProgram);
    currentProgramId = currentProgram.id;
  }

  // Create future programs
  for (let i = 0; i < config.futureCount; i++) {
    const minutesFromNow = (i + 1) * 60; // 60 minutes per program
    programs.push(
      createFutureProgram(minutesFromNow, 60, {
        id: programId++,
        title: `Future Program ${i + 1}`,
      })
    );
  }

  return {
    channelId,
    channelName: config.channelName || `Test Channel ${channelId}`,
    date: formatDateHeader(),
    programs,
    currentProgramId,
    timestamp: new Date(),
  };
};

/**
 * Create schedule with all programs in the past (no NOW program)
 * @param channelId - Channel ID
 * @param programCount - Number of past programs
 * @returns Schedule with all past programs
 */
export const createAllPastSchedule = (
  channelId: number,
  programCount: number = 10
): EpgScheduleData => {
  return createScheduleWithTimeDistribution(channelId, {
    pastCount: programCount,
    futureCount: 0,
    includeNowProgram: false,
    channelName: `All Past Channel ${channelId}`,
  });
};

/**
 * Create empty schedule (no programs)
 * @param channelId - Channel ID
 * @param channelName - Channel name
 * @returns Empty schedule data
 */
export const createEmptySchedule = (
  channelId: number,
  channelName: string = `Empty Channel ${channelId}`
): EpgScheduleData => {
  return {
    channelId,
    channelName,
    date: formatDateHeader(),
    programs: [],
    currentProgramId: undefined,
    timestamp: new Date(),
  };
};
