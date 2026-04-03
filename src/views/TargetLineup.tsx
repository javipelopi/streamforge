/**
 * Target Lineup View
 * Story 3-9: Implement Target Lineup View
 *
 * Displays the list of channels for the Plex lineup in two tabs:
 * - Enabled: channels in the lineup with ordering (drag to reorder)
 * - Disabled: matched but disabled channels with enable toggle
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AlertTriangle, Tv } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../lib/routes';
import {
  getTargetLineupChannels,
  getDisabledLineupChannels,
  updateChannelOrder,
  toggleXmltvChannel,
  type TargetLineupChannel,
} from '../lib/api';
import { TargetLineupChannelRow } from '../components/channels/TargetLineupChannelRow';
import { DisabledChannelRow } from '../components/channels/DisabledChannelRow';

// Row height for virtualized list
const ROW_HEIGHT = 72;

type LineupTab = 'enabled' | 'disabled';

export function TargetLineup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const parentRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<LineupTab>('enabled');

  // State for undo toast
  const [undoToast, setUndoToast] = useState<{
    show: boolean;
    channelId: number;
    channelName: string;
    timeoutId?: NodeJS.Timeout;
  }>({ show: false, channelId: 0, channelName: '' });

  // Temporarily removed channels (for optimistic UI with undo)
  const [removedChannels, setRemovedChannels] = useState<Map<number, TargetLineupChannel>>(
    new Map()
  );

  // Track pending disables to prevent race conditions
  const pendingDisablesRef = useRef<Set<number>>(new Set());

  // Fetch enabled channels
  const {
    data: channels = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['targetLineupChannels'],
    queryFn: getTargetLineupChannels,
  });

  // Fetch disabled channels
  const {
    data: disabledChannels = [],
    isLoading: isLoadingDisabled,
    error: errorDisabled,
    refetch: refetchDisabled,
  } = useQuery({
    queryKey: ['disabledLineupChannels'],
    queryFn: getDisabledLineupChannels,
  });

  // Filter out temporarily removed channels for display
  const displayChannels = channels.filter((c) => !removedChannels.has(c.id));

  // Determine which list to use for virtualizer
  const activeList = activeTab === 'enabled' ? displayChannels : disabledChannels;

  // Mutation for updating channel order with optimistic update
  const updateOrderMutation = useMutation({
    mutationFn: (channelIds: number[]) => updateChannelOrder(channelIds),
    onMutate: async (newOrder: number[]) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['targetLineupChannels'] });

      // Snapshot the previous value
      const previousChannels = queryClient.getQueryData<TargetLineupChannel[]>(['targetLineupChannels']);

      // Optimistically update to the new order
      if (previousChannels) {
        const channelMap = new Map(previousChannels.map((c) => [c.id, c]));
        const newChannels = newOrder
          .map((id) => channelMap.get(id))
          .filter((c): c is TargetLineupChannel => c !== undefined);
        queryClient.setQueryData(['targetLineupChannels'], newChannels);
      }

      return { previousChannels };
    },
    onError: (error, _newOrder, context) => {
      console.error('Failed to update channel order:', error);
      // Revert to previous state on error
      if (context?.previousChannels) {
        queryClient.setQueryData(['targetLineupChannels'], context.previousChannels);
      }
    },
    onSettled: () => {
      // Refetch to ensure server state consistency
      queryClient.invalidateQueries({ queryKey: ['targetLineupChannels'] });
    },
  });

  // Mutation for toggling channel enabled status
  const toggleMutation = useMutation({
    mutationFn: (channelId: number) => toggleXmltvChannel(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targetLineupChannels'] });
      queryClient.invalidateQueries({ queryKey: ['disabledLineupChannels'] });
      queryClient.invalidateQueries({ queryKey: ['xmltvChannels'] });
    },
    onError: (error) => {
      console.error('Failed to toggle channel:', error);
      // Revert optimistic update by refetching
      queryClient.invalidateQueries({ queryKey: ['targetLineupChannels'] });
      queryClient.invalidateQueries({ queryKey: ['disabledLineupChannels'] });
    },
  });

  // Virtual list setup
  const virtualizer = useVirtualizer({
    count: activeList.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  // Handle moving a channel to a new position
  const handleMoveToPosition = useCallback(
    (channelId: number, newPosition: number) => {
      // Validate displayChannels is not empty
      if (displayChannels.length === 0) {
        return;
      }

      // Convert 1-indexed position to 0-indexed
      const targetIndex = newPosition - 1;

      // Find current index
      const currentIndex = displayChannels.findIndex((c) => c.id === channelId);

      if (currentIndex === -1) {
        return;
      }

      // Validate target index
      if (targetIndex < 0 || targetIndex >= displayChannels.length) {
        return;
      }

      // No change needed if same position
      if (currentIndex === targetIndex) {
        return;
      }

      // Reorder: remove from current position, insert at new position
      const newOrder = [...displayChannels];
      const [removed] = newOrder.splice(currentIndex, 1);
      newOrder.splice(targetIndex, 0, removed);

      // Update order in backend
      const channelIds = newOrder.map((c) => c.id);
      updateOrderMutation.mutate(channelIds);
    },
    [displayChannels, updateOrderMutation]
  );

  // Toggle handler with optimistic UI and undo (for Enabled tab - removing)
  const handleToggleEnabled = useCallback(
    (channel: TargetLineupChannel) => {
      // If channel is enabled, we're disabling it
      if (channel.isEnabled) {
        // Add to pending disables to prevent race conditions
        pendingDisablesRef.current.add(channel.id);

        // Store for undo
        setRemovedChannels((prev) => {
          const next = new Map(prev);
          next.set(channel.id, channel);
          return next;
        });

        // Clear any existing timeout and remove from pending
        if (undoToast.timeoutId) {
          clearTimeout(undoToast.timeoutId);
          if (undoToast.channelId) {
            pendingDisablesRef.current.delete(undoToast.channelId);
          }
        }

        // Set up undo toast with 5 second timeout
        const timeoutId = setTimeout(() => {
          // Only execute if still pending (not undone)
          if (pendingDisablesRef.current.has(channel.id)) {
            toggleMutation.mutate(channel.id);
            pendingDisablesRef.current.delete(channel.id);
          }
          setRemovedChannels((prev) => {
            const next = new Map(prev);
            next.delete(channel.id);
            return next;
          });
          setUndoToast({ show: false, channelId: 0, channelName: '' });
        }, 5000);

        setUndoToast({
          show: true,
          channelId: channel.id,
          channelName: channel.displayName,
          timeoutId,
        });
      } else {
        // Re-enabling - just toggle
        toggleMutation.mutate(channel.id);
      }
    },
    [toggleMutation, undoToast.timeoutId, undoToast.channelId]
  );

  // Enable handler for Disabled tab
  const handleEnableChannel = useCallback(
    (channel: TargetLineupChannel) => {
      toggleMutation.mutate(channel.id);
    },
    [toggleMutation]
  );

  // Undo handler
  const handleUndo = useCallback(() => {
    if (undoToast.timeoutId) {
      clearTimeout(undoToast.timeoutId);
    }
    // Remove from pending disables to prevent mutation
    pendingDisablesRef.current.delete(undoToast.channelId);
    setRemovedChannels((prev) => {
      const next = new Map(prev);
      next.delete(undoToast.channelId);
      return next;
    });
    setUndoToast({ show: false, channelId: 0, channelName: '' });
  }, [undoToast]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (undoToast.timeoutId) {
        clearTimeout(undoToast.timeoutId);
      }
    };
  }, [undoToast.timeoutId]);

  // Reset virtualizer scroll when switching tabs
  useEffect(() => {
    virtualizer.scrollToIndex(0);
  }, [activeTab, virtualizer]);

  // Loading state
  const isActiveLoading = activeTab === 'enabled' ? isLoading : isLoadingDisabled;
  if (isActiveLoading) {
    return (
      <div data-testid="target-lineup-loading" className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Error state
  const activeError = activeTab === 'enabled' ? error : errorDisabled;
  const activeRefetch = activeTab === 'enabled' ? refetch : refetchDisabled;
  if (activeError) {
    return (
      <div data-testid="target-lineup-error" className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">Failed to load channels</span>
          </div>
          <button
            onClick={() => activeRefetch()}
            className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Tab header with counts
  const enabledCount = displayChannels.length;
  const disabledCount = disabledChannels.length;

  // Empty state for Enabled tab
  const showEnabledEmpty = activeTab === 'enabled' && displayChannels.length === 0 && !undoToast.show;
  // Empty state for Disabled tab
  const showDisabledEmpty = activeTab === 'disabled' && disabledChannels.length === 0;

  return (
    <div data-testid="target-lineup-view" className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Target Lineup</h1>
        <p className="text-gray-500 mt-1">
          Manage your Plex lineup channels
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-4" role="tablist" aria-label="Lineup tabs">
        <button
          data-testid="enabled-tab"
          role="tab"
          aria-selected={activeTab === 'enabled'}
          aria-controls="enabled-tab-panel"
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'enabled'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('enabled')}
        >
          Enabled{enabledCount > 0 && ` (${enabledCount})`}
        </button>
        <button
          data-testid="disabled-tab"
          role="tab"
          aria-selected={activeTab === 'disabled'}
          aria-controls="disabled-tab-panel"
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'disabled'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('disabled')}
        >
          Disabled{disabledCount > 0 && ` (${disabledCount})`}
        </button>
      </div>

      {/* Empty states */}
      {showEnabledEmpty && (
        <div data-testid="target-lineup-empty-state" className="flex-1 flex items-center justify-center">
          <div className="text-center py-12">
            <Tv className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <div data-testid="empty-state-message">
              <h2 className="text-xl font-semibold text-gray-700 mb-2">No channels in lineup</h2>
              <p className="text-gray-500 mb-6">
                Add channels from Sources to build your Plex lineup.
              </p>
            </div>
            <button
              data-testid="browse-sources-button"
              onClick={() => navigate(ROUTES.SOURCES)}
              aria-label="Browse Sources"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Browse Sources
            </button>
          </div>
        </div>
      )}

      {showDisabledEmpty && (
        <div data-testid="disabled-empty-state" className="flex-1 flex items-center justify-center">
          <div className="text-center py-12">
            <Tv className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No disabled channels</h2>
            <p className="text-gray-500">
              All matched channels are currently enabled.
            </p>
          </div>
        </div>
      )}

      {/* Enabled tab - empty with pending undo */}
      {activeTab === 'enabled' && displayChannels.length === 0 && undoToast.show && (
        <div data-testid="target-lineup-empty-state" className="flex-1 flex items-center justify-center">
          <div className="text-center py-12">
            <Tv className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <div data-testid="empty-state-message">
              <h2 className="text-xl font-semibold text-gray-700 mb-2">No channels in lineup</h2>
              <p className="text-gray-500 mb-6">
                Add channels from Sources to build your Plex lineup.
              </p>
            </div>
            <button
              data-testid="browse-sources-button"
              onClick={() => navigate(ROUTES.SOURCES)}
              aria-label="Browse Sources"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Browse Sources
            </button>
          </div>
        </div>
      )}

      {/* Channel list (virtualized) */}
      {activeList.length > 0 && (
        <>
          <div
            ref={parentRef}
            data-testid={activeTab === 'enabled' ? 'target-lineup-list' : 'disabled-lineup-list'}
            id={`${activeTab}-tab-panel`}
            role="tabpanel"
            aria-labelledby={`${activeTab}-tab`}
            className="flex-1 overflow-auto border border-gray-200 rounded-lg bg-white"
          >
            <div
              role="listbox"
              aria-label={activeTab === 'enabled' ? 'Target lineup channels' : 'Disabled channels'}
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const channel = activeList[virtualItem.index];
                if (!channel) return null;

                if (activeTab === 'enabled') {
                  return (
                    <TargetLineupChannelRow
                      key={channel.id}
                      channel={channel}
                      virtualItem={virtualItem}
                      totalChannels={displayChannels.length}
                      onMoveToPosition={handleMoveToPosition}
                      onToggleEnabled={() => handleToggleEnabled(channel)}
                    />
                  );
                }

                return (
                  <DisabledChannelRow
                    key={channel.id}
                    channel={channel}
                    virtualItem={virtualItem}
                    onEnable={() => handleEnableChannel(channel)}
                  />
                );
              })}
            </div>
          </div>

          {/* Helper text (only on enabled tab) */}
          {activeTab === 'enabled' && (
            <div className="mt-3 text-center text-sm text-gray-500">
              Looking to add more channels?{' '}
              <button
                type="button"
                onClick={() => navigate(ROUTES.SOURCES)}
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
              >
                Browse Sources
              </button>
            </div>
          )}
        </>
      )}

      {/* Undo Toast */}
      {undoToast.show && (
        <div
          data-testid="undo-toast"
          className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-4"
          role="alert"
          aria-live="polite"
        >
          <span>
            Channel <strong>{undoToast.channelName}</strong> removed from lineup
          </span>
          <button
            data-testid="undo-button"
            onClick={handleUndo}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium transition-colors"
            aria-label="Undo"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
