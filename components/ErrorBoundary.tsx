"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { track } from "@/lib/posthog";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

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
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-2xl border border-zinc-200 bg-white p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-zinc-900">Something went wrong</h3>
            <p className="mt-1 text-sm text-zinc-500">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded-xl bg-brand-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
