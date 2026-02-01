/**
 * Acestream Sources Tab Component
 * Multi-Source Stream Support: Acestream Management
 *
 * Displays Acestream sources and shows platform-specific warnings.
 * On macOS, shows a banner explaining Acestream is unsupported.
 */
import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Radio, Plus, AlertTriangle, Loader2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import {
  getAcestreamSources,
  addAcestreamSource,
  deleteAcestreamSource,
  toggleAcestreamSource,
  checkAcestreamStatus,
  type AcestreamSource,
  type AcestreamStatus,
} from '../../lib/tauri';
import { SourcesErrorBoundary } from './SourcesErrorBoundary';
import { AddAcestreamDialog } from './AddAcestreamDialog';

export function AcestreamSourcesTab() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [mutatingId, setMutatingId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Check Acestream status (platform + engine)
  const {
    data: status,
    isLoading: statusLoading,
    error: statusError,
  } = useQuery<AcestreamStatus>({
    queryKey: ['acestream-status'],
    queryFn: checkAcestreamStatus,
    staleTime: 60000, // 1 minute
  });

  // Log status check errors
  useEffect(() => {
    if (statusError) {
      console.error('Failed to check Acestream status:', statusError);
    }
  }, [statusError]);

  // Fetch Acestream sources
  const {
    data: sources = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['acestream-sources'],
    queryFn: getAcestreamSources,
  });

  // Add source mutation
  const addMutation = useMutation({
    mutationFn: async ({ name, contentIdOrUrl }: { name: string; contentIdOrUrl: string }) => {
      return addAcestreamSource(name, contentIdOrUrl);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acestream-sources'] });
      setShowAddDialog(false);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (sourceId: number) => deleteAcestreamSource(sourceId),
    onSuccess: () => {
      setMutatingId(null);
      queryClient.invalidateQueries({ queryKey: ['acestream-sources'] });
    },
    onError: (error) => {
      setMutatingId(null);
      console.error('Failed to delete Acestream source:', error);
      // TODO: Show toast notification
      window.alert(`Failed to delete source: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: ({ sourceId, active }: { sourceId: number; active: boolean }) =>
      toggleAcestreamSource(sourceId, active),
    onSuccess: () => {
      setMutatingId(null);
      queryClient.invalidateQueries({ queryKey: ['acestream-sources'] });
    },
    onError: (error) => {
      setMutatingId(null);
      console.error('Failed to toggle Acestream source:', error);
      // TODO: Show toast notification
      window.alert(`Failed to toggle source: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  // Platform warning for macOS
  const showPlatformWarning = status && !status.isSupported;

  // Loading state
  if (isLoading || statusLoading) {
    return (
      <div data-testid="acestream-sources-tab" className="animate-pulse space-y-4">
        <div className="h-16 bg-gray-200 rounded"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        data-testid="acestream-sources-tab"
        className="p-4 bg-red-50 border border-red-200 rounded-lg"
      >
        <p className="text-red-700">Failed to load Acestream sources</p>
      </div>
    );
  }

  // Status error state
  if (statusError) {
    return (
      <div
        data-testid="acestream-sources-tab"
        className="p-4 bg-red-50 border border-red-200 rounded-lg"
      >
        <p className="text-red-700">Failed to check Acestream status</p>
      </div>
    );
  }

  return (
    <div data-testid="acestream-sources-tab" className="space-y-4 overflow-auto h-full">
      {/* Platform warning banner for macOS */}
      {showPlatformWarning && (
        <div
          data-testid="acestream-mac-warning"
          role="alert"
          className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-amber-800">Acestream Not Supported on {status?.platform}</h3>
            <p className="text-sm text-amber-700 mt-1">
              Acestream Engine is only available on Windows and Linux. Acestream sources
              added here will not be playable on this system. You can still manage sources
              for use on other devices.
            </p>
          </div>
        </div>
      )}

      {/* Engine status indicator (for supported platforms only) */}
      {status?.isSupported && (
        <div
          data-testid="acestream-engine-status"
          data-status={status.engineAvailable ? 'available' : 'unavailable'}
          className={`p-4 rounded-lg flex items-center gap-3 ${
            status.engineAvailable
              ? 'bg-green-50 border border-green-200'
              : 'bg-yellow-50 border border-yellow-200'
          }`}
        >
          {status.engineAvailable ? (
            <>
              <CheckCircle
                data-testid="acestream-engine-available"
                aria-label="Engine available"
                className="w-5 h-5 text-green-600"
              />
              <div>
                <span className="font-medium text-green-800">Engine Available</span>
                <span className="text-sm text-green-600 ml-2">
                  {status.engineUrl}
                </span>
              </div>
            </>
          ) : (
            <>
              <XCircle
                data-testid="acestream-engine-unavailable"
                aria-label="Engine not available"
                className="w-5 h-5 text-yellow-600"
              />
              <div>
                <span className="font-medium text-yellow-800">Engine Not Found</span>
                <p data-testid="acestream-engine-instructions" className="text-sm text-yellow-700">
                  Please start Acestream Engine to enable playback.
                  <a
                    href="https://acestream.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline ml-1 hover:text-yellow-900"
                  >
                    Download Acestream
                  </a>
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Add source button */}
      <div className="flex justify-end">
        <button
          data-testid="add-acestream-source-button"
          onClick={() => setShowAddDialog(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Acestream Source
        </button>
      </div>

      {/* Empty state */}
      {sources.length === 0 && (
        <div data-testid="acestream-empty-state" className="text-center py-12">
          <Radio className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <div data-testid="acestream-empty-state-message">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              No Acestream sources configured
            </h2>
            <p className="text-gray-500 mb-6">
              Add Acestream content IDs to use as stream sources.
            </p>
          </div>
        </div>
      )}

      {/* Sources list */}
      {sources.length > 0 && (
        <div className="space-y-2">
          {sources.map((source) => (
            <SourcesErrorBoundary
              key={source.id}
              fallbackMessage={`Error displaying ${source.name}`}
            >
              <AcestreamSourceRow
                source={source}
                onDelete={() => {
                  setMutatingId(source.id);
                  deleteMutation.mutate(source.id);
                }}
                onToggle={(active) => {
                  setMutatingId(source.id);
                  toggleMutation.mutate({ sourceId: source.id, active });
                }}
                isDeleting={deleteMutation.isPending && mutatingId === source.id}
                isToggling={toggleMutation.isPending && mutatingId === source.id}
              />
            </SourcesErrorBoundary>
          ))}
        </div>
      )}

      <AddAcestreamDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={addMutation.mutate}
        isLoading={addMutation.isPending}
        error={addMutation.error?.message}
        onResetError={() => addMutation.reset()}
      />
    </div>
  );
}

// Acestream source row component
function AcestreamSourceRow({
  source,
  onDelete,
  onToggle,
  isDeleting,
  isToggling,
}: {
  source: AcestreamSource;
  onDelete: () => void;
  onToggle: (active: boolean) => void;
  isDeleting: boolean;
  isToggling: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // eslint-disable-next-line no-undef
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Focus Cancel button when dialog opens
  useEffect(() => {
    if (showDeleteConfirm && cancelButtonRef.current) {
      cancelButtonRef.current.focus();
    }
  }, [showDeleteConfirm]);

  return (
    <div
      data-testid={`acestream-source-row-${source.id}`}
      className="border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between bg-white"
    >
      <div className="flex items-center gap-4">
        <Radio className="w-5 h-5 text-gray-400" />
        <div>
          <div className="font-medium text-gray-900">{source.name}</div>
          <div className="text-sm text-gray-500 font-mono">{source.contentId}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Active status badge */}
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

        {/* Toggle button */}
        <button
          onClick={() => onToggle(!source.isActive)}
          disabled={isToggling}
          className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
        >
          {isToggling ? (
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
          disabled={isDeleting}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
          title="Delete source"
          aria-label="Delete source"
        >
          {isDeleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-acestream-dialog-title-${source.id}`}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowDeleteConfirm(false);
            }
          }}
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
                onClick={() => {
                  onDelete();
                  setShowDeleteConfirm(false);
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
