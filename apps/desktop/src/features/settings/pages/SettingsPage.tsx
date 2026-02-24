import React, { useState } from 'react';
import { useSettingsStore } from '@/features/settings/hooks/useSettingsStore';
import { Loader2 } from 'lucide-react';

export function SettingsPage(): React.ReactElement {
  const {
    isLoading,
    uploadToken,
    githubOwner,
    githubRepo,
    githubBranch,
    concurrency,
    updateUploadToken,
    updateGithubOwner,
    updateGithubRepo,
    updateGithubBranch,
    updateConcurrency,
  } = useSettingsStore();

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      // Settings are saved automatically on change, just show feedback
      setSaveMessage('设置已保存');
      setTimeout(() => setSaveMessage(''), 2000);
    } finally {
      setIsSaving(false);
    }
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
            <h2 className="text-xl font-semibold mb-4">上传配置</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Upload Token
                </label>
                <input
                  type="password"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-600"
                  placeholder="输入上传 token..."
                  value={uploadToken}
                  onChange={(e) => void updateUploadToken(e.target.value)}
                />
                <p className="text-xs text-zinc-500 mt-1">
                  用于验证上传请求的 token
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  GitHub Owner
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-600"
                  placeholder="your-username"
                  value={githubOwner}
                  onChange={(e) => void updateGithubOwner(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  GitHub Repository
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-600"
                  placeholder="your-repo"
                  value={githubRepo}
                  onChange={(e) => void updateGithubRepo(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Branch
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-600"
                  placeholder="main"
                  value={githubBranch}
                  onChange={(e) => void updateGithubBranch(e.target.value)}
                />
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
            </div>
          </section>

          <div className="flex items-center justify-end gap-3">
            {saveMessage && (
              <span className="text-sm text-green-400">{saveMessage}</span>
            )}
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
