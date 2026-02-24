import React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ManageHeaderProps {
  uploadFileInputRef: React.RefObject<HTMLInputElement | null>;
  onUploadFileSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenUpload: () => void;
}

const ManageHeader: React.FC<ManageHeaderProps> = ({
  uploadFileInputRef,
  onUploadFileSelected,
  onOpenUpload,
}) => {
  return (
    <header className="sticky top-0 z-30 mx-auto w-full max-w-[1720px]">
      <input
        ref={uploadFileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={onUploadFileSelected}
      />
      <div className="mx-auto flex h-16 items-center justify-between border-b border-white/[0.08] bg-[#080808]/90 px-4 shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:h-20 sm:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <button
            onClick={() => window.history.back()}
            className="flex items-center text-white/40 transition-colors duration-200 hover:text-white/75"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="hidden h-3 w-px bg-white/[0.08] sm:block" />
          <span className="truncate font-serif text-xl tracking-tight text-white sm:text-2xl">Photo Library</span>
        </div>
        <Button
          onClick={onOpenUpload}
          className="h-8 rounded-md border border-white/[0.14] bg-white/[0.06] px-3 text-xs font-medium text-white transition-colors hover:bg-white/[0.12] sm:h-9 sm:px-5 sm:text-sm"
        >
          <span className="sm:hidden">Upload</span>
          <span className="hidden sm:inline">Upload Files</span>
        </Button>
      </div>
    </header>
  );
};

export default ManageHeader;
