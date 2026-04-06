export type View = "upload" | "manage" | "metadata" | "settings";

export interface RepoStatus {
  configured: boolean;
  repo_path: string;
  branch: string;
  origin_url: string;
  owner: string;
  repo: string;
  dirty_files: number;
}

export interface UploadProgress {
  total: number;
  completed: number;
  failed?: number;
  currentFileName?: string;
  currentSpeed?: number;
  eta?: number;
}
