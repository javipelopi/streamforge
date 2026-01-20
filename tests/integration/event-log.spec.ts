import { test, expect } from '@playwright/test';
import {
  createEventLog,
  createProviderEvent,
  createInfoEvent,
  createWarnEvent,
  createErrorEvent,
} from '../support/factories/event-log.factory';

/**
 * Integration Tests for Event Logging System (Story 3-4, AC5)
 *
 * Test Level: Integration (Tauri commands + database)
 * Framework: Playwright Test
 * Focus: Event logging, retrieval, pagination, read status
 *
 * RED PHASE: These tests MUST fail initially (missing implementation)
 * Expected failures: event_log table missing, commands not registered
 *
 * Run with: TAURI_DEV=true pnpm test -- tests/integration/event-log.spec.ts
 */

test.describe('Event Logging System: Log Creation (AC5.1)', () => {
  test('AC5.1: should log provider change events with details', async () => {
    // GIVEN: Provider scan detects changes
    const changeSummary = {
      newStreams: 5,
      removedStreams: 2,
      changedStreams: 3,
      affectedXmltvChannels: 8,
    };

    // WHEN: Event is logged
    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('log_event', {
      level: 'info',
      category: 'provider',
      message: 'Provider changes detected: 5 new, 2 removed, 3 changed',
      details: JSON.stringify(changeSummary),
    });

    // THEN: Event is stored in database
    // @ts-expect-error - Command does not exist yet (RED phase)
    const events = await window.__TAURI__.invoke('get_events', {
      category: 'provider',
      limit: 10,
    });

    expect(events).toHaveLength(1);
    expect(events[0].level).toBe('info');
    expect(events[0].category).toBe('provider');
    expect(events[0].message).toContain('5 new, 2 removed, 3 changed');

    const details = JSON.parse(events[0].details);
    expect(details.newStreams).toBe(5);
    expect(details.removedStreams).toBe(2);

    // Expected failure: Error: no such table: event_log
  });

  test('should log events with different severity levels', async () => {
    // GIVEN: Different event types occur
    const testEvents = [
      {
        level: 'info',
        category: 'system',
        message: 'Application started',
      },
      {
        level: 'warn',
        category: 'provider',
        message: 'Stream quality degraded',
      },
      {
        level: 'error',
        category: 'connection',
        message: 'Failed to connect to IPTV provider',
      },
    ];

    // WHEN: Events are logged
    for (const event of testEvents) {
      // @ts-expect-error - Command does not exist yet (RED phase)
      await window.__TAURI__.invoke('log_event', event);
    }

    // THEN: All events are stored with correct levels
    // @ts-expect-error - Command does not exist yet (RED phase)
    const allEvents = await window.__TAURI__.invoke('get_events', {
      limit: 10,
    });

    expect(allEvents).toHaveLength(3);

    const levels = allEvents.map((e: any) => e.level);
    expect(levels).toContain('info');
    expect(levels).toContain('warn');
    expect(levels).toContain('error');

    // Expected failure: Error: no such table: event_log
  });

  test('should log events with timestamp in correct format', async () => {
    // GIVEN: Event is created
    const beforeLog = new Date().toISOString();

    // WHEN: Event is logged
    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('log_event', {
      level: 'info',
      category: 'test',
      message: 'Test event',
    });

    const afterLog = new Date().toISOString();

    // THEN: Timestamp is within expected range
    // @ts-expect-error - Command does not exist yet (RED phase)
    const events = await window.__TAURI__.invoke('get_events', {
      limit: 1,
    });

    expect(events).toHaveLength(1);
    expect(events[0].timestamp).toBeDefined();

    const eventTime = new Date(events[0].timestamp).getTime();
    const beforeTime = new Date(beforeLog).getTime();
    const afterTime = new Date(afterLog).getTime();

    expect(eventTime).toBeGreaterThanOrEqual(beforeTime);
    expect(eventTime).toBeLessThanOrEqual(afterTime + 1000); // 1 second tolerance

    // Expected failure: Error: no such table: event_log
  });
});

test.describe('Event Logging System: Event Retrieval (AC5.2)', () => {
  test('AC5.2: should retrieve events with pagination', async () => {
    // GIVEN: Multiple events exist
    const eventCount = 25;
    for (let i = 1; i <= eventCount; i++) {
      // @ts-expect-error - Command does not exist yet (RED phase)
      await window.__TAURI__.invoke('log_event', {
        level: 'info',
        category: 'test',
        message: `Event ${i}`,
      });
    }

    // WHEN: Retrieving first page
    // @ts-expect-error - Command does not exist yet (RED phase)
    const page1 = await window.__TAURI__.invoke('get_events', {
      limit: 10,
      offset: 0,
    });

    // THEN: First page has 10 events
    expect(page1).toHaveLength(10);

    // WHEN: Retrieving second page
    // @ts-expect-error - Command does not exist yet (RED phase)
    const page2 = await window.__TAURI__.invoke('get_events', {
      limit: 10,
      offset: 10,
    });

    // THEN: Second page has 10 events
    expect(page2).toHaveLength(10);

    // WHEN: Retrieving third page
    // @ts-expect-error - Command does not exist yet (RED phase)
    const page3 = await window.__TAURI__.invoke('get_events', {
      limit: 10,
      offset: 20,
    });

    // THEN: Third page has remaining 5 events
    expect(page3).toHaveLength(5);

    // Events should not overlap
    const allIds = [...page1, ...page2, ...page3].map((e: any) => e.id);
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(eventCount);

    // Expected failure: Error: Unknown command: get_events
  });

  test('should filter events by level', async () => {
    // GIVEN: Events with different levels
    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('log_event', {
      level: 'info',
      category: 'test',
      message: 'Info event',
    });

    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('log_event', {
      level: 'warn',
      category: 'test',
      message: 'Warning event',
    });

    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('log_event', {
      level: 'error',
      category: 'test',
      message: 'Error event',
    });

    // WHEN: Filtering by level
    // @ts-expect-error - Command does not exist yet (RED phase)
    const errorEvents = await window.__TAURI__.invoke('get_events', {
      level: 'error',
    });

    // THEN: Only error events returned
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0].level).toBe('error');
    expect(errorEvents[0].message).toBe('Error event');

    // Expected failure: Error: Unknown command: get_events
  });

  test('should filter events by category', async () => {
    // GIVEN: Events with different categories
    const categories = ['provider', 'connection', 'stream', 'system'];

    for (const category of categories) {
      // @ts-expect-error - Command does not exist yet (RED phase)
      await window.__TAURI__.invoke('log_event', {
        level: 'info',
        category,
        message: `${category} event`,
      });
    }

    // WHEN: Filtering by category
    // @ts-expect-error - Command does not exist yet (RED phase)
    const providerEvents = await window.__TAURI__.invoke('get_events', {
      category: 'provider',
    });

    // THEN: Only provider events returned
    expect(providerEvents).toHaveLength(1);
    expect(providerEvents[0].category).toBe('provider');

    // Expected failure: Error: Unknown command: get_events
  });

  test('should return events in descending timestamp order (newest first)', async () => {
    // GIVEN: Events created over time
    const eventMessages = ['First', 'Second', 'Third'];

    for (const message of eventMessages) {
      // @ts-expect-error - Command does not exist yet (RED phase)
      await window.__TAURI__.invoke('log_event', {
        level: 'info',
        category: 'test',
        message,
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // WHEN: Retrieving events
    // @ts-expect-error - Command does not exist yet (RED phase)
    const events = await window.__TAURI__.invoke('get_events', {
      limit: 10,
    });

    // THEN: Events are in reverse chronological order
    expect(events[0].message).toBe('Third'); // Newest
    expect(events[1].message).toBe('Second');
    expect(events[2].message).toBe('First'); // Oldest

    // Expected failure: Error: Unknown command: get_events
  });
});

test.describe('Event Logging System: Unread Count (AC5.3)', () => {
  test('AC5.3: should track unread event count', async () => {
    // GIVEN: No unread events initially
    // @ts-expect-error - Command does not exist yet (RED phase)
    const initialCount = await window.__TAURI__.invoke('get_unread_event_count');
    expect(initialCount).toBe(0);

    // WHEN: New events are logged
    for (let i = 1; i <= 5; i++) {
      // @ts-expect-error - Command does not exist yet (RED phase)
      await window.__TAURI__.invoke('log_event', {
        level: 'info',
        category: 'test',
        message: `Unread event ${i}`,
      });
    }

    // THEN: Unread count increments
    // @ts-expect-error - Command does not exist yet (RED phase)
    const updatedCount = await window.__TAURI__.invoke('get_unread_event_count');
    expect(updatedCount).toBe(5);

    // Expected failure: Error: Unknown command: get_unread_event_count
  });

  test('should only count unread events', async () => {
    // GIVEN: Mix of read and unread events
    // Create 3 unread events
    for (let i = 1; i <= 3; i++) {
      // @ts-expect-error - Command does not exist yet (RED phase)
      await window.__TAURI__.invoke('log_event', {
        level: 'info',
        category: 'test',
        message: `Unread ${i}`,
      });
    }

    // Get event IDs and mark some as read
    // @ts-expect-error - Command does not exist yet (RED phase)
    const events = await window.__TAURI__.invoke('get_events', { limit: 3 });
    const firstEventId = events[0].id;

    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('mark_events_read', {
      eventIds: [firstEventId],
    });

    // WHEN: Checking unread count
    // @ts-expect-error - Command does not exist yet (RED phase)
    const unreadCount = await window.__TAURI__.invoke('get_unread_event_count');

    // THEN: Only unread events counted
    expect(unreadCount).toBe(2); // 3 created - 1 marked read

    // Expected failure: Error: Unknown command: get_unread_event_count
  });
});

test.describe('Event Logging System: Mark Events Read (AC5.4)', () => {
  test('AC5.4: should mark single event as read', async () => {
    // GIVEN: Unread event exists
    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('log_event', {
      level: 'info',
      category: 'test',
      message: 'Test event',
    });

    // @ts-expect-error - Command does not exist yet (RED phase)
    const events = await window.__TAURI__.invoke('get_events', { limit: 1 });
    const eventId = events[0].id;

    expect(events[0].is_read).toBe(false);

    // WHEN: Marking event as read
    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('mark_events_read', {
      eventIds: [eventId],
    });

    // THEN: Event is marked as read
    // @ts-expect-error - Command does not exist yet (RED phase)
    const updatedEvents = await window.__TAURI__.invoke('get_events', { limit: 1 });
    expect(updatedEvents[0].is_read).toBe(true);

    // Expected failure: Error: Unknown command: mark_events_read
  });

  test('should mark multiple events as read', async () => {
    // GIVEN: Multiple unread events
    const eventIds: number[] = [];

    for (let i = 1; i <= 5; i++) {
      // @ts-expect-error - Command does not exist yet (RED phase)
      await window.__TAURI__.invoke('log_event', {
        level: 'info',
        category: 'test',
        message: `Event ${i}`,
      });
    }

    // @ts-expect-error - Command does not exist yet (RED phase)
    const events = await window.__TAURI__.invoke('get_events', { limit: 5 });
    eventIds.push(...events.slice(0, 3).map((e: any) => e.id));

    // WHEN: Marking multiple events as read
    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('mark_events_read', {
      eventIds,
    });

    // THEN: Selected events are marked as read
    // @ts-expect-error - Command does not exist yet (RED phase)
    const unreadCount = await window.__TAURI__.invoke('get_unread_event_count');
    expect(unreadCount).toBe(2); // 5 total - 3 marked read

    // Expected failure: Error: Unknown command: mark_events_read
  });

  test('should mark all events as read when no IDs provided', async () => {
    // GIVEN: Multiple unread events
    for (let i = 1; i <= 10; i++) {
      // @ts-expect-error - Command does not exist yet (RED phase)
      await window.__TAURI__.invoke('log_event', {
        level: 'info',
        category: 'test',
        message: `Event ${i}`,
      });
    }

    // @ts-expect-error - Command does not exist yet (RED phase)
    const initialCount = await window.__TAURI__.invoke('get_unread_event_count');
    expect(initialCount).toBe(10);

    // WHEN: Marking all events as read (no specific IDs)
    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('mark_events_read', {
      eventIds: null, // or undefined - mark ALL
    });

    // THEN: All events are marked as read
    // @ts-expect-error - Command does not exist yet (RED phase)
    const finalCount = await window.__TAURI__.invoke('get_unread_event_count');
    expect(finalCount).toBe(0);

    // Expected failure: Error: Unknown command: mark_events_read
  });
});

test.describe('Event Logging System: Integration with Auto-Rematch', () => {
  test('should automatically log event when rematch completes', async () => {
    // GIVEN: Clean event log
    // WHEN: Running scan and rematch
    // @ts-expect-error - Command does not exist yet (RED phase)
    await window.__TAURI__.invoke('scan_and_rematch_channels', {
      accountId: 1,
    });

    // THEN: Event is automatically logged
    // @ts-expect-error - Command does not exist yet (RED phase)
    const events = await window.__TAURI__.invoke('get_events', {
      category: 'provider',
      limit: 1,
    });

    expect(events).toHaveLength(1);
    expect(events[0].category).toBe('provider');
    expect(events[0].message).toContain('Provider changes');

    // Verify details contain change summary
    const details = JSON.parse(events[0].details);
    expect(details).toHaveProperty('newStreams');
    expect(details).toHaveProperty('removedStreams');
    expect(details).toHaveProperty('changedStreams');

    // Expected failure: Error: Unknown command: scan_and_rematch_channels
  });
});
