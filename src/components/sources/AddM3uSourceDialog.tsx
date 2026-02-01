/**
 * Add M3U Source Dialog Component
 * Multi-Source Stream Support: M3U Playlist Management
 *
 * Dialog for adding a new M3U playlist source.
 * Supports:
 * - Remote playlist URLs (with auto-refresh)
 * - Local M3U/M3U8 files
 * - Single stream URLs (one-off streams found online)
 */
import { useState, useEffect, useRef } from 'react';
import { X, Loader2, AlertCircle, Link, FileText, FolderOpen, Radio } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';

interface AddM3uSourceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: {
    name: string;
    url: string;
    refreshIntervalHours?: number;
    isLocalFile?: boolean;
    isSingleStream?: boolean;
  }) => void;
  isLoading: boolean;
  error?: string;
  onResetError?: () => void;
}

type SourceType = 'playlist' | 'file' | 'stream';

export function AddM3uSourceDialog({
  isOpen,
  onClose,
  onAdd,
  isLoading,
  error,
  onResetError,
}: AddM3uSourceDialogProps) {
  const [name, setName] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('playlist');
  const [url, setUrl] = useState('');
  const [filePath, setFilePath] = useState('');
  const [refreshIntervalHours, setRefreshIntervalHours] = useState(24);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const prevIsOpenRef = useRef(false);

  // Reset mutation error when dialog opens (only on transition from closed to open)
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current && onResetError) {
      onResetError();
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, onResetError]);

  // Clear mutation error when input changes
  const handleInputChange = () => {
    if (error && onResetError) {
      onResetError();
    }
  };

  // Reset form when source type changes
  useEffect(() => {
    setUrl('');
    setFilePath('');
    setUrlError(null);
    setValidationError(null);
  }, [sourceType]);

  if (!isOpen) return null;

  const validateUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const sanitizeName = (input: string): string => {
    // Remove HTML tags and entities to prevent XSS
    return input
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&[^;]+;/g, '') // Remove HTML entities
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
        setFilePath(selected);
        handleInputChange();
        setValidationError(null);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate name
    if (!name.trim()) {
      setValidationError('Name is required');
      return;
    }

    // Security: Enforce maximum length to prevent buffer overflow or DoS
    if (name.length > 255) {
      setValidationError('Name must be 255 characters or less');
      return;
    }

    // Validate based on source type
    if (sourceType === 'playlist' || sourceType === 'stream') {
      if (!url.trim()) {
        setValidationError(sourceType === 'stream' ? 'Stream URL is required' : 'Playlist URL is required');
        return;
      }

      if (!validateUrl(url)) {
        setValidationError('Please enter a valid HTTP or HTTPS URL');
        return;
      }
    } else if (sourceType === 'file') {
      if (!filePath.trim()) {
        setValidationError('Please select a file');
        return;
      }
    }

    // Validate refresh interval (only for playlist URLs)
    if (sourceType === 'playlist' && (refreshIntervalHours < 1 || refreshIntervalHours > 168)) {
      setValidationError('Refresh interval must be between 1 and 168 hours');
      return;
    }

    // Security: Sanitize name to prevent XSS
    const sanitizedName = sanitizeName(name);
    if (!sanitizedName) {
      setValidationError('Name contains invalid characters');
      return;
    }

    onAdd({
      name: sanitizedName,
      url: sourceType === 'file' ? filePath : url.trim(),
      refreshIntervalHours: sourceType === 'playlist' ? refreshIntervalHours : undefined,
      isLocalFile: sourceType === 'file',
      isSingleStream: sourceType === 'stream',
    });
  };

  const handleClose = () => {
    if (!isLoading) {
      setName('');
      setSourceType('playlist');
      setUrl('');
      setFilePath('');
      setRefreshIntervalHours(24);
      setValidationError(null);
      setUrlError(null);
      setRefreshError(null);
      onClose();
    }
  };

  // Validate URL on change (onChange validation)
  const handleUrlChange = (value: string) => {
    setUrl(value);
    handleInputChange();

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

  // Dynamic title based on source type
  const getDialogTitle = () => {
    switch (sourceType) {
      case 'stream':
        return 'Add Single Stream';
      case 'file':
        return 'Add Local Playlist';
      default:
        return 'Add M3U Playlist';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={!isLoading ? handleClose : undefined}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
        data-testid="add-m3u-source-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 data-testid="add-m3u-dialog-title" className="text-lg font-semibold text-gray-900">{getDialogTitle()}</h2>
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
              className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2"
              data-testid="m3u-url-error"
            >
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{validationError || error}</p>
            </div>
          )}

          {/* Source Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Source Type
            </label>
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

          {/* Name field */}
          <div>
            <label htmlFor="m3u-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              id="m3u-name"
              data-testid="m3u-source-name-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                handleInputChange();
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
                data-testid="m3u-source-url-input"
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
              {urlError && (
                <p className="mt-1 text-xs text-red-600">{urlError}</p>
              )}
              {!urlError && (
                <p className="mt-1 text-xs text-gray-500">
                  {sourceType === 'stream'
                    ? 'Direct stream URL (.m3u8, .ts, or any video stream)'
                    : 'Supports .m3u and .m3u8 playlists'}
                </p>
              )}
            </div>
          )}

          {/* File picker (shown when sourceType is 'file') */}
          {sourceType === 'file' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Playlist File
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  data-testid="m3u-file-path-input"
                  value={filePath}
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
              {validationError && sourceType === 'file' && !filePath && (
                <p data-testid="m3u-file-error" className="mt-1 text-xs text-red-600">{validationError}</p>
              )}
              {!(validationError && sourceType === 'file' && !filePath) && (
                <p className="mt-1 text-xs text-gray-500">
                  Select a .m3u or .m3u8 file from your computer
                </p>
              )}
            </div>
          )}

          {/* Refresh interval field (only for playlist URLs) */}
          {sourceType === 'playlist' && (
            <div data-testid="m3u-refresh-interval-select">
              <label
                htmlFor="m3u-refresh"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Refresh Interval (hours)
              </label>
              <input
                type="number"
                id="m3u-refresh"
                data-testid="m3u-refresh-interval-input"
                value={refreshIntervalHours}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  if (value < 1 || value > 168) {
                    setRefreshError('Must be between 1 and 168 hours');
                  } else {
                    setRefreshError(null);
                  }
                  setRefreshIntervalHours(value);
                  handleInputChange();
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
              {refreshError && (
                <p className="mt-1 text-xs text-red-600">{refreshError}</p>
              )}
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
                <strong>Note:</strong> Local files are read once when added. To update the
                playlist, delete and re-add the source, or use a URL for automatic refreshes.
              </p>
            </div>
          )}

          {/* Info box for single streams */}
          {sourceType === 'stream' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Tip:</strong> Use this for one-off stream URLs you find online.
                The stream will appear as a single channel in this source.
              </p>
            </div>
          )}

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
              data-testid="add-m3u-source-submit"
              disabled={isLoading}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                sourceType === 'stream' ? 'Add Stream' : 'Add Playlist'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
