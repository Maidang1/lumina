import React from "react";
import { animated, SpringValue } from "@react-spring/web";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/shared/ui/button";

interface PhotoDetailControlsProps {
  canPrev: boolean;
  canNext: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  overlayOpacity: SpringValue<number>;
  controlsTransform: SpringValue<string>;
}

const PhotoDetailControls: React.FC<PhotoDetailControlsProps> = ({
  canPrev,
  canNext,
  onClose,
  onPrev,
  onNext,
  overlayOpacity,
  controlsTransform,
}) => {
  return (
    <>
      <animated.div style={{ opacity: overlayOpacity, transform: controlsTransform }}>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onClose}
          className="fixed left-6 top-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-black/20 text-white/70 backdrop-blur-md transition-all duration-200 hover:bg-black/40 hover:text-white"
        >
          <X size={18} strokeWidth={1.5} />
        </Button>
      </animated.div>

      {canPrev && (
        <animated.button
          type="button"
          className="fixed left-6 top-1/2 z-40 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.08] bg-black/40 text-white/70 backdrop-blur-xl transition hover:border-white/[0.15] hover:text-white"
          style={{ opacity: overlayOpacity, transform: controlsTransform }}
          onClick={onPrev}
          aria-label="Previous photo"
        >
          <ChevronLeft size={22} />
        </animated.button>
      )}

      {canNext && (
        <animated.button
          type="button"
          className="fixed right-[calc(340px+24px)] top-1/2 z-40 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.08] bg-black/40 text-white/70 backdrop-blur-xl transition hover:border-white/[0.15] hover:text-white md:flex lg:right-[calc(360px+24px)] xl:right-[calc(420px+24px)]"
          style={{ opacity: overlayOpacity, transform: controlsTransform }}
          onClick={onNext}
          aria-label="Next photo"
        >
          <ChevronRight size={22} />
        </animated.button>
      )}
    </>
  );
};

export default PhotoDetailControls;
