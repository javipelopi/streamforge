import { faker } from '@faker-js/faker';

export type Program = {
  id: number;
  xmltvChannelId: number;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  category?: string;
  episodeInfo?: string;
  createdAt: string;
};

export type NewProgram = {
  xmltvChannelId: number;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  category?: string;
  episodeInfo?: string;
};

const TV_CATEGORIES = [
  'News',
  'Sports',
  'Drama',
  'Comedy',
  'Documentary',
  'Kids',
  'Movies',
  'Reality',
  'Entertainment',
];

/**
 * Create a new program with randomized data
 * @param overrides - Partial Program to override defaults
 * @returns Complete Program object with unique values
 */
export const createProgram = (overrides: Partial<Program> = {}): Program => {
  const startTime = faker.date.soon({ days: 7 });
  const durationMinutes = faker.number.int({ min: 30, max: 180 });
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  return {
    id: faker.number.int({ min: 1, max: 1000000 }),
    xmltvChannelId: faker.number.int({ min: 1, max: 10000 }),
    title: faker.lorem.words(3),
    description: faker.datatype.boolean() ? faker.lorem.sentence() : undefined,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    category: faker.helpers.arrayElement(TV_CATEGORIES),
    episodeInfo: faker.datatype.boolean() ? `${faker.number.int({ min: 0, max: 10 })}.${faker.number.int({ min: 0, max: 20 })}.0/1` : undefined,
    createdAt: faker.date.recent().toISOString(),
    ...overrides,
  };
};

/**
 * Create a new program for insertion (without generated fields)
 * @param overrides - Partial NewProgram to override defaults
 * @returns NewProgram object ready for API submission
 */
export const createNewProgram = (overrides: Partial<NewProgram> = {}): NewProgram => {
  const startTime = faker.date.soon({ days: 7 });
  const durationMinutes = faker.number.int({ min: 30, max: 180 });
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  return {
    xmltvChannelId: faker.number.int({ min: 1, max: 10000 }),
    title: faker.lorem.words(3),
    description: faker.datatype.boolean() ? faker.lorem.sentence() : undefined,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    category: faker.helpers.arrayElement(TV_CATEGORIES),
    episodeInfo: faker.datatype.boolean() ? `${faker.number.int({ min: 0, max: 10 })}.${faker.number.int({ min: 0, max: 20 })}.0/1` : undefined,
    ...overrides,
  };
};

/**
 * Create multiple programs with unique data
 * @param count - Number of programs to create
 * @returns Array of Program objects
 */
export const createPrograms = (count: number): Program[] => {
  return Array.from({ length: count }, () => createProgram());
};

/**
 * Create programs for specific channel
 */
export const createProgramsForChannel = (xmltvChannelId: number, count: number): Program[] => {
  return Array.from({ length: count }, () => createProgram({ xmltvChannelId }));
};

/**
 * Create programs for today's schedule (sequential, non-overlapping)
 */
export const createProgramsForToday = (channelId: number, count: number): Program[] => {
  const programs: Program[] = [];
  const now = new Date();
  now.setHours(6, 0, 0, 0); // Start at 6 AM today

  let currentTime = now;

  for (let i = 0; i < count; i++) {
    const durationMinutes = faker.number.int({ min: 30, max: 120 });
    const endTime = new Date(currentTime.getTime() + durationMinutes * 60 * 1000);

    programs.push(
      createProgram({
        xmltvChannelId: channelId,
        startTime: currentTime.toISOString(),
        endTime: endTime.toISOString(),
      })
    );

    currentTime = endTime;
  }

  return programs;
};

/**
 * Create 7-day program guide (sequential, non-overlapping)
 */
export const createProgramsFor7Days = (channelId: number, programsPerDay: number = 24): Program[] => {
  const programs: Program[] = [];
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0); // Start at midnight today

  for (let day = 0; day < 7; day++) {
    const dayStart = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
    let currentTime = dayStart;

    for (let i = 0; i < programsPerDay; i++) {
      const durationMinutes = 60; // 1-hour blocks for consistent 7-day guide
      const endTime = new Date(currentTime.getTime() + durationMinutes * 60 * 1000);

      programs.push(
        createProgram({
          xmltvChannelId: channelId,
          startTime: currentTime.toISOString(),
          endTime: endTime.toISOString(),
        })
      );

      currentTime = endTime;
    }
  }

  return programs;
};
