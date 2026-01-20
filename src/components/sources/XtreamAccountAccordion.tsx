/**
 * Xtream Account Accordion Component
 * Story 3-11: Implement Sources View with Xtream Tab
 *
 * Expandable accordion section for an Xtream account.
 * Lazy-loads streams only when expanded.
 * Shows stream counts and orphan counts in header.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import {
  getXtreamStreamsForAccount,
  getAccountStreamStats,
  type Account,
} from '../../lib/tauri';
import { XtreamStreamRow } from './XtreamStreamRow';

interface XtreamAccountAccordionProps {
  account: Account;
}

export function XtreamAccountAccordion({ account }: XtreamAccountAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = `xtream-account-streams-${account.id}`;
  const queryClient = useQueryClient();

  // Fetch stream stats for header counts (always enabled)
  // Code Review Fix #2: Add error state and retry for stats query
  const {
    data: stats,
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['account-stream-stats', account.id],
    queryFn: () => getAccountStreamStats(account.id),
    staleTime: 60000, // 1 minute
  });

  // Lazy-load streams only when expanded
  const {
    data: streams = [],
    isLoading: streamsLoading,
    error: streamsError,
    refetch: refetchStreams,
  } = useQuery({
    queryKey: ['xtream-streams', account.id],
    queryFn: () => getXtreamStreamsForAccount(account.id),
    enabled: isExpanded,
    staleTime: 30000, // 30 seconds
  });

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleRetry = () => {
    refetchStreams();
  };

  // Invalidate stats and streams when actions are performed
  const handleStreamUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['account-stream-stats', account.id] });
    queryClient.invalidateQueries({ queryKey: ['xtream-streams', account.id] });
  };

  return (
    <div
      data-testid={`xtream-account-accordion-${account.id}`}
      className="border border-gray-200 rounded-lg overflow-hidden"
    >
      {/* Accordion Header */}
      <button
        data-testid={`xtream-account-header-${account.id}`}
        type="button"
        onClick={toggleExpanded}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500" />
          )}
          <div className="flex items-center gap-3">
            <span className="font-medium text-gray-900">{account.name}</span>
            {/* Code Review Fix #2: Show error state for stats with retry button */}
            {statsError ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  refetchStats();
                }}
                className="text-xs text-red-600 hover:text-red-700 underline"
                title="Failed to load stats. Click to retry."
              >
                Stats error - retry
              </button>
            ) : (
              <>
                <span
                  data-testid={`stream-count-${account.id}`}
                  className="text-sm text-gray-500"
                >
                  {stats?.streamCount ?? '...'} stream{(stats?.streamCount ?? 0) !== 1 ? 's' : ''}
                </span>
                {/* Orphan count badge - only show if > 0 */}
                {stats && stats.orphanCount > 0 && (
                  <span
                    data-testid={`orphan-count-badge-${account.id}`}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800"
                  >
                    {stats.orphanCount} orphan{stats.orphanCount !== 1 ? 's' : ''}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        {/* Connection status indicator */}
        {account.connectionStatus && (
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              account.connectionStatus === 'connected'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {account.connectionStatus}
          </span>
        )}
      </button>

      {/* Accordion Content */}
      {isExpanded && (
        <div
          id={contentId}
          data-testid={`xtream-account-streams-${account.id}`}
          className="border-t border-gray-200"
        >
          {/* Loading state */}
          {streamsLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-500">Loading streams...</span>
            </div>
          )}

          {/* Error state */}
          {streamsError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded m-2">
              <p className="text-red-700 mb-2">Failed to load streams</p>
              <button
                onClick={handleRetry}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Streams list */}
          {!streamsLoading && !streamsError && streams.length > 0 && (
            <div className="divide-y divide-gray-100">
              {streams.map((stream) => (
                <XtreamStreamRow
                  key={stream.id}
                  stream={stream}
                  accountId={account.id}
                  onUpdate={handleStreamUpdate}
                />
              ))}
            </div>
          )}

          {/* Empty streams */}
          {/* Code Review Fix #4: More actionable empty state message */}
          {!streamsLoading && !streamsError && streams.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              No streams found. Refresh your account in Accounts to load streams.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
