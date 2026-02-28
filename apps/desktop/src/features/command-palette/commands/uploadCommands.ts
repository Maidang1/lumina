import { Upload, FolderInput, RefreshCw, GitCommit } from "lucide-react";
import React from "react";
import type { Command } from "@/types/commands";
import { useAppStore } from "@/stores/appStore";

interface UseUploadCommandsOptions {
  onSelectFiles?: () => void;
  onSelectFolder?: () => void;
  onSyncRepo?: () => void;
  onCommitPush?: () => void;
}

export function useUploadCommands(options: UseUploadCommandsOptions): Command[] {
  const { isRepoReady, isSyncing, isCommitting } = useAppStore();
  const { onSelectFiles, onSelectFolder, onSyncRepo, onCommitPush } = options;

  return [
    {
      id: "upload-select-files",
      label: "选择文件上传",
      icon: React.createElement(Upload, { size: 16 }),
      action: () => onSelectFiles?.(),
      group: "upload",
      keywords: ["upload", "上传", "files", "文件"],
      disabled: !isRepoReady,
    },
    {
      id: "upload-select-folder",
      label: "选择文件夹上传",
      icon: React.createElement(FolderInput, { size: 16 }),
      action: () => onSelectFolder?.(),
      group: "upload",
      keywords: ["upload", "上传", "folder", "文件夹"],
      disabled: !isRepoReady,
    },
    {
      id: "upload-sync",
      label: "同步远程仓库",
      icon: React.createElement(RefreshCw, { size: 16 }),
      action: () => onSyncRepo?.(),
      group: "upload",
      keywords: ["sync", "同步", "pull", "fetch"],
      disabled: !isRepoReady || isSyncing,
    },
    {
      id: "upload-commit",
      label: "提交并推送",
      icon: React.createElement(GitCommit, { size: 16 }),
      action: () => onCommitPush?.(),
      group: "upload",
      keywords: ["commit", "提交", "push", "推送"],
      disabled: !isRepoReady || isCommitting,
    },
  ];
}
