import React from "react";
import { Search, Command, Bell, Sun, Moon, GitBranch } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface HeaderBarProps {
  title: string;
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
  title,
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
    <header className="flex h-14 items-center gap-4 border-b border-[var(--lumina-border-subtle)] bg-[var(--lumina-bg)]/92 px-5 backdrop-blur-xl">
      <div
        data-tauri-drag-region
        className="flex h-full min-w-0 flex-1 items-center gap-4"
      >
        <div className="min-w-0">
          <h1 className="text-sm font-semibold tracking-tight text-[var(--lumina-text)]">
            {title}
          </h1>
        </div>
        {repoHint ? (
          <div className="hidden min-w-0 items-center gap-2 text-xs text-[var(--lumina-muted)] md:flex">
            <span className="text-emerald-500">●</span>
            <span className="truncate">{repoHint}</span>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className={cn(
            "flex items-center gap-2 rounded-full border border-[var(--lumina-border-subtle)] px-3 py-1.5",
            "bg-[var(--lumina-surface)]/80",
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
            "relative flex h-8 w-8 items-center justify-center rounded-full border border-transparent transition-all",
            gitSidebarOpen
              ? "border-[var(--lumina-border-subtle)] bg-[var(--lumina-surface)] text-[var(--lumina-text)]"
              : "text-[var(--lumina-muted)] hover:bg-[var(--lumina-accent-muted)] hover:text-[var(--lumina-text-secondary)]",
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
            "relative flex h-8 w-8 items-center justify-center rounded-full border border-transparent",
            "text-[var(--lumina-muted)] transition-all",
            "hover:bg-[var(--lumina-accent-muted)] hover:text-[var(--lumina-text-secondary)]",
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
            "relative flex h-8 w-8 items-center justify-center rounded-full border border-transparent",
            "text-[var(--lumina-muted)] transition-colors",
            "hover:bg-[var(--lumina-accent-muted)] hover:text-[var(--lumina-text-secondary)]",
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
