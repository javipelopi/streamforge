/**
 * XMLTV Source Dialog Component
 * Sources-Centric UX Unification: Phase 2.2
 *
 * Dialog for adding or editing XMLTV EPG sources.
 * Refactored from EpgSourceDialog using the base Dialog component.
 * Features:
 * - Add/Edit modes
 * - Auto-detect format from URL
 * - URL validation
 * - Configurable refresh interval (consistent with M3U sources)
 */
import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogCancelButton, DialogSubmitButton } from '../common/Dialog';
import type { XmltvSource, XmltvFormat, NewXmltvSource } from '../../lib/tauri';
import { detectXmltvFormat } from '../../lib/tauri';

export interface XmltvSourceDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state should change */
  onOpenChange: (open: boolean) => void;
  /** Source to edit (undefined for add mode) */
  source?: XmltvSource;
  /** Callback when form is submitted */
  onSubmit: (data: NewXmltvSource) => Promise<void>;
  /** Whether submitting */
  isLoading?: boolean;
}

export function XmltvSourceDialog({
  open,
  onOpenChange,
  source,
  onSubmit,
  isLoading = false,
}: XmltvSourceDialogProps) {
  const isEditMode = !!source;

  // Form state
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<XmltvFormat>('auto');
  const [refreshIntervalHours, setRefreshIntervalHours] = useState(24);

  // Validation state
  const [validationError, setValidationError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Reset form when dialog opens or source changes
  useEffect(() => {
    if (open) {
      if (source) {
        setName(source.name);
        setUrl(source.url);
        setFormat(source.format);
        setRefreshIntervalHours(source.refreshIntervalHours || 24);
      } else {
        setName('');
        setUrl('');
        setFormat('auto');
        setRefreshIntervalHours(24);
      }
      setValidationError(null);
      setRefreshError(null);
    }
  }, [open, source]);

  // Auto-detect format when URL changes
  const handleUrlChange = useCallback((newUrl: string) => {
    setUrl(newUrl);
    setValidationError(null);

    // Auto-detect format from URL
    if (newUrl) {
      const detectedFormat = detectXmltvFormat(newUrl);
      if (detectedFormat !== 'auto') {
        setFormat(detectedFormat);
      }
    }
  }, []);

  const validateForm = (): boolean => {
    // Validate name
    if (!name.trim()) {
      setValidationError('Source name is required');
      return false;
    }

    // Validate URL
    if (!url.trim()) {
      setValidationError('URL is required');
      return false;
    }

    // URL format validation
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setValidationError('URL must use http or https');
        return false;
      }
    } catch {
      setValidationError('Invalid URL format');
      return false;
    }

    // Validate refresh interval
    if (refreshIntervalHours < 1 || refreshIntervalHours > 168) {
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

    try {
      await onSubmit({
        name: name.trim(),
        url: url.trim(),
        format,
        refreshIntervalHours,
      });
      onOpenChange(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'Failed to save XMLTV source';
      setValidationError(errorMessage);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title={isEditMode ? 'Edit XMLTV Source' : 'Add XMLTV Source'}
      subtitle="Configure your EPG/XMLTV data source"
      isLoading={isLoading}
      error={validationError || undefined}
      testId="xmltv-source-dialog"
      footer={
        <>
          <DialogCancelButton onClick={handleClose} disabled={isLoading} />
          <DialogSubmitButton
            type="submit"
            form="xmltv-source-form"
            isLoading={isLoading}
            loadingText="Saving..."
            testId="xmltv-source-submit"
          >
            {isEditMode ? 'Save Changes' : 'Add Source'}
          </DialogSubmitButton>
        </>
      }
    >
      <form id="xmltv-source-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Name Field */}
        <div>
          <label htmlFor="xmltv-name" className="block text-sm font-medium text-gray-700 mb-1">
            Source Name
          </label>
          <input
            id="xmltv-name"
            type="text"
            data-testid="xmltv-name-input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setValidationError(null);
            }}
            placeholder="My EPG Source"
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            autoFocus
          />
        </div>

        {/* URL Field */}
        <div>
          <label htmlFor="xmltv-url" className="block text-sm font-medium text-gray-700 mb-1">
            URL
          </label>
          <input
            id="xmltv-url"
            type="url"
            data-testid="xmltv-url-input"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://example.com/epg.xml"
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <p className="mt-1 text-xs text-gray-500">
            Supports .xml and .xml.gz (gzipped) formats
          </p>
        </div>

        {/* Format Field */}
        <div>
          <label htmlFor="xmltv-format" className="block text-sm font-medium text-gray-700 mb-1">
            Format
          </label>
          <select
            id="xmltv-format"
            data-testid="xmltv-format-select"
            value={format}
            onChange={(e) => setFormat(e.target.value as XmltvFormat)}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 bg-white"
          >
            <option value="auto">Auto-detect</option>
            <option value="xml">XML (.xml)</option>
            <option value="xml_gz">Gzipped XML (.xml.gz)</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Format is auto-detected from URL when possible
          </p>
        </div>

        {/* Refresh Interval Field */}
        <div>
          <label htmlFor="xmltv-refresh" className="block text-sm font-medium text-gray-700 mb-1">
            Refresh Interval (hours)
          </label>
          <input
            type="number"
            id="xmltv-refresh"
            data-testid="xmltv-refresh-input"
            value={refreshIntervalHours}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 0;
              if (value < 1 || value > 168) {
                setRefreshError('Must be between 1 and 168 hours');
              } else {
                setRefreshError(null);
              }
              setRefreshIntervalHours(value);
              setValidationError(null);
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
              How often to re-fetch the EPG data (1-168 hours)
            </p>
          )}
        </div>
      </form>
    </Dialog>
  );
}
