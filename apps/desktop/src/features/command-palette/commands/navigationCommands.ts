import { Upload, FolderOpen, FileText, Settings, PanelLeftClose, PanelLeft } from "lucide-react";
import React from "react";
import type { Command } from "@/types/commands";
import { useAppStore } from "@/stores/appStore";

export function useNavigationCommands(): Command[] {
  const { setCurrentView, toggleSidebar, sidebarCollapsed } = useAppStore();

  return [
    {
      id: "nav-upload",
      label: "前往上传页面",
      shortcut: "⌘1",
      icon: React.createElement(Upload, { size: 16 }),
      action: () => setCurrentView("upload"),
      group: "navigation",
      keywords: ["upload", "上传"],
    },
    {
      id: "nav-manage",
      label: "前往管理页面",
      shortcut: "⌘2",
      icon: React.createElement(FolderOpen, { size: 16 }),
      action: () => setCurrentView("manage"),
      group: "navigation",
      keywords: ["manage", "管理", "photos", "照片"],
    },
    {
      id: "nav-metadata",
      label: "前往 Metadata 页面",
      shortcut: "⌘3",
      icon: React.createElement(FileText, { size: 16 }),
      action: () => setCurrentView("metadata"),
      group: "navigation",
      keywords: ["metadata", "exif", "json", "元数据"],
    },
    {
      id: "nav-settings",
      label: "前往设置页面",
      shortcut: "⌘4",
      icon: React.createElement(Settings, { size: 16 }),
      action: () => setCurrentView("settings"),
      group: "navigation",
      keywords: ["settings", "设置", "config", "配置"],
    },
    {
      id: "nav-toggle-sidebar",
      label: sidebarCollapsed ? "展开侧边栏" : "收起侧边栏",
      shortcut: "⌘B",
      icon: React.createElement(sidebarCollapsed ? PanelLeft : PanelLeftClose, { size: 16 }),
      action: () => toggleSidebar(),
      group: "navigation",
      keywords: ["sidebar", "侧边栏", "toggle"],
    },
  ];
}
