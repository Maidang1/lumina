import React from "react";
import { cn } from "@/shared/lib/utils";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  collapsed?: boolean;
  onClick: () => void;
  shortcut?: string;
}

export function NavItem({
  icon,
  label,
  isActive,
  collapsed = false,
  onClick,
  shortcut,
}: NavItemProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm transition-all duration-200",
        collapsed ? "justify-center" : "justify-start",
        isActive
          ? "border-[var(--lumina-border-subtle)] bg-[var(--lumina-accent-muted)] text-[var(--lumina-text)]"
          : "text-[var(--lumina-muted)] hover:bg-[var(--lumina-accent-muted)] hover:text-[var(--lumina-text-secondary)]",
      )}
      title={collapsed ? `${label}${shortcut ? ` (${shortcut})` : ""}` : undefined}
    >
      <span className="flex-shrink-0 text-[var(--lumina-muted)]">{icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 text-left font-medium">{label}</span>
          {shortcut && (
            <kbd className="hidden text-[10px] text-[var(--lumina-muted)] lg:inline-block">
              {shortcut}
            </kbd>
          )}
        </>
      )}
    </button>
  );
}
