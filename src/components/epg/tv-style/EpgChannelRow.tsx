/**
 * EPG TV-Style Channel Row
 * Story 5.5: EPG Channel List Panel
 *
 * Individual channel row displaying logo, name, current program info, and progress bar.
 */

import { memo } from 'react';
import { EpgProgressBar } from './EpgProgressBar';
import type { EpgChannelListItem } from '../../../hooks/useEpgChannelList';

interface EpgChannelRowProps {
  /** Channel data with current program */
  channel: EpgChannelListItem;
  /** Whether this channel is selected */
  isSelected?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Data index for virtualization */
  'data-index'?: number;
}

/**
 * Format time for display (e.g., "7:30 PM")
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Calculate progress percentage
 */
function calculateProgress(startTime: string, endTime: string): number {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (now < start) return 0; // Program hasn't started
  if (now > end) return 100; // Program has ended

  const elapsed = now.getTime() - start.getTime();
  const duration = end.getTime() - start.getTime();
  return (elapsed / duration) * 100;
}

/**
 * EpgChannelRow - Individual channel row with program info
 *
 * Visual Design Requirements (from ux-epg-tv-guide.md):
 * - Channel logo: 80×60px, object-fit: contain, rounded 4px
 * - Channel name: bold, white, 14-16px
 * - Time range: light gray #a0a0a0
 * - Program title: white, 14px, single line with ellipsis
 * - Row padding: 12px vertical, 16px horizontal
 * - Gap between rows: 8px (handled by parent)
 */
export const EpgChannelRow = memo(function EpgChannelRow({
  channel,
  isSelected = false,
  onClick,
  'data-index': dataIndex,
}: EpgChannelRowProps) {
  const currentProgram = channel.currentProgram;
  const hasProgram = !!currentProgram;

  // Format time range if program exists
  const timeRange = hasProgram
    ? `${formatTime(currentProgram.startTime)} - ${formatTime(currentProgram.endTime)}`
    : '';

  // Calculate progress if program exists
  const progress = hasProgram
    ? calculateProgress(currentProgram.startTime, currentProgram.endTime)
    : 0;

  return (
    <div
      data-testid={`channel-row-${channel.channelId}`}
      data-index={dataIndex}
      role="option"
      aria-selected={isSelected}
      onClick={onClick}
      className={`
        flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer
        transition-colors duration-150
        ${
          isSelected
            ? 'bg-indigo-500/20 border border-white/30'
            : 'bg-transparent border border-transparent hover:bg-white/5'
        }
      `}
    >
      {/* Channel Logo (80×60px) */}
      <div
        data-testid="channel-logo"
        className="flex-shrink-0 w-20 h-[60px] flex items-center justify-center overflow-hidden"
      >
        {channel.channelIcon ? (
          <img
            src={channel.channelIcon}
            alt={`${channel.channelName} logo`}
            className="w-full h-full object-contain"
          />
        ) : (
          // Placeholder for missing logo - show first letter
          <span className="text-2xl font-bold text-white/50">
            {channel.channelName.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Channel Info */}
      <div className="flex-1 min-w-0">
        {/* Row 1: Time range */}
        {hasProgram && (
          <div className="mb-1">
            <span
              data-testid="program-time-range"
              className="text-xs text-[#a0a0a0]"
            >
              {timeRange}
            </span>
          </div>
        )}

        {/* Row 2: Program title */}
        <div className="mb-2">
          <span
            data-testid="program-title"
            className="text-sm text-white truncate block"
          >
            {hasProgram ? currentProgram.title : 'No program info available'}
          </span>
        </div>

        {/* Row 3: Progress bar (only if program exists) */}
        {hasProgram && <EpgProgressBar percent={progress} />}
      </div>
    </div>
  );
});
