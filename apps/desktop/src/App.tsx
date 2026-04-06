import React from "react";
import { useAppStore } from "@/stores/appStore";
import { AppShell } from "@/layouts/AppShell";
import UploadWorkspace from "@/features/upload/components/UploadWorkspace";
import ManagePage from "@/features/manage/pages/ManagePage";
import MetadataPage from "@/features/metadata/pages/MetadataPage";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { ToastViewport } from "@/components/ui/toast";
import { pushToast } from "@/lib/toast";
import { motion, AnimatePresence } from "motion/react";

function App(): React.ReactElement {
  const { currentView, setCurrentView } = useAppStore();

  return (
    <>
      <AppShell>
        <AnimatePresence mode="wait">
          {currentView === "upload" && (
            <motion.section
              key="upload"
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="h-full w-full"
            >
              <UploadWorkspace
                onUploadCompleted={(count) => {
                  pushToast(`上传完成：${count} 张照片`, "success");
                }}
                onNavigateToSettings={() => setCurrentView("settings")}
              />
            </motion.section>
          )}

          {currentView === "manage" && (
            <motion.section
              key="manage"
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="h-full w-full"
            >
              <ManagePage />
            </motion.section>
          )}

          {currentView === "metadata" && (
            <motion.section
              key="metadata"
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="h-full w-full"
            >
              <MetadataPage />
            </motion.section>
          )}

          {currentView === "settings" && (
            <motion.section
              key="settings"
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="h-full w-full"
            >
              <SettingsPage />
            </motion.section>
          )}
        </AnimatePresence>
      </AppShell>

      <ToastViewport />
    </>
  );
}

export default App;
