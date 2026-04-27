import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getProductColorFromMap, useProductColors, useProductBrands } from '@/hooks/useProductColors';
import { useGlobalAgendaContext } from '@/hooks/useGlobalAgendaContext';
import type { AgendaEvent, AgendaEventType } from '@/components/agenda/AppleCalendarViews';
import type { CalendarItem } from '@/components/agenda/AgendaCalendarsSidebar';
import { expandRecurringEvents } from '@/lib/expandRecurringEvents';
import { addMonths, subMonths } from 'date-fns';

const MEETING_PSEUDO_COLOR = '#8B5CF6';
const SALES_ACTION_PSEUDO_COLOR = '#F59E0B';

/**
 * Personal version of the business Agenda data pipeline. Produces the same
 * shape (events tagged with _isMeeting / _isSalesAction, product colour
 * overrides, recurring expansion) but filtered to events the current user
 * created or participates in. The output is meant to feed AgendaCalendarView
 * so the personal calendar looks identical to the business one.
 */
export function useMyAgendaEvents(range: { from: string; to: string }, cursor: Date) {
  const { user } = useAuth();

  const { data: types = [] } = useQuery({
    queryKey: ['event_types'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('event_types').select('*').order('name');
      return (data || []) as AgendaEventType[];
    },
  });
  const { data: productColors } = useProductColors();
  const { data: productBrands = [] } = useProductBrands();
  const { data: globalContext = [] } = useGlobalAgendaContext();

  // Resolve profile.id once
  const profileQ = useQuery({
    queryKey: ['my-profile-id', user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id').eq('user_id', user!.id).maybeSingle();
      return data?.id as string | null;
    },
  });
  const profileId = profileQ.data;

  // 1. Events the user created or is a participant of
  const eventsQ = useQuery({
    queryKey: ['my-agenda-events', user?.id, profileId, range.from, range.to],
    enabled: !!user?.id && !!profileId,
    queryFn: async () => {
      const profileIds = [user!.id, profileId!].filter(Boolean) as string[];
      const { data: parts } = await supabase
        .from('event_members')
        .select('event_id')
        .in('profile_id', profileIds);
      const partIds = parts?.map(p => p.event_id) || [];

      const inRange = (q: any) => q.or(
        `and(start_date.gte.${range.from},start_date.lte.${range.to}),and(end_date.gte.${range.from},end_date.lte.${range.to}),and(start_date.lte.${range.from},end_date.gte.${range.to}),and(recurrence_type.not.is.null,start_date.lte.${range.to})`
      );

      const { data: created = [] } = await inRange(
        supabase.from('events').select('*').eq('created_by', user!.id)
      );
      let participant: any[] = [];
      if (partIds.length > 0) {
        const { data } = await inRange(
          supabase.from('events').select('*').in('id', partIds)
        );
        participant = data || [];
      }
      const map = new Map<string, any>();
      for (const ev of [...(created || []), ...participant]) map.set(ev.id, ev);
      return Array.from(map.values());
    },
  });

  // 2. Meetings where the user is a participant or creator
  const meetingsQ = useQuery({
    queryKey: ['my-agenda-meetings', user?.id, profileId, range.from, range.to],
    enabled: !!profileId,
    queryFn: async () => {
      const profileIds = [user!.id, profileId!].filter(Boolean) as string[];
      const { data: parts } = await supabase
        .from('meeting_participants')
        .select('meeting_id')
        .in('profile_id', profileIds);
      const partIds = Array.from(new Set((parts || []).map(p => p.meeting_id)));

      let participated: any[] = [];
      if (partIds.length > 0) {
        const { data } = await supabase
          .from('meetings')
          .select('id,title,date_time,status,meeting_url,client_name,department,project_name,product_id,product_name')
          .in('id', partIds)
          .gte('date_time', range.from + 'T00:00:00')
          .lte('date_time', range.to + 'T23:59:59');
        participated = data || [];
      }
      const { data: created = [] } = await supabase
        .from('meetings')
        .select('id,title,date_time,status,meeting_url,client_name,department,project_name,product_id,product_name')
        .eq('created_by', user!.id)
        .gte('date_time', range.from + 'T00:00:00')
        .lte('date_time', range.to + 'T23:59:59');

      const map = new Map<string, any>();
      for (const m of [...participated, ...(created || [])]) map.set(m.id, m);
      return Array.from(map.values());
    },
  });

  // 3. Sales actions (campaign + enrollment open) — visible to all
  const salesQ = useQuery({
    queryKey: ['my-agenda-sales', range.from, range.to],
    queryFn: async () => {
      const { data } = await supabase
        .from('commercial_sales_actions')
        .select('id,action_name,start_date,end_date,enrollment_open_date,product_id,product,status')
        .or(
          `and(start_date.gte.${range.from},start_date.lte.${range.to}),` +
          `and(end_date.gte.${range.from},end_date.lte.${range.to}),` +
          `and(enrollment_open_date.gte.${range.from},enrollment_open_date.lte.${range.to})`
        );
      return data || [];
    },
  });

  // Merge into the shape AgendaCalendarView expects (mirrors src/pages/Agenda.tsx)
  const allEvents = useMemo<AgendaEvent[]>(() => {
    const out: any[] = [];

    for (const e of eventsQ.data || []) out.push(e);

    for (const m of meetingsQ.data || []) {
      out.push({
        id: `meeting_${m.id}`,
        _isMeeting: true,
        _meetingId: m.id,
        title: `📹 ${m.title}`,
        event_type_id: null,
        start_date: m.date_time,
        end_date: null,
        product_name: m.product_name || null,
        product_id: m.product_id || null,
        department: m.department || null,
        client_name: m.client_name || null,
        notes: m.project_name ? `Projeto: ${m.project_name}` : null,
        created_by: null,
        recurrence_type: null,
        recurrence_end: null,
        meeting_url: m.meeting_url || null,
      });
    }

    for (const a of salesQ.data || []) {
      if (a.start_date) {
        out.push({
          id: `sales_${a.id}`,
          _isSalesAction: true,
          _salesActionId: a.id,
          title: `📣 ${a.action_name}`,
          event_type_id: null,
          start_date: `${a.start_date}T09:00:00`,
          end_date: a.end_date ? `${a.end_date}T18:00:00` : null,
          product_name: a.product || null,
          product_id: a.product_id || null,
          department: 'comercial',
          client_name: null,
          notes: null,
          created_by: null,
          recurrence_type: null,
          recurrence_end: null,
          meeting_url: null,
        });
      }
      if (a.enrollment_open_date) {
        out.push({
          id: `sales_open_${a.id}`,
          _isSalesAction: true,
          _salesActionId: a.id,
          title: `🚪 Abertura: ${a.action_name}`,
          event_type_id: null,
          start_date: `${a.enrollment_open_date}T09:00:00`,
          end_date: null,
          product_name: a.product || null,
          product_id: a.product_id || null,
          department: 'comercial',
          client_name: null,
          notes: null,
          created_by: null,
          recurrence_type: null,
          recurrence_end: null,
          meeting_url: null,
        });
      }
    }

    // Global context (Off, Datas Especiais, holidays)
    out.push(...(globalContext || []));

    // Apply product-colour override (product colour wins over type colour)
    return out.map(ev => {
      const pid = ev.product_id as string | null | undefined;
      const productName = ev.product_name as string | null | undefined;
      const productC = getProductColorFromMap(productColors, pid, productName);
      const isSales = ev._isSalesAction;
      const fallback = isSales ? SALES_ACTION_PSEUDO_COLOR : undefined;
      const c = productC ?? fallback;
      if (!c) return ev;
      return { ...ev, _color: c };
    }) as AgendaEvent[];
  }, [eventsQ.data, meetingsQ.data, salesQ.data, globalContext, productColors]);

  // Expand recurring events around the cursor (same window as Agenda.tsx)
  const expandedEvents = useMemo(() => {
    const rangeStart = subMonths(cursor, 6);
    const rangeEnd = addMonths(cursor, 18);
    return expandRecurringEvents(allEvents as any, rangeStart, rangeEnd) as AgendaEvent[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvents, cursor.getFullYear(), cursor.getMonth()]);

  // Sidebar items (same composition as Agenda.tsx so it looks/feels the same)
  const typeItems: CalendarItem[] = useMemo(() => {
    const items: CalendarItem[] = (types || []).map(t => ({ id: `type:${t.id}`, label: t.name, color: t.color }));
    items.push({ id: 'meta:meeting',  label: 'Reuniões',         color: MEETING_PSEUDO_COLOR });
    items.push({ id: 'meta:sales',    label: 'Campanhas vendas', color: SALES_ACTION_PSEUDO_COLOR });
    items.push({ id: 'meta:feriado',  label: 'Feriados PT',      color: 'hsl(var(--destructive))' });
    return items;
  }, [types]);

  const productItems: CalendarItem[] = useMemo(
    () => productBrands.map(p => ({ id: `product:${p.id}`, label: p.name, color: p.color })),
    [productBrands],
  );

  const isEventVisible = (ev: any, isVisible: (id: string) => boolean) => {
    let typeKey: string | null = null;
    if (ev._isMeeting) typeKey = 'meta:meeting';
    else if (ev._isSalesAction) typeKey = 'meta:sales';
    else if (ev.event_type_id) typeKey = `type:${ev.event_type_id}`;
    if (typeKey && !isVisible(typeKey)) return false;
    const pid = ev.product_id as string | null | undefined;
    if (pid && !isVisible(`product:${pid}`)) return false;
    return true;
  };

  return {
    events: expandedEvents,
    types,
    typeItems,
    productItems,
    isEventVisible,
    isLoading: eventsQ.isLoading || meetingsQ.isLoading,
  };
}