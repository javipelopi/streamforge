/**
 * Import Preview Dialog Component
 * Story 6-2: Configuration Export/Import
 * AC #4: Preview shows counts of items to be imported
 */

import { ImportPreview } from '../../lib/tauri';

interface ImportPreviewDialogProps {
  preview: ImportPreview;
  isImporting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ImportPreviewDialog({
  preview,
  isImporting,
  onConfirm,
  onCancel,
}: ImportPreviewDialogProps) {
  // Format the export date for display
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      data-testid="import-preview-dialog"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-dialog-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 id="import-dialog-title" className="text-lg font-semibold text-gray-900">
            {preview.valid ? 'Import Configuration' : 'Invalid Configuration File'}
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {preview.valid ? (
            <>
              {/* Export metadata */}
              <div className="mb-4 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Export Date:</span>{' '}
                  {formatDate(preview.exportDate)}
                </p>
                <p>
                  <span className="font-medium">Version:</span> {preview.version}
                </p>
              </div>

              {/* Items to import */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  This will import:
                </h3>
                <ul className="space-y-1 text-sm">
                  <li
                    data-testid="import-preview-account-count"
                    className="flex items-center gap-2"
                  >
                    <svg
                      className="h-4 w-4 text-blue-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <span>
                      <strong>{preview.accountCount}</strong> account(s)
                    </span>
                  </li>
                  <li
                    data-testid="import-preview-source-count"
                    className="flex items-center gap-2"
                  >
                    <svg
                      className="h-4 w-4 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span>
                      <strong>{preview.xmltvSourceCount}</strong> XMLTV source(s)
                    </span>
                  </li>
                  {preview.settingsSummary.length > 0 && (
                    <li className="flex items-start gap-2">
                      <svg
                        className="h-4 w-4 text-purple-500 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <div>
                        <span className="font-medium">Settings:</span>
                        <ul className="ml-2 text-gray-600">
                          {preview.settingsSummary.map((setting, index) => (
                            <li key={index}>• {setting}</li>
                          ))}
                        </ul>
                      </div>
                    </li>
                  )}
                </ul>
              </div>

              {/* Warning about accounts */}
              {preview.accountCount > 0 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-amber-700 text-sm">
                  <strong>Note:</strong> Account passwords are not included in exports for
                  security reasons. You will need to re-enter passwords after import.
                </div>
              )}

              {/* Warning about data replacement */}
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                <strong>Warning:</strong> This will <strong>replace</strong> all current
                settings, accounts, and EPG sources. This action cannot be undone.
              </div>
            </>
          ) : (
            /* Invalid file error */
            <div className="p-4 bg-red-50 border border-red-200 rounded">
              <div className="flex items-center gap-2 text-red-700">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="font-medium">Cannot import this file</span>
              </div>
              <p
                data-testid="import-preview-error"
                className="mt-2 text-sm text-red-600"
              >
                {preview.errorMessage}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            data-testid="import-cancel-button"
            onClick={onCancel}
            disabled={isImporting}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          {preview.valid && (
            <button
              data-testid="import-confirm-button"
              onClick={onConfirm}
              disabled={isImporting}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isImporting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
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
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Importing...
                </>
              ) : (
                'Import and Replace'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
