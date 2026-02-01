/**
 * M3U Source Accordion Component
 * Multi-Source Stream Support: M3U Playlist Management
 *
 * Expandable accordion section for an M3U playlist source.
 * Lazy-loads channels only when expanded.
 * Shows channel count and last refresh time in header.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
  X,
  RefreshCw,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import {
  getM3uChannels,
  refreshM3uSource,
  deleteM3uSource,
  toggleM3uSource,
  type M3uSource,
  type M3uChannel,
} from '../../lib/tauri';
import {
  PaginationControls,
  PAGE_SIZE_OPTIONS,
  type PageSize,
} from '../ui/PaginationControls';

interface M3uSourceAccordionProps {
  source: M3uSource;
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

export function M3uSourceAccordion({ source }: M3uSourceAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(PAGE_SIZE_OPTIONS[1]); // Default: 50
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const contentId = `m3u-source-channels-${source.id}`;
  const queryClient = useQueryClient();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteM3uSource(source.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['m3u-sources'] });
    },
  });

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: (active: boolean) => toggleM3uSource(source.id, active),
    onSuccess: (_, active) => {
      queryClient.invalidateQueries({ queryKey: ['m3u-sources'] });
      console.log(`Source ${source.name} ${active ? 'enabled' : 'disabled'} successfully`);
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

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteConfirm(false);
  };

  const formatLastRefresh = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  // Auto-focus Cancel button when delete dialog opens
  useEffect(() => {
    if (showDeleteConfirm && cancelButtonRef.current) {
      cancelButtonRef.current.focus();
    }
  }, [showDeleteConfirm]);

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
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(true);
            }}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-200 rounded transition-colors"
            title="Delete source"
            aria-label="Delete source"
          >
            <Trash2 className="w-4 h-4" />
          </button>
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
                    <M3uChannelRow key={channel.id} channel={channel} />
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

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <DeleteConfirmDialog
          source={source}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          isDeleting={deleteMutation.isPending}
          cancelButtonRef={cancelButtonRef}
        />
      )}
    </div>
  );
}

/**
 * Validates that a URL is safe (http or https protocol only).
 * Prevents XSS via javascript: or other dangerous protocols.
 */
const isValidHttpUrl = (url: string): boolean => {
  return /^https?:\/\//i.test(url);
};

/**
 * Delete confirmation dialog with keyboard trap and focus management
 */
interface DeleteConfirmDialogProps {
  source: M3uSource;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
  cancelButtonRef: React.RefObject<HTMLButtonElement>;
}

function DeleteConfirmDialog({
  source,
  onConfirm,
  onCancel,
  isDeleting,
  cancelButtonRef,
}: DeleteConfirmDialogProps) {
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  // Handle keyboard navigation and trap focus within dialog
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
      return;
    }

    // Trap Tab key within dialog
    if (e.key === 'Tab') {
      const focusableElements = [cancelButtonRef.current, deleteButtonRef.current].filter(Boolean) as HTMLElement[];

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: move backwards
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: move forwards
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`delete-m3u-dialog-title-${source.id}`}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3
          id={`delete-m3u-dialog-title-${source.id}`}
          className="text-lg font-semibold text-gray-900 mb-2"
        >
          Delete M3U Source?
        </h3>
        <p className="text-gray-600 mb-4">
          This will delete "{source.name}" and all its channels. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelButtonRef}
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            ref={deleteButtonRef}
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Simple channel row component
function M3uChannelRow({ channel }: { channel: M3uChannel }) {
  // Security: Validate tvgLogo URL to prevent XSS via javascript: or data: URLs
  const safeLogoUrl = channel.tvgLogo && isValidHttpUrl(channel.tvgLogo)
    ? channel.tvgLogo
    : null;

  return (
    <div
      data-testid={`m3u-channel-row-${channel.id}`}
      className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50"
    >
      {/* Channel logo */}
      {safeLogoUrl ? (
        <img
          src={safeLogoUrl}
          alt=""
          className="w-10 h-10 rounded object-cover bg-gray-100"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
          <span className="text-gray-400 text-xs">TV</span>
        </div>
      )}

      {/* Channel info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">{channel.name}</div>
        {channel.groupTitle && (
          <div className="text-sm text-gray-500 truncate">{channel.groupTitle}</div>
        )}
      </div>

      {/* Stream URL indicator - only render as link if valid http/https URL */}
      {isValidHttpUrl(channel.streamUrl) ? (
        <a
          href={channel.streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
          title="Open stream URL"
          aria-label="Open stream URL in new tab"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      ) : (
        <span
          className="p-2 text-gray-300 cursor-not-allowed"
          title="Invalid URL format"
          aria-label="Stream URL is not a valid HTTP link"
        >
          <ExternalLink className="w-4 h-4" />
        </span>
      )}
    </div>
  );
}
