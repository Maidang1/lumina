import { Store } from '@tauri-apps/plugin-store';

let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load('settings.json');
  }
  return store;
}

export const tauriStorage = {
  async getItem(key: string): Promise<string | null> {
    const s = await getStore();
    const value = await s.get<string>(key);
    return value ?? null;
  },

  async setItem(key: string, value: string): Promise<void> {
    const s = await getStore();
    await s.set(key, value);
    await s.save();
  },

  async removeItem(key: string): Promise<void> {
    const s = await getStore();
    await s.delete(key);
    await s.save();
  },

  async clear(): Promise<void> {
    const s = await getStore();
    await s.clear();
    await s.save();
  },
};
