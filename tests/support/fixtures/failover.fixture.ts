import { test as base } from '@playwright/test';
import {
  createFailoverScenario,
  createPrimaryFailsScenario,
  createAllStreamsFailScenario,
  createNoBackupsScenario,
  type FailoverScenario,
} from '../factories/failover.factory';

/**
 * Fixture: Stream Failover
 * Story 4-5: Automatic Stream Failover
 *
 * Provides pre-configured failover scenarios for testing.
 * Auto-cleanup after test completion.
 */

interface FailoverFixtures {
  /**
   * Basic failover scenario: primary + 2 backups
   */
  basicFailoverScenario: FailoverScenario;

  /**
   * Scenario where primary fails but backup succeeds
   */
  primaryFailsScenario: FailoverScenario;

  /**
   * Scenario where all streams fail
   */
  allFailScenario: FailoverScenario;

  /**
   * Scenario with no backup streams
   */
  noBackupsScenario: FailoverScenario;

  /**
   * Seed failover test data to database
   */
  seedFailoverData: (scenario: FailoverScenario) => Promise<void>;

  /**
   * Clean up failover test data
   */
  cleanupFailoverData: () => Promise<void>;
}

export const test = base.extend<FailoverFixtures>({
  basicFailoverScenario: async ({}, use) => {
    // Setup: Create basic scenario
    const scenario = createFailoverScenario(2);

    // Provide to test
    await use(scenario);

    // Cleanup: Automatic (handled by cleanupFailoverData)
  },

  primaryFailsScenario: async ({}, use) => {
    // Setup: Create primary-fails scenario
    const scenario = createPrimaryFailsScenario();

    // Provide to test
    await use(scenario);

    // Cleanup: Automatic
  },

  allFailScenario: async ({}, use) => {
    // Setup: Create all-fail scenario
    const scenario = createAllStreamsFailScenario();

    // Provide to test
    await use(scenario);

    // Cleanup: Automatic
  },

  noBackupsScenario: async ({}, use) => {
    // Setup: Create no-backups scenario
    const scenario = createNoBackupsScenario();

    // Provide to test
    await use(scenario);

    // Cleanup: Automatic
  },

  seedFailoverData: async ({ request }, use) => {
    const baseUrl = 'http://127.0.0.1:5004';

    // Provide seeding function to test
    await use(async (scenario: FailoverScenario) => {
      // Seed via /test/seed endpoint with scenario data
      const response = await request.post(`${baseUrl}/test/seed`, {
        data: {
          failover_scenario: scenario,
        },
      });

      if (!response.ok()) {
        const body = await response.text();
        throw new Error(`Failed to seed failover data: ${body}`);
      }
    });

    // No cleanup needed (handled by cleanupFailoverData)
  },

  cleanupFailoverData: async ({ request }, use) => {
    const baseUrl = 'http://127.0.0.1:5004';

    // Provide cleanup function to test
    await use(async () => {
      // Clear test data via /test/seed DELETE
      await request.delete(`${baseUrl}/test/seed`);
    });

    // Final cleanup after test
    await request.delete(`${baseUrl}/test/seed`);
  },
});

export { expect } from '@playwright/test';

/**
 * USAGE EXAMPLES:
 *
 * Basic failover test:
 * ```typescript
 * import { test, expect } from './fixtures/failover.fixture';
 *
 * test('should failover to backup stream', async ({ basicFailoverScenario, seedFailoverData }) => {
 *   await seedFailoverData(basicFailoverScenario);
 *
 *   // Test failover behavior
 *   const response = await request.get(`/stream/${basicFailoverScenario.xmltv_channel_id}`);
 *   expect(response.status()).toBe(200);
 * });
 * ```
 *
 * Primary fails scenario:
 * ```typescript
 * test('should use backup when primary fails', async ({ primaryFailsScenario, seedFailoverData }) => {
 *   await seedFailoverData(primaryFailsScenario);
 *
 *   const response = await request.get(`/stream/${primaryFailsScenario.xmltv_channel_id}`);
 *   expect(response.status()).toBe(200);
 * });
 * ```
 */
