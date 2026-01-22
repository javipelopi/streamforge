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
      className="fixed inset-0 z-0"
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      }}
    />
  );
}
