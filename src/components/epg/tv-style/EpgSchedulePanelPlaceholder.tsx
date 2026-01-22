/**
 * EPG TV-Style Schedule Panel Placeholder
 * Story 5.4: EPG TV-Style Layout Foundation
 *
 * Placeholder component for the center panel schedule.
 * Will be replaced with actual schedule panel in Story 5.6.
 */

export function EpgSchedulePanelPlaceholder() {
  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      {/* Date header placeholder */}
      <div className="mb-4 pb-2 border-b border-white/20" data-testid="schedule-date-header-placeholder">
        <p className="text-white/50 text-sm">Date header (Story 5.6)</p>
      </div>

      <p className="text-white/70 text-center" data-testid="schedule-panel-placeholder">
        Schedule panel (Story 5.6)
      </p>
    </div>
  );
}
