/**
 * Acestream Source Row Component
 *
 * Displays a single Acestream source with link status badge and action menu.
 * Matches the pattern used in XtreamStreamRow for consistency.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Popover from '@radix-ui/react-popover';
import { MoreVertical, Radio, Link2, LinkIcon, AlertTriangle, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  promoteAcestreamOrphanToPlex,
  getLinkStatusBadgeClasses,
  getLinkStatusLabel,
  deleteAcestreamSource,
  toggleAcestreamSource,
  type AcestreamSource,
} from '../../lib/tauri';
import { ROUTES } from '../../lib/routes';
import { TOAST_DURATION_MS } from '../../lib/constants';
import { LinkToXmltvChannelDialog } from './LinkToXmltvChannelDialog';

interface AcestreamSourceRowProps {
  source: AcestreamSource;
  onUpdate: () => void;
}

export function AcestreamSourceRow({ source, onUpdate }: AcestreamSourceRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showLinkedChannelsPopover, setShowLinkedChannelsPopover] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [promoteForm, setPromoteForm] = useState({
    displayName: source.name,
    iconUrl: '',
  });
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

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
    if (!showPromoteDialog && !showLinkedChannelsPopover && !showDeleteConfirm) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPromoteDialog) setShowPromoteDialog(false);
        if (showLinkedChannelsPopover) setShowLinkedChannelsPopover(false);
        if (showDeleteConfirm) setShowDeleteConfirm(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showPromoteDialog, showLinkedChannelsPopover, showDeleteConfirm]);

  // Focus Cancel button when delete dialog opens
  useEffect(() => {
    if (showDeleteConfirm && cancelButtonRef.current) {
      cancelButtonRef.current.focus();
    }
  }, [showDeleteConfirm]);

  // Mutation for promoting orphan to lineup
  const promoteMutation = useMutation({
    mutationFn: () => promoteAcestreamOrphanToPlex(
      source.id,
      promoteForm.displayName,
      promoteForm.iconUrl || null
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acestream-sources'] });
      queryClient.invalidateQueries({ queryKey: ['targetLineupChannels'] });
      setShowPromoteDialog(false);
      setMenuOpen(false);
      showToast(`${promoteForm.displayName} promoted to lineup`, 'success');
      onUpdate();
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to promote source', 'error');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteAcestreamSource(source.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acestream-sources'] });
      setShowDeleteConfirm(false);
      showToast(`${source.name} deleted`, 'success');
      onUpdate();
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to delete source', 'error');
    },
  });

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: (active: boolean) => toggleAcestreamSource(source.id, active),
    onSuccess: (_, active) => {
      queryClient.invalidateQueries({ queryKey: ['acestream-sources'] });
      showToast(`${source.name} ${active ? 'enabled' : 'disabled'}`, 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to toggle source', 'error');
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
    switch (source.linkStatus) {
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
        data-testid={`acestream-source-row-${source.id}`}
        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border border-gray-200 rounded-lg bg-white"
      >
        {/* Source Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Radio icon for Acestream */}
          <div
            data-testid={`acestream-source-icon-${source.id}`}
            className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center flex-shrink-0"
          >
            <Radio className="w-4 h-4 text-gray-400" />
          </div>

          {/* Source Name and Content ID */}
          <div className="flex flex-col min-w-0">
            <span
              data-testid={`acestream-source-name-${source.id}`}
              className="font-medium text-gray-900 truncate"
            >
              {source.name}
            </span>
            <span className="text-xs text-gray-500 font-mono truncate">
              {source.contentId}
            </span>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Link Status Badge */}
            <span
              data-testid={`acestream-source-${source.linkStatus}-badge-${source.id}`}
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getLinkStatusBadgeClasses(source.linkStatus)}`}
              role="status"
            >
              {getStatusIcon()}
              {getLinkStatusLabel(source.linkStatus)}
            </span>

            {/* Active Status Badge */}
            <span
              data-testid={`acestream-status-badge-${source.id}`}
              data-status={source.isActive ? 'active' : 'inactive'}
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                source.isActive
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {source.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Toggle button */}
          <button
            onClick={() => toggleMutation.mutate(!source.isActive)}
            disabled={toggleMutation.isPending}
            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
          >
            {toggleMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : source.isActive ? (
              'Disable'
            ) : (
              'Enable'
            )}
          </button>

          {/* Delete button */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleteMutation.isPending}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            title="Delete source"
            aria-label="Delete source"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>

          {/* Action Menu */}
          <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Popover.Trigger asChild>
              <button
                data-testid={`acestream-source-actions-${source.id}`}
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded hover:bg-gray-200 transition-colors"
                aria-haspopup="menu"
              >
                <MoreVertical className="w-4 h-4 text-gray-500" />
              </button>
            </Popover.Trigger>

            <Popover.Portal>
              <Popover.Content
                data-testid={`acestream-source-menu-${source.id}`}
                align="end"
                sideOffset={4}
                className="w-56 bg-white rounded-md shadow-lg border z-50"
                role="menu"
              >
                {/* Actions based on link status */}
                {source.linkStatus === 'orphan' && (
                  <>
                    <button
                      data-testid={`promote-to-lineup-${source.id}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPromoteForm({
                          displayName: source.name,
                          iconUrl: '',
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
                      data-testid={`link-to-xmltv-${source.id}`}
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

                {source.linkStatus === 'linked' && (
                  <>
                    <button
                      data-testid={`view-linked-channels-${source.id}`}
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
                      View Linked Channels ({source.linkedXmltvIds.length})
                    </button>
                  </>
                )}

                {source.linkStatus === 'promoted' && (
                  <>
                    <button
                      data-testid={`view-in-lineup-${source.id}`}
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
          <div data-testid="promote-acestream-dialog" className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Promote to Lineup</h2>
            <p className="text-gray-600 mb-4">
              Create a synthetic channel for this Acestream source and add it to your Plex lineup.
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

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-acestream-dialog-title-${source.id}`}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3
              id={`delete-acestream-dialog-title-${source.id}`}
              className="text-lg font-semibold text-gray-900 mb-2"
            >
              Delete Acestream Source?
            </h3>
            <p className="text-gray-600 mb-4">
              This will delete &ldquo;{source.name}&rdquo;. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                ref={cancelButtonRef}
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
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
              This Acestream source is linked as a video source to{' '}
              <strong>{source.linkedXmltvIds.length}</strong> XMLTV channel
              {source.linkedXmltvIds.length !== 1 ? 's' : ''}.
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
          sourceType="acestream"
          sourceId={source.id}
          sourceName={source.name}
          onClose={() => setShowLinkDialog(false)}
          onSuccess={() => {
            setShowLinkDialog(false);
            onUpdate();
          }}
        />
      )}
    </>
  );
}
