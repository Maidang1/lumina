import React, { useCallback, useEffect, useState } from "react";
import { Sidebar, View } from "@/components/Sidebar";
import UploadWorkspace from "@/features/upload/components/UploadWorkspace";
import ManagePage from "@/features/manage/pages/ManagePage";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { uploadService } from "@/services/uploadService";
import { ToastViewport } from "@/components/ui/toast";
import { pushToast } from "@/lib/toast";
import { logger } from "@/lib/logger";
import { AnimatedGridPattern } from "@/components/magicui/animated-grid-pattern";

function App(): React.ReactElement {
  const [currentView, setCurrentView] = useState<View>("upload");
  const [isRepoReady, setIsRepoReady] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshRepoReady = useCallback(async (): Promise<boolean> => {
    const ready = await uploadService.hasRepoPath();
    setIsRepoReady(ready);
    return ready;
  }, []);

  useEffect(() => {
    void refreshRepoReady();
    const onFocus = () => void refreshRepoReady();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [currentView, refreshRepoReady]);

  useEffect(() => {
    const syncOnStartup = async (): Promise<void> => {
      const ready = await refreshRepoReady();
      if (!ready) {
        return;
      }
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
  }, [refreshRepoReady]);

  const handleCommitAndPush = async (): Promise<void> => {
    setIsCommitting(true);
    try {
      const message = await uploadService.commitAndPush();
      pushToast(message, "success");
      const ready = await uploadService.hasRepoPath();
      setIsRepoReady(ready);
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

  return (
    <div className="relative flex h-screen bg-lumina-bg text-zinc-50">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <AnimatedGridPattern numSquares={30} maxOpacity={0.35} duration={6} />
      </div>

      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onSyncRepo={() => void handleSyncRepo()}
        onCommitPush={() => void handleCommitAndPush()}
        commitDisabled={!isRepoReady}
        commitLoading={isCommitting}
        syncDisabled={!isRepoReady}
        syncLoading={isSyncing}
      />

      <main className="relative z-10 flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-7xl">
          <section
            className={currentView === "upload" ? "block" : "hidden"}
            aria-hidden={currentView !== "upload"}
          >
            <UploadWorkspace
              onUploadCompleted={(count) => {
                pushToast(`上传完成：${count} 张照片`, "success");
              }}
              onNavigateToSettings={() => setCurrentView("settings")}
            />
          </section>

          <section
            className={currentView === "manage" ? "block" : "hidden"}
            aria-hidden={currentView !== "manage"}
          >
            <ManagePage />
          </section>

          <section
            className={currentView === "settings" ? "block" : "hidden"}
            aria-hidden={currentView !== "settings"}
          >
            <SettingsPage />
          </section>
        </div>
      </main>

      <ToastViewport />
    </div>
  );
}

export default App;
