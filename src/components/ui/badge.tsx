import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-sm border px-2 py-0.5 font-typewriter text-[10px] uppercase tracking-[0.14em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
        secondary: "border-primary/25 bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20",
        outline: "text-foreground border-primary/40",
        success: "border-success/40 bg-success/10 text-success hover:bg-success/20",
        warning: "border-warning/40 bg-warning/10 text-warning hover:bg-warning/20",
        info: "border-info/40 bg-info/10 text-info hover:bg-info/20",
        violet: "border-accent-violet/40 bg-accent-violet/10 text-accent-violet hover:bg-accent-violet/20",
        muted: "border-muted-foreground/30 bg-muted text-muted-foreground hover:bg-muted/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
