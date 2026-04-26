import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex h-screen items-center justify-center p-4" style={{ background: 'linear-gradient(165deg, #0D0B1E 0%, #060618 40%, #030208 100%)' }}>
            <div className="galaxy-card p-8 max-w-md text-center space-y-4">
              <h2 className="text-xl font-bold text-[#EEEEF8]">Something went wrong</h2>
              <p className="text-[#8E89B3]">Please refresh the page to continue.</p>
              <button
                onClick={() => window.location.reload()}
                className="galaxy-btn"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
