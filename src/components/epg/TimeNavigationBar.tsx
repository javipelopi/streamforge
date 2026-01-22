import { useMemo } from 'react';
import type { TimeWindow } from '../../hooks/useEpgGridData';

/**
 * Props for TimeNavigationBar component
 */
export interface TimeNavigationBarProps {
  /** Current time window being displayed */
  timeWindow: TimeWindow;
  /** Handler for "Now" button - jump to current time */
  onNow: () => void;
  /** Handler for "Tonight" button - jump to 7 PM prime time */
  onTonight: () => void;
  /** Handler for "Tomorrow" button - jump to tomorrow morning */
  onTomorrow: () => void;
  /** Handler for previous day navigation */
  onPrevDay: () => void;
  /** Handler for next day navigation */
  onNextDay: () => void;
  /** Handler for date picker change */
  onDateChange: (date: Date) => void;
}

/**
 * TimeNavigationBar component for EPG grid time navigation
 *
 * Story 5.1: EPG Grid Browser with Time Navigation
 * Task 2: Create time navigation state and controls
 * AC #2: Time navigation controls (Now, Tonight, Tomorrow, +/- day, date picker)
 *
 * Features:
 * - "Now" button: Centers grid on current time
 * - "Tonight" button: Jumps to 7 PM prime time
 * - "Tomorrow" button: Jumps to tomorrow morning
 * - +/- day navigation arrows
 * - Date picker for up to 7 days ahead
 * - Current date/time display
 */
export function TimeNavigationBar({
  timeWindow,
  onNow,
  onTonight,
  onTomorrow,
  onPrevDay,
  onNextDay,
  onDateChange,
}: TimeNavigationBarProps) {
  // Calculate date picker min/max values
  const { minDate, maxDate, currentDateValue } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDateValue = new Date(today);
    maxDateValue.setDate(maxDateValue.getDate() + 7);

    // Format as YYYY-MM-DD for input[type="date"] - use local date to avoid timezone issues
    const formatDateForInput = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      minDate: formatDateForInput(today),
      maxDate: formatDateForInput(maxDateValue),
      currentDateValue: formatDateForInput(timeWindow.startTime),
    };
  }, [timeWindow.startTime]);

  // Format current date display
  const currentDateDisplay = useMemo(() => {
    return timeWindow.startTime.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [timeWindow.startTime]);

  // Handle date picker change
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = new Date(e.target.value + 'T00:00:00');
    if (!isNaN(selectedDate.getTime())) {
      // Set to 6 AM of selected date
      selectedDate.setHours(6, 0, 0, 0);
      onDateChange(selectedDate);
    }
  };

  return (
    <div
      data-testid="time-navigation-bar"
      className="flex items-center gap-2 p-3 bg-white border-b border-gray-200"
    >
      {/* Quick Navigation Buttons */}
      <div className="flex items-center gap-1">
        <button
          data-testid="time-nav-now-button"
          onClick={onNow}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          title="Jump to current time"
        >
          Now
        </button>
        <button
          data-testid="time-nav-tonight-button"
          onClick={onTonight}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          title="Jump to tonight's prime time (7 PM)"
        >
          Tonight
        </button>
        <button
          data-testid="time-nav-tomorrow-button"
          onClick={onTomorrow}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          title="Jump to tomorrow morning"
        >
          Tomorrow
        </button>
      </div>

      {/* Day Navigation Arrows */}
      <div className="flex items-center gap-1 ml-2">
        <button
          data-testid="time-nav-prev-day-button"
          onClick={onPrevDay}
          className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          title="Previous day"
          aria-label="Previous day"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <button
          data-testid="time-nav-next-day-button"
          onClick={onNextDay}
          className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          title="Next day"
          aria-label="Next day"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Current Date Display */}
      <div
        data-testid="time-nav-current-date-display"
        className="ml-3 px-3 py-1.5 text-sm font-medium text-gray-900 bg-blue-50 rounded-md"
      >
        {currentDateDisplay}
      </div>

      {/* Date Picker */}
      <div className="ml-auto">
        <input
          data-testid="time-nav-date-picker"
          type="date"
          value={currentDateValue}
          min={minDate}
          max={maxDate}
          onChange={handleDateChange}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          aria-label="Select date"
        />
      </div>
    </div>
  );
}
