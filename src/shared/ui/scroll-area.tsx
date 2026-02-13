import React from "react";
import { cn } from "@/shared/lib/utils";

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  viewportClassName?: string;
}

const ScrollArea: React.FC<ScrollAreaProps> = ({
  className,
  viewportClassName,
  children,
  ...props
}) => (
  <div className={cn("relative overflow-hidden", className)} {...props}>
    <div className={cn("h-full w-full overflow-auto no-scrollbar", viewportClassName)}>
      {children}
    </div>
  </div>
);

export { ScrollArea };
