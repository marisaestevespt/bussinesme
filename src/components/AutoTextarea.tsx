import * as React from "react";
import { cn } from "@/lib/utils";

export interface AutoTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const AutoTextarea = React.forwardRef<HTMLTextAreaElement, AutoTextareaProps>(({ className, ...props }, ref) => {
  const innerRef = React.useRef<HTMLTextAreaElement>(null);
  React.useImperativeHandle(ref, () => innerRef.current!);

  React.useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [props.value, props.defaultValue]);

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
    props.onInput?.(e);
  };

  return (
    <textarea
      ref={innerRef}
      className={cn(
        "flex w-full rounded-sm border-2 border-primary/25 bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground hover:border-primary/45 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden",
        className,
      )}
      rows={1}
      onInput={handleInput}
      {...props}
    />
  );
});
AutoTextarea.displayName = "AutoTextarea";

export { AutoTextarea };
