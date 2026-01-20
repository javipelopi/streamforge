/**
 * Xtream Stream Row Component
 * Story 3-11: Implement Sources View with Xtream Tab
 *
 * Displays a single Xtream stream with badges for link status and quality.
 * Includes action menu for linking, unlinking, and promoting.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreVertical, Tv, Link2, LinkIcon, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  promoteOrphanToPlex,
  unlinkXtreamStream,
  getQualityBadgeClasses,
  getLinkStatusBadgeClasses,
  getLinkStatusLabel,
  type XtreamAccountStream,
} from '../../lib/tauri';
import { ROUTES } from '../../lib/routes';
import { XtreamLinkToChannelDialog } from './XtreamLinkToChannelDialog';

// Toast notification duration in milliseconds
const TOAST_DURATION_MS = 3000;

interface XtreamStreamRowProps {
  stream: XtreamAccountStream;
  accountId: number;
  onUpdate: () => void;
}

export function XtreamStreamRow({ stream, accountId, onUpdate }: XtreamStreamRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [iconError, setIconError] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [showLinkedChannelsPopover, setShowLinkedChannelsPopover] = useState(false);
  const [promoteForm, setPromoteForm] = useState({
    displayName: stream.name,
    iconUrl: stream.streamIcon || '',
  });
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });
  const queryClient = useQueryClient();
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Handle icon load error - show fallback
  const handleIconError = useCallback(() => {
    setIconError(true);
  }, []);

  // Show toast notification
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), TOAST_DURATION_MS);
  }, []);

  // Mutation for unlinking a stream
  const unlinkMutation = useMutation({
    mutationFn: async () => {
      // Remove all mappings for this xtream stream
      // This changes the stream status from 'linked' to 'orphan'
      return unlinkXtreamStream(stream.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-stream-stats', accountId] });
      queryClient.invalidateQueries({ queryKey: ['xtream-streams', accountId] });
      queryClient.invalidateQueries({ queryKey: ['targetLineupChannels'] });
      setMenuOpen(false);
      showToast(`${stream.name} unlinked`, 'success');
      onUpdate();
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to unlink stream', 'error');
      setMenuOpen(false);
    },
  });

  // Mutation for promoting orphan to lineup
  const promoteMutation = useMutation({
    mutationFn: () => promoteOrphanToPlex(
      stream.id,
      promoteForm.displayName,
      promoteForm.iconUrl || null
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-stream-stats', accountId] });
      queryClient.invalidateQueries({ queryKey: ['xtream-streams', accountId] });
      queryClient.invalidateQueries({ queryKey: ['targetLineupChannels'] });
      setShowPromoteDialog(false);
      setMenuOpen(false);
      showToast(`${promoteForm.displayName} promoted to lineup`, 'success');
      onUpdate();
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to promote stream', 'error');
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

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Get status badge icon
  const getStatusIcon = () => {
    switch (stream.linkStatus) {
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
        data-testid={`xtream-stream-row-${stream.streamId}`}
        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
      >
        {/* Stream Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Stream Icon - show image or fallback placeholder */}
          {stream.streamIcon && !iconError ? (
            <img
              data-testid={`xtream-stream-icon-${stream.streamId}`}
              src={stream.streamIcon}
              alt=""
              className="w-8 h-8 rounded object-cover flex-shrink-0"
              onError={handleIconError}
            />
          ) : (
            <div
              data-testid={`xtream-stream-icon-${stream.streamId}`}
              className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center flex-shrink-0"
            >
              <Tv className="w-4 h-4 text-gray-400" />
            </div>
          )}

          {/* Stream Name */}
          <span
            data-testid={`xtream-stream-name-${stream.streamId}`}
            className="font-medium text-gray-900 truncate"
          >
            {stream.name}
          </span>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Quality Badges */}
            {stream.qualities.map((quality) => (
              <span
                key={quality}
                data-testid={`xtream-stream-quality-badge-${stream.streamId}-${quality}`}
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getQualityBadgeClasses(quality)}`}
              >
                {quality}
              </span>
            ))}

            {/* Link Status Badge - use status-specific test IDs for easier testing */}
            <span
              data-testid={`xtream-stream-${stream.linkStatus}-badge-${stream.streamId}`}
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getLinkStatusBadgeClasses(stream.linkStatus)}`}
              role="status"
            >
              {getStatusIcon()}
              {getLinkStatusLabel(stream.linkStatus)}
            </span>

            {/* Category Name (if available) */}
            {stream.categoryName && (
              <span className="text-xs text-gray-400">
                {stream.categoryName}
              </span>
            )}
          </div>
        </div>

        {/* Action Menu */}
        <div ref={menuRef} className="relative ml-2">
          <button
            data-testid={`xtream-stream-actions-${stream.streamId}`}
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
              data-testid={`xtream-stream-menu-${stream.streamId}`}
              className="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg border z-10"
              role="menu"
            >
              {/* Actions based on link status */}
              {stream.linkStatus === 'orphan' && (
                <>
                  <button
                    data-testid={`promote-to-lineup-${stream.streamId}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPromoteForm({
                        displayName: stream.name,
                        iconUrl: stream.streamIcon || '',
                      });
                      setShowPromoteDialog(true);
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    <CheckCircle2 className="w-4 h-4 inline mr-2" />
                    Promote to Lineup
                  </button>
                  <button
                    data-testid={`link-to-xmltv-${stream.streamId}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowLinkDialog(true);
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t"
                    role="menuitem"
                  >
                    <LinkIcon className="w-4 h-4 inline mr-2" />
                    Link to XMLTV Channel
                  </button>
                </>
              )}

              {stream.linkStatus === 'linked' && (
                <>
                  <button
                    data-testid={`view-linked-channels-${stream.streamId}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Show linked channels popover
                      setShowLinkedChannelsPopover(true);
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    <Link2 className="w-4 h-4 inline mr-2" />
                    View Linked Channels ({stream.linkedXmltvIds.length})
                  </button>
                  <button
                    data-testid={`unlink-stream-${stream.streamId}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      unlinkMutation.mutate();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 border-t"
                    role="menuitem"
                    disabled={unlinkMutation.isPending}
                  >
                    <AlertTriangle className="w-4 h-4 inline mr-2" />
                    {unlinkMutation.isPending ? 'Unlinking...' : 'Unlink'}
                  </button>
                </>
              )}

              {stream.linkStatus === 'promoted' && (
                <>
                  <button
                    data-testid={`view-in-lineup-${stream.streamId}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewInLineup();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    View in Lineup
                  </button>
                  <button
                    data-testid={`edit-channel-${stream.streamId}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      // For now, direct to Target Lineup for editing
                      showToast('Edit channel in Target Lineup', 'success');
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t"
                    role="menuitem"
                  >
                    Edit Channel
                  </button>
                </>
              )}
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

      {/* Promote Dialog */}
      {showPromoteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div data-testid="promote-orphan-dialog" className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Promote to Lineup</h2>
            <p className="text-gray-600 mb-4">
              Create a synthetic channel for this stream and add it to your Plex lineup.
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

      {/* Link to Channel Dialog */}
      {showLinkDialog && (
        <XtreamLinkToChannelDialog
          stream={stream}
          accountId={accountId}
          onClose={() => setShowLinkDialog(false)}
          onSuccess={() => {
            setShowLinkDialog(false);
            onUpdate();
          }}
        />
      )}

      {/* Linked Channels Popover */}
      {showLinkedChannelsPopover && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            data-testid="linked-channels-popover"
            className="bg-white rounded-lg p-6 w-full max-w-sm"
          >
            <h3 className="text-lg font-semibold mb-4">Linked XMLTV Channels</h3>
            <p className="text-gray-600 mb-2">
              This stream is linked to {stream.linkedXmltvIds.length} XMLTV channel(s):
            </p>
            <ul className="list-disc list-inside mb-4">
              {stream.linkedXmltvIds.map((xmltvId) => (
                <li key={xmltvId} className="text-gray-700">
                  Channel ID: {xmltvId}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShowLinkedChannelsPopover(false)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
