import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOrphanAcestreamSources,
  promoteAcestreamOrphanToPlex,
  type OrphanAcestreamSource,
  type XmltvChannelWithMappings,
} from '../../lib/tauri';
import { PromoteOrphanDialog } from './PromoteOrphanDialog';

/**
 * OrphanAcestreamSection - Displays unmatched Acestream sources that can be promoted to Plex
 *
 * Shows a collapsible section with Acestream sources that are not matched to any XMLTV channel.
 * Each source can be "promoted" to create a synthetic XMLTV channel with placeholder EPG.
 */

interface OrphanAcestreamSectionProps {
  onPromoteSuccess?: (channel: XmltvChannelWithMappings) => void;
  onError?: (message: string) => void;
}

export function OrphanAcestreamSection({
  onPromoteSuccess,
  onError,
}: OrphanAcestreamSectionProps) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedSource, setSelectedSource] = useState<OrphanAcestreamSource | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch orphan Acestream sources
  const {
    data: orphanSources = [],
    isLoading,
    error,
    refetch,
  } = useQuery<OrphanAcestreamSource[], Error>({
    queryKey: ['orphan-acestream-sources'],
    queryFn: getOrphanAcestreamSources,
    staleTime: 30000, // 30 seconds
  });

  // Promote mutation
  const promoteMutation = useMutation({
    mutationFn: ({
      acestreamSourceId,
      displayName,
      iconUrl,
    }: {
      acestreamSourceId: number;
      displayName: string;
      iconUrl: string | null;
    }) => promoteAcestreamOrphanToPlex(acestreamSourceId, displayName, iconUrl),
    onSuccess: (newChannel) => {
      // Invalidate both queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['orphan-acestream-sources'] });
      queryClient.invalidateQueries({ queryKey: ['xmltv-channels-with-mappings'] });

      // Show success message
      setSuccessMessage(`"${newChannel.displayName}" promoted successfully`);
      setTimeout(() => setSuccessMessage(null), 5000);

      // Close dialog and notify parent
      setSelectedSource(null);
      onPromoteSuccess?.(newChannel);
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Failed to promote source';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 5000);
      onError?.(message);
    },
  });

  // Handle promote button click - open dialog
  const handlePromoteClick = useCallback((source: OrphanAcestreamSource) => {
    setSelectedSource(source);
  }, []);

  // Handle dialog confirm
  const handleConfirmPromote = useCallback(
    (displayName: string, iconUrl: string | null) => {
      if (!selectedSource) return;

      promoteMutation.mutate({
        acestreamSourceId: selectedSource.id,
        displayName,
        iconUrl,
      });
    },
    [selectedSource, promoteMutation]
  );

  // Handle dialog cancel
  const handleCancelPromote = useCallback(() => {
    setSelectedSource(null);
  }, []);

  // Track whether to show the main section UI
  const showSectionUI = isLoading || orphanSources.length > 0;

  // Don't render anything if no section UI and no messages
  if (!showSectionUI && !successMessage && !errorMessage) {
    return null;
  }

  return (
    <>
      {showSectionUI && (
        <div data-testid="orphan-acestream-section" className="mb-6">
          {/* Section header */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-t-lg hover:bg-amber-100 transition-colors"
            aria-expanded={isExpanded}
            aria-controls="orphan-acestream-content"
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
                Unmatched Acestream Sources
              </span>
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-200 text-amber-800 rounded-full">
                {isLoading ? '...' : orphanSources.length}
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
              id="orphan-acestream-content"
              className="border border-t-0 border-amber-200 rounded-b-lg bg-white"
            >
              {/* Error state */}
              {error && (
                <div className="p-4 text-red-600 flex items-center justify-between">
                  <span>Failed to load orphan Acestream sources: {error.message}</span>
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
                  Loading orphan Acestream sources...
                </div>
              )}

              {/* Orphan sources list */}
              {!isLoading && !error && orphanSources.length > 0 && (
                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {orphanSources.map((source) => (
                    <div
                      key={source.id}
                      data-testid={`orphan-acestream-${source.id}`}
                      className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50"
                    >
                      {/* Source icon */}
                      <div className="flex-shrink-0 w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
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
                      </div>

                      {/* Source info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {source.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {/* Content ID (truncated) */}
                          <span className="text-xs text-gray-500 font-mono truncate max-w-48">
                            {source.contentId}
                          </span>
                          {/* Status badge */}
                          {!source.isActive && (
                            <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                              Disabled
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Promote button */}
                      <button
                        data-testid={`promote-acestream-button-${source.id}`}
                        onClick={() => handlePromoteClick(source)}
                        disabled={promoteMutation.isPending}
                        className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-100 rounded-md hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Promote to Plex
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state (only shown if no sources after loading) */}
              {!isLoading && !error && orphanSources.length === 0 && (
                <div className="p-4 text-center text-gray-500">
                  All Acestream sources are matched to XMLTV channels.
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
      {selectedSource && (
        <PromoteOrphanDialog
          sourceType="acestream"
          name={selectedSource.name}
          iconUrl={null}
          subInfo={`Content ID: ${selectedSource.contentId.slice(0, 16)}...`}
          isOpen={true}
          onConfirm={handleConfirmPromote}
          onCancel={handleCancelPromote}
          isLoading={promoteMutation.isPending}
        />
      )}
    </>
  );
}
