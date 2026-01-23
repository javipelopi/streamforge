/**
 * useFocusManager Hook
 *
 * Consolidates focus strategies for keyboard-driven navigation.
 * Provides reusable functions for focusing elements within containers.
 */

import { useCallback } from 'react';

/** Default selector for focusable elements */
const DEFAULT_FOCUSABLE_SELECTOR = '[tabindex="0"], button:not([disabled]), input:not([disabled])';

export interface UseFocusManagerReturn {
  /**
   * Focus the first focusable element in a container.
   * Falls back to the container itself if no focusable elements found.
   * @param container The container element to search within
   * @param selector Optional custom CSS selector for focusable elements
   * @returns true if an element was focused, false otherwise
   */
  focusFirst: (container: HTMLElement | null, selector?: string) => boolean;

  /**
   * Focus the last focusable element in a container.
   * Falls back to the container itself if no focusable elements found.
   * @param container The container element to search within
   * @param selector Optional custom CSS selector for focusable elements
   * @returns true if an element was focused, false otherwise
   */
  focusLast: (container: HTMLElement | null, selector?: string) => boolean;

  /**
   * Focus an element at a specific index in a refs array.
   * @param refs Ref containing array of elements
   * @param index Index of the element to focus
   * @returns true if the element was focused, false otherwise
   */
  focusByIndex: (refs: React.RefObject<(HTMLElement | null)[]>, index: number) => boolean;

  /**
   * Generate an active descendant ID for accessibility.
   * Returns undefined if no ID is selected.
   * @param prefix The ID prefix (e.g., 'channel-row-', 'schedule-row-')
   * @param id The selected item's ID
   * @returns The formatted ID string or undefined
   */
  getActiveDescendantId: (prefix: string, id: number | string | null) => string | undefined;
}

/**
 * Hook providing focus management utilities for keyboard navigation.
 *
 * @example
 * ```tsx
 * const { focusFirst, focusLast, getActiveDescendantId } = useFocusManager();
 *
 * // Focus first focusable element in header
 * focusFirst(headerRef.current);
 *
 * // Focus last button in a toolbar
 * focusLast(toolbarRef.current, 'button');
 *
 * // Get ARIA active descendant ID
 * const activeId = getActiveDescendantId('item-', selectedId);
 * ```
 */
export function useFocusManager(): UseFocusManagerReturn {
  const focusFirst = useCallback(
    (container: HTMLElement | null, selector: string = DEFAULT_FOCUSABLE_SELECTOR): boolean => {
      if (!container) return false;

      const focusable = container.querySelector<HTMLElement>(selector);
      if (focusable) {
        focusable.focus();
        return true;
      }

      // Fall back to container if it's focusable
      if (container.tabIndex >= 0) {
        container.focus();
        return true;
      }

      return false;
    },
    []
  );

  const focusLast = useCallback(
    (container: HTMLElement | null, selector: string = DEFAULT_FOCUSABLE_SELECTOR): boolean => {
      if (!container) return false;

      const focusables = container.querySelectorAll<HTMLElement>(selector);
      if (focusables.length > 0) {
        const lastFocusable = focusables[focusables.length - 1];
        lastFocusable.focus();
        return true;
      }

      // Fall back to container if it's focusable
      if (container.tabIndex >= 0) {
        container.focus();
        return true;
      }

      return false;
    },
    []
  );

  const focusByIndex = useCallback(
    (refs: React.RefObject<(HTMLElement | null)[]>, index: number): boolean => {
      const elements = refs.current;
      if (!elements || index < 0 || index >= elements.length) return false;

      const element = elements[index];
      if (element) {
        element.focus();
        return true;
      }

      return false;
    },
    []
  );

  const getActiveDescendantId = useCallback(
    (prefix: string, id: number | string | null): string | undefined => {
      if (id === null || id === undefined) return undefined;
      return `${prefix}${id}`;
    },
    []
  );

  return {
    focusFirst,
    focusLast,
    focusByIndex,
    getActiveDescendantId,
  };
}
