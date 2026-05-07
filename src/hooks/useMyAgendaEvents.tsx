import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { getProductColorFromMap, useProductColors, useProductBrands } from '@/hooks/useProductColors';
import { useGlobalAgendaContext } from '@/hooks/useGlobalAgendaContext';
import type { AgendaEvent, AgendaEventType } from '@/components/agenda/AppleCalendarViews';
import type { CalendarItem } from '@/components/agenda/AgendaCalendarsSidebar';
import { useAutoCalendarLabels } from '@/hooks/useAutoCalendarLabels';
import { expandRecurringEvents } from '@/lib/expandRecurringEvents';
import { addMonths, subMonths } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

const MEETING_PSEUDO_COLOR = '#8B5CF6';
const SALES_ACTION_PSEUDO_COLOR = '#F59E0B';

type EventRow = Tables<'events'>;
type MeetingLite = Pick<
  Tables<'meetings'>,
  'id' | 'title' | 'date_time' | 'status' | 'meeting_url' | 'client_name' | 'department' | 'project_name' | 'product_id' | 'product_name'
>;
type SalesActionLite = Pick<
  Tables<'commercial_sales_actions'>,
  'id' | 'action_name' | 'start_date' | 'end_date' | 'enrollment_open_date' | 'product_id' | 'product' | 'status'
>;

/**
 * Personal version of the business Agenda data pipeline. Produces the same
 * shape (events tagged with _isMeeting / _isSalesAction, product colour
 * overrides, recurring expansion) but filtered to events the current user
 * created or participates in. The output is meant to feed AgendaCalendarView
 * so the personal calendar looks identical to the business one.
 */
export function useMyAgendaEvents(range: { from: string; to: string }, cursor: Date) {
  const { user } = useAuth();
  const { impersonating } = useImpersonation();
  // When impersonating, treat the impersonated member as the "current user" for
  // all agenda/meeting filters. We must NEVER fall back to the real owner's
  // identity here, otherwise the owner's events leak into the impersonated view.
  const effectiveUserId = impersonating ? (impersonating.user_id ?? null) : (user?.id ?? null);
  const impersonatedProfileId = impersonating?.profile_id ?? null;

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
  const { labels: autoLabels } = useAutoCalendarLabels();

  // Resolve profile.id once
  const profileQ = useQuery({
    queryKey: ['my-profile-id', effectiveUserId, impersonatedProfileId],
    enabled: !!effectiveUserId || !!impersonatedProfileId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      if (impersonatedProfileId) return impersonatedProfileId;
      if (!effectiveUserId) return null;
      const { data } = await supabase.from('profiles').select('id').eq('user_id', effectiveUserId!).maybeSingle();
      return data?.id as string | null;
    },
  });
  const profileId = profileQ.data;

  // 1. Events the user created or is a participant of
  const eventsQ = useQuery({
    queryKey: ['my-agenda-events', effectiveUserId, profileId, range.from, range.to],
    enabled: !!profileId,
    queryFn: async () => {
      const profileIds = [effectiveUserId, profileId].filter(Boolean) as string[];
      const { data: parts } = await supabase
        .from('event_members')
        .select('event_id')
        .in('profile_id', profileIds);
      const partIds = parts?.map(p => p.event_id) || [];

      const inRange = <T extends { or: (filter: string) => T }>(q: T): T => q.or(
        `and(start_date.gte.${range.from},start_date.lte.${range.to}),and(end_date.gte.${range.from},end_date.lte.${range.to}),and(start_date.lte.${range.from},end_date.gte.${range.to}),and(recurrence_type.not.is.null,start_date.lte.${range.to})`
      );

      let created: EventRow[] = [];
      if (effectiveUserId) {
        const { data } = await inRange(
          supabase.from('events').select('*').eq('created_by', effectiveUserId)
        );
        created = (data || []) as EventRow[];
      }
      let participant: EventRow[] = [];
      if (partIds.length > 0) {
        const { data } = await inRange(
          supabase.from('events').select('*').in('id', partIds)
        );
        participant = (data || []) as EventRow[];
      }
      const map = new Map<string, EventRow>();
      for (const ev of [...created, ...participant]) map.set(ev.id, ev);
      return Array.from(map.values());
    },
  });

  // 2. Meetings where the user is a participant or creator
  const meetingsQ = useQuery({
    queryKey: ['my-agenda-meetings', effectiveUserId, profileId, range.from, range.to],
    enabled: !!profileId,
    queryFn: async () => {
      const profileIds = [effectiveUserId, profileId].filter(Boolean) as string[];
      const { data: parts } = await supabase
        .from('meeting_participants')
        .select('meeting_id')
        .in('profile_id', profileIds);
      const partIds = Array.from(new Set((parts || []).map(p => p.meeting_id)));

      let participated: MeetingLite[] = [];
      if (partIds.length > 0) {
        const { data } = await supabase
          .from('meetings')
          .select('id,title,date_time,status,meeting_url,client_name,department,project_name,product_id,product_name')
          .in('id', partIds)
          .gte('date_time', range.from + 'T00:00:00')
          .lte('date_time', range.to + 'T23:59:59');
        participated = (data || []) as MeetingLite[];
      }
      let created: MeetingLite[] = [];
      if (effectiveUserId) {
        const { data } = await supabase
          .from('meetings')
          .select('id,title,date_time,status,meeting_url,client_name,department,project_name,product_id,product_name')
          .eq('created_by', effectiveUserId)
          .gte('date_time', range.from + 'T00:00:00')
          .lte('date_time', range.to + 'T23:59:59');
        created = (data || []) as MeetingLite[];
      }

      const map = new Map<string, MeetingLite>();
      for (const m of [...participated, ...created]) map.set(m.id, m);
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
    const out: AgendaEvent[] = [];

    for (const e of eventsQ.data || []) out.push(e as unknown as AgendaEvent);

    for (const m of (meetingsQ.data || []) as MeetingLite[]) {
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
      } as unknown as AgendaEvent);
    }

    for (const a of (salesQ.data || []) as SalesActionLite[]) {
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
        } as unknown as AgendaEvent);
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
        } as unknown as AgendaEvent);
      }
    }

    // Global context (Off, Datas Especiais, holidays)
    out.push(...((globalContext || []) as unknown as AgendaEvent[]));

    // Apply product-colour override (product colour wins over type colour)
    return out.map(ev => {
      const e = ev as AgendaEvent & {
        product_id?: string | null;
        product_name?: string | null;
        _isSalesAction?: boolean;
      };
      const pid = e.product_id;
      const productName = e.product_name;
      const productC = getProductColorFromMap(productColors, pid, productName);
      const isSales = e._isSalesAction;
      const fallback = isSales ? SALES_ACTION_PSEUDO_COLOR : undefined;
      const c = productC ?? fallback;
      if (!c) return ev;
      return { ...ev, _color: c };
    });
  }, [eventsQ.data, meetingsQ.data, salesQ.data, globalContext, productColors]);

  // Expand recurring events around the cursor (same window as Agenda.tsx)
  const expandedEvents = useMemo(() => {
    const rangeStart = subMonths(cursor, 6);
    const rangeEnd = addMonths(cursor, 18);
    return expandRecurringEvents(allEvents as unknown as Parameters<typeof expandRecurringEvents>[0], rangeStart, rangeEnd) as unknown as AgendaEvent[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvents, cursor.getFullYear(), cursor.getMonth()]);

  // Sidebar items (same composition as Agenda.tsx so it looks/feels the same)
  const typeItems: CalendarItem[] = useMemo(() => {
    return (types || []).map(t => ({ id: `type:${t.id}`, label: t.name, color: t.color }));
  }, [types]);

  // Calendários automáticos (gerados pelo sistema, não editáveis)
  const autoTypeItems: CalendarItem[] = useMemo(() => ([
    { id: 'meta:meeting',  label: autoLabels.meeting, color: MEETING_PSEUDO_COLOR },
    { id: 'meta:sales',    label: autoLabels.sales,   color: SALES_ACTION_PSEUDO_COLOR },
    { id: 'meta:feriado',  label: autoLabels.feriado, color: 'hsl(var(--destructive))' },
  ]), [autoLabels]);

  const productItems: CalendarItem[] = useMemo(
    () => productBrands.map(p => ({ id: `product:${p.id}`, label: p.name, color: p.color })),
    [productBrands],
  );

  const isEventVisible = (ev: AgendaEvent, isVisible: (id: string) => boolean) => {
    const e = ev as AgendaEvent & {
      _isMeeting?: boolean;
      _isSalesAction?: boolean;
      event_type_id?: string | null;
      product_id?: string | null;
    };
    let typeKey: string | null = null;
    if (e._isMeeting) typeKey = 'meta:meeting';
    else if (e._isSalesAction) typeKey = 'meta:sales';
    else if (e.event_type_id) typeKey = `type:${e.event_type_id}`;
    if (typeKey && !isVisible(typeKey)) return false;
    const pid = e.product_id;
    if (pid && !isVisible(`product:${pid}`)) return false;
    return true;
  };

  return {
    events: expandedEvents,
    types,
    typeItems,
    autoTypeItems,
    productItems,
    isEventVisible,
    isLoading: eventsQ.isLoading || meetingsQ.isLoading,
  };
}