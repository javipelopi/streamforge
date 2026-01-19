import { test as base } from '@playwright/test';
import type { EpgSchedule } from '../factories/epg-schedule.factory';

/**
 * Fixture for managing EPG schedule via Tauri commands
 * Provides API helpers with automatic cleanup (restores default schedule)
 *
 * Story: 2-6 - Implement Scheduled EPG Refresh
 */
export const test = base.extend<{
  epgScheduleApi: {
    get: () => Promise<EpgSchedule>;
    set: (schedule: EpgSchedule) => Promise<void>;
  };
}>({
  epgScheduleApi: async ({ page }, use) => {
    let originalSchedule: EpgSchedule | null = null;

    const api = {
      get: async (): Promise<EpgSchedule> => {
        return page.evaluate(async () => {
          // @ts-ignore - Tauri invoke available in Tauri context
          return window.__TAURI__.invoke('get_epg_schedule');
        });
      },

      set: async (schedule: EpgSchedule): Promise<void> => {
        // Save original schedule on first set (for cleanup)
        if (originalSchedule === null) {
          try {
            originalSchedule = await api.get();
          } catch (error) {
            // Schedule may not exist yet - use default
            originalSchedule = { hour: 4, minute: 0, enabled: true };
          }
        }

        return page.evaluate(
          async (scheduleData) => {
            // @ts-ignore - Tauri invoke available in Tauri context
            return window.__TAURI__.invoke('set_epg_schedule', {
              hour: scheduleData.hour,
              minute: scheduleData.minute,
              enabled: scheduleData.enabled,
            });
          },
          schedule
        );
      },
    };

    // Provide API to test
    await use(api);

    // Cleanup: Restore original schedule
    if (originalSchedule !== null) {
      try {
        await api.set(originalSchedule);
      } catch (error) {
        console.warn('Failed to restore original EPG schedule:', error);
      }
    }
  },
});

export { expect } from '@playwright/test';
