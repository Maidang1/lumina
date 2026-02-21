import React from "react";
import UploadWorkspace from "@/features/photos/components/upload/UploadWorkspace";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden border border-white/[0.08] bg-lumina-surface-elevated p-0 shadow-2xl"
      >
        <DialogHeader className="border-b border-white/[0.08] px-6 py-4">
          <DialogTitle className="text-base font-medium text-lumina-text">
            File Upload
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <UploadWorkspace
            onUploadCompleted={onUploadCompleted}
            initialFiles={initialFiles}
            onInitialFilesConsumed={onInitialFilesConsumed}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManageUploadDialog;
