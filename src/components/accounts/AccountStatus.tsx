import { useState } from 'react';
import { CheckCircledIcon, CrossCircledIcon, ReloadIcon } from '@radix-ui/react-icons';
import { testConnection, type TestConnectionResponse } from '../../lib/tauri';

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

  return (
    <div data-testid="account-status-container" className="flex flex-col gap-2">
      {/* Test Connection Button */}
      <button
        data-testid="test-connection-button"
        onClick={handleTestConnection}
        disabled={isLoading}
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

      {/* Error State */}
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

      {/* Initial Status (when no test has been performed) */}
      {!hasSuccessfulTest && !hasFailedTest && status && (
        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
          <span>Last status: {status}</span>
        </div>
      )}
    </div>
  );
}
