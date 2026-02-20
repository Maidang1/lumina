import React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";

interface UploadConfirmHeaderProps {
  queueLength: number;
  totalBytes: number;
  canSubmit: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
}

const UploadConfirmHeader: React.FC<UploadConfirmHeaderProps> = ({
  queueLength,
  totalBytes,
  canSubmit,
  isSubmitting,
  onSubmit,
}) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-medium text-white">Confirm upload?</h2>
        <p className="text-sm text-zinc-400">
          Selected {queueLength} items, estimated size {(totalBytes / 1024 / 1024).toFixed(1)} MB.
        </p>
      </div>
      <Button
        onClick={onSubmit}
        disabled={!canSubmit}
        className="h-9 rounded-md bg-sky-500 px-6 text-sm font-medium text-white hover:bg-sky-400 disabled:bg-sky-500/40"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={14} className="mr-2 animate-spin motion-reduce:animate-none" />
            Uploading...
          </>
        ) : (
          "Start Upload"
        )}
      </Button>
    </div>
  );
};

export default UploadConfirmHeader;
