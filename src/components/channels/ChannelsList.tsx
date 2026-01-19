import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Channel } from '../../lib/tauri';

interface ChannelsListProps {
  accountId: number;
  channels: Channel[];
  isLoading: boolean;
}

/**
 * Quality badge styling based on quality tier
 */
function getQualityBadgeClasses(quality: string): string {
  switch (quality.toUpperCase()) {
    case '4K':
      return 'bg-purple-100 text-purple-800';
    case 'FHD':
      return 'bg-blue-100 text-blue-800';
    case 'HD':
      return 'bg-green-100 text-green-800';
    case 'SD':
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * ChannelsList component displays a virtualized list of channels
 * Uses TanStack Virtual for efficient rendering of large lists
 *
 * Story 2-3: Retrieve and store channel list from Xtream
 */
export function ChannelsList({ channels, isLoading }: ChannelsListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Estimated height of each row
    overscan: 5,
  });

  // Loading state
  if (isLoading) {
    return (
      <div
        data-testid="channels-list-container"
        className="flex items-center justify-center h-64 text-gray-500"
      >
        <span className="animate-pulse">Loading channels...</span>
      </div>
    );
  }

  // Empty state
  if (channels.length === 0) {
    return (
      <div
        data-testid="channels-list-container"
        className="flex flex-col items-center justify-center h-64 text-gray-500"
      >
        <p className="text-lg">No channels found</p>
        <p className="text-sm mt-1">
          Use &quot;Scan Channels&quot; on your account to fetch channels
        </p>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      data-testid="channels-list-container"
      className="h-[500px] overflow-auto"
    >
      <ul
        role="list"
        className="relative w-full"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualItems.map((virtualItem) => {
          const channel = channels[virtualItem.index];

          return (
            <li
              key={channel.id}
              data-testid="channel-list-item"
              data-index={virtualItem.index}
              className="absolute top-0 left-0 w-full"
              style={{
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className="flex items-center gap-3 p-3 border-b border-gray-100 hover:bg-gray-50">
                {/* Channel Logo */}
                {channel.streamIcon && (
                  <img
                    src={channel.streamIcon}
                    alt=""
                    className="w-10 h-10 rounded object-cover flex-shrink-0"
                    loading="lazy"
                  />
                )}

                {/* Channel Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">
                      {channel.name}
                    </span>

                    {/* Quality Badges */}
                    {channel.qualities.map((quality, idx) => (
                      <span
                        key={idx}
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getQualityBadgeClasses(quality)}`}
                      >
                        {quality}
                      </span>
                    ))}
                  </div>

                  {/* Category */}
                  {channel.categoryName && (
                    <span className="text-sm text-gray-500">
                      {channel.categoryName}
                    </span>
                  )}
                </div>

                {/* TV Archive indicator */}
                {channel.tvArchive && (
                  <span
                    className="text-xs text-gray-400"
                    title={`${channel.tvArchiveDuration} days catchup`}
                  >
                    DVR
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
