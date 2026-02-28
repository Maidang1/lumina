import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, ChevronDown } from "lucide-react";
import type { Photo } from "@/features/photos/types";

interface HeroSectionProps {
  featuredPhotos: Photo[];
}

const HeroSection: React.FC<HeroSectionProps> = ({ featuredPhotos }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (featuredPhotos.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredPhotos.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [featuredPhotos.length, isPaused]);

  const currentPhoto = featuredPhotos[currentIndex];

  return (
    <section
      className="relative h-screen w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="wait">
        {currentPhoto && (
          <motion.div
            key={currentPhoto.id}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <img
              src={currentPhoto.url}
              alt={currentPhoto.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/40" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-center"
        >
          <h1 className="font-display text-6xl tracking-tight text-white sm:text-7xl md:text-8xl lg:text-9xl">
            Lumina
          </h1>
          <p className="mt-4 font-mono text-sm tracking-[0.3em] text-white/60 uppercase sm:text-base">
            Photography Portfolio
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-12"
        >
          <Link
            to="/gallery"
            className="group flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-8 py-4 text-sm font-medium text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/20"
          >
            Enter Gallery
            <ArrowRight
              size={18}
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>
        </motion.div>
      </div>

      {featuredPhotos.length > 1 && (
        <div className="absolute bottom-32 left-1/2 flex -translate-x-1/2 gap-2">
          {featuredPhotos.slice(0, 5).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentIndex
                  ? "w-8 bg-white"
                  : "w-1.5 bg-white/40 hover:bg-white/60"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <ChevronDown
          size={24}
          className="animate-bounce text-white/50"
        />
      </motion.div>
    </section>
  );
};

export default HeroSection;
