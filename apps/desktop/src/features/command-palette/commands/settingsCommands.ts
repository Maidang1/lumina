import { Sun, Moon, Monitor } from "lucide-react";
import React from "react";
import type { Command } from "@/types/commands";
import { useAppStore } from "@/stores/appStore";

export function useSettingsCommands(): Command[] {
  const { theme, setTheme } = useAppStore();

  return [
    {
      id: "settings-theme-toggle",
      label: theme === "dark" ? "切换到亮色模式" : "切换到暗色模式",
      icon: React.createElement(theme === "dark" ? Sun : Moon, { size: 16 }),
      action: () => setTheme(theme === "dark" ? "light" : "dark"),
      group: "settings",
      keywords: ["theme", "主题", "dark", "light", "暗色", "亮色", "模式"],
    },
    {
      id: "settings-theme-dark",
      label: "使用暗色模式",
      icon: React.createElement(Moon, { size: 16 }),
      action: () => setTheme("dark"),
      group: "settings",
      keywords: ["theme", "主题", "dark", "暗色"],
      disabled: theme === "dark",
    },
    {
      id: "settings-theme-light",
      label: "使用亮色模式",
      icon: React.createElement(Sun, { size: 16 }),
      action: () => setTheme("light"),
      group: "settings",
      keywords: ["theme", "主题", "light", "亮色"],
      disabled: theme === "light",
    },
  ];
}
