import React from "react";
import { Search, Command, Bell, Sun, Moon, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderBarProps {
  onOpenCommandPalette?: () => void;
  repoHint?: string;
  notificationCount?: number;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
  onToggleGitSidebar?: () => void;
  gitSidebarOpen?: boolean;
  changesCount?: number;
}

export function HeaderBar({
  onOpenCommandPalette,
  repoHint,
  notificationCount = 0,
  theme = "dark",
  onToggleTheme,
  onToggleGitSidebar,
  gitSidebarOpen = false,
  changesCount = 0,
}: HeaderBarProps): React.ReactElement {
  return (
    <header className="flex h-12 items-center justify-between border-b border-[var(--lumina-border)] bg-[var(--lumina-surface)]/50 px-4">
      <div className="flex items-center gap-3">
        {repoHint && (
          <span className="text-xs text-[var(--lumina-muted)]">
            <span className="text-emerald-500">●</span> {repoHint}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-1.5",
            "border border-[var(--lumina-border)] bg-[var(--lumina-surface)]",
            "text-[var(--lumina-muted)] transition-colors",
            "hover:bg-[var(--lumina-surface-elevated)] hover:text-[var(--lumina-text-secondary)]",
          )}
        >
          <Search size={14} />
          <span className="text-xs">搜索</span>
          <kbd className="ml-2 flex items-center gap-0.5 rounded bg-[var(--lumina-border)] px-1.5 py-0.5 text-[10px] text-[var(--lumina-muted)]">
            <Command size={10} />K
          </kbd>
        </button>

        <button
          type="button"
          onClick={onToggleGitSidebar}
          className={cn(
            "relative flex h-8 w-8 items-center justify-center rounded-lg transition-all",
            gitSidebarOpen
              ? "bg-[var(--lumina-accent-muted)] text-[var(--lumina-text)]"
              : "text-[var(--lumina-muted)] hover:bg-[var(--lumina-surface-elevated)] hover:text-[var(--lumina-text-secondary)]",
          )}
          title="源代码管理 (⌘⇧G)"
        >
          <GitBranch size={16} />
          {changesCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-medium text-white">
              {changesCount > 99 ? "99+" : changesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className={cn(
            "relative flex h-8 w-8 items-center justify-center rounded-lg",
            "text-[var(--lumina-muted)] transition-all",
            "hover:bg-[var(--lumina-surface-elevated)] hover:text-[var(--lumina-text-secondary)]",
          )}
          title={theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
        >
          {theme === "dark" ? (
            <Sun size={16} className="transition-transform hover:rotate-12" />
          ) : (
            <Moon size={16} className="transition-transform hover:-rotate-12" />
          )}
        </button>

        <button
          type="button"
          className={cn(
            "relative flex h-8 w-8 items-center justify-center rounded-lg",
            "text-[var(--lumina-muted)] transition-colors",
            "hover:bg-[var(--lumina-surface-elevated)] hover:text-[var(--lumina-text-secondary)]",
          )}
        >
          <Bell size={16} />
          {notificationCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-medium text-white">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
