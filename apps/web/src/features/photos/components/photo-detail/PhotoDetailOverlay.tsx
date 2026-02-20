import React from "react";
import { animated, SpringValue } from "@react-spring/web";

interface PhotoDetailOverlayProps {
  thumbnailUrl: string;
  opacity: SpringValue<number>;
}

const PhotoDetailOverlay: React.FC<PhotoDetailOverlayProps> = ({ thumbnailUrl, opacity }) => {
  return (
    <animated.div className="fixed inset-0 z-0 bg-black/95" style={{ opacity }}>
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 blur-3xl saturate-150"
        style={{
          backgroundImage: `url(${thumbnailUrl})`,
          transform: "scale(1.2)",
        }}
      />
      <div className="absolute inset-0 bg-black/20" />
    </animated.div>
  );
};

export default PhotoDetailOverlay;
