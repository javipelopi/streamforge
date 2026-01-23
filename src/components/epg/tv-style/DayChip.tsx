/**
 * Day Chip Component
 * Story 5.7: EPG Top Bar with Search and Day Navigation
 *
 * Individual day chip button with selected and hover states.
 * Selected state shows purple background (#6366f1).
 */

import type { DayOption } from '../../../hooks/useEpgDayNavigation';

interface DayChipProps {
  /** Day option data */
  day: DayOption;
  /** Whether this chip is currently selected */
  isSelected: boolean;
  /** Callback when chip is clicked */
  onClick: () => void;
}

/**
 * DayChip - Individual day selection chip
 *
 * AC #3: Selected chip shows purple background (#6366f1)
 * AC #3: Click handler to select day
 * Includes aria-selected for accessibility
 */
export function DayChip({ day, isSelected, onClick }: DayChipProps) {
  return (
    <button
      data-testid={`day-chip-${day.id}`}
      onClick={onClick}
      className={`
        px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap
        transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-indigo-500/50
        ${
          isSelected
            ? 'bg-[#6366f1] text-white'
            : 'bg-transparent text-white border border-white/20 hover:bg-[#6366f1]/30'
        }
      `}
      role="tab"
      aria-selected={isSelected}
      type="button"
    >
      {day.label}
    </button>
  );
}
