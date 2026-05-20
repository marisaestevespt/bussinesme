import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DepartmentKpi {
  id: string;
  department: string;
  name: string;
  description: string | null;
  unit: string | null;
  target_value: number | null;
  current_value: number | null;
  value_source: string;
  source_filter: Record<string, unknown> | null;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
  last_updated_at: string | null;
}

export function useDepartmentKpis(department?: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['department_kpis', department || 'all'],
    queryFn: async () => {
      let q = supabase.from('department_kpis' as never).select('*').eq('is_active', true).order('sort_order', { ascending: true });
      if (department) q = q.eq('department', department);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as DepartmentKpi[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (kpi: Partial<DepartmentKpi> & { department: string; name: string }) => {
      const payload: Record<string, unknown> = { ...kpi };
      if (kpi.id) {
        payload.last_updated_at = new Date().toISOString();
        const { error } = await supabase.from('department_kpis' as never).update(payload as never).eq('id', kpi.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('department_kpis' as never).insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['department_kpis'] });
      toast.success('KPI guardado');
    },
    onError: (e: unknown) => toast.error((e as Error).message || 'Erro ao guardar KPI'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('department_kpis' as never).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['department_kpis'] });
      toast.success('KPI removido');
    },
  });

  return { ...query, upsert, remove, list: query.data || [] };
}