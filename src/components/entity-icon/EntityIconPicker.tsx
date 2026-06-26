import { useState, useRef, lazy, Suspense, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { EntityIconDisplay } from "./EntityIconDisplay";
import { parseIcon, type EntityIcon } from "./types";
import { CUSTOM_EMOJI_CATEGORIES } from "./customEmojis";

// Lazy emoji picker — heavy dataset (~270 KB) loaded only when popover opens
const EmojiPickerLazy = lazy(async () => {
  const [{ default: Picker }, dataMod] = await Promise.all([
    import("@emoji-mart/react"),
    import("@emoji-mart/data"),
  ]);
  const data = (dataMod as any).default ?? dataMod;
  return {
    default: (props: any) => (
      <Picker data={data} custom={CUSTOM_EMOJI_CATEGORIES} {...props} />
    ),
  };
});

interface Props {
  icon: EntityIcon | unknown;
  onChange: (icon: EntityIcon) => void;
  /** Storage bucket for image uploads */
  bucket?: string;
  /** Folder/prefix inside the bucket */
  pathPrefix?: string;
  /** Display size (Tailwind classes) */
  className?: string;
  emojiClassName?: string;
  variant?: "rounded" | "square" | "circle";
  disabled?: boolean;
}

export function EntityIconPicker({
  icon,
  onChange,
  bucket = "entity-icons",
  pathPrefix = "icons",
  className = "h-20 w-20 md:h-24 md:w-24",
  emojiClassName = "text-5xl md:text-6xl",
  variant = "rounded",
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const parsed = parseIcon(icon);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange({ type: "image", value: urlData.publicUrl });
      setOpen(false);
    } catch (e) {
      toast.error("Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const trigger = (
    <button
      type="button"
      disabled={disabled}
      className={`relative group/icon ${disabled ? "cursor-default" : "cursor-pointer"}`}
    >
      <div className="border-4 border-background rounded-2xl shadow-lg overflow-hidden">
        <EntityIconDisplay
          icon={parsed}
          className={className}
          emojiClassName={emojiClassName}
          variant={variant}
        />
      </div>
      {!disabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/45 rounded-2xl opacity-0 group-hover/icon:opacity-100 transition-opacity">
          <span className="text-xs font-medium text-white">Editar</span>
        </div>
      )}
    </button>
  );

  if (disabled) return trigger;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Tabs defaultValue="emoji">
          <div className="flex items-center justify-between border-b px-2 py-1.5">
            <TabsList className="h-8 bg-transparent p-0 gap-1">
              <TabsTrigger value="emoji" className="h-7 text-xs">Emoji</TabsTrigger>
              <TabsTrigger value="upload" className="h-7 text-xs">Upload</TabsTrigger>
            </TabsList>
            {parsed && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Trash2 className="h-3 w-3 mr-1" /> Remover
              </Button>
            )}
          </div>
          <TabsContent value="emoji" className="m-0">
            <Suspense fallback={<div className="flex items-center justify-center h-72"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
              <EmojiPickerLazy
                onEmojiSelect={(e: { native: string }) => {
                  onChange({ type: "emoji", value: e.native });
                  setOpen(false);
                }}
                theme="auto"
                previewPosition="none"
                skinTonePosition="search"
                maxFrequentRows={1}
              />
            </Suspense>
          </TabsContent>
          <TabsContent value="upload" className="m-0 p-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> A enviar…</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Escolher imagem</>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground mt-2 text-center">
              PNG, JPG, SVG ou GIF. Máx. 5MB.
            </p>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}