import { useMemo, useState } from 'react';
import {
  AgendaToolbar, DayView, WeekView, MonthView, YearView,
  navigatePrev, navigateNext, formatLabel,
  type AgendaEvent, type AgendaEventType, type AgendaViewMode,
} from '@/components/agenda/AppleCalendarViews';
import {
  AgendaCalendarsSidebar,
  AgendaCalendarsMobileTrigger,
  useCalendarFilters,
  useSidebarCollapsed,
  type CalendarItem,
} from '@/components/agenda/AgendaCalendarsSidebar';

export interface AgendaCalendarViewProps {
  /** Used to namespace localStorage (filters + collapsed state). */
  storageKey: string;
  /** Visible events (already filtered/expanded by the caller). */
  events: AgendaEvent[];
  /** Event types used for colour resolution in the views. */
  types: AgendaEventType[];
  /** Items shown in the "Tipos" section of the sidebar. */
  typeItems: CalendarItem[];
  /** Items shown in the "Produtos" section of the sidebar. */
  productItems: CalendarItem[];
  /** Predicate to decide whether an event is currently visible (sidebar filters). */
  isEventVisible: (ev: AgendaEvent) => boolean;
  /** Called when the user clicks on an event. */
  onEventClick: (ev: AgendaEvent) => void;
  /** Initial view mode. */
  defaultMode?: AgendaViewMode;
  /** Optional toolbar slot rendered on the right (e.g. "Novo Evento" button). */
  toolbarRight?: React.ReactNode;
  /** Whether to expose the sidebar at all (default: true). */
  showSidebar?: boolean;
  /** Controlled cursor: parent owns the date when it needs it for data fetching. */
  cursor?: Date;
  onCursorChange?: (d: Date) => void;
}

const VIEW_KEY = (storage: string) => `${storage}:viewMode`;

/**
 * Single source of truth for rendering the agenda surface (sidebar + toolbar
 * + Day/Week/Month/Year views). Used by both the business agenda and the
 * personal Secretaria agenda to avoid drifting copies.
 */
export function AgendaCalendarView({
  storageKey,
  events,
  types,
  typeItems,
  productItems,
  isEventVisible,
  onEventClick,
  defaultMode = 'week',
  toolbarRight,
  showSidebar = true,
  cursor: cursorProp,
  onCursorChange,
}: AgendaCalendarViewProps) {
  const filters = useCalendarFilters(storageKey);
  const [collapsed, setCollapsed] = useSidebarCollapsed(storageKey);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [mode, setMode] = useState<AgendaViewMode>(() => {
    if (typeof window === 'undefined') return defaultMode;
    const saved = window.localStorage.getItem(VIEW_KEY(storageKey)) as AgendaViewMode | null;
    return saved && ['day', 'week', 'month', 'year'].includes(saved) ? saved : defaultMode;
  });
  const handleModeChange = (m: AgendaViewMode) => {
    setMode(m);
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(VIEW_KEY(storageKey), m); } catch { /* ignore */ }
    }
  };

  const [internalCursor, setInternalCursor] = useState<Date>(() => cursorProp ?? new Date());
  const cursor = cursorProp ?? internalCursor;
  const setCursor = (next: Date | ((d: Date) => Date)) => {
    const value = typeof next === 'function' ? (next as (d: Date) => Date)(cursor) : next;
    if (onCursorChange) onCursorChange(value);
    else setInternalCursor(value);
  };

  const visibleEvents = useMemo(
    () => events.filter(isEventVisible),
    // The predicate depends on filters.hidden; recompute when that changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, filters.hidden],
  );

  return (
    <div className="flex gap-0 border border-border/60 rounded-lg overflow-hidden bg-card">
      {showSidebar && (
        <AgendaCalendarsSidebar
          typeItems={typeItems}
          productItems={productItems}
          hidden={filters.hidden}
          onToggle={filters.toggle}
          onShowAll={filters.showAll}
          onHideAll={filters.hideAll}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          mobileOpen={mobileOpen}
          onMobileOpenChange={setMobileOpen}
        />
      )}
      <div className="flex-1 min-w-0 p-3 sm:p-4">
        <AgendaToolbar
          mode={mode}
          onModeChange={handleModeChange}
          current={cursor}
          onPrev={() => setCursor(d => navigatePrev(mode, d))}
          onNext={() => setCursor(d => navigateNext(mode, d))}
          onToday={() => setCursor(new Date())}
          label={formatLabel(mode, cursor)}
          leftSlot={
            showSidebar ? (
              <AgendaCalendarsMobileTrigger onClick={() => setMobileOpen(true)} />
            ) : undefined
          }
          rightSlot={toolbarRight}
        />
        {mode === 'day'   && <DayView   current={cursor} events={visibleEvents} types={types} onEventClick={onEventClick} />}
        {mode === 'week'  && <WeekView  current={cursor} events={visibleEvents} types={types} onEventClick={onEventClick} />}
        {mode === 'month' && <MonthView current={cursor} events={visibleEvents} types={types} onEventClick={onEventClick} />}
        {mode === 'year'  && (
          <YearView
            current={cursor}
            events={visibleEvents}
            onMonthClick={(d) => { setCursor(d); handleModeChange('month'); }}
          />
        )}
      </div>
    </div>
  );
}
