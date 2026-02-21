import React from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/popover";
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
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          aria-label="Open upload settings"
          variant="ghost"
          size="icon"
          className={
            buttonClassName ??
            "rounded-full border border-white/15 bg-white/[0.06] p-2 text-gray-300 transition-colors duration-200 hover:text-white"
          }
        >
          <Settings2 size={iconSize} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={12}
        className="z-[80] w-[360px] rounded-xl border border-white/10 bg-[#121212] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.55)]"
      >
        <div className="mb-3">
          <h2 className="text-base font-medium text-white">{panelTitle}</h2>
        </div>
        <UploadTokenCard
          uploadToken={uploadToken}
          tokenError={tokenError}
          isTokenConfigured={isTokenConfigured}
          onChangeToken={onChangeToken}
        />
      </PopoverContent>
    </Popover>
  );
};

export default UploadSettingsPopover;
