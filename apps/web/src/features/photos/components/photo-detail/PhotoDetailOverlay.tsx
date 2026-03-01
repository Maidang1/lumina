import React from "react";
import { motion } from "motion/react";

interface PhotoDetailOverlayProps {
  thumbnailUrl: string;
  isClosing: boolean;
}

const PhotoDetailOverlay: React.FC<PhotoDetailOverlayProps> = ({
  thumbnailUrl,
  isClosing,
}) => {
  return (
    <motion.div
      className="fixed inset-0 z-0 will-change-[opacity]"
      initial={{ opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/* Dark base */}
      <div className="absolute inset-0 bg-black/95" />

      {/* Ambient glow — use blur-xl (20px) instead of blur-3xl (72px) for ~12x cheaper GPU cost */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30 blur-xl"
        style={{
          backgroundImage: `url(${thumbnailUrl})`,
        }}
      />
      <div className="absolute inset-0 bg-black/30" />
    </motion.div>
  );
};

export default PhotoDetailOverlay;
