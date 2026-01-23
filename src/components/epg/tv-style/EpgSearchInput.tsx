/**
 * EPG Search Input Component
 * Story 5.7: EPG Top Bar with Search and Day Navigation
 *
 * Expandable search input with magnifying glass icon.
 * Expands on focus, collapses on blur if empty.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { KeyboardEvent, ChangeEvent } from 'react';

/** Debounce delay for search queries in milliseconds */
const DEBOUNCE_MS = 300;

/** Delay for focusing input after icon click */
const FOCUS_DELAY_MS = 50;

interface EpgSearchInputProps {
  /** Current search query */
  query: string;
  /** Callback when search query changes (debounced) */
  onSearch: (query: string) => void;
  /** Callback when clear button is clicked */
  onClear: () => void;
  /** Whether a search is in progress */
  isSearching: boolean;
  /** Callback when navigating down from search (to exit header) */
  onNavigateDown?: () => void;
  /** Callback when navigating right from search icon (to day navigation) */
  onNavigateRight?: () => void;
  /** Callback when navigating to search results (Enter/Down with results visible) */
  onNavigateToResults?: () => void;
  /** Whether search results are currently visible */
  hasResults?: boolean;
  /** Callback when Escape is pressed (to close search results) */
  onEscape?: () => void;
}

/**
 * EpgSearchInput - Expandable search input with icon
 *
 * AC #1: Search input expandable with magnifying glass icon
 * AC #2: Debounced search (300ms), clear button when text present
 */
export function EpgSearchInput({
  query,
  onSearch,
  onClear,
  isSearching,
  onNavigateDown,
  onNavigateRight,
  onNavigateToResults,
  hasResults = false,
  onEscape,
}: EpgSearchInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localQuery, setLocalQuery] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Sync local query with prop
  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  // Handle input focus (expand)
  const handleFocus = useCallback(() => {
    setIsExpanded(true);
  }, []);

  // Handle input blur (collapse if empty)
  const handleBlur = useCallback(() => {
    if (!localQuery.trim()) {
      setIsExpanded(false);
    }
  }, [localQuery]);

  // Handle icon click or keyboard activation (expand and focus)
  const handleIconClick = useCallback(() => {
    setIsExpanded(true);
    // Focus input after state update
    setTimeout(() => {
      inputRef.current?.focus();
    }, FOCUS_DELAY_MS);
  }, []);

  // Handle icon keyboard events (Enter/Space to activate, arrows to navigate)
  const handleIconKeyDown = useCallback(
    (e: KeyboardEvent<globalThis.HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleIconClick();
      } else if (e.key === 'ArrowDown' || e.key === 'Tab') {
        e.preventDefault();
        onNavigateDown?.();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNavigateRight?.();
      }
    },
    [handleIconClick, onNavigateDown, onNavigateRight]
  );

  // Handle input change with debouncing (AC #2)
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalQuery(value);

      // Clear previous debounce timer
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce search
      debounceRef.current = setTimeout(() => {
        // Only call onSearch if component is still mounted
        if (isMountedRef.current) {
          onSearch(value);
        }
      }, DEBOUNCE_MS);
    },
    [onSearch]
  );

  // Handle clear button click
  const handleClear = useCallback(() => {
    setLocalQuery('');
    onClear();
    inputRef.current?.focus();
  }, [onClear]);

  // Handle keyboard events for input (navigation and escape)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        // Call parent callback to close dropdown
        onEscape?.();
        // Also collapse the input if empty
        if (!localQuery.trim()) {
          setIsExpanded(false);
          onNavigateDown?.();
        }
      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        // If results are visible, navigate to them; otherwise navigate down to channels
        e.preventDefault();
        e.stopPropagation();
        if (hasResults && onNavigateToResults) {
          onNavigateToResults();
        } else if (e.key === 'ArrowDown') {
          onNavigateDown?.();
        }
      } else if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length) {
        // Navigate right only if cursor is at end of input
        e.preventDefault();
        onNavigateRight?.();
      }
    },
    [localQuery, onNavigateDown, onNavigateRight, hasResults, onNavigateToResults, onEscape]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const hasText = localQuery.length > 0;

  return (
    <div className="relative flex items-center">
      {/* Magnifying glass icon button */}
      <button
        data-testid="epg-search-icon"
        onClick={handleIconClick}
        onKeyDown={handleIconKeyDown}
        className="flex items-center justify-center w-10 h-10 text-white hover:text-white/80 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded-lg"
        aria-label="Search channels and programs"
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
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>

      {/* Expandable input container */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isExpanded ? 'w-72' : 'w-0'
        }`}
      >
        <div className="relative">
          <input
            ref={inputRef}
            data-testid="epg-search-input"
            type="text"
            value={localQuery}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Search..."
            className="w-full h-10 px-3 pr-10 bg-transparent border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/40 transition-colors"
            role="combobox"
            aria-expanded={hasText}
            aria-haspopup="listbox"
            aria-label="Search channels and programs"
            aria-describedby="search-instructions"
            aria-autocomplete="list"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
          />
          {/* Screen reader instructions */}
          <span id="search-instructions" className="sr-only">
            Type to search. Use arrow keys to navigate results. Press Enter to select.
          </span>

          {/* Clear button (visible when has text) */}
          {hasText && (
            <button
              data-testid="epg-search-clear"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/60 hover:text-white transition-colors"
              aria-label="Clear search"
              type="button"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}

          {/* Loading indicator */}
          {isSearching && (
            <div className="absolute right-8 top-1/2 -translate-y-1/2">
              <svg
                className="w-4 h-4 text-white/60 animate-spin"
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
