import { useState, useCallback } from 'react';
import { searchEpgPrograms, type EpgSearchResult } from '../lib/tauri';
import { createCenteredTimeWindow, type TimeWindow } from './useEpgGridData';

/**
 * Return type for useEpgSearch hook
 */
export interface UseEpgSearchResult {
  /** Current search query */
  query: string;
  /** Search results */
  results: EpgSearchResult[];
  /** Whether a search is in progress */
  isSearching: boolean;
  /** Error message if search failed */
  error: string | null;
  /** Whether search results are visible */
  isResultsVisible: boolean;
  /** Handler for search query changes */
  onSearch: (query: string) => void;
  /** Handler for clearing search */
  onClear: () => void;
  /** Handler for selecting a search result - returns time window for navigation */
  onResultSelect: (result: EpgSearchResult) => TimeWindow | null;
}

/**
 * Hook for managing EPG search state and functionality
 *
 * Story 5.2: EPG Search Functionality
 * Task 5: Implement search result selection and grid navigation
 * AC #4: Clicking result navigates grid to program time slot
 *
 * Features:
 * - Search state management (query, results, loading)
 * - Backend search invocation
 * - Result selection with time window calculation
 * - Clear search functionality
 *
 * @returns Search state and handlers
 */
export function useEpgSearch(): UseEpgSearchResult {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EpgSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isResultsVisible, setIsResultsVisible] = useState(false);

  /**
   * Perform search with debounced query
   */
  const onSearch = useCallback(async (searchQuery: string) => {
    setQuery(searchQuery);

    // Clear results if query is empty
    if (!searchQuery.trim()) {
      setResults([]);
      setIsResultsVisible(false);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const searchResults = await searchEpgPrograms(searchQuery);
      setResults(searchResults);
      setIsResultsVisible(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      console.error('EPG search failed:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  /**
   * Clear search state
   */
  const onClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setIsResultsVisible(false);
    setError(null);
    setIsSearching(false);
  }, []);

  /**
   * Handle result selection
   * Returns a time window centered on the program for grid navigation
   */
  const onResultSelect = useCallback((result: EpgSearchResult): TimeWindow | null => {
    // Calculate time window centered on the program
    const programStartTime = new Date(result.startTime);
    const timeWindow = createCenteredTimeWindow(programStartTime, 3);

    // Hide results after selection
    setIsResultsVisible(false);
    setQuery('');
    setResults([]);

    // Dispatch custom event for program selection (Story 5.3 integration)
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('program-selected', {
        detail: { programId: result.programId },
      });
      window.dispatchEvent(event);
    }

    return timeWindow;
  }, []);

  return {
    query,
    results,
    isSearching,
    error,
    isResultsVisible,
    onSearch,
    onClear,
    onResultSelect,
  };
}
