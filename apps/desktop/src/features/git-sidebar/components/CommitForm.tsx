import React, { useState } from "react";
import { GitCommit, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommitFormProps {
  stagedCount: number;
  onCommit: (message: string) => void;
  loading?: boolean;
  disabled?: boolean;
}

export function CommitForm({
  stagedCount,
  onCommit,
  loading = false,
  disabled = false,
}: CommitFormProps): React.ReactElement {
  const [message, setMessage] = useState("");

  const handleSubmit = () => {
    const commitMessage = message.trim() || generateDefaultMessage();
    onCommit(commitMessage);
    setMessage("");
  };

  const generateDefaultMessage = () => {
    return `Update ${stagedCount} file${stagedCount > 1 ? "s" : ""}`;
  };

  const canCommit = stagedCount > 0 && !loading && !disabled;

  return (
    <div className="p-2 border-b border-[var(--lumina-border)]">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="提交信息 (可选，回车提交)"
        className={cn(
          "w-full h-16 px-2 py-1.5 text-xs rounded-md resize-none",
          "bg-[var(--lumina-surface)] border border-[var(--lumina-border)]",
          "text-[var(--lumina-text)] placeholder:text-[var(--lumina-muted)]",
          "focus:outline-none focus:border-[var(--lumina-text)]/30",
        )}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && canCommit) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        disabled={loading}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canCommit}
        className={cn(
          "w-full mt-2 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
          canCommit
            ? "bg-[var(--lumina-text)] text-[var(--lumina-bg)] hover:opacity-90"
            : "bg-[var(--lumina-border-subtle)] text-[var(--lumina-muted)] cursor-not-allowed",
        )}
      >
        {loading ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            提交中...
          </>
        ) : (
          <>
            <GitCommit size={12} />
            Commit & Push
            {stagedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[10px]">
                {stagedCount}
              </span>
            )}
          </>
        )}
      </button>
    </div>
  );
}
