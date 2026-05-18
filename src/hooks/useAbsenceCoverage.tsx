import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, isWithinInterval, parseISO, isBefore, isAfter, startOfDay } from 'date-fns';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

export type AbsenceCoverage = {
  id: string;
  member_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  substitute_id: string | null;
  sos_notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export function useAbsenceCoverage() {
  const qc = useQueryClient();

  const coverages = useQuery({
    queryKey: ['absence-coverage'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('absence_coverage')
        .select('*')
        .order('start_date', { ascending: true });
      if (error) throw error;
      return (data || []) as AbsenceCoverage[];
    },
  });

  const upsertCoverage = useMutation({
    mutationFn: async (
      payload: (TablesInsert<'absence_coverage'> | TablesUpdate<'absence_coverage'>) & { id?: string },
    ) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase
          .from('absence_coverage')
          .update(rest as TablesUpdate<'absence_coverage'>)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('absence_coverage')
          .insert([payload as TablesInsert<'absence_coverage'>]);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['absence-coverage'] }),
  });

  const deleteCoverage = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('absence_coverage').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['absence-coverage'] }),
  });

  return { coverages: coverages.data || [], isLoading: coverages.isLoading, upsertCoverage, deleteCoverage };
}

/** Compute status based on dates vs today */
export function computeAbsenceStatus(startDate: string, endDate: string): string {
  const today = startOfDay(new Date());
  const s = parseISO(startDate);
  const e = parseISO(endDate);
  if (isAfter(s, today)) return 'agendada';
  if (isBefore(e, today)) return 'terminada';
  return 'ativa';
}

/** Find active coverage for a member on a specific date */
export function findCoverageForMemberOnDate(
  coverages: AbsenceCoverage[],
  memberProfileId: string,
  date: string,
  teamMembers: { id: string; profile_id: string | null }[]
): AbsenceCoverage | null {
  const d = parseISO(date);
  // Map profile_id -> team_member_id
  const tm = teamMembers.find(m => m.profile_id === memberProfileId);
  if (!tm) return null;

  return coverages.find(c => {
    if (c.member_id !== tm.id) return false;
    try {
      return isWithinInterval(d, { start: parseISO(c.start_date), end: parseISO(c.end_date) });
    } catch { return false; }
  }) || null;
}
