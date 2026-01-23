/**
 * EPG TV-Style Schedule Header
 * Story 5.6: EPG Schedule Panel
 *
 * Displays the current date in the format "DAY DD Mon" (e.g., "TUE 21 Jan")
 */

import { useMemo } from 'react';

/**
 * Format date for header display (e.g., "TUE 21 Jan")
 * @param date - Date to format (defaults to today)
 * @returns Formatted date string
 */
function formatDateHeader(date: Date = new Date()): string {
  const day = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dayNum = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  return `${day} ${dayNum} ${month}`;
}

interface ScheduleHeaderProps {
  /** Optional date to display (defaults to today) */
  date?: Date;
}

/**
 * ScheduleHeader - Date header for schedule panel
 *
 * AC #1: Display date in format "DAY DD Mon" (e.g., "TUE 21 Jan")
 * Style: bold, white, 16px, center-aligned, padding 16px vertical
 */
export function ScheduleHeader({ date }: ScheduleHeaderProps) {
  const formattedDate = useMemo(() => formatDateHeader(date), [date]);

  return (
    <div
      data-testid="schedule-header"
      className="px-4 py-4 text-center border-b border-white/10"
    >
      <span className="text-white font-bold text-base">
        {formattedDate}
      </span>
    </div>
  );
}
