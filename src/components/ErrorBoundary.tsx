// React error boundary. This must be a class component - hooks cannot catch a
// child's render, and a `try/catch` in a parent does not either: a component
// that throws while rendering propagates all the way up to the nearest boundary,
// and with no boundary React unmounts the whole tree, which the user sees as a
// blank page.
//
// Each boundary keeps its own fallback, so one failing section degrades to an
// inline note instead of taking the surrounding page with it. To clear a caught
// error, either pass a `key` (which remounts the boundary) or call the `reset`
// callback handed to a function fallback.

import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Shown instead of the children after a child throws. Pass a function to get
   * the error and a `reset` callback (e.g. to navigate away or retry).
   */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept in the console so the real cause is still diagnosable.
    console.error("[ErrorBoundary] a child component threw while rendering:", error);
    console.error("[ErrorBoundary] component stack:", info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { fallback } = this.props;
    if (typeof fallback === "function") return fallback(error, this.reset);
    if (fallback !== undefined) return fallback;

    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive">
          This section could not be displayed.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred."}
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={this.reset}>
          Try again
        </Button>
      </div>
    );
  }
}
