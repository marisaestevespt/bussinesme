import { useState, useRef, useEffect, KeyboardEvent } from 'react';
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
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    if (editing && ref.current) {
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

  const handleBlur = () => {
    setEditing(false);
    const text = ref.current?.innerText?.trim() || '';
    if (text !== value) {
      onSave(text);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      ref.current?.blur();
    }
    if (e.key === 'Escape') {
      if (ref.current) ref.current.innerText = value;
      setEditing(false);
    }
  };

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
      dangerouslySetInnerHTML={{ __html: editing ? draft : (value || placeholder) }}
    />
  );
}
