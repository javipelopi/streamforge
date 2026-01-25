/**
 * Logs View - Event Log Display and Management
 * Story 3-4: Auto-rematch on provider changes
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ReloadIcon,
  CheckCircledIcon,
  InfoCircledIcon,
  ExclamationTriangleIcon,
  CrossCircledIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import {
  getEvents,
  markEventRead,
  markAllEventsRead,
  clearOldEvents,
  parseEventDetails,
  type EventLogEntry,
  type EventLevel,
} from '../lib/tauri';

/**
 * Get icon for event level
 */
function EventLevelIcon({ level }: { level: EventLevel }) {
  switch (level) {
    case 'error':
      return <CrossCircledIcon className="w-5 h-5 text-red-500" />;
    case 'warn':
      return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
    case 'info':
    default:
      return <InfoCircledIcon className="w-5 h-5 text-blue-500" />;
  }
}

/**
 * Get badge classes for event level
 */
function getLevelBadgeClasses(level: EventLevel): string {
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
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diff / (1000 * 60));
    const diffHours = Math.floor(diff / (1000 * 60 * 60));
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

/**
 * Event item component
 */
function EventItem({
  event,
  onMarkRead,
}: {
  event: EventLogEntry;
  onMarkRead: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const details = parseEventDetails(event.details);

  return (
    <div
      data-testid="event-item"
      className={`p-4 border rounded-lg transition-colors ${
        event.isRead ? 'bg-white border-gray-200' : 'bg-blue-50 border-blue-200'
      }`}
      onClick={() => {
        if (!event.isRead && event.id) {
          onMarkRead(event.id);
        }
      }}
    >
      <div className="flex items-start gap-3">
        <EventLevelIcon level={event.level as EventLevel} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getLevelBadgeClasses(
                event.level as EventLevel
              )}`}
            >
              {event.level}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
              {event.category}
            </span>
            <span className="text-xs text-gray-500">{formatTimestamp(event.timestamp)}</span>
            {!event.isRead && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500 text-white">
                New
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-900">{event.message}</p>
          {details && (
            <button
              className="mt-2 text-xs text-blue-600 hover:text-blue-800"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? 'Hide details' : 'Show details'}
            </button>
          )}
          {expanded && details && (
            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
              {JSON.stringify(details, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

export function Logs() {
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<{
    level?: EventLevel;
    category?: string;
    unreadOnly: boolean;
    startDate?: string;  // Story 6-4 AC #5: Date range filter
    endDate?: string;    // Story 6-4 AC #5: Date range filter
  }>({ unreadOnly: false });

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getEvents({
        limit: 100,
        level: filter.level,
        category: filter.category,
        unreadOnly: filter.unreadOnly,
        createdAfter: filter.startDate,
        createdBefore: filter.endDate,
      });
      setEvents(response.events);
      setTotalCount(response.totalCount);
      setUnreadCount(response.unreadCount);
    } catch (err) {
      console.error('Failed to load events:', err);
      setError('Failed to load events. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Story 6-4 AC #3: Auto-mark all events as read when Logs view is opened
  // Refs to track if auto-mark has been triggered this mount
  const hasAutoMarked = useRef(false);

  useEffect(() => {
    // Only auto-mark once per mount, and only after loading completes with unread events
    if (hasAutoMarked.current || isLoading) {
      return;
    }

    // Only proceed if there are actually unread events
    if (unreadCount === 0) {
      return;
    }

    const autoMarkRead = async () => {
      try {
        hasAutoMarked.current = true;
        await markAllEventsRead();
        setUnreadCount(0);
        // Update local state to reflect marked-as-read
        setEvents((prev) => prev.map((e) => ({ ...e, isRead: true })));
      } catch (err) {
        console.error('Failed to auto-mark events as read:', err);
        hasAutoMarked.current = false; // Allow retry on error
      }
    };

    // Small delay (500ms) to ensure user sees events before marking read
    const timer = setTimeout(autoMarkRead, 500);
    return () => clearTimeout(timer);
  }, [isLoading]); // FIXED: Only trigger when loading state changes to prevent race conditions

  const handleMarkRead = async (eventId: number) => {
    try {
      await markEventRead(eventId);
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, isRead: true } : e))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark event as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllEventsRead();
      setEvents((prev) => prev.map((e) => ({ ...e, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all events as read:', err);
      setError('Failed to mark all as read. Please try again.');
    }
  };

  const handleClearOld = async () => {
    if (!confirm('This will delete all but the most recent 100 events. Continue?')) {
      return;
    }
    try {
      const deleted = await clearOldEvents(100);
      if (deleted > 0) {
        loadEvents();
      }
    } catch (err) {
      console.error('Failed to clear old events:', err);
      setError('Failed to clear old events. Please try again.');
    }
  };

  return (
    <div data-testid="logs-view" className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Logs</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500 text-white">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadEvents}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
          >
            <ReloadIcon className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
            >
              <CheckCircledIcon className="w-4 h-4 mr-1.5" />
              Mark All Read
            </button>
          )}
          <button
            onClick={handleClearOld}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
            title="Keep only the most recent 100 events"
          >
            <TrashIcon className="w-4 h-4 mr-1.5" />
            Clear Old
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filter.level || ''}
          onChange={(e) => setFilter((prev) => ({ ...prev, level: e.target.value as EventLevel || undefined }))}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
        >
          <option value="">All Levels</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>
        <select
          value={filter.category || ''}
          onChange={(e) => setFilter((prev) => ({ ...prev, category: e.target.value || undefined }))}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
        >
          <option value="">All Categories</option>
          <option value="connection">Connection</option>
          <option value="stream">Stream</option>
          <option value="match">Match</option>
          <option value="epg">EPG</option>
          <option value="system">System</option>
          <option value="provider">Provider</option>
        </select>
        <label className="inline-flex items-center px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white cursor-pointer">
          <input
            type="checkbox"
            checked={filter.unreadOnly}
            onChange={(e) => setFilter((prev) => ({ ...prev, unreadOnly: e.target.checked }))}
            className="mr-2"
          />
          Unread only
        </label>
        {/* Story 6-4 AC #5: Date Range Filter */}
        <div className="flex items-center gap-1">
          <span className="text-sm text-gray-500">From:</span>
          <input
            type="date"
            value={filter.startDate || ''}
            onChange={(e) => setFilter((prev) => ({ ...prev, startDate: e.target.value || undefined }))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm text-gray-500">To:</span>
          <input
            type="date"
            value={filter.endDate || ''}
            onChange={(e) => setFilter((prev) => ({ ...prev, endDate: e.target.value || undefined }))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          />
        </div>
        <span className="ml-auto text-sm text-gray-500">
          Showing {events.length} of {totalCount} events
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {/* Events List */}
      {isLoading && events.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <ReloadIcon className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading events...
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <InfoCircledIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-lg">No events found</p>
          <p className="text-sm mt-1">
            {filter.level || filter.category || filter.unreadOnly
              ? 'Try adjusting your filters'
              : 'Events will appear here when provider changes are detected'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <EventItem key={event.id} event={event} onMarkRead={handleMarkRead} />
          ))}
        </div>
      )}
    </div>
  );
}
