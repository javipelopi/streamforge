/**
 * EPG TV-Style View
 * Story 5.4: EPG TV-Style Layout Foundation
 * Story 5.5: EPG Channel List Panel
 * Story 5.6: EPG Schedule Panel
 * Story 5.7: EPG Top Bar with Search and Day Navigation
 * Story 5.8: EPG Program Details Panel
 *
 * TV-style EPG interface with three panels over a cinematic background.
 * - Top: Fixed top bar with search and day navigation
 * - Left panel (~30%): Channel list with now-playing info
 * - Center panel (~30%): Schedule for selected channel
 * - Right panel (~40%): Program details (when selected)
 */

import { useState, useCallback, useEffect, useRef } from 'react';

/** Timing constant for auto-focus delay after mount */
const AUTO_FOCUS_DELAY_MS = 100;
import { EpgBackground } from '../components/epg/tv-style/EpgBackground';
import { EpgMainContent } from '../components/epg/tv-style/EpgMainContent';
import { EpgChannelList } from '../components/epg/tv-style/EpgChannelList';
import { EpgSchedulePanel } from '../components/epg/tv-style/EpgSchedulePanel';
import { EpgProgramDetails } from '../components/epg/tv-style/EpgProgramDetails';
import { EpgTopBar } from '../components/epg/tv-style/EpgTopBar';
import { useEpgDayNavigation } from '../hooks/useEpgDayNavigation';
import { useEpgNavigation } from '../hooks/useEpgNavigation';
import type { EpgSearchResult } from '../lib/tauri';

export function EpgTv() {
  // State for selected channel (Story 5.5 Task 6.2)
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);

  // State for highlighted program in schedule (visual selection only)
  const [highlightedProgramId, setHighlightedProgramId] = useState<number | null>(null);

  // State for program shown in details panel (only set on explicit Right/Enter)
  const [detailsProgramId, setDetailsProgramId] = useState<number | null>(null);

  // EPG navigation for remote-control friendly keyboard navigation
  const {
    headerRef,
    channelsRef,
    scheduleRef,
    detailsRef,
    focusPanel,
    navigateFromHeader,
    navigateFromChannels,
    navigateFromSchedule,
  } = useEpgNavigation();

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
    // Clear highlighted and details program when changing channels
    setHighlightedProgramId(null);
    setDetailsProgramId(null);
  }, []);

  // Handle program highlight in schedule (up/down navigation only)
  // When details panel is open, also update details to show highlighted program
  const handleHighlightProgram = useCallback((programId: number) => {
    setHighlightedProgramId(programId);
    // If details panel is open, keep it synced with the highlighted program
    if (detailsProgramId !== null) {
      setDetailsProgramId(programId);
    }
  }, [detailsProgramId]);

  // Handle program action (click/enter/right) - toggles details
  // If same program is showing, close details; otherwise open details for this program
  const handleProgramAction = useCallback((programId: number) => {
    setHighlightedProgramId(programId);
    if (detailsProgramId === programId) {
      // Same program - close details
      setDetailsProgramId(null);
    } else {
      // Different program or details closed - open details
      setDetailsProgramId(programId);
    }
  }, [detailsProgramId]);

  // Handle closing program details (Story 5.8 Task 9)
  const handleCloseDetails = useCallback(() => {
    setDetailsProgramId(null);
    // Return focus to schedule panel after closing details
    focusPanel('schedule');
  }, [focusPanel]);

  // Handle navigation from channel list to schedule (focus schedule panel)
  const handleNavigateToSchedule = useCallback(() => {
    focusPanel('schedule');
  }, [focusPanel]);


  // Handle day selection (Story 5.7 Task 9.2)
  const handleSelectDay = useCallback(
    (dayId: string) => {
      selectDay(dayId);
      // Clear programs when changing days (program may not exist)
      setHighlightedProgramId(null);
      setDetailsProgramId(null);
    },
    [selectDay]
  );

  // Handle date selection from picker (Story 5.7 Task 9.2)
  const handleSelectDate = useCallback(
    (date: Date) => {
      selectDate(date);
      // Clear programs when changing days
      setHighlightedProgramId(null);
      setDetailsProgramId(null);
    },
    [selectDate]
  );

  // Handle search result selection (Story 5.7 Task 9.3)
  const handleSearchResultSelect = useCallback(
    (result: EpgSearchResult) => {
      if (result.resultType === 'channel') {
        // Channel-only result: select channel without changing date
        setSelectedChannelId(result.channelId);
        setHighlightedProgramId(null);
        setDetailsProgramId(null);
        // Focus channel list for keyboard navigation
        setTimeout(() => focusPanel('channels'), 0);
      } else if (result.startTime && result.programId) {
        // Program result: navigate to date, select channel, and show details
        const resultDate = new Date(result.startTime);
        selectDate(resultDate);
        setSelectedChannelId(result.channelId);
        setHighlightedProgramId(result.programId);
        setDetailsProgramId(result.programId);
        // Focus schedule panel for keyboard navigation
        setTimeout(() => focusPanel('schedule'), 0);
      }
    },
    [selectDate, focusPanel]
  );

  // Track mounted state to avoid focus operations after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Auto-focus channel list when EPG view mounts for immediate keyboard navigation
  useEffect(() => {
    // Small delay to ensure the component is fully rendered
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current) {
        focusPanel('channels');
      }
    }, AUTO_FOCUS_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, [focusPanel]);

  return (
    <div data-testid="epg-tv-view" className="relative h-full w-full overflow-hidden">
      {/* Gradient background layer */}
      <EpgBackground />

      {/* Top bar layer (fixed, above everything) */}
      <EpgTopBar
        ref={headerRef}
        selectedDay={selectedDay}
        dayOptions={dayOptions}
        onSelectDay={handleSelectDay}
        onPrevDay={goToPrevDay}
        onNextDay={goToNextDay}
        onSelectDate={handleSelectDate}
        onSearchResultSelect={handleSearchResultSelect}
        onNavigateDown={() => navigateFromHeader('down')}
      />

      {/* Main content layer above background */}
      <div className="relative z-10 flex flex-col h-full pt-14">
        {/* Three-panel layout */}
        <EpgMainContent>
          {/* Left panel: Channel list (Story 5.5) */}
          <EpgChannelList
            ref={channelsRef}
            selectedChannelId={selectedChannelId}
            onSelectChannel={handleSelectChannel}
            onNavigateUp={() => navigateFromChannels('up')}
            onNavigateRight={handleNavigateToSchedule}
            onNavigateLeft={handleCloseDetails}
          />
          {/* Center panel: Schedule (Story 5.6) - pass timeWindow for day navigation */}
          <EpgSchedulePanel
            ref={scheduleRef}
            selectedChannelId={selectedChannelId}
            selectedProgramId={highlightedProgramId}
            onSelectProgram={handleHighlightProgram}
            onProgramAction={handleProgramAction}
            selectedDate={timeWindow}
            isDetailsOpen={detailsProgramId !== null}
            onNavigateUp={() => {
              setHighlightedProgramId(null);
              focusPanel('header');
            }}
            onNavigateLeft={() => {
              setHighlightedProgramId(null);
              navigateFromSchedule('left');
            }}
            onCloseDetails={handleCloseDetails}
          />
          {/* Right panel: Program Details (Story 5.8) */}
          <div ref={detailsRef} className="relative">
            <EpgProgramDetails
              selectedProgramId={detailsProgramId}
              onClose={handleCloseDetails}
              onNavigateUp={() => focusPanel('header')}
              onNavigateLeft={handleCloseDetails}
            />
          </div>
        </EpgMainContent>
      </div>
    </div>
  );
}
