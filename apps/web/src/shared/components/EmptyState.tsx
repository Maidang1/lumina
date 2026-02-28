import React from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
}) => {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-zinc-300">{title}</p>
      {description && <p className="text-xs text-zinc-500">{description}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 rounded-md border border-white/20 px-4 py-2 text-xs tracking-wide text-white transition-colors hover:bg-white/10"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
