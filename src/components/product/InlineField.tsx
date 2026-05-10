import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  value: string | number | null | undefined;
  onSave: (next: string) => void;
  type?: 'text' | 'number';
  step?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Optional formatter for display (e.g. add €) */
  format?: (v: string) => string;
  /** Suffix shown after the value when displayed (e.g. €, %, ×) */
  suffix?: string;
  align?: 'left' | 'right';
  bold?: boolean;
  /** Allow multi-line display + textarea editing (no truncation) */
  multiline?: boolean;
}

/**
 * Inline-edit field: static text by default, click pencil (or the value) to edit.
 * Saves on blur or Enter. Esc cancels.
 */
export function InlineField({
  value, onSave, type = 'text', step, placeholder, disabled, className,
  format, suffix, align = 'left', bold, multiline,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value?.toString() ?? '');
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value?.toString() ?? ''); }, [value]);
  useEffect(() => { if (editing) setTimeout(() => ref.current?.focus(), 0); }, [editing]);

  const commit = () => {
    setEditing(false);
    if ((draft ?? '') !== (value?.toString() ?? '')) onSave(draft);
  };
  const cancel = () => { setDraft(value?.toString() ?? ''); setEditing(false); };

  if (editing && !disabled) {
    if (multiline) {
      return (
        <Textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          placeholder={placeholder}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          }}
          rows={3}
          className={cn('text-sm min-h-[72px] resize-y', className)}
        />
      );
    }
    return (
      <Input
        ref={ref as React.RefObject<HTMLInputElement>}
        type={type}
        step={step}
        value={draft}
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        className={cn('h-8 text-sm', align === 'right' && 'text-right tabular-nums', className)}
      />
    );
  }

  const display = (value ?? '') === '' ? '' : (format ? format(value!.toString()) : value!.toString());
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && setEditing(true)}
      className={cn(
        'group w-full inline-flex items-start gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors text-left',
        'hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60',
        !multiline && 'h-8 items-center',
        align === 'right' && 'justify-end',
        bold && 'font-medium',
        className,
      )}
    >
      <span className={cn(
        multiline ? 'whitespace-pre-wrap break-words flex-1' : 'truncate',
        !display && 'italic text-muted-foreground/70',
      )}>
        {display || placeholder || '—'}
        {display && suffix ? <span className="text-muted-foreground ml-0.5">{suffix}</span> : null}
      </span>
      {!disabled && <Pencil className={cn('h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0', multiline ? 'mt-1' : 'ml-auto')} />}
    </button>
  );
}