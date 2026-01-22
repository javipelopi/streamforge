/**
 * EPG TV-Style Channel List
 * Story 5.5: EPG Channel List Panel
 *
 * Virtualized list of enabled channels with current program information.
 * Uses TanStack Virtual for efficient rendering with large channel counts.
 */

import { useRef, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { EpgChannelRow } from './EpgChannelRow';
import { useEpgChannelList } from '../../../hooks/useEpgChannelList';

interface EpgChannelListProps {
  /** Currently selected channel ID */
  selectedChannelId?: number | null;
  /** Callback when a channel is selected */
  onSelectChannel?: (channelId: number) => void;
}

/**
 * EpgChannelList - Virtualized channel list with current program display
 *
 * AC #1: Displays virtualized list of enabled XMLTV channels
 * AC #2: Supports channel selection via click or keyboard
 * AC #3: Remains responsive with large channel counts (<100ms)
 */
export function EpgChannelList({
  selectedChannelId,
  onSelectChannel,
}: EpgChannelListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { channels, isLoading, error } = useEpgChannelList();

  // TanStack Virtual setup for efficient list rendering
  const virtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 96, // Estimated row height in pixels
    overscan: 5, // Render 5 extra items above/below viewport
  });

  // Handle keyboard navigation (AC #2)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!onSelectChannel || channels.length === 0) return;

      const currentIndex = selectedChannelId
        ? channels.findIndex((ch) => ch.channelId === selectedChannelId)
        : -1;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = currentIndex < channels.length - 1 ? currentIndex + 1 : currentIndex;
        if (nextIndex !== currentIndex || currentIndex === -1) {
          const nextChannel = channels[nextIndex === -1 ? 0 : nextIndex];
          onSelectChannel(nextChannel.channelId);
          // Scroll to keep selected item visible
          virtualizer.scrollToIndex(nextIndex === -1 ? 0 : nextIndex, { align: 'auto' });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        if (prevIndex !== currentIndex) {
          onSelectChannel(channels[prevIndex].channelId);
          virtualizer.scrollToIndex(prevIndex, { align: 'auto' });
        }
      }
    },
    [channels, selectedChannelId, onSelectChannel, virtualizer]
  );

  // Handle channel click
  const handleChannelClick = useCallback(
    (channelId: number) => {
      onSelectChannel?.(channelId);
    },
    [onSelectChannel]
  );

  // Loading state
  if (isLoading) {
    return (
      <div
        data-testid="epg-channel-list"
        className="h-full flex items-center justify-center"
      >
        <div className="text-white/50 text-sm">Loading channels...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        data-testid="epg-channel-list"
        className="h-full flex items-center justify-center p-4"
      >
        <div className="text-red-400 text-sm text-center">{error}</div>
      </div>
    );
  }

  // Empty state (AC #1 - edge case)
  if (channels.length === 0) {
    return (
      <div
        data-testid="epg-channel-list-empty"
        className="h-full flex flex-col items-center justify-center p-4 text-center"
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

  return (
    <div
      ref={parentRef}
      data-testid="epg-channel-list"
      className="h-full overflow-y-auto focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="listbox"
      aria-label="Channel list"
    >
      {/* Virtualized list container */}
      <div
        className="relative w-full"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {/* Virtualized items */}
        <div
          className="absolute top-0 left-0 w-full flex flex-col gap-2 p-2"
          style={{
            transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
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
      </div>
    </div>
  );
}
