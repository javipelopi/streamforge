import { useState, useEffect, useCallback } from 'react';
import { Cross2Icon } from '@radix-ui/react-icons';
import type { XmltvSource, XmltvFormat, NewXmltvSource } from '../../lib/tauri';
import { detectXmltvFormat } from '../../lib/tauri';

interface EpgSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: XmltvSource; // If provided, edit mode; otherwise, add mode
  onSubmit: (data: NewXmltvSource) => Promise<void>;
  isLoading?: boolean;
}

/**
 * EpgSourceDialog component for adding or editing XMLTV EPG sources
 * Supports both add and edit modes using the same component
 */
export function EpgSourceDialog({
  open,
  onOpenChange,
  source,
  onSubmit,
  isLoading = false,
}: EpgSourceDialogProps) {
  const isEdit = !!source;

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<XmltvFormat>('auto');
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens or source changes
  useEffect(() => {
    if (open) {
      if (source) {
        setName(source.name);
        setUrl(source.url);
        setFormat(source.format);
      } else {
        setName('');
        setUrl('');
        setFormat('auto');
      }
      setError(null);
    }
  }, [source, open]);

  // Auto-detect format when URL changes (debounced effect)
  const handleUrlChange = useCallback((newUrl: string) => {
    setUrl(newUrl);
    // Auto-detect format from URL
    if (newUrl) {
      const detectedFormat = detectXmltvFormat(newUrl);
      if (detectedFormat !== 'auto') {
        setFormat(detectedFormat);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!url.trim()) {
      setError('URL is required');
      return;
    }

    // URL validation
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setError('URL must use http or https');
        return;
      }
    } catch {
      setError('Invalid URL format');
      return;
    }

    try {
      await onSubmit({ name: name.trim(), url: url.trim(), format });
      onOpenChange(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'Failed to save EPG source';
      setError(errorMessage);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={handleCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        data-testid="epg-source-dialog"
        className="relative z-50 w-full max-w-md bg-white rounded-lg shadow-xl p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 id="dialog-title" className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit EPG Source' : 'Add EPG Source'}
          </h2>
          <button
            data-testid="epg-source-cancel"
            onClick={handleCancel}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <Cross2Icon className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field */}
          <div>
            <label htmlFor="epg-source-name" className="block text-sm font-medium text-gray-700 mb-1">
              Source Name
            </label>
            <input
              id="epg-source-name"
              data-testid="epg-source-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My EPG Source"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
          </div>

          {/* URL Field */}
          <div>
            <label htmlFor="epg-source-url" className="block text-sm font-medium text-gray-700 mb-1">
              URL
            </label>
            <input
              id="epg-source-url"
              data-testid="epg-source-url"
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://example.com/epg.xml"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
          </div>

          {/* Format Field */}
          <div>
            <label htmlFor="epg-source-format" className="block text-sm font-medium text-gray-700 mb-1">
              Format
            </label>
            <select
              id="epg-source-format"
              data-testid="epg-source-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as XmltvFormat)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              disabled={isLoading}
            >
              <option value="auto">Auto-detect</option>
              <option value="xml">XML (.xml)</option>
              <option value="xml_gz">Gzipped XML (.xml.gz)</option>
            </select>
          </div>

          {/* Error Message */}
          {error && (
            <div data-testid="epg-source-error" className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="epg-source-submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Source'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
