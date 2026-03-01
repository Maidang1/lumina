import React from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/shared/ui/button";

interface PhotoDetailControlsProps {
  canPrev: boolean;
  canNext: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  isClosing?: boolean;
  delay?: number;
}

const PhotoDetailControls: React.FC<PhotoDetailControlsProps> = ({
  canPrev,
  canNext,
  onClose,
  onPrev,
  onNext,
  isClosing = false,
  delay = 0,
}) => {
  return (
    <>
      <motion.div
        className="relative z-[80]"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: isClosing ? 0 : 1, y: isClosing ? -8 : 0 }}
        transition={{ duration: 0.18, delay }}
      >
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onClose}
          disabled={isClosing}
          className="fixed top-6 left-6 z-[80] flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-black/40 text-white/70 backdrop-blur-sm will-change-transform transition-all duration-200 hover:bg-black/60 hover:text-white disabled:cursor-default disabled:opacity-70"
        >
          <X size={18} strokeWidth={1.5} />
        </Button>
      </motion.div>

      {canPrev && (
        <motion.button
          type="button"
          className="fixed top-1/2 left-4 z-40 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.08] bg-black/50 text-white/70 backdrop-blur-sm will-change-transform transition hover:border-white/[0.15] hover:text-white sm:left-6 sm:h-12 sm:w-12"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: isClosing ? 0 : 1, y: isClosing ? -8 : 0 }}
          transition={{ duration: 0.18, delay }}
          onClick={onPrev}
          aria-label="Previous photo"
          disabled={isClosing}
        >
          <ChevronLeft size={22} />
        </motion.button>
      )}

      {canNext && (
        <motion.button
          type="button"
          className="fixed top-1/2 right-4 z-40 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.08] bg-black/50 text-white/70 backdrop-blur-sm will-change-transform transition hover:border-white/[0.15] hover:text-white sm:h-12 sm:w-12 md:right-[calc(360px+24px)] lg:right-[calc(420px+24px)]"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: isClosing ? 0 : 1, y: isClosing ? -8 : 0 }}
          transition={{ duration: 0.18, delay }}
          onClick={onNext}
          aria-label="Next photo"
          disabled={isClosing}
        >
          <ChevronRight size={22} />
        </motion.button>
      )}
    </>
  );
};

export default PhotoDetailControls;
