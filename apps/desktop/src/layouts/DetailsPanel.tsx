import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailsPanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function DetailsPanel({
  open,
  onClose,
  title,
  children,
}: DetailsPanelProps): React.ReactElement | null {
  if (!open) return null;

  return (
    <aside
      className={cn(
        "flex h-full w-80 flex-col border-l border-[var(--lumina-border)] bg-[var(--lumina-surface)]",
        "animate-in slide-in-from-right-4 duration-200",
      )}
    >
      <header className="flex h-12 items-center justify-between border-b border-[var(--lumina-border)] px-4">
        <h3 className="text-sm font-medium text-[var(--lumina-text)]">
          {title || "Details"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--lumina-muted)] transition-colors hover:bg-[var(--lumina-accent-muted)] hover:text-[var(--lumina-text)]"
        >
          <X size={14} />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </aside>
  );
}
