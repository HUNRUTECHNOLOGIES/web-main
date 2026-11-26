import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'An unexpected application error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0D12] text-[#E6EDF3] flex items-center justify-center p-6">
          <div className="max-w-md w-full p-6 rounded-lg border border-red-500/30 bg-[#0F141C] space-y-4">
            <h1 className="font-display text-xl font-bold text-white">
              Application State Recovery
            </h1>
            <p className="text-sm text-[#94A3B8]">
              A view encountered an unexpected error. Reload to restore the workspace.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold text-[#0A0D12] bg-[#00FF66] rounded-md cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
