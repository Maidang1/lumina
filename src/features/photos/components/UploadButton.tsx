import React from "react";
import { Upload } from "lucide-react";
import { Button } from "@/shared/ui/button";

interface UploadButtonProps {
  onClick: () => void;
  queueCount?: number;
}

const UploadButton: React.FC<UploadButtonProps> = ({ onClick, queueCount = 0 }) => {
  return (
    <Button
      onClick={onClick}
      variant="outline"
      size="sm"
      className="min-h-[44px] min-w-[44px] gap-2 rounded-xl px-3"
    >
      <Upload size={14} />
      <span className="hidden sm:inline">上传</span>
      {queueCount > 0 && (
        <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
          {queueCount}
        </span>
      )}
    </Button>
  );
};

export default UploadButton;
