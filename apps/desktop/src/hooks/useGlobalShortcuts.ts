import { useHotkeys } from "react-hotkeys-hook";
import { useAppStore } from "@/stores/appStore";
import type { View } from "@/types/layout";

interface UseGlobalShortcutsOptions {
  onOpenCommandPalette?: () => void;
  onToggleGitSidebar?: () => void;
}

export function useGlobalShortcuts(options: UseGlobalShortcutsOptions = {}): void {
  const { setCurrentView, toggleSidebar, toggleGitSidebar } = useAppStore();
  const { onOpenCommandPalette, onToggleGitSidebar } = options;

  useHotkeys("meta+1", () => setCurrentView("upload"), {
    preventDefault: true,
    enableOnFormTags: false,
  });

  useHotkeys("meta+2", () => setCurrentView("manage"), {
    preventDefault: true,
    enableOnFormTags: false,
  });

  useHotkeys("meta+3", () => setCurrentView("settings"), {
    preventDefault: true,
    enableOnFormTags: false,
  });

  useHotkeys(
    "meta+k",
    () => {
      onOpenCommandPalette?.();
    },
    {
      preventDefault: true,
      enableOnFormTags: true,
    },
  );

  useHotkeys("meta+b", () => toggleSidebar(), {
    preventDefault: true,
    enableOnFormTags: false,
  });

  useHotkeys(
    "meta+shift+g",
    () => {
      onToggleGitSidebar?.() ?? toggleGitSidebar();
    },
    {
      preventDefault: true,
      enableOnFormTags: false,
    },
  );
}
