/**
 * EPG Day Navigation Hook
 * Story 5.7: EPG Top Bar with Search and Day Navigation
 *
 * Manages day selection state for EPG navigation.
 * Computes day options (Today, Tonight, Tomorrow, + weekdays).
 */

import { useState, useCallback, useMemo, useEffect } from 'react';

/**
 * Day option representing a selectable day
 */
export interface DayOption {
  /** Unique identifier (e.g., "today", "tonight", "tomorrow", "wed") */
  id: string;
  /** Display label (e.g., "Today", "Tonight", "Tomorrow", "Wed") */
  label: string;
  /** The date this option represents */
  date: Date;
  /** Start of time window for schedule fetching */
  startTime: Date;
  /** End of time window for schedule fetching */
  endTime: Date;
}

/**
 * Return type for useEpgDayNavigation hook
 */
export interface UseEpgDayNavigationResult {
  /** Currently selected day */
  selectedDay: DayOption;
  /** Array of available day options */
  dayOptions: DayOption[];
  /** Select a day by ID */
  selectDay: (dayId: string) => void;
  /** Select an arbitrary date */
  selectDate: (date: Date) => void;
  /** Navigate to the previous day */
  goToPrevDay: () => void;
  /** Navigate to the next day */
  goToNextDay: () => void;
  /** Time window for current selection (for API calls) */
  timeWindow: { startTime: string; endTime: string };
}

/**
 * Get the end of a day (23:59:59.999)
 */
function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Get 6 AM of a date
 */
function startAt6AM(date: Date): Date {
  const result = new Date(date);
  result.setHours(6, 0, 0, 0);
  return result;
}

/**
 * Get 6 PM of a date
 */
function startAt6PM(date: Date): Date {
  const result = new Date(date);
  result.setHours(18, 0, 0, 0);
  return result;
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get short weekday name (e.g., "Wed", "Thu")
 */
function getShortWeekday(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * Check if two dates are the same calendar day
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Compute all day options (Today, Tonight, Tomorrow, + 4 weekdays)
 */
function computeDayOptions(): DayOption[] {
  const now = new Date();
  const options: DayOption[] = [];

  // Today - current time onwards
  options.push({
    id: 'today',
    label: 'Today',
    date: new Date(now),
    startTime: new Date(now),
    endTime: endOfDay(now),
  });

  // Tonight - 6 PM onwards
  const tonight = startAt6PM(now);
  // If it's past 6 PM, tonight starts now
  if (now.getHours() >= 18) {
    options.push({
      id: 'tonight',
      label: 'Tonight',
      date: new Date(now),
      startTime: new Date(now),
      endTime: endOfDay(now),
    });
  } else {
    options.push({
      id: 'tonight',
      label: 'Tonight',
      date: new Date(tonight),
      startTime: new Date(tonight),
      endTime: endOfDay(tonight),
    });
  }

  // Tomorrow - 6 AM to end of day
  const tomorrow = addDays(now, 1);
  options.push({
    id: 'tomorrow',
    label: 'Tomorrow',
    date: startAt6AM(tomorrow),
    startTime: startAt6AM(tomorrow),
    endTime: endOfDay(tomorrow),
  });

  // Next 4 weekdays
  for (let i = 2; i <= 5; i++) {
    const dayDate = addDays(now, i);
    const weekday = getShortWeekday(dayDate);
    options.push({
      id: weekday.toLowerCase(),
      label: weekday,
      date: startAt6AM(dayDate),
      startTime: startAt6AM(dayDate),
      endTime: endOfDay(dayDate),
    });
  }

  return options;
}

/**
 * Find day option that matches a date
 */
function findDayOptionForDate(
  date: Date,
  dayOptions: DayOption[]
): DayOption | null {
  const now = new Date();

  // Check if it's today
  if (isSameDay(date, now)) {
    return dayOptions.find((d) => d.id === 'today') || null;
  }

  // Check if it's tomorrow
  const tomorrow = addDays(now, 1);
  if (isSameDay(date, tomorrow)) {
    return dayOptions.find((d) => d.id === 'tomorrow') || null;
  }

  // Check if it matches one of the weekday options
  for (const option of dayOptions) {
    if (option.id !== 'today' && option.id !== 'tonight' && option.id !== 'tomorrow') {
      if (isSameDay(date, option.date)) {
        return option;
      }
    }
  }

  return null;
}

/**
 * Hook for managing EPG day navigation state
 *
 * AC #3: Day selection updates schedule with time window
 * AC #3: Prev/Next navigation between days
 * AC #4: Arbitrary date selection from picker
 *
 * @returns Day navigation state and handlers
 */
export function useEpgDayNavigation(): UseEpgDayNavigationResult {
  // Recompute day options daily after midnight
  // Store the current day to detect date changes
  const [currentDayKey, setCurrentDayKey] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  });

  // Compute day options, recompute when date changes
  const dayOptions = useMemo(() => {
    return computeDayOptions();
  }, [currentDayKey]);

  // State for selected day (default to "today")
  const [selectedDay, setSelectedDay] = useState<DayOption>(() => dayOptions[0]);

  // Set up interval to check for date changes (every minute)
  useEffect(() => {
    const checkDateChange = () => {
      const now = new Date();
      const newDayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      if (newDayKey !== currentDayKey) {
        setCurrentDayKey(newDayKey);
        // Reset selected day to "today" after midnight
        setSelectedDay(computeDayOptions()[0]);
      }
    };

    // Check every minute
    const intervalId = setInterval(checkDateChange, 60_000);
    return () => clearInterval(intervalId);
  }, [currentDayKey]);

  /**
   * Select a day by ID
   */
  const selectDay = useCallback(
    (dayId: string) => {
      const option = dayOptions.find((d) => d.id === dayId);
      if (option) {
        setSelectedDay(option);
      }
    },
    [dayOptions]
  );

  /**
   * Select an arbitrary date (from date picker)
   */
  const selectDate = useCallback(
    (date: Date) => {
      // Try to find a matching day option
      const matchingOption = findDayOptionForDate(date, dayOptions);

      if (matchingOption) {
        setSelectedDay(matchingOption);
      } else {
        // Create a custom day option for the selected date
        const weekday = getShortWeekday(date);
        const customOption: DayOption = {
          id: weekday.toLowerCase(),
          label: weekday,
          date: startAt6AM(date),
          startTime: startAt6AM(date),
          endTime: endOfDay(date),
        };
        setSelectedDay(customOption);
      }
    },
    [dayOptions]
  );

  /**
   * Navigate to the previous day
   */
  const goToPrevDay = useCallback(() => {
    const currentIndex = dayOptions.findIndex((d) => d.id === selectedDay.id);

    if (currentIndex > 0) {
      // Move to previous option
      setSelectedDay(dayOptions[currentIndex - 1]);
    } else if (currentIndex === 0) {
      // Already at first option (today), don't go further back
      // Could potentially go to yesterday, but typically EPG doesn't show past
    } else {
      // Custom date selected, go to previous day
      const prevDate = addDays(selectedDay.date, -1);
      const now = new Date();

      // Don't go before today
      if (prevDate >= startAt6AM(now)) {
        selectDate(prevDate);
      }
    }
  }, [dayOptions, selectedDay, selectDate]);

  /**
   * Navigate to the next day
   */
  const goToNextDay = useCallback(() => {
    const currentIndex = dayOptions.findIndex((d) => d.id === selectedDay.id);

    if (currentIndex >= 0 && currentIndex < dayOptions.length - 1) {
      // Move to next option
      setSelectedDay(dayOptions[currentIndex + 1]);
    } else {
      // At last option or custom date, go to next day
      const nextDate = addDays(selectedDay.date, 1);
      selectDate(nextDate);
    }
  }, [dayOptions, selectedDay, selectDate]);

  /**
   * Compute time window for API calls
   */
  const timeWindow = useMemo(
    () => ({
      startTime: selectedDay.startTime.toISOString(),
      endTime: selectedDay.endTime.toISOString(),
    }),
    [selectedDay]
  );

  return {
    selectedDay,
    dayOptions,
    selectDay,
    selectDate,
    goToPrevDay,
    goToNextDay,
    timeWindow,
  };
}
