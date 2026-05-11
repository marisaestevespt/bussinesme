import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, ImageIcon, Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EntityHeroProps {
  cover?: string | null;
  logo?: string | null;
  title: string;
  onTitleChange: (next: string) => Promise<void> | void;
  description?: React.ReactNode;
  isOwner: boolean;
  onUploadCover?: (file: File) => Promise<void> | void;
  onUploadLogo?: (file: File) => Promise<void> | void;
  fallbackIcon?: React.ElementType;
  /** Visible when title is empty */
  placeholder?: string;
}

/**
 * Notion-style entity hero: cover + floating logo + editable title + description.
 * Used as the canonical header for all entity detail pages.
 */
export function EntityHero({
  cover,
  logo,
  title,
  onTitleChange,
  description,
  isOwner,
  onUploadCover,
  onUploadLogo,
  fallbackIcon: FallbackIcon = ImageIcon,
  placeholder = 'Sem nome',
}: EntityHeroProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    if (!isOwner) return;
    setDraft(title);
    setEditing(true);
  };

  const commit = async () => {
    const next = draft.trim();
    if (!next) {
      toast.error('Nome obrigatório');
      return;
    }
    if (next === title) {
      setEditing(false);
      return;
    }
    try {
      setSaving(true);
      await onTitleChange(next);
      setEditing(false);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative -mx-2 md:-mx-4">
      {/* Cover */}
      <div className="relative w-full h-44 md:h-56 rounded-md overflow-hidden bg-muted/40 group border-2 border-primary/30">
        {cover ? (
          <img src={cover} alt="Capa" className="w-full h-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/15 via-accent/10 to-muted/30" />
        )}
        {isOwner && onUploadCover && (
          <label className="absolute top-3 right-3 inline-flex items-center gap-2 rounded-md bg-background/80 hover:bg-background backdrop-blur px-2 py-1 text-xs font-medium text-foreground border border-border/60 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
            <Upload className="h-4 w-4" />
            {cover ? 'Mudar capa' : 'Adicionar capa'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await onUploadCover(file);
                } catch (err: any) {
                  toast.error(err?.message || 'Erro ao enviar imagem');
                }
              }}
            />
          </label>
        )}
      </div>

      {/* Title block */}
      <div className="px-2 md:px-6 pt-3">
        {/* Floating logo */}
        <div className="relative -mt-12 md:-mt-12 mb-3 group/logo w-fit">
          <div className="h-20 w-20 md:h-24 md:w-24 rounded-md border-[3px] border-primary/40 bg-background overflow-hidden flex items-center justify-center shadow-lg">
            {logo ? (
              <img src={logo} alt="Logo" className="h-full w-full object-contain p-1" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <FallbackIcon className="h-8 w-8 text-muted-foreground/50" />
              </div>
            )}
          </div>
          {isOwner && onUploadLogo && (
            <label className="absolute inset-0 flex items-center justify-center bg-foreground/45 rounded-2xl opacity-0 group-hover/logo:opacity-100 transition-opacity cursor-pointer">
              <Upload className="h-4 w-4 text-background" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    await onUploadLogo(file);
                  } catch (err: any) {
                    toast.error(err?.message || 'Erro ao enviar logo');
                  }
                }}
              />
            </label>
          )}
        </div>

        {/* Title */}
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              className="font-display italic text-3xl md:text-4xl border-input/60 shadow-none px-2 h-auto py-1 leading-tight bg-background"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commit();
                }
                if (e.key === 'Escape') {
                  setEditing(false);
                  setDraft(title);
                }
              }}
            />
            <Button size="icon" variant="default" className="h-10 w-10 shrink-0" onClick={commit} disabled={saving}>
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 shrink-0"
              onClick={() => {
                setEditing(false);
                setDraft(title);
              }}
              disabled={saving}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            className={cn(
              'group/name flex items-center gap-2 -mx-2 px-2 py-1 rounded-md',
              isOwner && 'cursor-text hover:bg-muted/50 transition-colors',
            )}
            onClick={startEdit}
            title={isOwner ? 'Clicar para editar' : undefined}
          >
            <div className="min-w-0">
              <div className="eyebrow mb-1">Ficha</div>
              <h1 className="font-display italic text-3xl md:text-4xl leading-[1.05] text-foreground truncate">
                {title || <span className="text-muted-foreground/60">{placeholder}</span>}
              </h1>
            </div>
            {isOwner && (
              <Pencil className="h-4 w-4 shrink-0 opacity-0 group-hover/name:opacity-100 transition-opacity text-muted-foreground" />
            )}
          </div>
        )}

        {description && <div className="mt-2">{description}</div>}
      </div>
    </div>
  );
}