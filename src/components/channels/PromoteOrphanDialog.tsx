import { useState, useEffect, useCallback, useRef } from 'react';

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
 * PromoteOrphanDialog - Generic dialog for promoting orphan streams/channels to Plex
 *
 * A reusable dialog component that works with Xtream, M3U, and Acestream orphans.
 * Users can edit the display name and icon URL before promotion.
 */

export type SourceType = 'xtream' | 'm3u' | 'acestream';

interface PromoteOrphanDialogProps {
  sourceType: SourceType;
  name: string;
  iconUrl: string | null;
  subInfo?: string; // Category, group, or other secondary info
  isOpen: boolean;
  onConfirm: (displayName: string, iconUrl: string | null) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const SOURCE_LABELS: Record<SourceType, string> = {
  xtream: 'Xtream stream',
  m3u: 'M3U channel',
  acestream: 'Acestream source',
};

export function PromoteOrphanDialog({
  sourceType,
  name,
  iconUrl: initialIconUrl,
  subInfo,
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false,
}: PromoteOrphanDialogProps) {
  // Form state - pre-fill from props
  const [displayName, setDisplayName] = useState(name);
  const [iconUrl, setIconUrl] = useState(initialIconUrl || '');
  const [urlError, setUrlError] = useState<string | null>(null);

  // Ref for focus management
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const sourceLabel = SOURCE_LABELS[sourceType];

  // Reset form when props change
  useEffect(() => {
    setDisplayName(name);
    setIconUrl(initialIconUrl || '');
    setUrlError(null);
  }, [name, initialIconUrl]);

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
      onConfirm(displayName.trim(), trimmedUrl || null);
    },
    [displayName, iconUrl, onConfirm]
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
      aria-labelledby="promote-orphan-dialog-title"
    >
      <div
        ref={dialogRef}
        data-testid="promote-orphan-dialog"
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2
            id="promote-orphan-dialog-title"
            className="text-lg font-semibold text-gray-900"
          >
            Promote to Plex
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Create a synthetic channel from this {sourceLabel}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* Source info summary */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              {/* Icon preview */}
              <div className="flex-shrink-0 w-12 h-12 rounded bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
                {initialIconUrl ? (
                  <img
                    src={initialIconUrl}
                    alt={`${name} icon`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <svg
                    className="w-6 h-6 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {name}
                </div>
                {subInfo && (
                  <div className="text-sm text-gray-500">
                    {subInfo}
                  </div>
                )}
              </div>
            </div>

            {/* Display name input */}
            <div>
              <label
                htmlFor="display-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Display Name
              </label>
              <input
                ref={firstInputRef}
                id="display-name"
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
                htmlFor="icon-url"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Icon URL (optional)
              </label>
              <input
                id="icon-url"
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
                aria-describedby={urlError ? 'icon-url-error' : 'icon-url-description'}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 ${
                  urlError ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                }`}
              />
              {urlError ? (
                <p id="icon-url-error" className="mt-1 text-xs text-red-600" role="alert">
                  {urlError}
                </p>
              ) : (
                <p id="icon-url-description" className="mt-1 text-xs text-gray-500">
                  Channel icon URL for display in Plex
                </p>
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
                  <p className="font-medium">Placeholder EPG will be created</p>
                  <p className="mt-1 text-blue-600">
                    7 days of "{displayName.trim() || name} - Live Programming"
                    entries will be generated for this channel.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              data-testid="cancel-button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="confirm-promote-button"
              disabled={isLoading || !displayName.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                  Promoting...
                </>
              ) : (
                'Promote to Plex'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
