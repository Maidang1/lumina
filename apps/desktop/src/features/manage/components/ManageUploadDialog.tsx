import React from "react";
import UploadWorkspace from "@/features/upload/components/UploadWorkspace";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/62 px-4 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
};

const DialogContent: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => {
  return <div className={className}>{children}</div>;
};

const DialogHeader: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => {
  return <div className={className}>{children}</div>;
};

const DialogTitle: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => {
  return <h2 className={className}>{children}</h2>;
};

interface ManageUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadCompleted: () => void;
}

const ManageUploadDialog: React.FC<ManageUploadDialogProps> = ({
  isOpen,
  onClose,
  onUploadCompleted,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-white/[0.1] bg-[var(--lumina-surface-elevated)] p-0 shadow-[var(--shadow-elevation-3)]"
      >
        <DialogHeader className="border-b border-white/[0.1] bg-white/[0.03] px-6 py-4">
          <DialogTitle className="text-base font-medium text-[var(--foreground)]">
            文件上传
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-white/12 scrollbar-track-transparent sm:p-6">
          <UploadWorkspace onUploadCompleted={onUploadCompleted} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManageUploadDialog;
