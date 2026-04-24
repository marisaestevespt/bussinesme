import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface CalendarItem {
  id: string;       // unique key — used in toggle state
  label: string;
  color: string;
}

export interface CalendarFilters {
  /** ids that are currently HIDDEN (default: everything visible) */
  hidden: Set<string>;
}

const STORAGE_PREFIX = 'agenda-calendars-hidden:';

function readHidden(storageKey: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

function writeHidden(storageKey: string, hidden: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(Array.from(hidden)));
  } catch { /* ignore */ }
}

/**
 * Hook that owns the hidden-calendars state and persists it.
 * Returns the filter set + helpers + an `isVisible(id)` predicate.
 */
export function useCalendarFilters(storageKey: string) {
  const [hidden, setHidden] = useState<Set<string>>(() => readHidden(storageKey));

  useEffect(() => { writeHidden(storageKey, hidden); }, [hidden, storageKey]);

  const toggle = (id: string) => setHidden(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const showAll = (ids: string[]) => setHidden(prev => {
    const next = new Set(prev);
    ids.forEach(id => next.delete(id));
    return next;
  });

  const hideAll = (ids: string[]) => setHidden(prev => {
    const next = new Set(prev);
    ids.forEach(id => next.add(id));
    return next;
  });

  const isVisible = (id: string | null | undefined) => !id || !hidden.has(id);

  return { hidden, toggle, showAll, hideAll, isVisible };
}

function CalendarSection({
  title, items, hidden, onToggle, onShowAll, onHideAll, defaultOpen = true,
}: {
  title: string;
  items: CalendarItem[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!items.length) return null;
  const allHidden = items.every(i => hidden.has(i.id));
  return (
    <div className="border-b border-border/50 last:border-b-0">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hover:text-foreground transition-colors min-w-0"
          onClick={() => setOpen(o => !o)}
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <span className="truncate">{title}</span>
        </button>
        <button
          type="button"
          onClick={() => (allHidden ? onShowAll() : onHideAll())}
          className="text-[10px] text-muted-foreground hover:text-primary transition-colors whitespace-nowrap shrink-0"
        >
          {allHidden ? 'Mostrar' : 'Ocultar'}
        </button>
      </div>
      {open && (
        <div className="px-2 pb-2 space-y-0.5">
          {items.map(it => {
            const isOn = !hidden.has(it.id);
            const inputId = `cal-${it.id}`;
            return (
              <Label
                key={it.id}
                htmlFor={inputId}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm font-normal',
                  'hover:bg-muted/60 transition-colors',
                  !isOn && 'opacity-50',
                )}
              >
                <Checkbox
                  id={inputId}
                  checked={isOn}
                  onCheckedChange={() => onToggle(it.id)}
                  className="h-3.5 w-3.5 rounded-[4px] border-2"
                  style={isOn ? { backgroundColor: it.color, borderColor: it.color } : { borderColor: it.color }}
                />
                <span className="truncate flex-1">{it.label}</span>
              </Label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AgendaCalendarsSidebar({
  typeItems,
  productItems,
  hidden,
  onToggle,
  onShowAll,
  onHideAll,
  className,
}: {
  typeItems: CalendarItem[];
  productItems: CalendarItem[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
  onShowAll: (ids: string[]) => void;
  onHideAll: (ids: string[]) => void;
  className?: string;
}) {
  const typeIds = useMemo(() => typeItems.map(i => i.id), [typeItems]);
  const productIds = useMemo(() => productItems.map(i => i.id), [productItems]);

  return (
    <aside className={cn('w-[200px] shrink-0 border-r border-border/60 bg-card/40', className)}>
      <ScrollArea className="h-full">
        <div className="py-2">
          <CalendarSection
            title="Tipos"
            items={typeItems}
            hidden={hidden}
            onToggle={onToggle}
            onShowAll={() => onShowAll(typeIds)}
            onHideAll={() => onHideAll(typeIds)}
          />
          <CalendarSection
            title="Produtos"
            items={productItems}
            hidden={hidden}
            onToggle={onToggle}
            onShowAll={() => onShowAll(productIds)}
            onHideAll={() => onHideAll(productIds)}
          />
        </div>
      </ScrollArea>
    </aside>
  );
}