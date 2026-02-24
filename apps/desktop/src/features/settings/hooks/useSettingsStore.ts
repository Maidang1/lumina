import { useCallback, useEffect, useState } from 'react';
import { uploadService } from '@/services/uploadService';
import { tauriStorage } from '@/lib/tauri/storage';

interface SettingsState {
  uploadToken: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  concurrency: number;
}

interface UseSettingsStoreResult extends SettingsState {
  isLoading: boolean;
  updateUploadToken: (token: string) => Promise<void>;
  updateGithubOwner: (owner: string) => Promise<void>;
  updateGithubRepo: (repo: string) => Promise<void>;
  updateGithubBranch: (branch: string) => Promise<void>;
  updateConcurrency: (concurrency: number) => Promise<void>;
  saveAll: () => Promise<void>;
}

const STORAGE_KEYS = {
  GITHUB_OWNER: 'lumina.github_owner',
  GITHUB_REPO: 'lumina.github_repo',
  GITHUB_BRANCH: 'lumina.github_branch',
  CONCURRENCY: 'lumina.concurrency',
};

export function useSettingsStore(): UseSettingsStoreResult {
  const [isLoading, setIsLoading] = useState(true);
  const [uploadToken, setUploadToken] = useState('');
  const [githubOwner, setGithubOwner] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [githubBranch, setGithubBranch] = useState('main');
  const [concurrency, setConcurrency] = useState(3);

  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        const [token, owner, repo, branch, concurrencyStr] = await Promise.all([
          uploadService.getUploadToken(),
          tauriStorage.getItem(STORAGE_KEYS.GITHUB_OWNER),
          tauriStorage.getItem(STORAGE_KEYS.GITHUB_REPO),
          tauriStorage.getItem(STORAGE_KEYS.GITHUB_BRANCH),
          tauriStorage.getItem(STORAGE_KEYS.CONCURRENCY),
        ]);

        setUploadToken(token || '');
        setGithubOwner(owner || '');
        setGithubRepo(repo || '');
        setGithubBranch(branch || 'main');
        setConcurrency(concurrencyStr ? parseInt(concurrencyStr, 10) : 3);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSettings();
  }, []);

  const updateUploadToken = useCallback(async (token: string): Promise<void> => {
    setUploadToken(token);
    await uploadService.setUploadToken(token);
  }, []);

  const updateGithubOwner = useCallback(async (owner: string): Promise<void> => {
    setGithubOwner(owner);
    await tauriStorage.setItem(STORAGE_KEYS.GITHUB_OWNER, owner);
  }, []);

  const updateGithubRepo = useCallback(async (repo: string): Promise<void> => {
    setGithubRepo(repo);
    await tauriStorage.setItem(STORAGE_KEYS.GITHUB_REPO, repo);
  }, []);

  const updateGithubBranch = useCallback(async (branch: string): Promise<void> => {
    setGithubBranch(branch);
    await tauriStorage.setItem(STORAGE_KEYS.GITHUB_BRANCH, branch);
  }, []);

  const updateConcurrency = useCallback(async (value: number): Promise<void> => {
    setConcurrency(value);
    await tauriStorage.setItem(STORAGE_KEYS.CONCURRENCY, String(value));
  }, []);

  const saveAll = useCallback(async (): Promise<void> => {
    await Promise.all([
      uploadService.setUploadToken(uploadToken),
      tauriStorage.setItem(STORAGE_KEYS.GITHUB_OWNER, githubOwner),
      tauriStorage.setItem(STORAGE_KEYS.GITHUB_REPO, githubRepo),
      tauriStorage.setItem(STORAGE_KEYS.GITHUB_BRANCH, githubBranch),
      tauriStorage.setItem(STORAGE_KEYS.CONCURRENCY, String(concurrency)),
    ]);
  }, [uploadToken, githubOwner, githubRepo, githubBranch, concurrency]);

  return {
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
    saveAll,
  };
}
