"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface CatchupErrorBoundaryProps {
  children: ReactNode;
  context: Record<string, unknown>;
  boundaryKey?: string;
  title?: string;
  onRetry?: () => void;
  onSkip?: () => void;
}

interface CatchupErrorBoundaryState {
  failed: boolean;
}

export class CatchupErrorBoundary extends Component<
  CatchupErrorBoundaryProps,
  CatchupErrorBoundaryState
> {
  state: CatchupErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): CatchupErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[scroll-down-mlb] render boundary caught error", {
      error,
      componentStack: info.componentStack,
      context: this.props.context,
    });
  }

  componentDidUpdate(prevProps: CatchupErrorBoundaryProps): void {
    if (prevProps.boundaryKey !== this.props.boundaryKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    const title = this.props.title ?? "Could not render this play.";
    return (
      <div className="catchup-error" data-testid="catchup-render-fallback">
        <p>{title}</p>
        <div className="flex items-center justify-center gap-2">
          {this.props.onSkip && (
            <button
              type="button"
              className="catchup-error-retry"
              onClick={this.props.onSkip}
            >
              Skip to next play
            </button>
          )}
          <button
            type="button"
            className="catchup-error-retry"
            onClick={() => {
              this.setState({ failed: false });
              this.props.onRetry?.();
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
}
