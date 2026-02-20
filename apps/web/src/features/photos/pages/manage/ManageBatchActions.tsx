import React from "react";

interface ManageBatchActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBatchFavorite: () => void;
  onBatchTag: () => void;
  onBatchDownload: () => void;
  onBatchDelete: () => void;
}

const ManageBatchActions: React.FC<ManageBatchActionsProps> = ({
  selectedCount,
  onClearSelection,
  onBatchFavorite,
  onBatchTag,
  onBatchDownload,
  onBatchDelete,
}) => {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-lumina-text shadow-[0_14px_40px_rgba(0,0,0,0.4)] backdrop-blur-md">
      <span className="mr-2 text-lumina-text-secondary">Selected {selectedCount}</span>
      <button
        type="button"
        className="cursor-pointer rounded-md border border-white/[0.14] bg-white/[0.03] px-3 py-1.5 transition-colors duration-200 hover:bg-white/[0.09]"
        onClick={onClearSelection}
      >
        Deselect
      </button>
      <button
        type="button"
        className="cursor-pointer rounded-md border border-white/[0.14] bg-white/[0.03] px-3 py-1.5 transition-colors duration-200 hover:bg-white/[0.09]"
        onClick={onBatchFavorite}
      >
        Favorite
      </button>
      <button
        type="button"
        className="cursor-pointer rounded-md border border-white/[0.14] bg-white/[0.03] px-3 py-1.5 transition-colors duration-200 hover:bg-white/[0.09]"
        onClick={onBatchTag}
      >
        Tag
      </button>
      <button
        type="button"
        className="cursor-pointer rounded-md border border-white/[0.14] bg-white/[0.03] px-3 py-1.5 transition-colors duration-200 hover:bg-white/[0.09]"
        onClick={onBatchDownload}
      >
        Download
      </button>
      <button
        type="button"
        className="cursor-pointer rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-red-300 transition-colors duration-200 hover:bg-red-500/20"
        onClick={onBatchDelete}
      >
        Delete
      </button>
    </div>
  );
};

export default ManageBatchActions;
