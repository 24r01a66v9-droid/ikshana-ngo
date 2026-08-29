import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App error boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-brand-cream flex items-center justify-center px-6">
          <div className="max-w-md rounded-[2rem] border border-stone-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-2xl font-serif text-brand-maroon">The page could not load</h2>
            <p className="mt-3 text-sm text-brand-maroon/70">
              Please refresh the page or try again in a moment.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 rounded-full bg-brand-maroon px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-white"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
