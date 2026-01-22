/**
 * EPG TV-Style View
 * Story 5.4: EPG TV-Style Layout Foundation
 * Story 5.5: EPG Channel List Panel
 * Story 5.6: EPG Schedule Panel
 *
 * TV-style EPG interface with three panels over a cinematic background.
 * - Left panel (~30%): Channel list with now-playing info
 * - Center panel (~30%): Schedule for selected channel
 * - Right panel (~40%): Program details (when selected)
 */

import { useState, useCallback } from 'react';
import { EpgBackground } from '../components/epg/tv-style/EpgBackground';
import { EpgMainContent } from '../components/epg/tv-style/EpgMainContent';
import { EpgChannelList } from '../components/epg/tv-style/EpgChannelList';
import { EpgSchedulePanel } from '../components/epg/tv-style/EpgSchedulePanel';
import { EpgDetailsPanelPlaceholder } from '../components/epg/tv-style/EpgDetailsPanelPlaceholder';

export function EpgTv() {
  // State for selected channel (Story 5.5 Task 6.2)
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);

  // State for selected program (Story 5.6 Task 8.3)
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);

  // Handle channel selection (Story 5.5 Task 6.3)
  const handleSelectChannel = useCallback((channelId: number) => {
    setSelectedChannelId(channelId);
    // Clear selected program when changing channels
    setSelectedProgramId(null);
  }, []);

  // Handle program selection (Story 5.6 Task 8.4)
  const handleSelectProgram = useCallback((programId: number) => {
    setSelectedProgramId(programId);
  }, []);

  return (
    <div data-testid="epg-tv-view" className="relative h-full w-full overflow-hidden">
      {/* Gradient background layer */}
      <EpgBackground />

      {/* Main content layer above background */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Future: EpgTopBar (Story 5.7) */}

        {/* Three-panel layout */}
        <EpgMainContent>
          {/* Left panel: Channel list (Story 5.5) */}
          <EpgChannelList
            selectedChannelId={selectedChannelId}
            onSelectChannel={handleSelectChannel}
          />
          {/* Center panel: Schedule (Story 5.6) */}
          <EpgSchedulePanel
            selectedChannelId={selectedChannelId}
            selectedProgramId={selectedProgramId}
            onSelectProgram={handleSelectProgram}
          />
          {/* Right panel: Details (Story 5.8) - passes selectedProgramId for integration */}
          <EpgDetailsPanelPlaceholder isVisible={!!selectedProgramId} />
        </EpgMainContent>
      </div>
    </div>
  );
}
