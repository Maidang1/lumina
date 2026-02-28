import { motion, useScroll } from "motion/react";

import { cn } from "@/shared/lib/utils";

interface ScrollProgressProps {
  className?: string;
}

export function ScrollProgress({ className }: ScrollProgressProps): React.ReactElement {
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      className={cn(
        "fixed inset-x-0 top-0 z-50 h-px origin-left bg-gradient-to-r from-[#b48b2f] via-[#e3c46d] to-[#fff1c6]",
        className,
      )}
      style={{ scaleX: scrollYProgress }}
    />
  );
}
