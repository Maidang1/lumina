import React from "react";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm text-red-300">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-white/20 px-4 py-2 text-xs tracking-wide text-white transition-colors hover:bg-white/10"
        >
          Retry
        </button>
      )}
    </div>
  );
};

export default ErrorState;
