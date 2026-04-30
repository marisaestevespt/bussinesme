import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseIcon, type EntityIcon } from "./types";

interface Props {
  icon: EntityIcon | unknown;
  /** Tailwind size classes for the container (e.g. "h-8 w-8") */
  className?: string;
  /** Emoji font size (e.g. "text-2xl"). Auto-scales if omitted. */
  emojiClassName?: string;
  /** Container variant */
  variant?: "rounded" | "square" | "circle";
  fallback?: React.ReactNode;
}

export function EntityIconDisplay({
  icon,
  className,
  emojiClassName,
  variant = "rounded",
  fallback,
}: Props) {
  const parsed = parseIcon(icon);
  const radius =
    variant === "circle" ? "rounded-full" : variant === "square" ? "rounded-md" : "rounded-lg";

  if (!parsed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted/50 text-muted-foreground/60 shrink-0",
          radius,
          className,
        )}
      >
        {fallback ?? <ImageIcon className="h-1/2 w-1/2" />}
      </div>
    );
  }

  if (parsed.type === "emoji") {
    const isLyre = parsed.value === "🪉";

    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted/30 leading-none shrink-0 select-none",
          radius,
          className,
        )}
      >
        <span className={cn("inline-flex items-center justify-center", emojiClassName ?? "text-[1.6em]")}> 
          {isLyre ? (
            <svg viewBox="0 0 64 64" aria-hidden="true" className="h-[1em] w-[1em]" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c-4 7-6 15-6 23 0 11 8 19 18 19s18-8 18-19c0-8-2-16-6-23" />
              <path d="M20 10c6 5 18 5 24 0" />
              <path d="M26 16v32" />
              <path d="M32 17v35" />
              <path d="M38 16v32" />
              <path d="M18 38c7 5 21 5 28 0" />
            </svg>
          ) : parsed.value}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden bg-muted/30 flex items-center justify-center shrink-0",
        radius,
        className,
      )}
    >
      <img src={parsed.value} alt="" className="h-full w-full object-cover" />
    </div>
  );
}