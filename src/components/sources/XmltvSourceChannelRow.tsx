/**
 * XMLTV Source Channel Row Component
 * Story 3-10: Implement Sources View with XMLTV Tab
 *
 * Displays a single channel with badges for lineup status and match count.
 * Includes action menu for add/remove from lineup.
 */
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreVertical, AlertTriangle, Radio } from 'lucide-react';
import { toggleXmltvChannel, type XmltvSourceChannel } from '../../lib/tauri';

interface XmltvSourceChannelRowProps {
  channel: XmltvSourceChannel;
  sourceId: number;
}

export function XmltvSourceChannelRow({ channel, sourceId }: XmltvSourceChannelRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [iconError, setIconError] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });
  const queryClient = useQueryClient();

  // Handle icon load error - show fallback
  const handleIconError = useCallback(() => {
    setIconError(true);
  }, []);

  // Show toast notification
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  }, []);

  // State to track if we're adding or removing for the toast message
  const [isAddingToLineup, setIsAddingToLineup] = useState(false);

  // Mutation for toggling channel enabled status
  const toggleMutation = useMutation({
    mutationFn: () => toggleXmltvChannel(channel.id),
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['xmltv-source-channels', sourceId] });
      queryClient.invalidateQueries({ queryKey: ['targetLineupChannels'] });
      setMenuOpen(false);
      // Show success toast based on action
      if (isAddingToLineup) {
        showToast(`${channel.displayName} added to lineup`, 'success');
      } else {
        showToast(`${channel.displayName} removed from lineup`, 'success');
      }
    },
    onError: (error: Error) => {
      // Show error toast
      console.error('Toggle failed:', error.message);
      showToast(error.message || 'Failed to update channel', 'error');
      // Close menu on error too
      setMenuOpen(false);
    },
  });

  const handleAddToLineup = () => {
    if (channel.matchCount === 0) {
      // Show error for channels without streams
      showToast('Cannot add channel without stream source', 'error');
      setMenuOpen(false);
      return;
    }
    setIsAddingToLineup(true);
    toggleMutation.mutate();
  };

  const handleRemoveFromLineup = () => {
    setIsAddingToLineup(false);
    toggleMutation.mutate();
  };

  const handleViewStreams = () => {
    // TODO: Open modal or navigate to stream detail view
    console.log('View streams for channel:', channel.id);
    setMenuOpen(false);
  };

  // Close menu when clicking outside
  const handleClickOutside = () => {
    if (menuOpen) {
      setMenuOpen(false);
    }
  };

  return (
    <div
      data-testid={`xmltv-channel-row-${channel.id}`}
      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
      onClick={handleClickOutside}
    >
      {/* Channel Info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Channel Icon - show image or fallback placeholder */}
        {channel.icon && !iconError ? (
          <img
            data-testid={`xmltv-channel-icon-${channel.id}`}
            src={channel.icon}
            alt=""
            className="w-8 h-8 rounded object-cover flex-shrink-0"
            onError={handleIconError}
          />
        ) : (
          <div
            data-testid={`xmltv-channel-icon-${channel.id}`}
            className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center flex-shrink-0"
          >
            <Radio className="w-4 h-4 text-gray-400" />
          </div>
        )}

        {/* Channel Name */}
        <span
          data-testid={`xmltv-channel-name-${channel.id}`}
          className="font-medium text-gray-900 truncate"
        >
          {channel.displayName}
        </span>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* In Lineup Badge */}
          {channel.isEnabled && (
            <span
              data-testid={`xmltv-channel-in-lineup-badge-${channel.id}`}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
              role="status"
            >
              In Lineup
            </span>
          )}

          {/* Synthetic Badge */}
          {channel.isSynthetic && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
              Synthetic
            </span>
          )}

          {/* Match Count or No Streams Warning */}
          {channel.matchCount === 0 ? (
            <span
              data-testid={`xmltv-channel-no-streams-warning-${channel.id}`}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800"
              title="No video source available - channel cannot be added to lineup"
              role="status"
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              No streams
            </span>
          ) : (
            <span
              data-testid={`xmltv-channel-match-count-${channel.id}`}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
              role="status"
            >
              {channel.matchCount} stream{channel.matchCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Action Menu */}
      <div className="relative ml-2">
        <button
          data-testid={`xmltv-channel-actions-${channel.id}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className="p-1 rounded hover:bg-gray-200 transition-colors"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <MoreVertical className="w-4 h-4 text-gray-500" />
        </button>

        {/* Dropdown Menu */}
        {menuOpen && (
          <div
            className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border z-10"
            role="menu"
          >
            {channel.isEnabled ? (
              <button
                data-testid={`xmltv-channel-remove-from-lineup-${channel.id}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFromLineup();
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                role="menuitem"
                disabled={toggleMutation.isPending}
              >
                {toggleMutation.isPending ? 'Removing...' : 'Remove from Lineup'}
              </button>
            ) : (
              <button
                data-testid={`xmltv-channel-add-to-lineup-${channel.id}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddToLineup();
                }}
                className={`w-full text-left px-4 py-2 text-sm ${
                  channel.matchCount === 0
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                role="menuitem"
                disabled={channel.matchCount === 0 || toggleMutation.isPending}
                title={channel.matchCount === 0 ? 'No stream source available' : undefined}
              >
                {toggleMutation.isPending ? 'Adding...' : 'Add to Lineup'}
              </button>
            )}
            <button
              data-testid={`xmltv-channel-view-streams-${channel.id}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleViewStreams();
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t"
              role="menuitem"
            >
              View Matched Streams
            </button>
          </div>
        )}
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
  );
}
