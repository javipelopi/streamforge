import { faker } from '@faker-js/faker';

export type XmltvFormat = 'xml' | 'xml_gz' | 'auto';

export type XmltvSource = {
  id: number;
  name: string;
  url: string;
  format: XmltvFormat;
  refreshHour: number;
  lastRefresh?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NewXmltvSource = {
  name: string;
  url: string;
  format: XmltvFormat;
};

/**
 * Create a new XMLTV source with randomized data
 * @param overrides - Partial XmltvSource to override defaults
 * @returns Complete XmltvSource object with unique values
 */
export const createXmltvSource = (overrides: Partial<XmltvSource> = {}): XmltvSource => {
  const domain = faker.internet.domainName();
  const extension = overrides.format === 'xml_gz' ? '.xml.gz' : '.xml';

  return {
    id: faker.number.int({ min: 1, max: 100000 }),
    name: faker.company.name() + ' EPG',
    url: `https://${domain}/epg${extension}`,
    format: 'auto',
    refreshHour: faker.number.int({ min: 0, max: 23 }),
    lastRefresh: undefined,
    isActive: true,
    createdAt: faker.date.recent().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
};

/**
 * Create a new XMLTV source for insertion (without generated fields)
 * @param overrides - Partial NewXmltvSource to override defaults
 * @returns NewXmltvSource object ready for API submission
 */
export const createNewXmltvSource = (overrides: Partial<NewXmltvSource> = {}): NewXmltvSource => {
  const domain = faker.internet.domainName();
  const format = overrides.format || 'auto';
  const extension = format === 'xml_gz' ? '.xml.gz' : '.xml';

  return {
    name: faker.company.name() + ' EPG',
    url: `https://${domain}/epg${extension}`,
    format,
    ...overrides,
  };
};

/**
 * Create multiple XMLTV sources with unique data
 * @param count - Number of sources to create
 * @returns Array of XmltvSource objects
 */
export const createXmltvSources = (count: number): XmltvSource[] => {
  return Array.from({ length: count }, () => createXmltvSource());
};

/**
 * Create XMLTV source with specific format
 */
export const createXmlSource = (overrides: Partial<XmltvSource> = {}): XmltvSource => {
  return createXmltvSource({ format: 'xml', ...overrides });
};

export const createXmlGzSource = (overrides: Partial<XmltvSource> = {}): XmltvSource => {
  return createXmltvSource({ format: 'xml_gz', ...overrides });
};

/**
 * Create inactive XMLTV source for testing enable/disable
 */
export const createInactiveXmltvSource = (overrides: Partial<XmltvSource> = {}): XmltvSource => {
  return createXmltvSource({ isActive: false, ...overrides });
};
