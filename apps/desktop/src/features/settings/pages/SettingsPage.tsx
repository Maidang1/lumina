import React, { useState } from 'react';
import { useSettingsStore } from '@/features/settings/hooks/useSettingsStore';
import { Loader2, FolderOpen } from 'lucide-react';
import { selectDirectory } from '@/lib/tauri/dialog';

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
  const [saveMessage, setSaveMessage] = useState('');

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      await refreshRepoStatus();
      setSaveMessage('设置已保存');
      setTimeout(() => setSaveMessage(''), 2000);
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
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-zinc-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">设置</h1>
          <p className="text-zinc-400 mt-2">配置应用程序选项</p>
        </header>

        <main className="space-y-6">
          <section className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <h2 className="text-xl font-semibold mb-4">仓库配置</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">本地 Git 仓库</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-600"
                    placeholder="/path/to/your/repository"
                    value={repoPath}
                    onChange={(e) => void updateRepoPath(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => void handleSelectRepo()}
                    className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-md text-sm transition-colors flex items-center gap-2"
                  >
                    <FolderOpen size={16} />
                    选择
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mt-1">选择图片对象仓库根目录（必须包含 .git）</p>
              </div>
              <div className={`text-sm ${isRepoReady ? 'text-green-400' : 'text-amber-400'}`}>
                {repoStatusMessage}
              </div>
            </div>
          </section>

          <section className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <h2 className="text-xl font-semibold mb-4">应用设置</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-300">并发上传数</p>
                  <p className="text-xs text-zinc-500 mt-1">同时上传的最大文件数</p>
                </div>
                <input
                  type="number"
                  min="1"
                  max="10"
                  className="w-20 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-600"
                  value={concurrency}
                  onChange={(e) => void updateConcurrency(parseInt(e.target.value, 10) || 1)}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-zinc-300">解析模式</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Quality 保持完整功能；Turbo 速度更快但可能影响地图信息和大图细节。
                  </p>
                </div>
                <select
                  className="w-32 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-600"
                  value={parseProfile}
                  onChange={(e) => void updateParseProfile((e.target.value === 'turbo' ? 'turbo' : 'quality'))}
                >
                  <option value="quality">Quality</option>
                  <option value="turbo">Turbo</option>
                </select>
              </div>
              {parseProfile === 'turbo' && (
                <p className="text-xs text-amber-400">
                  Turbo 模式会优先性能，可能关闭区域解析/缩略图变体/方向烘焙，建议批量导入场景使用。
                </p>
              )}
            </div>
          </section>

          <div className="flex items-center justify-end gap-3">
            {saveMessage && <span className="text-sm text-green-400">{saveMessage}</span>}
            <button
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="px-6 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-md text-sm transition-colors flex items-center gap-2"
            >
              {isSaving && <Loader2 className="animate-spin" size={14} />}
              保存设置
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
