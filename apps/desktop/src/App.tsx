import React from "react";
import { useAppStore } from "@/stores/appStore";
import { AppShell } from "@/layouts/AppShell";
import UploadWorkspace from "@/features/upload/components/UploadWorkspace";
import ManagePage from "@/features/manage/pages/ManagePage";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { ToastViewport } from "@/components/ui/toast";
import { pushToast } from "@/lib/toast";

function App(): React.ReactElement {
  const { currentView, setCurrentView } = useAppStore();

  return (
    <>
      <AppShell>
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
      </AppShell>

      <ToastViewport />
    </>
  );
}

export default App;
