/**
 * EPG TV-Style Main Content Layout
 * Story 5.4: EPG TV-Style Layout Foundation
 *
 * Implements flex row layout with three panels:
 * - Left panel (~30%): Channel list with semi-transparent background
 * - Center panel (~30%): Schedule with semi-transparent background
 * - Right panel (~40%): Program details with semi-transparent background
 */

import { ReactNode } from 'react';

interface EpgMainContentProps {
  children: [ReactNode, ReactNode, ReactNode];
}

export function EpgMainContent({ children }: EpgMainContentProps) {
  const [leftPanel, centerPanel, rightPanel] = children;

  return (
    <div className="flex flex-1 gap-4 p-4 min-h-0">
      {/* Left Panel - Channel List (~30%) */}
      <div
        data-testid="epg-left-panel"
        className="w-[30%] rounded-lg overflow-hidden flex flex-col"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      >
        {leftPanel}
      </div>

      {/* Center Panel - Schedule (~30%) */}
      <div
        data-testid="epg-center-panel"
        className="w-[30%] rounded-lg overflow-hidden flex flex-col"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      >
        {centerPanel}
      </div>

      {/* Right Panel - Details (~40%) */}
      <div
        data-testid="epg-right-panel"
        className="w-[40%] rounded-lg overflow-hidden flex flex-col"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      >
        {rightPanel}
      </div>
    </div>
  );
}
