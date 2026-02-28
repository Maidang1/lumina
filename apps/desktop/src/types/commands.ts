import type React from "react";

export type CommandGroup = "navigation" | "upload" | "photos" | "settings" | "general";

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  icon?: React.ReactNode;
  action: () => void;
  group: CommandGroup;
  keywords?: string[];
  disabled?: boolean;
}

export interface CommandSection {
  group: CommandGroup;
  label: string;
  commands: Command[];
}
