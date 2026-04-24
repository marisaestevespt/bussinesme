import { useMemo, useRef, useEffect } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths,
  isSameDay, parseISO, addDays, subDays, startOfWeek, endOfWeek, addWeeks, subWeeks,
  startOfYear, endOfYear, eachMonthOfInterval, isSameMonth, differenceInMinutes,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getPortugueseHolidays } from '@/lib/holidays';

// ─── Shared types (kept in sync with Agenda.tsx) ───────────────

export interface AgendaEvent {
  id: string;
  title: string;
  event_type_id: string | null;
  start_date: string;
  end_date: string | null;
  product_name: string | null;
  department: string | null;
  client_name: string | null;
  notes: string | null;
  created_by: string | null;
  recurrence_type: string | null;
  recurrence_end: string | null;
  meeting_url: string | null;
}
export interface AgendaEventType { id: string; name: string; color: string; slug: string; }

export type AgendaViewMode = 'day' | 'week' | 'month' | 'year';

const MEETING_PSEUDO_COLOR = '#8B5CF6';

function getColor(types: AgendaEventType[], ev: AgendaEvent): string {
  // Allow events to override the colour (e.g. product-branded events)
  const override = (ev as any)._color as string | undefined;
  if (override) return override;
  if ((ev as any)._isMeeting) return MEETING_PSEUDO_COLOR;
  const t = types.find(x => x.id === ev.event_type_id);
  return t?.color ?? 'hsl(var(--primary))';
}

// Strip leading emoji + space from titles for cleaner Apple-style look
function cleanTitle(title: string): string {
  // Match leading emoji (most common ranges) optionally followed by space
  return title.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+\s*/u, '').trim() || title;
}

// ─── Holidays helper ───────────────────────────────────────────

function useHolidayMap(years: number[]): Map<string, string> {
  return useMemo(() => {
    const map = new Map<string, string>();
    const seen = new Set<number>();
    years.forEach(y => {
      if (seen.has(y)) return;
      seen.add(y);
      getPortugueseHolidays(y).forEach(h => map.set(h.dateStr, h.name));
    });
    return map;
  }, [years.join(',')]);
}

// ─── Toolbar (shared) ──────────────────────────────────────────

export function AgendaToolbar({
  mode, onModeChange, current, onPrev, onNext, onToday, label,
}: {
  mode: AgendaViewMode;
  onModeChange: (m: AgendaViewMode) => void;
  current: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  label: string;
}) {
  const modes: { key: AgendaViewMode; label: string }[] = [
    { key: 'day', label: 'Dia' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mês' },
    { key: 'year', label: 'Ano' },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h3 className="text-lg sm:text-2xl font-semibold capitalize text-foreground tracking-tight truncate">
        {label}
      </h3>
      <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
        <div className="inline-flex items-center rounded-full bg-muted/60 p-0.5">
          {modes.map(m => (
            <button
              key={m.key}
              onClick={() => onModeChange(m.key)}
              className={cn(
                'px-2 sm:px-3 py-1 text-xs font-medium rounded-full transition-all',
                mode === m.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" aria-label="Anterior" onClick={onPrev} className="rounded-full h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday} className="rounded-full h-8 px-3 text-xs">
          Hoje
        </Button>
        <Button variant="ghost" size="icon" aria-label="Seguinte" onClick={onNext} className="rounded-full h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Time-grid block (shared by Day & Week) ────────────────────

const HOUR_HEIGHT = 48; // px per hour
const START_HOUR = 0;
const END_HOUR = 24;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);

interface PositionedEvent {
  ev: AgendaEvent;
  topPx: number;
  heightPx: number;
  color: string;
  laneIdx: number;
  laneCount: number;
}

function positionEventsForDay(events: AgendaEvent[], day: Date, types: AgendaEventType[]): PositionedEvent[] {
  // Filter events that touch this day
  const dayEvents = events
    .filter(ev => {
      const s = parseISO(ev.start_date);
      const e = ev.end_date ? parseISO(ev.end_date) : new Date(s.getTime() + 30 * 60000);
      return (s <= endOfDay(day) && e >= startOfDay(day));
    })
    .map(ev => {
      const s = parseISO(ev.start_date);
      const eRaw = ev.end_date ? parseISO(ev.end_date) : new Date(s.getTime() + 30 * 60000);
      // Clamp to current day for layout
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const clampedStart = s < dayStart ? dayStart : s;
      const clampedEnd = eRaw > dayEnd ? dayEnd : eRaw;
      const startMin = differenceInMinutes(clampedStart, dayStart);
      const endMin = Math.max(differenceInMinutes(clampedEnd, dayStart), startMin + 15);
      const topPx = (startMin / 60) * HOUR_HEIGHT;
      const heightPx = ((endMin - startMin) / 60) * HOUR_HEIGHT;
      return { ev, topPx, heightPx, color: getColor(types, ev), startMin, endMin };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  // Lane assignment (column packing for overlapping events)
  type Tmp = (typeof dayEvents)[0] & { laneIdx: number };
  const lanes: number[] = []; // lanes[i] = endMin of last event in lane i
  const positioned: Tmp[] = dayEvents.map(de => {
    let laneIdx = lanes.findIndex(end => end <= de.startMin);
    if (laneIdx === -1) {
      lanes.push(de.endMin);
      laneIdx = lanes.length - 1;
    } else {
      lanes[laneIdx] = de.endMin;
    }
    return { ...de, laneIdx };
  });

  // For each event, compute the cluster size (max overlapping lane index in its time range)
  return positioned.map(p => {
    let cluster = 1;
    positioned.forEach(o => {
      if (o.startMin < p.endMin && o.endMin > p.startMin) {
        cluster = Math.max(cluster, o.laneIdx + 1);
      }
    });
    return {
      ev: p.ev,
      topPx: p.topPx,
      heightPx: p.heightPx,
      color: p.color,
      laneIdx: p.laneIdx,
      laneCount: cluster,
    };
  });
}

function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date): Date { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

// Apple-style pastel block
function EventBlock({ p, onClick, compact }: { p: PositionedEvent; onClick: () => void; compact?: boolean }) {
  const isMeeting = (p.ev as any)._isMeeting;
  const widthPct = 100 / p.laneCount;
  const leftPct = widthPct * p.laneIdx;
  const startTime = format(parseISO(p.ev.start_date), 'HH:mm');
  const endTime = p.ev.end_date ? format(parseISO(p.ev.end_date), 'HH:mm') : null;
  const showTime = p.heightPx >= 30;

  return (
    <button
      onClick={onClick}
      className={cn(
        'absolute rounded-md px-2 py-1 text-left transition-all overflow-hidden',
        'border-l-[3px] hover:shadow-md hover:z-20 group',
      )}
      style={{
        top: `${p.topPx}px`,
        height: `${Math.max(p.heightPx - 2, 18)}px`,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        backgroundColor: `${p.color}1A`,
        borderLeftColor: p.color,
        color: p.color,
      }}
      title={p.ev.title}
    >
      <div className="flex items-center gap-1 min-w-0">
        {p.ev.recurrence_type && (
          <Repeat className="h-2.5 w-2.5 flex-shrink-0 opacity-70" />
        )}
        {isMeeting && <span className="text-[10px]">📹</span>}
        <span className={cn(
          'truncate font-medium',
          compact ? 'text-[10px] leading-tight' : 'text-[11px] leading-tight'
        )}>
          {cleanTitle(p.ev.title)}
        </span>
      </div>
      {showTime && (
        <div className={cn(
          'truncate opacity-75 mt-0.5',
          compact ? 'text-[9px]' : 'text-[10px]'
        )}>
          {startTime}{endTime && ` – ${endTime}`}
        </div>
      )}
    </button>
  );
}

// All-day strip event (used in Week)
function AllDayEventBlock({ ev, types, onClick }: { ev: AgendaEvent; types: AgendaEventType[]; onClick: () => void }) {
  const color = getColor(types, ev);
  return (
    <button
      onClick={onClick}
      className="block w-full text-left rounded px-1.5 py-0.5 mb-0.5 truncate text-[10px] font-medium border-l-2 hover:opacity-80 transition-opacity"
      style={{
        backgroundColor: `${color}1A`,
        borderLeftColor: color,
        color,
      }}
      title={ev.title}
    >
      {ev.recurrence_type && '🔁 '}{cleanTitle(ev.title)}
    </button>
  );
}

// Auto-scroll to current/business hours on mount
function useScrollToHour(hour: number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = Math.max(0, (hour - START_HOUR) * HOUR_HEIGHT - 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

// ─── DAY VIEW ──────────────────────────────────────────────────

export function DayView({
  current, events, types, onEventClick,
}: {
  current: Date;
  events: AgendaEvent[];
  types: AgendaEventType[];
  onEventClick: (ev: AgendaEvent) => void;
}) {
  const positioned = useMemo(() => positionEventsForDay(events, current, types), [events, current, types]);
  const isToday = isSameDay(current, new Date());
  const nowMin = isToday ? differenceInMinutes(new Date(), startOfDay(current)) : -1;
  const nowTopPx = (nowMin / 60) * HOUR_HEIGHT;

  const scrollRef = useScrollToHour(isToday ? new Date().getHours() : 8);

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <div className="grid grid-cols-[60px_1fr] border-b bg-muted/20">
        <div className="px-2 py-3 text-[10px] uppercase tracking-wider text-muted-foreground">all-day</div>
        <div className="px-3 py-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {format(current, 'EEEE', { locale: pt })}
          </div>
          <div className={cn(
            'text-2xl font-semibold mt-0.5',
            isToday ? 'text-primary' : 'text-foreground'
          )}>
            {format(current, 'd')}
          </div>
        </div>
      </div>

      {/* Time grid */}
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        <div className="grid grid-cols-[60px_1fr] relative">
          {/* Hour labels */}
          <div className="border-r">
            {HOURS.map(h => (
              <div key={h} className="text-[10px] text-muted-foreground/70 text-right pr-2 -mt-1.5" style={{ height: HOUR_HEIGHT }}>
                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>
          {/* Event area */}
          <div className="relative">
            {HOURS.map(h => (
              <div key={h} className="border-b border-border/40" style={{ height: HOUR_HEIGHT }} />
            ))}
            {positioned.map(p => (
              <EventBlock key={p.ev.id} p={p} onClick={() => onEventClick(p.ev)} />
            ))}
            {/* Now indicator */}
            {isToday && nowMin >= 0 && (
              <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: `${nowTopPx}px` }}>
                <div className="h-px bg-destructive" />
                <div className="h-2 w-2 rounded-full bg-destructive -ml-1 -mt-1" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── WEEK VIEW ─────────────────────────────────────────────────

export function WeekView({
  current, events, types, onEventClick,
}: {
  current: Date;
  events: AgendaEvent[];
  types: AgendaEventType[];
  onEventClick: (ev: AgendaEvent) => void;
}) {
  const weekStart = startOfWeek(current, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const holidayMap = useHolidayMap([weekStart.getFullYear(), addDays(weekStart, 6).getFullYear()]);

  // Pre-position events per day
  const perDay = useMemo(() =>
    weekDays.map(d => positionEventsForDay(events, d, types)),
    [events, weekStart.toISOString(), types]
  );

  // All-day events: holidays only (events with explicit date span >= 24h could be added, kept simple)
  const today = new Date();
  const todayMin = differenceInMinutes(today, startOfDay(today));
  const todayColIdx = weekDays.findIndex(d => isSameDay(d, today));

  const scrollRef = useScrollToHour(todayColIdx >= 0 ? today.getHours() : 8);

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Header row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/20">
        <div className="px-2 py-3 text-[10px] uppercase tracking-wider text-muted-foreground">all-day</div>
        {weekDays.map((d, i) => {
          const isToday = isSameDay(d, new Date());
          return (
            <div key={i} className="px-2 py-2 text-center border-l border-border/40">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {format(d, 'EEE', { locale: pt })}
              </div>
              <div className={cn(
                'inline-flex items-center justify-center mt-0.5 text-lg font-semibold',
                isToday && 'h-7 w-7 rounded-full bg-primary text-primary-foreground'
              )}>
                {format(d, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day strip (holidays) */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/10 min-h-[28px]">
        <div />
        {weekDays.map((d, i) => {
          const dayStr = format(d, 'yyyy-MM-dd');
          const holiday = holidayMap.get(dayStr);
          return (
            <div key={i} className="px-1 py-1 border-l border-border/40">
              {holiday && (
                <div className="rounded bg-destructive/10 text-destructive text-[10px] font-medium px-1.5 py-0.5 truncate">
                  ✦ {holiday}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 360px)' }}>
        <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
          {/* Hour labels */}
          <div className="border-r">
            {HOURS.map(h => (
              <div key={h} className="text-[10px] text-muted-foreground/70 text-right pr-2 -mt-1.5" style={{ height: HOUR_HEIGHT }}>
                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>
          {/* Day columns */}
          {weekDays.map((d, i) => (
            <div key={i} className="relative border-l border-border/40">
              {HOURS.map(h => (
                <div key={h} className="border-b border-border/30" style={{ height: HOUR_HEIGHT }} />
              ))}
              {perDay[i].map(p => (
                <EventBlock key={p.ev.id} p={p} onClick={() => onEventClick(p.ev)} compact />
              ))}
              {/* Now indicator */}
              {isSameDay(d, new Date()) && (
                <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: `${(todayMin / 60) * HOUR_HEIGHT}px` }}>
                  <div className="h-px bg-destructive" />
                  <div className="h-2 w-2 rounded-full bg-destructive -ml-1 -mt-1" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MONTH VIEW (Apple-style) ──────────────────────────────────

const WEEKDAYS_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function MonthView({
  current, events, types, onEventClick,
}: {
  current: Date;
  events: AgendaEvent[];
  types: AgendaEventType[];
  onEventClick: (ev: AgendaEvent) => void;
}) {
  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const holidayMap = useHolidayMap([monthStart.getFullYear(), monthEnd.getFullYear()]);

  // Group events per day-string
  const eventsByDay = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>();
    events.forEach(ev => {
      const key = format(parseISO(ev.start_date), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    });
    // sort each day by time
    map.forEach(list => list.sort((a, b) => a.start_date.localeCompare(b.start_date)));
    return map;
  }, [events]);

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/20">
        {WEEKDAYS_PT.map(d => (
          <div key={d} className="px-2 py-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr">
        {weeks.flatMap((week, wi) => week.map((day, di) => {
          const inMonth = isSameMonth(day, current);
          const isToday = isSameDay(day, new Date());
          const dayStr = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay.get(dayStr) || [];
          const visible = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - visible.length;
          const holiday = holidayMap.get(dayStr);

          return (
            <div
              key={`${wi}-${di}`}
              className={cn(
                'min-h-[110px] p-1.5 border-r border-b border-border/40 last:border-r-0',
                !inMonth && 'bg-muted/10',
                isToday && 'bg-primary/5',
              )}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className={cn(
                  'inline-flex items-center justify-center text-xs font-medium',
                  isToday && 'h-5 w-5 rounded-full bg-primary text-primary-foreground',
                  !isToday && inMonth && 'text-foreground',
                  !inMonth && 'text-muted-foreground/50',
                )}>
                  {format(day, 'd')}
                </span>
                {holiday && (
                  <span className="text-[9px] text-destructive font-medium truncate">{holiday}</span>
                )}
              </div>
              <div className="space-y-0.5">
                {visible.map(ev => (
                  <AllDayEventBlock key={ev.id} ev={ev} types={types} onClick={() => onEventClick(ev)} />
                ))}
                {overflow > 0 && (
                  <div className="text-[10px] text-muted-foreground pl-1.5">+{overflow} mais</div>
                )}
              </div>
            </div>
          );
        }))}
      </div>
    </div>
  );
}

// ─── YEAR VIEW (Apple-style mini-months) ───────────────────────

export function YearView({
  current, events, onMonthClick,
}: {
  current: Date;
  events: AgendaEvent[];
  onMonthClick: (d: Date) => void;
}) {
  const yearStart = startOfYear(current);
  const yearEnd = endOfYear(current);
  const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

  // Days that have events
  const eventDays = useMemo(() => {
    const set = new Set<string>();
    events.forEach(ev => set.add(format(parseISO(ev.start_date), 'yyyy-MM-dd')));
    return set;
  }, [events]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {months.map(m => {
        const mStart = startOfMonth(m);
        const mEnd = endOfMonth(m);
        const gridStart = startOfWeek(mStart, { weekStartsOn: 1 });
        const gridEnd = endOfWeek(mEnd, { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
        return (
          <button
            key={m.toISOString()}
            onClick={() => onMonthClick(m)}
            className="text-left rounded-lg border bg-card p-3 hover:shadow-md transition-shadow"
          >
            <h4 className="text-sm font-semibold capitalize text-foreground mb-2">
              {format(m, 'MMMM', { locale: pt })}
            </h4>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {WEEKDAYS_PT.map(d => (
                <div key={d} className="text-[8px] uppercase text-muted-foreground/70">{d[0]}</div>
              ))}
              {days.map(day => {
                const inMonth = isSameMonth(day, m);
                const isToday = isSameDay(day, new Date());
                const hasEvent = eventDays.has(format(day, 'yyyy-MM-dd'));
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'aspect-square flex items-center justify-center text-[10px] rounded-full',
                      !inMonth && 'text-muted-foreground/30',
                      inMonth && !isToday && 'text-foreground',
                      isToday && 'bg-primary text-primary-foreground font-semibold',
                      hasEvent && !isToday && inMonth && 'font-semibold text-primary',
                    )}
                  >
                    {format(day, 'd')}
                  </div>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Navigation helpers ────────────────────────────────────────

export function navigatePrev(mode: AgendaViewMode, d: Date): Date {
  switch (mode) {
    case 'day': return subDays(d, 1);
    case 'week': return subWeeks(d, 1);
    case 'month': return subMonths(d, 1);
    case 'year': return new Date(d.getFullYear() - 1, d.getMonth(), 1);
  }
}
export function navigateNext(mode: AgendaViewMode, d: Date): Date {
  switch (mode) {
    case 'day': return addDays(d, 1);
    case 'week': return addWeeks(d, 1);
    case 'month': return addMonths(d, 1);
    case 'year': return new Date(d.getFullYear() + 1, d.getMonth(), 1);
  }
}
export function formatLabel(mode: AgendaViewMode, d: Date): string {
  switch (mode) {
    case 'day': return format(d, "d 'de' MMMM yyyy", { locale: pt });
    case 'week': {
      const ws = startOfWeek(d, { weekStartsOn: 1 });
      const we = endOfWeek(d, { weekStartsOn: 1 });
      if (ws.getMonth() === we.getMonth()) {
        return `${format(ws, 'd', { locale: pt })} – ${format(we, "d 'de' MMMM yyyy", { locale: pt })}`;
      }
      return `${format(ws, "d 'de' MMM", { locale: pt })} – ${format(we, "d 'de' MMM yyyy", { locale: pt })}`;
    }
    case 'month': return format(d, 'MMMM yyyy', { locale: pt });
    case 'year': return format(d, 'yyyy', { locale: pt });
  }
}