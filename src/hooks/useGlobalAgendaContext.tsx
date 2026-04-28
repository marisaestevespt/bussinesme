import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addMonths, parseISO } from 'date-fns';
import type { AgendaEvent } from '@/components/agenda/AppleCalendarViews';
import type { Tables } from '@/integrations/supabase/types';

type GlobalEventRow = Pick<
  Tables<'events'>,
  'id' | 'title' | 'start_date' | 'end_date' | 'event_type_id' | 'product_id' | 'product_name'
>;

/**
 * Loads "global context" events that should be visible on every personal
 * agenda regardless of participation: business closure (Off), holidays
 * (already rendered separately as overlay) and special dates.
 *
 * Returns AgendaEvent-compatible items so personal views can append them
 * to their own list without mapping logic.
 */
export function useGlobalAgendaContext() {
  return useQuery({
    queryKey: ['global-agenda-context'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AgendaEvent[]> => {
      const from = format(addMonths(new Date(), -2), 'yyyy-MM-dd');
      const to = format(addMonths(new Date(), 12), 'yyyy-MM-dd');

      const { data: types } = await supabase
        .from('event_types')
        .select('id, slug, name, color')
        .in('slug', ['off', 'data_especial']);
      if (!types?.length) return [];

      const typeMap = new Map(types.map(t => [t.id, t]));
      const ids = types.map(t => t.id);

      const { data: events } = await supabase
        .from('events')
        .select('id, title, start_date, end_date, event_type_id, product_id, product_name')
        .in('event_type_id', ids)
        .gte('start_date', from + 'T00:00:00')
        .lte('start_date', to + 'T23:59:59');

      return ((events ?? []) as GlobalEventRow[]).map((e) => {
        const t = typeMap.get(e.event_type_id);
        const ev: AgendaEvent & {
          _color?: string;
          _source?: string;
          _globalSlug?: string;
          _originalId?: string;
          _productId?: string | null;
        } = {
          id: `global-${e.id}`,
          title: e.title,
          event_type_id: e.event_type_id,
          start_date: e.start_date,
          end_date: e.end_date ?? e.start_date,
          product_name: e.product_name ?? null,
          department: null,
          client_name: null,
          notes: null,
          created_by: null,
          recurrence_type: null,
          recurrence_end: null,
          meeting_url: null,
          _color: t?.color,
          _source: 'global',
          _globalSlug: t?.slug,
          _originalId: e.id,
          _productId: e.product_id ?? null,
        };
        return ev;
      });
    },
  });
}