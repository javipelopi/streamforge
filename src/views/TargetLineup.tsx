/**
 * Target Lineup View
 * Story 3-9: Implement Target Lineup View
 *
 * Displays the list of ENABLED channels for the Plex lineup.
 * Users can reorder channels via drag-drop and toggle enabled state.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AlertTriangle, Tv } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../lib/routes';
import {
  getTargetLineupChannels,
  updateChannelOrder,
  toggleXmltvChannel,
  type TargetLineupChannel,
} from '../lib/tauri';
import { TargetLineupChannelRow } from '../components/channels/TargetLineupChannelRow';

// Row height for virtualized list
const ROW_HEIGHT = 72;

export function TargetLineup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const parentRef = useRef<HTMLDivElement>(null);

  // State for drag-drop
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);

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

  // Filter out temporarily removed channels for display
  const displayChannels = channels.filter((c) => !removedChannels.has(c.id));

  // Mutation for updating channel order
  const updateOrderMutation = useMutation({
    mutationFn: (channelIds: number[]) => updateChannelOrder(channelIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targetLineupChannels'] });
    },
    onError: (error) => {
      console.error('Failed to update channel order:', error);
      // Revert optimistic update by refetching
      queryClient.invalidateQueries({ queryKey: ['targetLineupChannels'] });
    },
  });

  // Mutation for toggling channel enabled status
  const toggleMutation = useMutation({
    mutationFn: (channelId: number) => toggleXmltvChannel(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targetLineupChannels'] });
      queryClient.invalidateQueries({ queryKey: ['xmltvChannels'] });
    },
    onError: (error) => {
      console.error('Failed to toggle channel:', error);
      // Revert optimistic update by refetching
      queryClient.invalidateQueries({ queryKey: ['targetLineupChannels'] });
    },
  });

  // Virtual list setup
  const virtualizer = useVirtualizer({
    count: displayChannels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  // Drag handlers
  const handleDragStart = useCallback((channelId: number) => {
    setDraggedId(channelId);
  }, []);

  const handleDragOver = useCallback((channelId: number) => {
    setDropTargetId(channelId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDropTargetId(null);
  }, []);

  const handleDrop = useCallback(
    (targetChannelId: number) => {
      if (draggedId === null || draggedId === targetChannelId) {
        handleDragEnd();
        return;
      }

      // Validate displayChannels is not empty
      if (displayChannels.length === 0) {
        handleDragEnd();
        return;
      }

      // Find indices
      const sourceIndex = displayChannels.findIndex((c) => c.id === draggedId);
      const targetIndex = displayChannels.findIndex((c) => c.id === targetChannelId);

      if (sourceIndex === -1 || targetIndex === -1) {
        handleDragEnd();
        return;
      }

      // Additional validation: ensure indices are within bounds
      if (sourceIndex >= displayChannels.length || targetIndex >= displayChannels.length) {
        handleDragEnd();
        return;
      }

      // Reorder channels
      const newOrder = [...displayChannels];
      const [removed] = newOrder.splice(sourceIndex, 1);
      newOrder.splice(targetIndex, 0, removed);

      // Update order in backend
      const channelIds = newOrder.map((c) => c.id);
      updateOrderMutation.mutate(channelIds);

      handleDragEnd();
    },
    [draggedId, displayChannels, updateOrderMutation, handleDragEnd]
  );

  // Toggle handler with optimistic UI and undo
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

  // Loading state
  if (isLoading) {
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
  if (error) {
    return (
      <div data-testid="target-lineup-error" className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">Failed to load channels</span>
          </div>
          <button
            onClick={() => refetch()}
            className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state (but still show undo toast if one is active)
  if (displayChannels.length === 0 && !undoToast.show) {
    return (
      <div data-testid="target-lineup-empty-state" className="p-6">
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
    );
  }

  // Empty state with pending undo (show both empty UI and toast)
  if (displayChannels.length === 0 && undoToast.show) {
    return (
      <div data-testid="target-lineup-empty-state" className="p-6">
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
        {/* Undo Toast */}
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
      </div>
    );
  }

  return (
    <div data-testid="target-lineup-view" className="p-6 h-full flex flex-col">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Target Lineup</h1>
          <p className="text-gray-500 mt-1">
            {displayChannels.length} channel{displayChannels.length !== 1 ? 's' : ''} in your Plex lineup
          </p>
        </div>

        {/* Channel list */}
        <div
          ref={parentRef}
          data-testid="target-lineup-list"
          className="flex-1 overflow-auto border border-gray-200 rounded-lg bg-white"
          role="listbox"
          aria-label="Target lineup channels"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const channel = displayChannels[virtualItem.index];
              if (!channel) return null;

              return (
                <TargetLineupChannelRow
                  key={channel.id}
                  channel={channel}
                  virtualItem={virtualItem}
                  isDragging={draggedId === channel.id}
                  isDropTarget={dropTargetId === channel.id}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                  onToggleEnabled={() => handleToggleEnabled(channel)}
                />
              );
            })}
          </div>
        </div>

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
