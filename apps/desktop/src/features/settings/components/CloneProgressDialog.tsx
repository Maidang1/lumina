import React from "react";
import { X, Loader2, CheckCircle2, AlertCircle, GitBranch } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Progress } from "@/shared/ui/progress";
import { Button } from "@/shared/ui/button";
import type { CloneProgress } from "@/lib/tauri/clone";

interface CloneProgressDialogProps {
  open: boolean;
  onClose: () => void;
  progress: CloneProgress | null;
  repoInfo?: { owner: string; repo: string } | null;
}

export function CloneProgressDialog({
  open,
  onClose,
  progress,
  repoInfo,
}: CloneProgressDialogProps): React.ReactElement | null {
  if (!open) return null;

  const stage = progress?.stage ?? "preparing";
  const isDone = stage === "done";
  const isError = stage === "error";
  const canClose = isDone || isError;

  const getStageIcon = () => {
    switch (stage) {
      case "done":
        return <CheckCircle2 className="text-emerald-400" size={24} />;
      case "error":
        return <AlertCircle className="text-red-400" size={24} />;
      default:
        return <Loader2 className="animate-spin text-zinc-400" size={24} />;
    }
  };

  const getTitle = () => {
    if (isDone) return "仓库已就绪";
    if (isError) return "连接失败";
    return "连接仓库";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={canClose ? onClose : undefined}
      />

      <div className="relative z-10 max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStageIcon()}
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {getTitle()}
            </h2>
          </div>
          {canClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {repoInfo && (
          <div className="mb-4 flex items-center gap-2 text-sm text-zinc-400">
            <GitBranch size={14} />
            <span>
              {repoInfo.owner}/{repoInfo.repo}
            </span>
          </div>
        )}

        <div className="space-y-3">
          {!isDone && !isError && (
            <Progress value={progress?.percent ?? 0} className="h-2" />
          )}

          <p
            className={cn(
              "text-sm",
              isError ? "text-red-400" : "text-zinc-300"
            )}
          >
            {progress?.message ?? "准备中..."}
          </p>

          {progress?.percent !== undefined && !isDone && !isError && (
            <p className="text-xs text-zinc-500">{progress.percent}%</p>
          )}
        </div>

        {canClose && (
          <div className="mt-6 flex justify-end">
            <Button onClick={onClose} variant={isDone ? "default" : "outline"}>
              {isDone ? "完成" : "关闭"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
