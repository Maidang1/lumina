import React from "react";
import { cn } from "@/shared/lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

const Card: React.FC<DivProps> = ({ className, ...props }) => (
  <div
    className={cn(
      "rounded-lg border border-lumina-border bg-lumina-surface text-lumina-text-secondary shadow-sm",
      className,
    )}
    {...props}
  />
);

const CardHeader: React.FC<DivProps> = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5 p-4", className)} {...props} />
);

const CardTitle: React.FC<DivProps> = ({ className, ...props }) => (
  <div className={cn("text-base font-semibold text-lumina-text", className)} {...props} />
);

const CardContent: React.FC<DivProps> = ({ className, ...props }) => (
  <div className={cn("p-4 pt-0", className)} {...props} />
);

const CardFooter: React.FC<DivProps> = ({ className, ...props }) => (
  <div className={cn("flex items-center p-4 pt-0", className)} {...props} />
);

export { Card, CardHeader, CardTitle, CardContent, CardFooter };
