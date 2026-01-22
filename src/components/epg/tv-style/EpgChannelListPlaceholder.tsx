/**
 * EPG TV-Style Channel List Placeholder
 * Story 5.4: EPG TV-Style Layout Foundation
 *
 * Placeholder component for the left panel channel list.
 * Will be replaced with actual channel list in Story 5.5.
 */

export function EpgChannelListPlaceholder() {
  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      <p className="text-white/70 text-center" data-testid="channel-list-placeholder">
        Channel list (Story 5.5)
      </p>
    </div>
  );
}
