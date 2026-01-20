/**
 * Xtream Link to Channel Dialog Component
 * Story 3-11: Implement Sources View with Xtream Tab
 *
 * Dialog for linking an orphan Xtream stream to an existing XMLTV channel.
 * Uses inline Primary/Backup buttons for quick linking.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, X, Loader2 } from 'lucide-react';
import {
  getXmltvChannelsWithMappings,
  addManualStreamMapping,
  type XtreamAccountStream,
} from '../../lib/tauri';
import { TOAST_DURATION_MS } from '../../lib/constants';

interface XtreamLinkToChannelDialogProps {
  stream: XtreamAccountStream;
  accountId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function XtreamLinkToChannelDialog({
  stream,
  accountId,
  onClose,
  onSuccess,
}: XtreamLinkToChannelDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [linkingChannelId, setLinkingChannelId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });
  const queryClient = useQueryClient();
  // Store toast timeout to prevent memory leak
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch all XMLTV channels
  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ['xmltv-channels-with-mappings'],
    queryFn: getXmltvChannelsWithMappings,
  });

  // Filter channels based on search query
  const filteredChannels = channels.filter(
    (channel) =>
      channel.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      channel.channelId.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  // Mutation for linking stream to channel
  const linkMutation = useMutation({
    mutationFn: ({ channelId, setAsPrimary }: { channelId: number; setAsPrimary: boolean }) =>
      addManualStreamMapping(channelId, stream.id, setAsPrimary),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['account-stream-stats', accountId] });
      queryClient.invalidateQueries({ queryKey: ['xtream-streams', accountId] });
      queryClient.invalidateQueries({ queryKey: ['xmltv-channels-with-mappings'] });
      const channel = channels.find((c) => c.id === variables.channelId);
      const actionText = variables.setAsPrimary ? 'as primary' : 'as backup';
      showToast(`Linked to ${channel?.displayName} ${actionText}`, 'success');
      setLinkingChannelId(null);
      setTimeout(() => {
        onSuccess();
      }, 500);
    },
    onError: (error: Error) => {
      setLinkingChannelId(null);
      showToast(error.message || 'Failed to link stream', 'error');
    },
  });

  // Handle linking
  const handleLink = useCallback(
    (channelId: number, setAsPrimary: boolean) => {
      setLinkingChannelId(channelId);
      linkMutation.mutate({ channelId, setAsPrimary });
    },
    [linkMutation]
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-semibold">Link to XMLTV Channel</h2>
            <p className="text-sm text-gray-500 mt-1">{stream.name}</p>
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
        <div className="flex-1 overflow-y-auto p-6">
          {/* Search input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              data-testid="stream-search-input"
              type="text"
              placeholder="Search XMLTV channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Channel list */}
          <div className="border rounded-md max-h-80 overflow-y-auto">
            {channelsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-500">Loading channels...</span>
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {searchQuery ? `No channels match "${searchQuery}"` : 'No XMLTV channels available'}
              </div>
            ) : (
              <>
                <div className="px-3 py-1 text-xs text-gray-500 bg-gray-50 border-b">
                  {filteredChannels.length} channel{filteredChannels.length !== 1 ? 's' : ''} found
                </div>
                <div className="divide-y">
                  {filteredChannels.map((channel) => {
                    const isLinking = linkingChannelId === channel.id;

                    return (
                      <div
                        key={channel.id}
                        className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50"
                      >
                        {/* Channel icon */}
                        {channel.icon ? (
                          <img
                            src={channel.icon}
                            alt=""
                            className="w-8 h-8 rounded object-contain flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-gray-200 flex-shrink-0" />
                        )}

                        {/* Channel info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">
                              {channel.displayName}
                            </span>
                            {channel.isEnabled && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded flex-shrink-0">
                                In Lineup
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {channel.channelId} • {channel.matchCount} stream{channel.matchCount !== 1 ? 's' : ''}
                          </p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleLink(channel.id, true)}
                            disabled={isLinking || linkMutation.isPending}
                            className="px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isLinking ? '...' : 'Primary'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLink(channel.id, false)}
                            disabled={isLinking || linkMutation.isPending}
                            className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Backup
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
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
