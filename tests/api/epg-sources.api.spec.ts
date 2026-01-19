import { test, expect } from '../support/fixtures/epg-sources.fixture';
import { createNewXmltvSource } from '../support/factories/xmltv-source.factory';

/**
 * API Tests for Story 2-4: XMLTV Source Management Tauri Commands
 *
 * These tests verify the Tauri backend commands for managing XMLTV sources.
 * All tests are in RED phase - they will fail until commands are implemented.
 *
 * Test Strategy:
 * - API level: Tests Tauri command layer directly
 * - Given-When-Then format for clarity
 * - Focus on business logic and validation
 * - Auto-cleanup via fixture
 */

test.describe('XMLTV Source API Commands', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app to initialize Tauri context
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('POST add_xmltv_source - should create new XMLTV source', async ({ xmltvSourcesApi }) => {
    // GIVEN: Valid XMLTV source data
    const newSource = createNewXmltvSource({
      name: 'Test EPG API',
      url: 'https://api-test.example.com/epg.xml',
      format: 'xml',
    });

    // WHEN: Adding source via API
    const result = await xmltvSourcesApi.add(newSource);

    // THEN: Source is created with generated ID
    expect(result.id).toBeGreaterThan(0);

    // THEN: Source data matches input
    expect(result.name).toBe(newSource.name);
    expect(result.url).toBe(newSource.url);
    expect(result.format).toBe(newSource.format);

    // THEN: Source has default values
    expect(result.refreshHour).toBe(4);
    expect(result.isActive).toBe(true);
    expect(result.lastRefresh).toBeUndefined();

    // THEN: Source has timestamps
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });

  test('POST add_xmltv_source - should reject invalid URL format', async ({ xmltvSourcesApi }) => {
    // GIVEN: XMLTV source with invalid URL
    const invalidSource = createNewXmltvSource({
      name: 'Invalid URL Source',
      url: 'not-a-valid-url', // Invalid URL format
      format: 'xml',
    });

    // WHEN: Attempting to add source with invalid URL
    // THEN: Request fails with validation error
    await expect(xmltvSourcesApi.add(invalidSource)).rejects.toThrow(/invalid url/i);
  });

  test('POST add_xmltv_source - should reject non-http(s) URL schemes', async ({ xmltvSourcesApi }) => {
    // GIVEN: XMLTV source with non-HTTP scheme
    const ftpSource = createNewXmltvSource({
      name: 'FTP Source',
      url: 'ftp://example.com/epg.xml', // FTP not allowed
      format: 'xml',
    });

    // WHEN: Attempting to add source with FTP URL
    // THEN: Request fails with validation error
    await expect(xmltvSourcesApi.add(ftpSource)).rejects.toThrow(/http/i);
  });

  test('POST add_xmltv_source - should reject duplicate URL', async ({ xmltvSourcesApi }) => {
    // GIVEN: An existing XMLTV source
    const existingSource = createNewXmltvSource({
      name: 'Original Source',
      url: 'https://unique.example.com/epg.xml',
      format: 'xml',
    });

    await xmltvSourcesApi.add(existingSource);

    // GIVEN: Another source with the same URL
    const duplicateSource = createNewXmltvSource({
      name: 'Duplicate Source',
      url: existingSource.url, // Same URL
      format: 'xml_gz', // Different format but same URL
    });

    // WHEN: Attempting to add duplicate URL
    // THEN: Request fails with duplicate error
    await expect(xmltvSourcesApi.add(duplicateSource)).rejects.toThrow(/already exists|duplicate/i);
  });

  test('GET get_xmltv_sources - should list all XMLTV sources', async ({ xmltvSourcesApi }) => {
    // GIVEN: Multiple XMLTV sources exist
    const source1 = await xmltvSourcesApi.add(
      createNewXmltvSource({
        name: 'EPG Source 1',
        url: 'https://test1.example.com/epg.xml',
        format: 'xml',
      })
    );

    const source2 = await xmltvSourcesApi.add(
      createNewXmltvSource({
        name: 'EPG Source 2',
        url: 'https://test2.example.com/epg.xml.gz',
        format: 'xml_gz',
      })
    );

    // WHEN: Fetching all sources
    const sources = await xmltvSourcesApi.getAll();

    // THEN: All sources are returned
    expect(sources.length).toBeGreaterThanOrEqual(2);

    // THEN: Sources are ordered by name (ascending)
    const names = sources.map((s) => s.name);
    const sortedNames = [...names].sort();
    expect(names).toEqual(sortedNames);

    // THEN: Created sources are in the list
    const source1Found = sources.find((s) => s.id === source1.id);
    const source2Found = sources.find((s) => s.id === source2.id);
    expect(source1Found).toBeDefined();
    expect(source2Found).toBeDefined();
  });

  test('PUT update_xmltv_source - should update XMLTV source', async ({ xmltvSourcesApi }) => {
    // GIVEN: An existing XMLTV source
    const originalSource = await xmltvSourcesApi.add(
      createNewXmltvSource({
        name: 'Original Name',
        url: 'https://original.example.com/epg.xml',
        format: 'xml',
      })
    );

    // WHEN: Updating source name and format
    const updatedSource = await xmltvSourcesApi.update(originalSource.id, {
      name: 'Updated Name',
      format: 'xml_gz',
    });

    // THEN: Source is updated
    expect(updatedSource.id).toBe(originalSource.id);
    expect(updatedSource.name).toBe('Updated Name');
    expect(updatedSource.format).toBe('xml_gz');

    // THEN: URL remains unchanged
    expect(updatedSource.url).toBe(originalSource.url);

    // THEN: updatedAt timestamp is updated
    expect(new Date(updatedSource.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(originalSource.updatedAt).getTime()
    );
  });

  test('PUT update_xmltv_source - should reject invalid URL in update', async ({ xmltvSourcesApi }) => {
    // GIVEN: An existing XMLTV source
    const source = await xmltvSourcesApi.add(
      createNewXmltvSource({
        name: 'Valid Source',
        url: 'https://valid.example.com/epg.xml',
        format: 'xml',
      })
    );

    // WHEN: Attempting to update with invalid URL
    // THEN: Request fails with validation error
    await expect(
      xmltvSourcesApi.update(source.id, {
        url: 'invalid-url',
      })
    ).rejects.toThrow(/invalid url/i);
  });

  test('PUT update_xmltv_source - should handle non-existent source ID', async ({ xmltvSourcesApi }) => {
    // GIVEN: A non-existent source ID
    const nonExistentId = 999999;

    // WHEN: Attempting to update non-existent source
    // THEN: Request fails with not found error
    await expect(
      xmltvSourcesApi.update(nonExistentId, {
        name: 'Updated Name',
      })
    ).rejects.toThrow(/not found/i);
  });

  test('DELETE delete_xmltv_source - should delete XMLTV source', async ({ xmltvSourcesApi }) => {
    // GIVEN: An existing XMLTV source
    const source = await xmltvSourcesApi.add(
      createNewXmltvSource({
        name: 'Source To Delete',
        url: 'https://delete.example.com/epg.xml',
        format: 'xml',
      })
    );

    // WHEN: Deleting the source
    await xmltvSourcesApi.delete(source.id);

    // THEN: Source no longer appears in list
    const sources = await xmltvSourcesApi.getAll();
    const deletedSource = sources.find((s) => s.id === source.id);
    expect(deletedSource).toBeUndefined();
  });

  test('DELETE delete_xmltv_source - should handle non-existent source ID', async ({ xmltvSourcesApi }) => {
    // GIVEN: A non-existent source ID
    const nonExistentId = 999999;

    // WHEN: Attempting to delete non-existent source
    // THEN: Request fails with not found error
    await expect(xmltvSourcesApi.delete(nonExistentId)).rejects.toThrow(/not found/i);
  });

  test('POST toggle_xmltv_source - should toggle source active state', async ({ xmltvSourcesApi }) => {
    // GIVEN: An active XMLTV source
    const source = await xmltvSourcesApi.add(
      createNewXmltvSource({
        name: 'Toggle Source',
        url: 'https://toggle.example.com/epg.xml',
        format: 'xml',
      })
    );

    expect(source.isActive).toBe(true);

    // WHEN: Disabling the source
    const disabledSource = await xmltvSourcesApi.toggle(source.id, false);

    // THEN: Source is inactive
    expect(disabledSource.id).toBe(source.id);
    expect(disabledSource.isActive).toBe(false);

    // WHEN: Re-enabling the source
    const enabledSource = await xmltvSourcesApi.toggle(source.id, true);

    // THEN: Source is active again
    expect(enabledSource.id).toBe(source.id);
    expect(enabledSource.isActive).toBe(true);
  });

  test('POST toggle_xmltv_source - should handle non-existent source ID', async ({ xmltvSourcesApi }) => {
    // GIVEN: A non-existent source ID
    const nonExistentId = 999999;

    // WHEN: Attempting to toggle non-existent source
    // THEN: Request fails with not found error
    await expect(xmltvSourcesApi.toggle(nonExistentId, false)).rejects.toThrow(/not found/i);
  });
});
