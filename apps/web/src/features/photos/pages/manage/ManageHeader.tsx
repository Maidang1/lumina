import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";

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
      <div className="mx-auto flex h-20 items-center justify-between border-b border-white/[0.08] bg-[#080808]/90 px-5 shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:px-8">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center text-white/40 transition-colors duration-200 hover:text-white/75">
            <ArrowLeft size={18} />
          </Link>
          <div className="h-3 w-px bg-lumina-border" />
          <span className="font-serif text-2xl tracking-tight text-lumina-text">Photo Library</span>
        </div>
        <Button
          onClick={onOpenUpload}
          className="h-9 rounded-md border border-white/[0.14] bg-white/[0.06] px-5 text-sm font-medium text-white transition-colors hover:bg-white/[0.12]"
        >
          Upload Files
        </Button>
      </div>
    </header>
  );
};

export default ManageHeader;
