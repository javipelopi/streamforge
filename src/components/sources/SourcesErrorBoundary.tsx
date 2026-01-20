/**
 * Error Boundary for Sources Components
 * Code Review Fix: Catch rendering errors in Xtream components
 */
import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class SourcesErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Sources component error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <p className="font-medium">
              {this.props.fallbackMessage || 'Something went wrong'}
            </p>
          </div>
          <p className="text-sm text-red-600 mb-3">
            {this.state.error?.message || 'An error occurred while rendering this component'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
