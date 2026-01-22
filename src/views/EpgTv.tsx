/**
 * EPG TV-Style View
 * Story 5.4: EPG TV-Style Layout Foundation
 * Story 5.5: EPG Channel List Panel
 * Story 5.6: EPG Schedule Panel
 * Story 5.7: EPG Top Bar with Search and Day Navigation
 *
 * TV-style EPG interface with three panels over a cinematic background.
 * - Top: Fixed top bar with search and day navigation
 * - Left panel (~30%): Channel list with now-playing info
 * - Center panel (~30%): Schedule for selected channel
 * - Right panel (~40%): Program details (when selected)
 */

import { useState, useCallback, useEffect } from 'react';
import { EpgBackground } from '../components/epg/tv-style/EpgBackground';
import { EpgMainContent } from '../components/epg/tv-style/EpgMainContent';
import { EpgChannelList } from '../components/epg/tv-style/EpgChannelList';
import { EpgSchedulePanel } from '../components/epg/tv-style/EpgSchedulePanel';
import { EpgDetailsPanelPlaceholder } from '../components/epg/tv-style/EpgDetailsPanelPlaceholder';
import { EpgTopBar } from '../components/epg/tv-style/EpgTopBar';
import { useEpgDayNavigation } from '../hooks/useEpgDayNavigation';
import type { EpgSearchResult } from '../lib/tauri';

export function EpgTv() {
  // State for selected channel (Story 5.5 Task 6.2)
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);

  // State for selected program (Story 5.6 Task 8.3)
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);

  // Day navigation state (Story 5.7)
  const {
    selectedDay,
    dayOptions,
    selectDay,
    selectDate,
    goToPrevDay,
    goToNextDay,
    timeWindow,
  } = useEpgDayNavigation();

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

  // Handle day selection (Story 5.7 Task 9.2)
  const handleSelectDay = useCallback(
    (dayId: string) => {
      selectDay(dayId);
      // Clear selected program when changing days (program may not exist)
      setSelectedProgramId(null);
    },
    [selectDay]
  );

  // Handle date selection from picker (Story 5.7 Task 9.2)
  const handleSelectDate = useCallback(
    (date: Date) => {
      selectDate(date);
      // Clear selected program when changing days
      setSelectedProgramId(null);
    },
    [selectDate]
  );

  // Handle search result selection (Story 5.7 Task 9.3)
  const handleSearchResultSelect = useCallback(
    (result: EpgSearchResult) => {
      // Extract date from search result and select that day
      const resultDate = new Date(result.startTime);
      selectDate(resultDate);

      // Select the channel and program
      setSelectedChannelId(result.channelId);
      setSelectedProgramId(result.programId);
    },
    [selectDate]
  );

  // Handle Escape key for search dropdown (Story 5.7)
  useEffect(() => {
    const handleEscapeEvent = () => {
      // This event is dispatched by the search input to close dropdown
      // The actual handling is in EpgSearchInput component
    };

    window.addEventListener('epgSearchEscape', handleEscapeEvent);
    return () => window.removeEventListener('epgSearchEscape', handleEscapeEvent);
  }, []);

  return (
    <div data-testid="epg-tv-view" className="relative h-full w-full overflow-hidden">
      {/* Gradient background layer */}
      <EpgBackground />

      {/* Top bar layer (fixed, above everything) */}
      <EpgTopBar
        selectedDay={selectedDay}
        dayOptions={dayOptions}
        onSelectDay={handleSelectDay}
        onPrevDay={goToPrevDay}
        onNextDay={goToNextDay}
        onSelectDate={handleSelectDate}
        onSearchResultSelect={handleSearchResultSelect}
      />

      {/* Main content layer above background */}
      <div className="relative z-10 flex flex-col h-full pt-14">
        {/* Three-panel layout */}
        <EpgMainContent>
          {/* Left panel: Channel list (Story 5.5) */}
          <EpgChannelList
            selectedChannelId={selectedChannelId}
            onSelectChannel={handleSelectChannel}
          />
          {/* Center panel: Schedule (Story 5.6) - pass timeWindow for day navigation */}
          <EpgSchedulePanel
            selectedChannelId={selectedChannelId}
            selectedProgramId={selectedProgramId}
            onSelectProgram={handleSelectProgram}
            selectedDate={timeWindow}
          />
          {/* Right panel: Details (Story 5.8) - passes selectedProgramId for integration */}
          <EpgDetailsPanelPlaceholder isVisible={!!selectedProgramId} />
        </EpgMainContent>
      </div>
    </div>
  );
}
