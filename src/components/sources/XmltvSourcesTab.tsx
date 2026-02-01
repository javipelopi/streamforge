/**
 * XMLTV Sources Tab Component
 * Story 3-10: Implement Sources View with XMLTV Tab
 * Sources-Centric UX Unification: Phase 4.2
 *
 * Displays XMLTV sources as expandable accordion sections.
 * Each source shows channels with lineup status and match counts.
 * Features "Add XMLTV Source" button that opens modal dialog.
 */
import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Radio, Plus } from 'lucide-react';
import {
  getXmltvSources,
  addXmltvSource,
  updateXmltvSource,
  deleteXmltvSource,
  type XmltvSource,
  type NewXmltvSource,
} from '../../lib/tauri';
import { XmltvSourceAccordion } from './XmltvSourceAccordion';
import { SourcesErrorBoundary } from './SourcesErrorBoundary';
import { XmltvSourceDialog } from './XmltvSourceDialog';
import { DeleteConfirmDialog } from './shared';

export function XmltvSourcesTab() {
  const queryClient = useQueryClient();

  // Dialog state
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [editingSource, setEditingSource] = useState<XmltvSource | undefined>(undefined);
  const [deletingSource, setDeletingSource] = useState<XmltvSource | null>(null);

  // Fetch XMLTV sources
  const {
    data: sources = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['xmltv-sources'],
    queryFn: getXmltvSources,
  });

  // Add source mutation
  const addMutation = useMutation({
    mutationFn: async (data: NewXmltvSource) => {
      return addXmltvSource(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xmltv-sources'] });
      setShowSourceDialog(false);
      setEditingSource(undefined);
    },
  });

  // Update source mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: NewXmltvSource }) => {
      return updateXmltvSource(id, {
        name: data.name,
        url: data.url,
        format: data.format,
        refreshIntervalHours: data.refreshIntervalHours,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xmltv-sources'] });
      setShowSourceDialog(false);
      setEditingSource(undefined);
    },
  });

  // Delete source mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return deleteXmltvSource(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xmltv-sources'] });
      setDeletingSource(null);
    },
  });

  // Submit handler for dialog
  const handleSubmit = async (data: NewXmltvSource): Promise<void> => {
    if (editingSource) {
      await updateMutation.mutateAsync({ id: editingSource.id, data });
    } else {
      await addMutation.mutateAsync(data);
    }
  };

  // Edit handler from accordion
  const handleEdit = (source: XmltvSource) => {
    setEditingSource(source);
    setShowSourceDialog(true);
  };

  // Delete handler from accordion
  const handleDelete = (source: XmltvSource) => {
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
      <div data-testid="xmltv-sources-tab" className="animate-pulse space-y-4">
        <div className="h-16 bg-gray-200 rounded"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div data-testid="xmltv-sources-tab" className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">Failed to load XMLTV sources</p>
      </div>
    );
  }

  // Empty state
  if (sources.length === 0) {
    return (
      <div data-testid="xmltv-sources-tab">
        <div data-testid="xmltv-empty-state" className="text-center py-12">
          <Radio className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <div data-testid="xmltv-empty-state-message">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              No XMLTV sources configured
            </h2>
            <p className="text-gray-500 mb-6">
              Add an XMLTV/EPG source to browse channels.
            </p>
          </div>
          <button
            data-testid="add-xmltv-source-button"
            onClick={handleAdd}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add XMLTV Source
          </button>
        </div>

        <XmltvSourceDialog
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
    <div data-testid="xmltv-sources-tab" className="space-y-4 overflow-auto h-full">
      {/* Add source button */}
      <div className="flex justify-end">
        <button
          data-testid="add-xmltv-source-button"
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add XMLTV Source
        </button>
      </div>

      {sources.map((source) => (
        <SourcesErrorBoundary
          key={source.id}
          fallbackMessage={`Error loading channels for ${source.name}`}
        >
          <XmltvSourceAccordion
            source={source}
            onEdit={() => handleEdit(source)}
            onDelete={() => handleDelete(source)}
          />
        </SourcesErrorBoundary>
      ))}

      {/* Source Dialog */}
      <XmltvSourceDialog
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
        title="Delete XMLTV Source"
        description={`Are you sure you want to delete "${deletingSource?.name}"? This will remove all associated channels and mappings.`}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingSource) {
            deleteMutation.mutate(deletingSource.id);
          }
        }}
        testIdPrefix="xmltv-delete"
      />
    </div>
  );
}
