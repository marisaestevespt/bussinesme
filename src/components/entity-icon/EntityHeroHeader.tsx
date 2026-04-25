import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EntityIconPicker } from "./EntityIconPicker";
import { parseIcon, type EntityIcon } from "./types";

interface Props {
  /** Icon JSON (emoji or image) */
  icon: EntityIcon | unknown;
  onIconChange: (icon: EntityIcon) => void;
  /** Banner image URL */
  coverUrl?: string | null;
  onCoverChange?: (url: string | null) => void;
  /** Storage bucket for uploads */
  bucket: string;
  /** Folder/prefix inside the bucket */
  pathPrefix: string;
  /** Disable editing (read-only) */
  disabled?: boolean;
  /** Show cover area at all */
  showCover?: boolean;
  /** Icon variant */
  iconVariant?: "rounded" | "square" | "circle";
  className?: string;
}

/**
 * Notion-style hero header with cover image + floating icon (emoji or image).
 * Used across all main entity detail pages for visual consistency.
 */
export function EntityHeroHeader({
  icon,
  onIconChange,
  coverUrl,
  onCoverChange,
  bucket,
  pathPrefix,
  disabled,
  showCover = true,
  iconVariant = "rounded",
  className,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleCoverUpload = async (file: File) => {
    if (!onCoverChange) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${pathPrefix}/cover-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      onCoverChange(urlData.publicUrl);
    } catch {
      toast.error("Erro ao enviar imagem de capa");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("relative -mx-2 md:-mx-4", className)}>
      {showCover && (
        <div className="relative w-full h-44 md:h-56 rounded-lg overflow-hidden bg-muted/40 group">
          {coverUrl ? (
            <img src={coverUrl} alt="Capa" className="w-full h-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary/15 via-accent/10 to-muted/30" />
          )}
          {!disabled && onCoverChange && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCoverUpload(f);
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute top-3 right-3 inline-flex items-center gap-2 rounded-md bg-background/80 hover:bg-background backdrop-blur px-2.5 py-1.5 text-xs font-medium text-foreground border border-border/60 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {coverUrl ? "Mudar capa" : "Adicionar capa"}
              </button>
              {coverUrl && (
                <button
                  type="button"
                  onClick={() => onCoverChange(null)}
                  className="absolute top-3 right-32 rounded-md bg-background/80 hover:bg-background backdrop-blur px-2.5 py-1.5 text-xs font-medium text-muted-foreground border border-border/60 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Remover
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Floating icon */}
      <div className={cn("px-2 md:px-6", showCover ? "pt-3" : "pt-0")}>
        <div className={cn(showCover ? "relative -mt-12 md:-mt-14 mb-3 w-fit" : "mb-3 w-fit")}>
          <EntityIconPicker
            icon={parseIcon(icon)}
            onChange={onIconChange}
            bucket={bucket}
            pathPrefix={`${pathPrefix}/icons`}
            variant={iconVariant}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}