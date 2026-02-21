import React from "react";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";

interface UploadTokenCardProps {
  uploadToken: string;
  tokenError: string;
  isTokenConfigured: boolean;
  onChangeToken: (nextToken: string) => void;
}

const UploadTokenCard: React.FC<UploadTokenCardProps> = ({
  uploadToken,
  tokenError,
  isTokenConfigured,
  onChangeToken,
}) => {
  return (
    <div className="rounded-xl border border-white/10 bg-[#141414] p-4 transition-colors focus-within:border-white/20 hover:border-white/20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="upload-token" className="shrink-0 text-sm font-medium text-gray-400">
          Access Token
        </label>
        <div className="flex-1 space-y-2">
          <Input
            id="upload-token"
            type="password"
            value={uploadToken}
            onChange={(event) => onChangeToken(event.target.value)}
            placeholder="Enter UPLOAD_TOKEN (stored locally)"
            className="w-full border-white/10 bg-black/40 text-white placeholder-gray-600 focus-visible:ring-emerald-500/50"
          />
          {tokenError && (
            <p className="text-xs text-red-400">{tokenError}</p>
          )}
        </div>
        <div className="shrink-0">
          <Badge 
            variant="outline" 
            className={cn(
              "border-transparent bg-transparent px-0 font-normal",
              isTokenConfigured ? "text-emerald-500" : "text-gray-500"
            )}
          >
            {isTokenConfigured ? "Configured" : "Not Configured"}
          </Badge>
        </div>
      </div>
    </div>
  );
};

export default UploadTokenCard;
