import { useMemo } from "react";
import type { Command, CommandSection } from "@/types/commands";
import { useNavigationCommands } from "../commands/navigationCommands";
import { useUploadCommands } from "../commands/uploadCommands";
import { usePhotoCommands } from "../commands/photoCommands";
import { useSettingsCommands } from "../commands/settingsCommands";

interface UseCommandsOptions {
  onSelectFiles?: () => void;
  onSelectFolder?: () => void;
  onSyncRepo?: () => void;
  onCommitPush?: () => void;
  onBatchDelete?: () => void;
  onBatchDownload?: () => void;
}

interface UseCommandsResult {
  commands: Command[];
  sections: CommandSection[];
  executeCommand: (id: string) => void;
}

const GROUP_LABELS: Record<string, string> = {
  navigation: "导航",
  upload: "上传",
  photos: "照片",
  settings: "设置",
  general: "通用",
};

export function useCommands(options: UseCommandsOptions = {}): UseCommandsResult {
  const navigationCommands = useNavigationCommands();
  const uploadCommands = useUploadCommands({
    onSelectFiles: options.onSelectFiles,
    onSelectFolder: options.onSelectFolder,
    onSyncRepo: options.onSyncRepo,
    onCommitPush: options.onCommitPush,
  });
  const photoCommands = usePhotoCommands({
    onBatchDelete: options.onBatchDelete,
    onBatchDownload: options.onBatchDownload,
  });
  const settingsCommands = useSettingsCommands();

  const commands = useMemo(() => {
    return [...navigationCommands, ...uploadCommands, ...photoCommands, ...settingsCommands];
  }, [navigationCommands, uploadCommands, photoCommands, settingsCommands]);

  const sections = useMemo(() => {
    const grouped = commands.reduce(
      (acc, cmd) => {
        if (!acc[cmd.group]) {
          acc[cmd.group] = [];
        }
        acc[cmd.group].push(cmd);
        return acc;
      },
      {} as Record<string, Command[]>,
    );

    return Object.entries(grouped).map(([group, cmds]) => ({
      group: group as Command["group"],
      label: GROUP_LABELS[group] || group,
      commands: cmds,
    }));
  }, [commands]);

  const executeCommand = (id: string) => {
    const command = commands.find((c) => c.id === id);
    if (command && !command.disabled) {
      command.action();
    }
  };

  return { commands, sections, executeCommand };
}
