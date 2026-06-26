import { useEffect, useMemo, useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { parseIcon, type EntityIcon } from "./types";
import lyreEmojiUrl from "@/assets/emoji-lyre.svg";

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
  const privateProductFilePath = useMemo(() => {
    if (parsed?.type !== "image") return null;

    try {
      const url = new URL(parsed.value);
      const marker = "/storage/v1/object/public/product-files/";
      const index = url.pathname.indexOf(marker);
      if (index === -1) return null;
      return decodeURIComponent(url.pathname.slice(index + marker.length));
    } catch {
      return null;
    }
  }, [parsed]);
  const [signedImageUrl, setSignedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSignedImageUrl(null);

    if (!privateProductFilePath) return;

    supabase.storage
      .from("product-files")
      .createSignedUrl(privateProductFilePath, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setSignedImageUrl(data?.signedUrl ?? null);
      });

    return () => {
      cancelled = true;
    };
  }, [privateProductFilePath]);
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
        {isLyre ? (
          <img src={lyreEmojiUrl} alt="🪉" className="h-[82%] w-[82%] object-contain" />
        ) : (
          <span className={cn("inline-flex items-center justify-center font-emoji", emojiClassName ?? "text-[1.6em]")}> 
            {parsed.value}
          </span>
        )}
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
      <img src={signedImageUrl ?? parsed.value} alt="" className="h-full w-full object-cover" />
    </div>
  );
}