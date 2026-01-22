import { useState, useCallback } from 'react';
import { EpgGrid } from '../components/epg/EpgGrid';
import { TimeNavigationBar } from '../components/epg/TimeNavigationBar';
import {
  useEpgGridData,
  getCurrentTimeWindow,
  getTonightTimeWindow,
  getTomorrowTimeWindow,
  shiftTimeWindow,
  createTimeWindow,
} from '../hooks/useEpgGridData';
import type { EpgGridProgram } from '../lib/tauri';

/**
 * EPG View - Electronic Program Guide Browser
 *
 * Story 5.1: EPG Grid Browser with Time Navigation
 * Task 6: Update EPG view page
 *
 * Features:
 * - Grid with enabled channels, time slots, program cells (AC#1)
 * - Time navigation controls (Now, Tonight, Tomorrow, +/- day, date picker) (AC#2)
 * - Responsive UI with TanStack Virtual (AC#3)
 * - Program cell click opens details panel (AC#4 - event emitted)
 * - Loading and empty states
 */
export function EPG() {
  // Initialize with current time window (3 hours centered on now)
  const initialWindow = getCurrentTimeWindow(3);
  // Store selected program for future Story 5.3 (details panel)
  const [_selectedProgram, setSelectedProgram] = useState<EpgGridProgram | null>(null);

  // Fetch EPG data
  const { data, isLoading, error, setTimeWindow } = useEpgGridData(
    initialWindow.startTime,
    initialWindow.endTime
  );

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

  // Program click handler
  const handleProgramClick = useCallback((program: EpgGridProgram) => {
    setSelectedProgram(program);
    // Note: Story 5.3 will implement the program details panel
    // For now, we just store the selection
    console.log('Program selected:', program);
  }, []);

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

      <div className="flex-1 min-h-0">
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
    </div>
  );
}
