/**
 * Add Acestream Source Dialog Component
 * Multi-Source Stream Support: Acestream Management
 *
 * Dialog for adding a new Acestream source.
 * Accepts content ID or acestream:// URL (parses automatically).
 */
import { useState, useEffect, useRef } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';

interface AddAcestreamDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: { name: string; contentIdOrUrl: string }) => void;
  isLoading: boolean;
  error?: string;
  onResetError?: () => void;
}

export function AddAcestreamDialog({
  isOpen,
  onClose,
  onAdd,
  isLoading,
  error,
  onResetError,
}: AddAcestreamDialogProps) {
  const [name, setName] = useState('');
  const [contentIdInput, setContentIdInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const prevIsOpenRef = useRef(false);

  // Reset mutation error when dialog opens (only on transition from closed to open)
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current && onResetError) {
      onResetError();
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, onResetError]);

  // Clear mutation error when input changes
  const clearMutationError = () => {
    if (error && onResetError) {
      onResetError();
    }
  };

  if (!isOpen) return null;

  /**
   * Parse content ID from input.
   * Accepts:
   * - Raw 40-character hex content ID
   * - acestream://contentid URL format
   */
  const parseContentId = (input: string): string | null => {
    const trimmed = input.trim();

    // Check for acestream:// URL format
    if (trimmed.toLowerCase().startsWith('acestream://')) {
      const contentId = trimmed.substring(12); // Remove 'acestream://'
      if (isValidContentId(contentId)) {
        return contentId;
      }
      return null;
    }

    // Check for raw content ID
    if (isValidContentId(trimmed)) {
      return trimmed;
    }

    return null;
  };

  /**
   * Validate that the content ID is a 40-character hex string.
   * Note: Backend normalizes to lowercase, so we accept both cases.
   */
  const isValidContentId = (contentId: string): boolean => {
    return /^[0-9a-fA-F]{40}$/.test(contentId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate inputs
    if (!name.trim()) {
      setValidationError('Name is required');
      return;
    }

    if (!contentIdInput.trim()) {
      setValidationError('Content ID is required');
      return;
    }

    const contentId = parseContentId(contentIdInput);
    if (!contentId) {
      setValidationError(
        'Invalid content ID. Must be a 40-character hex string or acestream:// URL.'
      );
      return;
    }

    // Normalize to lowercase before submitting
    onAdd({
      name: name.trim(),
      contentIdOrUrl: contentId.toLowerCase(),
    });
  };

  const handleClose = () => {
    // Only allow close if not loading
    if (isLoading) {
      return;
    }
    setName('');
    setContentIdInput('');
    setValidationError(null);
    onClose();
  };

  // Auto-detect if pasted content looks like a URL
  const handleContentIdChange = (value: string) => {
    setContentIdInput(value);
    clearMutationError();
    setValidationError(null); // Clear validation error on input change

    // If they paste an acestream:// URL, show helpful message
    if (value.toLowerCase().startsWith('acestream://')) {
      const parsed = parseContentId(value);
      if (parsed) {
        setValidationError(null);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        // Only close if clicking the overlay, not the dialog content
        if (e.target === e.currentTarget && !isLoading) {
          handleClose();
        }
      }}
    >
      <div
        data-testid="add-acestream-dialog"
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add Acestream Source</h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Error display */}
          {(validationError || error) && (
            <div
              data-testid="acestream-content-id-error"
              className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2"
            >
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{validationError || error}</p>
            </div>
          )}

          {/* Name field */}
          <div>
            <label htmlFor="acestream-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="acestream-name"
              data-testid="acestream-name-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearMutationError();
                setValidationError(null); // Clear validation error on input change
              }}
              placeholder="Sports Channel HD"
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              autoFocus
            />
          </div>

          {/* Content ID field */}
          <div>
            <label
              htmlFor="acestream-content-id"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Content ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="acestream-content-id"
              data-testid="acestream-content-id-input"
              value={contentIdInput}
              onChange={(e) => handleContentIdChange(e.target.value)}
              placeholder="acestream://1234567890abcdef... or raw content ID"
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              40-character hex ID or acestream:// URL (case-insensitive)
            </p>
          </div>

          {/* Info box */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> Acestream requires Acestream Engine to be installed
              and running on your system. Playback is only supported on Windows and Linux.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="add-acestream-submit"
              disabled={isLoading}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Source'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
