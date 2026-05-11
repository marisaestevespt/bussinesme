import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-2 border-primary shadow-md hover:shadow-lg hover:brightness-110 hover:-translate-y-[1px]",
        destructive: "bg-destructive text-destructive-foreground border-2 border-destructive shadow-md hover:shadow-lg hover:brightness-110 hover:-translate-y-[1px]",
        outline: "border-2 border-primary/55 bg-background text-primary hover:bg-primary/8 hover:border-primary hover:-translate-y-[1px]",
        secondary: "bg-secondary text-secondary-foreground border-2 border-primary/25 shadow-sm hover:bg-secondary/80 hover:border-primary/55 hover:shadow-md hover:-translate-y-[1px]",
        ghost: "border-2 border-transparent hover:bg-primary/8 hover:text-primary hover:border-primary/30",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-success text-success-foreground shadow-md hover:shadow-lg hover:brightness-110 hover:-translate-y-[1px]",
        warning: "bg-warning text-warning-foreground shadow-md hover:shadow-lg hover:brightness-110 hover:-translate-y-[1px]",
        info: "bg-info text-info-foreground shadow-md hover:shadow-lg hover:brightness-110 hover:-translate-y-[1px]",
        soft: "bg-primary/10 text-primary border-2 border-primary/20 hover:bg-primary/15 hover:border-primary/35 hover:-translate-y-[1px]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-3.5 text-xs",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
