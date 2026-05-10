import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableProps {
  /** Static display value. Falsy → placeholder. */
  display?: string | number | null | undefined;
  /** Optional formatter for display (e.g. add €). */
  format?: (v: string) => string;
  /** Suffix shown after the displayed value (e.g. €, %). */
  suffix?: string;
  /** Empty state hint text. */
  placeholder?: string;
  /** Disables editing entirely (read-only display). */
  disabled?: boolean;
  /** Render the editor (Input / Textarea / Select / Popover trigger / etc). */
  render: (helpers: { stop: () => void; autoFocusRef: (el: HTMLElement | null) => void }) => ReactNode;
  /** Allow display to wrap multiple lines (defaults to true). */
  multiline?: boolean;
  /** Visual weight. */
  bold?: boolean;
  /** Right-align display (numbers). */
  align?: 'left' | 'right';
  className?: string;
  /** Style overrides for the trigger (rare). */
  style?: CSSProperties;
  /** Hide pencil even when editable. */
  hidePencil?: boolean;
}

/**
 * Universal in-place editor wrapper.
 * - Static text by default with a pencil icon revealed on hover.
 * - Click → renders the editor returned by `render()`.
 * - Editor receives `stop()` (call onBlur or after commit) and `autoFocusRef` (attach to focusable element).
 * - Wraps long content (no truncation) so text never gets cut.
 */
export function Editable({
  display, format, suffix, placeholder = '—', disabled,
  render, multiline = true, bold, align = 'left', className, style, hidePencil,
}: EditableProps) {
  const [editing, setEditing] = useState(false);
  const focusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!editing) return;
    const t = setTimeout(() => {
      const el = focusRef.current;
      if (!el) return;
      try { (el as HTMLInputElement).focus({ preventScroll: true }); } catch { el.focus(); }
      const inp = el as HTMLInputElement | HTMLTextAreaElement;
      if (typeof inp.select === 'function') {
        try { inp.select(); } catch { /* noop */ }
      }
    }, 0);
    return () => clearTimeout(t);
  }, [editing]);

  const stop = () => setEditing(false);
  const setRef = (el: HTMLElement | null) => { focusRef.current = el; };

  if (editing && !disabled) {
    return (
      <div
        className={cn('w-full', className)}
        style={style}
        onBlur={(e) => {
          // Close when focus leaves the wrapper entirely.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) stop();
        }}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); stop(); } }}
      >
        {render({ stop, autoFocusRef: setRef })}
      </div>
    );
  }

  const raw = display === null || display === undefined ? '' : String(display);
  const shown = raw === '' ? '' : (format ? format(raw) : raw);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && setEditing(true)}
      className={cn(
        'group w-full inline-flex gap-1.5 rounded-md px-2 py-1.5 text-sm text-left transition-colors',
        'hover:bg-muted/60 disabled:cursor-default disabled:opacity-90 disabled:hover:bg-transparent',
        multiline ? 'items-start min-h-8' : 'items-center h-8',
        align === 'right' && 'justify-end',
        bold && 'font-medium',
        className,
      )}
      style={style}
    >
      <span className={cn(
        'flex-1',
        multiline ? 'whitespace-pre-wrap break-words' : 'truncate',
        !shown && 'italic text-muted-foreground/70',
      )}>
        {shown || placeholder}
        {shown && suffix ? <span className="text-muted-foreground ml-0.5">{suffix}</span> : null}
      </span>
      {!disabled && !hidePencil && (
        <Pencil className={cn(
          'h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0',
          multiline ? 'mt-1' : '',
        )} />
      )}
    </button>
  );
}