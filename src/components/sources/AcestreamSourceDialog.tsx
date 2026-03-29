/**
 * Acestream Source Dialog Component
 * Sources-Centric UX Unification: Phase 2.4
 *
 * Dialog for adding or editing Acestream P2P sources.
 * Refactored from AddAcestreamDialog with edit mode support.
 * Features:
 * - Add/Edit modes
 * - Content ID validation (40-char hex or acestream:// URL)
 * - Platform compatibility note
 */
import { useState, useEffect } from 'react';
import { Dialog, DialogCancelButton, DialogSubmitButton } from '../common/Dialog';
import type { AcestreamSource } from '../../lib/api';

export interface AcestreamSourceFormData {
  name: string;
  contentIdOrUrl: string;
}

export interface AcestreamSourceDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state should change */
  onOpenChange: (open: boolean) => void;
  /** Source to edit (undefined for add mode) */
  source?: AcestreamSource;
  /** Callback when form is submitted */
  onSubmit: (data: AcestreamSourceFormData) => Promise<void>;
  /** Whether submitting */
  isLoading?: boolean;
  /** External error */
  error?: string;
  /** Clear external error */
  onClearError?: () => void;
}

export function AcestreamSourceDialog({
  open: isOpen,
  onOpenChange,
  source,
  onSubmit,
  isLoading = false,
  error: externalError,
  onClearError,
}: AcestreamSourceDialogProps) {
  const isEditMode = !!source;

  // Form state
  const [name, setName] = useState('');
  const [contentIdInput, setContentIdInput] = useState('');

  // Validation state
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset form when dialog opens or source changes
  useEffect(() => {
    if (isOpen) {
      if (source) {
        setName(source.name);
        setContentIdInput(source.contentId);
      } else {
        setName('');
        setContentIdInput('');
      }
      setValidationError(null);
    }
  }, [isOpen, source]);

  // Clear errors on input change
  const clearErrors = () => {
    setValidationError(null);
    if (onClearError) onClearError();
  };

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

  const validateForm = (): boolean => {
    // Validate name
    if (!name.trim()) {
      setValidationError('Name is required');
      return false;
    }

    // Validate content ID
    if (!contentIdInput.trim()) {
      setValidationError('Content ID is required');
      return false;
    }

    const contentId = parseContentId(contentIdInput);
    if (!contentId) {
      setValidationError(
        'Invalid content ID. Must be a 40-character hex string or acestream:// URL.'
      );
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

    const contentId = parseContentId(contentIdInput);

    try {
      await onSubmit({
        name: name.trim(),
        // Normalize to lowercase before submitting
        contentIdOrUrl: contentId!.toLowerCase(),
      });
      onOpenChange(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'Failed to save Acestream source';
      setValidationError(errorMessage);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false);
    }
  };

  const handleContentIdChange = (value: string) => {
    setContentIdInput(value);
    clearErrors();
  };

  const displayError = validationError || externalError;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={handleClose}
      title={isEditMode ? 'Edit Acestream Source' : 'Add Acestream Source'}
      subtitle="Configure an Acestream P2P stream source"
      isLoading={isLoading}
      error={displayError || undefined}
      testId="acestream-source-dialog"
      footer={
        <>
          <DialogCancelButton onClick={handleClose} disabled={isLoading} />
          <DialogSubmitButton
            type="submit"
            form="acestream-source-form"
            isLoading={isLoading}
            loadingText={isEditMode ? 'Saving...' : 'Adding...'}
            testId="acestream-source-submit"
          >
            {isEditMode ? 'Save Changes' : 'Add Source'}
          </DialogSubmitButton>
        </>
      }
    >
      <form id="acestream-source-form" onSubmit={handleSubmit} className="space-y-4">
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
              clearErrors();
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
            disabled={isLoading || isEditMode} // Content ID can't be changed in edit mode
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            40-character hex ID or acestream:// URL (case-insensitive)
            {isEditMode && ' - Content ID cannot be changed after creation'}
          </p>
        </div>

        {/* Info box */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> Acestream requires Acestream Engine to be installed and running
            on your system. Playback is only supported on Windows and Linux.
          </p>
        </div>
      </form>
    </Dialog>
  );
}
