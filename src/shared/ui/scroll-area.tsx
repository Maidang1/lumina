import React from "react";
import { cn } from "@/shared/lib/utils";

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  viewportClassName?: string;
  hideScrollbar?: boolean;
}

const ScrollArea: React.FC<ScrollAreaProps> = ({
  className,
  viewportClassName,
  hideScrollbar = false,
  children,
  ...props
}) => (
  <div
    className={cn(
      "relative overflow-auto",
      hideScrollbar && "no-scrollbar",
      className,
      viewportClassName,
    )}
    {...props}
  >
    {children}
  </div>
);

export { ScrollArea };
