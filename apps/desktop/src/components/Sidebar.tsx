import React from 'react';
import { Upload, FolderOpen, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export type View = 'upload' | 'manage' | 'settings';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  onCommitPush: () => void;
  onSyncRepo: () => void;
  commitDisabled?: boolean;
  commitLoading?: boolean;
  syncDisabled?: boolean;
  syncLoading?: boolean;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  view: View;
  isActive: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, isActive, onClick }: NavItemProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full px-4 py-3 flex items-center gap-3 text-sm transition-colors',
        'border-l-2',
        isActive
          ? 'bg-zinc-800 border-zinc-400 text-zinc-50'
          : 'border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300'
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function Sidebar({
  currentView,
  onViewChange,
  onCommitPush,
  onSyncRepo,
  commitDisabled = false,
  commitLoading = false,
  syncDisabled = false,
  syncLoading = false,
}: SidebarProps): React.ReactElement {
  return (
    <aside className="w-48 bg-zinc-950 border-r border-zinc-800 flex flex-col">
      <div className="p-4 border-b border-zinc-800">
        <h1 className="text-lg font-semibold text-zinc-50">Lumina</h1>
      </div>

      <nav className="flex-1 py-2">
        <NavItem
          icon={<Upload size={18} />}
          label="上传"
          view="upload"
          isActive={currentView === 'upload'}
          onClick={() => onViewChange('upload')}
        />
        <NavItem
          icon={<FolderOpen size={18} />}
          label="管理"
          view="manage"
          isActive={currentView === 'manage'}
          onClick={() => onViewChange('manage')}
        />
        <NavItem
          icon={<Settings size={18} />}
          label="设置"
          view="settings"
          isActive={currentView === 'settings'}
          onClick={() => onViewChange('settings')}
        />
      </nav>
      <div className="p-3 border-t border-zinc-800">
        <button
          type="button"
          onClick={onSyncRepo}
          disabled={syncDisabled || syncLoading}
          className={cn(
            "mb-2 w-full rounded-md px-3 py-2 text-sm transition-colors",
            syncDisabled || syncLoading
              ? "bg-zinc-800 text-zinc-500"
              : "bg-zinc-700 text-white hover:bg-zinc-600"
          )}
        >
          {syncLoading ? "Syncing..." : "Sync Remote"}
        </button>
        <button
          type="button"
          onClick={onCommitPush}
          disabled={commitDisabled || commitLoading}
          className={cn(
            "w-full rounded-md px-3 py-2 text-sm transition-colors",
            commitDisabled || commitLoading
              ? "bg-zinc-800 text-zinc-500"
              : "bg-sky-600 text-white hover:bg-sky-500"
          )}
        >
          {commitLoading ? "Committing..." : "Commit & Push"}
        </button>
      </div>
    </aside>
  );
}
