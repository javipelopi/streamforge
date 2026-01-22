/**
 * Day Navigation Bar Component
 * Story 5.7: EPG Top Bar with Search and Day Navigation
 *
 * Horizontal bar with prev/next arrows, day chips, and date picker button.
 * Allows navigation between days for EPG schedule viewing.
 */

import { useState, useCallback } from 'react';
import { DayChip } from './DayChip';
import { DatePickerButton } from './DatePickerButton';
import type { DayOption } from '../../../hooks/useEpgDayNavigation';

interface DayNavigationBarProps {
  /** Currently selected day option */
  selectedDay: DayOption;
  /** Array of available day options */
  dayOptions: DayOption[];
  /** Callback when a day chip is selected */
  onSelectDay: (dayId: string) => void;
  /** Callback when prev arrow is clicked */
  onPrevDay: () => void;
  /** Callback when next arrow is clicked */
  onNextDay: () => void;
  /** Callback when a date is selected from picker */
  onSelectDate: (date: Date) => void;
}

/**
 * DayNavigationBar - Day navigation with arrows and chips
 *
 * AC #1: Day navigation chips (Today, Tonight, Tomorrow, day names)
 * AC #3: Day chip selection updates schedule
 * AC #4: Date picker button for arbitrary date selection
 */
export function DayNavigationBar({
  selectedDay,
  dayOptions,
  onSelectDay,
  onPrevDay,
  onNextDay,
  onSelectDate,
}: DayNavigationBarProps) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Handle prev button click
  const handlePrevClick = useCallback(() => {
    onPrevDay();
  }, [onPrevDay]);

  // Handle next button click
  const handleNextClick = useCallback(() => {
    onNextDay();
  }, [onNextDay]);

  // Handle day chip click
  const handleDayClick = useCallback(
    (dayId: string) => {
      onSelectDay(dayId);
    },
    [onSelectDay]
  );

  // Handle date picker toggle
  const handleDatePickerToggle = useCallback(() => {
    setIsDatePickerOpen((prev) => !prev);
  }, []);

  // Handle date selection from picker
  const handleDateSelect = useCallback(
    (date: Date) => {
      onSelectDate(date);
      setIsDatePickerOpen(false);
    },
    [onSelectDate]
  );

  // Handle date picker close
  const handleDatePickerClose = useCallback(() => {
    setIsDatePickerOpen(false);
  }, []);

  return (
    <div
      data-testid="day-navigation-bar"
      className="flex items-center gap-2"
      role="tablist"
      aria-label="Day navigation"
    >
      {/* Prev day button */}
      <button
        data-testid="prev-day-button"
        onClick={handlePrevClick}
        className="flex items-center justify-center w-8 h-8 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        aria-label="Previous day"
        type="button"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      {/* Day chips container (horizontally scrollable) */}
      <div className="flex items-center gap-1 overflow-x-auto max-w-md scrollbar-hide">
        {dayOptions.map((day) => (
          <DayChip
            key={day.id}
            day={day}
            isSelected={selectedDay.id === day.id}
            onClick={() => handleDayClick(day.id)}
          />
        ))}
      </div>

      {/* Next day button */}
      <button
        data-testid="next-day-button"
        onClick={handleNextClick}
        className="flex items-center justify-center w-8 h-8 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        aria-label="Next day"
        type="button"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>

      {/* Date picker button */}
      <DatePickerButton
        isOpen={isDatePickerOpen}
        onToggle={handleDatePickerToggle}
        onDateSelect={handleDateSelect}
        onClose={handleDatePickerClose}
        selectedDate={selectedDay.date}
      />
    </div>
  );
}
