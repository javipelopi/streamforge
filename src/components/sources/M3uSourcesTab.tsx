/**
 * M3U Sources Tab Component
 * Multi-Source Stream Support: M3U Playlist Management
 * Sources-Centric UX Unification: Phase 4.3
 *
 * Displays M3U playlist sources as expandable accordion sections.
 * Each source shows channels parsed from the playlist.
 * Features "Add M3U Playlist" button that opens modal dialog.
 */
import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { List, Plus } from 'lucide-react';
import {
  getM3uSources,
  addM3uSource,
  updateM3uSource,
  deleteM3uSource,
  type M3uSource,
} from '../../lib/tauri';
import { M3uSourceAccordion } from './M3uSourceAccordion';
import { SourcesErrorBoundary } from './SourcesErrorBoundary';
import { M3uSourceDialog, type M3uSourceFormData } from './M3uSourceDialog';
import { DeleteConfirmDialog } from './shared';

export function M3uSourcesTab() {
  const queryClient = useQueryClient();

  // Dialog state
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [editingSource, setEditingSource] = useState<M3uSource | undefined>(undefined);
  const [deletingSource, setDeletingSource] = useState<M3uSource | null>(null);

  // Fetch M3U sources
  const {
    data: sources = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['m3u-sources'],
    queryFn: getM3uSources,
  });

  // Add source mutation
  const addMutation = useMutation({
    mutationFn: async (data: M3uSourceFormData) => {
      return addM3uSource(
        data.name,
        data.url,
        data.refreshIntervalHours,
        data.isLocalFile,
        data.isSingleStream
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['m3u-sources'] });
      setShowSourceDialog(false);
      setEditingSource(undefined);
    },
  });

  // Update source mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: M3uSourceFormData }) => {
      return updateM3uSource(id, {
        name: data.name,
        url: data.url,
        refreshIntervalHours: data.refreshIntervalHours,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['m3u-sources'] });
      setShowSourceDialog(false);
      setEditingSource(undefined);
    },
  });

  // Delete source mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return deleteM3uSource(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['m3u-sources'] });
      setDeletingSource(null);
    },
  });

  // Submit handler for dialog
  const handleSubmit = async (data: M3uSourceFormData): Promise<void> => {
    if (editingSource) {
      await updateMutation.mutateAsync({ id: editingSource.id, data });
    } else {
      await addMutation.mutateAsync(data);
    }
  };

  // Edit handler from accordion
  const handleEdit = (source: M3uSource) => {
    setEditingSource(source);
    setShowSourceDialog(true);
  };

  // Delete handler from accordion
  const handleDelete = (source: M3uSource) => {
    setDeletingSource(source);
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

  // Loading state
  if (isLoading) {
    return (
      <div data-testid="m3u-sources-tab" className="animate-pulse space-y-4">
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
        data-testid="m3u-sources-tab"
        className="p-4 bg-red-50 border border-red-200 rounded-lg"
      >
        <p className="text-red-700">Failed to load M3U sources</p>
      </div>
    );
  }

  // Empty state
  if (sources.length === 0) {
    return (
      <div data-testid="m3u-sources-tab">
        <div data-testid="m3u-empty-state" className="text-center py-12">
          <List className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <div data-testid="m3u-empty-state-message">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              No M3U playlists configured
            </h2>
            <p className="text-gray-500 mb-6">
              Add an M3U playlist URL to import channels.
            </p>
          </div>
          <button
            data-testid="add-m3u-source-button"
            onClick={handleAdd}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add M3U Playlist
          </button>
        </div>

        <M3uSourceDialog
          open={showSourceDialog}
          onOpenChange={handleCloseDialog}
          source={editingSource}
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
        />
      </div>
    );
  }

  // Sources list
  return (
    <div data-testid="m3u-sources-tab" className="space-y-4 overflow-auto h-full">
      {/* Add source button */}
      <div className="flex justify-end">
        <button
          data-testid="add-m3u-source-button"
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add M3U Playlist
        </button>
      </div>

      {sources.map((source) => (
        <SourcesErrorBoundary
          key={source.id}
          fallbackMessage={`Error loading channels for ${source.name}`}
        >
          <M3uSourceAccordion
            source={source}
            onEdit={() => handleEdit(source)}
            onDelete={() => handleDelete(source)}
          />
        </SourcesErrorBoundary>
      ))}

      {/* Source Dialog */}
      <M3uSourceDialog
        open={showSourceDialog}
        onOpenChange={handleCloseDialog}
        source={editingSource}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={!!deletingSource}
        onOpenChange={(open) => {
          if (!open) setDeletingSource(null);
        }}
        title="Delete M3U Source"
        description={`Are you sure you want to delete "${deletingSource?.name}"? This will remove all associated channels and mappings.`}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingSource) {
            deleteMutation.mutate(deletingSource.id);
          }
        }}
        testIdPrefix="m3u-delete"
      />
    </div>
  );
}
