/**
 * EPG TV-Style Schedule Row
 * Story 5.6: EPG Schedule Panel
 *
 * Individual program row with time column, title, and NOW/PAST/FUTURE styling.
 */

import { forwardRef, memo } from 'react';
import type { ScheduleProgram } from '../../../hooks/useChannelSchedule';

interface ScheduleRowProps {
  /** Program data */
  program: ScheduleProgram;
  /** Whether this program is selected */
  isSelected?: boolean;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Format time for display (e.g., "8:00 AM")
 * @param isoString - ISO 8601 time string
 * @returns Formatted time string
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
 * ScheduleRow - Individual program row in schedule
 *
 * Visual Design (from ux-epg-tv-guide.md):
 * - Two-column layout: time (~80px fixed) + title (flex-grow)
 * - Time format: "HH:MM AM/PM" in light gray (#a0a0a0)
 * - Program title: white, 14px, single line with ellipsis on overflow
 * - Row hover: subtle highlight rgba(255,255,255,0.05)
 * - Selected: brighter background + left purple accent bar (4px, #6366f1)
 * - NOW indicator: distinct badge (green #22c55e)
 * - Past programs: muted styling (reduced opacity or grayed text)
 */
export const ScheduleRow = memo(
  forwardRef<HTMLDivElement, ScheduleRowProps>(function ScheduleRow(
    { program, isSelected = false, onClick },
    ref
  ) {
    const isPast = program.status === 'PAST';
    const isNow = program.status === 'NOW';

    // Determine text color based on status
    const titleColorClass = isPast ? 'text-[#6b7280]' : 'text-white';
    const timeColorClass = isPast ? 'text-[#6b7280]/70' : 'text-[#a0a0a0]';

    // Selected state styling
    const selectedClasses = isSelected
      ? 'bg-indigo-500/20 border-l-4 border-l-indigo-500'
      : 'border-l-4 border-l-transparent hover:bg-white/5';

    return (
      <div
        ref={ref}
        id={`schedule-row-${program.id}`}
        data-testid={`schedule-row-${program.id}`}
        role="option"
        aria-selected={isSelected}
        onClick={onClick}
        className={`
          flex items-center gap-4 py-3 px-3 cursor-pointer
          transition-colors duration-150
          ${selectedClasses}
        `}
      >
        {/* Time column (~80px fixed width) */}
        <div
          data-testid="program-time"
          className={`w-20 flex-shrink-0 text-sm ${timeColorClass}`}
        >
          {formatTime(program.startTime)}
        </div>

        {/* Program title with NOW indicator */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span
            data-testid="program-title"
            className={`text-sm truncate ${titleColorClass}`}
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {program.title}
          </span>

          {/* NOW indicator badge */}
          {isNow && (
            <span
              data-testid="now-indicator"
              className="flex-shrink-0 px-2 py-0.5 text-xs font-semibold bg-green-500 text-white rounded"
            >
              NOW
            </span>
          )}
        </div>
      </div>
    );
  })
);
