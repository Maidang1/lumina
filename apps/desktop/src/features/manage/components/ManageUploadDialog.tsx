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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => onOpenChange(false)}>
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
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden border border-white/[0.08] bg-lumina-surface-elevated p-0 shadow-2xl"
      >
        <DialogHeader className="border-b border-white/[0.08] px-6 py-4">
          <DialogTitle className="text-base font-medium text-lumina-text">
            File Upload
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <UploadWorkspace onUploadCompleted={onUploadCompleted} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManageUploadDialog;
