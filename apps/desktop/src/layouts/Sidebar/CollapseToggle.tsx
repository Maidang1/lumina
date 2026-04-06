import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapseToggleProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function CollapseToggle({
  collapsed,
  onToggle,
}: CollapseToggleProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-full",
        "border border-[var(--lumina-border-subtle)] bg-[var(--lumina-surface)] text-[var(--lumina-muted)]",
        "transition-all hover:bg-[var(--lumina-surface-elevated)] hover:text-[var(--lumina-text-secondary)]",
        "absolute -right-3 top-1/2 -translate-y-1/2",
      )}
      title={collapsed ? "展开侧边栏" : "收起侧边栏"}
    >
      {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
    </button>
  );
}
