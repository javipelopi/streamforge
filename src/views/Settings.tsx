/**
 * Settings View
 * Story 1.3: Create React GUI Shell with Routing
 * Story 1.6: Add Auto-Start on Boot Capability
 * Story 2-6: Implement Scheduled EPG Refresh
 * Story 6.1: Settings GUI for Server and Startup Options
 * Story 6.2: Configuration Export/Import
 * Story 6.3: Event Logging System - Log Verbosity Settings
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import {
  getAutostartEnabled,
  setAutostartEnabled,
  getEpgSchedule,
  setEpgSchedule,
  formatScheduleTime,
  getNextScheduledRefresh,
  formatRelativeTime,
  EpgSchedule,
  getServerPort,
  setServerPort,
  restartServer,
  exportConfiguration,
  validateImportFile,
  importConfiguration,
  ImportPreview,
  getLogVerbosity,
  setLogVerbosity,
  LogVerbosity,
} from '../lib/tauri';
import { ImportPreviewDialog } from '../components/settings/ImportPreviewDialog';

/** Port validation constants */
const MIN_PORT = 1024;
const MAX_PORT = 65535;
const DEFAULT_PORT = 5004;

/** Validates port number and returns error message or null */
function validatePort(port: string): string | null {
  // Check for empty input first
  if (port.trim() === '') {
    return 'Port must be a number';
  }

  const portNum = parseInt(port, 10);
  if (isNaN(portNum)) {
    return 'Port must be a number';
  }

  // Check upper bound
  if (portNum > MAX_PORT) {
    return `Port must be ${MAX_PORT} or lower`;
  }

  // Check lower bound - must be non-privileged port
  if (portNum < MIN_PORT) {
    return 'Port must be 1024 or higher (non-privileged ports)';
  }

  return null;
}

/** Parse time string (HH:MM) to hour and minute */
function parseTimeString(time: string): { hour: number; minute: number } | null {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** Format hour and minute to HH:MM string */
function formatTimeString(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

export function Settings() {
  const navigate = useNavigate();

  // Server port state
  const [serverPort, setServerPortState] = useState<string>(DEFAULT_PORT.toString());
  const [savedServerPort, setSavedServerPort] = useState<string>(DEFAULT_PORT.toString());
  const [portError, setPortError] = useState<string | null>(null);
  const [isServerRestarting, setIsServerRestarting] = useState(false);

  // Autostart state
  const [autostartEnabled, setAutostartEnabledState] = useState(false);
  const [savedAutostartEnabled, setSavedAutostartEnabled] = useState(false);
  const [isAutostartLoading, setIsAutostartLoading] = useState(true);

  // EPG Schedule state
  const [epgSchedule, setEpgScheduleState] = useState<EpgSchedule>({
    hour: 4,
    minute: 0,
    enabled: true,
  });
  const [epgRefreshTime, setEpgRefreshTime] = useState('04:00');
  const [savedEpgRefreshTime, setSavedEpgRefreshTime] = useState('04:00');
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [savedScheduleEnabled, setSavedScheduleEnabled] = useState(true);
  const [epgTimeError, setEpgTimeError] = useState<string | null>(null);

  // Configuration export/import state (Story 6-2)
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importFileContent, setImportFileContent] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Log verbosity state (Story 6-3)
  const [logVerbosity, setLogVerbosityState] = useState<LogVerbosity>('verbose');
  const [savedLogVerbosity, setSavedLogVerbosity] = useState<LogVerbosity>('verbose');

  // General state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load all settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        setIsLoading(true);
        setError(null);

        // Load server port
        const port = await getServerPort();
        const portStr = port.toString();
        setServerPortState(portStr);
        setSavedServerPort(portStr);

        // Load autostart status
        const status = await getAutostartEnabled();
        setAutostartEnabledState(status.enabled);
        setSavedAutostartEnabled(status.enabled);
        setIsAutostartLoading(false);

        // Load EPG schedule
        const schedule = await getEpgSchedule();
        setEpgScheduleState(schedule);
        const timeStr = formatTimeString(schedule.hour, schedule.minute);
        setEpgRefreshTime(timeStr);
        setSavedEpgRefreshTime(timeStr);
        setScheduleEnabled(schedule.enabled);
        setSavedScheduleEnabled(schedule.enabled);

        // Load log verbosity (Story 6-3)
        const verbosity = await getLogVerbosity();
        setLogVerbosityState(verbosity);
        setSavedLogVerbosity(verbosity);
      } catch (err) {
        setError(`Failed to load settings: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return (
      serverPort !== savedServerPort ||
      autostartEnabled !== savedAutostartEnabled ||
      epgRefreshTime !== savedEpgRefreshTime ||
      scheduleEnabled !== savedScheduleEnabled ||
      logVerbosity !== savedLogVerbosity
    );
  }, [serverPort, savedServerPort, autostartEnabled, savedAutostartEnabled, epgRefreshTime, savedEpgRefreshTime, scheduleEnabled, savedScheduleEnabled, logVerbosity, savedLogVerbosity]);

  // Validate port on change
  const handlePortChange = useCallback((value: string) => {
    // Only allow digits
    const cleaned = value.replace(/\D/g, '');
    setServerPortState(cleaned);
    setPortError(validatePort(cleaned));
  }, []);

  // Validate EPG time on change
  const handleEpgTimeChange = useCallback((value: string) => {
    setEpgRefreshTime(value);
    const parsed = parseTimeString(value);
    if (!parsed) {
      setEpgTimeError('Invalid time format');
    } else {
      setEpgTimeError(null);
    }
  }, []);

  // Check if save button should be disabled
  const isSaveDisabled = useMemo(() => {
    if (isSaving || isServerRestarting) return true;
    if (!hasUnsavedChanges) return true;
    if (portError) return true;
    if (epgTimeError) return true;
    if (serverPort.trim() === '') return true;
    return false;
  }, [isSaving, isServerRestarting, hasUnsavedChanges, portError, epgTimeError, serverPort]);

  // Handle save all settings
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const messages: string[] = [];

      // Save server port if changed
      if (serverPort !== savedServerPort) {
        const portNum = parseInt(serverPort, 10);
        await setServerPort(portNum);
        setSavedServerPort(serverPort);

        // Note: Server restart happens on next application restart
        // The restart_server command is a placeholder in current implementation
        setIsServerRestarting(true);
        try {
          await restartServer();
          messages.push('Port saved. Restart the app to apply changes.');
        } catch (restartErr) {
          // Server restart may fail if not running - port is still saved
          console.warn('Server restart warning:', restartErr);
          messages.push('Port saved. Restart the app to apply changes.');
        } finally {
          setIsServerRestarting(false);
        }
      }

      // Save autostart if changed
      if (autostartEnabled !== savedAutostartEnabled) {
        await setAutostartEnabled(autostartEnabled);
        setSavedAutostartEnabled(autostartEnabled);
        if (autostartEnabled) {
          messages.push('Auto-start enabled');
        } else {
          messages.push('Auto-start disabled');
        }
      }

      // Save EPG schedule if changed
      if (epgRefreshTime !== savedEpgRefreshTime || scheduleEnabled !== savedScheduleEnabled) {
        const parsed = parseTimeString(epgRefreshTime);
        if (parsed) {
          const updated = await setEpgSchedule(parsed.hour, parsed.minute, scheduleEnabled);
          setEpgScheduleState(updated);
          setSavedEpgRefreshTime(epgRefreshTime);
          setSavedScheduleEnabled(scheduleEnabled);
          messages.push('EPG refresh time updated');
        }
      }

      // Save log verbosity if changed (Story 6-3)
      if (logVerbosity !== savedLogVerbosity) {
        await setLogVerbosity(logVerbosity);
        setSavedLogVerbosity(logVerbosity);
        messages.push(`Log verbosity set to ${logVerbosity}`);
      }

      // Set success message
      if (messages.length > 0) {
        setSuccessMessage(messages.join('. '));
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err) {
      setError(`Failed to save settings: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle reset to saved values
  const handleReset = useCallback(() => {
    setServerPortState(savedServerPort);
    setPortError(null);
    setAutostartEnabledState(savedAutostartEnabled);
    setEpgRefreshTime(savedEpgRefreshTime);
    setEpgTimeError(null);
    setScheduleEnabled(savedScheduleEnabled);
    setLogVerbosityState(savedLogVerbosity);
    setError(null);
    setSuccessMessage(null);
  }, [savedServerPort, savedAutostartEnabled, savedEpgRefreshTime, savedScheduleEnabled, savedLogVerbosity]);

  // Calculate next refresh time display
  const parsedTime = parseTimeString(epgRefreshTime);
  const nextRefresh = parsedTime
    ? getNextScheduledRefresh({
        hour: parsedTime.hour,
        minute: parsedTime.minute,
        enabled: scheduleEnabled,
      })
    : null;

  const nextRefreshDisplay = nextRefresh
    ? `${formatScheduleTime(nextRefresh.getHours(), nextRefresh.getMinutes())} (${formatRelativeTime(nextRefresh)})`
    : scheduleEnabled ? 'Invalid time' : 'Disabled';

  // Handle export configuration (Story 6-2, AC #1, #2)
  const handleExport = async () => {
    try {
      setIsExporting(true);
      setError(null);
      setSuccessMessage(null);

      // Get configuration JSON from backend
      const configJson = await exportConfiguration();

      // Generate default filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const defaultFilename = `streamforge-config-${timestamp}.json`;

      // Show save dialog
      const filePath = await save({
        defaultPath: defaultFilename,
        filters: [
          {
            name: 'JSON Files',
            extensions: ['json'],
          },
        ],
      });

      if (filePath) {
        // Write the file
        await writeTextFile(filePath, configJson);
        setSuccessMessage('Configuration exported successfully');
        setTimeout(() => setSuccessMessage(null), 5000);
      }
      // If user cancelled, do nothing
    } catch (err) {
      setError(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle import configuration - step 1: file selection (Story 6-2, AC #3)
  const handleImportSelect = async () => {
    try {
      setIsImporting(true);
      setError(null);
      setSuccessMessage(null);

      // Show open dialog
      const filePath = await open({
        multiple: false,
        filters: [
          {
            name: 'JSON Files',
            extensions: ['json'],
          },
        ],
      });

      if (filePath && typeof filePath === 'string') {
        // Read the file content
        const content = await readTextFile(filePath);

        // Validate file was read successfully
        if (!content || content.trim().length === 0) {
          setError('Import failed: The selected file is empty or could not be read.');
          setIsImporting(false);
          return;
        }

        setImportFileContent(content);

        // Validate and get preview
        const preview = await validateImportFile(content);
        setImportPreview(preview);
        setShowImportDialog(true);
      }
      // If user cancelled, do nothing
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('Failed to read') || errorMessage.includes('file')) {
        setError(`Failed to read file: ${errorMessage}`);
      } else {
        setError(`Import failed: ${errorMessage}`);
      }
    } finally {
      setIsImporting(false);
    }
  };

  // Handle import confirmation (Story 6-2, AC #5, #6)
  const handleImportConfirm = async () => {
    if (!importFileContent) return;

    try {
      setIsImporting(true);
      setError(null);

      const result = await importConfiguration(importFileContent);

      setShowImportDialog(false);
      setImportPreview(null);
      setImportFileContent(null);

      if (result.success) {
        // Show message about accounts needing passwords
        const accountMsg = result.accountsImported > 0
          ? ` ${result.accountsImported} account(s) imported - passwords must be re-entered.`
          : '';
        setSuccessMessage(`Configuration imported successfully.${accountMsg} Please restart the app to apply changes.`);

        // Navigate to accounts page if accounts were imported
        if (result.accountsImported > 0) {
          setTimeout(() => {
            navigate('/accounts');
          }, 3000);
        }
      } else {
        setError(`Import failed: ${result.message}`);
      }
    } catch (err) {
      setError(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Handle import cancellation
  const handleImportCancel = () => {
    setShowImportDialog(false);
    setImportPreview(null);
    setImportFileContent(null);
  };

  if (isLoading) {
    return (
      <div data-testid="settings-view" className="p-4">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <div data-testid="settings-loading-indicator" className="text-gray-500">
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div data-testid="settings-view">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        {hasUnsavedChanges && (
          <span
            data-testid="unsaved-changes-indicator"
            className="text-sm text-amber-600 font-medium"
          >
            Unsaved changes
          </span>
        )}
      </div>

      {/* Server Settings Section - AC #1, #5 */}
      <section data-testid="server-settings-section" className="mb-8">
        <h2 className="text-lg font-semibold mb-2 text-gray-700">Server Settings</h2>
        <p className="text-sm text-gray-500 mb-4">Configure the HTTP server for Plex integration</p>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label
                htmlFor="server-port"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Server Port
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="server-port"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  data-testid="server-port-input"
                  value={serverPort}
                  onChange={(e) => handlePortChange(e.target.value)}
                  disabled={isSaving || isServerRestarting}
                  className={`block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                    portError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
                  }`}
                  aria-describedby={portError ? 'port-error' : undefined}
                  aria-invalid={!!portError}
                />
                {isServerRestarting && (
                  <span className="text-sm text-blue-600">Saving port...</span>
                )}
              </div>
              {portError && (
                <p id="port-error" className="mt-1 text-sm text-red-600">
                  {portError}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Default: {DEFAULT_PORT}. Valid range: {MIN_PORT}-{MAX_PORT}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Startup Settings Section - AC #3, #5 */}
      <section data-testid="startup-settings-section" className="mb-8">
        <h2 className="text-lg font-semibold mb-2 text-gray-700">Startup Settings</h2>
        <p className="text-sm text-gray-500 mb-4">Configure application launch behavior</p>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label
                htmlFor="auto-start-toggle"
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
              {isAutostartLoading && (
                <span
                  data-testid="settings-loading-indicator"
                  className="text-sm text-gray-500"
                >
                  Loading...
                </span>
              )}

              <button
                type="button"
                role="switch"
                id="auto-start-toggle"
                data-testid="auto-start-toggle"
                onClick={() => setAutostartEnabledState(!autostartEnabled)}
                disabled={isAutostartLoading || isSaving}
                aria-checked={autostartEnabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-blue-300 ${
                  autostartEnabled ? 'bg-blue-600' : 'bg-gray-200'
                } ${(isAutostartLoading || isSaving) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white border border-gray-300 transition-transform ${
                    autostartEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
              {/* Keep legacy testid for backwards compatibility */}
              <input
                type="checkbox"
                data-testid="autostart-toggle"
                checked={autostartEnabled}
                onChange={() => setAutostartEnabledState(!autostartEnabled)}
                disabled={isAutostartLoading || isSaving}
                className="sr-only"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </section>

      {/* EPG Settings Section - AC #4, #5 */}
      <section data-testid="epg-settings-section" className="mb-8">
        <h2 className="text-lg font-semibold mb-2 text-gray-700">EPG Settings</h2>
        <p className="text-sm text-gray-500 mb-4">Configure electronic program guide refresh schedule</p>

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
                disabled={isSaving}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
            </label>
          </div>

          {/* Time Input */}
          <div className="flex items-center gap-4">
            <div>
              <label htmlFor="epg-refresh-time" className="block text-sm font-medium text-gray-700 mb-1">
                Refresh Time (24-hour format)
              </label>
              <input
                id="epg-refresh-time"
                type="time"
                data-testid="epg-refresh-time-input"
                value={epgRefreshTime}
                onChange={(e) => handleEpgTimeChange(e.target.value)}
                disabled={isSaving}
                className={`block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  epgTimeError ? 'border-red-500' : ''
                }`}
              />
              {epgTimeError && (
                <p className="mt-1 text-sm text-red-600">{epgTimeError}</p>
              )}
            </div>
          </div>

          {/* Next Refresh Display */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Next refresh:</span>
            <span
              data-testid="next-epg-refresh-display"
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
        </div>
      </section>

      {/* Logging Settings Section - Story 6-3, AC #5 */}
      <section data-testid="logging-section" className="mb-8">
        <h2 className="text-lg font-semibold mb-2 text-gray-700">Logging Settings</h2>
        <p className="text-sm text-gray-500 mb-4">Configure event logging behavior</p>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label
                htmlFor="log-verbosity-select"
                className="font-medium text-gray-900"
              >
                Log Verbosity
              </label>
              <p className="text-sm text-gray-500 mt-1">
                <strong>Verbose</strong>: Log all events including info, warnings, and errors.{' '}
                <strong>Minimal</strong>: Log only warnings and errors (info events filtered out).
              </p>
            </div>

            <select
              id="log-verbosity-select"
              data-testid="log-verbosity-select"
              value={logVerbosity}
              onChange={(e) => setLogVerbosityState(e.target.value as LogVerbosity)}
              disabled={isSaving}
              className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="verbose">Verbose</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
        </div>
      </section>

      {/* Configuration Backup Section - Story 6-2, AC #1-6 */}
      <section data-testid="config-backup-section" className="mb-8">
        <h2 className="text-lg font-semibold mb-2 text-gray-700">Configuration Backup</h2>
        <p className="text-sm text-gray-500 mb-4">
          Export your settings to a file for backup or migration to another machine.
          Import a previously exported configuration to restore settings.
        </p>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="space-y-4">
            {/* Export Section */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">Export Configuration</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Save your current settings, accounts, and EPG sources to a JSON file.
                  <span className="text-amber-600 font-medium"> Passwords are not exported for security.</span>
                </p>
              </div>
              <button
                data-testid="export-config-button"
                onClick={handleExport}
                disabled={isExporting || isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export
                  </>
                )}
              </button>
            </div>

            <hr className="border-gray-200" />

            {/* Import Section */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">Import Configuration</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Load settings from a previously exported JSON file.
                  <span className="text-red-600 font-medium"> This will replace all current settings.</span>
                </p>
              </div>
              <button
                data-testid="import-config-button"
                onClick={handleImportSelect}
                disabled={isImporting || isSaving}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isImporting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Importing...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Import
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Action Buttons */}
      <div className="flex items-center gap-4 mt-8">
        <button
          data-testid="save-settings-button"
          onClick={handleSave}
          disabled={isSaveDisabled}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>

        <button
          data-testid="reset-settings-button"
          onClick={handleReset}
          disabled={!hasUnsavedChanges || isSaving}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div
          data-testid="settings-success-message"
          role="status"
          className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm"
        >
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          data-testid="settings-error-message"
          role="alert"
          className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm"
        >
          {error}
        </div>
      )}

      {/* Import Preview Dialog - Story 6-2, AC #4 */}
      {showImportDialog && importPreview && (
        <ImportPreviewDialog
          preview={importPreview}
          isImporting={isImporting}
          onConfirm={handleImportConfirm}
          onCancel={handleImportCancel}
        />
      )}
    </div>
  );
}
