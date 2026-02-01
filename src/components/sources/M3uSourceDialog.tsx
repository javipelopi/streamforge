/**
 * M3U Source Dialog Component
 * Sources-Centric UX Unification: Phase 2.3
 *
 * Dialog for adding or editing M3U playlist sources.
 * Refactored from AddM3uSourceDialog with edit mode support.
 * Features:
 * - Add/Edit modes
 * - Three source types: Playlist URL, Local File, Single Stream
 * - Auto-fill name from filename
 * - URL validation
 * - Refresh interval for playlist URLs
 */
import { useState, useEffect } from 'react';
import { Link, FileText, Radio, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { Dialog, DialogCancelButton, DialogSubmitButton } from '../common/Dialog';
import type { M3uSource } from '../../lib/tauri';

export type M3uSourceType = 'playlist' | 'file' | 'stream';

export interface M3uSourceFormData {
  name: string;
  url: string;
  refreshIntervalHours?: number;
  isLocalFile?: boolean;
  isSingleStream?: boolean;
}

export interface M3uSourceDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state should change */
  onOpenChange: (open: boolean) => void;
  /** Source to edit (undefined for add mode) */
  source?: M3uSource;
  /** Callback when form is submitted */
  onSubmit: (data: M3uSourceFormData) => Promise<void>;
  /** Whether submitting */
  isLoading?: boolean;
  /** External error */
  error?: string;
  /** Clear external error */
  onClearError?: () => void;
}

export function M3uSourceDialog({
  open: isOpen,
  onOpenChange,
  source,
  onSubmit,
  isLoading = false,
  error: externalError,
  onClearError,
}: M3uSourceDialogProps) {
  const isEditMode = !!source;

  // Form state
  const [name, setName] = useState('');
  const [sourceType, setSourceType] = useState<M3uSourceType>('playlist');
  const [url, setUrl] = useState('');
  const [refreshIntervalHours, setRefreshIntervalHours] = useState(24);

  // Validation state
  const [validationError, setValidationError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Reset form when dialog opens or source changes
  useEffect(() => {
    if (isOpen) {
      if (source) {
        setName(source.name);
        setUrl(source.url);
        setRefreshIntervalHours(source.refreshIntervalHours || 24);
        // Note: M3uSource doesn't store isLocalFile/isSingleStream, so we default to playlist for edits
        setSourceType('playlist');
      } else {
        setName('');
        setUrl('');
        setRefreshIntervalHours(24);
        setSourceType('playlist');
      }
      setValidationError(null);
      setUrlError(null);
      setRefreshError(null);
    }
  }, [isOpen, source]);

  // Reset form when source type changes (only in add mode)
  useEffect(() => {
    if (!isEditMode) {
      setUrl('');
      setUrlError(null);
      setValidationError(null);
    }
  }, [sourceType, isEditMode]);

  // Clear errors on input change
  const clearErrors = () => {
    setValidationError(null);
    if (onClearError) onClearError();
  };

  const validateUrl = (urlValue: string): boolean => {
    try {
      const parsed = new URL(urlValue);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const sanitizeName = (input: string): string => {
    // Remove HTML tags and entities to prevent XSS
    return input
      .replace(/<[^>]*>/g, '')
      .replace(/&[^;]+;/g, '')
      .trim();
  };

  const handleBrowseFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'M3U Playlists',
            extensions: ['m3u', 'm3u8'],
          },
        ],
      });

      if (selected && typeof selected === 'string') {
        setUrl(selected);
        clearErrors();

        // Auto-fill name from filename if empty
        if (!name.trim()) {
          const fileName = selected.split(/[/\\]/).pop() || '';
          const nameWithoutExt = fileName.replace(/\.(m3u8?|M3U8?)$/, '');
          if (nameWithoutExt) {
            setName(nameWithoutExt);
          }
        }
      }
    } catch (err) {
      console.error('Failed to open file dialog:', err);
      setValidationError('Failed to open file picker');
    }
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    clearErrors();

    // Clear error when empty
    if (!value.trim()) {
      setUrlError(null);
      return;
    }

    // Validate URL format as user types
    if (!validateUrl(value)) {
      setUrlError('Please enter a valid HTTP or HTTPS URL');
    } else {
      setUrlError(null);
    }
  };

  const validateForm = (): boolean => {
    // Validate name
    if (!name.trim()) {
      setValidationError('Name is required');
      return false;
    }

    if (name.length > 255) {
      setValidationError('Name must be 255 characters or less');
      return false;
    }

    const sanitizedName = sanitizeName(name);
    if (!sanitizedName) {
      setValidationError('Name contains invalid characters');
      return false;
    }

    // Validate based on source type
    if (sourceType === 'playlist' || sourceType === 'stream') {
      if (!url.trim()) {
        setValidationError(
          sourceType === 'stream' ? 'Stream URL is required' : 'Playlist URL is required'
        );
        return false;
      }

      if (!validateUrl(url)) {
        setValidationError('Please enter a valid HTTP or HTTPS URL');
        return false;
      }
    } else if (sourceType === 'file') {
      if (!url.trim()) {
        setValidationError('Please select a file');
        return false;
      }
    }

    // Validate refresh interval (only for playlist URLs)
    if (sourceType === 'playlist' && (refreshIntervalHours < 1 || refreshIntervalHours > 168)) {
      setValidationError('Refresh interval must be between 1 and 168 hours');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!validateForm()) {
      return;
    }

    const sanitizedName = sanitizeName(name);

    try {
      await onSubmit({
        name: sanitizedName,
        url: url.trim(),
        refreshIntervalHours: sourceType === 'playlist' ? refreshIntervalHours : undefined,
        isLocalFile: sourceType === 'file',
        isSingleStream: sourceType === 'stream',
      });
      onOpenChange(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'Failed to save M3U source';
      setValidationError(errorMessage);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false);
    }
  };

  const getDialogTitle = (): string => {
    if (isEditMode) {
      return 'Edit M3U Source';
    }
    switch (sourceType) {
      case 'stream':
        return 'Add Single Stream';
      case 'file':
        return 'Add Local Playlist';
      default:
        return 'Add M3U Playlist';
    }
  };

  const displayError = validationError || externalError;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={handleClose}
      title={getDialogTitle()}
      isLoading={isLoading}
      error={displayError || undefined}
      testId="m3u-source-dialog"
      footer={
        <>
          <DialogCancelButton onClick={handleClose} disabled={isLoading} />
          <DialogSubmitButton
            type="submit"
            form="m3u-source-form"
            isLoading={isLoading}
            loadingText={isEditMode ? 'Saving...' : 'Adding...'}
            testId="m3u-source-submit"
          >
            {isEditMode ? 'Save Changes' : sourceType === 'stream' ? 'Add Stream' : 'Add Playlist'}
          </DialogSubmitButton>
        </>
      }
    >
      <form id="m3u-source-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Source Type Toggle (only in add mode) */}
        {!isEditMode && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Source Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="m3u-source-type-playlist"
                onClick={() => setSourceType('playlist')}
                disabled={isLoading}
                className={`flex-1 px-3 py-2 rounded-lg border-2 transition-colors flex items-center justify-center gap-1.5 text-sm ${
                  sourceType === 'playlist'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                } disabled:opacity-50`}
              >
                <Link className="w-4 h-4" />
                Playlist
              </button>
              <button
                type="button"
                data-testid="m3u-source-type-file"
                onClick={() => setSourceType('file')}
                disabled={isLoading}
                className={`flex-1 px-3 py-2 rounded-lg border-2 transition-colors flex items-center justify-center gap-1.5 text-sm ${
                  sourceType === 'file'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                } disabled:opacity-50`}
              >
                <FileText className="w-4 h-4" />
                Local File
              </button>
              <button
                type="button"
                data-testid="m3u-source-type-stream"
                onClick={() => setSourceType('stream')}
                disabled={isLoading}
                className={`flex-1 px-3 py-2 rounded-lg border-2 transition-colors flex items-center justify-center gap-1.5 text-sm ${
                  sourceType === 'stream'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                } disabled:opacity-50`}
              >
                <Radio className="w-4 h-4" />
                Stream
              </button>
            </div>
          </div>
        )}

        {/* Name field */}
        <div>
          <label htmlFor="m3u-name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            type="text"
            id="m3u-name"
            data-testid="m3u-name-input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearErrors();
            }}
            placeholder={sourceType === 'stream' ? 'My Stream' : 'My M3U Playlist'}
            maxLength={255}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            autoFocus
          />
        </div>

        {/* URL field (shown for playlist and stream) */}
        {(sourceType === 'playlist' || sourceType === 'stream') && (
          <div>
            <label htmlFor="m3u-url" className="block text-sm font-medium text-gray-700 mb-1">
              {sourceType === 'stream' ? 'Stream URL' : 'Playlist URL'}
            </label>
            <input
              type="url"
              id="m3u-url"
              data-testid="m3u-url-input"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={
                sourceType === 'stream'
                  ? 'https://example.com/live/stream.m3u8'
                  : 'https://example.com/playlist.m3u'
              }
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 disabled:bg-gray-100 ${
                urlError
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {urlError && <p className="mt-1 text-xs text-red-600">{urlError}</p>}
            {!urlError && (
              <p className="mt-1 text-xs text-gray-500">
                {sourceType === 'stream'
                  ? 'Direct stream URL (.m3u8, .ts, or any video stream)'
                  : 'Supports .m3u and .m3u8 playlists'}
              </p>
            )}
          </div>
        )}

        {/* File picker (shown for file type) */}
        {sourceType === 'file' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Playlist File</label>
            <div className="flex gap-2">
              <input
                type="text"
                data-testid="m3u-file-path-input"
                value={url}
                readOnly
                placeholder="No file selected"
                disabled={isLoading}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 disabled:bg-gray-100"
              />
              <button
                type="button"
                data-testid="m3u-browse-file-button"
                onClick={handleBrowseFile}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                Browse
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Select a .m3u or .m3u8 file from your computer
            </p>
          </div>
        )}

        {/* Refresh interval field (only for playlist URLs) */}
        {sourceType === 'playlist' && (
          <div>
            <label htmlFor="m3u-refresh" className="block text-sm font-medium text-gray-700 mb-1">
              Refresh Interval (hours)
            </label>
            <input
              type="number"
              id="m3u-refresh"
              data-testid="m3u-refresh-input"
              value={refreshIntervalHours}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0;
                if (value < 1 || value > 168) {
                  setRefreshError('Must be between 1 and 168 hours');
                } else {
                  setRefreshError(null);
                }
                setRefreshIntervalHours(value);
                clearErrors();
              }}
              min={1}
              max={168}
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 disabled:bg-gray-100 ${
                refreshError
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {refreshError && <p className="mt-1 text-xs text-red-600">{refreshError}</p>}
            {!refreshError && (
              <p className="mt-1 text-xs text-gray-500">
                How often to re-fetch the playlist (1-168 hours)
              </p>
            )}
          </div>
        )}

        {/* Info box for local files */}
        {sourceType === 'file' && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> Local files are read once when added. To update the playlist,
              delete and re-add the source, or use a URL for automatic refreshes.
            </p>
          </div>
        )}

        {/* Info box for single streams */}
        {sourceType === 'stream' && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Tip:</strong> Use this for one-off stream URLs you find online. The stream
              will appear as a single channel in this source.
            </p>
          </div>
        )}
      </form>
    </Dialog>
  );
}
