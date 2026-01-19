import { useState } from 'react';
import { CheckCircledIcon, CrossCircledIcon, ReloadIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { testConnection, scanChannels, type TestConnectionResponse, type ScanChannelsResponse } from '../../lib/tauri';

interface AccountStatusProps {
  accountId: number;
  initialStatus?: string;
  initialExpiryDate?: string;
  initialMaxConnections?: number;
  initialActiveConnections?: number;
}

/**
 * AccountStatus component handles connection testing and status display
 * Shows loading state during test, success state with account info, or error state with suggestions
 *
 * @example
 * ```tsx
 * <AccountStatus
 *   accountId={1}
 *   initialStatus="connected"
 *   initialExpiryDate="2025-12-31T23:59:59Z"
 *   initialMaxConnections={2}
 *   initialActiveConnections={0}
 * />
 * ```
 */
export function AccountStatus({
  accountId,
  initialStatus,
  initialExpiryDate,
  initialMaxConnections,
  initialActiveConnections,
}: AccountStatusProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);
  const [isScanLoading, setIsScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanChannelsResponse | null>(null);
  const [hasAutoScanned, setHasAutoScanned] = useState(false);

  // Use test result or initial values for display
  const status = testResult?.status ?? initialStatus;
  const expiryDate = testResult?.expiryDate ?? initialExpiryDate;
  const maxConnections = testResult?.maxConnections ?? initialMaxConnections;
  const activeConnections = testResult?.activeConnections ?? initialActiveConnections;
  const hasSuccessfulTest = testResult?.success === true;
  const hasFailedTest = testResult?.success === false;

  const handleTestConnection = async () => {
    setIsLoading(true);
    setTestResult(null);
    try {
      const result = await testConnection(accountId);
      setTestResult(result);

      // AC #1: Auto-scan channels on first successful connection
      if (result.success && !hasAutoScanned && !initialStatus) {
        setHasAutoScanned(true);
        // Trigger automatic channel scan after successful connection
        handleScanChannels();
      }
    } catch (error) {
      // Handle unexpected errors
      setTestResult({
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Connection test failed',
        suggestions: ['Try again later', 'Check your network connection'],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanChannels = async () => {
    setIsScanLoading(true);
    setScanResult(null);
    try {
      const result = await scanChannels(accountId);
      setScanResult(result);
    } catch (error) {
      setScanResult({
        success: false,
        totalChannels: 0,
        newChannels: 0,
        updatedChannels: 0,
        removedChannels: 0,
        scanDurationMs: 0,
        errorMessage: error instanceof Error ? error.message : 'Channel scan failed',
      });
    } finally {
      setIsScanLoading(false);
    }
  };

  // Format duration in milliseconds to user-friendly string
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  /**
   * Format ISO date string to user-friendly display
   */
  const formatDate = (isoDate?: string): string => {
    if (!isoDate) return 'Unknown';
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoDate;
    }
  };

  // Determine if scan button should be enabled
  const canScanChannels = hasSuccessfulTest || initialStatus === 'connected';

  return (
    <div data-testid="account-status-container" className="flex flex-col gap-2">
      {/* Action Buttons Row */}
      <div className="flex flex-wrap gap-2">
        {/* Test Connection Button */}
        <button
          data-testid="test-connection-button"
          onClick={handleTestConnection}
          disabled={isLoading || isScanLoading}
          className="inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <ReloadIcon data-testid="test-connection-loading" className="w-4 h-4 animate-spin" />
              <span>Testing...</span>
            </>
          ) : (
            <>
              <ReloadIcon className="w-4 h-4" />
              <span>Test Connection</span>
            </>
          )}
        </button>

        {/* Scan Channels Button */}
        <button
          data-testid="scan-channels-button"
          onClick={handleScanChannels}
          disabled={!canScanChannels || isScanLoading || isLoading}
          className="inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={!canScanChannels ? 'Test connection first to enable channel scanning' : 'Scan and update channel list'}
        >
          {isScanLoading ? (
            <>
              <MagnifyingGlassIcon data-testid="scan-channels-loading" className="w-4 h-4 animate-pulse" />
              <span>Scanning...</span>
            </>
          ) : (
            <>
              <MagnifyingGlassIcon className="w-4 h-4" />
              <span>Scan Channels</span>
            </>
          )}
        </button>
      </div>

      {/* Success State */}
      {hasSuccessfulTest && (
        <div className="flex flex-col gap-1 mt-2">
          <div className="flex items-center gap-2">
            <CheckCircledIcon className="w-5 h-5 text-green-500" />
            <span data-testid="status-badge" className="font-medium text-green-600">
              Connected
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
            <div data-testid="expiry-date">
              <span data-testid="expiry-date-label" className="text-gray-400">
                Expires:{' '}
              </span>
              {formatDate(expiryDate)}
            </div>
            <div data-testid="tuner-info">
              <span className="text-gray-400">Tuners: </span>
              <span data-testid="tuner-active-count">{activeConnections ?? 0}</span>/
              <span data-testid="tuner-max-count">{maxConnections ?? 1}</span>
            </div>
          </div>
        </div>
      )}

      {/* Connection Error State */}
      {hasFailedTest && (
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex items-center gap-2">
            <CrossCircledIcon className="w-5 h-5 text-red-500" />
            <span data-testid="error-message" className="text-red-600">
              {testResult?.errorMessage ?? 'Connection failed'}
            </span>
          </div>
          {testResult?.suggestions && testResult.suggestions.length > 0 && (
            <ul data-testid="error-suggestions" className="list-disc list-inside text-sm text-gray-500 pl-1">
              {testResult.suggestions.map((suggestion, index) => (
                <li key={index} data-testid="error-suggestion-item">
                  {suggestion}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Scan Result - Success */}
      {scanResult?.success && (
        <div data-testid="scan-result-success" className="flex flex-col gap-1 mt-2 p-3 bg-green-50 rounded-md">
          <div className="flex items-center gap-2">
            <CheckCircledIcon className="w-5 h-5 text-green-500" />
            <span className="font-medium text-green-700">Channel scan complete</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-green-700">
            <span data-testid="scan-result-total">
              Total: <strong>{scanResult.totalChannels}</strong> channels
            </span>
            <span data-testid="scan-result-new">
              New: <strong>{scanResult.newChannels}</strong>
            </span>
            <span data-testid="scan-result-updated">
              Updated: <strong>{scanResult.updatedChannels}</strong>
            </span>
            <span data-testid="scan-result-duration">
              Duration: <strong>{formatDuration(scanResult.scanDurationMs)}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Scan Result - Error */}
      {scanResult && !scanResult.success && (
        <div data-testid="scan-result-error" className="flex flex-col gap-1 mt-2 p-3 bg-red-50 rounded-md">
          <div className="flex items-center gap-2">
            <CrossCircledIcon className="w-5 h-5 text-red-500" />
            <span data-testid="scan-error-message" className="text-red-600">
              {scanResult.errorMessage ?? 'Channel scan failed'}
            </span>
          </div>
        </div>
      )}

      {/* Initial Status (when no test has been performed) */}
      {!hasSuccessfulTest && !hasFailedTest && status && (
        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
          <span>Last status: {status}</span>
        </div>
      )}
    </div>
  );
}
