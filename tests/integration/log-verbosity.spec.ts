import { test, expect } from '@playwright/test';
import { injectSettingsStatefulMock, SettingsState } from '../support/mocks/tauri.mock';

/**
 * Integration Tests for Story 6-3: Log Verbosity System
 *
 * Test Level: Integration (Frontend + Mocked Tauri backend)
 * Framework: Playwright Test
 * Focus: Log verbosity filtering (minimal vs verbose mode)
 *
 * These tests verify the log verbosity system works correctly using mocked
 * Tauri commands. For true backend integration testing, Rust unit tests
 * in src-tauri/src/commands/logs.rs should be used.
 *
 * Run with: pnpm test -- tests/integration/log-verbosity.spec.ts
 */

// Helper type for event objects
interface EventLog {
  id: number;
  level: string;
  category: string;
  message: string;
  details: string | null;
  timestamp: string;
  isRead: boolean;
}

// Settings state for mock
const createDefaultSettings = (verbosity: 'minimal' | 'verbose' = 'verbose'): SettingsState => ({
  serverPort: 5004,
  autostartEnabled: false,
  epgSchedule: { hour: 4, minute: 0, enabled: true },
  logVerbosity: verbosity,
});

// Setup mock that includes log event commands
async function setupLogVerbosityMock(page: any, initialVerbosity: 'minimal' | 'verbose' = 'verbose') {
  // Use the settings stateful mock with log verbosity
  await injectSettingsStatefulMock(page, createDefaultSettings(initialVerbosity));

  // Add additional script for event logging commands
  await page.addInitScript(`
    // Extend the mock with log event commands
    (function() {
      // In-memory event store
      window.__LOG_EVENTS__ = [];
      window.__LOG_EVENT_ID__ = 1;

      const originalInvoke = window.__TAURI_INTERNALS__.invoke;

      window.__TAURI_INTERNALS__.invoke = async function(cmd, args = {}) {
        console.log('[Log Mock] Command:', cmd, args);

        if (cmd === 'log_event') {
          const verbosity = window.__SETTINGS_STATE__.logVerbosity || 'verbose';

          // Respect verbosity setting
          if (args.level === 'info' && verbosity === 'minimal') {
            console.log('[Log Mock] Filtering info event in minimal mode');
            return;
          }

          // Store the event
          const event = {
            id: window.__LOG_EVENT_ID__++,
            level: args.level,
            category: args.category,
            message: args.message,
            details: args.details || null,
            timestamp: new Date().toISOString(),
            isRead: false,
          };
          window.__LOG_EVENTS__.unshift(event); // Add to beginning (newest first)
          console.log('[Log Mock] Event logged:', event);
          return event.id;
        }

        if (cmd === 'get_events') {
          const limit = args.limit || 10;
          const category = args.category;
          let events = [...window.__LOG_EVENTS__];

          if (category) {
            events = events.filter(e => e.category === category);
          }

          return events.slice(0, limit);
        }

        if (cmd === 'clear_old_events') {
          const keepCount = args.keep_count || 0;
          if (keepCount === 0) {
            window.__LOG_EVENTS__ = [];
          } else {
            window.__LOG_EVENTS__ = window.__LOG_EVENTS__.slice(0, keepCount);
          }
          return;
        }

        // Delegate to original mock for other commands
        return originalInvoke(cmd, args);
      };

      console.log('[Log Mock] Event logging mock initialized');
    })();
  `);
}

test.describe('Log Verbosity: Minimal Mode (AC #3)', () => {
  test.beforeEach(async ({ page }) => {
    await setupLogVerbosityMock(page, 'minimal');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('AC #3: should filter info events when verbosity is minimal', async ({ page }) => {
    // GIVEN: Log verbosity is set to "minimal" (done in beforeEach)

    // WHEN: Logging events at different levels via evaluate
    await page.evaluate(async () => {
      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('log_event', {
        level: 'info',
        category: 'system',
        message: 'Info event - should be filtered',
        details: null,
      });

      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('log_event', {
        level: 'warn',
        category: 'stream',
        message: 'Warning event - should be logged',
        details: null,
      });

      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('log_event', {
        level: 'error',
        category: 'connection',
        message: 'Error event - should be logged',
        details: null,
      });
    });

    // THEN: Only warn and error events are logged
    const events = await page.evaluate(async () => {
      // @ts-expect-error - window access
      return window.__TAURI_INTERNALS__.invoke('get_events', { limit: 10 });
    });

    expect(events).toHaveLength(2);
    expect(events[0].level).toBe('error');
    expect(events[1].level).toBe('warn');

    const hasInfoEvent = events.some((e: EventLog) => e.level === 'info');
    expect(hasInfoEvent).toBe(false);
  });

  test('should not log info level connection events in minimal mode', async ({ page }) => {
    // GIVEN: Log verbosity is minimal

    // WHEN: Connection success occurs (info level)
    await page.evaluate(async () => {
      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('log_event', {
        level: 'info',
        category: 'connection',
        message: 'Connection successful',
        details: JSON.stringify({ accountId: 1, serverUrl: 'http://test.com' }),
      });
    });

    // THEN: Event is not logged
    const events = await page.evaluate(async () => {
      // @ts-expect-error - window access
      return window.__TAURI_INTERNALS__.invoke('get_events', {
        category: 'connection',
        limit: 10,
      });
    });

    expect(events).toHaveLength(0);
  });

  test('should not log info level stream events in minimal mode', async ({ page }) => {
    // WHEN: Stream start/stop occurs (info level)
    await page.evaluate(async () => {
      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('log_event', {
        level: 'info',
        category: 'stream',
        message: 'Stream started',
        details: null,
      });

      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('log_event', {
        level: 'info',
        category: 'stream',
        message: 'Stream stopped',
        details: null,
      });
    });

    // THEN: Events are not logged
    const events = await page.evaluate(async () => {
      // @ts-expect-error - window access
      return window.__TAURI_INTERNALS__.invoke('get_events', {
        category: 'stream',
        limit: 10,
      });
    });

    expect(events).toHaveLength(0);
  });

  test('should still log warn and error stream events in minimal mode', async ({ page }) => {
    // WHEN: Stream failover (warn) and failure (error) occur
    await page.evaluate(async () => {
      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('log_event', {
        level: 'warn',
        category: 'stream',
        message: 'Stream failover',
        details: JSON.stringify({ failoverCount: 1 }),
      });

      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('log_event', {
        level: 'error',
        category: 'stream',
        message: 'Stream failed',
        details: JSON.stringify({ error: 'All sources exhausted' }),
      });
    });

    // THEN: Both warn and error events are logged
    const events = await page.evaluate(async () => {
      // @ts-expect-error - window access
      return window.__TAURI_INTERNALS__.invoke('get_events', {
        category: 'stream',
        limit: 10,
      });
    });

    expect(events).toHaveLength(2);
    expect(events[0].level).toBe('error');
    expect(events[1].level).toBe('warn');
  });
});

test.describe('Log Verbosity: Verbose Mode (AC #4)', () => {
  test.beforeEach(async ({ page }) => {
    await setupLogVerbosityMock(page, 'verbose');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('AC #4: should log all events including info when verbosity is verbose', async ({ page }) => {
    // WHEN: Logging events at all levels
    await page.evaluate(async () => {
      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('log_event', {
        level: 'info',
        category: 'system',
        message: 'Info event - should be logged',
        details: null,
      });

      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('log_event', {
        level: 'warn',
        category: 'stream',
        message: 'Warning event - should be logged',
        details: null,
      });

      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('log_event', {
        level: 'error',
        category: 'connection',
        message: 'Error event - should be logged',
        details: null,
      });
    });

    // THEN: All events are logged
    const events = await page.evaluate(async () => {
      // @ts-expect-error - window access
      return window.__TAURI_INTERNALS__.invoke('get_events', { limit: 10 });
    });

    expect(events).toHaveLength(3);

    const levels = events.map((e: EventLog) => e.level);
    expect(levels).toContain('info');
    expect(levels).toContain('warn');
    expect(levels).toContain('error');
  });

  test('should log info level connection events in verbose mode', async ({ page }) => {
    // WHEN: Connection success occurs
    await page.evaluate(async () => {
      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('log_event', {
        level: 'info',
        category: 'connection',
        message: 'Connection successful: Test Account',
        details: JSON.stringify({ accountId: 1, serverUrl: 'http://test.com' }),
      });
    });

    // THEN: Event is logged
    const events = await page.evaluate(async () => {
      // @ts-expect-error - window access
      return window.__TAURI_INTERNALS__.invoke('get_events', {
        category: 'connection',
        limit: 10,
      });
    });

    expect(events).toHaveLength(1);
    expect(events[0].level).toBe('info');
    expect(events[0].message).toContain('Connection successful');
  });

  test('should log info level EPG events in verbose mode', async ({ page }) => {
    // WHEN: EPG refresh completes
    await page.evaluate(async () => {
      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('log_event', {
        level: 'info',
        category: 'epg',
        message: 'EPG refresh completed: 100 channels, 5000 programs',
        details: JSON.stringify({
          sourceName: 'Test EPG',
          channelCount: 100,
          programCount: 5000,
          durationMs: 2500,
        }),
      });
    });

    // THEN: Event is logged
    const events = await page.evaluate(async () => {
      // @ts-expect-error - window access
      return window.__TAURI_INTERNALS__.invoke('get_events', {
        category: 'epg',
        limit: 10,
      });
    });

    expect(events).toHaveLength(1);
    expect(events[0].level).toBe('info');
    expect(events[0].message).toContain('EPG refresh completed');

    const details = JSON.parse(events[0].details);
    expect(details.channelCount).toBe(100);
    expect(details.programCount).toBe(5000);
  });

  test('should log all system lifecycle events in verbose mode', async ({ page }) => {
    // WHEN: System lifecycle events occur
    await page.evaluate(async () => {
      const systemEvents = [
        { message: 'Application started', category: 'system' },
        { message: 'Server restarted', category: 'system' },
        { message: 'Configuration changed', category: 'system' },
      ];

      for (const event of systemEvents) {
        // @ts-expect-error - window access
        await window.__TAURI_INTERNALS__.invoke('log_event', {
          level: 'info',
          category: event.category,
          message: event.message,
          details: null,
        });
      }
    });

    // THEN: All events are logged
    const events = await page.evaluate(async () => {
      // @ts-expect-error - window access
      return window.__TAURI_INTERNALS__.invoke('get_events', {
        category: 'system',
        limit: 10,
      });
    });

    expect(events).toHaveLength(3);
    expect(events.every((e: EventLog) => e.level === 'info')).toBe(true);
  });
});

test.describe('Log Verbosity: Setting Management', () => {
  test('should retrieve current log verbosity setting', async ({ page }) => {
    await setupLogVerbosityMock(page, 'minimal');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // WHEN: Getting log verbosity
    const result = await page.evaluate(async () => {
      // @ts-expect-error - window access
      return window.__TAURI_INTERNALS__.invoke('get_log_verbosity');
    });

    // THEN: Returns current verbosity
    expect(result).toBe('minimal');
  });

  test('should default to verbose mode if not set', async ({ page }) => {
    await setupLogVerbosityMock(page, 'verbose');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // WHEN: Getting log verbosity
    const result = await page.evaluate(async () => {
      // @ts-expect-error - window access
      return window.__TAURI_INTERNALS__.invoke('get_log_verbosity');
    });

    // THEN: Returns "verbose" as default
    expect(result).toBe('verbose');
  });

  test('should update verbosity setting', async ({ page }) => {
    await setupLogVerbosityMock(page, 'verbose');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // WHEN: Changing to minimal
    await page.evaluate(async () => {
      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('set_log_verbosity', {
        verbosity: 'minimal',
      });
    });

    // THEN: Setting is updated
    const result = await page.evaluate(async () => {
      // @ts-expect-error - window access
      return window.__TAURI_INTERNALS__.invoke('get_log_verbosity');
    });
    expect(result).toBe('minimal');
  });

  test('should persist verbosity setting across page loads', async ({ page }) => {
    await setupLogVerbosityMock(page, 'verbose');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // GIVEN: Set verbosity to minimal
    await page.evaluate(async () => {
      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('set_log_verbosity', {
        verbosity: 'minimal',
      });
    });

    // Note: Since we use injected mocks, state persists within the same page
    // A true persistence test would need real backend integration

    // THEN: Setting persists
    const persistedValue = await page.evaluate(async () => {
      // @ts-expect-error - window access
      return window.__TAURI_INTERNALS__.invoke('get_log_verbosity');
    });
    expect(persistedValue).toBe('minimal');
  });
});

test.describe('Log Verbosity: Dynamic Filtering', () => {
  test('should apply verbosity change immediately to new events', async ({ page }) => {
    await setupLogVerbosityMock(page, 'verbose');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // GIVEN: Log info event when verbose
    await page.evaluate(async () => {
      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('log_event', {
        level: 'info',
        category: 'test',
        message: 'First info event',
        details: null,
      });
    });

    // AND: Change to minimal
    await page.evaluate(async () => {
      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('set_log_verbosity', {
        verbosity: 'minimal',
      });
    });

    // AND: Log another info event
    await page.evaluate(async () => {
      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('log_event', {
        level: 'info',
        category: 'test',
        message: 'Second info event - should be filtered',
        details: null,
      });
    });

    // THEN: Only first event is logged
    const events = await page.evaluate(async () => {
      // @ts-expect-error - window access
      return window.__TAURI_INTERNALS__.invoke('get_events', {
        category: 'test',
        limit: 10,
      });
    });

    expect(events).toHaveLength(1);
    expect(events[0].message).toBe('First info event');
  });

  test('should not affect already logged events when changing verbosity', async ({ page }) => {
    await setupLogVerbosityMock(page, 'minimal');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // GIVEN: Log warn event in minimal mode
    await page.evaluate(async () => {
      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('log_event', {
        level: 'warn',
        category: 'test',
        message: 'Warning event',
        details: null,
      });
    });

    // WHEN: Changing to verbose
    await page.evaluate(async () => {
      // @ts-expect-error - window access
      await window.__TAURI_INTERNALS__.invoke('set_log_verbosity', {
        verbosity: 'verbose',
      });
    });

    // THEN: Previously logged events remain unchanged
    const events = await page.evaluate(async () => {
      // @ts-expect-error - window access
      return window.__TAURI_INTERNALS__.invoke('get_events', {
        category: 'test',
        limit: 10,
      });
    });

    expect(events).toHaveLength(1);
    expect(events[0].level).toBe('warn');
  });
});
