import React, { useState } from 'react';
import { Sidebar, View } from '@/components/Sidebar';
import UploadWorkspace from '@/features/upload/components/UploadWorkspace';
import ManagePage from '@/features/manage/pages/ManagePage';
import { SettingsPage } from '@/features/settings/pages/SettingsPage';

function App(): React.ReactElement {
  const [currentView, setCurrentView] = useState<View>('upload');

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-50">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />

      <main className="flex-1 overflow-auto">
        {currentView === 'upload' && (
          <div className="p-8">
            <div className="max-w-6xl mx-auto">
              <header className="mb-8">
                <h1 className="text-3xl font-bold">照片上传</h1>
                <p className="text-zinc-400 mt-2">批量上传照片到 GitHub 存储</p>
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
