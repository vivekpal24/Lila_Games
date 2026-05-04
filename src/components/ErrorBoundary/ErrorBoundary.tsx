import React, { Component, type ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return (
          <div className="flex items-center justify-center h-full w-full bg-gray-900/50 p-4 border border-red-900/30 rounded">
            <div className="flex flex-col items-center text-center gap-2">
              <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
              <div className="text-gray-300 font-medium">{this.props.fallback}</div>
              <button 
                onClick={this.handleReset}
                className="mt-2 text-xs flex items-center gap-1 text-gray-400 hover:text-white"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            </div>
          </div>
        );
      }

      // Default Global Fallback
      return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-gray-900 text-white p-6">
          <AlertTriangle className="w-16 h-16 text-red-500 mb-6" />
          <h1 className="text-2xl font-bold mb-2">Visualization failed to load</h1>
          <p className="text-gray-400 mb-8 max-w-md text-center">
            An unexpected error occurred in the rendering engine.
          </p>
          
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-colors shadow-lg"
          >
            <RefreshCw className="w-5 h-5" />
            Reload page
          </button>

          {import.meta.env.DEV && this.state.error && (
            <details className="mt-12 bg-black/50 p-4 rounded border border-red-900 max-w-3xl w-full text-left overflow-hidden">
              <summary className="text-red-400 cursor-pointer text-sm font-mono focus:outline-none">
                {this.state.error.toString()}
              </summary>
              <pre className="mt-4 text-xs text-red-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-64">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
