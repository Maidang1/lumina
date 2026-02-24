import React from 'react';
import { Upload, FolderOpen, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export type View = 'upload' | 'manage' | 'settings';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
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

export function Sidebar({ currentView, onViewChange }: SidebarProps): React.ReactElement {
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
    </aside>
  );
}
