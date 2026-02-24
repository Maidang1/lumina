import { invoke } from '@tauri-apps/api/core';

export async function showNotification(
  title: string,
  body: string
): Promise<void> {
  await invoke('show_notification', { title, body });
}

export async function openInFinder(path: string): Promise<void> {
  await invoke('open_in_finder', { path });
}
