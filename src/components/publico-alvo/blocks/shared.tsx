import { ReactNode, forwardRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { EditableText } from '../EditableText';
import { cn } from '@/lib/utils';

export function EditableListItem({
  value,
  onSave,
  onDelete,
  bullet = 'disc',
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  onDelete: () => void;
  bullet?: 'disc' | 'x' | 'check' | 'none';
  className?: string;
}) {
  const Marker = () => {
    if (bullet === 'none') return null;
    if (bullet === 'x') return <span className="text-destructive shrink-0 mt-0.5 text-xs">✕</span>;
    if (bullet === 'check') return <span className="text-success shrink-0 mt-0.5 text-xs">✓</span>;
    return <span className="text-muted-foreground shrink-0 mt-0.5 text-xs">•</span>;
  };
  return (
    <li className={cn('group flex items-start gap-2', className)}>
      <Marker />
      <EditableText
        value={value}
        onSave={onSave}
        className="text-xs text-foreground leading-relaxed flex-1"
        multiline
      />
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive shrink-0 mt-0.5 transition-opacity"
        aria-label="Eliminar"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </li>
  );
}

export const AddButton = forwardRef<HTMLButtonElement, { onClick: () => void; label?: string; className?: string }>(
  ({ onClick, label = 'Adicionar item', className }, ref) => (
    <button
      ref={ref}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary mt-2 transition-colors',
        className,
      )}
    >
      <Plus className="h-3 w-3" /> {label}
    </button>
  ),
);
AddButton.displayName = 'AddButton';

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.16em] font-medium text-muted-foreground mb-2.5">
      {children}
    </p>
  );
}

export function SubBlock({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3', className)}>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </section>
  );
}

export function EditableStringList({
  items,
  onChange,
  bullet = 'disc',
  addLabel = 'Adicionar item',
  placeholder = 'Novo item',
  emptyText,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  bullet?: 'disc' | 'x' | 'check' | 'none';
  addLabel?: string;
  placeholder?: string;
  emptyText?: string;
}) {
  const update = (i: number, v: string) => {
    const next = [...items];
    next[i] = v;
    onChange(next);
  };
  const del = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, placeholder]);
  return (
    <div>
      {items.length === 0 && emptyText && (
        <p className="text-[11px] text-muted-foreground/50 italic">{emptyText}</p>
      )}
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <EditableListItem key={i} value={it} onSave={(v) => update(i, v)} onDelete={() => del(i)} bullet={bullet} />
        ))}
      </ul>
      <AddButton onClick={add} label={addLabel} />
    </div>
  );
}