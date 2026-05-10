import { useEffect, useRef, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  label?: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onSave: (next: string) => Promise<void> | void;
  className?: string;
  /** Optional formatter for display only (eg currency). */
  display?: (v: string) => React.ReactNode;
}

/**
 * Display value + pencil. Click to edit inline; Enter saves, Esc cancels.
 * Use for short single-field edits to avoid opening dialogs.
 */
export function ProductInlineEditField({
  label,
  value,
  placeholder = 'Vazio',
  multiline,
  onSave,
  className,
  display,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = async () => {
    if (draft === value) return setEditing(false);
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  return (
    <div className={cn('group space-y-1', className)}>
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
      {editing ? (
        <div className="flex items-start gap-2">
          {multiline ? (
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={placeholder}
              rows={3}
              className="flex-1"
            />
          ) : (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') cancel();
              }}
              placeholder={placeholder}
              className="flex-1"
            />
          )}
          <Button size="icon" variant="ghost" onClick={commit} disabled={saving} className="h-9 w-9 shrink-0">
            <Check className="h-4 w-4 text-primary" />
          </Button>
          <Button size="icon" variant="ghost" onClick={cancel} disabled={saving} className="h-9 w-9 shrink-0">
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full flex items-start justify-between gap-2 text-left rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/40 transition-colors"
        >
          <span
            className={cn(
              'min-w-0 flex-1 text-sm',
              value ? 'text-foreground' : 'text-muted-foreground italic',
              multiline && 'whitespace-pre-wrap',
            )}
          >
            {value ? (display ? display(value) : value) : placeholder}
          </span>
          <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
        </button>
      )}
    </div>
  );
}