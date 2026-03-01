import { invoke } from '@tauri-apps/api/core';

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  url: string;
}

export interface CloneProgress {
  stage: 'preparing' | 'cloning' | 'checking' | 'done' | 'error';
  message: string;
  percent?: number;
}

export interface CloneResult {
  success: boolean;
  repo_path: string;
  message?: string;
}

export async function parseGitHubUrl(url: string): Promise<GitHubRepoInfo> {
  return invoke<GitHubRepoInfo>('parse_github_url', { url });
}

export async function getDefaultCloneDirectory(
  owner: string,
  repo: string
): Promise<string> {
  return invoke<string>('get_default_clone_directory', { owner, repo });
}

export async function cloneGitHubRepo(
  url: string,
  targetDir?: string
): Promise<CloneResult> {
  return invoke<CloneResult>('github_clone_repo', { url, targetDir });
}

export function isGitHubUrl(input: string): boolean {
  const trimmed = input.trim();
  return (
    trimmed.startsWith('https://github.com/') ||
    trimmed.startsWith('git@github.com:') ||
    trimmed.startsWith('github.com/')
  );
}
