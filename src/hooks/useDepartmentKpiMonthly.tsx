import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DepartmentKpiMonthly {
  id: string;
  kpi_id: string;
  year: number;
  month: number;
  target_value: number | null;
  actual_value: number | null;
  analysis: string | null;
  auto_analysis: string | null;
}

export function useDepartmentKpiMonthly(year: number, kpiIds: string[]) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['department_kpi_monthly', year, kpiIds.slice().sort().join(',')],
    enabled: kpiIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('department_kpi_monthly' as never)
        .select('*')
        .eq('year', year)
        .in('kpi_id', kpiIds);
      if (error) throw error;
      return (data || []) as unknown as DepartmentKpiMonthly[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (row: Partial<DepartmentKpiMonthly> & { kpi_id: string; year: number; month: number }) => {
      // Compute auto-analysis if both values present
      let auto: string | null = null;
      const t = row.target_value;
      const a = row.actual_value;
      if (t != null && a != null && Number(t) > 0) {
        const diff = ((Number(a) - Number(t)) / Number(t)) * 100;
        const sign = diff >= 0 ? '+' : '';
        auto = diff >= 0
          ? `Acima da meta (${sign}${diff.toFixed(1)}%)`
          : `Abaixo da meta (${diff.toFixed(1)}%)`;
      }
      const payload = { ...row, auto_analysis: auto };
      const { error } = await supabase
        .from('department_kpi_monthly' as never)
        .upsert(payload as never, { onConflict: 'kpi_id,year,month' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['department_kpi_monthly'] });
    },
    onError: (e: unknown) => toast.error((e as Error).message || 'Erro ao guardar valor mensal'),
  });

  return { ...query, upsert, list: query.data || [] };
}