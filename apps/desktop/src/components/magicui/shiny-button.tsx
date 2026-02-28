import { forwardRef, type ButtonHTMLAttributes } from "react";
import { motion, type MotionProps } from "motion/react";

import { cn } from "@/lib/utils";

const animationProps: MotionProps = {
  initial: { "--x": "100%", scale: 0.8 },
  animate: { "--x": "-100%", scale: 1 },
  whileTap: { scale: 0.95 },
  transition: {
    repeat: Infinity,
    repeatType: "loop",
    repeatDelay: 1,
    type: "spring",
    stiffness: 20,
    damping: 15,
    mass: 2,
    scale: {
      type: "spring",
      stiffness: 200,
      damping: 5,
      mass: 0.5,
    },
  },
};

interface ShinyButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof MotionProps>,
    MotionProps {
  children: React.ReactNode;
  className?: string;
}

export const ShinyButton = forwardRef<HTMLButtonElement, ShinyButtonProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        className={cn(
          "relative cursor-pointer rounded-lg border border-white/15 px-4 py-2 text-sm font-medium transition-shadow duration-300 hover:shadow-[0_0_20px_rgba(212,175,55,0.2)]",
          className,
        )}
        {...animationProps}
        {...props}
      >
        <span
          className="relative block size-full tracking-wide text-white/90 uppercase"
          style={{
            maskImage:
              "linear-gradient(-75deg,var(--lumina-accent) calc(var(--x) + 20%),transparent calc(var(--x) + 30%),var(--lumina-accent) calc(var(--x) + 100%))",
          }}
        >
          {children}
        </span>
      </motion.button>
    );
  },
);

ShinyButton.displayName = "ShinyButton";
