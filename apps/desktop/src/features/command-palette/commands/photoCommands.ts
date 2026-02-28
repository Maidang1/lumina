import { Grid3X3, List, CheckSquare, Square, Trash2, Download } from "lucide-react";
import React from "react";
import type { Command } from "@/types/commands";
import { usePhotosStore } from "@/stores/photosStore";

interface UsePhotoCommandsOptions {
  onBatchDelete?: () => void;
  onBatchDownload?: () => void;
}

export function usePhotoCommands(options: UsePhotoCommandsOptions): Command[] {
  const {
    isBatchMode,
    toggleBatchMode,
    selectedIds,
    clearSelection,
    photos,
    selectAll,
  } = usePhotosStore();

  const { onBatchDelete, onBatchDownload } = options;

  return [
    {
      id: "photos-toggle-batch",
      label: isBatchMode ? "退出批量模式" : "进入批量模式",
      icon: React.createElement(isBatchMode ? Square : CheckSquare, { size: 16 }),
      action: () => toggleBatchMode(),
      group: "photos",
      keywords: ["batch", "批量", "select", "选择"],
    },
    {
      id: "photos-select-all",
      label: "全选所有照片",
      icon: React.createElement(CheckSquare, { size: 16 }),
      action: () => selectAll(photos.map((p) => p.id)),
      group: "photos",
      keywords: ["select", "all", "全选"],
      disabled: !isBatchMode || photos.length === 0,
    },
    {
      id: "photos-clear-selection",
      label: "清除选择",
      icon: React.createElement(Square, { size: 16 }),
      action: () => clearSelection(),
      group: "photos",
      keywords: ["clear", "清除", "deselect"],
      disabled: selectedIds.size === 0,
    },
    {
      id: "photos-batch-delete",
      label: `删除选中的照片 (${selectedIds.size})`,
      icon: React.createElement(Trash2, { size: 16 }),
      action: () => onBatchDelete?.(),
      group: "photos",
      keywords: ["delete", "删除", "remove"],
      disabled: selectedIds.size === 0,
    },
    {
      id: "photos-batch-download",
      label: `下载选中的照片 (${selectedIds.size})`,
      icon: React.createElement(Download, { size: 16 }),
      action: () => onBatchDownload?.(),
      group: "photos",
      keywords: ["download", "下载"],
      disabled: selectedIds.size === 0,
    },
  ];
}
