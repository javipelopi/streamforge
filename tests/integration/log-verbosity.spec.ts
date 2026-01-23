import { test, expect } from '@playwright/test';

/**
 * Integration Tests for Story 6-3: Log Verbosity System
 *
 * Test Level: Integration (Tauri commands + database)
 * Framework: Playwright Test
 * Focus: Log verbosity filtering (minimal vs verbose mode)
 *
 * These tests use page.evaluate() to invoke Tauri commands from the browser context.
 *
 * Run with: TAURI_DEV=true pnpm test -- tests/integration/log-verbosity.spec.ts
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

// Helper to invoke Tauri commands from page context
async function invokeCommand<T>(page: any, command: string, args?: Record<string, unknown>): Promise<T> {
  return page.evaluate(
    async ({ cmd, cmdArgs }: { cmd: string; cmdArgs?: Record<string, unknown> }) => {
      // The Tauri API uses __TAURI_INTERNALS__ internally
      // @ts-expect-error - __TAURI_INTERNALS__ exists in browser context when running in Tauri
      if (window.__TAURI_INTERNALS__) {
        // @ts-expect-error - access internal invoke
        return window.__TAURI_INTERNALS__.invoke(cmd, cmdArgs);
      }
      throw new Error('Tauri runtime not available. Run with TAURI_DEV=true');
    },
    { cmd: command, cmdArgs: args }
  );
}

test.describe('Log Verbosity: Minimal Mode (AC #3)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app first to ensure Tauri context is available
    await page.goto('/');
    // Clear old events before each test
    await invokeCommand(page, 'clear_old_events', { keep_count: 0 });
  });

  test('AC #3: should filter info events when verbosity is minimal', async ({ page }) => {
    // GIVEN: Log verbosity is set to "minimal"
    await invokeCommand(page, 'set_log_verbosity', { verbosity: 'minimal' });

    // WHEN: Logging events at different levels
    await invokeCommand(page, 'log_event', {
      level: 'info',
      category: 'system',
      message: 'Info event - should be filtered',
      details: null,
    });

    await invokeCommand(page, 'log_event', {
      level: 'warn',
      category: 'stream',
      message: 'Warning event - should be logged',
      details: null,
    });

    await invokeCommand(page, 'log_event', {
      level: 'error',
      category: 'connection',
      message: 'Error event - should be logged',
      details: null,
    });

    // THEN: Only warn and error events are logged
    const events = await invokeCommand<EventLog[]>(page, 'get_events', { limit: 10 });

    // Should have 2 events (warn and error), NOT the info event
    expect(events).toHaveLength(2);
    expect(events[0].level).toBe('error');
    expect(events[1].level).toBe('warn');

    // Verify info event was NOT logged
    const hasInfoEvent = events.some((e) => e.level === 'info');
    expect(hasInfoEvent).toBe(false);
  });

  test('should not log info level connection events in minimal mode', async ({ page }) => {
    // GIVEN: Log verbosity is minimal
    await invokeCommand(page, 'set_log_verbosity', { verbosity: 'minimal' });

    // WHEN: Connection success occurs (info level)
    await invokeCommand(page, 'log_event', {
      level: 'info',
      category: 'connection',
      message: 'Connection successful',
      details: JSON.stringify({ accountId: 1, serverUrl: 'http://test.com' }),
    });

    // THEN: Event is not logged
    const events = await invokeCommand<EventLog[]>(page, 'get_events', {
      category: 'connection',
      limit: 10,
    });

    expect(events).toHaveLength(0);
  });

  test('should not log info level stream events in minimal mode', async ({ page }) => {
    // GIVEN: Log verbosity is minimal
    await invokeCommand(page, 'set_log_verbosity', { verbosity: 'minimal' });

    // WHEN: Stream start/stop occurs (info level)
    await invokeCommand(page, 'log_event', {
      level: 'info',
      category: 'stream',
      message: 'Stream started',
      details: JSON.stringify({ channelName: 'Test Channel', quality: 'HD' }),
    });

    await invokeCommand(page, 'log_event', {
      level: 'info',
      category: 'stream',
      message: 'Stream stopped',
      details: null,
    });

    // THEN: Events are not logged
    const events = await invokeCommand<EventLog[]>(page, 'get_events', {
      category: 'stream',
      limit: 10,
    });

    expect(events).toHaveLength(0);
  });

  test('should still log warn and error stream events in minimal mode', async ({ page }) => {
    // GIVEN: Log verbosity is minimal
    await invokeCommand(page, 'set_log_verbosity', { verbosity: 'minimal' });

    // WHEN: Stream failover (warn) and failure (error) occur
    await invokeCommand(page, 'log_event', {
      level: 'warn',
      category: 'stream',
      message: 'Stream failover',
      details: JSON.stringify({ failoverCount: 1 }),
    });

    await invokeCommand(page, 'log_event', {
      level: 'error',
      category: 'stream',
      message: 'Stream failed',
      details: JSON.stringify({ error: 'All sources exhausted' }),
    });

    // THEN: Both warn and error events are logged
    const events = await invokeCommand<EventLog[]>(page, 'get_events', {
      category: 'stream',
      limit: 10,
    });

    expect(events).toHaveLength(2);
    expect(events[0].level).toBe('error');
    expect(events[1].level).toBe('warn');
  });
});

test.describe('Log Verbosity: Verbose Mode (AC #4)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await invokeCommand(page, 'clear_old_events', { keep_count: 0 });
  });

  test('AC #4: should log all events including info when verbosity is verbose', async ({ page }) => {
    // GIVEN: Log verbosity is set to "verbose"
    await invokeCommand(page, 'set_log_verbosity', { verbosity: 'verbose' });

    // WHEN: Logging events at all levels
    await invokeCommand(page, 'log_event', {
      level: 'info',
      category: 'system',
      message: 'Info event - should be logged',
      details: null,
    });

    await invokeCommand(page, 'log_event', {
      level: 'warn',
      category: 'stream',
      message: 'Warning event - should be logged',
      details: null,
    });

    await invokeCommand(page, 'log_event', {
      level: 'error',
      category: 'connection',
      message: 'Error event - should be logged',
      details: null,
    });

    // THEN: All events are logged
    const events = await invokeCommand<EventLog[]>(page, 'get_events', { limit: 10 });

    expect(events).toHaveLength(3);

    const levels = events.map((e) => e.level);
    expect(levels).toContain('info');
    expect(levels).toContain('warn');
    expect(levels).toContain('error');
  });

  test('should log info level connection events in verbose mode', async ({ page }) => {
    // GIVEN: Log verbosity is verbose
    await invokeCommand(page, 'set_log_verbosity', { verbosity: 'verbose' });

    // WHEN: Connection success occurs
    await invokeCommand(page, 'log_event', {
      level: 'info',
      category: 'connection',
      message: 'Connection successful: Test Account',
      details: JSON.stringify({ accountId: 1, serverUrl: 'http://test.com' }),
    });

    // THEN: Event is logged
    const events = await invokeCommand<EventLog[]>(page, 'get_events', {
      category: 'connection',
      limit: 10,
    });

    expect(events).toHaveLength(1);
    expect(events[0].level).toBe('info');
    expect(events[0].message).toContain('Connection successful');
  });

  test('should log info level EPG events in verbose mode', async ({ page }) => {
    // GIVEN: Log verbosity is verbose
    await invokeCommand(page, 'set_log_verbosity', { verbosity: 'verbose' });

    // WHEN: EPG refresh completes
    await invokeCommand(page, 'log_event', {
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

    // THEN: Event is logged
    const events = await invokeCommand<EventLog[]>(page, 'get_events', {
      category: 'epg',
      limit: 10,
    });

    expect(events).toHaveLength(1);
    expect(events[0].level).toBe('info');
    expect(events[0].message).toContain('EPG refresh completed');

    const details = JSON.parse(events[0].details!);
    expect(details.channelCount).toBe(100);
    expect(details.programCount).toBe(5000);
  });

  test('should log all system lifecycle events in verbose mode', async ({ page }) => {
    // GIVEN: Log verbosity is verbose
    await invokeCommand(page, 'set_log_verbosity', { verbosity: 'verbose' });

    // WHEN: System lifecycle events occur
    const systemEvents = [
      { message: 'Application started', category: 'system' },
      { message: 'Server restarted', category: 'system' },
      { message: 'Configuration changed', category: 'system' },
    ];

    for (const event of systemEvents) {
      await invokeCommand(page, 'log_event', {
        level: 'info',
        category: event.category,
        message: event.message,
        details: null,
      });
    }

    // THEN: All events are logged
    const events = await invokeCommand<EventLog[]>(page, 'get_events', {
      category: 'system',
      limit: 10,
    });

    expect(events).toHaveLength(3);
    expect(events.every((e) => e.level === 'info')).toBe(true);
  });
});

test.describe('Log Verbosity: Setting Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should retrieve current log verbosity setting', async ({ page }) => {
    // GIVEN: Log verbosity has been set
    await invokeCommand(page, 'set_log_verbosity', { verbosity: 'minimal' });

    // WHEN: Getting log verbosity
    const result = await invokeCommand<string>(page, 'get_log_verbosity');

    // THEN: Returns current verbosity
    expect(result).toBe('minimal');
  });

  test('should default to verbose mode if not set', async ({ page }) => {
    // GIVEN: Reset to default by setting verbose
    await invokeCommand(page, 'set_log_verbosity', { verbosity: 'verbose' });

    // WHEN: Getting log verbosity
    const result = await invokeCommand<string>(page, 'get_log_verbosity');

    // THEN: Returns "verbose" as default
    expect(result).toBe('verbose');
  });

  test('should update verbosity setting', async ({ page }) => {
    // GIVEN: Verbosity is verbose
    await invokeCommand(page, 'set_log_verbosity', { verbosity: 'verbose' });

    // WHEN: Changing to minimal
    await invokeCommand(page, 'set_log_verbosity', { verbosity: 'minimal' });

    // THEN: Setting is updated
    const result = await invokeCommand<string>(page, 'get_log_verbosity');
    expect(result).toBe('minimal');
  });

  test('should persist verbosity setting across sessions', async ({ page }) => {
    // GIVEN: Verbosity is set to minimal
    await invokeCommand(page, 'set_log_verbosity', { verbosity: 'minimal' });

    // WHEN: Simulating app restart (reload page)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // THEN: Setting persists
    const persistedValue = await invokeCommand<string>(page, 'get_log_verbosity');
    expect(persistedValue).toBe('minimal');
  });
});

test.describe('Log Verbosity: Dynamic Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await invokeCommand(page, 'clear_old_events', { keep_count: 0 });
  });

  test('should apply verbosity change immediately to new events', async ({ page }) => {
    // GIVEN: Verbosity is verbose
    await invokeCommand(page, 'set_log_verbosity', { verbosity: 'verbose' });

    // WHEN: Logging info event
    await invokeCommand(page, 'log_event', {
      level: 'info',
      category: 'test',
      message: 'First info event',
      details: null,
    });

    // AND: Changing to minimal
    await invokeCommand(page, 'set_log_verbosity', { verbosity: 'minimal' });

    // AND: Logging another info event
    await invokeCommand(page, 'log_event', {
      level: 'info',
      category: 'test',
      message: 'Second info event - should be filtered',
      details: null,
    });

    // THEN: Only first event is logged
    const events = await invokeCommand<EventLog[]>(page, 'get_events', {
      category: 'test',
      limit: 10,
    });

    expect(events).toHaveLength(1);
    expect(events[0].message).toBe('First info event');
  });

  test('should not affect already logged events when changing verbosity', async ({ page }) => {
    // GIVEN: Verbosity is minimal with some warn/error events
    await invokeCommand(page, 'set_log_verbosity', { verbosity: 'minimal' });

    await invokeCommand(page, 'log_event', {
      level: 'warn',
      category: 'test',
      message: 'Warning event',
      details: null,
    });

    // WHEN: Changing to verbose
    await invokeCommand(page, 'set_log_verbosity', { verbosity: 'verbose' });

    // THEN: Previously logged events remain unchanged
    const events = await invokeCommand<EventLog[]>(page, 'get_events', {
      category: 'test',
      limit: 10,
    });

    expect(events).toHaveLength(1);
    expect(events[0].level).toBe('warn');
  });
});
