import * as React from "react";
import { cn } from "@/shared/lib/utils";

const Popover: React.FC<React.PropsWithChildren> = ({ children }) => (
  <>{children}</>
);

const PopoverTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, ...props }, ref) => (
  <button
    ref={ref}
    type={props.type ?? "button"}
    {...props}
  >
    {children}
  </button>
));
PopoverTrigger.displayName = "PopoverTrigger";

const PopoverAnchor = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ children, ...props }, ref) => (
  <div
    ref={ref}
    {...props}
  >
    {children}
  </div>
));
PopoverAnchor.displayName = "PopoverAnchor";

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "z-50 w-72 rounded-md border border-lumina-border bg-[#121212] p-4 text-lumina-text shadow-md outline-none",
      className,
    )}
    {...props}
  />
));
PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
