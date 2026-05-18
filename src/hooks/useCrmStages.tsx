import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

export interface CrmStage {
  id: string;
  value: string;
  label: string;
  sort_order: number;
  is_default: boolean;
}

const QUERY_KEY = ['crm-custom-stages'];

export function useCrmStages() {
  const qc = useQueryClient();

  const { data: stages = [], ...rest } = useQuery<CrmStage[]>({
    queryKey: QUERY_KEY,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_custom_stages')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return (data || []) as CrmStage[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QUERY_KEY });

  const addStage = useMutation({
    mutationFn: async ({ value, label }: { value: string; label: string }) => {
      const maxOrder = stages.length > 0 ? Math.max(...stages.map(s => s.sort_order)) : -1;
      // Insert before 'ganho' and 'perdido' — find their sort_orders
      const ganhoStage = stages.find(s => s.value === 'ganho');
      const sortOrder = ganhoStage ? ganhoStage.sort_order : maxOrder + 1;

      // Shift ganho and perdido up — batched via upsert
      if (ganhoStage) {
        const toShift = stages.filter(s => s.sort_order >= sortOrder);
        if (toShift.length > 0) {
          const { error: shiftErr } = await supabase
            .from('crm_custom_stages')
            .upsert(
              toShift.map(s => ({ ...s, sort_order: s.sort_order + 1 })),
              { onConflict: 'id' }
            );
          if (shiftErr) throw shiftErr;
        }
      }

      const { error } = await supabase.from('crm_custom_stages').insert({
        value: value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
        label,
        sort_order: sortOrder,
        is_default: false,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Etapa adicionada'); },
    onError: () => toast.error('Erro ao adicionar etapa'),
  });

  const removeStage = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('crm_custom_stages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Etapa removida'); },
    onError: () => toast.error('Erro ao remover etapa'),
  });

  const renameStage = useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const { error } = await supabase.from('crm_custom_stages').update({ label }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error('Erro ao renomear etapa'),
  });

  const activeStages = stages.filter(s => s.value !== 'ganho' && s.value !== 'perdido');

  return { stages, activeStages, addStage, removeStage, renameStage, isLoading: rest.isLoading };
}
