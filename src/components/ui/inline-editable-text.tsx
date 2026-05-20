import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  /** texto a mostrar quando vazio */
  emptyText?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
  /** classes no display estático */
  displayClassName?: string;
  type?: 'text' | 'date';
}

/**
 * Edit-in-place: display estático com pencil; clica e abre input com Save/Cancel.
 * Nunca deixa campos abertos a flutuar — só edita quando o utilizador pede.
 */
export function InlineEditableText({
  value, onSave, placeholder, emptyText = 'Clica para escrever…',
  multiline, rows = 3, className, displayClassName, type = 'text',
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const start = () => { setDraft(value); setEditing(true); };
  const save = () => { onSave(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (!editing) {
    const isEmpty = !value || !value.toString().trim();
    return (
      <button
        type="button"
        onClick={start}
        className={cn(
          'group w-full text-left rounded-md px-2 py-1.5 border border-transparent hover:border-border/60 hover:bg-muted/30 hq-transition flex items-start gap-2',
          className,
        )}
      >
        <span className={cn(
          'flex-1 text-sm whitespace-pre-wrap break-words',
          isEmpty && 'text-muted-foreground italic text-xs',
          displayClassName,
        )}>
          {isEmpty ? emptyText : value}
        </span>
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 mt-1" />
      </button>
    );
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {multiline ? (
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="text-sm"
        />
      ) : (
        <Input
          autoFocus
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !multiline) { e.preventDefault(); save(); }
            if (e.key === 'Escape') cancel();
          }}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
      )}
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancel}>
          <X className="h-3 w-3 mr-1" /> Cancelar
        </Button>
        <Button size="sm" className="h-7 text-xs" onClick={save}>
          <Save className="h-3 w-3 mr-1" /> Guardar
        </Button>
      </div>
    </div>
  );
}