import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, Check, X, Loader2 } from 'lucide-react';
import type { XtreamStreamSearchResult } from '../../lib/tauri';
import { getQualityBadgeClasses, searchXtreamStreams } from '../../lib/tauri';

interface StreamSearchDropdownProps {
  /** XMLTV channel name to use as initial search query */
  xmltvChannelName: string;
  xmltvChannelId: number;
  onSelect: (stream: XtreamStreamSearchResult) => void;
  onClose: () => void;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const ITEM_HEIGHT = 56;

/**
 * StreamSearchDropdown component displays a searchable list of Xtream streams
 * Uses TanStack Virtual for efficient rendering of large lists (1000+ streams)
 * Results are ordered by fuzzy match score against the search query
 *
 * Story 3-3: Manual Match Override via Search Dropdown
 */
export const StreamSearchDropdown = memo(function StreamSearchDropdown({
  xmltvChannelName,
  xmltvChannelId,
  onSelect,
  onClose,
}: StreamSearchDropdownProps) {
  const [searchQuery, setSearchQuery] = useState(xmltvChannelName);
  const [streams, setStreams] = useState<XtreamStreamSearchResult[]>([]);
  // Initialize loading state based on whether we have a valid initial query
  // This prevents a flash of loading state when xmltvChannelName is empty
  const [isLoading, setIsLoading] = useState(!!xmltvChannelName.trim());
  const [searchError, setSearchError] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce search to prevent excessive API calls
  // 300ms is appropriate for network calls (vs 150ms for in-memory filtering)
  // This balances responsiveness with reducing backend load
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch streams when search query changes
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setStreams([]);
      setIsLoading(false);
      setSearchError(null);
      return;
    }

    setIsLoading(true);
    setSearchError(null);
    searchXtreamStreams(debouncedSearch)
      .then((results) => {
        setStreams(results);
        setHighlightedIndex(0);
      })
      .catch((err) => {
        console.error('Failed to search streams:', err);
        setStreams([]);
        setSearchError('Failed to search streams. Please try again.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [debouncedSearch]);

  // Focus input on mount and select all text
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  // Virtual list for performance
  const virtualizer = useVirtualizer({
    count: streams.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 10,
  });

  // Scroll to highlighted item
  useEffect(() => {
    if (highlightedIndex >= 0 && highlightedIndex < streams.length) {
      virtualizer.scrollToIndex(highlightedIndex, { align: 'auto' });
    }
  }, [highlightedIndex, streams.length, virtualizer]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setHighlightedIndex((prev) =>
            Math.min(prev + 1, streams.length - 1)
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          // Check for zero-length array before accessing
          if (streams.length === 0) {
            break;
          }
          if (highlightedIndex >= 0 && highlightedIndex < streams.length) {
            const stream = streams[highlightedIndex];
            // Don't select if already matched to this channel
            if (!stream.matchedToXmltvIds.includes(xmltvChannelId)) {
              onSelect(stream);
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
      }
    },
    [streams, highlightedIndex, xmltvChannelId, onSelect, onClose]
  );

  // Handle stream click
  const handleStreamClick = useCallback(
    (stream: XtreamStreamSearchResult) => {
      // Don't select if already matched to this channel
      if (!stream.matchedToXmltvIds.includes(xmltvChannelId)) {
        onSelect(stream);
      }
    },
    [xmltvChannelId, onSelect]
  );

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      className="w-80 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
      role="combobox"
      aria-expanded="true"
      aria-haspopup="listbox"
      onKeyDown={handleKeyDown}
    >
      {/* Search input */}
      <div className="p-2 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search streams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              // Stop propagation for typing keys so parent handler doesn't interfere
              if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter' && e.key !== 'Escape') {
                e.stopPropagation();
              }
            }}
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-label="Search streams"
            data-testid="stream-search-input"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-8 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span>Searching...</span>
        </div>
      )}

      {/* Error state */}
      {!isLoading && searchError && (
        <div
          className="py-6 px-4 text-center"
          data-testid="search-error-message"
        >
          <div className="text-red-600 mb-2">{searchError}</div>
          <button
            type="button"
            onClick={() => {
              setSearchError(null);
              setIsLoading(true);
              searchXtreamStreams(debouncedSearch)
                .then((results) => {
                  setStreams(results);
                  setHighlightedIndex(0);
                })
                .catch((err) => {
                  console.error('Failed to search streams:', err);
                  setStreams([]);
                  setSearchError('Failed to search streams. Please try again.');
                })
                .finally(() => {
                  setIsLoading(false);
                });
            }}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !searchError && streams.length === 0 && (
        <div
          className="py-8 text-center text-gray-500"
          data-testid="no-results-message"
        >
          {searchQuery.trim()
            ? 'No streams match your search'
            : 'Enter a search query'}
        </div>
      )}

      {/* Stream list */}
      {!isLoading && !searchError && streams.length > 0 && (
        <>
          {/* Results count */}
          <div
            className="px-3 py-1 text-xs text-gray-500 bg-gray-50 border-b border-gray-200"
            aria-live="polite"
            aria-atomic="true"
          >
            {streams.length} stream{streams.length !== 1 ? 's' : ''} found
          </div>

          <div
            ref={listRef}
            className="max-h-64 overflow-auto"
            role="listbox"
            aria-label="Available streams"
            data-testid="stream-list"
          >
            <div
              className="relative w-full"
              style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
              {virtualItems.map((virtualItem) => {
                const stream = streams[virtualItem.index];
                const isHighlighted = virtualItem.index === highlightedIndex;
                const isMatchedToThisChannel = stream.matchedToXmltvIds.includes(xmltvChannelId);
                const isMatchedToOther = stream.matchedToXmltvIds.length > 0 && !isMatchedToThisChannel;

                return (
                  <div
                    key={stream.id}
                    data-testid={`stream-option-${stream.id}`}
                    role="option"
                    aria-selected={isHighlighted}
                    aria-disabled={isMatchedToThisChannel}
                    className={`absolute top-0 left-0 w-full px-3 py-2 cursor-pointer flex items-center gap-2 ${
                      isMatchedToThisChannel
                        ? 'bg-gray-100 cursor-not-allowed opacity-60'
                        : isHighlighted
                        ? 'bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                    style={{
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    onClick={() => handleStreamClick(stream)}
                    onMouseEnter={() => setHighlightedIndex(virtualItem.index)}
                  >
                    {/* Matched checkmark */}
                    <div className="w-5 flex-shrink-0">
                      {isMatchedToThisChannel && (
                        <Check
                          className="w-4 h-4 text-green-600"
                          data-testid="already-matched-icon"
                        />
                      )}
                    </div>

                    {/* Stream info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {stream.name}
                        </span>
                        {stream.fuzzyScore !== null && (
                          <span className="text-xs text-gray-400">
                            {Math.round(stream.fuzzyScore * 100)}%
                          </span>
                        )}
                        {isMatchedToOther && (
                          <span className="text-xs text-gray-500">
                            (matched elsewhere)
                          </span>
                        )}
                      </div>
                      {stream.categoryName && (
                        <div className="text-xs text-gray-500 truncate">
                          {stream.categoryName}
                        </div>
                      )}
                    </div>

                    {/* Quality badges */}
                    <div className="flex gap-1 flex-shrink-0">
                      {stream.qualities.slice(0, 2).map((quality, idx) => (
                        <span
                          key={idx}
                          data-testid="quality-badge"
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getQualityBadgeClasses(quality)}`}
                        >
                          {quality}
                        </span>
                      ))}
                      {stream.qualities.length > 2 && (
                        <span className="text-xs text-gray-400">
                          +{stream.qualities.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Footer with close button */}
      <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
        <span className="text-xs text-gray-500">
          Use arrows to navigate, Enter to select
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-gray-600 hover:text-gray-800"
          data-testid="close-dropdown-button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
});
