import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOrphanM3uChannels,
  promoteM3uOrphanToPlex,
  type OrphanM3uChannel,
  type XmltvChannelWithMappings,
} from '../../lib/api';
import { PromoteOrphanDialog } from './PromoteOrphanDialog';

/**
 * OrphanM3uSection - Displays unmatched M3U channels that can be promoted to Plex
 *
 * Shows a collapsible section with M3U channels that are not matched to any XMLTV channel.
 * Each channel can be "promoted" to create a synthetic XMLTV channel with placeholder EPG.
 */

interface OrphanM3uSectionProps {
  onPromoteSuccess?: (channel: XmltvChannelWithMappings) => void;
  onError?: (message: string) => void;
}

export function OrphanM3uSection({
  onPromoteSuccess,
  onError,
}: OrphanM3uSectionProps) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<OrphanM3uChannel | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch orphan M3U channels
  const {
    data: orphanChannels = [],
    isLoading,
    error,
    refetch,
  } = useQuery<OrphanM3uChannel[], Error>({
    queryKey: ['orphan-m3u-channels'],
    queryFn: getOrphanM3uChannels,
    staleTime: 30000, // 30 seconds
  });

  // Promote mutation
  const promoteMutation = useMutation({
    mutationFn: ({
      m3uChannelId,
      displayName,
      iconUrl,
    }: {
      m3uChannelId: number;
      displayName: string;
      iconUrl: string | null;
    }) => promoteM3uOrphanToPlex(m3uChannelId, displayName, iconUrl),
    onSuccess: (newChannel) => {
      // Invalidate both queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['orphan-m3u-channels'] });
      queryClient.invalidateQueries({ queryKey: ['xmltv-channels-with-mappings'] });

      // Show success message
      setSuccessMessage(`"${newChannel.displayName}" promoted successfully`);
      setTimeout(() => setSuccessMessage(null), 5000);

      // Close dialog and notify parent
      setSelectedChannel(null);
      onPromoteSuccess?.(newChannel);
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Failed to promote channel';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 5000);
      onError?.(message);
    },
  });

  // Handle promote button click - open dialog
  const handlePromoteClick = useCallback((channel: OrphanM3uChannel) => {
    setSelectedChannel(channel);
  }, []);

  // Handle dialog confirm
  const handleConfirmPromote = useCallback(
    (displayName: string, iconUrl: string | null) => {
      if (!selectedChannel) return;

      promoteMutation.mutate({
        m3uChannelId: selectedChannel.id,
        displayName,
        iconUrl,
      });
    },
    [selectedChannel, promoteMutation]
  );

  // Handle dialog cancel
  const handleCancelPromote = useCallback(() => {
    setSelectedChannel(null);
  }, []);

  // Track whether to show the main section UI
  const showSectionUI = isLoading || orphanChannels.length > 0;

  // Don't render anything if no section UI and no messages
  if (!showSectionUI && !successMessage && !errorMessage) {
    return null;
  }

  return (
    <>
      {showSectionUI && (
        <div data-testid="orphan-m3u-section" className="mb-6">
          {/* Section header */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-t-lg hover:bg-amber-100 transition-colors"
            aria-expanded={isExpanded}
            aria-controls="orphan-m3u-content"
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span className="font-medium text-amber-800">
                Unmatched M3U Channels
              </span>
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-200 text-amber-800 rounded-full">
                {isLoading ? '...' : orphanChannels.length}
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-amber-600 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Expandable content */}
          {isExpanded && (
            <div
              id="orphan-m3u-content"
              className="border border-t-0 border-amber-200 rounded-b-lg bg-white"
            >
              {/* Error state */}
              {error && (
                <div className="p-4 text-red-600 flex items-center justify-between">
                  <span>Failed to load orphan M3U channels: {error.message}</span>
                  <button
                    onClick={() => refetch()}
                    className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 rounded"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Loading state */}
              {isLoading && (
                <div className="p-4 flex items-center justify-center text-gray-500">
                  <svg
                    className="animate-spin h-5 w-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Loading orphan M3U channels...
                </div>
              )}

              {/* Orphan channels list */}
              {!isLoading && !error && orphanChannels.length > 0 && (
                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {orphanChannels.map((channel) => (
                    <div
                      key={channel.id}
                      data-testid={`orphan-m3u-${channel.id}`}
                      className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50"
                    >
                      {/* Channel icon */}
                      <div className="flex-shrink-0 w-10 h-10 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
                        {channel.tvgLogo ? (
                          <img
                            src={channel.tvgLogo}
                            alt=""
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <svg
                            className="w-6 h-6 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        )}
                      </div>

                      {/* Channel info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {channel.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {/* Source name */}
                          <span className="text-xs text-gray-500">
                            {channel.sourceName}
                          </span>
                          {/* Group */}
                          {channel.groupTitle && (
                            <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                              {channel.groupTitle}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Promote button */}
                      <button
                        data-testid={`promote-m3u-button-${channel.id}`}
                        onClick={() => handlePromoteClick(channel)}
                        disabled={promoteMutation.isPending}
                        className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-100 rounded-md hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Promote to Plex
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state (only shown if no channels after loading) */}
              {!isLoading && !error && orphanChannels.length === 0 && (
                <div className="p-4 text-center text-gray-500">
                  All M3U channels are matched to XMLTV channels.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Success toast - outside section so it shows even when section is hidden */}
      {successMessage && (
        <div className="fixed bottom-4 right-4 px-4 py-3 bg-green-600 text-white rounded-lg shadow-lg z-50 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error toast - outside section so it shows even when section is hidden */}
      {errorMessage && (
        <div className="fixed bottom-4 right-4 px-4 py-3 bg-red-600 text-white rounded-lg shadow-lg z-50 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Promote dialog */}
      {selectedChannel && (
        <PromoteOrphanDialog
          sourceType="m3u"
          name={selectedChannel.name}
          iconUrl={selectedChannel.tvgLogo}
          subInfo={`${selectedChannel.sourceName}${selectedChannel.groupTitle ? ` • ${selectedChannel.groupTitle}` : ''}`}
          isOpen={true}
          onConfirm={handleConfirmPromote}
          onCancel={handleCancelPromote}
          isLoading={promoteMutation.isPending}
        />
      )}
    </>
  );
}
