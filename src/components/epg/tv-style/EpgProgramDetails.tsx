/**
 * EPG TV-Style Program Details Panel
 * Story 5.8: EPG Program Details Panel
 *
 * Right panel displaying detailed program information including title,
 * episode info, channel badge with status, metadata, and description.
 */

import { useEffect, useRef, useMemo } from 'react';
import { Clock, Calendar } from 'lucide-react';
import { useProgramDetails } from '../../../hooks/useProgramDetails';

// Constants for styling
const STATUS_COLORS = {
  live: 'text-green-500',
  upcoming: 'text-blue-500',
  aired: 'text-gray-500',
} as const;

interface EpgProgramDetailsProps {
  /** ID of the selected program (null if none selected) */
  selectedProgramId: number | null;
  /** Callback when panel should close */
  onClose: () => void;
  /** Callback when navigating up (to header) */
  onNavigateUp?: () => void;
  /** Callback when navigating left (back to schedule panel) */
  onNavigateLeft?: () => void;
}

/**
 * Get program status based on current time
 */
function getProgramStatus(
  startTime: string,
  endTime: string
): { status: 'live' | 'upcoming' | 'aired'; label: string; colorClass: string } {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (now >= start && now <= end) {
    return { status: 'live', label: 'Live Now', colorClass: STATUS_COLORS.live };
  }

  if (now < start) {
    const diffMs = start.getTime() - now.getTime();
    const diffMinutes = Math.round(diffMs / 60000);

    if (diffMinutes < 60) {
      return {
        status: 'upcoming',
        label: `Starts in ${diffMinutes} min`,
        colorClass: STATUS_COLORS.upcoming,
      };
    }
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) {
      return {
        status: 'upcoming',
        label: `Starts in ${diffHours}h`,
        colorClass: STATUS_COLORS.upcoming,
      };
    }
    return {
      status: 'upcoming',
      label: `Starts ${formatTime(start)}`,
      colorClass: STATUS_COLORS.upcoming,
    };
  }

  return { status: 'aired', label: `Aired at ${formatTime(start)}`, colorClass: STATUS_COLORS.aired };
}

/**
 * Format time for display (e.g., "8:00 AM")
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Format time range for display (e.g., "8:00 AM - 9:30 AM")
 */
function formatTimeRange(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${start.toLocaleTimeString('en-US', options)} - ${end.toLocaleTimeString('en-US', options)}`;
}

/**
 * Format full date (e.g., "Tuesday, January 21")
 */
function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Parse categories from comma-separated string
 */
function parseCategories(category: string | undefined): string[] {
  if (!category) return [];
  return category.split(',').map((c) => c.trim()).filter(Boolean);
}

/**
 * EpgProgramDetails - Right panel program details
 *
 * AC #1: Display detailed program information
 * AC #2: Show empty state when no program selected
 * AC #3: Close panel on Escape or outside click
 */
export function EpgProgramDetails({ selectedProgramId, onClose, onNavigateUp, onNavigateLeft }: EpgProgramDetailsProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { programWithChannel, isLoading, error } = useProgramDetails(selectedProgramId);

  // Handle keyboard navigation - Escape or Left arrow to close
  // Only add global listener when details panel is showing a program
  // Note: Up/Down/Enter are handled by EpgSchedulePanel
  useEffect(() => {
    // Don't add global listener when panel is empty - let other panels handle keys
    if (selectedProgramId === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Escape closes details panel
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        // Left arrow closes details panel
        e.preventDefault();
        onNavigateLeft?.();
      }
      // Note: ArrowUp/ArrowDown/Enter are NOT handled here - they're handled by EpgSchedulePanel
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedProgramId, onClose, onNavigateLeft]);

  // Calculate program status - memoize to avoid recalculating on every render
  const programStatus = useMemo(() => {
    if (!programWithChannel?.program) return null;
    return getProgramStatus(
      programWithChannel.program.startTime,
      programWithChannel.program.endTime
    );
  }, [programWithChannel]);

  // Format metadata - memoize
  const metadata = useMemo(() => {
    if (!programWithChannel?.program) return null;
    return {
      timeRange: formatTimeRange(
        programWithChannel.program.startTime,
        programWithChannel.program.endTime
      ),
      fullDate: formatFullDate(programWithChannel.program.startTime),
      categories: parseCategories(programWithChannel.program.category),
    };
  }, [programWithChannel]);

  // Empty state (AC #2) - show when no program is selected
  if (selectedProgramId === null) {
    return (
      <section
        data-testid="epg-program-details"
        className="h-full w-full bg-black/50 rounded-lg flex items-center justify-center"
        aria-label="Program details panel - no program selected"
      >
        <p
          data-testid="details-empty-state"
          className="text-white/50 text-sm text-center"
        >
          Select a program to see details
        </p>
      </section>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <section
        data-testid="epg-program-details"
        className="h-full w-full bg-black/50 rounded-lg p-8"
        aria-label="Program details loading"
        aria-busy="true"
      >
        <div data-testid="details-loading" className="animate-pulse space-y-4">
          {/* Title skeleton */}
          <div className="h-8 w-3/4 bg-white/10 rounded" />
          {/* Episode info skeleton */}
          <div className="h-4 w-1/2 bg-white/10 rounded" />
          {/* Channel badge skeleton */}
          <div className="flex items-center gap-3 mt-6">
            <div className="w-12 h-9 bg-white/10 rounded" />
            <div className="space-y-2">
              <div className="h-4 w-24 bg-white/10 rounded" />
              <div className="h-3 w-16 bg-white/10 rounded" />
            </div>
          </div>
          {/* Metadata skeleton */}
          <div className="border-t border-white/10 pt-4 mt-4 space-y-3">
            <div className="h-4 w-40 bg-white/10 rounded" />
            <div className="h-4 w-36 bg-white/10 rounded" />
          </div>
          {/* Description skeleton */}
          <div className="border-t border-white/10 pt-4 mt-4 space-y-2">
            <div className="h-4 w-full bg-white/10 rounded" />
            <div className="h-4 w-full bg-white/10 rounded" />
            <div className="h-4 w-2/3 bg-white/10 rounded" />
          </div>
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section
        data-testid="epg-program-details"
        className="h-full w-full bg-black/50 rounded-lg p-8 flex flex-col items-center justify-center"
        aria-label="Program details error"
      >
        <div data-testid="details-error" className="text-center">
          <p className="text-red-400 text-sm font-medium mb-1">Error Loading Program</p>
          <p className="text-white/60 text-xs">{error}</p>
        </div>
      </section>
    );
  }

  // No program data found
  if (!programWithChannel) {
    return (
      <section
        data-testid="epg-program-details"
        className="h-full w-full bg-black/50 rounded-lg flex items-center justify-center"
        aria-label="Program details - not found"
      >
        <p className="text-white/50 text-sm text-center">Program not found</p>
      </section>
    );
  }

  const { program, channel } = programWithChannel;

  return (
    <section
      ref={panelRef}
      data-testid="epg-program-details"
      className="h-full w-full bg-black/50 rounded-lg p-8 flex flex-col overflow-hidden"
      role="complementary"
      aria-label="Program details"
    >
      {/* Program Header (Task 2) */}
      <div className="flex-shrink-0">
        {/* Program title (Task 2.1) */}
        <h2
          data-testid="program-title"
          className="text-2xl md:text-3xl font-bold text-white line-clamp-2 pr-8"
        >
          {program.title}
        </h2>

        {/* Episode info (Task 2.2, 2.3) */}
        {program.episodeInfo && (
          <p data-testid="episode-info" className="text-base text-white/60 mt-1">
            {program.episodeInfo}
          </p>
        )}
      </div>

      {/* Channel Badge Section (Task 3) */}
      <div data-testid="channel-badge" className="flex items-center gap-3 mt-6">
        {/* Channel logo (Task 3.1) */}
        {channel.icon ? (
          <img
            src={channel.icon}
            alt={`${channel.displayName} logo`}
            className="w-12 h-9 object-contain rounded"
          />
        ) : (
          <div className="w-12 h-9 bg-white/10 rounded flex items-center justify-center">
            <span className="text-white/40 text-xs">TV</span>
          </div>
        )}

        <div>
          {/* Channel name (Task 3.2) */}
          <p className="text-base font-bold text-white">{channel.displayName}</p>

          {/* Status indicator (Task 3.3, 3.4) */}
          {programStatus && (
            <p
              data-testid="program-status"
              className={`text-sm ${programStatus.colorClass}`}
              aria-live="polite"
            >
              {programStatus.label}
            </p>
          )}
        </div>
      </div>

      {/* Divider (Task 4.4) */}
      <hr className="border-white/10 my-4" role="separator" />

      {/* Program Metadata Section (Task 4) */}
      <div className="flex-shrink-0 space-y-2">
        {/* Time range with clock icon (Task 4.1) */}
        {metadata && (
          <>
            <div data-testid="program-time" className="flex items-center gap-2 text-sm text-white">
              <Clock className="w-4 h-4 text-white/70" aria-hidden="true" />
              <span>{metadata.timeRange}</span>
            </div>

            {/* Full date with calendar icon (Task 4.2) */}
            <div data-testid="program-date" className="flex items-center gap-2 text-sm text-white/70">
              <Calendar className="w-4 h-4" aria-hidden="true" />
              <span>{metadata.fullDate}</span>
            </div>

            {/* Category/genre tags (Task 4.3) */}
            {metadata.categories.length > 0 && (
              <div
                data-testid="program-categories"
                className="flex flex-wrap gap-2 mt-2"
                role="list"
                aria-label="Program categories"
              >
                {metadata.categories.map((category, index) => (
                  <span
                    key={index}
                    role="listitem"
                    className="px-2 py-1 text-xs rounded-full bg-white/10 text-white/80"
                  >
                    {category}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Divider (Task 4.4) */}
      <hr className="border-white/10 my-4" role="separator" />

      {/* Program Description Section (Task 5) */}
      <div
        data-testid="program-description"
        className="flex-1 overflow-y-auto text-sm md:text-base text-white/70 leading-relaxed"
      >
        {program.description ? (
          <p>{program.description}</p>
        ) : (
          <p className="text-white/40 italic">No description available</p>
        )}
      </div>
    </section>
  );
}
