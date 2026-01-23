/**
 * Date Picker Button and Overlay
 * Story 5.7: EPG Top Bar with Search and Day Navigation
 *
 * Calendar icon button that opens a date picker overlay.
 * Allows arbitrary date selection for EPG navigation.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

/** Delay for focusing calendar after overlay opens */
const FOCUS_DELAY_MS = 50;

interface DatePickerButtonProps {
  /** Whether the date picker overlay is open */
  isOpen: boolean;
  /** Callback to toggle the overlay */
  onToggle: () => void;
  /** Callback when a date is selected */
  onDateSelect: (date: Date) => void;
  /** Callback to close the overlay */
  onClose: () => void;
  /** Currently selected date */
  selectedDate: Date;
}

/**
 * Generate calendar days for a given month
 */
function getCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: (Date | null)[] = [];

  // Add empty slots for days before the first day of the month
  const startPadding = firstDay.getDay();
  for (let i = 0; i < startPadding; i++) {
    days.push(null);
  }

  // Add all days of the month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  return days;
}

/**
 * Format date as YYYY-MM-DD for data-testid
 * Uses local date components to avoid timezone issues with toISOString()
 */
function formatDateId(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if two dates are the same day
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * DatePickerButton - Calendar button with overlay
 *
 * AC #4: Calendar icon button opens date picker overlay
 * AC #4: Date selection triggers day navigation
 * AC #4: Close overlay on selection or click outside
 */
export function DatePickerButton({
  isOpen,
  onToggle,
  onDateSelect,
  onClose,
  selectedDate,
}: DatePickerButtonProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Current calendar view state (month/year) - can be navigated independently
  const [viewDate, setViewDate] = useState(new Date(selectedDate));
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const calendarDays = getCalendarDays(year, month);

  // Reset view date and focus overlay when it opens
  useEffect(() => {
    if (isOpen) {
      setViewDate(new Date(selectedDate));
      // Focus the overlay after it renders
      setTimeout(() => {
        if (overlayRef.current) {
          // Try to focus the selected date button, or the first available date
          const selectedButton = overlayRef.current.querySelector<HTMLElement>(
            'button[data-testid^="date-picker-day-"]:not([disabled])'
          );
          selectedButton?.focus();
        }
      }, FOCUS_DELAY_MS);
    }
  }, [isOpen, selectedDate]);

  // Day names for header
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Month/year display
  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long' });

  // Navigate to previous month
  const handlePrevMonth = useCallback(() => {
    setViewDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  }, []);

  // Navigate to next month
  const handleNextMonth = useCallback(() => {
    setViewDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  }, []);

  // Handle date click
  const handleDateClick = useCallback(
    (date: Date) => {
      onDateSelect(date);
    },
    [onDateSelect]
  );

  // Handle keyboard navigation within calendar grid
  const handleOverlayKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;

      // Only handle arrow keys on day buttons
      if (!target.dataset.testid?.startsWith('date-picker-day-')) {
        return;
      }

      const dayButtons = overlayRef.current?.querySelectorAll<HTMLElement>(
        'button[data-testid^="date-picker-day-"]:not([disabled])'
      );
      if (!dayButtons) {
        return;
      }

      const dayButtonsArray = Array.from(dayButtons);
      const currentIndex = dayButtonsArray.indexOf(target);

      if (currentIndex === -1) return;

      let newIndex = currentIndex;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        newIndex = Math.max(0, currentIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        newIndex = Math.min(dayButtonsArray.length - 1, currentIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        newIndex = Math.max(0, currentIndex - 7);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        newIndex = Math.min(dayButtonsArray.length - 1, currentIndex + 7);
      }

      if (newIndex !== currentIndex) {
        dayButtonsArray[newIndex]?.focus();
      }
    },
    []
  );

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        overlayRef.current &&
        !overlayRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        onClose();
      }
    };

    // Add listener immediately - the button check prevents immediate close
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle Escape key to close and return focus
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        // Return focus to the button
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Return focus to button when overlay closes (for any close method)
  const prevIsOpen = useRef(isOpen);
  useEffect(() => {
    if (prevIsOpen.current && !isOpen) {
      // Overlay just closed, return focus to button
      buttonRef.current?.focus();
    }
    prevIsOpen.current = isOpen;
  }, [isOpen]);

  const today = new Date();

  return (
    <div className="relative">
      {/* Calendar icon button */}
      <button
        ref={buttonRef}
        data-testid="date-picker-button"
        onClick={onToggle}
        className="flex items-center justify-center w-8 h-8 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        aria-label="Open date picker"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        type="button"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>

      {/* Date picker overlay */}
      {isOpen && (
        <div
          ref={overlayRef}
          data-testid="date-picker-overlay"
          className="absolute right-0 top-full mt-2 p-4 bg-black/90 backdrop-blur-sm rounded-lg border border-white/10 shadow-xl z-50 min-w-[280px]"
          role="dialog"
          aria-label="Date picker"
          aria-describedby="date-picker-instructions"
          aria-modal="true"
          onKeyDown={handleOverlayKeyDown}
        >
          {/* Month/Year header with navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handlePrevMonth}
              className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
              aria-label="Previous month"
              type="button"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <span className="text-white font-medium">
              {monthName} {year}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
              aria-label="Next month"
              type="button"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          {/* Day names header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((name) => (
              <div
                key={name}
                className="w-8 h-8 flex items-center justify-center text-white/50 text-xs font-medium"
              >
                {name}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="w-8 h-8" />;
              }

              const isToday = isSameDay(date, today);
              const isSelected = isSameDay(date, selectedDate);
              // Don't allow selecting past dates - minimum is today
              const isPast = date < today && !isToday;

              return (
                <button
                  key={formatDateId(date)}
                  data-testid={`date-picker-day-${formatDateId(date)}`}
                  onClick={() => handleDateClick(date)}
                  disabled={isPast}
                  className={`
                    w-8 h-8 rounded-lg text-sm font-medium
                    transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                    ${
                      isSelected
                        ? 'bg-[#6366f1] text-white'
                        : isToday
                        ? 'bg-white/10 text-white'
                        : isPast
                        ? 'text-white/30 cursor-not-allowed'
                        : 'text-white hover:bg-white/10'
                    }
                  `}
                  type="button"
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Close button */}
          <button
            data-testid="date-picker-close"
            onClick={onClose}
            className="mt-4 w-full py-2 text-white/70 hover:text-white text-sm transition-colors"
            type="button"
          >
            Close
          </button>

          {/* Screen reader instructions */}
          <span id="date-picker-instructions" className="sr-only">
            Use arrow keys to navigate the calendar. Press Enter to select a date. Press Escape to close.
          </span>
        </div>
      )}
    </div>
  );
}
