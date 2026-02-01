/**
 * Delete Confirmation Dialog Component
 * Sources-Centric UX Unification: Phase 1.3
 *
 * Reusable confirmation dialog for delete operations:
 * - Focus trap within dialog
 * - ESC key to cancel
 * - Backdrop click to cancel (when not deleting)
 * - Auto-focus on Cancel button for safety
 */
import { useEffect, useRef } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

export interface DeleteConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state should change */
  onOpenChange: (open: boolean) => void;
  /** Title of the dialog */
  title: string;
  /** Description/warning message */
  description: string;
  /** Whether delete is in progress */
  isDeleting?: boolean;
  /** Callback when delete is confirmed */
  onConfirm: () => void;
  /** Optional test ID prefix */
  testIdPrefix?: string;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  isDeleting = false,
  onConfirm,
  testIdPrefix,
}: DeleteConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-focus Cancel button when dialog opens
  useEffect(() => {
    if (open && cancelButtonRef.current) {
      cancelButtonRef.current.focus();
    }
  }, [open]);

  // Handle ESC key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, isDeleting, onOpenChange]);

  // Handle keyboard navigation and trap focus within dialog
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const focusableElements = [cancelButtonRef.current, deleteButtonRef.current].filter(
      Boolean
    ) as HTMLElement[];

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      // Shift+Tab: move backwards
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: move forwards
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  const handleCancel = () => {
    if (!isDeleting) {
      onOpenChange(false);
    }
  };

  const handleConfirm = () => {
    onConfirm();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
          handleCancel();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={testIdPrefix ? `${testIdPrefix}-title` : 'delete-dialog-title'}
      onKeyDown={handleKeyDown}
    >
      <div
        data-testid={testIdPrefix ? `${testIdPrefix}-dialog` : 'delete-confirm-dialog'}
        className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
      >
        {/* Warning icon and title */}
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3
              id={testIdPrefix ? `${testIdPrefix}-title` : 'delete-dialog-title'}
              className="text-lg font-semibold text-gray-900"
            >
              {title}
            </h3>
            <p className="mt-2 text-gray-600">{description}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            ref={cancelButtonRef}
            onClick={handleCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            ref={deleteButtonRef}
            onClick={handleConfirm}
            disabled={isDeleting}
            data-testid={testIdPrefix ? `${testIdPrefix}-confirm` : 'delete-confirm-button'}
            className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
