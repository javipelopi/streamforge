import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Props for EpgSearchInput component
 */
export interface EpgSearchInputProps {
  /** Current search query value */
  value: string;
  /** Handler for search query changes (debounced) */
  onSearch: (query: string) => void;
  /** Handler for clearing the search */
  onClear: () => void;
  /** Whether a search is currently in progress */
  isLoading?: boolean;
  /** Placeholder text for the input */
  placeholder?: string;
}

/**
 * Custom hook for debouncing a value
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

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

/**
 * EpgSearchInput component for searching EPG programs
 *
 * Story 5.2: EPG Search Functionality
 * Task 3: Create search input component
 * AC #1: Search input field is visible and interactive
 * AC #5: Clear button returns to normal grid view
 *
 * Features:
 * - Search icon indicator
 * - Debounced search (300ms delay)
 * - Clear button when search has content
 * - Loading indicator during search
 * - Escape key to clear search
 */
export function EpgSearchInput({
  value,
  onSearch,
  onClear,
  isLoading = false,
  placeholder = 'Search programs...',
}: EpgSearchInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the input value (300ms as per NFR5)
  const debouncedValue = useDebounce(inputValue, 300);

  // Trigger search when debounced value changes
  useEffect(() => {
    onSearch(debouncedValue);
  }, [debouncedValue, onSearch]);

  // Sync input value with external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  // Handle clear button click
  const handleClear = useCallback(() => {
    setInputValue('');
    onClear();
    inputRef.current?.focus();
  }, [onClear]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      }
    },
    [handleClear]
  );

  const hasContent = inputValue.length > 0;

  return (
    <div className="relative flex items-center">
      {/* Search Icon */}
      <div
        data-testid="epg-search-icon"
        className="absolute left-3 text-gray-400 pointer-events-none"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {/* Search Input */}
      <input
        ref={inputRef}
        data-testid="epg-search-input"
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-64 pl-10 pr-10 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        aria-label="Search EPG programs"
      />

      {/* Loading Indicator */}
      {isLoading && (
        <div
          data-testid="epg-search-loading-indicator"
          className="absolute right-10 text-gray-400"
        >
          <svg
            className="animate-spin h-4 w-4"
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
        </div>
      )}

      {/* Clear Button */}
      {hasContent && !isLoading && (
        <button
          data-testid="epg-search-clear-button"
          onClick={handleClear}
          className="absolute right-3 text-gray-400 hover:text-gray-600 focus:outline-none"
          title="Clear search"
          aria-label="Clear search"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
