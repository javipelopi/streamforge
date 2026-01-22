import { useState, useCallback, useRef } from 'react';
import { searchEpgPrograms, type EpgSearchResult } from '../lib/tauri';
import { createCenteredTimeWindow, type TimeWindow } from './epgTimeUtils';

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
  /** Cancel any pending search requests */
  cancelPendingSearch: () => void;
  /** Hide search results dropdown (e.g., on Escape key) */
  hideResults: () => void;
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
 * - Race condition prevention with AbortController
 *
 * @returns Search state and handlers
 */
export function useEpgSearch(): UseEpgSearchResult {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EpgSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isResultsVisible, setIsResultsVisible] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const latestQueryRef = useRef<string>('');

  /**
   * Cancel any pending search requests
   */
  const cancelPendingSearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Perform search with debounced query
   */
  const onSearch = useCallback(async (searchQuery: string) => {
    // Cancel any pending searches
    cancelPendingSearch();

    setQuery(searchQuery);
    latestQueryRef.current = searchQuery;

    // Clear results if query is empty
    if (!searchQuery.trim()) {
      setResults([]);
      setIsResultsVisible(false);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    // Create abort controller for this search
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const searchResults = await searchEpgPrograms(searchQuery);

      // Only update results if this is still the latest search
      if (latestQueryRef.current === searchQuery && !controller.signal.aborted) {
        setResults(searchResults);
        setIsResultsVisible(true);
      }
    } catch (err) {
      // Don't show error if search was cancelled
      if (!controller.signal.aborted) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        // Show dropdown even on error so user sees the error message
        setIsResultsVisible(true);
        console.error('EPG search failed:', err);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  }, [cancelPendingSearch]);

  /**
   * Clear search state
   */
  const onClear = useCallback(() => {
    cancelPendingSearch();
    setQuery('');
    setResults([]);
    setIsResultsVisible(false);
    setError(null);
    setIsSearching(false);
  }, [cancelPendingSearch]);

  /**
   * Hide search results dropdown without clearing query
   * Used when pressing Escape to close dropdown but keep search text
   */
  const hideResults = useCallback(() => {
    setIsResultsVisible(false);
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
      const event = new CustomEvent('programSelected', {
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
    cancelPendingSearch,
    hideResults,
  };
}
