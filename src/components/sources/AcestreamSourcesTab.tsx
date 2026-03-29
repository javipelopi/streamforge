/**
 * Acestream Sources Tab Component
 * Multi-Source Stream Support: Acestream Management
 * Sources-Centric UX Unification: Phase 4.4
 *
 * Displays Acestream sources with a flat list pattern and shows platform-specific warnings.
 * On macOS, shows a banner explaining Acestream is unsupported.
 */
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Radio, Plus, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import {
  getAcestreamSources,
  addAcestreamSource,
  updateAcestreamSource,
  checkAcestreamStatus,
  type AcestreamStatus,
  type AcestreamSource,
} from '../../lib/api';
import { SourcesErrorBoundary } from './SourcesErrorBoundary';
import { AcestreamSourceDialog, type AcestreamSourceFormData } from './AcestreamSourceDialog';
import { AcestreamSourceRow } from './AcestreamSourceRow';

export function AcestreamSourcesTab() {
  const queryClient = useQueryClient();

  // Dialog state
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [editingSource, setEditingSource] = useState<AcestreamSource | undefined>(undefined);

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
    mutationFn: async (data: AcestreamSourceFormData) => {
      return addAcestreamSource(data.name, data.contentIdOrUrl);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acestream-sources'] });
      setShowSourceDialog(false);
      setEditingSource(undefined);
    },
  });

  // Update source mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: AcestreamSourceFormData }) => {
      return updateAcestreamSource(id, { name: data.name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acestream-sources'] });
      setShowSourceDialog(false);
      setEditingSource(undefined);
    },
  });

  // Handler for source updates from rows
  const handleSourceUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['acestream-sources'] });
  };

  // Submit handler for dialog
  const handleSubmit = async (data: AcestreamSourceFormData): Promise<void> => {
    if (editingSource) {
      await updateMutation.mutateAsync({ id: editingSource.id, data });
    } else {
      await addMutation.mutateAsync(data);
    }
  };

  // Edit handler from row
  const handleEdit = (source: AcestreamSource) => {
    setEditingSource(source);
    setShowSourceDialog(true);
  };

  // Add button handler
  const handleAdd = () => {
    setEditingSource(undefined);
    setShowSourceDialog(true);
  };

  // Close dialog handler
  const handleCloseDialog = (open: boolean) => {
    if (!open) {
      setShowSourceDialog(false);
      setEditingSource(undefined);
      addMutation.reset();
      updateMutation.reset();
    }
  };

  const isSubmitting = addMutation.isPending || updateMutation.isPending;

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
          onClick={handleAdd}
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
                onUpdate={handleSourceUpdate}
                onEdit={() => handleEdit(source)}
              />
            </SourcesErrorBoundary>
          ))}
        </div>
      )}

      {/* Source Dialog */}
      <AcestreamSourceDialog
        open={showSourceDialog}
        onOpenChange={handleCloseDialog}
        source={editingSource}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
      />
    </div>
  );
}
