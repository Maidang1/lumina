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
      className="min-h-[44px] min-w-[44px] cursor-pointer gap-2 rounded-xl border-white/[0.14] bg-white/[0.03] px-3 text-white/85 shadow-[0_10px_30px_rgba(0,0,0,0.28)] transition-all duration-200 hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
    >
      <Upload size={14} />
      <span className="hidden sm:inline">上传</span>
      {queueCount > 0 && (
        <span className="rounded-full bg-[#c9a962] px-1.5 py-0.5 text-xs text-black">
          {queueCount}
        </span>
      )}
    </Button>
  );
};

export default UploadButton;
