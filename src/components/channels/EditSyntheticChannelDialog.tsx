import { useState, useEffect, useCallback, useRef } from 'react';
import { type XmltvChannelWithMappings } from '../../lib/tauri';

// Validate URL is safe (no javascript: protocol, etc.)
function isValidIconUrl(url: string): boolean {
  if (!url.trim()) return true; // Empty is OK
  try {
    const parsed = new URL(url);
    // Only allow http/https protocols
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false; // Invalid URL format
  }
}

/**
 * EditSyntheticChannelDialog - Dialog for editing a synthetic XMLTV channel
 *
 * Story 3-8: AC #5 - Synthetic Channel Badge and Edit
 *
 * Shows a modal dialog where users can:
 * - Edit the display name
 * - Edit the icon URL
 * - Confirm or cancel the edit
 */

interface EditSyntheticChannelDialogProps {
  channel: XmltvChannelWithMappings;
  isOpen: boolean;
  onSave: (displayName: string, iconUrl: string | null) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function EditSyntheticChannelDialog({
  channel,
  isOpen,
  onSave,
  onCancel,
  isLoading = false,
}: EditSyntheticChannelDialogProps) {
  // Form state - pre-fill from channel
  const [displayName, setDisplayName] = useState(channel.displayName);
  const [iconUrl, setIconUrl] = useState(channel.icon || '');
  const [urlError, setUrlError] = useState<string | null>(null);

  // Ref for focus management
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Reset form when channel changes
  useEffect(() => {
    setDisplayName(channel.displayName);
    setIconUrl(channel.icon || '');
    setUrlError(null);
  }, [channel]);

  // Focus trap and initial focus
  useEffect(() => {
    if (!isOpen) return;

    // Focus first input when dialog opens
    firstInputRef.current?.focus();

    // Trap focus within dialog
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableElements = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Handle form submission with URL validation
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // Validate display name
      if (!displayName.trim()) {
        return;
      }

      // Validate icon URL
      const trimmedUrl = iconUrl.trim();
      if (trimmedUrl && !isValidIconUrl(trimmedUrl)) {
        setUrlError('Invalid URL format. Only http:// and https:// URLs are allowed.');
        return;
      }

      setUrlError(null);
      onSave(displayName.trim(), trimmedUrl || null);
    },
    [displayName, iconUrl, onSave]
  );

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onCancel();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-synthetic-dialog-title"
    >
      <div
        ref={dialogRef}
        data-testid="edit-synthetic-dialog"
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2
            id="edit-synthetic-dialog-title"
            className="text-lg font-semibold text-gray-900"
          >
            Edit Synthetic Channel
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Update display name and icon for this synthetic channel
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* Channel ID info */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm">
                <span className="text-gray-500">Channel ID:</span>{' '}
                <span className="font-mono text-gray-700">{channel.channelId}</span>
              </div>
            </div>

            {/* Display name input */}
            <div>
              <label
                htmlFor="edit-display-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Display Name
              </label>
              <input
                ref={firstInputRef}
                id="edit-display-name"
                data-testid="display-name-input"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter display name"
                maxLength={200}
                required
                disabled={isLoading}
                aria-required="true"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                This name will appear in Plex and EPG listings
              </p>
            </div>

            {/* Icon URL input */}
            <div>
              <label
                htmlFor="edit-icon-url"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Icon URL (optional)
              </label>
              <input
                id="edit-icon-url"
                data-testid="icon-url-input"
                type="url"
                value={iconUrl}
                onChange={(e) => {
                  setIconUrl(e.target.value);
                  setUrlError(null); // Clear error on change
                }}
                placeholder="https://example.com/icon.png"
                maxLength={500}
                disabled={isLoading}
                aria-invalid={urlError ? 'true' : 'false'}
                aria-describedby={urlError ? 'icon-url-error' : undefined}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 ${
                  urlError ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                }`}
              />
              {urlError && (
                <p id="icon-url-error" className="mt-1 text-xs text-red-600" role="alert">
                  {urlError}
                </p>
              )}
              {/* Icon preview */}
              {iconUrl.trim() && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Preview:</span>
                  <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                    <img
                      src={iconUrl.trim()}
                      alt={`${displayName} channel icon preview`}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Info about placeholder EPG */}
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="text-sm text-blue-700">
                  <p>
                    Changing the name will also update placeholder EPG titles.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              data-testid="cancel-edit-button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="save-edit-button"
              disabled={isLoading || !displayName.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
