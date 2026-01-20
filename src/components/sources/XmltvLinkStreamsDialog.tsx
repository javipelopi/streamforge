/**
 * XMLTV Link Streams Dialog Component
 *
 * Dialog for viewing matched Xtream streams and searching/adding new ones
 * from the XMLTV Sources view. Uses fuzzy matching search.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, Search } from 'lucide-react';
import {
  getXmltvChannelsWithMappings,
  addManualStreamMapping,
  removeStreamMapping,
  setPrimaryStream,
  searchXtreamStreams,
  getQualityBadgeClasses,
  type XmltvSourceChannel,
  type XtreamStreamSearchResult,
} from '../../lib/tauri';
import { MatchedStreamsList } from '../channels/MatchedStreamsList';
import { TOAST_DURATION_MS } from '../../lib/constants';

interface XmltvLinkStreamsDialogProps {
  channel: XmltvSourceChannel;
  sourceId: number;
  onClose: () => void;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

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

export function XmltvLinkStreamsDialog({
  channel,
  sourceId,
  onClose,
}: XmltvLinkStreamsDialogProps) {
  const [searchQuery, setSearchQuery] = useState(channel.displayName);
  const [searchResults, setSearchResults] = useState<XtreamStreamSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addingStreamId, setAddingStreamId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Store toast timeout to prevent memory leak
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search query
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch channel with mappings to get the matches
  const { data: channelsWithMappings = [], isLoading } = useQuery({
    queryKey: ['xmltv-channels-with-mappings'],
    queryFn: getXmltvChannelsWithMappings,
  });

  // Find the current channel's data with matches
  const channelWithMappings = channelsWithMappings.find((c) => c.id === channel.id);
  const matches = channelWithMappings?.matches ?? [];

  // Search for streams when query changes
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    searchXtreamStreams(debouncedSearch)
      .then((results) => {
        setSearchResults(results);
      })
      .catch((err) => {
        console.error('Failed to search streams:', err);
        setSearchResults([]);
        setSearchError('Failed to search streams. Please try again.');
      })
      .finally(() => {
        setIsSearching(false);
      });
  }, [debouncedSearch]);

  // Show toast notification - clears previous timeout to prevent memory leak
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ show: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, TOAST_DURATION_MS);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Invalidate relevant queries after changes
  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['xmltv-channels-with-mappings'] });
    queryClient.invalidateQueries({ queryKey: ['xmltv-source-channels', sourceId] });
  }, [queryClient, sourceId]);

  // Mutation for adding stream mapping
  const addMutation = useMutation({
    mutationFn: ({ streamId, setAsPrimary }: { streamId: number; setAsPrimary: boolean }) =>
      addManualStreamMapping(channel.id, streamId, setAsPrimary),
    onSuccess: (_data, variables) => {
      invalidateQueries();
      setAddingStreamId(null);
      const actionText = variables.setAsPrimary ? 'added as primary' : 'added as backup';
      showToast(`Stream ${actionText}`, 'success');
    },
    onError: (error: Error) => {
      setAddingStreamId(null);
      showToast(error.message || 'Failed to add stream', 'error');
    },
  });

  // Mutation for removing stream mapping
  const removeMutation = useMutation({
    mutationFn: (mappingId: number) => removeStreamMapping(mappingId),
    onSuccess: () => {
      invalidateQueries();
      showToast('Stream removed', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to remove stream', 'error');
    },
  });

  // Mutation for setting primary stream
  const setPrimaryMutation = useMutation({
    mutationFn: (xtreamChannelId: number) => setPrimaryStream(channel.id, xtreamChannelId),
    onSuccess: () => {
      invalidateQueries();
      showToast('Primary stream updated', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to update primary stream', 'error');
    },
  });

  // Handle adding stream
  const handleAddStream = useCallback(
    (streamId: number, setAsPrimary: boolean) => {
      setAddingStreamId(streamId);
      addMutation.mutate({ streamId, setAsPrimary });
    },
    [addMutation]
  );

  // Handle remove mapping
  const handleRemoveMapping = useCallback(
    async (mappingId: number) => {
      await removeMutation.mutateAsync(mappingId);
    },
    [removeMutation]
  );

  // Handle make primary
  const handleMakePrimary = useCallback(
    (xtreamChannelId: number) => {
      setPrimaryMutation.mutate(xtreamChannelId);
    },
    [setPrimaryMutation]
  );

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const isUpdating = addMutation.isPending || removeMutation.isPending || setPrimaryMutation.isPending;

  // Check if a stream is already matched to this channel
  const isStreamMatched = useCallback(
    (streamId: number) => {
      return matches.some((m) => m.id === streamId);
    },
    [matches]
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-semibold">Matched Streams</h2>
            <p className="text-sm text-gray-500 mt-1">{channel.displayName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-500">Loading...</span>
            </div>
          ) : (
            <>
              {/* Current matches */}
              {matches.length > 0 && (
                <div className="px-6 pt-6 pb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Current Streams ({matches.length})
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <MatchedStreamsList
                      matches={matches}
                      onMakePrimary={handleMakePrimary}
                      onRemoveMapping={handleRemoveMapping}
                      isUpdating={isUpdating}
                    />
                  </div>
                </div>
              )}

              {/* Search section - always visible */}
              <div className="px-6 py-4 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Search and Add Streams
                </h3>

                {/* Search input */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search Xtream streams..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Search results */}
                <div className="border rounded-md max-h-64 overflow-y-auto">
                  {isSearching ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                      <span className="ml-2 text-gray-500">Searching...</span>
                    </div>
                  ) : searchError ? (
                    <div className="p-4 text-center text-red-600">{searchError}</div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      {searchQuery.trim() ? 'No streams match your search' : 'Enter a search query'}
                    </div>
                  ) : (
                    <>
                      <div className="px-3 py-1 text-xs text-gray-500 bg-gray-50 border-b">
                        {searchResults.length} stream{searchResults.length !== 1 ? 's' : ''} found
                      </div>
                      <div className="divide-y">
                        {searchResults.map((stream) => {
                          const alreadyMatched = isStreamMatched(stream.id);
                          const isAdding = addingStreamId === stream.id;

                          return (
                            <div
                              key={stream.id}
                              className={`px-4 py-3 flex items-center gap-3 ${
                                alreadyMatched ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'
                              }`}
                            >
                              {/* Stream info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900 truncate">
                                    {stream.name}
                                  </span>
                                  {stream.fuzzyScore !== null && (
                                    <span className="text-xs text-gray-400">
                                      {Math.round(stream.fuzzyScore * 100)}%
                                    </span>
                                  )}
                                  {alreadyMatched && (
                                    <span className="text-xs text-green-600 font-medium">
                                      Already added
                                    </span>
                                  )}
                                </div>
                                {stream.categoryName && (
                                  <div className="text-xs text-gray-500 truncate">
                                    {stream.categoryName}
                                  </div>
                                )}
                              </div>

                              {/* Quality badges */}
                              <div className="flex gap-1 flex-shrink-0">
                                {stream.qualities.slice(0, 2).map((quality, idx) => (
                                  <span
                                    key={idx}
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getQualityBadgeClasses(quality)}`}
                                  >
                                    {quality}
                                  </span>
                                ))}
                                {stream.qualities.length > 2 && (
                                  <span className="text-xs text-gray-400">
                                    +{stream.qualities.length - 2}
                                  </span>
                                )}
                              </div>

                              {/* Action buttons */}
                              {!alreadyMatched && (
                                <div className="flex gap-1 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleAddStream(stream.id, true)}
                                    disabled={isAdding || isUpdating}
                                    className="px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    {isAdding ? '...' : 'Primary'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddStream(stream.id, false)}
                                    disabled={isAdding || isUpdating}
                                    className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    Backup
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        {/* Toast notification */}
        {toast.show && (
          <div
            className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
              toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}
            role="alert"
            aria-live="polite"
          >
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
