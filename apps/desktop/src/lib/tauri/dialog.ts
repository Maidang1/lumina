import { open } from '@tauri-apps/plugin-dialog';

export interface FileSelection {
  path: string;
  name: string;
}

export async function selectFiles(): Promise<FileSelection[] | null> {
  const selected = await open({
    multiple: true,
    filters: [
      {
        name: 'Images',
        extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
      },
    ],
  });

  if (!selected) return null;

  const paths = Array.isArray(selected) ? selected : [selected];
  return paths.map((path) => ({
    path,
    name: path.split('/').pop() || path,
  }));
}

export async function selectDirectory(): Promise<string | null> {
  const selected = await open({
    directory: true,
  });

  return typeof selected === 'string' ? selected : null;
}
