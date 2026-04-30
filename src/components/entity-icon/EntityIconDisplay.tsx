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
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted/30 leading-none shrink-0 select-none",
          radius,
          className,
        )}
      >
        <span className={cn("inline-flex items-center justify-center font-emoji", emojiClassName ?? "text-[1.6em]")}> 
          {parsed.value}
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