import React from "react";
import { Upload, FolderOpen, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { ShinyButton } from "@/components/magicui/shiny-button";

export type View = "upload" | "manage" | "settings";

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  onCommitPush: () => void;
  onSyncRepo: () => void;
  commitDisabled?: boolean;
  commitLoading?: boolean;
  syncDisabled?: boolean;
  syncLoading?: boolean;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, isActive, onClick }: NavItemProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
        isActive
          ? "bg-white/10 text-white"
          : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function Sidebar({
  currentView,
  onViewChange,
  onCommitPush,
  onSyncRepo,
  commitDisabled = false,
  commitLoading = false,
  syncDisabled = false,
  syncLoading = false,
}: SidebarProps): React.ReactElement {
  return (
    <aside className="lumina-glass w-56 border-r border-white/8 p-3">
      <div className="mb-3 border-b border-white/10 px-2 pb-3">
        <h1 className="text-lg font-semibold text-zinc-100">Lumina</h1>
      </div>

      <nav className="flex-1 space-y-1 py-2">
        <NavItem
          icon={<Upload size={18} />}
          label="上传"
          isActive={currentView === "upload"}
          onClick={() => onViewChange("upload")}
        />
        <NavItem
          icon={<FolderOpen size={18} />}
          label="管理"
          isActive={currentView === "manage"}
          onClick={() => onViewChange("manage")}
        />
        <NavItem
          icon={<Settings size={18} />}
          label="设置"
          isActive={currentView === "settings"}
          onClick={() => onViewChange("settings")}
        />
      </nav>

      <div className="mt-4 border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={onSyncRepo}
          disabled={syncDisabled || syncLoading}
          className={cn(
            "mb-2 w-full rounded-lg border px-3 py-2 text-sm transition-colors",
            syncDisabled || syncLoading
              ? "border-white/10 bg-white/3 text-zinc-500"
              : "border-white/15 bg-white/5 text-white hover:bg-white/10",
          )}
        >
          {syncLoading ? "Syncing..." : "Sync Remote"}
        </button>

        <ShinyButton
          onClick={onCommitPush}
          disabled={commitDisabled || commitLoading}
          className="w-full"
          style={{ opacity: commitDisabled || commitLoading ? 0.5 : 1 }}
          aria-disabled={commitDisabled || commitLoading}
        >
          {commitLoading ? "Committing..." : "Commit & Push"}
        </ShinyButton>
      </div>
    </aside>
  );
}
