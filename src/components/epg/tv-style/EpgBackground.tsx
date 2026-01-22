/**
 * EPG TV-Style Background Component
 * Story 5.4: EPG TV-Style Layout Foundation
 *
 * Renders a diagonal gradient background (purple to dark blue)
 * that covers the content area (respecting the sidebar).
 */

import { useAppStore } from '../../../stores/appStore';

export function EpgBackground() {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);

  return (
    <div
      data-testid="epg-background"
      className={`fixed top-0 right-0 bottom-0 z-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] transition-all duration-300 ${
        sidebarOpen ? 'left-64' : 'left-16'
      }`}
    />
  );
}
