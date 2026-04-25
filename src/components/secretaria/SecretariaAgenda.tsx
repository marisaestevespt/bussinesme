import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear } from 'date-fns';
import { useMonthRoutineTasks } from './secretaria-shared';
import { RoutineMonthCard } from './SecretariaRotinas';
import {
  AgendaToolbar, DayView, WeekView, MonthView, YearView,
  navigatePrev, navigateNext, formatLabel,
  type AgendaEvent, type AgendaViewMode,
} from '@/components/agenda/AppleCalendarViews';
import { useProductColors, useProductBrands } from '@/hooks/useProductColors';
import { useGlobalAgendaContext } from '@/hooks/useGlobalAgendaContext';
import { parseISO as parseIsoDate, isWithinInterval } from 'date-fns';
import {
  AgendaCalendarsSidebar,
  useCalendarFilters,
  type CalendarItem,
} from '@/components/agenda/AgendaCalendarsSidebar';

const VIEW_STORAGE_KEY = 'secretaria-agenda:viewMode';

export default function SecretariaAgenda() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AgendaViewMode>(() => {
    if (typeof window === 'undefined') return 'month';
    const v = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return (v === 'day' || v === 'week' || v === 'month' || v === 'year') ? v : 'month';
  });
  const [current, setCurrent] = useState<Date>(new Date());
  const routineTasks = useMonthRoutineTasks();
  const { data: productColors } = useProductColors();
  const { data: productBrands = [] } = useProductBrands();
  const { data: globalContext = [] } = useGlobalAgendaContext();

  // ─── Calendars sidebar (filters by source / product) ───────────
  const calendarFilters = useCalendarFilters('agenda-secretaria');

  const typeCalendarItems: CalendarItem[] = useMemo(() => ([
    { id: 'src:event',    label: 'Eventos',    color: '#0EA5E9' },
    { id: 'src:reuniao',  label: 'Reuniões',   color: '#3B82F6' },
    { id: 'src:tarefa',   label: 'Tarefas',    color: 'hsl(var(--primary))' },
    { id: 'src:global',   label: 'Off / Datas Especiais', color: '#94A3B8' },
    { id: 'meta:feriado', label: 'Feriados PT', color: 'hsl(var(--destructive))' },
  ]), []);

  const productCalendarItems: CalendarItem[] = useMemo(
    () => productBrands.map(p => ({ id: `product:${p.id}`, label: p.name, color: p.color })),
    [productBrands],
  );

  const isEventVisible = (ev: any) => {
    const src = ev._source ?? 'event';
    if (!calendarFilters.isVisible(`src:${src}`)) return false;
    const pid = ev._productId ?? ev.product_id ?? null;
    if (pid && !calendarFilters.isVisible(`product:${pid}`)) return false;
    return true;
  };

  useEffect(() => {
    try { window.localStorage.setItem(VIEW_STORAGE_KEY, mode); } catch {}
  }, [mode]);

  // Resolver profile.id (as tarefas usam assigned_to=profile.id, não user.id)
  const profileQuery = useQuery({
    queryKey: ['agenda-profile-id', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id').eq('user_id', user!.id).maybeSingle();
      return data?.id as string | undefined;
    },
  });
  const profileId = profileQuery.data;

  // Fetch range based on current view mode
  const { fetchStart, fetchEnd } = useMemo(() => {
    let start: Date, end: Date;
    switch (mode) {
      case 'day':   start = current; end = current; break;
      case 'week':  start = startOfWeek(current, { weekStartsOn: 1 }); end = endOfWeek(current, { weekStartsOn: 1 }); break;
      case 'year':  start = startOfYear(current); end = endOfYear(current); break;
      case 'month':
      default:      start = startOfMonth(current); end = endOfMonth(current); break;
    }
    return { fetchStart: format(start, 'yyyy-MM-dd'), fetchEnd: format(end, 'yyyy-MM-dd') };
  }, [mode, current]);

  const myEvents = useQuery({
    queryKey: ['agenda-events', user?.id, profileId, fetchStart, fetchEnd],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: participations } = await supabase.from('event_members').select('event_id').eq('profile_id', user!.id);
      const { data: createdEvents } = await supabase.from('events').select('*').eq('created_by', user!.id).lte('start_date', fetchEnd + 'T23:59:59').or(`end_date.gte.${fetchStart},end_date.is.null,start_date.gte.${fetchStart}`);
      const participantIds = participations?.map(p => p.event_id) || [];
      let participantEvents: any[] = [];
      if (participantIds.length > 0) {
        const { data } = await supabase.from('events').select('*').in('id', participantIds).lte('start_date', fetchEnd + 'T23:59:59').or(`end_date.gte.${fetchStart},end_date.is.null,start_date.gte.${fetchStart}`);
        participantEvents = data || [];
      }

      // Reuniões (meetings): tanto criadas pelo user como em que é participante (via profile.id)
      const meetingProfileIds = [user!.id, profileId].filter(Boolean) as string[];
      const { data: meetingParts } = await supabase
        .from('meeting_participants').select('meeting_id').in('profile_id', meetingProfileIds);
      const meetingIds = Array.from(new Set((meetingParts || []).map(p => p.meeting_id)));

      const meetingResults: any[] = [];
      if (meetingIds.length > 0) {
        const { data } = await supabase
          .from('meetings').select('*')
          .in('id', meetingIds)
          .gte('date_time', fetchStart + 'T00:00:00')
          .lte('date_time', fetchEnd + 'T23:59:59');
        meetingResults.push(...(data || []));
      }
      const { data: createdMeetings } = await supabase
        .from('meetings').select('*')
        .eq('created_by', user!.id)
        .gte('date_time', fetchStart + 'T00:00:00')
        .lte('date_time', fetchEnd + 'T23:59:59');
      meetingResults.push(...(createdMeetings || []));

      // Normalizar meetings para o formato de event (start_date / end_date / title)
      const normalizedMeetings = meetingResults.map((m: any) => ({
        id: `meeting-${m.id}`,
        _meetingId: m.id,
        title: m.title || 'Reunião',
        start_date: m.date_time,
        end_date: m.date_time,
        _isMeeting: true,
      }));

      const all = [...(createdEvents || []), ...participantEvents, ...normalizedMeetings];
      return Array.from(new Map(all.map(e => [e.id, e])).values());
    },
  });

  const myAgendaTasks = useQuery({
    queryKey: ['agenda-tasks', user?.id, profileId, fetchStart, fetchEnd],
    enabled: !!user?.id && !!profileId,
    queryFn: async () => {
      // Aceita tarefas atribuídas tanto via user.id (legado) como via profile.id
      const ids = [user!.id, profileId!].filter(Boolean) as string[];
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .in('assigned_to', ids)
        .not('deadline', 'is', null)
        .gte('deadline', fetchStart)
        .lte('deadline', fetchEnd + 'T23:59:59');
      return data || [];
    },
  });

  // Map fetched events + meetings + tasks to AgendaEvent shape
  const agendaEvents: AgendaEvent[] = useMemo(() => {
    const productColorFor = (pid?: string | null) => (pid && productColors?.get(pid)) || undefined;
    const events = (myEvents.data || []).map((e: any) => {
      const isMeeting = !!e._isMeeting;
      const pid = e.product_id || null;
      const colorOverride = productColorFor(pid);
      return {
        id: e.id,
        title: e.title,
        event_type_id: isMeeting ? '__src_reuniao' : '__src_event',
        start_date: e.start_date,
        end_date: e.end_date || e.start_date,
        product_name: null, department: null, client_name: null, notes: null,
        created_by: null, recurrence_type: null, recurrence_end: null, meeting_url: null,
        ...(isMeeting ? { _isMeeting: true } : {}),
        _source: isMeeting ? 'reuniao' : 'event',
        _originalId: e._meetingId || e.id,
        _productId: pid,
        product_id: pid,
        ...(colorOverride ? { _color: colorOverride } : {}),
      } as any;
    });
    const tasks = (myAgendaTasks.data || []).map((t: any) => {
      let start = t.deadline as string;
      if (start && start.length === 10) start = `${start}T09:00:00`;
      const startD = new Date(start);
      const endD = new Date(startD.getTime() + 30 * 60000);
      const colorOverride = productColorFor(t.product_id);
      return {
        id: `task-${t.id}`,
        title: t.name,
        event_type_id: '__src_tarefa',
        start_date: startD.toISOString(),
        end_date: endD.toISOString(),
        product_name: null, department: null, client_name: null, notes: null,
        created_by: null, recurrence_type: null, recurrence_end: null, meeting_url: null,
        _source: 'tarefa',
        _originalId: t.id,
        _productId: t.product_id ?? null,
        product_id: t.product_id ?? null,
        ...(colorOverride ? { _color: colorOverride } : {}),
      } as any;
    });
    // Filter global context to currently visible window
    const startWin = parseIsoDate(fetchStart + 'T00:00:00');
    const endWin = parseIsoDate(fetchEnd + 'T23:59:59');
    const ctx = (globalContext || []).filter(ev => {
      try {
        const s = parseIsoDate(ev.start_date);
        const e = parseIsoDate(ev.end_date || ev.start_date);
        return isWithinInterval(s, { start: startWin, end: endWin })
            || isWithinInterval(e, { start: startWin, end: endWin })
            || (s <= startWin && e >= endWin);
      } catch { return false; }
    });
    return [...ctx, ...events, ...tasks].filter(isEventVisible);
  }, [myEvents.data, myAgendaTasks.data, productColors, globalContext, fetchStart, fetchEnd, calendarFilters.hidden]);

  const types = useMemo(() => ([
    { id: '__src_event',   name: 'Evento',  color: '#0EA5E9', slug: 'event' },
    { id: '__src_reuniao', name: 'Reunião', color: '#3B82F6', slug: 'reuniao' },
    { id: '__src_tarefa',  name: 'Tarefa',  color: 'hsl(var(--primary))', slug: 'tarefa' },
  ]), []);

  const handleEventClick = (ev: AgendaEvent) => {
    const src = (ev as any)._source;
    if (src === 'reuniao') navigate('/hub/reunioes');
    else if (src === 'tarefa') navigate('/hub/tarefas');
    else navigate('/hub/agenda');
  };

  const goPrev = () => setCurrent(d => navigatePrev(mode, d));
  const goNext = () => setCurrent(d => navigateNext(mode, d));
  const goToday = () => setCurrent(new Date());
  const handleMonthClick = (d: Date) => { setCurrent(d); setMode('month'); };

  return (
    <div className="space-y-6">
      <RoutineMonthCard tasks={routineTasks.data || []} />

      <Card>
        <CardContent className="p-0">
          <div className="flex">
            <AgendaCalendarsSidebar
              typeItems={typeCalendarItems}
              productItems={productCalendarItems}
              hidden={calendarFilters.hidden}
              onToggle={calendarFilters.toggle}
              onShowAll={calendarFilters.showAll}
              onHideAll={calendarFilters.hideAll}
            />
            <div className="flex-1 min-w-0 p-4">
              <AgendaToolbar
                mode={mode}
                onModeChange={setMode}
                current={current}
                onPrev={goPrev}
                onNext={goNext}
                onToday={goToday}
                label={formatLabel(mode, current)}
              />
              {mode === 'day' && (
                <DayView current={current} events={agendaEvents} types={types} onEventClick={handleEventClick} />
              )}
              {mode === 'week' && (
                <WeekView current={current} events={agendaEvents} types={types} onEventClick={handleEventClick} />
              )}
              {mode === 'month' && (
                <MonthView current={current} events={agendaEvents} types={types} onEventClick={handleEventClick} />
              )}
              {mode === 'year' && (
                <YearView current={current} events={agendaEvents} onMonthClick={handleMonthClick} />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
