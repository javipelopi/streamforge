/**
 * Day Navigation Bar Component
 * Story 5.7: EPG Top Bar with Search and Day Navigation
 *
 * Horizontal bar with prev/next arrows, day chips, and date picker button.
 * Allows navigation between days for EPG schedule viewing.
 */

import { useState, useCallback, useMemo } from 'react';
import type { KeyboardEvent } from 'react';
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
  /** Callback when navigating down (to channel list) */
  onNavigateDown?: () => void;
  /** Callback when navigating left (to search) */
  onNavigateLeft?: () => void;
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
  onNavigateDown,
  onNavigateLeft,
}: DayNavigationBarProps) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Check if we're on Today (can't go back further)
  const isToday = selectedDay.id === 'today';

  // Check if selected day is beyond Today/Tomorrow (needs label display)
  const isOtherDay = selectedDay.id !== 'today' && selectedDay.id !== 'tomorrow';

  // Format the date for display when viewing other days
  const formattedDate = useMemo(() => {
    if (!isOtherDay) return '';
    return selectedDay.date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }, [isOtherDay, selectedDay.date]);

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

  // Handle keyboard navigation for buttons within day navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowDown' || e.key === 'Tab') {
        e.preventDefault();
        onNavigateDown?.();
        return;
      }

      const target = e.target as HTMLElement;
      const container = e.currentTarget;
      const focusableElements = Array.from(
        container.querySelectorAll<HTMLElement>('button:not([disabled])')
      );
      const currentIndex = focusableElements.indexOf(target);

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentIndex <= 0) {
          // At first element, navigate to search
          onNavigateLeft?.();
        } else {
          // Move to previous button
          focusableElements[currentIndex - 1]?.focus();
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentIndex < focusableElements.length - 1) {
          // Move to next button
          focusableElements[currentIndex + 1]?.focus();
        }
      }
    },
    [onNavigateDown, onNavigateLeft]
  );

  return (
    <div
      data-testid="day-navigation-bar"
      className="flex items-center gap-2"
      role="tablist"
      aria-label="Day navigation"
      onKeyDown={handleKeyDown}
    >
      {/* Prev day button - hidden when on Today */}
      {!isToday && (
        <button
          data-testid="prev-day-button"
          onClick={handlePrevClick}
          className="flex items-center justify-center w-8 h-8 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
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
      )}

      {/* Day chips - only Today and Tomorrow, arrows for other days */}
      <div className="flex items-center gap-1">
        {dayOptions
          .filter((day) => day.id === 'today' || day.id === 'tomorrow')
          .map((day) => (
            <DayChip
              key={day.id}
              day={day}
              isSelected={selectedDay.id === day.id}
              onClick={() => handleDayClick(day.id)}
            />
          ))}
        {/* Show current date when viewing days beyond Today/Tomorrow */}
        {isOtherDay && (
          <span
            data-testid="current-day-label"
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg"
          >
            {formattedDate}
          </span>
        )}
      </div>

      {/* Next day button */}
      <button
        data-testid="next-day-button"
        onClick={handleNextClick}
        className="flex items-center justify-center w-8 h-8 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
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
