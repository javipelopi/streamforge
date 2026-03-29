import { invoke } from './invoke';

// ============================================================================
// Event Logging types and functions (Story 3-4)
// ============================================================================

/** Event log level */
export type EventLevel = 'info' | 'warn' | 'error';

/** Event log category */
export type EventCategory = 'connection' | 'stream' | 'match' | 'epg' | 'system' | 'provider';

/** Event log entry */
export interface EventLogEntry {
  id: number;
  timestamp: string;
  level: EventLevel;
  category: string;
  message: string;
  details: string | null;
  isRead: boolean;
}

/** Event log response */
export interface EventLogResponse {
  events: EventLogEntry[];
  totalCount: number;
  unreadCount: number;
}

/** Log event input */
export interface LogEventInput {
  level: EventLevel;
  category: string;
  message: string;
  details?: string;
}

/**
 * Log an event to the database
 * @param level - Event level: "info", "warn", or "error"
 * @param category - Event category
 * @param message - Human-readable message
 * @param details - Optional JSON string with additional details
 * @returns The created event log entry
 */
export async function logEvent(
  level: EventLevel,
  category: string,
  message: string,
  details?: string
): Promise<EventLogEntry> {
  return invoke<EventLogEntry>('log_event', { level, category, message, details });
}

/**
 * Get events from the event log
 * @param options - Query options (limit, offset, filters)
 * @returns Event log response with events and counts
 */
export async function getEvents(options?: {
  limit?: number;
  offset?: number;
  level?: EventLevel;
  category?: string;
  unreadOnly?: boolean;
  createdAfter?: string;  // Story 6-4 AC #5: ISO 8601 date string
  createdBefore?: string; // Story 6-4 AC #5: ISO 8601 date string
}): Promise<EventLogResponse> {
  return invoke<EventLogResponse>('get_events', {
    limit: options?.limit,
    offset: options?.offset,
    level: options?.level,
    category: options?.category,
    unreadOnly: options?.unreadOnly,
    createdAfter: options?.createdAfter,
    createdBefore: options?.createdBefore,
  });
}

/**
 * Get the count of unread events
 * @returns Number of unread events
 */
export async function getUnreadEventCount(): Promise<number> {
  return invoke<number>('get_unread_event_count');
}

/**
 * Mark an event as read
 * @param eventId - Event ID to mark as read
 */
export async function markEventRead(eventId: number): Promise<void> {
  return invoke<void>('mark_event_read', { eventId });
}

/**
 * Mark all events as read
 * @returns Number of events marked as read
 */
export async function markAllEventsRead(): Promise<number> {
  return invoke<number>('mark_all_events_read');
}

/**
 * Clear old events, keeping only the most recent ones
 * @param keepCount - Number of recent events to keep (default 1000)
 * @returns Number of events deleted
 */
export async function clearOldEvents(keepCount?: number): Promise<number> {
  return invoke<number>('clear_old_events', { keepCount });
}

/**
 * Get level badge color classes
 * @param level - Event level
 * @returns Tailwind CSS classes for the badge
 */
export function getEventLevelClasses(level: EventLevel): string {
  switch (level) {
    case 'error':
      return 'bg-red-100 text-red-800';
    case 'warn':
      return 'bg-yellow-100 text-yellow-800';
    case 'info':
    default:
      return 'bg-blue-100 text-blue-800';
  }
}

/**
 * Get level icon name
 * @param level - Event level
 * @returns Icon name for the level
 */
export function getEventLevelIcon(level: EventLevel): string {
  switch (level) {
    case 'error':
      return 'exclamation-circle';
    case 'warn':
      return 'exclamation-triangle';
    case 'info':
    default:
      return 'information-circle';
  }
}

/**
 * Parse event details JSON
 * @param details - JSON string or null
 * @returns Parsed object or null
 */
export function parseEventDetails<T = Record<string, unknown>>(details: string | null): T | null {
  if (!details) return null;
  try {
    return JSON.parse(details) as T;
  } catch {
    return null;
  }
}
