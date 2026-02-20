import React from "react";
import { cn } from "@/shared/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline";
}

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-white text-black",
  secondary: "bg-[#2a2a2a] text-gray-300",
  outline: "border border-white/20 text-gray-300",
};

const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "default",
  ...props
}) => (
  <span
    className={cn(
      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
      variantClasses[variant],
      className,
    )}
    {...props}
  />
);

export { Badge };
