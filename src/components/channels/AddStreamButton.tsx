import { useState, useCallback, memo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Plus, Loader2 } from 'lucide-react';
import type { XtreamStreamSearchResult, XtreamStreamMatch } from '../../lib/tauri';
import { StreamSearchDropdown } from './StreamSearchDropdown';

interface AddStreamButtonProps {
  xmltvChannelId: number;
  /** XMLTV channel name for fuzzy search */
  xmltvChannelName: string;
  onAddStream: (
    xmltvChannelId: number,
    xtreamChannelId: number,
    setAsPrimary: boolean
  ) => Promise<XtreamStreamMatch[]>;
  disabled?: boolean;
}

type SelectionState = {
  state: 'closed' | 'search' | 'confirm';
  selectedStream?: XtreamStreamSearchResult;
};

/**
 * AddStreamButton component provides the "Add Stream" button and dropdown
 * for manually mapping Xtream streams to an XMLTV channel
 *
 * Story 3-3: Manual Match Override via Search Dropdown
 */
export const AddStreamButton = memo(function AddStreamButton({
  xmltvChannelId,
  xmltvChannelName,
  onAddStream,
  disabled = false,
}: AddStreamButtonProps) {
  const [selectionState, setSelectionState] = useState<SelectionState>({
    state: 'closed',
  });
  const [isAdding, setIsAdding] = useState(false);

  // Handle opening the dropdown
  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      setSelectionState({ state: 'search' });
    } else {
      setSelectionState({ state: 'closed' });
    }
  }, []);

  // Handle stream selection from search dropdown
  const handleStreamSelect = useCallback((stream: XtreamStreamSearchResult) => {
    setSelectionState({ state: 'confirm', selectedStream: stream });
  }, []);

  // Handle going back to search
  const handleBackToSearch = useCallback(() => {
    setSelectionState({ state: 'search' });
  }, []);

  // Handle adding as primary
  const handleAddAsPrimary = useCallback(async () => {
    if (!selectionState.selectedStream) return;

    setIsAdding(true);
    try {
      await onAddStream(xmltvChannelId, selectionState.selectedStream.id, true);
      setSelectionState({ state: 'closed' });
    } finally {
      setIsAdding(false);
    }
  }, [xmltvChannelId, selectionState.selectedStream, onAddStream]);

  // Handle adding as backup
  const handleAddAsBackup = useCallback(async () => {
    if (!selectionState.selectedStream) return;

    setIsAdding(true);
    try {
      await onAddStream(xmltvChannelId, selectionState.selectedStream.id, false);
      setSelectionState({ state: 'closed' });
    } finally {
      setIsAdding(false);
    }
  }, [xmltvChannelId, selectionState.selectedStream, onAddStream]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setSelectionState({ state: 'closed' });
  }, []);

  const isOpen = selectionState.state !== 'closed';

  return (
    <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled || isAdding}
          className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Add stream"
          aria-expanded={isOpen}
          data-testid="add-stream-button"
        >
          {isAdding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={5}
          className="z-50"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {selectionState.state === 'search' && (
            <StreamSearchDropdown
              xmltvChannelName={xmltvChannelName}
              xmltvChannelId={xmltvChannelId}
              onSelect={handleStreamSelect}
              onClose={handleCancel}
            />
          )}

          {selectionState.state === 'confirm' && selectionState.selectedStream && (
            <ConfirmationPanel
              stream={selectionState.selectedStream}
              isAdding={isAdding}
              onAddAsPrimary={handleAddAsPrimary}
              onAddAsBackup={handleAddAsBackup}
              onBack={handleBackToSearch}
              onCancel={handleCancel}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});

// Confirmation panel component
interface ConfirmationPanelProps {
  stream: XtreamStreamSearchResult;
  isAdding: boolean;
  onAddAsPrimary: () => void;
  onAddAsBackup: () => void;
  onBack: () => void;
  onCancel: () => void;
}

const ConfirmationPanel = memo(function ConfirmationPanel({
  stream,
  isAdding,
  onAddAsPrimary,
  onAddAsBackup,
  onBack,
  onCancel,
}: ConfirmationPanelProps) {
  return (
    <div
      className="w-80 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
      data-testid="add-stream-confirmation"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-900">Add Stream</h3>
      </div>

      {/* Stream info */}
      <div className="px-4 py-3">
        <p className="text-sm text-gray-600 mb-2">
          Add <span className="font-medium text-gray-900">"{stream.name}"</span> to this channel?
        </p>
        {stream.categoryName && (
          <p className="text-xs text-gray-500">Category: {stream.categoryName}</p>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAddAsPrimary}
            disabled={isAdding}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="add-as-primary-button"
          >
            {isAdding ? (
              <span className="flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                Adding...
              </span>
            ) : (
              'Add as Primary'
            )}
          </button>
          <button
            type="button"
            onClick={onAddAsBackup}
            disabled={isAdding}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="add-as-backup-button"
          >
            Add as Backup
          </button>
        </div>
        <div className="flex justify-between">
          <button
            type="button"
            onClick={onBack}
            disabled={isAdding}
            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
            data-testid="back-to-search-button"
          >
            &larr; Back to search
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isAdding}
            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
            data-testid="cancel-add-button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
});
