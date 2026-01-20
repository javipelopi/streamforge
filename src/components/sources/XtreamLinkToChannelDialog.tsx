/**
 * Xtream Link to Channel Dialog Component
 * Story 3-11: Implement Sources View with Xtream Tab
 *
 * Dialog for linking an orphan Xtream stream to an existing XMLTV channel.
 * Uses search dropdown to find and select XMLTV channels.
 */
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, X, Loader2 } from 'lucide-react';
import {
  getXmltvChannelsWithMappings,
  addManualStreamMapping,
  type XtreamAccountStream,
  type XmltvChannelWithMappings,
} from '../../lib/tauri';

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
  const [selectedChannel, setSelectedChannel] = useState<XmltvChannelWithMappings | null>(null);
  const [setAsPrimary, setSetAsPrimary] = useState(true);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });
  const queryClient = useQueryClient();

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

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // Mutation for linking stream to channel
  const linkMutation = useMutation({
    mutationFn: () => {
      if (!selectedChannel) {
        throw new Error('No channel selected');
      }
      return addManualStreamMapping(selectedChannel.id, stream.id, setAsPrimary);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-stream-stats', accountId] });
      queryClient.invalidateQueries({ queryKey: ['xtream-streams', accountId] });
      queryClient.invalidateQueries({ queryKey: ['xmltv-channels-with-mappings'] });
      showToast(`Linked ${stream.name} to ${selectedChannel?.displayName}`, 'success');
      setTimeout(() => {
        onSuccess();
      }, 500);
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to link stream', 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel) {
      showToast('Please select a channel', 'error');
      return;
    }
    linkMutation.mutate();
  };

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
      <div data-testid="stream-search-dropdown" className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Link to XMLTV Channel</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Stream info */}
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <p className="text-sm text-gray-600">Linking stream:</p>
          <p className="font-medium">{stream.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          {/* Search input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              data-testid="stream-search-input"
              type="text"
              placeholder="Search XMLTV channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Channel list */}
          <div className="flex-1 min-h-0 overflow-y-auto border rounded-md mb-4">
            {channelsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-500">Loading channels...</span>
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {searchQuery ? 'No channels match your search' : 'No XMLTV channels available'}
              </div>
            ) : (
              <div className="divide-y">
                {filteredChannels.map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => setSelectedChannel(channel)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      selectedChannel?.id === channel.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {channel.icon ? (
                        <img
                          src={channel.icon}
                          alt=""
                          className="w-8 h-8 rounded object-cover flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-200 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {channel.displayName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {channel.channelId} • {channel.matchCount} stream{channel.matchCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {channel.isEnabled && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded flex-shrink-0">
                          In Lineup
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Set as primary checkbox */}
          <div className="mb-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={setAsPrimary}
                onChange={(e) => setSetAsPrimary(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Set as primary stream for this channel</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedChannel || linkMutation.isPending}
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {linkMutation.isPending ? 'Linking...' : 'Link Stream'}
            </button>
          </div>
        </form>

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
