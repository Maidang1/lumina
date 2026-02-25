import { invoke } from '@tauri-apps/api/core';

interface FileInfo {
  path: string;
  size: number;
  modified: number;
  is_file: boolean;
}

async function readFileAsBytes(path: string): Promise<Uint8Array> {
  const bytes = await invoke<number[]>('read_file_as_bytes', { path });
  return new Uint8Array(bytes);
}

export async function getFileInfo(path: string): Promise<FileInfo> {
  return invoke<FileInfo>('get_file_info', { path });
}

async function scanDirectory(
  path: string,
  extensions: string[] = [],
  recursive: boolean = false
): Promise<string[]> {
  return invoke<string[]>('scan_directory', { path, extensions, recursive });
}

async function fileToBlob(path: string): Promise<File> {
  const bytes = await readFileAsBytes(path);
  const info = await getFileInfo(path);
  const name = path.split('/').pop() || 'unknown';

  return new File([bytes], name, {
    type: getMimeType(name),
    lastModified: info.modified * 1000,
  });
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}
