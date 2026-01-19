/**
 * Settings View
 * Story 1.3: Create React GUI Shell with Routing
 * Story 1.6: Add Auto-Start on Boot Capability
 * Story 2-6: Implement Scheduled EPG Refresh
 */
import { useState, useEffect } from 'react';
import {
  getAutostartEnabled,
  setAutostartEnabled,
  getEpgSchedule,
  setEpgSchedule,
  formatScheduleTime,
  getNextScheduledRefresh,
  formatRelativeTime,
  EpgSchedule,
} from '../lib/tauri';

export function Settings() {
  const [autostartEnabled, setAutostartEnabledState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // EPG Schedule state
  const [epgSchedule, setEpgScheduleState] = useState<EpgSchedule>({
    hour: 4,
    minute: 0,
    enabled: true,
  });
  const [scheduleHour, setScheduleHour] = useState(4);
  const [scheduleMinute, setScheduleMinute] = useState(0);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [isScheduleLoading, setIsScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState(false);

  // Load autostart status on mount
  useEffect(() => {
    async function loadAutostartStatus() {
      try {
        setIsLoading(true);
        setError(null);
        const status = await getAutostartEnabled();
        setAutostartEnabledState(status.enabled);
      } catch (err) {
        setError(`Failed to load autostart status: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsLoading(false);
      }
    }
    loadAutostartStatus();
  }, []);

  // Load EPG schedule on mount
  useEffect(() => {
    async function loadEpgSchedule() {
      try {
        setIsScheduleLoading(true);
        setScheduleError(null);
        const schedule = await getEpgSchedule();
        setEpgScheduleState(schedule);
        setScheduleHour(schedule.hour);
        setScheduleMinute(schedule.minute);
        setScheduleEnabled(schedule.enabled);
      } catch (err) {
        setScheduleError(`Failed to load EPG schedule: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsScheduleLoading(false);
      }
    }
    loadEpgSchedule();
  }, []);

  // Handle toggle change
  async function handleAutostartToggle() {
    const newValue = !autostartEnabled;
    try {
      setIsLoading(true);
      setError(null);
      await setAutostartEnabled(newValue);
      setAutostartEnabledState(newValue);
    } catch (err) {
      setError(`Failed to ${newValue ? 'enable' : 'disable'} autostart: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }

  // Handle EPG schedule save
  async function handleScheduleSave() {
    try {
      setIsScheduleLoading(true);
      setScheduleError(null);
      setScheduleSuccess(false);
      const updated = await setEpgSchedule(scheduleHour, scheduleMinute, scheduleEnabled);
      setEpgScheduleState(updated);
      setScheduleSuccess(true);
      // Clear success message after 3 seconds
      setTimeout(() => setScheduleSuccess(false), 3000);
    } catch (err) {
      setScheduleError(`Failed to save EPG schedule: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsScheduleLoading(false);
    }
  }

  // Generate hour options (0-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  // Generate minute options (0, 15, 30, 45)
  const minuteOptions = [0, 15, 30, 45];

  // Calculate next refresh time display
  const nextRefresh = getNextScheduledRefresh({
    hour: scheduleHour,
    minute: scheduleMinute,
    enabled: scheduleEnabled,
  });

  const nextRefreshDisplay = nextRefresh
    ? `${formatScheduleTime(nextRefresh.getHours(), nextRefresh.getMinutes())} (${formatRelativeTime(nextRefresh)})`
    : 'Disabled';

  return (
    <div data-testid="settings-view">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Startup Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-700">Startup</h2>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label
                htmlFor="autostart-toggle"
                data-testid="autostart-toggle-label"
                className="font-medium text-gray-900"
              >
                Start on boot
              </label>
              <p className="text-sm text-gray-500 mt-1">
                Automatically launch the app when you log in to your computer
              </p>
            </div>

            <div className="flex items-center gap-3">
              {isLoading && (
                <span
                  data-testid="settings-loading-indicator"
                  className="text-sm text-gray-500"
                >
                  Loading...
                </span>
              )}

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="autostart-toggle"
                  type="checkbox"
                  data-testid="autostart-toggle"
                  checked={autostartEnabled}
                  onChange={handleAutostartToggle}
                  disabled={isLoading}
                  className="absolute w-11 h-6 opacity-0 cursor-pointer peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed pointer-events-none"></div>
              </label>
            </div>
          </div>

          {error && (
            <div
              data-testid="settings-error-message"
              className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm"
            >
              {error}
            </div>
          )}
        </div>
      </section>

      {/* EPG Schedule Section */}
      <section data-testid="epg-schedule-section" className="mb-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-700">Automatic EPG Refresh</h2>

        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label
                htmlFor="epg-schedule-enabled-toggle"
                className="font-medium text-gray-900"
              >
                Enable automatic refresh
              </label>
              <p className="text-sm text-gray-500 mt-1">
                Automatically refresh EPG data daily at the scheduled time
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="epg-schedule-enabled-toggle"
                type="checkbox"
                data-testid="epg-schedule-enabled-toggle"
                checked={scheduleEnabled}
                onChange={() => setScheduleEnabled(!scheduleEnabled)}
                disabled={isScheduleLoading}
                className="absolute w-11 h-6 opacity-0 cursor-pointer peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed pointer-events-none"></div>
            </label>
          </div>

          {/* Time Selection */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="epg-schedule-hour" className="text-sm font-medium text-gray-700">
                Hour:
              </label>
              <select
                id="epg-schedule-hour"
                data-testid="epg-schedule-hour-select"
                value={scheduleHour}
                onChange={(e) => setScheduleHour(parseInt(e.target.value, 10))}
                disabled={isScheduleLoading}
                className="block w-20 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {hourOptions.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="epg-schedule-minute" className="text-sm font-medium text-gray-700">
                Minute:
              </label>
              <select
                id="epg-schedule-minute"
                data-testid="epg-schedule-minute-select"
                value={scheduleMinute}
                onChange={(e) => setScheduleMinute(parseInt(e.target.value, 10))}
                disabled={isScheduleLoading}
                className="block w-20 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {minuteOptions.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Next Refresh Display */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Next refresh:</span>
            <span
              data-testid="epg-schedule-next-refresh"
              className={`text-sm font-medium ${scheduleEnabled ? 'text-gray-900' : 'text-gray-400'}`}
            >
              {nextRefreshDisplay}
            </span>
          </div>

          {/* Last Refresh Display */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Last automatic refresh:</span>
            <span
              data-testid="epg-schedule-last-refresh"
              className="text-sm font-medium text-gray-900"
            >
              {epgSchedule.lastScheduledRefresh
                ? formatRelativeTime(epgSchedule.lastScheduledRefresh)
                : 'Never'}
            </span>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-4 pt-2">
            <button
              data-testid="epg-schedule-save-button"
              onClick={handleScheduleSave}
              disabled={isScheduleLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isScheduleLoading ? 'Saving...' : 'Save Schedule'}
            </button>

            {scheduleSuccess && (
              <span
                data-testid="toast"
                role="status"
                className="text-sm text-green-600 font-medium"
              >
                Schedule saved successfully
              </span>
            )}
          </div>

          {/* Error Display */}
          {scheduleError && (
            <div
              data-testid="epg-schedule-error-message"
              className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm"
            >
              {scheduleError}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
