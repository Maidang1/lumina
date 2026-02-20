import React from "react";
import { cn } from "@/shared/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default:
    "bg-lumina-accent text-black hover:bg-lumina-accent/90",
  outline:
    "border border-lumina-border bg-lumina-surface/60 text-lumina-text-secondary shadow-[0_10px_24px_rgba(0,0,0,0.25)] hover:bg-lumina-surface-elevated hover:text-lumina-text",
  ghost:
    "bg-transparent text-lumina-text-secondary hover:bg-lumina-surface/70 hover:text-lumina-text",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "h-9 px-4 py-2",
  sm: "h-8 rounded-md px-3 text-xs",
  icon: "h-9 w-9",
};

const Button: React.FC<ButtonProps> = ({
  className,
  variant = "default",
  size = "default",
  type = "button",
  ...props
}) => {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
};

export { Button };
