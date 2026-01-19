import { faker } from '@faker-js/faker';

export type XmltvChannel = {
  id: number;
  sourceId: number;
  channelId: string;
  displayName: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
};

export type NewXmltvChannel = {
  sourceId: number;
  channelId: string;
  displayName: string;
  icon?: string;
};

/**
 * Create a new XMLTV channel with randomized data
 * @param overrides - Partial XmltvChannel to override defaults
 * @returns Complete XmltvChannel object with unique values
 */
export const createXmltvChannel = (overrides: Partial<XmltvChannel> = {}): XmltvChannel => {
  const domain = faker.internet.domainName();
  const slug = faker.helpers.slugify(faker.company.name().toLowerCase());

  return {
    id: faker.number.int({ min: 1, max: 100000 }),
    sourceId: faker.number.int({ min: 1, max: 1000 }),
    channelId: `${slug}.${domain}`,
    displayName: faker.company.name() + ' TV',
    icon: faker.datatype.boolean() ? faker.image.url() : undefined,
    createdAt: faker.date.recent().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
};

/**
 * Create a new XMLTV channel for insertion (without generated fields)
 * @param overrides - Partial NewXmltvChannel to override defaults
 * @returns NewXmltvChannel object ready for API submission
 */
export const createNewXmltvChannel = (overrides: Partial<NewXmltvChannel> = {}): NewXmltvChannel => {
  const domain = faker.internet.domainName();
  const slug = faker.helpers.slugify(faker.company.name().toLowerCase());

  return {
    sourceId: faker.number.int({ min: 1, max: 1000 }),
    channelId: `${slug}.${domain}`,
    displayName: faker.company.name() + ' TV',
    icon: faker.datatype.boolean() ? faker.image.url() : undefined,
    ...overrides,
  };
};

/**
 * Create multiple XMLTV channels with unique data
 * @param count - Number of channels to create
 * @returns Array of XmltvChannel objects
 */
export const createXmltvChannels = (count: number): XmltvChannel[] => {
  return Array.from({ length: count }, () => createXmltvChannel());
};

/**
 * Create XMLTV channel with specific source
 */
export const createChannelForSource = (sourceId: number, overrides: Partial<XmltvChannel> = {}): XmltvChannel => {
  return createXmltvChannel({ sourceId, ...overrides });
};

/**
 * Create multiple channels for specific source
 */
export const createChannelsForSource = (sourceId: number, count: number): XmltvChannel[] => {
  return Array.from({ length: count }, () => createChannelForSource(sourceId));
};
