import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

interface EditableTextProps {
  value: string;
  onSave: (value: string) => void;
  as?: 'p' | 'span' | 'h3' | 'h2';
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}

export function EditableText({ value, onSave, as: Tag = 'p', className, placeholder = 'Clica para editar...', multiline = false }: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (editing && ref.current) {
      // Set text content safely (no HTML injection)
      ref.current.textContent = value || '';
      ref.current.focus();
      // Move cursor to end
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editing]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    const text = ref.current?.innerText?.trim() || '';
    if (text !== value) {
      onSave(text);
    }
  }, [value, onSave]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      ref.current?.blur();
    }
    if (e.key === 'Escape') {
      if (ref.current) ref.current.textContent = value;
      setEditing(false);
    }
  }, [multiline, value]);

  // Escape HTML for safe display
  const displayText = value || placeholder;

  return (
    <Tag
      ref={ref as any}
      contentEditable={editing}
      suppressContentEditableWarning
      onClick={() => !editing && setEditing(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={cn(
        className,
        'outline-none transition-colors rounded-sm',
        editing
          ? 'ring-1 ring-primary/40 bg-primary/5 px-1 -mx-1'
          : 'cursor-pointer hover:bg-muted/50 px-1 -mx-1',
        !value && !editing && 'text-muted-foreground/50 italic'
      )}
    >
      {editing ? undefined : displayText}
    </Tag>
  );
}
