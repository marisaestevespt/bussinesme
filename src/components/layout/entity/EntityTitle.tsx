import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EntityTitleProps {
  title: string;
  onTitleChange: (next: string) => Promise<void> | void;
  isOwner: boolean;
  /** Optional badges/meta to show next to the title. */
  meta?: React.ReactNode;
  /** Optional description shown below. */
  description?: React.ReactNode;
  placeholder?: string;
  /** Set to true to allow saving without leaving edit mode (for in-place edits saved on blur via parent state). */
  inlineMode?: boolean;
}

/**
 * Lightweight title block for entities that don't have a cover/logo (meetings, projects, sops, tasks).
 * Shares the click-to-edit + Pencil hover pattern with EntityHero.
 */
export function EntityTitle({
  title,
  onTitleChange,
  isOwner,
  meta,
  description,
  placeholder = 'Sem nome',
  inlineMode = false,
}: EntityTitleProps) {
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

  // Inline mode: the title is bound to parent state; just emits onChange on every keystroke.
  if (inlineMode) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={placeholder}
            className="font-display italic text-3xl md:text-4xl leading-tight bg-transparent border-none shadow-none px-0 focus-visible:ring-0 h-auto py-0 flex-1 min-w-[200px]"
            disabled={!isOwner}
          />
          {meta && <div className="flex items-center gap-2 flex-wrap">{meta}</div>}
        </div>
        {description && <div>{description}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        {editing ? (
          <>
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              className="font-display italic text-3xl md:text-4xl border-input/60 shadow-none px-2 h-auto py-1 leading-tight bg-background flex-1 min-w-[200px]"
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
          </>
        ) : (
          <>
            <div
              className={cn(
                'group/name flex items-center gap-2 -mx-2 px-2 py-1 rounded-md min-w-0 flex-1',
                isOwner && 'cursor-text hover:bg-muted/50 transition-colors',
              )}
              onClick={startEdit}
              title={isOwner ? 'Clicar para editar' : undefined}
            >
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground truncate">
                {title || <span className="text-muted-foreground/60">{placeholder}</span>}
              </h1>
              {isOwner && (
                <Pencil className="h-4 w-4 shrink-0 opacity-0 group-hover/name:opacity-100 transition-opacity text-muted-foreground" />
              )}
            </div>
            {meta && <div className="flex items-center gap-2 flex-wrap shrink-0">{meta}</div>}
          </>
        )}
      </div>
      {description && <div>{description}</div>}
    </div>
  );
}