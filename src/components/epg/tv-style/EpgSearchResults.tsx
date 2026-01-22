/**
 * EPG Search Results Dropdown
 * Story 5.7: EPG Top Bar with Search and Day Navigation
 *
 * Dropdown showing search results below the search input.
 * Displays program title, channel name, and date/time for each result.
 */

import { useEffect, useCallback } from 'react';
import type { EpgSearchResult } from '../../../lib/tauri';

/** Maximum number of results to display */
const MAX_RESULTS = 8;

interface EpgSearchResultsProps {
  /** Search results to display */
  results: EpgSearchResult[];
  /** Whether a search is in progress */
  isSearching: boolean;
  /** Error message if search failed */
  error: string | null;
  /** Callback when a result is selected */
  onResultSelect: (result: EpgSearchResult) => void;
}

/**
 * Format time as HH:MM AM/PM
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format date as "Jan 22"
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * EpgSearchResults - Dropdown showing search results
 *
 * AC #2: Results show program title, channel name, date/time
 * AC #2: Max 8 results in dropdown
 * AC #2: Loading spinner while searching
 * AC #2: "No results found" empty state
 */
export function EpgSearchResults({
  results,
  isSearching,
  error,
  onResultSelect,
}: EpgSearchResultsProps) {
  // Handle Escape key to close dropdown
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('epgSearchEscape'));
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Handle result click
  const handleResultClick = useCallback(
    (result: EpgSearchResult) => {
      onResultSelect(result);
    },
    [onResultSelect]
  );

  // Limit results to max
  const displayResults = results.slice(0, MAX_RESULTS);
  const hasResults = displayResults.length > 0;
  const showEmptyState = !isSearching && !hasResults && !error;

  return (
    <div
      data-testid="epg-search-results"
      className="absolute top-full left-0 mt-1 w-80 max-h-96 overflow-y-auto bg-black/90 backdrop-blur-sm rounded-lg border border-white/10 shadow-xl z-50"
      role="listbox"
      aria-label="Search results"
    >
      {/* Loading state */}
      {isSearching && (
        <div
          data-testid="search-results-loading"
          className="flex items-center justify-center py-6"
        >
          <svg
            className="w-6 h-6 text-white/60 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="ml-2 text-white/60 text-sm">Searching...</span>
        </div>
      )}

      {/* Error state */}
      {error && !isSearching && (
        <div className="flex items-center justify-center py-6 px-4 text-center">
          <svg
            className="w-5 h-5 text-red-400 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Empty state */}
      {showEmptyState && (
        <div
          data-testid="search-results-empty"
          className="flex flex-col items-center justify-center py-8 px-4 text-center"
        >
          <svg
            className="w-8 h-8 text-white/30 mb-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-white/50 text-sm">No results found</p>
        </div>
      )}

      {/* Results list */}
      {hasResults && !isSearching && (
        <ul className="py-1">
          {displayResults.map((result) => (
            <li key={result.programId}>
              <button
                data-testid={`search-result-${result.programId}`}
                onClick={() => handleResultClick(result)}
                className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors focus:outline-none focus:bg-white/5"
                role="option"
                aria-selected={false}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: Title and channel */}
                  <div className="flex-1 min-w-0">
                    <p
                      data-testid="result-title"
                      className="text-white font-semibold text-sm truncate"
                    >
                      {result.title}
                    </p>
                    <p
                      data-testid="result-channel"
                      className="text-xs mt-0.5 truncate"
                      style={{ color: 'rgb(153, 153, 153)' }}
                    >
                      {result.channelName}
                    </p>
                  </div>

                  {/* Right: Date/time */}
                  <div
                    data-testid="result-datetime"
                    className="flex-shrink-0 text-right"
                  >
                    <p className="text-white/50 text-xs">
                      {formatDate(result.startTime)}
                    </p>
                    <p className="text-white/40 text-xs">
                      {formatTime(result.startTime)}
                    </p>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
