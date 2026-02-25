import { useCallback, useEffect, useState } from 'react';
import { tauriStorage } from '@/lib/tauri/storage';
import { getRepoStatus } from '@/lib/tauri/github';

interface SettingsState {
  repoPath: string;
  concurrency: number;
}

interface UseSettingsStoreResult extends SettingsState {
  isLoading: boolean;
  repoStatusMessage: string;
  isRepoReady: boolean;
  updateRepoPath: (repoPath: string) => Promise<void>;
  updateConcurrency: (concurrency: number) => Promise<void>;
  refreshRepoStatus: (pathOverride?: string) => Promise<void>;
  saveAll: () => Promise<void>;
}

const STORAGE_KEYS = {
  REPO_PATH: 'lumina.git_repo_path',
  CONCURRENCY: 'lumina.concurrency',
};

export function useSettingsStore(): UseSettingsStoreResult {
  const [isLoading, setIsLoading] = useState(true);
  const [repoPath, setRepoPath] = useState('');
  const [concurrency, setConcurrency] = useState(3);
  const [repoStatusMessage, setRepoStatusMessage] = useState('未选择仓库');
  const [isRepoReady, setIsRepoReady] = useState(false);

  const refreshRepoStatus = useCallback(async (pathOverride?: string): Promise<void> => {
    const targetPath = (pathOverride ?? repoPath).trim();
    if (!targetPath) {
      setIsRepoReady(false);
      setRepoStatusMessage('未选择仓库');
      return;
    }

    try {
      const status = await getRepoStatus();
      setIsRepoReady(true);
      setRepoStatusMessage(
        `已连接: ${status.owner}/${status.repo}@${status.branch}，未提交变更 ${status.dirty_files} 项`
      );
    } catch (error) {
      setIsRepoReady(false);
      setRepoStatusMessage(
        error instanceof Error ? error.message : '仓库校验失败'
      );
    }
  }, [repoPath]);

  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        const [savedRepoPath, concurrencyStr] = await Promise.all([
          tauriStorage.getItem(STORAGE_KEYS.REPO_PATH),
          tauriStorage.getItem(STORAGE_KEYS.CONCURRENCY),
        ]);

        setRepoPath(savedRepoPath || '');
        setConcurrency(concurrencyStr ? parseInt(concurrencyStr, 10) : 3);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSettings();
  }, []);

  useEffect(() => {
    void refreshRepoStatus();
  }, [refreshRepoStatus]);

  const updateRepoPath = useCallback(async (path: string): Promise<void> => {
    setRepoPath(path);
    await tauriStorage.setItem(STORAGE_KEYS.REPO_PATH, path);
  }, []);

  const updateConcurrency = useCallback(async (value: number): Promise<void> => {
    const normalized = Number.isFinite(value) ? Math.max(1, Math.min(10, value)) : 1;
    setConcurrency(normalized);
    await tauriStorage.setItem(STORAGE_KEYS.CONCURRENCY, String(normalized));
  }, []);

  const saveAll = useCallback(async (): Promise<void> => {
    await Promise.all([
      tauriStorage.setItem(STORAGE_KEYS.REPO_PATH, repoPath),
      tauriStorage.setItem(STORAGE_KEYS.CONCURRENCY, String(concurrency)),
    ]);
  }, [repoPath, concurrency]);

  return {
    isLoading,
    repoPath,
    concurrency,
    repoStatusMessage,
    isRepoReady,
    updateRepoPath,
    updateConcurrency,
    refreshRepoStatus,
    saveAll,
  };
}
