import React from "react";
import { Upload, FolderOpen, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
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

const NAV_ITEMS: Array<{
  view: View;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
}> = [
  { view: "upload", label: "上传", icon: <Upload size={18} />, shortcut: "⌘1" },
  { view: "manage", label: "管理", icon: <FolderOpen size={18} />, shortcut: "⌘2" },
  { view: "settings", label: "设置", icon: <Settings size={18} />, shortcut: "⌘3" },
];

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
        "relative flex flex-col border-r border-[var(--lumina-border)] bg-[var(--lumina-surface)]/80 p-3 backdrop-blur-xl transition-all duration-300",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div
        className={cn(
          "mb-3 border-b border-[var(--lumina-border-subtle)] px-2 pb-3",
          collapsed && "px-0 text-center",
        )}
      >
        <h1
          className={cn(
            "font-semibold text-[var(--lumina-text)] transition-all",
            collapsed ? "text-sm" : "text-lg",
          )}
        >
          {collapsed ? "L" : "Lumina"}
        </h1>
      </div>

      <nav className="flex-1 space-y-1 py-2">
        {NAV_ITEMS.map((item) => (
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

      <div className="mt-4 border-t border-[var(--lumina-border-subtle)] pt-3">
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

      <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} />
    </aside>
  );
}

export type { View };
