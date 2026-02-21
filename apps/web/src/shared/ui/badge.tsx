import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/shared/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-white/40",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-lumina-accent text-black hover:bg-lumina-accent/90",
        secondary:
          "border-transparent bg-white/10 text-lumina-text hover:bg-white/20",
        destructive:
          "border-transparent bg-red-500/90 text-zinc-50 hover:bg-red-500",
        outline: "border-lumina-border text-lumina-text-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
