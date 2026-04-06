import React from "react";
import { cn } from "@/lib/utils";

interface ActionBarProps {
  collapsed?: boolean;
  onSyncRepo: () => void;
  onCommitPush: () => void;
  syncDisabled?: boolean;
  syncLoading?: boolean;
  commitDisabled?: boolean;
  commitLoading?: boolean;
  changesCount?: number;
}

export function ActionBar({
  collapsed = false,
  onSyncRepo,
  onCommitPush,
  syncDisabled = false,
  syncLoading = false,
  commitDisabled = false,
  commitLoading = false,
  changesCount = 0,
}: ActionBarProps): React.ReactElement {
  if (collapsed) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onSyncRepo}
          disabled={syncDisabled || syncLoading}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
            syncDisabled || syncLoading
              ? "border-[var(--lumina-border-subtle)] bg-transparent text-[var(--lumina-muted)]"
              : "border-[var(--lumina-border)] bg-[var(--lumina-surface)] text-[var(--lumina-text-secondary)] hover:bg-[var(--lumina-surface-elevated)] hover:text-[var(--lumina-text)]",
          )}
          title={syncLoading ? "Syncing..." : "Sync Remote"}
        >
          <svg
            className={cn("h-4 w-4", syncLoading && "animate-spin")}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={onCommitPush}
          disabled={commitDisabled || commitLoading || changesCount === 0}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
            commitDisabled || commitLoading || changesCount === 0
              ? "border-[var(--lumina-border-subtle)] bg-[var(--lumina-border-subtle)] text-[var(--lumina-muted)]"
              : "border-[var(--lumina-border)] bg-[var(--lumina-surface)] text-[var(--lumina-text-secondary)] hover:bg-[var(--lumina-surface-elevated)] hover:text-[var(--lumina-text)]",
          )}
          title={commitLoading ? "Committing..." : "Commit & Push"}
        >
          <svg
            className={cn("h-4 w-4", commitLoading && "animate-pulse")}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onSyncRepo}
        disabled={syncDisabled || syncLoading}
        className={cn(
          "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm transition-colors",
          syncDisabled || syncLoading
            ? "border-[var(--lumina-border-subtle)] bg-transparent text-[var(--lumina-muted)]"
            : "border-[var(--lumina-border)] bg-[var(--lumina-surface)] text-[var(--lumina-text-secondary)] hover:bg-[var(--lumina-surface-elevated)] hover:text-[var(--lumina-text)]",
        )}
      >
        <span>{syncLoading ? "Syncing..." : "Sync Remote"}</span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--lumina-muted)]">
          Repo
        </span>
      </button>

      <button
        type="button"
        onClick={onCommitPush}
        disabled={commitDisabled || commitLoading || changesCount === 0}
        className={cn(
          "relative flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
          commitDisabled || commitLoading || changesCount === 0
            ? "border-[var(--lumina-border-subtle)] bg-[var(--lumina-border-subtle)] text-[var(--lumina-muted)]"
            : "border-[var(--lumina-border)] bg-[var(--lumina-surface)] text-[var(--lumina-text)] hover:bg-[var(--lumina-surface-elevated)]",
        )}
      >
        <span>{commitLoading ? "Committing..." : "Commit & Push"}</span>
        <span className="rounded-full bg-[var(--lumina-accent-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--lumina-muted)]">
          {changesCount}
        </span>
      </button>
    </div>
  );
}
