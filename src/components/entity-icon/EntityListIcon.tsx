import { EntityIconDisplay } from "./EntityIconDisplay";
import type { EntityIcon } from "./types";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg";

const SIZES: Record<Size, { box: string; emoji: string; initials: string }> = {
  xs: { box: "h-5 w-5", emoji: "text-[10px]", initials: "text-[9px]" },
  sm: { box: "h-7 w-7", emoji: "text-base", initials: "text-[11px]" },
  md: { box: "h-9 w-9", emoji: "text-lg", initials: "text-[13px]" },
  lg: { box: "h-12 w-12", emoji: "text-2xl", initials: "text-base" },
};

interface Props {
  icon?: EntityIcon | unknown;
  /** Legacy fallbacks: use as image if provided and icon is empty. */
  logoUrl?: string | null;
  photoUrl?: string | null;
  /** Name used for the initials fallback (Notion-style). */
  name?: string | null;
  size?: Size;
  variant?: "rounded" | "square" | "circle";
  className?: string;
}

/**
 * Canonical icon component for list rows and compact headers.
 *
 * Resolution order:
 *   1. `icon` (emoji or image, parsed via {@link parseIcon}).
 *   2. `logoUrl` / `photoUrl` (legacy column fallback) → rendered as image.
 *   3. Initials computed from `name` (Notion-style coloured chip).
 *   4. Generic placeholder when nothing else is available.
 */
export function EntityListIcon({
  icon,
  logoUrl,
  photoUrl,
  name,
  size = "sm",
  variant = "rounded",
  className,
}: Props) {
  const s = SIZES[size];
  const fallbackImage = logoUrl || photoUrl;
  const resolved =
    icon ??
    (fallbackImage ? { type: "image" as const, value: fallbackImage } : null);

  return (
    <EntityIconDisplay
      icon={resolved}
      name={name}
      className={cn(s.box, className)}
      emojiClassName={s.emoji}
      initialsClassName={s.initials}
      variant={variant}
    />
  );
}