import { useCallback, useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DraggableXmltvChannelsList } from '../components/channels/DraggableXmltvChannelsList';
import { BulkActionToolbar } from '../components/channels/BulkActionToolbar';
import {
  getXmltvChannelsWithMappings,
  toggleXmltvChannel,
  setPrimaryStream,
  addManualStreamMapping,
  removeStreamMapping,
  updateChannelOrder,
  bulkToggleChannels,
  type XmltvChannelWithMappings,
  type XtreamStreamMatch,
} from '../lib/tauri';

/**
 * Channels View - Displays XMLTV channels with their matched Xtream streams
 *
 * Story 3-2: Display XMLTV Channel List with Match Status
 * Story 3-3: Manual Match Override via Search Dropdown
 * Story 3-6: Drag-and-Drop Channel Reordering
 *
 * CRITICAL DESIGN PRINCIPLE: XMLTV channels are the PRIMARY channel list for Plex.
 * This view shows XMLTV channels as the primary list, with their matched Xtream streams.
 */
export function Channels() {
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  // Store previous order for rollback on error
  const previousOrderRef = useRef<XmltvChannelWithMappings[] | null>(null);

  // Story 3-7: Selection state for bulk operations
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<number>>(new Set());
  // Category filter state for AC #5
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 5000);
  }, []);

  // Story 3-7: Selection management callbacks
  const toggleChannelSelection = useCallback((channelId: number) => {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedChannelIds(new Set());
  }, []);

  // Fetch XMLTV channels with mappings using TanStack Query
  const {
    data: channels = [],
    isLoading,
    error,
    refetch,
  } = useQuery<XmltvChannelWithMappings[], Error>({
    queryKey: ['xmltv-channels-with-mappings'],
    queryFn: getXmltvChannelsWithMappings,
    staleTime: 30000, // 30 seconds
  });

  // Toggle channel mutation
  const toggleMutation = useMutation({
    mutationFn: (channelId: number) => toggleXmltvChannel(channelId),
    onSuccess: (updatedChannel) => {
      // Update cache optimistically
      queryClient.setQueryData<XmltvChannelWithMappings[]>(
        ['xmltv-channels-with-mappings'],
        (old) =>
          old?.map((ch) =>
            ch.id === updatedChannel.id ? updatedChannel : ch
          )
      );
    },
    onError: (err) => {
      // Standardized error handling: show toast then refetch
      showToast(`Failed to toggle channel: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      refetch();
    },
  });

  // Set primary stream mutation
  const setPrimaryMutation = useMutation({
    mutationFn: ({
      xmltvChannelId,
      xtreamChannelId,
    }: {
      xmltvChannelId: number;
      xtreamChannelId: number;
    }) => setPrimaryStream(xmltvChannelId, xtreamChannelId),
    onSuccess: (updatedMatches, { xmltvChannelId }) => {
      // Update cache with new matches
      queryClient.setQueryData<XmltvChannelWithMappings[]>(
        ['xmltv-channels-with-mappings'],
        (old) =>
          old?.map((ch) =>
            ch.id === xmltvChannelId
              ? { ...ch, matches: updatedMatches }
              : ch
          )
      );
    },
    onError: (err) => {
      // Standardized error handling: show toast then refetch
      showToast(`Failed to change primary stream: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      refetch();
    },
  });

  // Add manual mapping mutation (Story 3-3)
  const addMappingMutation = useMutation({
    mutationFn: ({
      xmltvChannelId,
      xtreamChannelId,
      setAsPrimary,
    }: {
      xmltvChannelId: number;
      xtreamChannelId: number;
      setAsPrimary: boolean;
    }) => addManualStreamMapping(xmltvChannelId, xtreamChannelId, setAsPrimary),
    onSuccess: (updatedMatches, { xmltvChannelId }) => {
      // Update channels cache with new matches
      queryClient.setQueryData<XmltvChannelWithMappings[]>(
        ['xmltv-channels-with-mappings'],
        (old) =>
          old?.map((ch) =>
            ch.id === xmltvChannelId
              ? { ...ch, matches: updatedMatches, matchCount: updatedMatches.length }
              : ch
          )
      );
      // Invalidate streams cache to update matchedToXmltvIds
      queryClient.invalidateQueries({ queryKey: ['xtream-streams-for-matching'] });
      showToast('Stream added successfully', 'success');
    },
    onError: (err) => {
      // Standardized error handling: show toast then refetch
      showToast(`Failed to add stream: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      refetch();
    },
  });

  // Remove mapping mutation (Story 3-3)
  const removeMappingMutation = useMutation({
    mutationFn: (mappingId: number) => removeStreamMapping(mappingId),
    onSuccess: (updatedMatches, _mappingId) => {
      // Find which channel this mapping belonged to and update it
      // We need to update all channels since we don't have xmltvChannelId in mutation args
      queryClient.setQueryData<XmltvChannelWithMappings[]>(
        ['xmltv-channels-with-mappings'],
        (old) => {
          if (!old) return old;
          // Find channel that had this mapping removed
          return old.map((ch) => {
            // Check if any of the returned matches belong to this channel
            // The backend returns the updated matches for the affected channel
            const hasMatchingIds =
              updatedMatches.length === 0 ||
              ch.matches.some((m) =>
                updatedMatches.some((um) => um.mappingId === m.mappingId || um.id === m.id)
              );
            if (hasMatchingIds && ch.matches.length !== updatedMatches.length) {
              // This might be the updated channel - check by comparing match counts
              // More reliable: check if any of our matches are no longer in updated
              const ourMatchIds = new Set(ch.matches.map((m) => m.mappingId));
              const newMatchIds = new Set(updatedMatches.map((m) => m.mappingId));
              // If our channel had a match that's no longer present
              const lostMatch = [...ourMatchIds].some((id) => !newMatchIds.has(id));
              if (lostMatch || (ch.matches.length > 0 && updatedMatches.length === ch.matches.length - 1)) {
                return { ...ch, matches: updatedMatches, matchCount: updatedMatches.length };
              }
            }
            return ch;
          });
        }
      );
      // Invalidate streams cache to update matchedToXmltvIds
      queryClient.invalidateQueries({ queryKey: ['xtream-streams-for-matching'] });
      showToast('Stream removed successfully', 'success');
    },
    onError: (err) => {
      // Standardized error handling: show toast then refetch
      showToast(`Failed to remove stream: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      refetch();
    },
  });

  // Handle toggle channel
  const handleToggleChannel = useCallback(
    (channelId: number) => {
      toggleMutation.mutate(channelId);
    },
    [toggleMutation]
  );

  // Handle set primary stream
  const handleSetPrimaryStream = useCallback(
    async (xmltvChannelId: number, xtreamChannelId: number): Promise<XtreamStreamMatch[]> => {
      const result = await setPrimaryMutation.mutateAsync({
        xmltvChannelId,
        xtreamChannelId,
      });
      return result;
    },
    [setPrimaryMutation]
  );

  // Handle add manual mapping (Story 3-3)
  const handleAddManualMapping = useCallback(
    async (
      xmltvChannelId: number,
      xtreamChannelId: number,
      setAsPrimary: boolean
    ): Promise<XtreamStreamMatch[]> => {
      const result = await addMappingMutation.mutateAsync({
        xmltvChannelId,
        xtreamChannelId,
        setAsPrimary,
      });
      return result;
    },
    [addMappingMutation]
  );

  // Handle remove mapping (Story 3-3)
  const handleRemoveMapping = useCallback(
    async (mappingId: number): Promise<XtreamStreamMatch[]> => {
      const result = await removeMappingMutation.mutateAsync(mappingId);
      return result;
    },
    [removeMappingMutation]
  );

  // Reorder mutation (Story 3-6)
  const reorderMutation = useMutation({
    mutationFn: (channelIds: number[]) => updateChannelOrder(channelIds),
    onMutate: async (newChannelIds) => {
      // Store previous order for potential rollback
      const previousChannels = queryClient.getQueryData<XmltvChannelWithMappings[]>([
        'xmltv-channels-with-mappings',
      ]);
      previousOrderRef.current = previousChannels || null;

      // Optimistically update to the new order
      if (previousChannels) {
        const channelMap = new Map(previousChannels.map((ch) => [ch.id, ch]));
        const reorderedChannels: XmltvChannelWithMappings[] = [];

        newChannelIds.forEach((id, index) => {
          const channel = channelMap.get(id);
          if (channel) {
            reorderedChannels.push({
              ...channel,
              plexDisplayOrder: index as number | null
            });
          }
        });

        queryClient.setQueryData<XmltvChannelWithMappings[]>(
          ['xmltv-channels-with-mappings'],
          reorderedChannels
        );
      }

      return { previousChannels };
    },
    onError: (err, _newChannelIds, context) => {
      // Rollback to previous order
      if (context?.previousChannels) {
        queryClient.setQueryData<XmltvChannelWithMappings[]>(
          ['xmltv-channels-with-mappings'],
          context.previousChannels
        );
      }
      showToast(`Failed to reorder channels: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    },
    onSuccess: () => {
      // Refetch to ensure UI matches database state
      queryClient.invalidateQueries({ queryKey: ['xmltv-channels-with-mappings'] });
    },
    onSettled: () => {
      // Clear the previous order reference
      previousOrderRef.current = null;
    },
  });

  // Handle reorder (Story 3-6)
  const handleReorder = useCallback(
    (channelIds: number[]) => {
      // Validate non-empty array before making API call
      if (channelIds.length === 0) {
        return;
      }
      reorderMutation.mutate(channelIds);
    },
    [reorderMutation]
  );

  // Story 3-7: Bulk toggle mutation with optimistic updates
  const bulkToggleMutation = useMutation({
    mutationFn: ({ channelIds, enabled }: { channelIds: number[]; enabled: boolean }) =>
      bulkToggleChannels(channelIds, enabled),
    onMutate: async ({ channelIds, enabled }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['xmltv-channels-with-mappings'] });

      // Snapshot previous value for rollback
      const previousChannels = queryClient.getQueryData<XmltvChannelWithMappings[]>([
        'xmltv-channels-with-mappings',
      ]);

      // Optimistically update channels
      queryClient.setQueryData<XmltvChannelWithMappings[]>(
        ['xmltv-channels-with-mappings'],
        (old) => {
          if (!old) return old;
          const channelIdSet = new Set(channelIds);
          return old.map((ch) => {
            if (channelIdSet.has(ch.id)) {
              // When enabling, only toggle channels with matches (simulate backend logic)
              if (enabled && ch.matchCount === 0) {
                return ch; // Don't change unmatched channels
              }
              return { ...ch, isEnabled: enabled };
            }
            return ch;
          });
        }
      );

      return { previousChannels };
    },
    onSuccess: (result, { enabled }) => {
      const action = enabled ? 'Enabled' : 'Disabled';
      showToast(`${action} ${result.successCount} channels`, 'success');

      if (result.skippedCount > 0 && enabled) {
        // Show warning for skipped channels (only when enabling)
        setTimeout(() => {
          showToast(`Skipped ${result.skippedCount} channels without streams`, 'error');
        }, 1500);
      }

      // Clear selection and refresh to sync with backend
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ['xmltv-channels-with-mappings'] });
    },
    onError: (err, _variables, context) => {
      // Rollback optimistic update
      if (context?.previousChannels) {
        queryClient.setQueryData<XmltvChannelWithMappings[]>(
          ['xmltv-channels-with-mappings'],
          context.previousChannels
        );
      }
      showToast(`Bulk operation failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    },
  });

  // Story 3-7: Computed values for filtered and matched channels
  const filteredChannels = useMemo(() => {
    if (!categoryFilter) return channels;
    // Simple category filter based on display name pattern matching
    // Full category support would require schema changes
    return channels.filter((ch) =>
      ch.displayName.toLowerCase().includes(categoryFilter.toLowerCase())
    );
  }, [channels, categoryFilter]);

  const matchedChannelCount = useMemo(
    () => channels.filter((ch) => ch.matchCount > 0).length,
    [channels]
  );

  // Story 3-7: Select all matched channels (AC #4)
  // Maximum recommended selection size to prevent performance issues
  const MAX_SELECTION_WARN = 500;

  const selectAllMatched = useCallback(() => {
    const matchedIds = channels
      .filter((ch) => ch.matchCount > 0)
      .map((ch) => ch.id);

    // Warn if selecting many channels
    if (matchedIds.length > MAX_SELECTION_WARN) {
      showToast(`Warning: Selecting ${matchedIds.length} channels may take longer to process`, 'error');
    }

    setSelectedChannelIds(new Set(matchedIds));
  }, [channels, showToast]);

  // Story 3-7: Select all visible/filtered channels (AC #5)
  const selectAllVisible = useCallback(() => {
    const visibleIds = filteredChannels.map((ch) => ch.id);
    setSelectedChannelIds(new Set(visibleIds));
  }, [filteredChannels]);

  // Story 3-7: Extract unique categories from channel names (simplified approach)
  // Full category support would require categories field in XMLTV channel data
  const categories = useMemo(() => {
    // For now, extract simple categories from channel names if they follow patterns
    const categoryPatterns = ['Sports', 'News', 'Movies', 'Entertainment', 'Kids', 'Music', 'Documentary'];
    const foundCategories = new Set<string>();

    channels.forEach((ch) => {
      const lowerName = ch.displayName.toLowerCase();
      for (const pattern of categoryPatterns) {
        if (lowerName.includes(pattern.toLowerCase())) {
          foundCategories.add(pattern);
        }
      }
    });

    return Array.from(foundCategories).sort();
  }, [channels]);

  // Story 3-7: Bulk action handlers
  const handleBulkEnable = useCallback(() => {
    if (selectedChannelIds.size === 0) return;
    bulkToggleMutation.mutate({ channelIds: Array.from(selectedChannelIds), enabled: true });
  }, [selectedChannelIds, bulkToggleMutation]);

  const handleBulkDisable = useCallback(() => {
    if (selectedChannelIds.size === 0) return;
    bulkToggleMutation.mutate({ channelIds: Array.from(selectedChannelIds), enabled: false });
  }, [selectedChannelIds, bulkToggleMutation]);

  // Calculate stats for header
  const totalChannels = channels.length;
  const enabledChannels = channels.filter((ch) => ch.isEnabled).length;
  const matchedChannels = channels.filter((ch) => ch.matchCount > 0).length;
  const unmatchedChannels = totalChannels - matchedChannels;

  return (
    <div data-testid="channels-view" className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Channels</h1>
          <p className="text-sm text-gray-500 mt-1">
            XMLTV channels with matched Xtream streams
          </p>
        </div>

        {/* Refresh button */}
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Stats bar */}
      {!isLoading && channels.length > 0 && (
        <div className="mb-4 flex items-center gap-4 text-sm">
          <span data-testid="channel-count" className="text-gray-600">
            {totalChannels} channel{totalChannels !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-300">|</span>
          <span data-testid="enabled-count" className="text-gray-600">
            {enabledChannels} enabled
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-green-600">
            {matchedChannels} matched
          </span>
          {unmatchedChannels > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <span className="text-amber-600">
                {unmatchedChannels} unmatched
              </span>
            </>
          )}
        </div>
      )}

      {/* Story 3-7: Filter and selection controls */}
      {!isLoading && channels.length > 0 && (
        <div className="mb-4 flex items-center gap-4">
          {/* Category filter (AC #5) */}
          {categories.length > 0 && (
            <select
              data-testid="category-filter"
              value={categoryFilter || ''}
              onChange={(e) => setCategoryFilter(e.target.value || null)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}

          {/* Select All Matched button (AC #4) */}
          <button
            type="button"
            onClick={selectAllMatched}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Select All Matched ({matchedChannelCount})
          </button>

          {/* Select All (visible) button (AC #5) */}
          {categoryFilter && (
            <button
              type="button"
              onClick={selectAllVisible}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Select All
            </button>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center justify-between">
          <span>Failed to load channels: {error.message}</span>
          <button
            onClick={() => refetch()}
            className="px-3 py-1 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="bg-white border border-gray-200 rounded-lg relative">
        <DraggableXmltvChannelsList
          channels={filteredChannels}
          isLoading={isLoading}
          onToggleChannel={handleToggleChannel}
          onSetPrimaryStream={handleSetPrimaryStream}
          onAddManualMapping={handleAddManualMapping}
          onRemoveMapping={handleRemoveMapping}
          onReorder={handleReorder}
          selectedChannelIds={selectedChannelIds}
          onToggleSelection={toggleChannelSelection}
        />

        {/* Story 3-7: Bulk Action Toolbar */}
        <BulkActionToolbar
          selectedCount={selectedChannelIds.size}
          onEnableSelected={handleBulkEnable}
          onDisableSelected={handleBulkDisable}
          onClearSelection={clearSelection}
          isLoading={bulkToggleMutation.isPending}
        />
      </div>

      {/* Toast notification */}
      {toastMessage && (
        <div
          data-testid="toast"
          className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg max-w-md z-50 ${
            toastType === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-green-600 text-white'
          }`}
          role="alert"
        >
          <div className="flex items-center gap-2">
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-auto text-white hover:text-gray-200 text-xl font-bold"
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ARIA live region for screen reader announcements (Story 3-7 accessibility requirement) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {toastMessage}
      </div>
    </div>
  );
}
