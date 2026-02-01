/**
 * Base Dialog Component
 * Sources-Centric UX Unification: Phase 1.1
 *
 * Unified modal dialog with consistent patterns:
 * - Backdrop click to dismiss (when not loading)
 * - ESC key to close
 * - Focus trap within dialog
 * - Loading state support
 * - Error display area
 */
import { useEffect, useRef, useCallback, type ReactNode } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';

export interface DialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state should change */
  onOpenChange: (open: boolean) => void;
  /** Dialog title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Whether the dialog is in a loading state (prevents closing) */
  isLoading?: boolean;
  /** Error message to display */
  error?: string;
  /** Dialog content */
  children: ReactNode;
  /** Footer content (typically action buttons) */
  footer?: ReactNode;
  /** Custom test ID */
  testId?: string;
  /** Max width class (default: max-w-md) */
  maxWidth?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  subtitle,
  isLoading = false,
  error,
  children,
  footer,
  testId,
  maxWidth = 'max-w-md',
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store previously focused element and restore on close
  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement;
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus();
      previousActiveElement.current = null;
    }
  }, [open]);

  // Focus first focusable element when dialog opens
  useEffect(() => {
    if (open && dialogRef.current) {
      const firstFocusable = dialogRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable) {
        // Delay focus to ensure dialog is rendered
        requestAnimationFrame(() => {
          firstFocusable.focus();
        });
      }
    }
  }, [open]);

  const handleClose = useCallback(() => {
    if (!isLoading) {
      onOpenChange(false);
    }
  }, [isLoading, onOpenChange]);

  // Handle ESC key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, isLoading, handleClose]);

  // Handle focus trap
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;

    const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      // Shift+Tab: move backwards
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: move forwards
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        ref={dialogRef}
        data-testid={testId}
        className={`bg-white rounded-lg shadow-xl ${maxWidth} w-full mx-4`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 id="dialog-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Dialog Cancel Button
 * Standard cancel button for dialog footers
 */
export interface DialogCancelButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children?: ReactNode;
}

export function DialogCancelButton({
  onClick,
  disabled = false,
  children = 'Cancel',
}: DialogCancelButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/**
 * Dialog Submit Button
 * Standard submit button for dialog footers
 */
export interface DialogSubmitButtonProps {
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  children?: ReactNode;
  variant?: 'primary' | 'danger';
  testId?: string;
  /** Form ID to associate with (for submit buttons outside form element) */
  form?: string;
}

export function DialogSubmitButton({
  onClick,
  type = 'submit',
  disabled = false,
  isLoading = false,
  loadingText = 'Saving...',
  children = 'Save',
  variant = 'primary',
  testId,
  form,
}: DialogSubmitButtonProps) {
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700',
    danger: 'bg-red-600 hover:bg-red-700',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      data-testid={testId}
      form={form}
      className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2 ${variantClasses[variant]}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
