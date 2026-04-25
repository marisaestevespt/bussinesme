import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProductColors } from '@/hooks/useProductColors';
import { useGlobalAgendaContext } from '@/hooks/useGlobalAgendaContext';
import type { AgendaEvent, AgendaEventType } from '@/components/agenda/AppleCalendarViews';
import { getPortugueseHolidays } from '@/lib/holidays';
import { format } from 'date-fns';

const MEETING_COLOR = '#8B5CF6';
const SALES_COLOR = '#F59E0B';
const HOLIDAY_COLOR = '#94A3B8';

/**
 * Loads the same calendar context as the global business Agenda but filtered
 * to the current user: events the user created or participates in, meetings
 * where the user is a participant, plus contextual items everyone should see
 * (sales actions, business closures, special dates, holidays).
 */
export function useMyAgendaEvents(range: { from: string; to: string }) {
  const { user } = useAuth();
  const { data: types = [] } = useQuery({
    queryKey: ['event_types'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('event_types').select('*').order('name');
      return (data || []) as Array<{ id: string; name: string; slug: string; color: string }>;
    },
  });
  const { data: productColors } = useProductColors();
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
        `and(start_date.gte.${range.from},start_date.lte.${range.to}),and(end_date.gte.${range.from},end_date.lte.${range.to}),and(start_date.lte.${range.from},end_date.gte.${range.to})`
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

  // 2. Meetings where the user is a participant
  const meetingsQ = useQuery({
    queryKey: ['my-agenda-meetings', profileId, range.from, range.to],
    enabled: !!profileId,
    queryFn: async () => {
      const { data: parts } = await supabase
        .from('meeting_participants')
        .select('meeting_id')
        .eq('profile_id', profileId!);
      const ids = parts?.map(p => p.meeting_id) || [];
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from('meetings')
        .select('id,title,date_time,status,meeting_url,client_name,department,project_name,product_id,product_name')
        .in('id', ids)
        .gte('date_time', range.from + 'T00:00:00')
        .lte('date_time', range.to + 'T23:59:59')
        .order('date_time');
      return data || [];
    },
  });

  // 3. Sales actions (campaign period + enrollment opening)
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

  const allEvents = useMemo<AgendaEvent[]>(() => {
    const colorFor = (productId: string | null | undefined, fallback: string) =>
      (productId && productColors?.get(productId)) || fallback;

    const out: AgendaEvent[] = [];

    // Events from `events` table (already typed via event_type_id)
    for (const e of eventsQ.data || []) {
      const t = types.find(t => t.id === e.event_type_id);
      out.push({
        ...e,
        _color: colorFor(e.product_id, t?.color || '#6366F1'),
      } as AgendaEvent);
    }

    // Meetings
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
        _color: colorFor(m.product_id, MEETING_COLOR),
      } as any);
    }

    // Sales actions: campaign + enrollment
    for (const a of salesQ.data || []) {
      if (a.start_date) {
        out.push({
          id: `sales_${a.id}`,
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
          _color: colorFor(a.product_id, SALES_COLOR),
        } as any);
      }
      if (a.enrollment_open_date) {
        out.push({
          id: `sales_open_${a.id}`,
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
          _color: colorFor(a.product_id, SALES_COLOR),
        } as any);
      }
    }

    // Global context (Off, Datas Especiais)
    out.push(...globalContext);

    // Holidays
    const fromYear = parseInt(range.from.slice(0, 4), 10);
    const toYear = parseInt(range.to.slice(0, 4), 10);
    for (let y = fromYear; y <= toYear; y++) {
      const holidays = getPortugueseHolidays(y);
      for (const h of holidays) {
        const dStr = format(h.date, 'yyyy-MM-dd');
        if (dStr < range.from || dStr > range.to) continue;
        out.push({
          id: `holiday_${dStr}`,
          title: `🇵🇹 ${h.name}`,
          event_type_id: null,
          start_date: `${dStr}T00:00:00`,
          end_date: `${dStr}T23:59:59`,
          product_name: null,
          department: null,
          client_name: null,
          notes: null,
          created_by: null,
          recurrence_type: null,
          recurrence_end: null,
          meeting_url: null,
          _color: HOLIDAY_COLOR,
          _isHoliday: true,
        } as any);
      }
    }

    return out;
  }, [eventsQ.data, meetingsQ.data, salesQ.data, globalContext, types, productColors, range.from, range.to]);

  // Build a "types" array compatible with AppleCalendarViews getColor() — the
  // _color override on each event already drives the color, but keep the real
  // event types so badges look right.
  const typesForViews = useMemo<AgendaEventType[]>(() => types.map(t => ({
    id: t.id, name: t.name, color: t.color, slug: t.slug,
  })), [types]);

  return { events: allEvents, types: typesForViews, isLoading: eventsQ.isLoading || meetingsQ.isLoading };
}