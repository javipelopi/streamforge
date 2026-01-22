import { useRef, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { EpgCell } from './EpgCell';
import type { EpgGridChannel, EpgGridProgram } from '../../lib/tauri';
import type { TimeWindow } from '../../hooks/useEpgGridData';

/**
 * Props for EpgGrid component
 */
export interface EpgGridProps {
  /** List of channels with their programs */
  channels: EpgGridChannel[];
  /** Current time window being displayed */
  timeWindow: TimeWindow;
  /** Handler when a program is clicked - includes channel for details panel */
  onProgramClick: (program: EpgGridProgram, channel: EpgGridChannel) => void;
}

// Constants for grid layout - tuned for visual balance and readability
const CHANNEL_COLUMN_WIDTH = 200; // Width for channel logo (40px) + name + padding (increased from 160 for better logo display)
const TIME_SLOT_WIDTH = 120; // Width per 30-minute slot - provides readable time labels
const ROW_HEIGHT = 64; // Height per channel row (increased from 48 to accommodate 40px logos + vertical padding)
const TIME_HEADER_HEIGHT = 44; // Height of time header (increased from 40 for visual balance with taller rows)
const OVERSCAN_COUNT = 5; // Number of extra rows/columns to render for smooth scrolling

/**
 * Generate time slot data for the time header
 */
function generateTimeSlots(timeWindow: TimeWindow): Date[] {
  const slots: Date[] = [];
  const startTime = new Date(timeWindow.startTime);
  const endTime = new Date(timeWindow.endTime);

  // Round start time down to nearest 30 minutes
  startTime.setMinutes(startTime.getMinutes() < 30 ? 0 : 30, 0, 0);

  let currentTime = new Date(startTime);
  while (currentTime < endTime) {
    slots.push(new Date(currentTime));
    currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
  }

  return slots;
}

/**
 * Format time slot for display
 */
function formatTimeSlot(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get time slot test ID
 */
function getTimeSlotTestId(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `epg-time-slot-${hours}${minutes}`;
}

/**
 * Check if a program is currently airing
 */
function isProgramCurrentlyAiring(program: EpgGridProgram, now: Date): boolean {
  const startTime = new Date(program.startTime);
  const endTime = new Date(program.endTime);
  return startTime <= now && endTime > now;
}

/**
 * Calculate left position of a program within the grid based on start time
 */
function getProgramLeftOffset(
  program: EpgGridProgram,
  windowStart: Date
): number {
  const startTime = new Date(program.startTime);
  const diffMinutes = (startTime.getTime() - windowStart.getTime()) / (60 * 1000);
  const slots = diffMinutes / 30;
  return slots * TIME_SLOT_WIDTH;
}

/**
 * EpgGrid component with dual-axis virtualization
 *
 * Story 5.1: EPG Grid Browser with Time Navigation
 * Task 3: Create EPG Grid component with dual-axis virtualization
 * AC #1: Grid with enabled channels, time slots, program cells
 * AC #3: Responsive UI with TanStack Virtual
 *
 * Features:
 * - Vertical virtualization for channels (rows)
 * - Horizontal virtualization for time slots (columns)
 * - Sticky channel name column
 * - Sticky time header row
 * - Program cells with duration-based widths
 * - Currently airing indicator
 * - Smooth scrolling with overscan
 */
export function EpgGrid({ channels, timeWindow, onProgramClick }: EpgGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  // Don't cache 'now' - needs to update for "currently airing" indicator
  // FIXED: Code review issue #3 - memory leak from cached Date object
  const now = new Date();

  // Generate time slots for the current time window
  const timeSlots = useMemo(() => generateTimeSlots(timeWindow), [timeWindow]);

  // Total grid dimensions
  const totalWidth = timeSlots.length * TIME_SLOT_WIDTH;
  const totalHeight = channels.length * ROW_HEIGHT;

  // Round window start to nearest 30 minutes for positioning
  const windowStart = useMemo(() => {
    const start = new Date(timeWindow.startTime);
    start.setMinutes(start.getMinutes() < 30 ? 0 : 30, 0, 0);
    return start;
  }, [timeWindow.startTime]);

  // Vertical virtualizer for channel rows
  const rowVirtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN_COUNT,
  });

  // Horizontal virtualizer for time slots
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: timeSlots.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => TIME_SLOT_WIDTH,
    overscan: OVERSCAN_COUNT,
  });

  // Handle program click - pass channel for details panel
  const handleProgramClick = useCallback(
    (program: EpgGridProgram, channel: EpgGridChannel) => {
      onProgramClick(program, channel);
    },
    [onProgramClick]
  );

  return (
    <div data-testid="epg-grid" className="flex flex-col flex-1 min-h-0">
      {/* Time Header (sticky) */}
      <div
        data-testid="epg-time-header"
        className="flex bg-gray-100 border-b border-gray-300 sticky top-0 z-20"
        style={{ height: TIME_HEADER_HEIGHT }}
      >
        {/* Channel column header */}
        <div
          className="flex items-center justify-center font-semibold text-gray-700 bg-gray-200 border-r border-gray-300 sticky left-0 z-30"
          style={{ width: CHANNEL_COLUMN_WIDTH, minWidth: CHANNEL_COLUMN_WIDTH }}
        >
          Channel
        </div>

        {/* Time slots header (scrollable) */}
        <div
          className="flex overflow-hidden relative"
          style={{ width: `calc(100% - ${CHANNEL_COLUMN_WIDTH}px)` }}
        >
          <div
            className="flex relative"
            style={{ width: totalWidth, minWidth: totalWidth }}
          >
            {columnVirtualizer.getVirtualItems().map((virtualColumn) => {
              const slot = timeSlots[virtualColumn.index];
              return (
                <div
                  key={virtualColumn.key}
                  data-testid={getTimeSlotTestId(slot)}
                  className="absolute flex items-center justify-center text-sm font-medium text-gray-600 border-r border-gray-200"
                  style={{
                    left: virtualColumn.start,
                    width: TIME_SLOT_WIDTH,
                    height: TIME_HEADER_HEIGHT,
                  }}
                >
                  {formatTimeSlot(slot)}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid Container with virtualization */}
      <div
        ref={parentRef}
        data-testid="epg-grid-container"
        className="flex-1 overflow-auto"
        style={{ contain: 'strict', overflow: 'auto' }}
      >
        <div
          className="relative"
          style={{
            height: totalHeight,
            width: totalWidth + CHANNEL_COLUMN_WIDTH,
            minHeight: totalHeight,
            minWidth: totalWidth + CHANNEL_COLUMN_WIDTH,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const channel = channels[virtualRow.index];
            const isEvenRow = virtualRow.index % 2 === 0;

            return (
              <div
                key={virtualRow.key}
                data-testid={`epg-channel-row-${channel.channelId}`}
                className={`absolute flex border-b border-gray-200 ${isEvenRow ? 'bg-white' : 'bg-gray-50'}`}
                style={{
                  top: virtualRow.start,
                  left: 0,
                  height: ROW_HEIGHT,
                  width: totalWidth + CHANNEL_COLUMN_WIDTH,
                }}
              >
                {/* Sticky Channel Name Column */}
                <div
                  data-testid={`epg-channel-name-${channel.channelId}`}
                  className={`flex items-center gap-3 px-3 border-r border-gray-200 sticky left-0 z-10 ${isEvenRow ? 'bg-white' : 'bg-gray-50'}`}
                  style={{
                    width: CHANNEL_COLUMN_WIDTH,
                    minWidth: CHANNEL_COLUMN_WIDTH,
                  }}
                >
                  {channel.channelIcon ? (
                    <img
                      src={channel.channelIcon}
                      alt=""
                      className="w-10 h-10 object-contain rounded flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-400 text-xs font-medium">TV</span>
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {channel.channelName}
                  </span>
                </div>

                {/* Program Cells */}
                <div
                  className="flex items-center relative"
                  style={{ width: totalWidth }}
                >
                  {channel.programs.map((program) => {
                    const leftOffset = getProgramLeftOffset(program, windowStart);
                    const isAiring = isProgramCurrentlyAiring(program, now);

                    return (
                      <div
                        key={program.id}
                        className="absolute"
                        style={{
                          left: leftOffset,
                          top: '8px',
                          height: ROW_HEIGHT - 16,
                        }}
                      >
                        <EpgCell
                          program={program}
                          slotWidth={TIME_SLOT_WIDTH}
                          onClick={() => handleProgramClick(program, channel)}
                          isCurrentlyAiring={isAiring}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
