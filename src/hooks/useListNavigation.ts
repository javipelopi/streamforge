/**
 * useListNavigation Hook
 *
 * Extracts common vertical list navigation pattern for keyboard-driven lists.
 * Supports three scroll strategies:
 * - virtualizer: Uses TanStack Virtual's scrollToIndex
 * - scrollIntoView: Uses element.scrollIntoView on ID-based elements
 * - refFocus: Uses ref array to focus individual elements
 */

import { useCallback, useMemo, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';

/** Scroll strategy options - generic E extends HTMLElement for type-safe ref arrays */
export type ScrollStrategy<E extends HTMLElement = HTMLElement> =
  | { type: 'virtualizer'; virtualizer: Virtualizer<HTMLDivElement, Element> }
  | { type: 'scrollIntoView'; idPrefix: string }
  | { type: 'refFocus'; refs: React.RefObject<(E | null)[]> };

/** Configuration for list navigation */
export interface UseListNavigationOptions<T, K extends string | number, E extends HTMLElement = HTMLElement> {
  /** Array of items in the list */
  items: T[];
  /** Currently selected item ID (null if none selected) */
  selectedId: K | null;
  /** Function to extract ID from an item */
  getId: (item: T) => K;
  /** Callback when selection changes */
  onSelect: (id: K) => void;
  /** Scroll strategy for keeping selected item visible */
  scrollStrategy: ScrollStrategy<E>;
  /** Called when ArrowUp at index 0 (boundary navigation) */
  onBoundaryUp?: () => void;
  /** Called when ArrowDown at last index (boundary navigation) */
  onBoundaryDown?: () => void;
  /** Predicate to allow/block boundary navigation (e.g., when details open) */
  canNavigateBoundary?: () => boolean;
}

/** Return value from useListNavigation */
export interface UseListNavigationReturn {
  /** Current index of selected item (-1 if not found) */
  currentIndex: number;
  /** Handler for ArrowUp key - returns true if handled */
  handleArrowUp: () => boolean;
  /** Handler for ArrowDown key - returns true if handled */
  handleArrowDown: () => boolean;
  /** Full keyboard handler for common list navigation keys */
  handleKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}

/**
 * Hook for handling vertical list navigation with keyboard support.
 *
 * @example
 * ```tsx
 * const { handleKeyDown } = useListNavigation({
 *   items: channels,
 *   selectedId: selectedChannelId,
 *   getId: (ch) => ch.channelId,
 *   onSelect: setSelectedChannelId,
 *   scrollStrategy: { type: 'virtualizer', virtualizer },
 *   onBoundaryUp: () => focusHeader(),
 * });
 *
 * return <div onKeyDown={handleKeyDown}>...</div>;
 * ```
 */
export function useListNavigation<T, K extends string | number, E extends HTMLElement = HTMLElement>({
  items,
  selectedId,
  getId,
  onSelect,
  scrollStrategy,
  onBoundaryUp,
  onBoundaryDown,
  canNavigateBoundary = () => true,
}: UseListNavigationOptions<T, K, E>): UseListNavigationReturn {
  // Track mounted state to avoid scroll/focus after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Calculate current index
  const currentIndex = useMemo(() => {
    if (selectedId === null) return -1;
    return items.findIndex((item) => getId(item) === selectedId);
  }, [items, selectedId, getId]);

  // Scroll to index using the configured strategy
  const scrollToIndex = useCallback((index: number) => {
    if (index < 0 || index >= items.length) return;

    switch (scrollStrategy.type) {
      case 'virtualizer':
        scrollStrategy.virtualizer.scrollToIndex(index, { align: 'auto' });
        break;

      case 'scrollIntoView':
        // Use requestAnimationFrame for reliable DOM timing after React render
        requestAnimationFrame(() => {
          if (!isMountedRef.current) return;
          const id = getId(items[index]);
          const element = document.getElementById(`${scrollStrategy.idPrefix}${id}`);
          element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        break;

      case 'refFocus':
        // Use queueMicrotask for immediate focus after current execution
        queueMicrotask(() => {
          if (!isMountedRef.current) return;
          scrollStrategy.refs.current?.[index]?.focus();
        });
        break;
    }
  }, [items, getId, scrollStrategy]);

  // Handle ArrowDown navigation
  const handleArrowDown = useCallback((): boolean => {
    if (items.length === 0) return false;

    // If at last item, check boundary
    if (currentIndex === items.length - 1) {
      if (canNavigateBoundary() && onBoundaryDown) {
        onBoundaryDown();
        return true;
      }
      return false;
    }

    // Calculate next index
    const nextIndex = currentIndex < 0 ? 0 : currentIndex + 1;
    if (nextIndex >= items.length) return false;

    const nextItem = items[nextIndex];
    onSelect(getId(nextItem));
    scrollToIndex(nextIndex);
    return true;
  }, [items, currentIndex, getId, onSelect, scrollToIndex, onBoundaryDown, canNavigateBoundary]);

  // Handle ArrowUp navigation
  const handleArrowUp = useCallback((): boolean => {
    if (items.length === 0) return false;

    // If at first item or no selection, check boundary
    if (currentIndex <= 0) {
      if (canNavigateBoundary() && onBoundaryUp) {
        onBoundaryUp();
        return true;
      }
      return false;
    }

    // Calculate previous index
    const prevIndex = currentIndex - 1;
    if (prevIndex < 0) return false;

    const prevItem = items[prevIndex];
    onSelect(getId(prevItem));
    scrollToIndex(prevIndex);
    return true;
  }, [items, currentIndex, getId, onSelect, scrollToIndex, onBoundaryUp, canNavigateBoundary]);

  // Full keyboard handler
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleArrowDown();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleArrowUp();
    }
  }, [handleArrowDown, handleArrowUp]);

  return {
    currentIndex,
    handleArrowUp,
    handleArrowDown,
    handleKeyDown,
  };
}
