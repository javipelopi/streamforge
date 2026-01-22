/**
 * EPG TV-Style Top Bar
 * Story 5.7: EPG Top Bar with Search and Day Navigation
 *
 * Fixed top bar with search input on left and day navigation chips on right.
 * Provides search functionality and day selection for browsing schedules.
 */

import { useEffect } from 'react';
import { EpgSearchInput } from './EpgSearchInput';
import { EpgSearchResults } from './EpgSearchResults';
import { DayNavigationBar } from './DayNavigationBar';
import { useEpgSearch } from '../../../hooks/useEpgSearch';
import type { DayOption } from '../../../hooks/useEpgDayNavigation';
import type { EpgSearchResult } from '../../../lib/tauri';

interface EpgTopBarProps {
  /** Currently selected day option */
  selectedDay: DayOption;
  /** Array of available day options */
  dayOptions: DayOption[];
  /** Callback when a day is selected */
  onSelectDay: (dayId: string) => void;
  /** Callback when prev arrow is clicked */
  onPrevDay: () => void;
  /** Callback when next arrow is clicked */
  onNextDay: () => void;
  /** Callback when a date is selected from picker */
  onSelectDate: (date: Date) => void;
  /** Callback when a search result is selected */
  onSearchResultSelect?: (result: EpgSearchResult) => void;
}

/**
 * EpgTopBar - Fixed top bar with search and day navigation
 *
 * AC #1: Display fixed top bar with search input and day navigation
 * AC #2: Search with debounced results and result selection
 * AC #3: Day chip selection updates schedule
 * AC #4: Date picker for arbitrary date selection
 */
export function EpgTopBar({
  selectedDay,
  dayOptions,
  onSelectDay,
  onPrevDay,
  onNextDay,
  onSelectDate,
  onSearchResultSelect,
}: EpgTopBarProps) {
  // Use the existing EPG search hook
  const {
    query,
    results,
    isSearching,
    error,
    isResultsVisible,
    onSearch,
    onClear,
    onResultSelect,
    hideResults,
  } = useEpgSearch();

  // Handle Escape key to close search dropdown (AC #2)
  useEffect(() => {
    const handleEscapeEvent = () => {
      hideResults();
    };

    window.addEventListener('epgSearchEscape', handleEscapeEvent);
    return () => window.removeEventListener('epgSearchEscape', handleEscapeEvent);
  }, [hideResults]);

  // Handle search result selection
  const handleResultSelect = (result: EpgSearchResult) => {
    // Call the hook's onResultSelect to get time window and clear state
    onResultSelect(result);
    // Call parent callback for navigation
    onSearchResultSelect?.(result);
  };

  return (
    <div
      data-testid="epg-top-bar"
      className="fixed top-0 left-0 right-0 z-50 h-14 bg-black/70 backdrop-blur-sm border-b border-white/10 flex items-center justify-between px-4"
    >
      {/* Left: Search section (AC #1, #2) */}
      <div data-testid="epg-search-section" className="relative flex-shrink-0">
        <EpgSearchInput
          query={query}
          onSearch={onSearch}
          onClear={onClear}
          isSearching={isSearching}
        />
        {/* Search results dropdown */}
        {isResultsVisible && (
          <EpgSearchResults
            results={results}
            isSearching={isSearching}
            error={error}
            onResultSelect={handleResultSelect}
          />
        )}
      </div>

      {/* Right: Day navigation section (AC #1, #3, #4) */}
      <div data-testid="day-navigation-section" className="flex-shrink-0">
        <DayNavigationBar
          selectedDay={selectedDay}
          dayOptions={dayOptions}
          onSelectDay={onSelectDay}
          onPrevDay={onPrevDay}
          onNextDay={onNextDay}
          onSelectDate={onSelectDate}
        />
      </div>
    </div>
  );
}
