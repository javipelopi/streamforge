/**
 * EPG TV-Style Top Bar
 * Story 5.7: EPG Top Bar with Search and Day Navigation
 *
 * Fixed top bar with search input on left and day navigation chips on right.
 * Provides search functionality and day selection for browsing schedules.
 * Supports remote-control navigation with arrow keys.
 */

import { forwardRef, useCallback, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { EpgSearchInput } from './EpgSearchInput';
import { EpgSearchResults } from './EpgSearchResults';
import type { EpgSearchResultsHandle } from './EpgSearchResults';
import { DayNavigationBar } from './DayNavigationBar';
import { useEpgSearch } from '../../../hooks/useEpgSearch';
import { useAppStore } from '../../../stores/appStore';
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
  /** Callback when navigating down from header (to channel list) */
  onNavigateDown?: () => void;
}

/**
 * EpgTopBar - Fixed top bar with search and day navigation
 *
 * AC #1: Display fixed top bar with search input and day navigation
 * AC #2: Search with debounced results and result selection
 * AC #3: Day chip selection updates schedule
 * AC #4: Date picker for arbitrary date selection
 * AC #5: Remote-control navigation (down to channel list, left/right between items)
 */
export const EpgTopBar = forwardRef<HTMLDivElement, EpgTopBarProps>(
  function EpgTopBar(
    {
      selectedDay,
      dayOptions,
      onSelectDay,
      onPrevDay,
      onNextDay,
      onSelectDate,
      onSearchResultSelect,
      onNavigateDown,
    },
    ref
  ) {
  // Get sidebar state for proper positioning
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);

  // Refs for internal navigation between search and day navigation
  const searchRef = useRef<HTMLDivElement>(null);
  const dayNavRef = useRef<HTMLDivElement>(null);
  const searchResultsRef = useRef<EpgSearchResultsHandle>(null);

  // Navigate from search to day navigation
  const handleNavigateRight = useCallback(() => {
    if (dayNavRef.current) {
      const firstButton = dayNavRef.current.querySelector<HTMLElement>('button:not([disabled])');
      firstButton?.focus();
    }
  }, []);

  // Navigate from day navigation to search
  const handleNavigateLeft = useCallback(() => {
    if (searchRef.current) {
      const searchButton = searchRef.current.querySelector<HTMLElement>('button');
      searchButton?.focus();
    }
  }, []);

  // Navigate from search input to results dropdown
  const handleNavigateToResults = useCallback(() => {
    searchResultsRef.current?.focusFirst();
  }, []);

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

  // Handle search result selection
  const handleResultSelect = (result: EpgSearchResult) => {
    // Call the hook's onResultSelect to get time window and clear state
    onResultSelect(result);
    // Call parent callback for navigation
    onSearchResultSelect?.(result);
  };

  // Handle keyboard navigation for header (AC #5)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // Don't intercept navigation if we're inside the search results dropdown
      const target = e.target as HTMLElement;
      const isInSearchResults = target.closest('[data-testid="epg-search-results"]');
      if (isInSearchResults) {
        return; // Let the search results handle their own navigation
      }

      if (e.key === 'ArrowDown' || e.key === 'Tab') {
        // Navigate to channel list
        e.preventDefault();
        onNavigateDown?.();
      }
    },
    [onNavigateDown]
  );

  return (
    <div
      ref={ref}
      data-testid="epg-top-bar"
      className={`fixed top-0 right-0 z-40 h-14 bg-black/70 backdrop-blur-sm border-b border-white/10 flex items-center justify-between px-4 transition-all duration-300 ${
        sidebarOpen ? 'left-64' : 'left-16'
      }`}
      onKeyDown={handleKeyDown}
    >
      {/* Left: Search section (AC #1, #2) */}
      <div ref={searchRef} data-testid="epg-search-section" className="relative flex-shrink-0">
        <EpgSearchInput
          query={query}
          onSearch={onSearch}
          onClear={onClear}
          isSearching={isSearching}
          onNavigateDown={onNavigateDown}
          onNavigateRight={handleNavigateRight}
          onNavigateToResults={handleNavigateToResults}
          hasResults={isResultsVisible && results.length > 0}
          onEscape={hideResults}
        />
        {/* Search results dropdown */}
        {isResultsVisible && (
          <EpgSearchResults
            ref={searchResultsRef}
            results={results}
            isSearching={isSearching}
            error={error}
            onResultSelect={handleResultSelect}
            onClose={hideResults}
          />
        )}
      </div>

      {/* Right: Day navigation section (AC #1, #3, #4) */}
      <div ref={dayNavRef} data-testid="day-navigation-section" className="flex-shrink-0">
        <DayNavigationBar
          selectedDay={selectedDay}
          dayOptions={dayOptions}
          onSelectDay={onSelectDay}
          onPrevDay={onPrevDay}
          onNextDay={onNextDay}
          onSelectDate={onSelectDate}
          onNavigateDown={onNavigateDown}
          onNavigateLeft={handleNavigateLeft}
        />
      </div>
    </div>
  );
});
