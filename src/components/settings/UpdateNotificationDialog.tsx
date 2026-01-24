/**
 * Update Notification Dialog
 *
 * Story 6-5: Auto-Update Mechanism with Signature Verification
 * AC #3: Notify users about available updates
 *
 * Displays when a new update is available, showing version, release notes,
 * and options to download/install or remind later.
 */
import { useState } from 'react';
import { UpdateInfo, downloadAndInstallUpdate } from '../../lib/tauri';

interface UpdateNotificationDialogProps {
  updateInfo: UpdateInfo;
  onRemindLater: () => void;
  onUpdateComplete?: () => void;
}

export function UpdateNotificationDialog({
  updateInfo,
  onRemindLater,
  onUpdateComplete,
}: UpdateNotificationDialogProps) {
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!updateInfo.available) {
    return null;
  }

  const handleDownloadAndInstall = async () => {
    try {
      setIsDownloading(true);
      setError(null);
      await downloadAndInstallUpdate();
      onUpdateComplete?.();
    } catch (err) {
      setError(`Failed to install update: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      data-testid="update-notification-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-dialog-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4">
          <h2 id="update-dialog-title" className="text-xl font-semibold">
            Update Available
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </div>
            <div>
              <p
                data-testid="update-version-display"
                className="text-lg font-medium text-gray-900"
              >
                Version {updateInfo.version}
              </p>
              {updateInfo.date && (
                <p className="text-sm text-gray-500">
                  Released: {new Date(updateInfo.date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          <p className="text-gray-600">
            A new version of StreamForge is available. Would you like to download
            and install it now?
          </p>

          {/* Release Notes Toggle */}
          {updateInfo.notes && (
            <div>
              <button
                data-testid="update-release-notes-button"
                onClick={() => setShowReleaseNotes(!showReleaseNotes)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showReleaseNotes ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                {showReleaseNotes ? 'Hide' : 'View'} Release Notes
              </button>

              {showReleaseNotes && (
                <div
                  data-testid="update-release-notes-content"
                  className="mt-2 p-3 bg-gray-50 rounded border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto"
                >
                  {updateInfo.notes}
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button
            data-testid="update-remind-later-button"
            onClick={onRemindLater}
            disabled={isDownloading}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Remind Later
          </button>
          <button
            data-testid="update-download-install-button"
            onClick={handleDownloadAndInstall}
            disabled={isDownloading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDownloading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Downloading...
              </>
            ) : (
              'Download & Install'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
