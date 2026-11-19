import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FBFAF7] flex items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border border-[#E5DDD1] bg-white p-6 shadow-sm space-y-3">
            <h2 className="font-display text-lg font-bold text-[#16130F]">
              Something went wrong
            </h2>
            <p className="text-sm text-[#575049] break-words">{this.state.message}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="jalpi-dark-cta rounded-xl px-4 py-2 text-sm font-semibold text-white cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
