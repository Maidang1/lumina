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
      className="fixed inset-0 z-0 bg-black/95"
      initial={{ opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 blur-3xl saturate-150"
        style={{
          backgroundImage: `url(${thumbnailUrl})`,
          transform: "scale(1.2)",
        }}
      />
      <div className="absolute inset-0 bg-black/20" />
    </motion.div>
  );
};

export default PhotoDetailOverlay;
