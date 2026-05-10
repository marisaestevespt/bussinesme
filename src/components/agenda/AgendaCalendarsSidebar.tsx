import { useState, useEffect, useMemo } from 'react';
import { useSectorConfig } from '@/hooks/useSectorConfig';
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, SlidersHorizontal } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
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
const COLLAPSED_PREFIX = 'agenda-calendars-collapsed:';

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

/** Persisted collapsed state for the sidebar (desktop). */
export function useSidebarCollapsed(storageKey: string) {
  const key = COLLAPSED_PREFIX + storageKey;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(key) === '1';
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(key, collapsed ? '1' : '0'); } catch {}
  }, [collapsed, key]);
  return [collapsed, setCollapsed] as const;
}

function CalendarSection({
  title, items, hidden, onToggle, onShowAll, onHideAll, defaultOpen = true, onItemRename,
}: {
  title: string;
  items: CalendarItem[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  defaultOpen?: boolean;
  /** When provided, item labels become inline-editable (used for "Automáticos"). */
  onItemRename?: (id: string, newLabel: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
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
            const isEditing = editingId === it.id;
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
                {onItemRename && isEditing ? (
                  <Input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onClick={(e) => e.preventDefault()}
                    onBlur={() => {
                      const next = draft.trim();
                      if (next && next !== it.label) onItemRename(it.id, next);
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
                      if (e.key === 'Escape') { setEditingId(null); }
                    }}
                    className="h-6 px-1.5 py-0 text-sm flex-1"
                  />
                ) : (
                  <span
                    className={cn('truncate flex-1', onItemRename && 'hover:underline')}
                    onDoubleClick={(e) => {
                      if (!onItemRename) return;
                      e.preventDefault();
                      setDraft(it.label);
                      setEditingId(it.id);
                    }}
                    title={onItemRename ? 'Duplo-clique para renomear' : undefined}
                  >
                    {it.label}
                  </span>
                )}
              </Label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SidebarBody({
  typeItems, autoTypeItems = [], productItems, hidden, onToggle, onShowAll, onHideAll, onAutoItemRename,
}: {
  typeItems: CalendarItem[];
  autoTypeItems?: CalendarItem[];
  productItems: CalendarItem[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
  onShowAll: (ids: string[]) => void;
  onHideAll: (ids: string[]) => void;
  onAutoItemRename?: (id: string, newLabel: string) => void;
}) {
  const sectorConfig = useSectorConfig();
  const typeIds = useMemo(() => typeItems.map(i => i.id), [typeItems]);
  const autoIds = useMemo(() => autoTypeItems.map(i => i.id), [autoTypeItems]);
  const productIds = useMemo(() => productItems.map(i => i.id), [productItems]);
  return (
    <div className="py-2">
      <CalendarSection
        title="Os meus tipos"
        items={typeItems}
        hidden={hidden}
        onToggle={onToggle}
        onShowAll={() => onShowAll(typeIds)}
        onHideAll={() => onHideAll(typeIds)}
      />
      <CalendarSection
        title="Automáticos"
        items={autoTypeItems}
        hidden={hidden}
        onToggle={onToggle}
        onShowAll={() => onShowAll(autoIds)}
        onHideAll={() => onHideAll(autoIds)}
        onItemRename={onAutoItemRename}
      />
      <CalendarSection
        title={sectorConfig.t('produtos')}
        items={productItems}
        hidden={hidden}
        onToggle={onToggle}
        onShowAll={() => onShowAll(productIds)}
        onHideAll={() => onHideAll(productIds)}
      />
    </div>
  );
}

/** Compact icon-only rail shown when sidebar is collapsed (desktop). */
function CollapsedRail({ onExpand }: { onExpand: () => void }) {
  return (
    <aside className="w-9 shrink-0 border-r border-border/60 bg-card/40 hidden md:flex flex-col items-center py-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        aria-label="Mostrar calendários"
        onClick={onExpand}
        title="Mostrar calendários"
      >
        <PanelLeftOpen className="h-4 w-4" />
      </Button>
    </aside>
  );
}

/**
 * Responsive sidebar:
 *  - Desktop (md+): full panel that can be collapsed to a thin icon rail.
 *  - Mobile (<md): hidden; opened on demand via the trigger button (Sheet).
 */
export function AgendaCalendarsSidebar({
  typeItems, autoTypeItems, productItems, hidden, onToggle, onShowAll, onHideAll,
  collapsed, onCollapsedChange, mobileOpen, onMobileOpenChange, className,
  onAutoItemRename,
}: {
  typeItems: CalendarItem[];
  autoTypeItems?: CalendarItem[];
  productItems: CalendarItem[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
  onShowAll: (ids: string[]) => void;
  onHideAll: (ids: string[]) => void;
  collapsed?: boolean;
  onCollapsedChange?: (next: boolean) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  className?: string;
  onAutoItemRename?: (id: string, newLabel: string) => void;
}) {
  if (collapsed) {
    return <CollapsedRail onExpand={() => onCollapsedChange?.(false)} />;
  }

  return (
    <>
      {/* Desktop / tablet panel */}
      <aside
        className={cn(
          'hidden md:block w-[200px] lg:w-[220px] shrink-0 border-r border-border/60 bg-card/40',
          className,
        )}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Calendários
          </span>
          {onCollapsedChange && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mr-1"
              aria-label="Ocultar calendários"
              onClick={() => onCollapsedChange(true)}
              title="Ocultar calendários"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <ScrollArea className="h-full">
          <SidebarBody
            typeItems={typeItems}
            autoTypeItems={autoTypeItems}
            productItems={productItems}
            hidden={hidden}
            onToggle={onToggle}
            onShowAll={onShowAll}
            onHideAll={onHideAll}
            onAutoItemRename={onAutoItemRename}
          />
        </ScrollArea>
      </aside>

      {/* Mobile: drawer */}
      <Sheet open={mobileOpen ?? false} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-[260px] p-0 md:hidden">
          <SheetHeader className="px-3 py-3 border-b">
            <SheetTitle className="text-sm">Calendários</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100%-3rem)]">
            <SidebarBody
              typeItems={typeItems}
              autoTypeItems={autoTypeItems}
              productItems={productItems}
              hidden={hidden}
              onToggle={onToggle}
              onShowAll={onShowAll}
              onHideAll={onHideAll}
              onAutoItemRename={onAutoItemRename}
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Compact button to open the mobile sidebar. Place in your toolbar. */
export function AgendaCalendarsMobileTrigger({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('md:hidden h-8 w-8', className)}
      aria-label="Abrir calendários"
      onClick={onClick}
      title="Calendários"
    >
      <SlidersHorizontal className="h-4 w-4" />
    </Button>
  );
}