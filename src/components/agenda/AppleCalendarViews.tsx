import { useMemo, useRef, useEffect, forwardRef } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths,
  isSameDay, parseISO, addDays, subDays, startOfWeek, endOfWeek, addWeeks, subWeeks,
  startOfYear, endOfYear, eachMonthOfInterval, isSameMonth, differenceInMinutes,
  getISOWeek,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Repeat, Link2, MapPin, Video } from 'lucide-react';
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
  product_id?: string | null;
  department: string | null;
  client_name: string | null;
  notes: string | null;
  created_by: string | null;
  recurrence_type: string | null;
  recurrence_end: string | null;
  meeting_url: string | null;
}

// Extract a usable URL out of various event fields (notes, meeting_url, etc.)
const URL_RE = /(https?:\/\/[^\s)]+)/i;
function extractUrl(ev: AgendaEvent): string | null {
  if (ev.meeting_url) return ev.meeting_url;
  if (ev.notes) {
    const m = ev.notes.match(URL_RE);
    if (m) return m[1];
  }
  return null;
}
function isVideoUrl(url: string): boolean {
  return /(zoom\.us|meet\.google|teams\.microsoft|whereby\.com|webex\.com|jit\.si|jitsi)/i.test(url);
}
// Free-form location stored on the event (some sources stuff it into notes)
function extractLocation(ev: AgendaEvent): string | null {
  const loc = (ev as any).location as string | undefined;
  if (loc && loc.trim()) return loc.trim();
  return null;
}
// Friendly "context line" — Cliente · Produto · Projeto
function buildContextLine(ev: AgendaEvent): string | null {
  const parts: string[] = [];
  if (ev.client_name) parts.push(ev.client_name);
  if (ev.product_name) parts.push(ev.product_name);
  const proj = (ev as any).project_name as string | undefined;
  if (proj) parts.push(proj);
  return parts.length ? parts.join(' · ') : null;
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
  leftSlot, rightSlot,
}: {
  mode: AgendaViewMode;
  onModeChange: (m: AgendaViewMode) => void;
  current: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  label: string;
  /** Optional content rendered before the date label (e.g. mobile sidebar trigger). */
  leftSlot?: React.ReactNode;
  /** Optional content rendered after the navigation cluster (e.g. action buttons). */
  rightSlot?: React.ReactNode;
}) {
  const modes: { key: AgendaViewMode; label: string }[] = [
    { key: 'day', label: 'Dia' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mês' },
    { key: 'year', label: 'Ano' },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h3 className="font-typewriter text-[11px] uppercase tracking-[0.18em] text-primary/70 truncate flex items-center gap-2">
        {leftSlot}
        {mode === 'week' && (() => {
          const wn = getISOWeek(current);
          return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-medium text-muted-foreground/80 lowercase">
              semana {wn}
            </span>
          );
        })()}
        <span className="truncate">{label}</span>
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
        {rightSlot}
      </div>
    </div>
  );
}

// ─── Time-grid block (shared by Day & Week) ────────────────────

const HOUR_HEIGHT = 48; // px per hour
const START_HOUR = 0;
const END_HOUR = 24;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);
const AGENDA_TIME_ZONE = 'Europe/Lisbon';
const AGENDA_LAYOUT_VERSION = 'lisbon-clock-v3';
const EXPLICIT_TZ_RE = /(Z|[+-]\d{2}:?\d{2})$/i;

const agendaDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: AGENDA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function getAgendaDateParts(date: Date) {
  const parts = Object.fromEntries(
    agendaDateTimeFormatter.formatToParts(date).map(part => [part.type, part.value])
  );
  return {
    key: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    time: `${parts.hour}:${parts.minute}`,
  };
}

function getEventDateParts(value: string) {
  const local = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (local && !EXPLICIT_TZ_RE.test(value)) {
    const [, year, month, day, hour = '00', minute = '00'] = local;
    return { key: `${year}-${month}-${day}`, minutes: Number(hour) * 60 + Number(minute), time: `${hour}:${minute}` };
  }
  return getAgendaDateParts(parseISO(value));
}

function getCalendarDayKey(day: Date): string {
  return format(day, 'yyyy-MM-dd');
}

interface PositionedEvent {
  ev: AgendaEvent;
  topPx: number;
  heightPx: number;
  color: string;
  laneIdx: number;
  laneCount: number;
}

function positionEventsForDay(events: AgendaEvent[], day: Date, types: AgendaEventType[]): PositionedEvent[] {
  const dayKey = getCalendarDayKey(day);
  // Filter events that touch this day
  const dayEvents = events
    .filter(ev => {
      const startKey = getEventDateParts(ev.start_date).key;
      const endKey = ev.end_date
        ? getEventDateParts(ev.end_date).key
        : getAgendaDateParts(new Date(parseISO(ev.start_date).getTime() + 30 * 60000)).key;
      return startKey <= dayKey && endKey >= dayKey;
    })
    .map(ev => {
      const s = parseISO(ev.start_date);
      const startParts = getEventDateParts(ev.start_date);
      const endParts = ev.end_date
        ? getEventDateParts(ev.end_date)
        : getAgendaDateParts(new Date(s.getTime() + 30 * 60000));
      const startMin = startParts.key < dayKey ? 0 : startParts.minutes;
      const endMin = Math.max(endParts.key > dayKey ? 24 * 60 : endParts.minutes, startMin + 15);
      const topPx = (startMin / 60) * HOUR_HEIGHT;
      // Garante que cada bloco ocupa pelo menos 1 hora visualmente
      const rawHeight = ((endMin - startMin) / 60) * HOUR_HEIGHT;
      const heightPx = Math.max(rawHeight, HOUR_HEIGHT);
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

// Apple-style pastel block. forwardRef so React doesn't warn when DevTools/HMR
// or wrapping primitives (Tooltip/Slot) try to attach a ref.
const EventBlock = forwardRef<HTMLButtonElement, { p: PositionedEvent; onClick: () => void; compact?: boolean }>(
  function EventBlock({ p, onClick, compact }, ref) {
  const isMeeting = (p.ev as any)._isMeeting;
  const widthPct = 100 / p.laneCount;
  const leftPct = widthPct * p.laneIdx;
  const startTime = getEventDateParts(p.ev.start_date).time;
  const endTime = p.ev.end_date ? getEventDateParts(p.ev.end_date).time : null;
  const url = extractUrl(p.ev);
  const location = extractLocation(p.ev);
  const context = buildContextLine(p.ev);

  // Progressive disclosure based on available height
  const showTime = p.heightPx >= 30;
  const showContext = p.heightPx >= 56 && !!context;
  const showMeta = p.heightPx >= 78 && (!!url || !!location);
  const showNotes = p.heightPx >= 110 && !!p.ev.notes;

  return (
    <button
      ref={ref}
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
      data-agenda-layout={AGENDA_LAYOUT_VERSION}
      data-start-time={startTime}
      data-top-px={Math.round(p.topPx)}
      title={[p.ev.title, context, location, url].filter(Boolean).join(' — ')}
    >
      <div className="flex items-center gap-1 min-w-0">
        {p.ev.recurrence_type && (
          <Repeat className="h-2.5 w-2.5 flex-shrink-0 opacity-70" />
        )}
        {isMeeting && <Video className="h-2.5 w-2.5 flex-shrink-0 opacity-80" />}
        <span className={cn(
          'truncate font-medium',
          compact ? 'text-[10px] leading-tight' : 'text-[11px] leading-tight'
        )}>
          {cleanTitle(p.ev.title)}
        </span>
        {!showMeta && url && (
          <span
            role="link"
            onClick={(e) => { e.stopPropagation(); window.open(url, '_blank', 'noopener'); }}
            className="ml-auto flex-shrink-0 opacity-70 hover:opacity-100"
            title={url}
          >
            {isVideoUrl(url)
              ? <Video className="h-2.5 w-2.5" />
              : <Link2 className="h-2.5 w-2.5" />}
          </span>
        )}
        {!showMeta && !url && location && (
          <MapPin className="h-2.5 w-2.5 flex-shrink-0 opacity-70 ml-auto" />
        )}
      </div>
      {showTime && (
        <div className={cn(
          'truncate opacity-75 mt-0.5',
          compact ? 'text-[9px]' : 'text-[10px]'
        )}>
          {startTime}{endTime && ` – ${endTime}`}
        </div>
      )}
      {showContext && (
        <div className={cn(
          'truncate opacity-80 mt-0.5 font-normal',
          compact ? 'text-[9px]' : 'text-[10px]'
        )}>
          {context}
        </div>
      )}
      {showMeta && (
        <div className={cn(
          'flex items-center gap-2 mt-0.5 opacity-75',
          compact ? 'text-[9px]' : 'text-[10px]'
        )}>
          {url && (
            <span
              role="link"
              onClick={(e) => { e.stopPropagation(); window.open(url, '_blank', 'noopener'); }}
              className="inline-flex items-center gap-0.5 min-w-0 hover:opacity-100"
              title={url}
            >
              {isVideoUrl(url)
                ? <Video className="h-2.5 w-2.5 flex-shrink-0" />
                : <Link2 className="h-2.5 w-2.5 flex-shrink-0" />}
              <span className="truncate">{isVideoUrl(url) ? 'Entrar' : 'Link'}</span>
            </span>
          )}
          {location && (
            <span className="inline-flex items-center gap-0.5 min-w-0">
              <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
              <span className="truncate">{location}</span>
            </span>
          )}
        </div>
      )}
      {showNotes && (
        <div className={cn(
          'mt-0.5 opacity-65 line-clamp-2',
          compact ? 'text-[9px]' : 'text-[10px]'
        )}>
          {p.ev.notes}
        </div>
      )}
    </button>
  );
});

// All-day strip event (used in Week)
const AllDayEventBlock = forwardRef<HTMLButtonElement, { ev: AgendaEvent; types: AgendaEventType[]; onClick: () => void }>(
  function AllDayEventBlock({ ev, types, onClick }, ref) {
  const color = getColor(types, ev);
  const url = extractUrl(ev);
  const context = buildContextLine(ev);
  return (
    <button
      ref={ref}
      onClick={onClick}
      className="flex w-full items-center gap-1 text-left rounded px-1.5 py-0.5 mb-0.5 text-[10px] font-medium border-l-2 hover:opacity-80 transition-opacity"
      style={{
        backgroundColor: `${color}1A`,
        borderLeftColor: color,
        color,
      }}
      title={[ev.title, context, url].filter(Boolean).join(' — ')}
    >
      {ev.recurrence_type && <Repeat className="h-2.5 w-2.5 flex-shrink-0 opacity-70" />}
      <span className="truncate flex-1 min-w-0">
        {cleanTitle(ev.title)}
        {context && <span className="opacity-70 font-normal"> · {context}</span>}
      </span>
      {url && (
        <span
          role="link"
          onClick={(e) => { e.stopPropagation(); window.open(url, '_blank', 'noopener'); }}
          className="flex-shrink-0 opacity-70 hover:opacity-100"
          title={url}
        >
          {isVideoUrl(url)
            ? <Video className="h-2.5 w-2.5" />
            : <Link2 className="h-2.5 w-2.5" />}
        </span>
      )}
    </button>
  );
});

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

interface ViewProps {
  current: Date;
  events: AgendaEvent[];
  types: AgendaEventType[];
  onEventClick: (ev: AgendaEvent) => void;
}

export const DayView = forwardRef<HTMLDivElement, ViewProps>(function DayView(
  { current, events, types, onEventClick }, _ref,
) {
  const positioned = useMemo(() => positionEventsForDay(events, current, types), [events, current, types]);
  const isToday = isSameDay(current, new Date());
  const nowMin = isToday ? differenceInMinutes(new Date(), startOfDay(current)) : -1;
  const nowTopPx = (nowMin / 60) * HOUR_HEIGHT;

  const scrollRef = useScrollToHour(isToday ? new Date().getHours() : 8);

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <div className="grid grid-cols-[60px_1fr] border-b bg-muted/20">
        <div className="px-2 py-3 font-typewriter text-[10px] uppercase tracking-[0.22em] text-primary/60">all-day</div>
        <div className="px-3 py-3 text-center">
          <div className="font-typewriter text-[10px] uppercase tracking-[0.22em] text-primary/60">
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
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        <div className="grid grid-cols-[60px_1fr] relative">
          {/* Hour labels */}
          <div className="border-r">
            {HOURS.map(h => (
              <div key={h} className="text-[10px] text-muted-foreground/70 text-right pr-2" style={{ height: HOUR_HEIGHT }}>
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
});

// ─── WEEK VIEW ─────────────────────────────────────────────────

export const WeekView = forwardRef<HTMLDivElement, ViewProps>(function WeekView(
  { current, events, types, onEventClick }, _ref,
) {
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
        <div className="px-2 py-3 font-typewriter text-[10px] uppercase tracking-[0.22em] text-primary/60">all-day</div>
        {weekDays.map((d, i) => {
          const isToday = isSameDay(d, new Date());
          return (
            <div key={i} className="px-2 py-2 text-center border-l border-border/40">
              <div className="font-typewriter text-[10px] uppercase tracking-[0.22em] text-primary/60">
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
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
        <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
          {/* Hour labels */}
          <div className="border-r">
            {HOURS.map(h => (
              <div key={h} className="text-[10px] text-muted-foreground/70 text-right pr-2" style={{ height: HOUR_HEIGHT }}>
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
});

// ─── MONTH VIEW (Apple-style) ──────────────────────────────────

const WEEKDAYS_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export const MonthView = forwardRef<HTMLDivElement, ViewProps>(function MonthView(
  { current, events, types, onEventClick }, _ref,
) {
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
          <div key={d} className="px-2 py-2 font-typewriter text-[10px] uppercase tracking-[0.22em] text-primary/60 text-center">
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
          // "Off" days = days covered by an event whose source/slug marks business closure
          const offEvent = dayEvents.find(e => (e as any)._globalSlug === 'off');
          // Render Off events inline as a faint banner instead of stealing list slots
          const restEvents = dayEvents.filter(e => (e as any)._globalSlug !== 'off');
          const visible = restEvents.slice(0, 3);
          const overflow = restEvents.length - visible.length;
          const holiday = holidayMap.get(dayStr);

          return (
            <div
              key={`${wi}-${di}`}
              className={cn(
                'min-h-[110px] p-1.5 border-r border-b border-border/40 last:border-r-0',
                !inMonth && 'bg-muted/10',
                isToday && 'bg-primary/5',
                offEvent && 'bg-muted/60',
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
                {!holiday && offEvent && (
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium truncate">
                    Off
                  </span>
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
});

// ─── YEAR VIEW (Apple-style mini-months) ───────────────────────

export const YearView = forwardRef<HTMLDivElement, { current: Date; events: AgendaEvent[]; onMonthClick: (d: Date) => void }>(
  function YearView({ current, events, onMonthClick }, _ref) {
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
});

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