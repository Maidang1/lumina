import React, { useState } from "react";
import { useSettingsStore } from "@/features/settings/hooks/useSettingsStore";
import { Loader2, FolderOpen } from "lucide-react";
import { selectDirectory } from "@/lib/tauri/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SettingsPage(): React.ReactElement {
  const {
    isLoading,
    repoPath,
    concurrency,
    parseProfile,
    repoStatusMessage,
    isRepoReady,
    updateRepoPath,
    updateConcurrency,
    updateParseProfile,
    refreshRepoStatus,
  } = useSettingsStore();

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    setSaveMessage("");
    try {
      await refreshRepoStatus();
      setSaveMessage("仓库状态已刷新");
      setTimeout(() => setSaveMessage(""), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectRepo = async (): Promise<void> => {
    const selected = await selectDirectory();
    if (!selected) {
      return;
    }
    await updateRepoPath(selected);
    await refreshRepoStatus(selected);
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-zinc-400" size={32} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-sm">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">设置</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">配置应用程序选项</p>
      </header>

      <main className="space-y-4">
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5 shadow-[var(--shadow-elevation-1)] backdrop-blur-sm">
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">仓库配置</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">本地 Git 仓库</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  className="flex-1"
                  placeholder="/path/to/your/repository"
                  value={repoPath}
                  onChange={(e) => void updateRepoPath(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleSelectRepo()}
                  className="gap-2"
                >
                  <FolderOpen size={16} />
                  选择
                </Button>
              </div>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">选择图片对象仓库根目录（必须包含 .git）</p>
            </div>
            <div className={`text-sm ${isRepoReady ? "text-emerald-400" : "text-amber-400"}`}>
              {repoStatusMessage}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5 shadow-[var(--shadow-elevation-1)] backdrop-blur-sm">
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">应用设置</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-300">并发上传数</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">同时上传的最大文件数</p>
              </div>
              <Input
                type="number"
                min="1"
                max="10"
                className="w-24"
                value={concurrency}
                onChange={(e) => void updateConcurrency(parseInt(e.target.value, 10) || 1)}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-zinc-300">解析模式</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Quality 保持完整功能；Turbo 速度更快但可能影响地图信息和大图细节。
                </p>
              </div>
              <select
                className="h-10 w-32 rounded-md border border-[var(--border)] bg-white/[0.03] px-3 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring)]"
                value={parseProfile}
                onChange={(e) => void updateParseProfile((e.target.value === "turbo" ? "turbo" : "quality"))}
              >
                <option value="quality">Quality</option>
                <option value="turbo">Turbo</option>
              </select>
            </div>
            {parseProfile === "turbo" && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                Turbo 模式会优先性能，可能关闭区域解析/缩略图变体/方向烘焙，建议批量导入场景使用。
              </p>
            )}
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          {saveMessage && <span className="text-sm text-emerald-400">{saveMessage}</span>}
          <Button
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="gap-2"
          >
            {isSaving && <Loader2 className="animate-spin" size={14} />}
            验证仓库状态
          </Button>
        </div>
      </main>
    </div>
  );
}
