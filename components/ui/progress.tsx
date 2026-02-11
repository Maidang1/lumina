import React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  indicatorClassName?: string;
}

const Progress: React.FC<ProgressProps> = ({
  value,
  className,
  indicatorClassName,
  ...props
}) => (
  <div
    className={cn("h-1.5 w-full overflow-hidden rounded-full bg-gray-800", className)}
    {...props}
  >
    <div
      className={cn("h-full bg-blue-500 transition-all duration-300", indicatorClassName)}
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);

export { Progress };
