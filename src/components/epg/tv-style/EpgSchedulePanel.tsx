/**
 * EPG TV-Style Schedule Panel
 * Story 5.6: EPG Schedule Panel
 *
 * Center panel displaying the full schedule for a selected channel.
 * Shows date header, time column, program titles with NOW/PAST/FUTURE indicators.
 */

import { useRef, useEffect, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { ScheduleHeader } from './ScheduleHeader';
import { ScheduleRow } from './ScheduleRow';
import { useChannelSchedule } from '../../../hooks/useChannelSchedule';

interface EpgSchedulePanelProps {
  /** ID of the currently selected channel */
  selectedChannelId: number | null;
  /** ID of the currently selected program */
  selectedProgramId?: number | null;
  /** Callback when a program is selected */
  onSelectProgram?: (programId: number) => void;
  /** Optional time window for day navigation (Story 5.7) */
  selectedDate?: { startTime: string; endTime: string };
}

/**
 * EpgSchedulePanel - Schedule list for selected channel
 *
 * AC #1: Display schedule list with date header, time column, program titles
 * AC #2: Program selection with highlighted state and callback
 * AC #3: NOW indicator, muted past programs, auto-scroll to current
 * AC #4: Independent scrolling from channel list
 */
export function EpgSchedulePanel({
  selectedChannelId,
  selectedProgramId,
  onSelectProgram,
  selectedDate,
}: EpgSchedulePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentProgramRef = useRef<HTMLDivElement>(null);
  const { programs, isLoading, error, currentProgramId } = useChannelSchedule(
    selectedChannelId,
    selectedDate
  );

  // Auto-scroll to current program on initial load and channel change (AC #3)
  useEffect(() => {
    // Add slight delay to ensure ref is populated after render
    const timeoutId = setTimeout(() => {
      if (currentProgramRef.current && containerRef.current) {
        currentProgramRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [currentProgramId, selectedChannelId]);

  // Handle keyboard navigation (AC #2, AC #4)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!onSelectProgram || programs.length === 0) return;

      const currentIndex = selectedProgramId
        ? programs.findIndex((p) => p.id === selectedProgramId)
        : -1;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = currentIndex < programs.length - 1 ? currentIndex + 1 : currentIndex;
        if (nextIndex !== currentIndex || currentIndex === -1) {
          const nextProgram = programs[nextIndex === -1 ? 0 : nextIndex];
          onSelectProgram(nextProgram.id);

          // Scroll selected item into view
          setTimeout(() => {
            const element = document.getElementById(`schedule-row-${nextProgram.id}`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 50);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        if (prevIndex !== currentIndex) {
          const prevProgram = programs[prevIndex];
          onSelectProgram(prevProgram.id);

          // Scroll selected item into view
          setTimeout(() => {
            const element = document.getElementById(`schedule-row-${prevProgram.id}`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 50);
        }
      }
    },
    [programs, selectedProgramId, onSelectProgram]
  );

  // Handle program click
  const handleProgramClick = useCallback(
    (programId: number) => {
      onSelectProgram?.(programId);
    },
    [onSelectProgram]
  );

  // No channel selected state (Task 7.1)
  if (selectedChannelId === null) {
    return (
      <div
        data-testid="epg-schedule-panel"
        className="h-full flex flex-col bg-black/50 rounded-lg"
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
        data-testid="epg-schedule-panel"
        className="h-full flex flex-col bg-black/50 rounded-lg"
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
        data-testid="epg-schedule-panel"
        className="h-full flex flex-col bg-black/50 rounded-lg"
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
        data-testid="epg-schedule-panel"
        className="h-full flex flex-col bg-black/50 rounded-lg"
      >
        <ScheduleHeader />
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
      ref={containerRef}
      data-testid="epg-schedule-panel"
      className="h-full flex flex-col bg-black/50 rounded-lg overflow-hidden"
      tabIndex={0}
      onKeyDown={handleKeyDown}
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
}
