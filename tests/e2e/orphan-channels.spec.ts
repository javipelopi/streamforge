import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Story 3.8: Manage Orphan Xtream Channels
 *
 * Tests the complete user journey for discovering, promoting, and managing
 * orphan Xtream channels (channels not matched to any XMLTV channel).
 *
 * Test Strategy:
 * - E2E level: Testing user-facing acceptance criteria
 * - Given-When-Then structure for clarity
 * - Network-first approach (intercept before navigate)
 * - Atomic tests (one assertion focus per test)
 */

test.describe('Orphan Xtream Channels Management', () => {
  test.describe('AC #1: Display Unmatched Xtream Streams Section', () => {
    test('should display orphan section when unmatched streams exist', async ({ page }) => {
      // GIVEN: System has Xtream channels not matched to any XMLTV channel
      await page.goto('/');

      // Mock orphan streams data
      await page.route('**/api/orphan-streams', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              streamId: 101,
              name: 'HBO Max HD',
              streamIcon: 'http://example.com/hbo.png',
              qualities: 'HD,FHD',
              categoryName: 'Movies',
            },
            {
              id: 2,
              streamId: 102,
              name: 'ESPN Sports',
              streamIcon: null,
              qualities: 'SD,HD',
              categoryName: 'Sports',
            },
          ]),
        })
      );

      // WHEN: User navigates to Channels view
      await page.goto('/channels');
      await page.waitForResponse((resp) => resp.url().includes('/api/orphan-streams'));

      // THEN: Unmatched Xtream Streams section is visible
      const orphanSection = page.getByTestId('orphan-xtream-section');
      await expect(orphanSection).toBeVisible();
    });

    test('should show orphan stream name in section', async ({ page }) => {
      // GIVEN: Orphan streams exist with specific names
      await page.goto('/');

      await page.route('**/api/orphan-streams', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              streamId: 101,
              name: 'HBO Max HD',
              streamIcon: 'http://example.com/hbo.png',
              qualities: 'HD,FHD',
              categoryName: 'Movies',
            },
          ]),
        })
      );

      // WHEN: User views the orphan section
      await page.goto('/channels');
      await page.waitForResponse((resp) => resp.url().includes('/api/orphan-streams'));

      // THEN: Stream name is displayed
      await expect(page.getByText('HBO Max HD')).toBeVisible();
    });

    test('should show quality tier badges for orphan streams', async ({ page }) => {
      // GIVEN: Orphan stream with multiple qualities
      await page.goto('/');

      await page.route('**/api/orphan-streams', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              streamId: 101,
              name: 'HBO Max HD',
              streamIcon: 'http://example.com/hbo.png',
              qualities: 'HD,FHD',
              categoryName: 'Movies',
            },
          ]),
        })
      );

      // WHEN: User views the orphan section
      await page.goto('/channels');
      await page.waitForResponse((resp) => resp.url().includes('/api/orphan-streams'));

      // THEN: Quality badges are displayed
      const orphanSection = page.getByTestId('orphan-xtream-section');
      await expect(orphanSection.getByText('HD')).toBeVisible();
      await expect(orphanSection.getByText('FHD')).toBeVisible();
    });

    test('should show category name for orphan streams', async ({ page }) => {
      // GIVEN: Orphan stream with category
      await page.goto('/');

      await page.route('**/api/orphan-streams', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              streamId: 101,
              name: 'ESPN Sports',
              streamIcon: null,
              qualities: 'SD,HD',
              categoryName: 'Sports',
            },
          ]),
        })
      );

      // WHEN: User views the orphan section
      await page.goto('/channels');
      await page.waitForResponse((resp) => resp.url().includes('/api/orphan-streams'));

      // THEN: Category name is displayed
      await expect(page.getByText('Sports')).toBeVisible();
    });

    test('should hide orphan section when no unmatched streams exist', async ({ page }) => {
      // GIVEN: No orphan streams exist
      await page.goto('/');

      await page.route('**/api/orphan-streams', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      );

      // WHEN: User navigates to Channels view
      await page.goto('/channels');
      await page.waitForResponse((resp) => resp.url().includes('/api/orphan-streams'));

      // THEN: Orphan section is not visible
      const orphanSection = page.getByTestId('orphan-xtream-section');
      await expect(orphanSection).not.toBeVisible();
    });
  });

  test.describe('AC #2: Promote to Plex Dialog', () => {
    test('should open promote dialog when clicking promote button', async ({ page }) => {
      // GIVEN: Orphan stream with promote button
      await page.goto('/');

      await page.route('**/api/orphan-streams', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              streamId: 101,
              name: 'HBO Max HD',
              streamIcon: 'http://example.com/hbo.png',
              qualities: 'HD,FHD',
              categoryName: 'Movies',
            },
          ]),
        })
      );

      await page.goto('/channels');
      await page.waitForResponse((resp) => resp.url().includes('/api/orphan-streams'));

      // WHEN: User clicks "Promote to Plex" button
      await page.click('[data-testid="promote-button-1"]');

      // THEN: Dialog is displayed
      const dialog = page.getByTestId('promote-dialog');
      await expect(dialog).toBeVisible();
    });

    test('should pre-fill display name from Xtream name', async ({ page }) => {
      // GIVEN: Orphan stream with name "HBO Max HD"
      await page.goto('/');

      await page.route('**/api/orphan-streams', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              streamId: 101,
              name: 'HBO Max HD',
              streamIcon: 'http://example.com/hbo.png',
              qualities: 'HD,FHD',
              categoryName: 'Movies',
            },
          ]),
        })
      );

      await page.goto('/channels');
      await page.waitForResponse((resp) => resp.url().includes('/api/orphan-streams'));

      // WHEN: User opens promote dialog
      await page.click('[data-testid="promote-button-1"]');

      // THEN: Display name field is pre-filled with Xtream name
      const displayNameInput = page.getByTestId('display-name-input');
      await expect(displayNameInput).toHaveValue('HBO Max HD');
    });

    test('should pre-fill icon URL from Xtream icon if available', async ({ page }) => {
      // GIVEN: Orphan stream with icon URL
      await page.goto('/');

      await page.route('**/api/orphan-streams', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              streamId: 101,
              name: 'HBO Max HD',
              streamIcon: 'http://example.com/hbo.png',
              qualities: 'HD,FHD',
              categoryName: 'Movies',
            },
          ]),
        })
      );

      await page.goto('/channels');
      await page.waitForResponse((resp) => resp.url().includes('/api/orphan-streams'));

      // WHEN: User opens promote dialog
      await page.click('[data-testid="promote-button-1"]');

      // THEN: Icon URL field is pre-filled with Xtream icon
      const iconUrlInput = page.getByTestId('icon-url-input');
      await expect(iconUrlInput).toHaveValue('http://example.com/hbo.png');
    });

    test('should allow editing display name in dialog', async ({ page }) => {
      // GIVEN: Promote dialog is open
      await page.goto('/');

      await page.route('**/api/orphan-streams', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              streamId: 101,
              name: 'HBO Max HD',
              streamIcon: 'http://example.com/hbo.png',
              qualities: 'HD,FHD',
              categoryName: 'Movies',
            },
          ]),
        })
      );

      await page.goto('/channels');
      await page.waitForResponse((resp) => resp.url().includes('/api/orphan-streams'));
      await page.click('[data-testid="promote-button-1"]');

      // WHEN: User edits display name
      const displayNameInput = page.getByTestId('display-name-input');
      await displayNameInput.fill('HBO Max Custom Name');

      // THEN: Input reflects new value
      await expect(displayNameInput).toHaveValue('HBO Max Custom Name');
    });

    test('should close dialog when clicking cancel', async ({ page }) => {
      // GIVEN: Promote dialog is open
      await page.goto('/');

      await page.route('**/api/orphan-streams', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              streamId: 101,
              name: 'HBO Max HD',
              streamIcon: 'http://example.com/hbo.png',
              qualities: 'HD,FHD',
              categoryName: 'Movies',
            },
          ]),
        })
      );

      await page.goto('/channels');
      await page.waitForResponse((resp) => resp.url().includes('/api/orphan-streams'));
      await page.click('[data-testid="promote-button-1"]');

      // WHEN: User clicks Cancel button
      await page.click('[data-testid="cancel-button"]');

      // THEN: Dialog is closed
      const dialog = page.getByTestId('promote-dialog');
      await expect(dialog).not.toBeVisible();
    });
  });

  test.describe('AC #3: Promote to Synthetic Channel', () => {
    test('should create synthetic channel when confirming promotion', async ({ page }) => {
      // GIVEN: User has filled out promote dialog
      await page.goto('/');

      await page.route('**/api/orphan-streams', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              streamId: 101,
              name: 'HBO Max HD',
              streamIcon: 'http://example.com/hbo.png',
              qualities: 'HD,FHD',
              categoryName: 'Movies',
            },
          ]),
        })
      );

      // Mock promote API call
      let promoteCalled = false;
      await page.route('**/api/promote-orphan', async (route) => {
        promoteCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 999,
            channelId: 'synthetic-1',
            displayName: 'HBO Max HD',
            icon: 'http://example.com/hbo.png',
            isSynthetic: true,
            streamMatches: [
              {
                xtreamChannelId: 1,
                streamId: 101,
                name: 'HBO Max HD',
                qualities: 'HD,FHD',
              },
            ],
          }),
        });
      });

      await page.goto('/channels');
      await page.waitForResponse((resp) => resp.url().includes('/api/orphan-streams'));
      await page.click('[data-testid="promote-button-1"]');

      // WHEN: User confirms promotion
      await page.click('[data-testid="confirm-promote-button"]');

      // THEN: API is called to promote the channel
      await page.waitForResponse((resp) => resp.url().includes('/api/promote-orphan'));
      expect(promoteCalled).toBe(true);
    });

    test('should display success message after promotion', async ({ page }) => {
      // GIVEN: Promote operation completes successfully
      await page.goto('/');

      await page.route('**/api/orphan-streams', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              streamId: 101,
              name: 'HBO Max HD',
              streamIcon: 'http://example.com/hbo.png',
              qualities: 'HD,FHD',
              categoryName: 'Movies',
            },
          ]),
        })
      );

      await page.route('**/api/promote-orphan', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 999,
            channelId: 'synthetic-1',
            displayName: 'HBO Max HD',
            icon: 'http://example.com/hbo.png',
            isSynthetic: true,
          }),
        })
      );

      await page.goto('/channels');
      await page.waitForResponse((resp) => resp.url().includes('/api/orphan-streams'));
      await page.click('[data-testid="promote-button-1"]');

      // WHEN: User confirms promotion
      await page.click('[data-testid="confirm-promote-button"]');
      await page.waitForResponse((resp) => resp.url().includes('/api/promote-orphan'));

      // THEN: Success message is displayed
      await expect(page.getByText(/promoted successfully/i)).toBeVisible();
    });

    test('should remove promoted stream from orphan section', async ({ page }) => {
      // GIVEN: Orphan stream exists in section
      await page.goto('/');

      let orphanStreams = [
        {
          id: 1,
          streamId: 101,
          name: 'HBO Max HD',
          streamIcon: 'http://example.com/hbo.png',
          qualities: 'HD,FHD',
          categoryName: 'Movies',
        },
      ];

      await page.route('**/api/orphan-streams', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(orphanStreams),
        })
      );

      await page.route('**/api/promote-orphan', async (route) => {
        // After promotion, orphan list is empty
        orphanStreams = [];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 999,
            channelId: 'synthetic-1',
            displayName: 'HBO Max HD',
            icon: 'http://example.com/hbo.png',
            isSynthetic: true,
          }),
        });
      });

      await page.goto('/channels');
      await page.waitForResponse((resp) => resp.url().includes('/api/orphan-streams'));
      await page.click('[data-testid="promote-button-1"]');
      await page.click('[data-testid="confirm-promote-button"]');
      await page.waitForResponse((resp) => resp.url().includes('/api/promote-orphan'));

      // WHEN: Orphan list refreshes after promotion
      await page.waitForResponse((resp) => resp.url().includes('/api/orphan-streams'));

      // THEN: Promoted stream is no longer in orphan section
      await expect(page.getByText('HBO Max HD')).not.toBeVisible();
    });

    test('should display error message when promotion fails', async ({ page }) => {
      // GIVEN: Promotion API fails
      await page.goto('/');

      await page.route('**/api/orphan-streams', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              streamId: 101,
              name: 'HBO Max HD',
              streamIcon: 'http://example.com/hbo.png',
              qualities: 'HD,FHD',
              categoryName: 'Movies',
            },
          ]),
        })
      );

      await page.route('**/api/promote-orphan', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Database error',
          }),
        })
      );

      await page.goto('/channels');
      await page.waitForResponse((resp) => resp.url().includes('/api/orphan-streams'));
      await page.click('[data-testid="promote-button-1"]');

      // WHEN: User confirms promotion
      await page.click('[data-testid="confirm-promote-button"]');
      await page.waitForResponse((resp) => resp.url().includes('/api/promote-orphan'));

      // THEN: Error message is displayed
      await expect(page.getByText(/failed to promote/i)).toBeVisible();
    });
  });

  test.describe('AC #5: Synthetic Channel Badge and Edit', () => {
    test('should display synthetic badge on promoted channels', async ({ page }) => {
      // GIVEN: Channel list includes synthetic channel
      await page.goto('/');

      await page.route('**/api/xmltv-channels', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 999,
              channelId: 'synthetic-1',
              displayName: 'HBO Max HD',
              icon: 'http://example.com/hbo.png',
              isSynthetic: true,
              isEnabled: false,
              streamMatches: [],
            },
          ]),
        })
      );

      // WHEN: User views channels list
      await page.goto('/channels');
      await page.waitForResponse((resp) => resp.url().includes('/api/xmltv-channels'));

      // THEN: Synthetic badge is displayed
      const syntheticBadge = page.getByTestId('synthetic-badge-999');
      await expect(syntheticBadge).toBeVisible();
      await expect(syntheticBadge).toHaveText('Synthetic');
    });

    test('should show edit button on synthetic channel rows', async ({ page }) => {
      // GIVEN: Synthetic channel exists
      await page.goto('/');

      await page.route('**/api/xmltv-channels', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 999,
              channelId: 'synthetic-1',
              displayName: 'HBO Max HD',
              icon: 'http://example.com/hbo.png',
              isSynthetic: true,
              isEnabled: false,
              streamMatches: [],
            },
          ]),
        })
      );

      // WHEN: User views channels list
      await page.goto('/channels');
      await page.waitForResponse((resp) => resp.url().includes('/api/xmltv-channels'));

      // THEN: Edit button is visible
      const editButton = page.getByTestId('edit-synthetic-button-999');
      await expect(editButton).toBeVisible();
    });

    test('should open edit dialog when clicking edit button', async ({ page }) => {
      // GIVEN: Synthetic channel with edit button
      await page.goto('/');

      await page.route('**/api/xmltv-channels', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 999,
              channelId: 'synthetic-1',
              displayName: 'HBO Max HD',
              icon: 'http://example.com/hbo.png',
              isSynthetic: true,
              isEnabled: false,
              streamMatches: [],
            },
          ]),
        })
      );

      await page.goto('/channels');
      await page.waitForResponse((resp) => resp.url().includes('/api/xmltv-channels'));

      // WHEN: User clicks edit button
      await page.click('[data-testid="edit-synthetic-button-999"]');

      // THEN: Edit dialog is displayed
      const dialog = page.getByTestId('edit-synthetic-dialog');
      await expect(dialog).toBeVisible();
    });

    test('should update synthetic channel display name when editing', async ({ page }) => {
      // GIVEN: Edit dialog is open for synthetic channel
      await page.goto('/');

      await page.route('**/api/xmltv-channels', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 999,
              channelId: 'synthetic-1',
              displayName: 'HBO Max HD',
              icon: 'http://example.com/hbo.png',
              isSynthetic: true,
              isEnabled: false,
              streamMatches: [],
            },
          ]),
        })
      );

      await page.route('**/api/update-synthetic-channel', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 999,
            channelId: 'synthetic-1',
            displayName: 'HBO Max Updated',
            icon: 'http://example.com/hbo.png',
            isSynthetic: true,
            isEnabled: false,
            streamMatches: [],
          }),
        })
      );

      await page.goto('/channels');
      await page.waitForResponse((resp) => resp.url().includes('/api/xmltv-channels'));
      await page.click('[data-testid="edit-synthetic-button-999"]');

      // WHEN: User updates display name and saves
      const displayNameInput = page.getByTestId('display-name-input');
      await displayNameInput.fill('HBO Max Updated');
      await page.click('[data-testid="save-edit-button"]');

      // THEN: Update API is called
      await page.waitForResponse((resp) => resp.url().includes('/api/update-synthetic-channel'));
    });
  });
});
