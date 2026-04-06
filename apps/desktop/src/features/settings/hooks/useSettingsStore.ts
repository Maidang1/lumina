import { useCallback, useEffect, useState } from 'react';
import { tauriStorage } from '@/lib/tauri/storage';
import { getRepoStatus } from '@/lib/tauri/github';
import { UploadParseProfile } from '@/types/photo';

interface SettingsState {
  repoPath: string;
  concurrency: number;
  parseProfile: UploadParseProfile;
}

interface UseSettingsStoreResult extends SettingsState {
  isLoading: boolean;
  repoStatusMessage: string;
  isRepoReady: boolean;
  updateConcurrency: (concurrency: number) => Promise<void>;
  updateParseProfile: (profile: UploadParseProfile) => Promise<void>;
  refreshRepoStatus: () => Promise<void>;
  saveAll: () => Promise<void>;
}

const STORAGE_KEYS = {
  REPO_PATH: 'lumina.git_repo_path',
  CONCURRENCY: 'lumina.concurrency',
  PARSE_PROFILE: 'lumina.parse_profile',
};

export function useSettingsStore(): UseSettingsStoreResult {
  const [isLoading, setIsLoading] = useState(true);
  const [repoPath, setRepoPath] = useState('');
  const [concurrency, setConcurrency] = useState(3);
  const [parseProfile, setParseProfile] = useState<UploadParseProfile>('quality');
  const [repoStatusMessage, setRepoStatusMessage] = useState('未连接仓库');
  const [isRepoReady, setIsRepoReady] = useState(false);

  const refreshRepoStatus = useCallback(async (): Promise<void> => {
    try {
      const status = await getRepoStatus();
      setRepoPath(status.repo_path);
      setIsRepoReady(true);
      setRepoStatusMessage(
        `已连接: ${status.owner}/${status.repo}@${status.branch}，未提交变更 ${status.dirty_files} 项`
      );
    } catch (error) {
      setIsRepoReady(false);
      if (!repoPath.trim()) {
        setRepoStatusMessage('未连接仓库');
      } else {
        setRepoStatusMessage(
          error instanceof Error ? error.message : '仓库校验失败'
        );
      }
    }
  }, [repoPath]);

  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        const [savedRepoPath, concurrencyStr, savedParseProfile] = await Promise.all([
          tauriStorage.getItem(STORAGE_KEYS.REPO_PATH),
          tauriStorage.getItem(STORAGE_KEYS.CONCURRENCY),
          tauriStorage.getItem(STORAGE_KEYS.PARSE_PROFILE),
        ]);

        setRepoPath(savedRepoPath || '');
        setConcurrency(concurrencyStr ? parseInt(concurrencyStr, 10) : 3);
        if (savedParseProfile === 'quality' || savedParseProfile === 'turbo') {
          setParseProfile(savedParseProfile);
        }
      } finally {
        setIsLoading(false);
      }
    };

    void loadSettings();
  }, []);

  useEffect(() => {
    void refreshRepoStatus();
  }, [refreshRepoStatus]);

  const updateConcurrency = useCallback(async (value: number): Promise<void> => {
    const normalized = Number.isFinite(value) ? Math.max(1, Math.min(10, value)) : 1;
    setConcurrency(normalized);
    await tauriStorage.setItem(STORAGE_KEYS.CONCURRENCY, String(normalized));
  }, []);

  const updateParseProfile = useCallback(async (profile: UploadParseProfile): Promise<void> => {
    setParseProfile(profile);
    await tauriStorage.setItem(STORAGE_KEYS.PARSE_PROFILE, profile);
  }, []);

  const saveAll = useCallback(async (): Promise<void> => {
    await Promise.all([
      tauriStorage.setItem(STORAGE_KEYS.CONCURRENCY, String(concurrency)),
      tauriStorage.setItem(STORAGE_KEYS.PARSE_PROFILE, parseProfile),
    ]);
  }, [concurrency, parseProfile]);

  return {
    isLoading,
    repoPath,
    concurrency,
    parseProfile,
    repoStatusMessage,
    isRepoReady,
    updateConcurrency,
    updateParseProfile,
    refreshRepoStatus,
    saveAll,
  };
}
