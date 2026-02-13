import React, { useState, useEffect, useRef } from 'react';
import { animated, to, useSpring } from '@react-spring/web';
import { Photo } from '@/features/photos/types';
import { Aperture, Timer, Disc } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/card';

interface PhotoCardProps {
  photo: Photo;
  index: number;
  onClick: (photo: Photo) => void;
}

function formatExifValue(value?: string | number): string {
  console.log("formatExifValue", value);
  if (!value) return '未知';
  const normalized = typeof value === 'string' ? value.trim() : value.toString();
  if (!normalized) return '未知';
  if (normalized === '?' || normalized === '0') return '未知';
  const lower = normalized.toLowerCase();
  if (lower === 'unknown' || lower.includes('?')) return '未知';
  return normalized;
}

const PhotoCard: React.FC<PhotoCardProps> = ({ photo, index, onClick }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const enterSpring = useSpring({
    from: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 20,
      scale: prefersReducedMotion ? 1 : 0.985,
    },
    to: {
      opacity: isVisible ? 1 : 0,
      y: isVisible ? 0 : prefersReducedMotion ? 0 : 8,
      scale: isVisible ? 1 : prefersReducedMotion ? 1 : 0.985,
    },
    delay: prefersReducedMotion ? 0 : Math.min(index, 24) * 35,
    config: { tension: 240, friction: prefersReducedMotion ? 35 : 24 },
  });

  const hoverSpring = useSpring({
    to: {
      scale: isHovered && !prefersReducedMotion ? 1.012 : 1,
      overlayOpacity: isHovered ? 1 : 0,
      overlayY: isHovered && !prefersReducedMotion ? 0 : 10,
    },
    config: { tension: 320, friction: prefersReducedMotion ? 35 : 26 },
  });

  const imageSpring = useSpring({
    opacity: isLoaded ? 1 : 0,
    config: { tension: 210, friction: prefersReducedMotion ? 35 : 24 },
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (event: MediaQueryListEvent): void => {
      setPrefersReducedMotion(event.matches);
    };
    setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleMotionChange);
    return () => mediaQuery.removeEventListener('change', handleMotionChange);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // When the element enters the viewport (or is close to it)
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Stop observing once visible
        }
      },
      {
        rootMargin: '200px', // Start loading 200px before the element appears on screen
      },
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <animated.div
      ref={cardRef}
      className='group relative mb-2 break-inside-avoid cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-[#17171c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 md:mb-3'
      role='button'
      tabIndex={0}
      aria-label={`查看图片 ${photo.title}`}
      onClick={() => onClick(photo)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick(photo);
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      // Reserve space based on image aspect ratio to prevent layout shift
      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
    >
      <animated.div
        className='h-full w-full'
        style={{
          opacity: enterSpring.opacity,
          transform: to(
            [enterSpring.y, hoverSpring.scale],
            (y, scale) => `translate3d(0, ${y}px, 0) scale(${scale})`,
          ),
        }}
      >
        {isVisible && (
          <animated.img
            src={photo.thumbnail}
            alt={photo.title}
            className='h-full w-full object-cover'
            style={{ opacity: imageSpring.opacity }}
            onLoad={() => setIsLoaded(true)}
          />
        )}
      </animated.div>

      {/* Dark placeholder with pulse effect while loading */}
      {!isLoaded && (
        <div className='absolute inset-0 bg-[#1a1a1a] animate-pulse' />
      )}

      {/* Hover Overlay - Replicating the screenshot style */}
      <animated.div
        className='absolute inset-0 hidden flex-col justify-end bg-gradient-to-t from-black/90 via-black/45 to-transparent p-5 md:flex lg:p-6'
        style={{
          opacity: hoverSpring.overlayOpacity,
          transform: hoverSpring.overlayY.to(
            (y) => `translate3d(0, ${y}px, 0)`,
          ),
        }}
      >
        {/* Filename */}
        <h3 className='text-white font-bold text-2xl tracking-tight mb-1 font-sans'>
          {photo.filename}
        </h3>

        {/* Tech Specs Line */}
        <p className='text-gray-300 text-sm font-medium mb-3 opacity-90'>
          {photo.format} <span className='mx-1'>•</span> {photo.width} ×{' '}
          {photo.height} <span className='mx-1'>•</span> {photo.size}
        </p>

        {/* EXIF Data Grid */}
        <div className='grid grid-cols-2 gap-2'>
          {/* Focal Length */}
          <Card className='border-white/5 bg-[#2a2a2a]/80 backdrop-blur-sm'>
            <CardContent className='flex h-12 items-center gap-3 px-3 py-0'>
              <div className='flex h-6 w-6 items-center justify-center text-white'>
                <Disc size={18} />
              </div>
              <span className='flex items-center text-sm font-medium leading-none text-white'>
                {formatExifValue(photo.exif.focalLength)}
              </span>
            </CardContent>
          </Card>

          {/* Aperture */}
          <Card className='border-white/5 bg-[#2a2a2a]/80 backdrop-blur-sm'>
            <CardContent className='flex h-12 items-center gap-3 px-3 py-0'>
              <div className='flex h-6 w-6 items-center justify-center text-white'>
                <Aperture size={18} />
              </div>
              <span className='flex items-center text-sm font-medium leading-none text-white'>
                {formatExifValue(photo.exif.aperture)}
              </span>
            </CardContent>
          </Card>

          {/* Shutter Speed */}
          <Card className='border-white/5 bg-[#2a2a2a]/80 backdrop-blur-sm'>
            <CardContent className='flex h-12 items-center gap-3 px-3 py-0'>
              <div className='flex h-6 w-6 items-center justify-center text-white'>
                <Timer size={18} />
              </div>
              <span className='flex items-center text-sm font-medium leading-none text-white'>
                {formatExifValue(photo.exif.shutter)}
              </span>
            </CardContent>
          </Card>

          {/* ISO */}
          <Card className='border-white/5 bg-[#2a2a2a]/80 backdrop-blur-sm'>
            <CardContent className='flex h-12 items-center gap-3 px-3 py-0'>
              <div className='flex h-6 w-6 items-center justify-center rounded-[4px] border border-white text-[10px] font-bold leading-none text-white'>
                ISO
              </div>
              <span className='flex items-center text-sm font-medium leading-none text-white'>
                {formatExifValue(photo.exif.iso)}
              </span>
            </CardContent>
          </Card>
        </div>
      </animated.div>

      <div className='absolute inset-x-0 bottom-0 block bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-3 pt-8 md:hidden'>
        <div className='flex items-center justify-between gap-2'>
          <p className='truncate text-sm font-semibold text-white'>
            {photo.filename ?? "--"}
          </p>
        </div>
        <p className='mt-1 truncate text-[11px] text-gray-300'>
          {formatExifValue(photo.exif.aperture)} •{' '}
          {formatExifValue(photo.exif.shutter)} • ISO{' '}
          {formatExifValue(photo.exif.iso)}
        </p>
      </div>
    </animated.div>
  );
};

export default PhotoCard;
