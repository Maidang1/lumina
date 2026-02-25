import React, { useCallback, useEffect, useState } from 'react';
import { Sidebar, View } from '@/components/Sidebar';
import UploadWorkspace from '@/features/upload/components/UploadWorkspace';
import ManagePage from '@/features/manage/pages/ManagePage';
import { SettingsPage } from '@/features/settings/pages/SettingsPage';
import { uploadService } from '@/services/uploadService';

function App(): React.ReactElement {
  const [currentView, setCurrentView] = useState<View>('upload');
  const [isRepoReady, setIsRepoReady] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshRepoReady = useCallback(async (): Promise<boolean> => {
    const ready = await uploadService.hasUploadToken();
    setIsRepoReady(ready);
    return ready;
  }, []);

  useEffect(() => {
    void refreshRepoReady();
    const onFocus = () => void refreshRepoReady();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
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
        console.error('Auto sync failed:', error);
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
      window.alert(message);
      const ready = await uploadService.hasUploadToken();
      setIsRepoReady(ready);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Commit & Push failed');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleSyncRepo = async (): Promise<void> => {
    setIsSyncing(true);
    try {
      const message = await uploadService.syncRepo();
      window.alert(message);
      await refreshRepoReady();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-50">
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

      <main className="flex-1 overflow-auto">
        {currentView === 'upload' && (
          <div className="p-8">
            <div className="max-w-6xl mx-auto">
              <header className="mb-8">
                <h1 className="text-3xl font-bold">照片上传</h1>
                <p className="text-zinc-400 mt-2">上传会写入本地 Git 工作区，不会自动提交；请手动执行 Commit & Push</p>
              </header>

              <UploadWorkspace
                onUploadCompleted={(count) => {
                  console.log(`上传完成：${count} 张照片`);
                }}
              />
            </div>
          </div>
        )}

        {currentView === 'manage' && <ManagePage />}

        {currentView === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}

export default App;
