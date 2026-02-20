import React from "react";
import { Input } from "@/shared/ui/input";

interface UploadTokenAlertProps {
  uploadToken: string;
  onChange: (next: string) => void;
}

const UploadTokenAlert: React.FC<UploadTokenAlertProps> = ({ uploadToken, onChange }) => {
  return (
    <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-200/80">
      Please configure upload token (UPLOAD_TOKEN)
      <Input
        className="mt-2 border-white/10 bg-black/20"
        placeholder="Enter Token..."
        value={uploadToken}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
};

export default UploadTokenAlert;
