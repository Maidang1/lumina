import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: ["←"], description: "Previous photo" },
  { keys: ["→"], description: "Next photo" },
  { keys: ["Esc"], description: "Close detail view" },
  { keys: ["?"], description: "Toggle this help" },
];

const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  open,
  onClose,
}) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            className="relative z-10 w-80 rounded-2xl border border-white/10 bg-neutral-900/95 p-6 shadow-2xl backdrop-blur-md"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Keyboard Shortcuts
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3">
              {shortcuts.map((shortcut) => (
                <div
                  key={shortcut.description}
                  className="flex items-center justify-between"
                >
                  <span className="text-xs text-white/60">
                    {shortcut.description}
                  </span>
                  <div className="flex gap-1.5">
                    {shortcut.keys.map((key) => (
                      <kbd
                        key={key}
                        className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-md border border-white/15 bg-white/[0.06] px-2 text-[11px] font-medium text-white/80"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default KeyboardShortcutsHelp;
