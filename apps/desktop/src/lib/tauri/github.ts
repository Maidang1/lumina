import { invoke } from '@tauri-apps/api/core';
import type { BatchFinalizeResult, ImageListResponse } from '@/types/photo';

interface GitHubUploadOptions {
  imageId: string;
  original: Uint8Array;
  originalMime: string;
  thumb: Uint8Array;
  thumbVariants: Record<string, Uint8Array>;
  metadata: string;
  deferFinalize?: boolean;
}

interface GitHubUploadStored {
  original_path: string;
  thumb_path: string;
  meta_path: string;
}

interface GitHubUploadResult {
  success: boolean;
  image_id: string;
  message?: string;
  stored: GitHubUploadStored;
}

interface GitHubDeleteResult {
  success: boolean;
  image_id: string;
  message?: string;
}

interface GitHubUploadResultRaw {
  success: boolean;
  image_id: string;
  message?: string;
  stored: GitHubUploadStored;
}

interface GitHubDeleteResultRaw {
  success: boolean;
  image_id: string;
  message?: string;
}

export async function uploadImageToGitHub(
  options: GitHubUploadOptions
): Promise<GitHubUploadResult> {
  const raw = await invoke<GitHubUploadResultRaw>('github_upload_image', {
    imageId: options.imageId,
    original: Array.from(options.original),
    originalMime: options.originalMime,
    thumb: Array.from(options.thumb),
    thumbVariants: Object.fromEntries(
      Object.entries(options.thumbVariants).map(([key, value]) => [
        key,
        Array.from(value),
      ])
    ),
    metadata: options.metadata,
    deferFinalize: options.deferFinalize ?? false,
  });

  return {
    success: raw.success,
    image_id: raw.image_id,
    message: raw.message,
    stored: raw.stored,
  };
}

export async function deleteImageFromGitHub(
  imageId: string
): Promise<GitHubDeleteResult> {
  const raw = await invoke<GitHubDeleteResultRaw>('github_delete_image', {
    imageId,
  });

  return {
    success: raw.success,
    image_id: raw.image_id,
    message: raw.message,
  };
}

export async function finalizeBatchToGitHub(
  metadatas: string[]
): Promise<BatchFinalizeResult> {
  return invoke<BatchFinalizeResult>('github_finalize_batch', {
    metadatas,
  });
}

export async function listImagesFromGitHub(
  cursor?: string,
  limit: number = 20
): Promise<ImageListResponse> {
  return invoke<ImageListResponse>('github_list_images', {
    cursor,
    limit,
  });
}
