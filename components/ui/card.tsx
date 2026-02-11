import React from "react";
import { cn } from "@/lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

const Card: React.FC<DivProps> = ({ className, ...props }) => (
  <div
    className={cn(
      "rounded-lg border border-white/10 bg-[#1a1a1a] text-gray-200 shadow-sm",
      className,
    )}
    {...props}
  />
);

const CardHeader: React.FC<DivProps> = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5 p-4", className)} {...props} />
);

const CardTitle: React.FC<DivProps> = ({ className, ...props }) => (
  <div className={cn("text-base font-semibold text-white", className)} {...props} />
);

const CardContent: React.FC<DivProps> = ({ className, ...props }) => (
  <div className={cn("p-4 pt-0", className)} {...props} />
);

const CardFooter: React.FC<DivProps> = ({ className, ...props }) => (
  <div className={cn("flex items-center p-4 pt-0", className)} {...props} />
);

export { Card, CardHeader, CardTitle, CardContent, CardFooter };
