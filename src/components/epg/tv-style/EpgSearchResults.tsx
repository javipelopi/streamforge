/**
 * EPG Search Results Dropdown
 * Story 5.7: EPG Top Bar with Search and Day Navigation
 *
 * Dropdown showing search results below the search input.
 * Displays program title, channel name, and date/time for each result.
 */

import { useEffect, useCallback, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import type { KeyboardEvent } from 'react';
import type { EpgSearchResult } from '../../../lib/tauri';
import { useListNavigation } from '../../../hooks/useListNavigation';

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
  /** Callback when dropdown should close */
  onClose: () => void;
}

/** Ref handle for external control */
export interface EpgSearchResultsHandle {
  /** Focus the first result */
  focusFirst: () => void;
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
export const EpgSearchResults = forwardRef<EpgSearchResultsHandle, EpgSearchResultsProps>(
  function EpgSearchResults(
    {
      results,
      isSearching,
      error,
      onResultSelect,
      onClose,
    },
    ref
  ) {
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Limit results to max
  const displayResults = results.slice(0, MAX_RESULTS);
  const hasResults = displayResults.length > 0;
  const showEmptyState = !isSearching && !hasResults && !error;

  // Create indices array for useListNavigation (using index as ID)
  const indices = displayResults.map((_, i) => i);

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [results]);

  // Wrapper for setHighlightedIndex to match hook's expected signature
  const handleSelect = useCallback((index: number) => {
    setHighlightedIndex(index);
  }, []);

  // Use list navigation hook for ArrowUp/Down handling
  const { handleArrowUp, handleArrowDown } = useListNavigation({
    items: indices,
    selectedId: highlightedIndex,
    getId: (i) => i,
    onSelect: handleSelect,
    scrollStrategy: { type: 'refFocus', refs: itemRefs as React.RefObject<(HTMLElement | null)[]> },
  });

  // Expose focus method to parent
  useImperativeHandle(ref, () => ({
    focusFirst: () => {
      if (hasResults && itemRefs.current[0]) {
        setHighlightedIndex(0);
        itemRefs.current[0]?.focus();
      }
    },
  }), [hasResults]);

  // Handle result click
  const handleResultClick = useCallback(
    (result: EpgSearchResult) => {
      onResultSelect(result);
    },
    [onResultSelect]
  );

  // Handle keyboard navigation within results (Enter/Space/Escape + delegate ArrowUp/Down to hook)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, result: EpgSearchResult) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        handleArrowDown();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        handleArrowUp();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        onResultSelect(result);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    },
    [handleArrowDown, handleArrowUp, onResultSelect, onClose]
  );

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
        <ul ref={listRef} className="py-1">
          {displayResults.map((result, index) => {
            const isChannelResult = result.resultType === 'channel';
            const resultKey = isChannelResult
              ? `channel-${result.channelId}`
              : `program-${result.programId}`;
            const isHighlighted = index === highlightedIndex;

            return (
              <li key={resultKey}>
                <button
                  ref={(el) => { itemRefs.current[index] = el; }}
                  data-testid={`search-result-${resultKey}`}
                  onClick={() => handleResultClick(result)}
                  onKeyDown={(e) => handleKeyDown(e, result)}
                  className={`w-full px-4 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50 ${
                    isHighlighted ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                  role="option"
                  aria-selected={isHighlighted}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Title/channel name and subtitle */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          data-testid="result-title"
                          className="text-white font-semibold text-sm truncate"
                        >
                          {result.title}
                        </p>
                        {isChannelResult && (
                          <span
                            data-testid="result-channel-badge"
                            className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-500/20 text-blue-400"
                          >
                            Channel
                          </span>
                        )}
                      </div>
                      {!isChannelResult && (
                        <p
                          data-testid="result-channel"
                          className="text-xs mt-0.5 truncate"
                          style={{ color: 'rgb(153, 153, 153)' }}
                        >
                          {result.channelName}
                        </p>
                      )}
                      {isChannelResult && result.channelIcon && (
                        <p
                          className="text-xs mt-0.5 text-white/40"
                        >
                          View schedule
                        </p>
                      )}
                    </div>

                    {/* Right: Date/time for programs, icon for channels */}
                    {isChannelResult ? (
                      <div className="flex-shrink-0">
                        {result.channelIcon ? (
                          <img
                            src={result.channelIcon}
                            alt=""
                            className="w-8 h-8 object-contain rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-white/40"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        data-testid="result-datetime"
                        className="flex-shrink-0 text-right"
                      >
                        <p className="text-white/50 text-xs">
                          {result.startTime && formatDate(result.startTime)}
                        </p>
                        <p className="text-white/40 text-xs">
                          {result.startTime && formatTime(result.startTime)}
                        </p>
                      </div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});
