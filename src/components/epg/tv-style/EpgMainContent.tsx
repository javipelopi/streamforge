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
    <div className="flex flex-1 gap-0 min-h-0">
      {/* Left Panel - Channel List (~30%) */}
      <div
        data-testid="epg-left-panel"
        className="w-[30%] bg-black/60 overflow-hidden flex flex-col"
      >
        {leftPanel}
      </div>

      {/* Center Panel - Schedule (~30%) */}
      <div
        data-testid="epg-center-panel"
        className="w-[30%] bg-black/50 overflow-hidden flex flex-col"
      >
        {centerPanel}
      </div>

      {/* Right Panel - Details (~40%) - transparent wrapper, background handled by EpgProgramDetails */}
      <div
        data-testid="epg-right-panel"
        className="w-[40%] overflow-hidden flex flex-col"
      >
        {rightPanel}
      </div>
    </div>
  );
}
