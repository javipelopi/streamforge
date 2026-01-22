import { useMemo } from 'react';

/**
 * Props for EpgCell component
 */
export interface EpgCellProps {
  /** Program data to display */
  program: {
    id: number;
    title: string;
    startTime: string;
    endTime: string;
    category?: string;
  };
  /** Width per 30-minute slot in pixels */
  slotWidth: number;
  /** Click handler for program selection */
  onClick: (program: EpgCellProps['program']) => void;
  /** Whether the program is currently airing */
  isCurrentlyAiring: boolean;
}

/**
 * Calculate cell width based on program duration
 *
 * @param program - Program with start/end times
 * @param slotWidth - Width per 30-minute slot
 * @returns Width in pixels
 */
function calculateCellWidth(
  program: { startTime: string; endTime: string },
  slotWidth: number
): number {
  const startTime = new Date(program.startTime);
  const endTime = new Date(program.endTime);
  const durationMinutes = (endTime.getTime() - startTime.getTime()) / (60 * 1000);
  const slots = durationMinutes / 30;
  return Math.max(slots * slotWidth, slotWidth); // Minimum of one slot width
}

/**
 * EpgCell component for displaying a single program in the EPG grid
 *
 * Story 5.1: EPG Grid Browser with Time Navigation
 * Task 4: Create program cell styling and rendering
 * AC #1: Program cells with duration-based widths
 * AC #4: Program cell click opens details panel (emits event)
 *
 * Features:
 * - Width calculated from program duration (proportional to 30-min slots)
 * - Displays program title
 * - Visual indicator for currently airing programs
 * - Hover state with pointer cursor
 * - Click handler for program selection
 * - Category-based color coding
 */
export function EpgCell({ program, slotWidth, onClick, isCurrentlyAiring }: EpgCellProps) {
  // Calculate cell width based on duration
  const cellWidth = useMemo(() => {
    return calculateCellWidth(program, slotWidth);
  }, [program, slotWidth]);

  // Determine cell classes based on state
  const cellClasses = useMemo(() => {
    const baseClasses = [
      'h-full',
      'px-3 py-2',
      'text-sm font-medium',
      'border border-gray-200',
      'rounded',
      'truncate',
      'cursor-pointer',
      'transition-all duration-150',
      'hover:shadow-md hover:scale-[1.02]',
      'flex items-center',
    ];

    // Add airing indicator class
    if (isCurrentlyAiring) {
      baseClasses.push('current-airing', 'ring-2', 'ring-blue-500', 'bg-blue-100', 'border-blue-300');
    } else {
      // Category-based coloring
      const categoryColors = getCategoryColor(program.category);
      baseClasses.push(categoryColors);
    }

    return baseClasses.join(' ');
  }, [isCurrentlyAiring, program.category]);

  const handleClick = () => {
    onClick(program);

    // Emit custom event for E2E testing
    const event = new CustomEvent('program-selected', {
      detail: { programId: program.id },
      bubbles: true,
    });
    window.dispatchEvent(event);
  };

  return (
    <div
      data-testid={`epg-program-cell-${program.id}`}
      className={cellClasses}
      style={{ width: `${cellWidth}px`, minWidth: `${slotWidth}px` }}
      onClick={handleClick}
      title={program.title}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {program.title}
    </div>
  );
}

/**
 * Get Tailwind classes for category-based coloring
 */
function getCategoryColor(category?: string): string {
  switch (category?.toLowerCase()) {
    case 'news':
      return 'bg-blue-50 text-blue-900';
    case 'sports':
      return 'bg-green-50 text-green-900';
    case 'movies':
    case 'movie':
      return 'bg-purple-50 text-purple-900';
    case 'drama':
      return 'bg-rose-50 text-rose-900';
    case 'comedy':
      return 'bg-amber-50 text-amber-900';
    case 'documentary':
      return 'bg-teal-50 text-teal-900';
    case 'kids':
    case 'children':
      return 'bg-orange-50 text-orange-900';
    case 'entertainment':
      return 'bg-indigo-50 text-indigo-900';
    case 'reality':
      return 'bg-pink-50 text-pink-900';
    default:
      return 'bg-gray-50 text-gray-900';
  }
}
