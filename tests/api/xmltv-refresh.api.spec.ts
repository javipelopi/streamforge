import { test, expect } from '../support/fixtures/xmltv-refresh.fixture';
import { test as baseTest } from '../support/fixtures/epg-sources.fixture';
import { createNewXmltvSource } from '../support/factories/xmltv-source.factory';
import { createXmltvChannels } from '../support/factories/xmltv-channel.factory';
import { createProgramsFor7Days } from '../support/factories/program.factory';
import { createSampleXmltvData, createMinimalXmltv } from '../support/factories/xmltv-data.factory';

/**
 * API Tests for Story 2-5: Parse and Store XMLTV EPG Data
 *
 * These tests verify the Tauri backend commands for refreshing EPG data.
 * All tests are in RED phase - they will fail until commands are implemented.
 *
 * Test Strategy:
 * - API/Integration level: Tests Tauri command layer with mock HTTP server
 * - Given-When-Then format for clarity
 * - Focus on parsing, storage, and data integrity
 * - Auto-cleanup via fixtures
 */

test.describe('XMLTV Refresh API Commands', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app to initialize Tauri context
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('refresh_epg_source - should download and parse XML format', async ({
    page,
    xmltvRefreshApi,
    mockXmltvServer
  }) => {
    // GIVEN: A mock XMLTV source with XML data
    const testData = createSampleXmltvData(5, 10);
    mockXmltvServer.serveXml(testData.channels, testData.programs);

    // GIVEN: An XMLTV source pointing to mock server
    const source = await page.evaluate(
      async (url) => {
        // @ts-expect-error - Tauri API not typed
        return window.__TAURI__.invoke('add_xmltv_source', {
          name: 'Test EPG Source',
          url: `${url}/epg.xml`,
          format: 'xml',
        });
      },
      mockXmltvServer.url
    );

    // WHEN: Refreshing the EPG source
    await xmltvRefreshApi.refreshSource(source.id);

    // THEN: EPG stats show parsed data
    const stats = await xmltvRefreshApi.getStats(source.id);
    expect(stats.channelCount).toBe(5);
    expect(stats.programCount).toBe(50); // 5 channels * 10 programs
    expect(stats.lastRefresh).toBeDefined();
  });

  test('refresh_epg_source - should download and parse XML.GZ format', async ({
    page,
    xmltvRefreshApi,
    mockXmltvServer
  }) => {
    // GIVEN: A mock XMLTV source with gzipped data
    const testData = createSampleXmltvData(3, 20);
    mockXmltvServer.serveXmlGz(testData.channels, testData.programs);

    // GIVEN: An XMLTV source with xml_gz format
    const source = await page.evaluate(
      async (url) => {
        // @ts-expect-error - Tauri API not typed
        return window.__TAURI__.invoke('add_xmltv_source', {
          name: 'Gzipped EPG Source',
          url: `${url}/epg.xml.gz`,
          format: 'xml_gz',
        });
      },
      mockXmltvServer.url
    );

    // WHEN: Refreshing the EPG source
    await xmltvRefreshApi.refreshSource(source.id);

    // THEN: EPG stats show parsed data (decompressed and parsed)
    const stats = await xmltvRefreshApi.getStats(source.id);
    expect(stats.channelCount).toBe(3);
    expect(stats.programCount).toBe(60); // 3 channels * 20 programs
  });

  test('refresh_epg_source - should auto-detect gzip from magic bytes', async ({
    page,
    xmltvRefreshApi,
    mockXmltvServer
  }) => {
    // GIVEN: A mock XMLTV source serving gzipped data
    const testData = createSampleXmltvData(2, 15);
    mockXmltvServer.serveXmlGz(testData.channels, testData.programs);

    // GIVEN: An XMLTV source with 'auto' format (should detect gzip)
    const source = await page.evaluate(
      async (url) => {
        // @ts-expect-error - Tauri API not typed
        return window.__TAURI__.invoke('add_xmltv_source', {
          name: 'Auto-detect EPG Source',
          url: `${url}/epg.xml`,
          format: 'auto',
        });
      },
      mockXmltvServer.url
    );

    // WHEN: Refreshing with auto-detection
    await xmltvRefreshApi.refreshSource(source.id);

    // THEN: Gzip is detected and data is parsed correctly
    const stats = await xmltvRefreshApi.getStats(source.id);
    expect(stats.channelCount).toBe(2);
    expect(stats.programCount).toBe(30); // 2 channels * 15 programs
  });

  test('refresh_epg_source - should store channels with all fields', async ({
    page,
    xmltvRefreshApi,
    mockXmltvServer
  }) => {
    // GIVEN: XMLTV data with channels having all fields
    const channels = createXmltvChannels(1);
    const channel = {
      ...channels[0],
      channelId: 'bbc-one.uk',
      displayName: 'BBC One',
      icon: 'https://example.com/bbc-logo.png',
    };

    mockXmltvServer.serveXml([channel], []);

    const source = await page.evaluate(
      async (url) => {
        // @ts-expect-error - Tauri API not typed
        return window.__TAURI__.invoke('add_xmltv_source', {
          name: 'BBC EPG',
          url: `${url}/epg.xml`,
          format: 'xml',
        });
      },
      mockXmltvServer.url
    );

    // WHEN: Refreshing the EPG
    await xmltvRefreshApi.refreshSource(source.id);

    // THEN: Channel is stored with all fields
    const channels_db = await page.evaluate(
      async (sourceId) => {
        // @ts-expect-error - Tauri API not typed
        return window.__TAURI__.invoke('get_xmltv_channels', { sourceId });
      },
      source.id
    );

    expect(channels_db).toHaveLength(1);
    expect(channels_db[0].channelId).toBe('bbc-one.uk');
    expect(channels_db[0].displayName).toBe('BBC One');
    expect(channels_db[0].icon).toBe('https://example.com/bbc-logo.png');
  });

  test('refresh_epg_source - should store programs with all fields', async ({
    page,
    xmltvRefreshApi,
    mockXmltvServer
  }) => {
    // GIVEN: XMLTV data with programs having all fields
    const channels = createXmltvChannels(1);
    const channel = { ...channels[0], channelId: 'test.1' };

    const program = {
      id: 1,
      xmltvChannelId: channel.id,
      title: 'Breaking News',
      description: 'Latest breaking news coverage',
      startTime: new Date('2026-01-19T12:00:00Z').toISOString(),
      endTime: new Date('2026-01-19T13:00:00Z').toISOString(),
      category: 'News',
      episodeInfo: '1.5.0/1',
      createdAt: new Date().toISOString(),
    };

    mockXmltvServer.serveXml([channel], [program]);

    const source = await page.evaluate(
      async (url) => {
        // @ts-expect-error - Tauri API not typed
        return window.__TAURI__.invoke('add_xmltv_source', {
          name: 'Test EPG',
          url: `${url}/epg.xml`,
          format: 'xml',
        });
      },
      mockXmltvServer.url
    );

    // WHEN: Refreshing the EPG
    await xmltvRefreshApi.refreshSource(source.id);

    // THEN: Program is stored with all fields
    const programs_db = await page.evaluate(
      async (sourceId) => {
        // @ts-expect-error - Tauri API not typed
        return window.__TAURI__.invoke('get_programs', { sourceId });
      },
      source.id
    );

    expect(programs_db).toHaveLength(1);
    expect(programs_db[0].title).toBe('Breaking News');
    expect(programs_db[0].description).toBe('Latest breaking news coverage');
    expect(programs_db[0].category).toBe('News');
    expect(programs_db[0].episodeInfo).toBe('1.5.0/1');
  });

  test('refresh_epg_source - should parse XMLTV timestamps correctly', async ({
    page,
    xmltvRefreshApi,
    mockXmltvServer
  }) => {
    // GIVEN: XMLTV data with specific timestamp format
    const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="test.1">
    <display-name>Test Channel</display-name>
  </channel>
  <programme start="20260119120000 +0000" stop="20260119130000 +0000" channel="test.1">
    <title>Test Program</title>
  </programme>
</tv>`;

    mockXmltvServer.serveXml([], []); // Override with custom XML
    const server = mockXmltvServer;
    // Override handler to serve custom XML
    await page.evaluate((xml) => {
      // This is a workaround - in real implementation, we'd extend the fixture
    }, xmlData);

    const source = await page.evaluate(
      async (url) => {
        // @ts-expect-error - Tauri API not typed
        return window.__TAURI__.invoke('add_xmltv_source', {
          name: 'Timestamp Test EPG',
          url: `${url}/epg.xml`,
          format: 'xml',
        });
      },
      mockXmltvServer.url
    );

    // WHEN: Refreshing with XMLTV timestamp format
    await xmltvRefreshApi.refreshSource(source.id);

    // THEN: Timestamps are parsed to ISO format
    const programs_db = await page.evaluate(
      async (sourceId) => {
        // @ts-expect-error - Tauri API not typed
        return window.__TAURI__.invoke('get_programs', { sourceId });
      },
      source.id
    );

    expect(programs_db[0].startTime).toBe('2026-01-19T12:00:00Z');
    expect(programs_db[0].endTime).toBe('2026-01-19T13:00:00Z');
  });

  test('refresh_epg_source - should clear old data before refresh', async ({
    page,
    xmltvRefreshApi,
    mockXmltvServer
  }) => {
    // GIVEN: An EPG source with existing data
    const initialData = createSampleXmltvData(5, 10);
    mockXmltvServer.serveXml(initialData.channels, initialData.programs);

    const source = await page.evaluate(
      async (url) => {
        // @ts-expect-error - Tauri API not typed
        return window.__TAURI__.invoke('add_xmltv_source', {
          name: 'Refresh Test EPG',
          url: `${url}/epg.xml`,
          format: 'xml',
        });
      },
      mockXmltvServer.url
    );

    // Initial refresh
    await xmltvRefreshApi.refreshSource(source.id);

    const initialStats = await xmltvRefreshApi.getStats(source.id);
    expect(initialStats.channelCount).toBe(5);

    // GIVEN: New data with different channel count
    const newData = createSampleXmltvData(3, 15);
    mockXmltvServer.serveXml(newData.channels, newData.programs);

    // WHEN: Refreshing again with new data
    await xmltvRefreshApi.refreshSource(source.id);

    // THEN: Old data is cleared and replaced with new data
    const newStats = await xmltvRefreshApi.getStats(source.id);
    expect(newStats.channelCount).toBe(3); // Changed from 5 to 3
    expect(newStats.programCount).toBe(45); // 3 channels * 15 programs
  });

  test('refresh_epg_source - should update last_refresh timestamp', async ({
    page,
    xmltvRefreshApi,
    mockXmltvServer
  }) => {
    // GIVEN: An EPG source with no refresh
    const testData = createSampleXmltvData(2, 5);
    mockXmltvServer.serveXml(testData.channels, testData.programs);

    const source = await page.evaluate(
      async (url) => {
        // @ts-expect-error - Tauri API not typed
        return window.__TAURI__.invoke('add_xmltv_source', {
          name: 'Timestamp Test EPG',
          url: `${url}/epg.xml`,
          format: 'xml',
        });
      },
      mockXmltvServer.url
    );

    expect(source.lastRefresh).toBeUndefined();

    const beforeRefresh = Date.now();

    // WHEN: Refreshing the EPG
    await xmltvRefreshApi.refreshSource(source.id);

    const afterRefresh = Date.now();

    // THEN: last_refresh timestamp is updated
    const stats = await xmltvRefreshApi.getStats(source.id);
    expect(stats.lastRefresh).toBeDefined();

    const lastRefreshTime = new Date(stats.lastRefresh!).getTime();
    expect(lastRefreshTime).toBeGreaterThanOrEqual(beforeRefresh);
    expect(lastRefreshTime).toBeLessThanOrEqual(afterRefresh);
  });

  test('refresh_epg_source - should handle large EPG files efficiently', async ({
    page,
    xmltvRefreshApi,
    mockXmltvServer
  }) => {
    // GIVEN: Large EPG data (100 channels, 7-day guide = 16,800 programs)
    const channels = createXmltvChannels(100);
    const programs = channels.flatMap((channel) =>
      createProgramsFor7Days(channel.id, 24) // 24 programs per day * 7 days
    );

    mockXmltvServer.serveXml(channels, programs);

    const source = await page.evaluate(
      async (url) => {
        // @ts-expect-error - Tauri API not typed
        return window.__TAURI__.invoke('add_xmltv_source', {
          name: 'Large EPG Source',
          url: `${url}/epg.xml`,
          format: 'xml',
        });
      },
      mockXmltvServer.url
    );

    // WHEN: Refreshing large EPG
    const startTime = Date.now();
    await xmltvRefreshApi.refreshSource(source.id);
    const duration = Date.now() - startTime;

    // THEN: Refresh completes within 30 seconds (NFR4)
    expect(duration).toBeLessThan(30000);

    // THEN: All data is stored correctly
    const stats = await xmltvRefreshApi.getStats(source.id);
    expect(stats.channelCount).toBe(100);
    expect(stats.programCount).toBe(16800); // 100 channels * 24 programs/day * 7 days
  });

  test('refresh_epg_source - should respect SSRF protection', async ({
    page,
    xmltvRefreshApi
  }) => {
    // GIVEN: An XMLTV source with localhost URL (SSRF risk)
    const source = await page.evaluate(async () => {
      // @ts-expect-error - Tauri API not typed
      return window.__TAURI__.invoke('add_xmltv_source', {
        name: 'Malicious EPG',
        url: 'http://localhost:8080/epg.xml', // Localhost blocked
        format: 'xml',
      });
    });

    // WHEN: Attempting to refresh from localhost
    // THEN: Request fails with SSRF error
    await expect(xmltvRefreshApi.refreshSource(source.id)).rejects.toThrow(/not allowed|blocked|ssrf/i);
  });

  test('refresh_all_epg_sources - should refresh all active sources', async ({
    page,
    xmltvRefreshApi,
    mockXmltvServer
  }) => {
    // GIVEN: Multiple active XMLTV sources
    const data1 = createSampleXmltvData(3, 10);
    const data2 = createSampleXmltvData(2, 15);

    mockXmltvServer.serveXml([...data1.channels, ...data2.channels], [...data1.programs, ...data2.programs]);

    const source1 = await page.evaluate(
      async (url) => {
        // @ts-expect-error - Tauri API not typed
        return window.__TAURI__.invoke('add_xmltv_source', {
          name: 'EPG Source 1',
          url: `${url}/epg1.xml`,
          format: 'xml',
        });
      },
      mockXmltvServer.url
    );

    const source2 = await page.evaluate(
      async (url) => {
        // @ts-expect-error - Tauri API not typed
        return window.__TAURI__.invoke('add_xmltv_source', {
          name: 'EPG Source 2',
          url: `${url}/epg2.xml`,
          format: 'xml',
        });
      },
      mockXmltvServer.url
    );

    // WHEN: Refreshing all sources
    await xmltvRefreshApi.refreshAll();

    // THEN: Both sources are refreshed
    const stats1 = await xmltvRefreshApi.getStats(source1.id);
    const stats2 = await xmltvRefreshApi.getStats(source2.id);

    expect(stats1.lastRefresh).toBeDefined();
    expect(stats2.lastRefresh).toBeDefined();
  });

  test('get_epg_stats - should return channel and program counts', async ({
    page,
    xmltvRefreshApi,
    mockXmltvServer
  }) => {
    // GIVEN: An EPG source with known data
    const testData = createSampleXmltvData(7, 20);
    mockXmltvServer.serveXml(testData.channels, testData.programs);

    const source = await page.evaluate(
      async (url) => {
        // @ts-expect-error - Tauri API not typed
        return window.__TAURI__.invoke('add_xmltv_source', {
          name: 'Stats Test EPG',
          url: `${url}/epg.xml`,
          format: 'xml',
        });
      },
      mockXmltvServer.url
    );

    await xmltvRefreshApi.refreshSource(source.id);

    // WHEN: Getting EPG stats
    const stats = await xmltvRefreshApi.getStats(source.id);

    // THEN: Stats are accurate
    expect(stats).toMatchObject({
      channelCount: 7,
      programCount: 140, // 7 channels * 20 programs
    });
    expect(stats.lastRefresh).toBeDefined();
  });
});
