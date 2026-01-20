/**
 * Toast Component
 * Story 3-9: Undo toast for disabled channels
 *
 * A simple toast notification component for temporary messages with actions.
 */
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ToastContextValue {
  show: (message: ReactNode, duration?: number) => void;
  hide: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
  duration?: number;
}

export function ToastProvider({ children, duration = 5000 }: ToastProviderProps) {
  const [toast, setToast] = useState<{ message: ReactNode; visible: boolean }>({
    message: null,
    visible: false,
  });
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const show = useCallback(
    (message: ReactNode, customDuration?: number) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setToast({ message, visible: true });
      const id = setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false }));
      }, customDuration ?? duration);
      setTimeoutId(id);
    },
    [duration, timeoutId]
  );

  const hide = useCallback(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    setToast((prev) => ({ ...prev, visible: false }));
  }, [timeoutId]);

  return (
    <ToastContext.Provider value={{ show, hide }}>
      {children}
      {toast.visible && (
        <div className="fixed bottom-4 right-4 z-50">{toast.message}</div>
      )}
    </ToastContext.Provider>
  );
}

interface ToastProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function Toast({ open, onOpenChange: _onOpenChange, children }: ToastProps) {
  if (!open) return null;

  return (
    <div
      data-testid="undo-toast"
      className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-4 animate-slide-up"
      role="alert"
      aria-live="polite"
    >
      {children}
    </div>
  );
}

interface ToastActionProps {
  children: ReactNode;
  altText: string;
  onClick: () => void;
}

export function ToastAction({ children, altText, onClick }: ToastActionProps) {
  return (
    <button
      data-testid="undo-button"
      onClick={onClick}
      className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium transition-colors"
      aria-label={altText}
    >
      {children}
    </button>
  );
}

export function ToastViewport() {
  // Placeholder for Radix compatibility - viewport is handled inline
  return null;
}
