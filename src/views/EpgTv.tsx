/**
 * EPG TV-Style View
 * Story 5.4: EPG TV-Style Layout Foundation
 *
 * TV-style EPG interface with three panels over a cinematic background.
 * - Left panel (~30%): Channel list with now-playing info
 * - Center panel (~30%): Schedule for selected channel
 * - Right panel (~40%): Program details (when selected)
 */

import { useState } from 'react';
import { EpgBackground } from '../components/epg/tv-style/EpgBackground';
import { EpgMainContent } from '../components/epg/tv-style/EpgMainContent';
import { EpgChannelListPlaceholder } from '../components/epg/tv-style/EpgChannelListPlaceholder';
import { EpgSchedulePanelPlaceholder } from '../components/epg/tv-style/EpgSchedulePanelPlaceholder';
import { EpgDetailsPanelPlaceholder } from '../components/epg/tv-style/EpgDetailsPanelPlaceholder';

export function EpgTv() {
  // State for selected program (null initially - no program selected)
  const [selectedProgram, setSelectedProgram] = useState<{ id: string } | null>(null);

  // Toggle function for testing visibility (temporary)
  const toggleDetailsVisibility = () => {
    setSelectedProgram((prev) => (prev ? null : { id: 'test-program' }));
  };

  return (
    <div data-testid="epg-tv-view" className="relative h-full w-full overflow-hidden">
      {/* Gradient background layer */}
      <EpgBackground />

      {/* Main content layer above background */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Future: EpgTopBar (Story 5.7) */}

        {/* Temporary toggle button for testing (Task 6.5) */}
        <div className="p-2 z-20">
          <button
            data-testid="toggle-details-visibility"
            onClick={toggleDetailsVisibility}
            className="px-3 py-1 text-sm bg-white/20 hover:bg-white/30 text-white rounded transition-colors"
            aria-label="Toggle program details panel visibility"
          >
            Toggle Details Panel
          </button>
        </div>

        {/* Three-panel layout */}
        <EpgMainContent>
          <EpgChannelListPlaceholder />
          <EpgSchedulePanelPlaceholder />
          <EpgDetailsPanelPlaceholder isVisible={!!selectedProgram} />
        </EpgMainContent>
      </div>
    </div>
  );
}
