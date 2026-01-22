import { useCallback, useMemo } from 'react';
import type { EpgSearchResult } from '../../lib/tauri';
import {
  getEpgSearchMatchTypeDisplay,
  getMatchTypeBadgeClasses,
  formatProgramDuration,
} from '../../lib/tauri';

/**
 * Props for EpgSearchResults component
 */
export interface EpgSearchResultsProps {
  /** Search results to display */
  results: EpgSearchResult[];
  /** The search query that produced these results */
  query: string;
  /** Handler for when a result is clicked */
  onResultClick: (result: EpgSearchResult) => void;
  /** Whether search is in progress */
  isLoading?: boolean;
  /** Error message if search failed */
  error?: string | null;
}

/**
 * Format time for display (e.g., "7:30 PM")
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format date for display (e.g., "Mon, Jan 22")
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * EpgSearchResults component for displaying search results
 *
 * Story 5.2: EPG Search Functionality
 * Task 4: Create search results display component
 * AC #3: Results show program title, channel name, start time, duration, relevance indicator
 *
 * Features:
 * - Virtualized dropdown panel for results
 * - Program title, channel name, start time, duration display
 * - Relevance indicator (match type badge)
 * - Empty state for no results
 * - Loading state
 */
export function EpgSearchResults({
  results,
  query,
  onResultClick,
  isLoading = false,
  error = null,
}: EpgSearchResultsProps) {
  // Handle result click
  const handleResultClick = useCallback(
    (result: EpgSearchResult) => {
      onResultClick(result);
    },
    [onResultClick]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, result: EpgSearchResult) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onResultClick(result);
      }
    },
    [onResultClick]
  );

  // Memoize grouped results by date for better UX
  const groupedResults = useMemo(() => {
    const groups: Map<string, EpgSearchResult[]> = new Map();

    for (const result of results) {
      const dateKey = formatDate(result.startTime);
      const existing = groups.get(dateKey) || [];
      existing.push(result);
      groups.set(dateKey, existing);
    }

    return groups;
  }, [results]);

  // Loading state
  if (isLoading && results.length === 0) {
    return (
      <div
        data-testid="epg-search-results"
        className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden"
      >
        <div className="p-4 flex items-center justify-center text-gray-500">
          <svg
            className="animate-spin h-5 w-5 mr-2"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
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
          Searching...
        </div>
      </div>
    );
  }

  // Error state
  if (error && query.length > 0) {
    return (
      <div
        data-testid="epg-search-results"
        className="absolute top-full left-0 right-0 mt-1 bg-white border border-red-200 rounded-lg shadow-lg z-50"
      >
        <div
          data-testid="epg-search-error-state"
          className="p-4 text-center text-red-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 mx-auto mb-2 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="font-medium">Search failed</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (results.length === 0 && query.length > 0) {
    return (
      <div
        data-testid="epg-search-results"
        className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
      >
        <div
          data-testid="epg-search-empty-state"
          className="p-4 text-center text-gray-500"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 mx-auto mb-2 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p>No programs found for &apos;{query}&apos;</p>
          <p className="text-sm mt-1">Try a different search term</p>
        </div>
      </div>
    );
  }

  // No results and no query - don't render
  if (results.length === 0) {
    return null;
  }

  // Results list
  return (
    <div
      data-testid="epg-search-results"
      className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
      role="listbox"
      aria-label="Search results"
    >
      {Array.from(groupedResults.entries()).map(([dateKey, dateResults]) => (
        <div key={dateKey}>
          {/* Date header */}
          <div className="sticky top-0 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">
            {dateKey}
          </div>

          {/* Results for this date */}
          {dateResults.map((result) => (
            <div
              key={result.programId}
              data-testid={`epg-search-result-item-${result.programId}`}
              onClick={() => handleResultClick(result)}
              onKeyDown={(e) => handleKeyDown(e, result)}
              className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 focus:outline-none focus:bg-blue-50"
              role="option"
              tabIndex={0}
              aria-selected="false"
            >
              <div className="flex items-start justify-between gap-2">
                {/* Program info */}
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <div
                    data-testid={`epg-search-result-title-${result.programId}`}
                    className="font-medium text-gray-900 truncate"
                  >
                    {result.title}
                  </div>

                  {/* Channel and time */}
                  <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-500">
                    <span
                      data-testid={`epg-search-result-channel-${result.programId}`}
                      className="truncate"
                    >
                      {result.channelName}
                    </span>
                    <span className="text-gray-300">|</span>
                    <span
                      data-testid={`epg-search-result-time-${result.programId}`}
                      className="whitespace-nowrap"
                    >
                      {formatTime(result.startTime)} ({formatProgramDuration(result.startTime, result.endTime)})
                    </span>
                  </div>
                </div>

                {/* Relevance badge */}
                <div
                  data-testid={`epg-search-result-relevance-${result.programId}`}
                  className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded ${getMatchTypeBadgeClasses(result.matchType)}`}
                >
                  {getEpgSearchMatchTypeDisplay(result.matchType)}
                </div>
              </div>

              {/* Category if available */}
              {result.category && (
                <div className="mt-1 text-xs text-gray-400">
                  {result.category}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Results count footer */}
      <div className="sticky bottom-0 bg-gray-50 px-3 py-1.5 text-xs text-gray-500 border-t border-gray-200">
        {results.length} {results.length === 1 ? 'result' : 'results'} found
        {results.length >= 50 && ' (showing first 50)'}
      </div>
    </div>
  );
}
