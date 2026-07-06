import React, { Suspense } from "react";

// Error Boundary Component for better debugging
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("RegularTaskForm Error:", error);
    console.error("Error Info:", errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-sm">
          <h3 className="text-red-800 font-semibold">Something went wrong</h3>
          <p className="text-red-600 text-sm mt-1">
            {this.state.error?.message ||
              "An unexpected error occurred in the form"}
          </p>
          <details className="mt-2 text-xs text-red-500">
            <summary className="cursor-pointer">
              View Error Details (For debugging)
            </summary>
            <pre className="mt-1 p-2 bg-red-100 rounded text-xs overflow-auto">
              {this.state.error && this.state.error.toString()}
              <br />
              {this.state.errorInfo.componentStack}
            </pre>
          </details>
          <button
            onClick={() =>
              this.setState({ hasError: false, error: null, errorInfo: null })
            }
            className="mt-2 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
            data-testid="button-retry-form"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-7">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    <span className="ml-2 text-gray-600">Loading form...</span>
  </div>
);

// Lazy load the main component
const RegularTaskForm = React.lazy(() =>
  import("./RegularTaskForm.jsx").then((module) => ({
    default: module.RegularTaskForm,
  })),
);

// Main wrapper component with enhanced error handling
export function RegularTaskFormWrapper({
  onSubmit,
  onClose,
  initialData = {},
}) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <RegularTaskForm
          onSubmit={onSubmit}
          onClose={onClose}
          initialData={initialData}
        />
      </Suspense>
    </ErrorBoundary>
  );
}

export default RegularTaskFormWrapper;
