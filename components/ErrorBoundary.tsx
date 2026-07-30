"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { track } from "@/lib/posthog";
import { ErrorState } from "@/components/states/ErrorState";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * The last-resort state. It now renders the same `ErrorState` the dashboard
 * uses for a failed fetch, rather than a fourth hand-rolled card (zinc borders,
 * a rose plate, a raw rose hex on the stroke and a `brand-primary` button that
 * appears nowhere else). A crash and a failed request should not look like two
 * different products.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    track("error_boundary_triggered", {
      message: error.message,
      stack: error.stack?.slice(0, 500),
      componentStack: info.componentStack?.slice(0, 500),
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="mx-auto flex min-h-[300px] max-w-md items-center">
          <ErrorState
            className="w-full"
            message={this.state.error?.message || "An unexpected error occurred."}
            retryLabel="Try again"
            onRetry={() => this.setState({ hasError: false, error: null })}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
