import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseISO, isWithinInterval, startOfDay, endOfDay, format, addMonths } from 'date-fns';

export interface OffRange { start: Date; end: Date; title: string; }

/**
 * Loads "Off" events (negócio fechado) from the events table within a generous
 * window. Used to warn users (soft) when they try to schedule tasks/meetings
 * during global off periods.
 */
export function useOffDates() {
  return useQuery({
    queryKey: ['off-dates'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<OffRange[]> => {
      // Look 6 months back / 18 months ahead — enough for any practical input
      const from = format(addMonths(new Date(), -6), 'yyyy-MM-dd');
      const to = format(addMonths(new Date(), 18), 'yyyy-MM-dd');
      const { data: typeRow } = await supabase
        .from('event_types').select('id').eq('slug', 'off').maybeSingle();
      if (!typeRow?.id) return [];
      const { data } = await supabase
        .from('events')
        .select('title,start_date,end_date')
        .eq('event_type_id', typeRow.id)
        .gte('start_date', from + 'T00:00:00')
        .lte('start_date', to + 'T23:59:59');
      return (data ?? []).map(e => ({
        title: e.title,
        start: startOfDay(parseISO(e.start_date)),
        end: endOfDay(e.end_date ? parseISO(e.end_date) : parseISO(e.start_date)),
      }));
    },
  });
}

/** Returns the matching Off range if the date falls inside one. */
export function findOffRange(ranges: OffRange[] | undefined, date: Date | string | null | undefined): OffRange | null {
  if (!ranges || !date) return null;
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isNaN(d.getTime())) return null;
  return ranges.find(r => isWithinInterval(d, { start: r.start, end: r.end })) ?? null;
}
