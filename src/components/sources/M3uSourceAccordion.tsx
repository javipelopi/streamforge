/**
 * M3U Source Accordion Component
 * Multi-Source Stream Support: M3U Playlist Management
 * Sources-Centric UX Unification: Phase 4.3
 *
 * Expandable accordion section for an M3U playlist source.
 * Lazy-loads channels only when expanded.
 * Shows channel count and last refresh time in header.
 */
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
  X,
  RefreshCw,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  getM3uChannels,
  refreshM3uSource,
  toggleM3uSource,
  type M3uSource,
} from '../../lib/api';
import {
  PaginationControls,
  PAGE_SIZE_OPTIONS,
  type PageSize,
} from '../ui/PaginationControls';
import { M3uChannelRow } from './M3uChannelRow';

interface M3uSourceAccordionProps {
  source: M3uSource;
  /** Callback when edit button is clicked */
  onEdit?: () => void;
  /** Callback when delete button is clicked */
  onDelete?: () => void;
}

/**
 * Custom hook for debouncing a value
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds
 * @returns The debounced value
 */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function M3uSourceAccordion({ source, onEdit, onDelete }: M3uSourceAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(PAGE_SIZE_OPTIONS[1]); // Default: 50
  const [searchQuery, setSearchQuery] = useState('');
  const contentId = `m3u-source-channels-${source.id}`;
  const queryClient = useQueryClient();

  // Debounce search query with 300ms delay
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  // Lazy-load channels only when expanded
  const {
    data: channels = [],
    isLoading: channelsLoading,
    error: channelsError,
    refetch: refetchChannels,
  } = useQuery({
    queryKey: ['m3u-channels', source.id],
    queryFn: () => getM3uChannels(source.id),
    enabled: isExpanded,
    staleTime: 30000, // 30 seconds
  });

  // Refresh mutation
  const refreshMutation = useMutation({
    mutationFn: () => refreshM3uSource(source.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['m3u-sources'] });
      queryClient.invalidateQueries({ queryKey: ['m3u-channels', source.id] });
    },
  });

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: (active: boolean) => toggleM3uSource(source.id, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['m3u-sources'] });
    },
  });

  // Filter channels based on debounced search query
  const filteredChannels = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return channels;
    const query = debouncedSearchQuery.toLowerCase();
    return channels.filter(
      (channel) =>
        channel.name.toLowerCase().includes(query) ||
        (channel.groupTitle && channel.groupTitle.toLowerCase().includes(query)) ||
        (channel.tvgName && channel.tvgName.toLowerCase().includes(query))
    );
  }, [channels, debouncedSearchQuery]);

  // Paginate filtered channels
  const paginatedChannels = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredChannels.slice(startIndex, startIndex + pageSize);
  }, [filteredChannels, currentPage, pageSize]);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleRetry = () => {
    refetchChannels();
  };

  // Handler for channel row updates (e.g., promote to lineup)
  const handleChannelUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['m3u-channels', source.id] });
    queryClient.invalidateQueries({ queryKey: ['m3u-sources'] });
  };

  const formatLastRefresh = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <div
      data-testid={`m3u-source-accordion-${source.id}`}
      className="border border-gray-200 rounded-lg overflow-hidden"
    >
      {/* Accordion Header */}
      <div className="flex items-center bg-gray-50">
        <button
          data-testid={`m3u-source-header-${source.id}`}
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
              <span className="font-medium text-gray-900">{source.name}</span>
              <span
                data-testid={`channel-count-${source.id}`}
                className="text-sm text-gray-500"
              >
                {channelsLoading
                  ? '...'
                  : channels.length > 0
                  ? `${channels.length} channel${channels.length === 1 ? '' : 's'}`
                  : 'Expand to view'}
              </span>
              {/* Active status badge */}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  source.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {source.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <span className="text-xs text-gray-400">
            Last refresh: {formatLastRefresh(source.lastRefresh)}
          </span>
        </button>

        {/* Action buttons */}
        <div className="flex items-center gap-1 px-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMutation.mutate(!source.isActive);
            }}
            disabled={toggleMutation.isPending}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
            title={source.isActive ? 'Disable source' : 'Enable source'}
            aria-label={source.isActive ? 'Disable source' : 'Enable source'}
          >
            {toggleMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span className="text-xs">{source.isActive ? 'Disable' : 'Enable'}</span>
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              refreshMutation.mutate();
            }}
            disabled={refreshMutation.isPending}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-200 rounded transition-colors"
            title="Refresh playlist"
            aria-label="Refresh playlist"
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
              title="Edit source"
              aria-label="Edit source"
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
              title="Delete source"
              aria-label="Delete source"
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
          data-testid={`m3u-source-channels-${source.id}`}
          className="border-t border-gray-200"
        >
          {/* Loading state */}
          {channelsLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-500">Loading channels...</span>
            </div>
          )}

          {/* Error state with retry */}
          {channelsError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded m-2">
              <p className="text-red-700 mb-2">
                Failed to load channels: {channelsError instanceof Error ? channelsError.message : String(channelsError)}
              </p>
              <button
                onClick={handleRetry}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors inline-flex items-center gap-2"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          )}

          {/* Channels list with search and pagination */}
          {!channelsLoading && !channelsError && channels.length > 0 && (
            <>
              {/* Search input */}
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search channels..."
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
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <PaginationControls
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={filteredChannels.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />

              {/* No search results */}
              {filteredChannels.length === 0 && searchQuery && (
                <div className="p-4 text-center text-gray-500">
                  No channels match "{searchQuery}"
                </div>
              )}

              {/* Channel rows */}
              {filteredChannels.length > 0 && (
                <div className="divide-y divide-gray-100">
                  {paginatedChannels.map((channel) => (
                    <M3uChannelRow
                      key={channel.id}
                      channel={channel}
                      sourceId={source.id}
                      onUpdate={handleChannelUpdate}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Empty channels */}
          {!channelsLoading && !channelsError && channels.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              No channels found. Try refreshing the playlist.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
