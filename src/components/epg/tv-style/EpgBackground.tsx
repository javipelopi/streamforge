/**
 * EPG TV-Style Background Component
 * Story 5.4: EPG TV-Style Layout Foundation
 *
 * Renders a diagonal gradient background (purple to dark blue)
 * that covers the entire viewport.
 */

export function EpgBackground() {
  return (
    <div
      data-testid="epg-background"
      className="fixed inset-0 z-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]"
    />
  );
}
