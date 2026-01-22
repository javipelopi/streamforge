/**
 * EPG TV-Style Details Panel Placeholder
 * Story 5.4: EPG TV-Style Layout Foundation
 *
 * Placeholder component for the right panel program details.
 * Shows gradient background only when no program is selected.
 * Will be replaced with actual details panel in Story 5.8.
 */

interface EpgDetailsPanelPlaceholderProps {
  isVisible: boolean;
}

export function EpgDetailsPanelPlaceholder({ isVisible }: EpgDetailsPanelPlaceholderProps) {
  // When not visible (no program selected), show empty state with gradient showing through
  if (!isVisible) {
    return <section className="h-full" aria-label="Program details panel - no program selected" />;
  }

  // When visible (program selected), show placeholder content
  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      <div data-testid="epg-details-content">
        <p className="text-white/70 text-center" data-testid="details-placeholder-text">
          Program details (Story 5.8)
        </p>
      </div>
    </div>
  );
}
