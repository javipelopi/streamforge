import { useState, useCallback } from 'react';
import { EpgGrid } from '../components/epg/EpgGrid';
import { TimeNavigationBar } from '../components/epg/TimeNavigationBar';
import { EpgSearchInput } from '../components/epg/EpgSearchInput';
import { EpgSearchResults } from '../components/epg/EpgSearchResults';
import { ProgramDetailsPanel } from '../components/epg/ProgramDetailsPanel';
import type { ProgramDetailsData } from '../components/epg/ProgramDetailsPanel';
import {
  useEpgGridData,
  getCurrentTimeWindow,
  getTonightTimeWindow,
  getTomorrowTimeWindow,
  shiftTimeWindow,
  createTimeWindow,
} from '../hooks/useEpgGridData';
import { useEpgSearch } from '../hooks/useEpgSearch';
import { getChannelStreamInfo } from '../lib/tauri';
import type { EpgGridProgram, EpgSearchResult, ChannelStreamInfo, EpgGridChannel } from '../lib/tauri';

/**
 * EPG View - Electronic Program Guide Browser
 *
 * Story 5.1: EPG Grid Browser with Time Navigation
 * Story 5.2: EPG Search Functionality
 * Task 6: Update EPG view page with search integration
 *
 * Features:
 * - Grid with enabled channels, time slots, program cells (AC#1)
 * - Time navigation controls (Now, Tonight, Tomorrow, +/- day, date picker) (AC#2)
 * - Responsive UI with TanStack Virtual (AC#3)
 * - Program cell click opens details panel (AC#4 - event emitted)
 * - Search input with debounced search (Story 5.2 AC#1)
 * - Search results with navigation to program (Story 5.2 AC#4)
 * - Loading and empty states
 */
export function EPG() {
  // Initialize with current time window (3 hours centered on now)
  const initialWindow = getCurrentTimeWindow(3);

  // Story 5.3: Program details panel state
  const [selectedProgramDetails, setSelectedProgramDetails] = useState<ProgramDetailsData | null>(null);
  const [streamInfo, setStreamInfo] = useState<ChannelStreamInfo | null>(null);
  const [isLoadingStreamInfo, setIsLoadingStreamInfo] = useState(false);

  // Fetch EPG data
  const { data, isLoading, error, setTimeWindow } = useEpgGridData(
    initialWindow.startTime,
    initialWindow.endTime
  );

  // Search state and handlers
  const {
    query: searchQuery,
    results: searchResults,
    isSearching,
    error: searchError,
    isResultsVisible,
    onSearch,
    onClear: onSearchClear,
    onResultSelect,
  } = useEpgSearch();

  // Time navigation handlers
  const handleNow = useCallback(() => {
    const window = getCurrentTimeWindow(3);
    setTimeWindow(window.startTime, window.endTime);
  }, [setTimeWindow]);

  const handleTonight = useCallback(() => {
    const window = getTonightTimeWindow();
    setTimeWindow(window.startTime, window.endTime);
  }, [setTimeWindow]);

  const handleTomorrow = useCallback(() => {
    const window = getTomorrowTimeWindow();
    setTimeWindow(window.startTime, window.endTime);
  }, [setTimeWindow]);

  const handlePrevDay = useCallback(() => {
    if (data?.timeWindow) {
      const newWindow = shiftTimeWindow(data.timeWindow, -1);
      setTimeWindow(newWindow.startTime, newWindow.endTime);
    }
  }, [data?.timeWindow, setTimeWindow]);

  const handleNextDay = useCallback(() => {
    if (data?.timeWindow) {
      const newWindow = shiftTimeWindow(data.timeWindow, 1);
      setTimeWindow(newWindow.startTime, newWindow.endTime);
    }
  }, [data?.timeWindow, setTimeWindow]);

  const handleDateChange = useCallback(
    (date: Date) => {
      const window = createTimeWindow(date, 6);
      setTimeWindow(window.startTime, window.endTime);
    },
    [setTimeWindow]
  );

  // Program click handler - creates ProgramDetailsData from program and channel
  const handleProgramClick = useCallback(
    (program: EpgGridProgram, channel?: EpgGridChannel) => {
      // Find the channel for this program from the data
      const programChannel =
        channel ||
        data?.channels.find((ch) =>
          ch.programs.some((p) => p.id === program.id)
        );

      if (!programChannel) {
        console.error('Could not find channel for program:', program.id);
        return;
      }

      // Create ProgramDetailsData combining program and channel info
      const details: ProgramDetailsData = {
        id: program.id,
        title: program.title,
        startTime: program.startTime,
        endTime: program.endTime,
        description: program.description,
        category: program.category,
        episodeInfo: program.episodeInfo,
        channelId: programChannel.channelId,
        channelName: programChannel.channelName,
        channelIcon: programChannel.channelIcon,
      };

      setSelectedProgramDetails(details);
      setStreamInfo(null);
      setIsLoadingStreamInfo(true);

      // Fetch stream info for the channel
      getChannelStreamInfo(programChannel.channelId)
        .then((info) => {
          setStreamInfo(info);
        })
        .catch((err) => {
          console.error('Failed to fetch stream info:', err);
          setStreamInfo(null);
        })
        .finally(() => {
          setIsLoadingStreamInfo(false);
        });
    },
    [data?.channels]
  );

  // Close details panel handler
  const handleCloseDetails = useCallback(() => {
    setSelectedProgramDetails(null);
    setStreamInfo(null);
    setIsLoadingStreamInfo(false);
  }, []);

  // Search result selection handler - navigates grid to program time and opens details panel
  const handleSearchResultClick = useCallback(
    (result: EpgSearchResult) => {
      try {
        const timeWindow = onResultSelect(result);
        if (timeWindow && timeWindow.startTime && timeWindow.endTime) {
          setTimeWindow(timeWindow.startTime, timeWindow.endTime);
        }

        // Also open the details panel for this program
        const details: ProgramDetailsData = {
          id: result.programId,
          title: result.title,
          startTime: result.startTime,
          endTime: result.endTime,
          description: result.description || undefined,
          category: result.category || undefined,
          channelId: result.channelId,
          channelName: result.channelName,
          channelIcon: result.channelIcon || undefined,
        };

        setSelectedProgramDetails(details);
        setStreamInfo(null);
        setIsLoadingStreamInfo(true);

        // Fetch stream info for the channel
        getChannelStreamInfo(result.channelId)
          .then((info) => {
            setStreamInfo(info);
          })
          .catch((err) => {
            console.error('Failed to fetch stream info:', err);
            setStreamInfo(null);
          })
          .finally(() => {
            setIsLoadingStreamInfo(false);
          });
      } catch (err) {
        console.error('Failed to navigate to search result:', err);
      }
    },
    [onResultSelect, setTimeWindow]
  );

  // Loading state
  if (isLoading && !data) {
    return (
      <div data-testid="epg-view" className="flex flex-col h-full">
        <div data-testid="epg-loading-state" className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading EPG data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div data-testid="epg-view" className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-red-600">
            <p className="font-semibold">Error loading EPG data</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state - no enabled channels
  if (data && data.channels.length === 0) {
    return (
      <div data-testid="epg-view" className="flex flex-col h-full">
        {data.timeWindow && (
          <TimeNavigationBar
            timeWindow={data.timeWindow}
            onNow={handleNow}
            onTonight={handleTonight}
            onTomorrow={handleTomorrow}
            onPrevDay={handlePrevDay}
            onNextDay={handleNextDay}
            onDateChange={handleDateChange}
          />
        )}
        <div
          data-testid="epg-empty-state"
          className="flex-1 flex items-center justify-center"
        >
          <div className="text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 mx-auto text-gray-300 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">
              No Channels Enabled
            </h2>
            <p className="text-gray-500">
              Enable channels in the Channels view to see the program guide.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main EPG grid view
  return (
    <div data-testid="epg-view" className="flex flex-col h-full">
      {/* Header row with navigation and search */}
      <div className="flex items-center bg-white border-b border-gray-200">
        {/* Time navigation controls */}
        {data?.timeWindow && (
          <TimeNavigationBar
            timeWindow={data.timeWindow}
            onNow={handleNow}
            onTonight={handleTonight}
            onTomorrow={handleTomorrow}
            onPrevDay={handlePrevDay}
            onNextDay={handleNextDay}
            onDateChange={handleDateChange}
          />
        )}

        {/* Search input with results dropdown - positioned after nav bar */}
        <div className="relative ml-auto pr-3 py-2">
          <EpgSearchInput
            value={searchQuery}
            onSearch={onSearch}
            onClear={onSearchClear}
            isLoading={isSearching}
            placeholder="Search programs..."
          />
          {isResultsVisible && (
            <EpgSearchResults
              results={searchResults}
              query={searchQuery}
              onResultClick={handleSearchResultClick}
              isLoading={isSearching}
              error={searchError}
            />
          )}
        </div>
      </div>

      {/* EPG Grid */}
      <div data-testid="epg-grid" className="flex-1 min-h-0">
        {data && (
          <EpgGrid
            channels={data.channels}
            timeWindow={data.timeWindow}
            onProgramClick={handleProgramClick}
          />
        )}
      </div>

      {/* Hidden loading indicator for background refreshes */}
      {isLoading && (
        <div
          data-testid="epg-loading-state"
          className="absolute top-0 right-0 p-2"
        >
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Story 5.3: Program Details Panel */}
      <ProgramDetailsPanel
        program={selectedProgramDetails}
        onClose={handleCloseDetails}
        streamInfo={streamInfo}
        isLoadingStreamInfo={isLoadingStreamInfo}
      />
    </div>
  );
}
