import React from "react";
import { Upload, FolderOpen, FileText, Settings } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { NavItem } from "./NavItem";
import { ActionBar } from "./ActionBar";
import { CollapseToggle } from "./CollapseToggle";
import type { View } from "@/types/layout";

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCommitPush: () => void;
  onSyncRepo: () => void;
  commitDisabled?: boolean;
  commitLoading?: boolean;
  syncDisabled?: boolean;
  syncLoading?: boolean;
  changesCount?: number;
}

const PRIMARY_NAV_ITEMS: Array<{
  view: View;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
}> = [
  { view: "upload", label: "上传", icon: <Upload size={18} />, shortcut: "⌘1" },
  { view: "manage", label: "管理", icon: <FolderOpen size={18} />, shortcut: "⌘2" },
  { view: "metadata", label: "Metadata", icon: <FileText size={18} />, shortcut: "⌘3" },
];

const SECONDARY_NAV_ITEMS: Array<{
  view: View;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
}> = [{ view: "settings", label: "设置", icon: <Settings size={18} />, shortcut: "⌘4" }];

export function Sidebar({
  currentView,
  onViewChange,
  collapsed,
  onToggleCollapse,
  onCommitPush,
  onSyncRepo,
  commitDisabled = false,
  commitLoading = false,
  syncDisabled = false,
  syncLoading = false,
  changesCount = 0,
}: SidebarProps): React.ReactElement {
  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-[var(--lumina-border-subtle)] bg-[var(--lumina-surface)]/92 p-3 backdrop-blur-2xl transition-all duration-300",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div data-tauri-drag-region className="mb-4 h-9 shrink-0" />

      {!collapsed && (
        <div className="px-3 pb-2 text-[11px] font-medium text-[var(--lumina-muted)]">
          Workspace
        </div>
      )}

      <nav className="space-y-1 py-1">
        {PRIMARY_NAV_ITEMS.map((item) => (
          <NavItem
            key={item.view}
            icon={item.icon}
            label={item.label}
            isActive={currentView === item.view}
            collapsed={collapsed}
            onClick={() => onViewChange(item.view)}
            shortcut={item.shortcut}
          />
        ))}
      </nav>

      <div className="flex-1" />

      <div className="mt-4 border-t border-[var(--lumina-border-subtle)] pt-4">
        {!collapsed && (
          <div className="px-3 pb-2 text-[11px] font-medium text-[var(--lumina-muted)]">
            Repository
          </div>
        )}
        <ActionBar
          collapsed={collapsed}
          onSyncRepo={onSyncRepo}
          onCommitPush={onCommitPush}
          syncDisabled={syncDisabled}
          syncLoading={syncLoading}
          commitDisabled={commitDisabled}
          commitLoading={commitLoading}
          changesCount={changesCount}
        />
      </div>

      <div className="mt-4 pt-1">
        {!collapsed && (
          <div className="px-3 pb-2 text-[11px] font-medium text-[var(--lumina-muted)]">
            Preferences
          </div>
        )}
        <nav className="space-y-1">
          {SECONDARY_NAV_ITEMS.map((item) => (
            <NavItem
              key={item.view}
              icon={item.icon}
              label={item.label}
              isActive={currentView === item.view}
              collapsed={collapsed}
              onClick={() => onViewChange(item.view)}
              shortcut={item.shortcut}
            />
          ))}
        </nav>
      </div>

      <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} />
    </aside>
  );
}
