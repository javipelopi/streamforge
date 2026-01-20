/**
 * Target Lineup Channel Row Component
 * Story 3-9: Implement Target Lineup View
 *
 * A single channel row for the Target Lineup view with position input for reordering.
 */
import { memo, useState, useCallback, useEffect, KeyboardEvent } from 'react';
import { AlertTriangle, FileText, Trash2 } from 'lucide-react';
import type { VirtualItem } from '@tanstack/react-virtual';
import type { TargetLineupChannel } from '../../lib/tauri';

interface TargetLineupChannelRowProps {
  channel: TargetLineupChannel;
  virtualItem: VirtualItem;
  totalChannels: number;
  onMoveToPosition: (channelId: number, newPosition: number) => void;
  onToggleEnabled: () => void;
}

export const TargetLineupChannelRow = memo(function TargetLineupChannelRow({
  channel,
  virtualItem,
  totalChannels,
  onMoveToPosition,
  onToggleEnabled,
}: TargetLineupChannelRowProps) {
  const hasStreams = channel.streamCount > 0;
  const currentPosition = virtualItem.index + 1;

  // Local state for the position input
  const [inputValue, setInputValue] = useState(String(currentPosition));
  const [isEditing, setIsEditing] = useState(false);

  const style = {
    transform: `translateY(${virtualItem.start}px)`,
    height: `${virtualItem.size}px`,
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
  };

  // Handle position change submission
  const handlePositionSubmit = useCallback(() => {
    const newPosition = parseInt(inputValue, 10);

    // Validate the input
    if (isNaN(newPosition) || newPosition < 1 || newPosition > totalChannels) {
      // Reset to current position if invalid
      setInputValue(String(currentPosition));
      setIsEditing(false);
      return;
    }

    // Only move if position actually changed
    if (newPosition !== currentPosition) {
      onMoveToPosition(channel.id, newPosition);
    }

    setIsEditing(false);
  }, [inputValue, currentPosition, totalChannels, channel.id, onMoveToPosition]);

  // Handle Enter key to submit
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handlePositionSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setInputValue(String(currentPosition));
        setIsEditing(false);
      }
    },
    [handlePositionSubmit, currentPosition]
  );

  // Handle blur to submit
  const handleBlur = useCallback(() => {
    handlePositionSubmit();
  }, [handlePositionSubmit]);

  // Handle focus to select all text
  const handleFocus = useCallback(() => {
    setIsEditing(true);
  }, []);

  // Update input value when currentPosition changes (after reorder)
  // Using useEffect to avoid state update during render
  useEffect(() => {
    if (!isEditing) {
      setInputValue(String(currentPosition));
    }
  }, [currentPosition, isEditing]);

  return (
    <div
      data-testid={`target-lineup-channel-${channel.id}`}
      data-channel-id={channel.id}
      role="option"
      aria-selected={false}
      style={style}
    >
      <div
        className={`border-b border-gray-200 ${
          hasStreams ? 'bg-white hover:bg-gray-50' : 'bg-amber-50 hover:bg-amber-100'
        }`}
      >
        <div className="flex items-center gap-3 p-3">
          {/* Position input */}
          <input
            data-testid={`channel-position-input-${channel.id}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onFocus={handleFocus}
            className="w-12 h-8 text-center text-sm font-medium text-gray-600 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label={`Position of ${channel.displayName}, currently ${currentPosition}`}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
          />

          {/* Channel Logo */}
          {channel.icon ? (
            <img
              data-testid={`channel-logo-${channel.id}`}
              src={channel.icon}
              alt=""
              className="w-10 h-10 rounded object-contain flex-shrink-0"
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

          {/* Remove from lineup button */}
          <button
            data-testid={`channel-remove-${channel.id}`}
            type="button"
            onClick={onToggleEnabled}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            aria-label={`Remove ${channel.displayName} from lineup`}
            title="Remove from lineup"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
});
