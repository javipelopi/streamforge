/**
 * M3U Channel Row Component
 *
 * Displays a single M3U channel with link status badge and action menu.
 * Matches the pattern used in XtreamStreamRow for consistency.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Popover from '@radix-ui/react-popover';
import { MoreVertical, Tv, Link2, LinkIcon, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  promoteM3uOrphanToPlex,
  getLinkStatusBadgeClasses,
  getLinkStatusLabel,
  type M3uChannel,
} from '../../lib/tauri';
import { ROUTES } from '../../lib/routes';
import { TOAST_DURATION_MS } from '../../lib/constants';
import { LinkToXmltvChannelDialog } from './LinkToXmltvChannelDialog';
import { PlayButton } from '../player';

// Validates that a URL is safe (http or https protocol only)
const isValidHttpUrl = (url: string): boolean => {
  return /^https?:\/\//i.test(url);
};

interface M3uChannelRowProps {
  channel: M3uChannel;
  sourceId: number;
  onUpdate: () => void;
}

export function M3uChannelRow({ channel, sourceId, onUpdate }: M3uChannelRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [iconError, setIconError] = useState(false);
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showLinkedChannelsPopover, setShowLinkedChannelsPopover] = useState(false);
  const [promoteForm, setPromoteForm] = useState({
    displayName: channel.name,
    iconUrl: channel.tvgLogo || '',
  });
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Security: Validate tvgLogo URL
  const safeLogoUrl = channel.tvgLogo && isValidHttpUrl(channel.tvgLogo)
    ? channel.tvgLogo
    : null;

  // Handle icon load error
  const handleIconError = useCallback(() => {
    setIconError(true);
  }, []);

  // Show toast notification
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

  // ESC key handler for dialogs
  useEffect(() => {
    if (!showPromoteDialog && !showLinkedChannelsPopover) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPromoteDialog) setShowPromoteDialog(false);
        if (showLinkedChannelsPopover) setShowLinkedChannelsPopover(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showPromoteDialog, showLinkedChannelsPopover]);

  // Mutation for promoting orphan to lineup
  const promoteMutation = useMutation({
    mutationFn: () => promoteM3uOrphanToPlex(
      channel.id,
      promoteForm.displayName,
      promoteForm.iconUrl || null
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['m3u-channels', sourceId] });
      queryClient.invalidateQueries({ queryKey: ['m3u-sources'] });
      queryClient.invalidateQueries({ queryKey: ['targetLineupChannels'] });
      setShowPromoteDialog(false);
      setMenuOpen(false);
      showToast(`${promoteForm.displayName} promoted to lineup`, 'success');
      onUpdate();
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to promote channel', 'error');
    },
  });

  const handlePromoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoteForm.displayName.trim()) {
      showToast('Display name is required', 'error');
      return;
    }
    promoteMutation.mutate();
  };

  const handleViewInLineup = () => {
    navigate(ROUTES.TARGET_LINEUP);
    setMenuOpen(false);
  };

  // Get status badge icon
  const getStatusIcon = () => {
    switch (channel.linkStatus) {
      case 'linked':
        return <Link2 className="w-3 h-3 mr-1" />;
      case 'orphan':
        return <AlertTriangle className="w-3 h-3 mr-1" />;
      case 'promoted':
        return <CheckCircle2 className="w-3 h-3 mr-1" />;
      default:
        return null;
    }
  };

  return (
    <>
      <div
        data-testid={`m3u-channel-row-${channel.id}`}
        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
      >
        {/* Channel Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Channel Icon */}
          {safeLogoUrl && !iconError ? (
            <img
              data-testid={`m3u-channel-icon-${channel.id}`}
              src={safeLogoUrl}
              alt=""
              className="w-8 h-8 rounded object-contain flex-shrink-0"
              onError={handleIconError}
            />
          ) : (
            <div
              data-testid={`m3u-channel-icon-${channel.id}`}
              className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center flex-shrink-0"
            >
              <Tv className="w-4 h-4 text-gray-400" />
            </div>
          )}

          {/* Channel Name */}
          <span
            data-testid={`m3u-channel-name-${channel.id}`}
            className="font-medium text-gray-900 truncate"
          >
            {channel.name}
          </span>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Link Status Badge */}
            <span
              data-testid={`m3u-channel-${channel.linkStatus}-badge-${channel.id}`}
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getLinkStatusBadgeClasses(channel.linkStatus)}`}
              role="status"
            >
              {getStatusIcon()}
              {getLinkStatusLabel(channel.linkStatus)}
            </span>

            {/* Group (if available) */}
            {channel.groupTitle && (
              <span className="text-xs text-gray-400">
                {channel.groupTitle}
              </span>
            )}
          </div>
        </div>

        {/* Play Button */}
        <PlayButton
          getStreamUrl={() => channel.streamUrl}
          title={channel.name}
          icon={safeLogoUrl}
        />

        {/* Action Menu */}
        <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Popover.Trigger asChild>
            <button
              data-testid={`m3u-channel-actions-${channel.id}`}
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded hover:bg-gray-200 transition-colors ml-2"
              aria-haspopup="menu"
            >
              <MoreVertical className="w-4 h-4 text-gray-500" />
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              data-testid={`m3u-channel-menu-${channel.id}`}
              align="end"
              sideOffset={4}
              className="w-56 bg-white rounded-md shadow-lg border z-50"
              role="menu"
            >
              {/* Actions based on link status */}
              {channel.linkStatus === 'orphan' && (
                <>
                  <button
                    data-testid={`promote-to-lineup-${channel.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPromoteForm({
                        displayName: channel.name,
                        iconUrl: channel.tvgLogo || '',
                      });
                      setShowPromoteDialog(true);
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-t-md"
                    role="menuitem"
                  >
                    <CheckCircle2 className="w-4 h-4 inline mr-2" />
                    Promote to Lineup
                  </button>
                  <button
                    data-testid={`link-to-xmltv-${channel.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowLinkDialog(true);
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t rounded-b-md"
                    role="menuitem"
                  >
                    <LinkIcon className="w-4 h-4 inline mr-2" />
                    Link to XMLTV Channel
                  </button>
                </>
              )}

              {channel.linkStatus === 'linked' && (
                <>
                  <button
                    data-testid={`view-linked-channels-${channel.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowLinkedChannelsPopover(true);
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                    role="menuitem"
                  >
                    <Link2 className="w-4 h-4 inline mr-2" />
                    View Linked Channels ({channel.linkedXmltvIds.length})
                  </button>
                </>
              )}

              {channel.linkStatus === 'promoted' && (
                <>
                  <button
                    data-testid={`view-in-lineup-${channel.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewInLineup();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                    role="menuitem"
                  >
                    View in Lineup
                  </button>
                </>
              )}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

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

      {/* Promote Dialog */}
      {showPromoteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div data-testid="promote-m3u-dialog" className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Promote to Lineup</h2>
            <p className="text-gray-600 mb-4">
              Create a synthetic channel for this M3U stream and add it to your Plex lineup.
            </p>
            <form onSubmit={handlePromoteSubmit}>
              <div className="mb-4">
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  data-testid="promote-display-name"
                  id="displayName"
                  type="text"
                  value={promoteForm.displayName}
                  onChange={(e) => setPromoteForm(prev => ({ ...prev, displayName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-6">
                <label htmlFor="iconUrl" className="block text-sm font-medium text-gray-700 mb-1">
                  Icon URL (optional)
                </label>
                <input
                  id="iconUrl"
                  type="text"
                  value={promoteForm.iconUrl}
                  onChange={(e) => setPromoteForm(prev => ({ ...prev, iconUrl: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/icon.png"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPromoteDialog(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  data-testid="promote-submit-button"
                  type="submit"
                  disabled={promoteMutation.isPending}
                  className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {promoteMutation.isPending ? 'Creating...' : 'Promote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Linked Channels Popover */}
      {showLinkedChannelsPopover && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            data-testid="linked-channels-popover"
            className="bg-white rounded-lg p-6 w-full max-w-sm"
          >
            <h3 className="text-lg font-semibold mb-4">Linked XMLTV Channels</h3>
            <p className="text-gray-600 mb-4">
              This M3U channel is linked as a video source to{' '}
              <strong>{channel.linkedXmltvIds.length}</strong> XMLTV channel
              {channel.linkedXmltvIds.length !== 1 ? 's' : ''}.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              To view or manage the linked channels, browse the XMLTV tab in Sources.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowLinkedChannelsPopover(false);
                  navigate(ROUTES.SOURCES);
                }}
                className="flex-1 px-4 py-2 text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
              >
                Go to Sources
              </button>
              <button
                type="button"
                onClick={() => setShowLinkedChannelsPopover(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link to XMLTV Channel Dialog */}
      {showLinkDialog && (
        <LinkToXmltvChannelDialog
          sourceType="m3u"
          sourceId={channel.id}
          sourceName={channel.name}
          onClose={() => setShowLinkDialog(false)}
          onSuccess={() => {
            setShowLinkDialog(false);
            onUpdate();
          }}
          invalidateQueryKeys={[['m3u-channels', sourceId]]}
        />
      )}
    </>
  );
}
