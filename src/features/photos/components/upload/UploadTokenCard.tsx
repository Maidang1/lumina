import React from "react";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";

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
    <Card className="border border-white/10 bg-[#171717]">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="upload-token" className="text-sm font-medium text-gray-200">
            UPLOAD_TOKEN
          </label>
          {!isTokenConfigured && (
            <Badge className="rounded-full border border-[#c9a962]/40 bg-[#c9a962]/10 text-[#d4b97f]">
              未配置
            </Badge>
          )}
        </div>
        <input
          id="upload-token"
          type="password"
          value={uploadToken}
          onChange={(event) => onChangeToken(event.target.value)}
          placeholder="输入上传令牌（保存在当前浏览器本地）"
          className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#c9a962]/60"
        />
        <p className="text-xs text-gray-400">
          仅保存在当前浏览器 localStorage，用于上传接口校验。
        </p>
        {tokenError && (
          <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {tokenError}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UploadTokenCard;
