import { useRef, useState, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { XmltvChannelWithMappings, XtreamStreamMatch } from '../../lib/tauri';
import { XmltvChannelRow } from './XmltvChannelRow';
import { MatchedStreamsList } from './MatchedStreamsList';

interface XmltvChannelsListProps {
  channels: XmltvChannelWithMappings[];
  isLoading: boolean;
  onToggleChannel: (channelId: number) => void;
  onSetPrimaryStream: (xmltvChannelId: number, xtreamChannelId: number) => Promise<XtreamStreamMatch[]>;
}

// Row heights for virtualization
const COLLAPSED_ROW_HEIGHT = 72;
const EXPANDED_STREAM_HEIGHT = 44;
const EXPANDED_HEADER_HEIGHT = 16; // Padding for expanded section

/**
 * XmltvChannelsList component displays a virtualized list of XMLTV channels
 * Uses TanStack Virtual for efficient rendering of large lists (1000+ channels)
 *
 * Story 3-2: Display XMLTV Channel List with Match Status
 */
export function XmltvChannelsList({
  channels,
  isLoading,
  onToggleChannel,
  onSetPrimaryStream,
}: XmltvChannelsListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [updatingChannels, setUpdatingChannels] = useState<Set<number>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Calculate row height based on expanded state
  const getRowHeight = useCallback(
    (index: number) => {
      const channel = channels[index];
      if (!channel) return COLLAPSED_ROW_HEIGHT;

      if (expandedRows.has(channel.id)) {
        const matchCount = channel.matches.length;
        return (
          COLLAPSED_ROW_HEIGHT +
          EXPANDED_HEADER_HEIGHT +
          matchCount * EXPANDED_STREAM_HEIGHT
        );
      }
      return COLLAPSED_ROW_HEIGHT;
    },
    [channels, expandedRows]
  );

  const virtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: getRowHeight,
    overscan: 5,
  });

  // Recalculate sizes when expanded rows change
  useEffect(() => {
    virtualizer.measure();
  }, [expandedRows, virtualizer]);

  // Handle expand/collapse
  const handleToggleExpand = useCallback((channelId: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  }, []);

  // Handle make primary
  const handleMakePrimary = useCallback(
    async (xmltvChannelId: number, xtreamChannelId: number) => {
      setUpdatingChannels((prev) => new Set(prev).add(xmltvChannelId));
      try {
        await onSetPrimaryStream(xmltvChannelId, xtreamChannelId);
      } finally {
        setUpdatingChannels((prev) => {
          const next = new Set(prev);
          next.delete(xmltvChannelId);
          return next;
        });
      }
    },
    [onSetPrimaryStream]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (channels.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, channels.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < channels.length) {
            const channel = channels[focusedIndex];
            if (channel.matchCount > 0) {
              handleToggleExpand(channel.id);
            }
          }
          break;
        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setFocusedIndex(channels.length - 1);
          break;
      }
    },
    [channels, focusedIndex, handleToggleExpand]
  );

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0) {
      virtualizer.scrollToIndex(focusedIndex, { align: 'auto' });
    }
  }, [focusedIndex, virtualizer]);

  // Loading state
  if (isLoading) {
    return (
      <div
        data-testid="xmltv-channels-list"
        className="flex items-center justify-center h-64 text-gray-500"
      >
        <span className="animate-pulse">Loading XMLTV channels...</span>
      </div>
    );
  }

  // Empty state
  if (channels.length === 0) {
    return (
      <div
        data-testid="xmltv-channels-list"
        className="flex flex-col items-center justify-center h-64 text-gray-500"
      >
        <p className="text-lg">No XMLTV channels found</p>
        <p className="text-sm mt-1">
          Add an EPG source and refresh to see channels
        </p>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      data-testid="xmltv-channels-list"
      role="listbox"
      aria-label="XMLTV Channels"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="h-[500px] overflow-auto focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
    >
      <div
        className="relative w-full"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualItems.map((virtualItem) => {
          const channel = channels[virtualItem.index];
          const isExpanded = expandedRows.has(channel.id);
          const isUpdating = updatingChannels.has(channel.id);
          const isFocused = focusedIndex === virtualItem.index;

          const hasMatches = channel.matchCount > 0;
          const warningClass = !hasMatches ? 'warning bg-amber-50' : '';

          return (
            <div
              key={channel.id}
              data-testid={`channel-row-${channel.id}`}
              data-index={virtualItem.index}
              role="option"
              aria-expanded={isExpanded}
              aria-selected={isFocused}
              className={`absolute top-0 left-0 w-full ${warningClass} ${isFocused ? 'ring-2 ring-blue-500 ring-inset z-10' : ''}`}
              style={{
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <XmltvChannelRow
                channel={channel}
                isExpanded={isExpanded}
                onToggleExpand={() => handleToggleExpand(channel.id)}
                onToggleEnabled={() => onToggleChannel(channel.id)}
              />

              {/* Expanded matched streams */}
              {isExpanded && channel.matches.length > 0 && (
                <MatchedStreamsList
                  matches={channel.matches}
                  onMakePrimary={(xtreamId) => handleMakePrimary(channel.id, xtreamId)}
                  isUpdating={isUpdating}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
