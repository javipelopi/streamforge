/**
 * Target Lineup Channel Row Component
 * Story 3-9: Implement Target Lineup View
 *
 * A single channel row for the Target Lineup view with drag-drop support.
 */
import { memo, useCallback, DragEvent } from 'react';
import * as Switch from '@radix-ui/react-switch';
import { GripVertical, AlertTriangle, FileText } from 'lucide-react';
import type { VirtualItem } from '@tanstack/react-virtual';
import type { TargetLineupChannel } from '../../lib/tauri';

interface TargetLineupChannelRowProps {
  channel: TargetLineupChannel;
  virtualItem: VirtualItem;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: (channelId: number) => void;
  onDragOver: (channelId: number) => void;
  onDragEnd: () => void;
  onDrop: (targetChannelId: number) => void;
  onToggleEnabled: () => void;
}

export const TargetLineupChannelRow = memo(function TargetLineupChannelRow({
  channel,
  virtualItem,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onToggleEnabled,
}: TargetLineupChannelRowProps) {
  const hasStreams = channel.streamCount > 0;

  const style = {
    transform: `translateY(${virtualItem.start}px)`,
    height: `${virtualItem.size}px`,
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
  };

  // HTML5 drag event handlers
  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData('text/plain', String(channel.id));
      e.dataTransfer.effectAllowed = 'move';
      onDragStart(channel.id);
    },
    [channel.id, onDragStart]
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      onDragOver(channel.id);
    },
    [channel.id, onDragOver]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      onDrop(channel.id);
    },
    [channel.id, onDrop]
  );

  return (
    <div
      data-testid={`target-lineup-channel-${channel.id}`}
      data-channel-id={channel.id}
      data-dragging={isDragging ? 'true' : undefined}
      data-drop-target={isDropTarget ? 'true' : undefined}
      role="option"
      aria-selected={false}
      className={`${isDragging ? 'opacity-50 z-20 shadow-lg' : ''} ${
        isDropTarget ? 'border-t-2 border-blue-500' : ''
      }`}
      style={style}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        className={`border-b border-gray-200 ${
          hasStreams ? 'bg-white hover:bg-gray-50' : 'bg-amber-50 hover:bg-amber-100'
        }`}
      >
        <div className="flex items-center gap-3 p-3">
          {/* Drag handle */}
          <div
            data-testid={`channel-drag-handle-${channel.id}`}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={onDragEnd}
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-200 flex-shrink-0 touch-none"
            aria-label={`Drag to reorder ${channel.displayName}`}
            role="button"
            tabIndex={0}
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>

          {/* Channel position/number */}
          <span className="text-sm text-gray-400 w-8 text-right flex-shrink-0">
            {virtualItem.index + 1}
          </span>

          {/* Channel Logo */}
          {channel.icon ? (
            <img
              data-testid={`channel-logo-${channel.id}`}
              src={channel.icon}
              alt=""
              className="w-10 h-10 rounded object-cover flex-shrink-0"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div
              data-testid={`channel-logo-${channel.id}`}
              className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center flex-shrink-0"
            >
              <FileText className="w-5 h-5 text-gray-400" />
            </div>
          )}

          {/* Channel Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span data-testid={`channel-name-${channel.id}`} className="font-medium text-gray-900 truncate">
                {channel.displayName}
              </span>

              {/* Synthetic badge */}
              {channel.isSynthetic && (
                <span
                  data-testid={`synthetic-badge-${channel.id}`}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800"
                  title="Synthetic channel"
                >
                  Synthetic
                </span>
              )}
            </div>

            {/* Stream count / warning */}
            <div className="text-sm text-gray-500">
              {hasStreams ? (
                <span>
                  {channel.streamCount} stream{channel.streamCount !== 1 ? 's' : ''}
                </span>
              ) : (
                <span className="text-amber-600">No video source</span>
              )}
            </div>
          </div>

          {/* No stream warning badge with icon */}
          {!hasStreams && (
            <span
              data-testid={`no-stream-warning-${channel.id}`}
              title="This channel has no video source"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700"
            >
              <AlertTriangle className="w-4 h-4" />
              No stream
            </span>
          )}

          {/* Enable/disable toggle */}
          <Switch.Root
            data-testid={`channel-toggle-${channel.id}`}
            checked={channel.isEnabled}
            onCheckedChange={onToggleEnabled}
            className="w-10 h-6 bg-gray-200 rounded-full relative data-[state=checked]:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label={`Toggle channel ${channel.displayName}`}
          >
            <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-sm transition-transform translate-x-0.5 data-[state=checked]:translate-x-[18px]" />
          </Switch.Root>
        </div>
      </div>
    </div>
  );
});
