import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { View, RepoStatus, UploadProgress } from "@/types/layout";

interface AppState {
  sidebarCollapsed: boolean;
  detailsPanelOpen: boolean;
  gitSidebarOpen: boolean;
  currentView: View;
  theme: "dark" | "light";

  repoStatus: RepoStatus | null;
  isRepoReady: boolean;
  isSyncing: boolean;
  isCommitting: boolean;

  uploadProgress: UploadProgress | null;

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleDetailsPanel: () => void;
  setDetailsPanelOpen: (open: boolean) => void;
  toggleGitSidebar: () => void;
  setGitSidebarOpen: (open: boolean) => void;
  setCurrentView: (view: View) => void;
  setTheme: (theme: "dark" | "light") => void;
  setRepoStatus: (status: RepoStatus | null) => void;
  setIsRepoReady: (ready: boolean) => void;
  setIsSyncing: (syncing: boolean) => void;
  setIsCommitting: (committing: boolean) => void;
  setUploadProgress: (progress: UploadProgress | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      detailsPanelOpen: false,
      gitSidebarOpen: false,
      currentView: "upload",
      theme: "dark",

      repoStatus: null,
      isRepoReady: false,
      isSyncing: false,
      isCommitting: false,

      uploadProgress: null,

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleDetailsPanel: () =>
        set((state) => ({ detailsPanelOpen: !state.detailsPanelOpen })),
      setDetailsPanelOpen: (open) => set({ detailsPanelOpen: open }),
      toggleGitSidebar: () =>
        set((state) => ({ gitSidebarOpen: !state.gitSidebarOpen })),
      setGitSidebarOpen: (open) => set({ gitSidebarOpen: open }),
      setCurrentView: (view) => set({ currentView: view }),
      setTheme: (theme) => set({ theme }),
      setRepoStatus: (status) => set({ repoStatus: status }),
      setIsRepoReady: (ready) => set({ isRepoReady: ready }),
      setIsSyncing: (syncing) => set({ isSyncing: syncing }),
      setIsCommitting: (committing) => set({ isCommitting: committing }),
      setUploadProgress: (progress) => set({ uploadProgress: progress }),
    }),
    {
      name: "lumina-app-store",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        gitSidebarOpen: state.gitSidebarOpen,
        theme: state.theme,
      }),
    },
  ),
);
