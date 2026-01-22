/**
 * EPG TV-Style Progress Bar
 * Story 5.5: EPG Channel List Panel
 *
 * Visual progress indicator for currently airing programs.
 *
 * Visual Design Requirements (from ux-epg-tv-guide.md):
 * - Height: 3px
 * - Background: rgba(255,255,255,0.2)
 * - Fill: gradient from #6366f1 (purple) to #22d3ee (cyan)
 * - Rounded ends
 */

import { memo } from 'react';

interface EpgProgressBarProps {
  /** Progress percentage (0-100) */
  percent: number;
}

/**
 * EpgProgressBar - Visual progress indicator for program elapsed time
 */
export const EpgProgressBar = memo(function EpgProgressBar({
  percent,
}: EpgProgressBarProps) {
  // Clamp percent between 0 and 100
  const clampedPercent = Math.max(0, Math.min(100, percent));

  return (
    <div
      data-testid="progress-bar"
      className="w-full h-[3px] rounded-full bg-white/20"
      role="progressbar"
      aria-valuenow={Math.round(clampedPercent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        data-testid="progress-fill"
        className="h-full rounded-full"
        style={{
          width: `${clampedPercent}%`,
          background: 'linear-gradient(to right, #6366f1, #22d3ee)',
        }}
      />
    </div>
  );
});
