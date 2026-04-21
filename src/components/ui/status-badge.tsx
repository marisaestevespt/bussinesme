import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Unified semantic status badge.
 * Use this instead of manually styling badges with hardcoded color classes
 * (bg-green-100, text-amber-600, etc.) across the app.
 *
 * Tones map to design-system tokens (success / warning / destructive / info /
 * primary / muted) so they automatically respect light/dark mode and brand
 * theme changes.
 */
const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      tone: {
        success: "border-transparent bg-success/15 text-success",
        warning: "border-transparent bg-warning/15 text-warning",
        destructive: "border-transparent bg-destructive/15 text-destructive",
        info: "border-transparent bg-info/15 text-info",
        primary: "border-transparent bg-primary/15 text-primary",
        muted: "border-transparent bg-muted text-muted-foreground",
        outline: "border-border text-foreground",
      },
      size: {
        sm: "px-2 py-0 text-[10px]",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      tone: "muted",
      size: "md",
    },
  },
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  dot?: boolean;
}

export function StatusBadge({
  className,
  tone,
  size,
  dot = false,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ tone, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "success" && "bg-success",
            tone === "warning" && "bg-warning",
            tone === "destructive" && "bg-destructive",
            tone === "info" && "bg-info",
            tone === "primary" && "bg-primary",
            (tone === "muted" || tone === "outline" || !tone) && "bg-muted-foreground",
          )}
        />
      )}
      {children}
    </span>
  );
}

export { statusBadgeVariants };