import { test, expect } from '@playwright/test';
import { createNewXmltvSource, createXmltvSource } from '../support/factories/xmltv-source.factory';

/**
 * E2E Tests for Story 2-4: Add XMLTV Source Management
 *
 * These tests verify the complete user journey for managing EPG sources
 * in the Accounts view. All tests are in RED phase - they will fail until
 * the implementation is complete.
 *
 * Test Strategy:
 * - E2E level: Tests full user interactions from Accounts view
 * - Given-When-Then format for clarity
 * - data-testid selectors for resilience
 * - Minimal mocking (only Tauri IPC layer in some cases)
 */

test.describe('EPG Sources Management', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: User navigates to Accounts view
    await page.goto('/accounts');

    // Wait for page to be ready
    await page.waitForLoadState('networkidle');
  });

  test('should display Add EPG Source button and open dialog', async ({ page }) => {
    // GIVEN: User is on Accounts view with EPG Sources section

    // WHEN: User looks for Add EPG Source button
    const addButton = page.getByTestId('add-epg-source-button');

    // THEN: Add EPG Source button is visible
    await expect(addButton).toBeVisible();
    await expect(addButton).toHaveText(/Add EPG Source/i);

    // WHEN: User clicks Add EPG Source button
    await addButton.click();

    // THEN: EPG Source dialog opens with required fields
    const dialog = page.getByTestId('epg-source-dialog');
    await expect(dialog).toBeVisible();

    // THEN: Dialog contains all required form fields
    await expect(page.getByTestId('epg-source-name')).toBeVisible();
    await expect(page.getByTestId('epg-source-url')).toBeVisible();
    await expect(page.getByTestId('epg-source-format')).toBeVisible();

    // THEN: Dialog contains submit and cancel buttons
    await expect(page.getByTestId('epg-source-submit')).toBeVisible();
    await expect(page.getByTestId('epg-source-cancel')).toBeVisible();
  });

  test('should add EPG source with valid data', async ({ page }) => {
    // GIVEN: User opens Add EPG Source dialog
    await page.getByTestId('add-epg-source-button').click();
    await expect(page.getByTestId('epg-source-dialog')).toBeVisible();

    // GIVEN: Valid EPG source data
    const newSource = createNewXmltvSource({
      name: 'Test EPG Source',
      url: 'https://example.com/test-epg.xml',
      format: 'xml',
    });

    // WHEN: User fills in the form fields
    await page.getByTestId('epg-source-name').fill(newSource.name);
    await page.getByTestId('epg-source-url').fill(newSource.url);
    await page.getByTestId('epg-source-format').selectOption(newSource.format);

    // WHEN: User submits the form
    await page.getByTestId('epg-source-submit').click();

    // THEN: Dialog closes
    await expect(page.getByTestId('epg-source-dialog')).not.toBeVisible();

    // THEN: New source appears in the EPG sources list
    const sourcesList = page.getByTestId('epg-sources-list');
    await expect(sourcesList).toBeVisible();

    // THEN: Source name and URL are displayed
    await expect(sourcesList).toContainText(newSource.name);
    await expect(sourcesList).toContainText(newSource.url);

    // THEN: Source has active state controls
    const sourceItem = sourcesList.locator(`[data-testid^="epg-source-item-"]`).first();
    await expect(sourceItem.getByTestId(/epg-source-toggle-/)).toBeVisible();
    await expect(sourceItem.getByTestId(/epg-source-edit-/)).toBeVisible();
    await expect(sourceItem.getByTestId(/epg-source-delete-/)).toBeVisible();
  });

  test('should prevent duplicate URL submission', async ({ page }) => {
    // GIVEN: An EPG source already exists
    const existingSource = createNewXmltvSource({
      name: 'Existing Source',
      url: 'https://example.com/existing-epg.xml',
      format: 'xml',
    });

    // Add first source
    await page.getByTestId('add-epg-source-button').click();
    await page.getByTestId('epg-source-name').fill(existingSource.name);
    await page.getByTestId('epg-source-url').fill(existingSource.url);
    await page.getByTestId('epg-source-format').selectOption(existingSource.format);
    await page.getByTestId('epg-source-submit').click();

    // Wait for dialog to close
    await expect(page.getByTestId('epg-source-dialog')).not.toBeVisible();

    // WHEN: User tries to add another source with same URL
    await page.getByTestId('add-epg-source-button').click();
    await expect(page.getByTestId('epg-source-dialog')).toBeVisible();

    const duplicateSource = createNewXmltvSource({
      name: 'Duplicate Source',
      url: existingSource.url, // Same URL as existing
      format: 'xml',
    });

    await page.getByTestId('epg-source-name').fill(duplicateSource.name);
    await page.getByTestId('epg-source-url').fill(duplicateSource.url);
    await page.getByTestId('epg-source-format').selectOption(duplicateSource.format);

    // WHEN: User submits the duplicate URL
    await page.getByTestId('epg-source-submit').click();

    // THEN: Error message is displayed
    const errorMessage = page.getByTestId('epg-source-error');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/already exists|duplicate/i);

    // THEN: Dialog remains open
    await expect(page.getByTestId('epg-source-dialog')).toBeVisible();
  });

  test('should edit existing EPG source', async ({ page }) => {
    // GIVEN: An EPG source exists in the list
    const originalSource = createNewXmltvSource({
      name: 'Original Source',
      url: 'https://example.com/original.xml',
      format: 'xml',
    });

    // Add source first
    await page.getByTestId('add-epg-source-button').click();
    await page.getByTestId('epg-source-name').fill(originalSource.name);
    await page.getByTestId('epg-source-url').fill(originalSource.url);
    await page.getByTestId('epg-source-format').selectOption(originalSource.format);
    await page.getByTestId('epg-source-submit').click();

    // Wait for source to appear
    await expect(page.getByTestId('epg-sources-list')).toContainText(originalSource.name);

    // WHEN: User clicks edit button
    const editButton = page.getByTestId(/epg-source-edit-/).first();
    await editButton.click();

    // THEN: Dialog opens in edit mode with pre-filled data
    const dialog = page.getByTestId('epg-source-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('epg-source-name')).toHaveValue(originalSource.name);
    await expect(page.getByTestId('epg-source-url')).toHaveValue(originalSource.url);

    // WHEN: User modifies the source name
    const updatedName = 'Updated Source Name';
    await page.getByTestId('epg-source-name').fill(updatedName);

    // WHEN: User submits the changes
    await page.getByTestId('epg-source-submit').click();

    // THEN: Dialog closes
    await expect(dialog).not.toBeVisible();

    // THEN: Updated name is displayed in the list
    await expect(page.getByTestId('epg-sources-list')).toContainText(updatedName);

    // THEN: Original name is no longer displayed
    await expect(page.getByTestId('epg-sources-list')).not.toContainText(originalSource.name);
  });

  test('should delete EPG source with confirmation', async ({ page }) => {
    // GIVEN: An EPG source exists in the list
    const sourceToDelete = createNewXmltvSource({
      name: 'Source To Delete',
      url: 'https://example.com/delete-me.xml',
      format: 'xml',
    });

    // Add source first
    await page.getByTestId('add-epg-source-button').click();
    await page.getByTestId('epg-source-name').fill(sourceToDelete.name);
    await page.getByTestId('epg-source-url').fill(sourceToDelete.url);
    await page.getByTestId('epg-source-format').selectOption(sourceToDelete.format);
    await page.getByTestId('epg-source-submit').click();

    // Wait for source to appear
    await expect(page.getByTestId('epg-sources-list')).toContainText(sourceToDelete.name);

    // Set up dialog confirmation handler
    page.on('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('Delete');
      await dialog.accept();
    });

    // WHEN: User clicks delete button
    const deleteButton = page.getByTestId(/epg-source-delete-/).first();
    await deleteButton.click();

    // THEN: Source is removed from the list
    await expect(page.getByTestId('epg-sources-list')).not.toContainText(sourceToDelete.name);
  });

  test('should toggle EPG source active state', async ({ page }) => {
    // GIVEN: An active EPG source exists
    const source = createNewXmltvSource({
      name: 'Toggle Test Source',
      url: 'https://example.com/toggle.xml',
      format: 'xml',
    });

    // Add source first
    await page.getByTestId('add-epg-source-button').click();
    await page.getByTestId('epg-source-name').fill(source.name);
    await page.getByTestId('epg-source-url').fill(source.url);
    await page.getByTestId('epg-source-format').selectOption(source.format);
    await page.getByTestId('epg-source-submit').click();

    // Wait for source to appear
    await expect(page.getByTestId('epg-sources-list')).toContainText(source.name);

    // GIVEN: Toggle switch is initially checked (active)
    const toggleSwitch = page.getByTestId(/epg-source-toggle-/).first();
    await expect(toggleSwitch).toBeChecked();

    // WHEN: User toggles the switch to disable
    await toggleSwitch.click();

    // THEN: Switch is unchecked (inactive)
    await expect(toggleSwitch).not.toBeChecked();

    // WHEN: User toggles the switch to enable again
    await toggleSwitch.click();

    // THEN: Switch is checked (active) again
    await expect(toggleSwitch).toBeChecked();
  });
});
