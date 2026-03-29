/**
 * Xtream Account Accordion Component
 * Story 3-11: Implement Sources View with Xtream Tab
 *
 * Expandable accordion section for an Xtream account.
 * Lazy-loads streams only when expanded.
 * Shows stream counts and orphan counts in header.
 */
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Loader2, Search, X, Pencil, Trash2, RefreshCw } from 'lucide-react';
import {
  getXtreamStreamsForAccount,
  getAccountStreamStats,
  scanChannels,
  toggleAccount,
  type Account,
} from '../../lib/api';
import { XtreamStreamRow } from './XtreamStreamRow';
import {
  PaginationControls,
  PAGE_SIZE_OPTIONS,
  type PageSize,
} from '../ui/PaginationControls';

interface XtreamAccountAccordionProps {
  account: Account;
  /** Callback when edit button is clicked */
  onEdit?: () => void;
  /** Callback when delete button is clicked */
  onDelete?: () => void;
}

export function XtreamAccountAccordion({ account, onEdit, onDelete }: XtreamAccountAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(PAGE_SIZE_OPTIONS[1]); // Default: 50
  const [searchQuery, setSearchQuery] = useState('');
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

  // Refresh mutation (re-scan channels from server)
  const refreshMutation = useMutation({
    mutationFn: () => scanChannels(account.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['xtream-streams', account.id] });
      queryClient.invalidateQueries({ queryKey: ['account-stream-stats', account.id] });
    },
  });

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: (active: boolean) => toggleAccount(account.id, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  // Filter streams based on search query
  const filteredStreams = useMemo(() => {
    if (!searchQuery.trim()) return streams;
    const query = searchQuery.toLowerCase();
    return streams.filter(
      (stream) =>
        stream.name.toLowerCase().includes(query) ||
        (stream.categoryName && stream.categoryName.toLowerCase().includes(query))
    );
  }, [streams, searchQuery]);

  // Paginate filtered streams
  const paginatedStreams = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredStreams.slice(startIndex, startIndex + pageSize);
  }, [filteredStreams, currentPage, pageSize]);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

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
      <div className="flex items-center bg-gray-50">
        <button
          data-testid={`xtream-account-header-${account.id}`}
          type="button"
          onClick={toggleExpanded}
          aria-expanded={isExpanded}
          aria-controls={contentId}
          className="flex-1 flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors text-left"
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
                  {/* Status badge: Active, Inactive, or Expired */}
                  {(() => {
                    const isExpired = account.expiryDate && new Date(account.expiryDate) < new Date();
                    if (!account.isActive) {
                      return (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          Inactive
                        </span>
                      );
                    }
                    if (isExpired) {
                      return (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          Expired
                        </span>
                      );
                    }
                    return (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </button>

        {/* Action buttons */}
        <div className="flex items-center gap-1 px-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMutation.mutate(!account.isActive);
            }}
            disabled={toggleMutation.isPending}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
            title={account.isActive ? 'Disable account' : 'Enable account'}
            aria-label={account.isActive ? 'Disable account' : 'Enable account'}
          >
            {toggleMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span className="text-xs">{account.isActive ? 'Disable' : 'Enable'}</span>
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              refreshMutation.mutate();
            }}
            disabled={refreshMutation.isPending}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-200 rounded transition-colors"
            title="Refresh streams from server"
            aria-label="Refresh streams from server"
          >
            {refreshMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-200 rounded transition-colors"
              title="Edit account"
              aria-label="Edit account"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-200 rounded transition-colors"
              title="Delete account"
              aria-label="Delete account"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

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

          {/* Streams list with search and pagination */}
          {!streamsLoading && !streamsError && streams.length > 0 && (
            <>
              {/* Search input */}
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search streams..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full pl-10 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => handleSearchChange('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <PaginationControls
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={filteredStreams.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />

              {/* No search results */}
              {filteredStreams.length === 0 && searchQuery && (
                <div className="p-4 text-center text-gray-500">
                  No streams match "{searchQuery}"
                </div>
              )}

              {/* Stream rows */}
              {filteredStreams.length > 0 && (
                <div className="divide-y divide-gray-100">
                  {paginatedStreams.map((stream) => (
                    <XtreamStreamRow
                      key={stream.id}
                      stream={stream}
                      accountId={account.id}
                      onUpdate={handleStreamUpdate}
                    />
                  ))}
                </div>
              )}
            </>
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
