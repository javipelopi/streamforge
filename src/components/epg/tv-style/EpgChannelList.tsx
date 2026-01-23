/**
 * EPG TV-Style Channel List
 * Story 5.5: EPG Channel List Panel
 *
 * Virtualized list of enabled channels with current program information.
 * Uses TanStack Virtual for efficient rendering with large channel counts.
 * Supports remote-control navigation with arrow keys.
 */

import { useRef, useCallback, useEffect, forwardRef, useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { EpgChannelRow } from './EpgChannelRow';
import { useEpgChannelList } from '../../../hooks/useEpgChannelList';
import { useListNavigation } from '../../../hooks/useListNavigation';

interface EpgChannelListProps {
  /** Currently selected channel ID */
  selectedChannelId?: number | null;
  /** Callback when a channel is selected */
  onSelectChannel?: (channelId: number) => void;
  /** Callback when navigating up from top channel (to header) */
  onNavigateUp?: () => void;
  /** Callback when navigating right (to schedule panel) */
  onNavigateRight?: () => void;
  /** Callback when navigating left (close details) */
  onNavigateLeft?: () => void;
}

/**
 * EpgChannelList - Virtualized channel list with current program display
 *
 * AC #1: Displays virtualized list of enabled XMLTV channels
 * AC #2: Supports channel selection via click or keyboard
 * AC #3: Remains responsive with large channel counts (<100ms)
 * AC #4: Remote-control navigation (up to header, right to schedule, left closes details)
 */
export const EpgChannelList = forwardRef<HTMLDivElement, EpgChannelListProps>(
  function EpgChannelList(
    { selectedChannelId, onSelectChannel, onNavigateUp, onNavigateRight, onNavigateLeft },
    forwardedRef
  ) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Combine local ref with forwarded ref
  const setRefs = useCallback(
    (element: HTMLDivElement | null) => {
      // Set local ref
      (parentRef as React.MutableRefObject<HTMLDivElement | null>).current = element;
      // Set forwarded ref
      if (typeof forwardedRef === 'function') {
        forwardedRef(element);
      } else if (forwardedRef) {
        forwardedRef.current = element;
      }
    },
    [forwardedRef]
  );
  const { channels, isLoading, error } = useEpgChannelList();

  // Auto-select first channel when channels load and none is selected
  useEffect(() => {
    if (channels.length > 0 && selectedChannelId === null && onSelectChannel) {
      onSelectChannel(channels[0].channelId);
    }
  }, [channels, selectedChannelId, onSelectChannel]);

  // TanStack Virtual setup for efficient list rendering
  const virtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 96, // Estimated row height in pixels
    overscan: 5, // Render 5 extra items above/below viewport
  });

  // Memoize scroll strategy to avoid recreating on every render
  const scrollStrategy = useMemo(() => ({
    type: 'virtualizer' as const,
    virtualizer,
  }), [virtualizer]);

  // Handle channel selection for the navigation hook
  const handleSelect = useCallback((channelId: number) => {
    onSelectChannel?.(channelId);
  }, [onSelectChannel]);

  // Use list navigation hook for ArrowUp/Down handling
  const { handleArrowUp, handleArrowDown } = useListNavigation({
    items: channels,
    selectedId: selectedChannelId ?? null,
    getId: (ch) => ch.channelId,
    onSelect: handleSelect,
    scrollStrategy,
    onBoundaryUp: onNavigateUp,
  });

  // Handle keyboard navigation (AC #2, AC #4)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleArrowDown();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleArrowUp();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        // Navigate to schedule panel
        e.preventDefault();
        onNavigateRight?.();
      } else if (e.key === 'ArrowLeft') {
        // Close details panel
        e.preventDefault();
        onNavigateLeft?.();
      }
    },
    [handleArrowDown, handleArrowUp, onNavigateRight, onNavigateLeft]
  );

  // Handle channel click - ensures focus stays on container for keyboard nav
  const handleChannelClick = useCallback(
    (channelId: number) => {
      onSelectChannel?.(channelId);
      // Refocus container after click to keep keyboard nav working
      parentRef.current?.focus();
    },
    [onSelectChannel]
  );

  // Loading state - skeleton UI matching channel row layout for TV-style polish
  if (isLoading) {
    return (
      <div
        ref={setRefs}
        data-testid="epg-channel-list"
        className="h-full p-2 flex flex-col gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {/* Render 5 skeleton rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/5 animate-pulse"
          >
            {/* Logo skeleton */}
            <div className="flex-shrink-0 w-20 h-[60px] rounded bg-white/10" />
            {/* Content skeleton */}
            <div className="flex-1 space-y-2">
              {/* Channel name + time */}
              <div className="flex items-center gap-3">
                <div className="h-4 w-32 bg-white/10 rounded" />
                <div className="h-3 w-24 bg-white/10 rounded" />
              </div>
              {/* Program title */}
              <div className="h-3 w-48 bg-white/10 rounded" />
              {/* Progress bar */}
              <div className="h-[3px] w-full bg-white/10 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state - user-friendly messages per architecture.md Error Handling Strategy
  if (error) {
    // Map technical errors to user-friendly messages
    const getUserFriendlyError = (err: string): { title: string; message: string } => {
      if (err.toLowerCase().includes('network') || err.toLowerCase().includes('fetch')) {
        return {
          title: 'Connection Error',
          message: 'Unable to load channels. Check your network connection.',
        };
      }
      if (err.toLowerCase().includes('database') || err.toLowerCase().includes('sql')) {
        return {
          title: 'Database Error',
          message: 'Unable to access channel data. Try restarting the app.',
        };
      }
      return {
        title: 'Error Loading Channels',
        message: 'An unexpected error occurred. Please try again.',
      };
    };

    const friendlyError = getUserFriendlyError(error);

    return (
      <div
        ref={setRefs}
        data-testid="epg-channel-list"
        className="h-full flex flex-col items-center justify-center p-4 text-center gap-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <svg
          className="w-12 h-12 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <div>
          <p className="text-red-400 text-sm font-medium mb-1">{friendlyError.title}</p>
          <p className="text-white/60 text-xs">{friendlyError.message}</p>
        </div>
      </div>
    );
  }

  // Empty state (AC #1 - edge case)
  if (channels.length === 0) {
    return (
      <div
        ref={setRefs}
        data-testid="epg-channel-list-empty"
        className="h-full flex flex-col items-center justify-center p-4 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <svg
          className="w-12 h-12 text-white/30 mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z"
          />
        </svg>
        <p className="text-white/70 text-sm font-medium mb-1">
          No channels in lineup
        </p>
        <p className="text-white/50 text-xs">
          Add channels from Sources
        </p>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  // Calculate active descendant ID for accessibility
  const activeDescendantId = selectedChannelId
    ? `channel-row-${selectedChannelId}`
    : undefined;

  return (
    <div
      ref={setRefs}
      data-testid="epg-channel-list"
      className="h-full overflow-y-auto focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="listbox"
      aria-label="Channel list"
      aria-activedescendant={activeDescendantId}
    >
      {/* Virtualized list container */}
      <div
        className="relative w-full"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {/* Virtualized items */}
        {virtualItems.length > 0 && (
          <div
            className="absolute top-0 left-0 w-full flex flex-col gap-2 p-2"
            style={{
              transform: `translateY(${virtualItems[0].start}px)`,
            }}
          >
            {virtualItems.map((virtualItem) => {
              const channel = channels[virtualItem.index];
              return (
                <EpgChannelRow
                  key={channel.channelId}
                  channel={channel}
                  isSelected={selectedChannelId === channel.channelId}
                  onClick={() => handleChannelClick(channel.channelId)}
                  data-index={virtualItem.index}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
