import { memo } from 'react';

interface BulkActionToolbarProps {
  selectedCount: number;
  onEnableSelected: () => void;
  onDisableSelected: () => void;
  onClearSelection: () => void;
  isLoading?: boolean;
}

/**
 * BulkActionToolbar component for bulk channel operations
 *
 * Story 3-7: Bulk Channel Operations
 * AC #1: Bulk action toolbar appears when multiple channels are selected
 * AC #2: Enable Selected button enables all selected channels with matched streams
 * AC #3: Disable Selected button disables all selected channels
 */
export const BulkActionToolbar = memo(function BulkActionToolbar({
  selectedCount,
  onEnableSelected,
  onDisableSelected,
  onClearSelection,
  isLoading = false,
}: BulkActionToolbarProps) {
  // Don't render if nothing is selected
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      data-testid="bulk-action-toolbar"
      className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4 flex items-center justify-between z-20"
      role="toolbar"
      aria-label="Bulk channel actions"
    >
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">
          {selectedCount} channel{selectedCount !== 1 ? 's' : ''} selected
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onEnableSelected}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Processing...' : 'Enable Selected'}
        </button>

        <button
          type="button"
          onClick={onDisableSelected}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Processing...' : 'Disable Selected'}
        </button>

        <button
          type="button"
          onClick={onClearSelection}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear Selection
        </button>
      </div>
    </div>
  );
});
