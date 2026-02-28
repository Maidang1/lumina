import React, { useEffect, useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { cn } from "@/lib/utils";
import { useCommands } from "./hooks/useCommands";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncRepo?: () => void;
  onCommitPush?: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onSyncRepo,
  onCommitPush,
}: CommandPaletteProps): React.ReactElement | null {
  const [search, setSearch] = useState("");
  const { sections, executeCommand } = useCommands({
    onSyncRepo,
    onCommitPush,
  });

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const handleSelect = (id: string) => {
    executeCommand(id);
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => onOpenChange(false)}
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

      <CommandPrimitive
        className={cn(
          "relative w-full max-w-lg overflow-hidden rounded-xl",
          "border border-[var(--lumina-border)] bg-[var(--lumina-surface)] shadow-2xl backdrop-blur-xl",
          "animate-in fade-in-0 zoom-in-95 duration-200",
        )}
        onClick={(e) => e.stopPropagation()}
        shouldFilter
      >
        <div className="flex items-center border-b border-[var(--lumina-border)] px-4">
          <svg
            className="mr-2 h-4 w-4 shrink-0 text-[var(--lumina-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <CommandPrimitive.Input
            value={search}
            onValueChange={setSearch}
            placeholder="输入命令或搜索..."
            className={cn(
              "flex h-12 w-full bg-transparent py-3 text-sm text-[var(--lumina-text)]",
              "placeholder:text-[var(--lumina-muted)] focus:outline-none",
            )}
          />
          <kbd className="hidden rounded bg-[var(--lumina-accent-muted)] px-2 py-1 text-[10px] text-[var(--lumina-muted)] sm:inline-block">
            ESC
          </kbd>
        </div>

        <CommandPrimitive.List className="max-h-[300px] overflow-y-auto p-2">
          <CommandPrimitive.Empty className="py-6 text-center text-sm text-[var(--lumina-muted)]">
            没有找到匹配的命令
          </CommandPrimitive.Empty>

          {sections.map((section) => (
            <CommandPrimitive.Group
              key={section.group}
              heading={section.label}
              className="mb-2"
            >
              <div className="px-2 py-1.5 text-xs font-medium text-[var(--lumina-muted)]">
                {section.label}
              </div>
              {section.commands.map((command) => (
                <CommandPrimitive.Item
                  key={command.id}
                  value={`${command.label} ${command.keywords?.join(" ") || ""}`}
                  onSelect={() => handleSelect(command.id)}
                  disabled={command.disabled}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                    "text-[var(--lumina-text-secondary)] outline-none transition-colors",
                    "data-[selected=true]:bg-[var(--lumina-accent-muted)] data-[selected=true]:text-[var(--lumina-text)]",
                    command.disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  {command.icon && (
                    <span className="flex h-5 w-5 items-center justify-center text-[var(--lumina-muted)]">
                      {command.icon}
                    </span>
                  )}
                  <span className="flex-1">{command.label}</span>
                  {command.shortcut && (
                    <kbd className="rounded bg-[var(--lumina-accent-muted)] px-1.5 py-0.5 text-[10px] text-[var(--lumina-muted)]">
                      {command.shortcut}
                    </kbd>
                  )}
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.Group>
          ))}
        </CommandPrimitive.List>

        <div className="flex items-center justify-between border-t border-[var(--lumina-border)] px-4 py-2 text-[11px] text-[var(--lumina-muted)]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-[var(--lumina-accent-muted)] px-1 py-0.5">↑↓</kbd>
              导航
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-[var(--lumina-accent-muted)] px-1 py-0.5">↵</kbd>
              执行
            </span>
          </div>
          <span>Lumina</span>
        </div>
      </CommandPrimitive>
    </div>
  );
}
