/**
 * M3U Sources Tab Component
 * Multi-Source Stream Support: M3U Playlist Management
 *
 * Displays M3U playlist sources as expandable accordion sections.
 * Each source shows channels parsed from the playlist.
 */
import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { List, Plus } from 'lucide-react';
import { getM3uSources, addM3uSource } from '../../lib/tauri';
import { M3uSourceAccordion } from './M3uSourceAccordion';
import { SourcesErrorBoundary } from './SourcesErrorBoundary';
import { AddM3uSourceDialog } from './AddM3uSourceDialog';

export function M3uSourcesTab() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const queryClient = useQueryClient();

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
    mutationFn: async ({
      name,
      url,
      refreshIntervalHours,
      isLocalFile,
      isSingleStream,
    }: {
      name: string;
      url: string;
      refreshIntervalHours?: number;
      isLocalFile?: boolean;
      isSingleStream?: boolean;
    }) => {
      return addM3uSource(name, url, refreshIntervalHours, isLocalFile, isSingleStream);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['m3u-sources'] });
      setShowAddDialog(false);
    },
  });

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
        <p className="text-red-700">
          Failed to load M3U sources: {error instanceof Error ? error.message : String(error)}
        </p>
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
            onClick={() => setShowAddDialog(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add M3U Playlist
          </button>
        </div>

        <AddM3uSourceDialog
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

  // Sources list
  return (
    <div data-testid="m3u-sources-tab" className="space-y-4 overflow-auto h-full">
      {/* Add source button */}
      <div className="flex justify-end">
        <button
          data-testid="add-m3u-source-button"
          onClick={() => setShowAddDialog(true)}
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
          <M3uSourceAccordion source={source} />
        </SourcesErrorBoundary>
      ))}

      <AddM3uSourceDialog
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
