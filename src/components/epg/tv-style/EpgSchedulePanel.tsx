/**
 * EPG TV-Style Schedule Panel
 * Story 5.6: EPG Schedule Panel
 *
 * Center panel displaying the full schedule for a selected channel.
 * Shows date header, time column, program titles with NOW/PAST/FUTURE indicators.
 * Supports remote-control navigation with arrow keys.
 */

import { useRef, useEffect, useCallback, forwardRef, useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import { ScheduleHeader } from './ScheduleHeader';
import { ScheduleRow } from './ScheduleRow';
import { useChannelSchedule } from '../../../hooks/useChannelSchedule';
import { useListNavigation } from '../../../hooks/useListNavigation';
import { useCombinedRef } from '../../../hooks/useFocusManager';

/** Timing constant for auto-scroll delay */
const AUTO_SCROLL_DELAY_MS = 100;

interface EpgSchedulePanelProps {
  /** ID of the currently selected channel */
  selectedChannelId: number | null;
  /** ID of the currently selected program */
  selectedProgramId?: number | null;
  /** Callback when a program is highlighted (up/down navigation) */
  onSelectProgram?: (programId: number) => void;
  /** Callback when a program is activated (click/enter/right - toggles details) */
  onProgramAction?: (programId: number) => void;
  /** Optional time window for day navigation (Story 5.7) */
  selectedDate?: { startTime: string; endTime: string };
  /** Callback when navigating up (to header) */
  onNavigateUp?: () => void;
  /** Callback when navigating left (to channel list) */
  onNavigateLeft?: () => void;
  /** Whether the details panel is currently showing */
  isDetailsOpen?: boolean;
  /** Callback to close details panel (when Left/Escape pressed while details open) */
  onCloseDetails?: () => void;
}

/**
 * EpgSchedulePanel - Schedule list for selected channel
 *
 * AC #1: Display schedule list with date header, time column, program titles
 * AC #2: Program selection with highlighted state and callback
 * AC #3: NOW indicator, muted past programs, auto-scroll to current
 * AC #4: Independent scrolling from channel list
 * AC #5: Remote-control navigation (left to channels, right to details)
 */
export const EpgSchedulePanel = forwardRef<HTMLDivElement, EpgSchedulePanelProps>(
  function EpgSchedulePanel(
    { selectedChannelId, selectedProgramId, onSelectProgram, onProgramAction, selectedDate, onNavigateUp, onNavigateLeft, isDetailsOpen = false, onCloseDetails },
    forwardedRef
  ) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Combine local ref with forwarded ref using utility hook
  const setRefs = useCombinedRef(containerRef, forwardedRef);

  const currentProgramRef = useRef<HTMLDivElement>(null);
  const { programs, isLoading, error, currentProgramId } = useChannelSchedule(
    selectedChannelId,
    selectedDate
  );

  // Track mounted state to prevent operations after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Parse selected date for header display
  const headerDate = selectedDate ? new Date(selectedDate.startTime) : new Date();

  // Auto-scroll to current program on initial load and channel change (AC #3)
  useEffect(() => {
    // Add slight delay to ensure ref is populated after render
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current && currentProgramRef.current && containerRef.current) {
        currentProgramRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, AUTO_SCROLL_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [currentProgramId, selectedChannelId]);

  // Helper to scroll to element after next paint (uses rAF for proper timing)
  const scrollToElementDeferred = useCallback((elementId: string) => {
    requestAnimationFrame(() => {
      if (!isMountedRef.current) return;
      const element = document.getElementById(elementId);
      element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, []);

  // Handle focus - auto-select current program when entering the panel and scroll to it
  const handleFocus = useCallback(() => {
    if (selectedProgramId === null && onSelectProgram) {
      // No program selected - auto-select one
      if (currentProgramId !== null) {
        // Today: select the current (NOW) program
        onSelectProgram(currentProgramId);
        scrollToElementDeferred(`schedule-row-${currentProgramId}`);
      } else if (programs.length > 0) {
        // Other day: select the first program in the list
        const firstProgramId = programs[0].id;
        onSelectProgram(firstProgramId);
        scrollToElementDeferred(`schedule-row-${firstProgramId}`);
      }
    } else if (selectedProgramId !== null) {
      // If a program is already selected, ensure it's visible
      scrollToElementDeferred(`schedule-row-${selectedProgramId}`);
    }
  }, [selectedProgramId, currentProgramId, programs, onSelectProgram, scrollToElementDeferred]);

  // Memoize scroll strategy for list navigation
  const scrollStrategy = useMemo(() => ({
    type: 'scrollIntoView' as const,
    idPrefix: 'schedule-row-',
  }), []);

  // Handle program selection for the navigation hook
  const handleSelect = useCallback((programId: number) => {
    onSelectProgram?.(programId);
  }, [onSelectProgram]);

  // Predicate for boundary navigation - only allow when details are closed
  const canNavigateBoundary = useCallback(() => !isDetailsOpen, [isDetailsOpen]);

  // Use list navigation hook for ArrowUp/Down handling
  const { handleArrowUp, handleArrowDown } = useListNavigation({
    items: programs,
    selectedId: selectedProgramId ?? null,
    getId: (p) => p.id,
    onSelect: handleSelect,
    scrollStrategy,
    onBoundaryUp: onNavigateUp,
    canNavigateBoundary,
  });

  // Handle keyboard navigation (AC #2, AC #4, AC #5)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleArrowDown();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleArrowUp();
      } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
        // If details are open, close them
        // Otherwise navigate to channel list (Left only, not Escape)
        e.preventDefault();
        if (isDetailsOpen) {
          onCloseDetails?.();
        } else if (e.key === 'ArrowLeft') {
          onNavigateLeft?.();
        }
      } else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        // Activate program - opens/toggles details (if program selected)
        e.preventDefault();
        if (selectedProgramId != null) {
          onProgramAction?.(selectedProgramId);
        }
      }
    },
    [handleArrowDown, handleArrowUp, isDetailsOpen, onNavigateLeft, onCloseDetails, selectedProgramId, onProgramAction]
  );

  // Handle program click - activates program (opens/toggles details)
  const handleProgramClick = useCallback(
    (programId: number) => {
      onProgramAction?.(programId);
      // Refocus container after click to keep keyboard nav working
      containerRef.current?.focus();
    },
    [onProgramAction]
  );

  // No channel selected state (Task 7.1)
  if (selectedChannelId === null) {
    return (
      <div
        ref={setRefs}
        data-testid="epg-schedule-panel"
        className="h-full flex flex-col bg-black/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div
          data-testid="schedule-empty-state"
          className="flex-1 flex items-center justify-center p-4 text-center"
        >
          <p className="text-white/70 text-sm">Select a channel to see schedule</p>
        </div>
      </div>
    );
  }

  // Loading state with skeleton UI (Task 7.2)
  if (isLoading) {
    return (
      <div
        ref={setRefs}
        data-testid="epg-schedule-panel"
        className="h-full flex flex-col bg-black/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {/* Date header skeleton */}
        <div className="px-4 py-4 text-center" data-testid="schedule-skeleton">
          <div className="h-5 w-32 mx-auto bg-white/10 rounded animate-pulse" />
        </div>

        {/* Schedule row skeletons */}
        <div className="flex-1 overflow-y-auto px-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 py-3 border-b border-white/5 animate-pulse"
            >
              {/* Time skeleton */}
              <div className="w-20 flex-shrink-0">
                <div className="h-4 w-16 bg-white/10 rounded" />
              </div>
              {/* Title skeleton */}
              <div className="flex-1">
                <div className="h-4 w-48 bg-white/10 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state (Task 7.4)
  if (error) {
    return (
      <div
        ref={setRefs}
        data-testid="epg-schedule-panel"
        className="h-full flex flex-col bg-black/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div
          data-testid="schedule-error-state"
          className="flex-1 flex flex-col items-center justify-center p-4 text-center gap-3"
        >
          <svg
            className="w-12 h-12 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <div>
            <p className="text-red-400 text-sm font-medium mb-1">Error Loading Schedule</p>
            <p className="text-white/60 text-xs">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // No programs found state (Task 7.3)
  if (programs.length === 0) {
    return (
      <div
        ref={setRefs}
        data-testid="epg-schedule-panel"
        className="h-full flex flex-col bg-black/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <ScheduleHeader date={headerDate} />
        <div
          data-testid="schedule-no-data"
          className="flex-1 flex items-center justify-center p-4 text-center"
        >
          <p className="text-white/70 text-sm">No schedule data available for this channel</p>
        </div>
      </div>
    );
  }

  // Calculate active descendant ID for accessibility
  const activeDescendantId = selectedProgramId
    ? `schedule-row-${selectedProgramId}`
    : undefined;

  return (
    <div
      ref={setRefs}
      data-testid="epg-schedule-panel"
      className="h-full flex flex-col bg-black/50 overflow-hidden focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      role="listbox"
      aria-label="Schedule for selected channel"
      aria-activedescendant={activeDescendantId}
    >
      {/* Date header (Task 2) */}
      <ScheduleHeader />

      {/* Schedule list with independent scrolling (AC #4) */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {programs.map((program) => (
          <ScheduleRow
            key={program.id}
            ref={program.id === currentProgramId ? currentProgramRef : undefined}
            program={program}
            isSelected={selectedProgramId === program.id}
            onClick={() => handleProgramClick(program.id)}
          />
        ))}
      </div>
    </div>
  );
});
