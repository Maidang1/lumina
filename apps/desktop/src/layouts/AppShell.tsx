import React, { useCallback, useEffect, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { uploadService } from "@/services/uploadService";
import { pushToast } from "@/lib/toast";
import { logger } from "@/lib/logger";
import { getChangesPreview } from "@/lib/tauri/github";
import { deriveGitChanges } from "@/features/git";

import { Sidebar } from "./Sidebar";
import { HeaderBar } from "./HeaderBar";
import { StatusBar } from "./StatusBar";
import { DetailsPanel } from "./DetailsPanel";
import { CommandPalette } from "@/features/command-palette/CommandPalette";
import { GitSidebarPanel } from "@/features/git-sidebar";

interface AppShellProps {
  children: React.ReactNode;
  detailsContent?: React.ReactNode;
  detailsTitle?: string;
}

const VIEW_TITLES: Record<string, string> = {
  upload: "Upload",
  manage: "Library",
  metadata: "Metadata",
  settings: "Settings",
};

export function AppShell({
  children,
  detailsContent,
  detailsTitle,
}: AppShellProps): React.ReactElement {
  const {
    sidebarCollapsed,
    toggleSidebar,
    detailsPanelOpen,
    setDetailsPanelOpen,
    gitSidebarOpen,
    setGitSidebarOpen,
    toggleGitSidebar,
    currentView,
    setCurrentView,
    theme,
    setTheme,
    isRepoReady,
    setIsRepoReady,
    isSyncing,
    setIsSyncing,
    isCommitting,
    setIsCommitting,
    uploadProgress,
  } = useAppStore();

  const [repoHint, setRepoHint] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [changesCount, setChangesCount] = useState(0);

  useGlobalShortcuts({
    onOpenCommandPalette: () => setCommandPaletteOpen(true),
    onToggleGitSidebar: toggleGitSidebar,
  });

  const refreshChangesCount = useCallback(async (): Promise<void> => {
    try {
      const changes = await getChangesPreview();
      const derived = deriveGitChanges(changes);
      setChangesCount(derived.counts.total);
    } catch {
      setChangesCount(0);
    }
  }, []);

  const refreshRepoReady = useCallback(async (): Promise<boolean> => {
    const ready = await uploadService.hasRepoPath();
    setIsRepoReady(ready);
    if (ready) {
      try {
        const status = await uploadService.getRepoStatus();
        setRepoHint(`${status.owner}/${status.repo}@${status.branch}`);
        void refreshChangesCount();
      } catch {
        setRepoHint("");
      }
    } else {
      setRepoHint("");
    }
    return ready;
  }, [setIsRepoReady, refreshChangesCount]);

  useEffect(() => {
    void refreshRepoReady();
    const onFocus = () => void refreshRepoReady();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [currentView, refreshRepoReady]);

  useEffect(() => {
    const syncOnStartup = async (): Promise<void> => {
      const ready = await refreshRepoReady();
      if (!ready) return;

      setIsSyncing(true);
      try {
        await uploadService.syncRepo();
        await refreshRepoReady();
      } catch (error) {
        logger.error("Auto sync failed:", error);
      } finally {
        setIsSyncing(false);
      }
    };

    void syncOnStartup();
  }, [refreshRepoReady, setIsSyncing]);

  const handleCommitAndPush = async (message?: string): Promise<void> => {
    setIsCommitting(true);
    try {
      const result = await uploadService.commitAndPush(message);
      pushToast(result, "success");
      await refreshRepoReady();
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "Commit & Push failed",
        "error",
      );
    } finally {
      setIsCommitting(false);
    }
  };

  const handleSyncRepo = async (): Promise<void> => {
    setIsSyncing(true);
    try {
      const message = await uploadService.syncRepo();
      pushToast(message, "success");
      await refreshRepoReady();
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "Sync failed",
        "error",
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <div
      className={cn(
        "relative flex h-screen flex-col bg-[var(--lumina-bg)] text-[var(--lumina-text)] transition-colors duration-300",
        theme,
      )}
    >
      <div className="relative z-10 flex flex-1 overflow-hidden">
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          onSyncRepo={() => void handleSyncRepo()}
          onCommitPush={() => void handleCommitAndPush()}
          commitDisabled={!isRepoReady}
          commitLoading={isCommitting}
          syncDisabled={!isRepoReady}
          syncLoading={isSyncing}
          changesCount={changesCount}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <HeaderBar
            title={VIEW_TITLES[currentView] ?? "Lumina"}
            repoHint={repoHint}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            theme={theme}
            onToggleTheme={toggleTheme}
            onToggleGitSidebar={toggleGitSidebar}
            gitSidebarOpen={gitSidebarOpen}
            changesCount={changesCount}
          />

          <main className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-auto p-6">
              <div className="mx-auto max-w-7xl">{children}</div>
            </div>

            {detailsPanelOpen && detailsContent && (
              <DetailsPanel
                open={detailsPanelOpen}
                onClose={() => setDetailsPanelOpen(false)}
                title={detailsTitle}
              >
                {detailsContent}
              </DetailsPanel>
            )}

            <GitSidebarPanel
              open={gitSidebarOpen}
              onClose={() => setGitSidebarOpen(false)}
              onCommit={(message) => void handleCommitAndPush(message)}
              commitLoading={isCommitting}
              repoHint={repoHint}
            />
          </main>
        </div>
      </div>

      <StatusBar
        isRepoReady={isRepoReady}
        isSyncing={isSyncing}
        uploadProgress={uploadProgress}
      />

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onSyncRepo={() => void handleSyncRepo()}
        onCommitPush={() => void handleCommitAndPush()}
      />
    </div>
  );
}
