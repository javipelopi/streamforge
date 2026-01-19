import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { XmltvChannelsList } from '../components/channels';
import {
  getXmltvChannelsWithMappings,
  toggleXmltvChannel,
  setPrimaryStream,
  type XmltvChannelWithMappings,
  type XtreamStreamMatch,
} from '../lib/tauri';

/**
 * Channels View - Displays XMLTV channels with their matched Xtream streams
 *
 * Story 3-2: Display XMLTV Channel List with Match Status
 *
 * CRITICAL DESIGN PRINCIPLE: XMLTV channels are the PRIMARY channel list for Plex.
 * This view shows XMLTV channels as the primary list, with their matched Xtream streams.
 */
export function Channels() {
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'error' | 'success'>('error');

  const showToast = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 5000);
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
      console.error('Failed to toggle channel:', err);
      showToast(`Failed to toggle channel: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      // Refetch to get actual state on error
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
      console.error('Failed to set primary stream:', err);
      showToast(`Failed to change primary stream: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      // Refetch to get actual state on error
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
      <div className="bg-white border border-gray-200 rounded-lg">
        <XmltvChannelsList
          channels={channels}
          isLoading={isLoading}
          onToggleChannel={handleToggleChannel}
          onSetPrimaryStream={handleSetPrimaryStream}
        />
      </div>

      {/* Toast notification */}
      {toastMessage && (
        <div
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
    </div>
  );
}
