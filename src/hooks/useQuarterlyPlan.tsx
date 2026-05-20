import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type QuarterStr = 'T1' | 'T2' | 'T3' | 'T4';
export type QuarterItemKind = 'priority' | 'risk' | 'milestone' | 'learning';

export interface QuarterlyPlan {
  id: string;
  area: string;
  year: number;
  quarter: QuarterStr;
  theme: string | null;
  retrospective: string | null;
  capacity_notes: string | null;
  financial_notes: string | null;
}

export interface QuarterlyItem {
  id: string;
  area: string;
  year: number;
  quarter: QuarterStr;
  kind: QuarterItemKind;
  title: string;
  description: string | null;
  severity: string | null;
  mitigation: string | null;
  due_date: string | null;
  status: string;
  sort_order: number;
}

export function useQuarterlyPlan(year: number, quarter: QuarterStr) {
  const qc = useQueryClient();

  const plans = useQuery({
    queryKey: ['quarterly_plans', year, quarter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quarterly_plans' as never)
        .select('*')
        .eq('year', year)
        .eq('quarter', quarter);
      if (error) throw error;
      return (data || []) as unknown as QuarterlyPlan[];
    },
  });

  const items = useQuery({
    queryKey: ['quarterly_items', year, quarter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quarterly_items' as never)
        .select('*')
        .eq('year', year)
        .eq('quarter', quarter)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as QuarterlyItem[];
    },
  });

  const upsertPlan = useMutation({
    mutationFn: async (p: Partial<QuarterlyPlan> & { area: string; year: number; quarter: QuarterStr }) => {
      const { error } = await supabase
        .from('quarterly_plans' as never)
        .upsert(p as never, { onConflict: 'area,year,quarter' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quarterly_plans'] }); },
    onError: (e: unknown) => toast.error((e as Error).message || 'Erro a guardar plano'),
  });

  const upsertItem = useMutation({
    mutationFn: async (i: Partial<QuarterlyItem> & { area: string; year: number; quarter: QuarterStr; kind: QuarterItemKind; title: string }) => {
      if (i.id) {
        const { error } = await supabase.from('quarterly_items' as never).update(i as never).eq('id', i.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('quarterly_items' as never).insert(i as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quarterly_items'] }); },
    onError: (e: unknown) => toast.error((e as Error).message || 'Erro a guardar item'),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quarterly_items' as never).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quarterly_items'] }); },
  });

  return {
    plans: plans.data || [],
    items: items.data || [],
    isLoading: plans.isLoading || items.isLoading,
    upsertPlan,
    upsertItem,
    removeItem,
  };
}

/** Helper: shift quarter by N (forward or back). Handles year wrap. */
export function shiftQuarter(year: number, quarter: QuarterStr, delta: number): { year: number; quarter: QuarterStr } {
  const map = { T1: 0, T2: 1, T3: 2, T4: 3 } as const;
  const labels: QuarterStr[] = ['T1', 'T2', 'T3', 'T4'];
  const idx = map[quarter] + delta;
  const wrapYear = year + Math.floor(idx / 4);
  const wrapIdx = ((idx % 4) + 4) % 4;
  return { year: wrapYear, quarter: labels[wrapIdx] };
}