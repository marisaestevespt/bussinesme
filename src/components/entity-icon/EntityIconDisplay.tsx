import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";
import { parseIcon, type EntityIcon } from "./types";

interface Props {
  icon: EntityIcon | unknown;
  /** Tailwind size classes for the container (e.g. "h-8 w-8") */
  className?: string;
  /** Emoji font size (e.g. "text-2xl"). Auto-scales if omitted. */
  emojiClassName?: string;
  /** Container variant */
  variant?: "rounded" | "square" | "circle";
  /**
   * Entity name. When no icon is set, the initials are used as a
   * Notion-style fallback instead of the generic image icon.
   */
  name?: string | null;
  /** Tailwind classes for the initials text. Defaults to a tasteful auto-scale. */
  initialsClassName?: string;
  fallback?: React.ReactNode;
}

export function EntityIconDisplay({
  icon,
  className,
  emojiClassName,
  variant = "rounded",
  name,
  initialsClassName,
  fallback,
}: Props) {
  const parsed = parseIcon(icon);
  const radius =
    variant === "circle" ? "rounded-full" : variant === "square" ? "rounded-md" : "rounded-lg";

  if (!parsed) {
    const initials = getInitials(name);
    if (initials || fallback === undefined) {
      return (
        <div
          className={cn(
            "flex items-center justify-center bg-primary/10 text-primary font-semibold shrink-0 select-none",
            radius,
            className,
          )}
          aria-label={name ?? undefined}
        >
          {initials ? (
            <span className={cn(initialsClassName ?? "text-[0.9em] leading-none")}>{initials}</span>
          ) : (
            fallback ?? <ImageIcon className="h-1/2 w-1/2 text-muted-foreground/60" />
          )}
        </div>
      );
    }
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted/50 text-muted-foreground/60 shrink-0",
          radius,
          className,
        )}
      >
        {fallback}
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
        <span className={cn(emojiClassName ?? "text-[1.6em]")}>{parsed.value}</span>
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