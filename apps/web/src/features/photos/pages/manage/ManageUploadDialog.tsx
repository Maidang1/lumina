import React from "react";
import { X } from "lucide-react";
import UploadWorkspace from "@/features/photos/components/upload/UploadWorkspace";

interface ManageUploadDialogProps {
  isOpen: boolean;
  initialFiles: File[];
  onClose: () => void;
  onUploadCompleted: () => void;
  onInitialFilesConsumed: () => void;
}

const ManageUploadDialog: React.FC<ManageUploadDialogProps> = ({
  isOpen,
  initialFiles,
  onClose,
  onUploadCompleted,
  onInitialFilesConsumed,
}) => {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-300 ${
        isOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
      }`}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-lumina-surface-elevated shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
          <h3 className="text-base font-medium text-lumina-text">File Upload</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <UploadWorkspace
            onUploadCompleted={onUploadCompleted}
            initialFiles={initialFiles}
            onInitialFilesConsumed={onInitialFilesConsumed}
          />
        </div>
      </div>
    </div>
  );
};

export default ManageUploadDialog;
