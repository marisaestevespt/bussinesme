import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EntityIconDisplay } from "./EntityIconDisplay";
import { parseIcon, type EntityIcon } from "./types";
import { cn } from "@/lib/utils";

interface Props {
  productId?: string | null;
  /** Optional preloaded icon (skips fetch) */
  icon?: EntityIcon | unknown;
  /** Optional preloaded logo_url fallback */
  logoUrl?: string | null;
  className?: string;
  emojiClassName?: string;
  variant?: "rounded" | "square" | "circle";
}

export function ProductIcon({
  productId,
  icon,
  logoUrl,
  className = "h-6 w-6",
  emojiClassName,
  variant = "rounded",
}: Props) {
  const hasPreload = icon !== undefined || logoUrl !== undefined;

  const { data } = useQuery({
    queryKey: ["product-icon", productId],
    enabled: !!productId && !hasPreload,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("icon, logo_url")
        .eq("id", productId!)
        .maybeSingle();
      return data;
    },
  });

  const resolved =
    parseIcon(icon ?? data?.icon) ??
    (logoUrl ? { type: "image" as const, value: logoUrl } : null) ??
    (data?.logo_url ? { type: "image" as const, value: data.logo_url } : null);

  return (
    <EntityIconDisplay
      icon={resolved}
      className={cn(className)}
      emojiClassName={emojiClassName}
      variant={variant}
    />
  );
}