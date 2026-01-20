/**
 * PlexConfigSection Component
 * Story 4-6: Display Plex Configuration URLs
 *
 * Displays all URLs needed to configure Plex tuner:
 * - M3U Playlist URL
 * - EPG/XMLTV URL
 * - HDHomeRun URL
 * - Tuner count
 *
 * Includes copy-to-clipboard functionality with toast notifications.
 */
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Check, AlertCircle, Server } from 'lucide-react';
import { getPlexConfig } from '../../lib/tauri';

/** Props for ConfigUrlRow component */
interface ConfigUrlRowProps {
  label: string;
  description: string;
  url: string;
  disabled?: boolean;
  testIdPrefix: string;
  onCopy: (url: string) => void;
  copySuccess: string | null;
}

/**
 * Reusable URL row component with copy functionality
 */
function ConfigUrlRow({
  label,
  description,
  url,
  disabled = false,
  testIdPrefix,
  onCopy,
  copySuccess,
}: ConfigUrlRowProps) {
  const isCopied = copySuccess === url;

  return (
    <div className="flex flex-col space-y-1">
      <div className="flex items-center justify-between">
        <label
          data-testid={`${testIdPrefix}-url-label`}
          className="text-sm font-medium text-gray-900"
        >
          {label}
        </label>
      </div>
      <span
        data-testid={`${testIdPrefix}-url-description`}
        className="text-xs text-gray-500"
      >
        {description}
      </span>
      <div className="flex items-center gap-2">
        {disabled ? (
          <span
            data-testid={`${testIdPrefix}-url-value`}
            className="flex-1 text-sm font-mono bg-gray-100 px-3 py-2 rounded text-gray-400"
          >
            Unavailable
          </span>
        ) : (
          <code
            data-testid={`${testIdPrefix}-url-value`}
            className="flex-1 text-sm font-mono bg-gray-100 px-3 py-2 rounded text-gray-700 overflow-x-auto"
          >
            {url}
          </code>
        )}
        <button
          data-testid={`${testIdPrefix}-url-copy-button`}
          onClick={() => onCopy(url)}
          disabled={disabled}
          className={`p-2 rounded-md transition-colors ${
            disabled
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : isCopied
              ? 'bg-green-100 text-green-600'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
          }`}
          title={disabled ? 'Server not running' : 'Copy to clipboard'}
        >
          {isCopied ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * PlexConfigSection - Main component displaying Plex configuration URLs
 */
export function PlexConfigSection() {
  const [toast, setToast] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // Fetch Plex configuration
  const {
    data: config,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['plexConfig'],
    queryFn: getPlexConfig,
    refetchInterval: 30000, // Refresh every 30s in case IP changes
    staleTime: 10000,
  });

  // Show toast notification
  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Copy URL to clipboard
  const handleCopy = useCallback(
    async (url: string) => {
      try {
        await navigator.clipboard.writeText(url);
        setCopySuccess(url);
        showToast('URL copied to clipboard');
        setTimeout(() => setCopySuccess(null), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        showToast('Failed to copy URL');
      }
    },
    [showToast]
  );

  // Loading state
  if (isLoading) {
    return (
      <div
        data-testid="plex-config-section"
        className="bg-white rounded-lg shadow p-6"
      >
        <h2
          data-testid="plex-config-title"
          className="text-lg font-semibold mb-4"
        >
          Plex Integration
        </h2>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        data-testid="plex-config-section"
        className="bg-white rounded-lg shadow p-6"
      >
        <h2
          data-testid="plex-config-title"
          className="text-lg font-semibold mb-4"
        >
          Plex Integration
        </h2>
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>Failed to load configuration. </span>
          <button
            onClick={() => refetch()}
            className="underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Validate config data structure with proper type guards
  const serverRunning = config?.server_running ?? false;
  const hasValidConfig = config &&
    typeof config.local_ip === 'string' &&
    typeof config.port === 'number' &&
    typeof config.m3u_url === 'string' &&
    typeof config.epg_url === 'string' &&
    typeof config.hdhr_url === 'string' &&
    typeof config.tuner_count === 'number';

  // If config is invalid/malformed, treat as error state
  if (config && !hasValidConfig) {
    console.error('Invalid PlexConfig structure received from backend:', config);
    return (
      <div
        data-testid="plex-config-section"
        className="bg-white rounded-lg shadow p-6"
      >
        <h2
          data-testid="plex-config-title"
          className="text-lg font-semibold mb-4"
        >
          Plex Integration
        </h2>
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>Invalid configuration data received. Please try reloading.</span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="plex-config-section"
      className="bg-white rounded-lg shadow p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2
          data-testid="plex-config-title"
          className="text-lg font-semibold"
        >
          Plex Integration
        </h2>
        <div
          data-testid="server-status-indicator"
          className={`flex items-center gap-1.5 text-sm ${
            serverRunning ? 'text-green-600' : 'text-amber-600'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>{serverRunning ? 'Server Running' : 'Server Stopped'}</span>
        </div>
      </div>

      {/* Server not running warning */}
      {!serverRunning && (
        <div
          data-testid="server-warning"
          className="bg-amber-50 border border-amber-200 rounded p-3 mb-4 flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <span
              data-testid="server-warning-text"
              className="text-amber-800 text-sm"
            >
              HTTP server is not running. Start the server to enable Plex
              integration URLs.
            </span>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* M3U Playlist URL */}
        <ConfigUrlRow
          label="M3U Playlist URL"
          description="Use this URL in Plex as the tuner playlist source"
          url={config?.m3u_url ?? ''}
          disabled={!serverRunning}
          testIdPrefix="m3u"
          onCopy={handleCopy}
          copySuccess={copySuccess}
        />

        {/* EPG/XMLTV URL */}
        <ConfigUrlRow
          label="EPG/XMLTV URL"
          description="Use this URL in Plex for electronic program guide data"
          url={config?.epg_url ?? ''}
          disabled={!serverRunning}
          testIdPrefix="epg"
          onCopy={handleCopy}
          copySuccess={copySuccess}
        />

        {/* HDHomeRun URL */}
        <ConfigUrlRow
          label="HDHomeRun URL"
          description="Base URL for manual HDHomeRun tuner configuration"
          url={config?.hdhr_url ?? ''}
          disabled={!serverRunning}
          testIdPrefix="hdhr"
          onCopy={handleCopy}
          copySuccess={copySuccess}
        />

        {/* Tuner Count */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div>
            <span
              data-testid="tuner-count-label"
              className="text-sm font-medium text-gray-900"
            >
              Tuner count
            </span>
            <p className="text-xs text-gray-500">
              Maximum concurrent streams available
            </p>
          </div>
          <span
            data-testid="tuner-count-value"
            className="text-lg font-semibold text-gray-900"
          >
            {config?.tuner_count ?? 0}
          </span>
        </div>
      </div>

      {/* Toast notification with proper z-index stacking */}
      {toast && (
        <div
          data-testid="toast-notification"
          className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg z-[9999] animate-in fade-in slide-in-from-bottom-2 pointer-events-none"
        >
          <span data-testid="toast-message">{toast}</span>
        </div>
      )}
    </div>
  );
}
