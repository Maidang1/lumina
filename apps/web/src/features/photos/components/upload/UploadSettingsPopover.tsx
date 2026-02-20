import React, { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import UploadTokenCard from "./UploadTokenCard";

interface UploadSettingsPopoverProps {
  uploadToken: string;
  tokenError: string;
  isTokenConfigured: boolean;
  onChangeToken: (nextToken: string) => void;
  panelTitle?: string;
  iconSize?: number;
  buttonClassName?: string;
}

const UploadSettingsPopover: React.FC<UploadSettingsPopoverProps> = ({
  uploadToken,
  tokenError,
  isTokenConfigured,
  onChangeToken,
  panelTitle = "Upload Settings",
  iconSize = 16,
  buttonClassName,
}) => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!panelRef.current) {
        return;
      }
      if (!panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        aria-label="Open upload settings"
        onClick={() => setOpen((prev) => !prev)}
        className={
          buttonClassName ??
          "rounded-full border border-white/15 bg-white/[0.06] p-2 text-gray-300 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a962]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        }
      >
        <Settings2 size={iconSize} />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-[80] w-[360px] rounded-xl border border-white/10 bg-[#121212] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
          <div className="mb-3">
            <h2 className="text-base font-medium text-white">{panelTitle}</h2>
          </div>
          <UploadTokenCard
            uploadToken={uploadToken}
            tokenError={tokenError}
            isTokenConfigured={isTokenConfigured}
            onChangeToken={onChangeToken}
          />
        </div>
      )}
    </div>
  );
};

export default UploadSettingsPopover;
