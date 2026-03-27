import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SubTableMutations {
  productId: string | undefined;
  productName: string | undefined;
  invalidateKeys: string[][];
}

export function useProductSubTables({ productId, productName, invalidateKeys }: SubTableMutations) {
  const qc = useQueryClient();

  const invalidateSub = () => {
    for (const key of invalidateKeys) {
      qc.invalidateQueries({ queryKey: key });
    }
  };

  const addRow = useMutation({
    mutationFn: async ({ table, data }: { table: string; data: Record<string, unknown> }) => {
      const { error } = await supabase.from(table as 'clients').insert(data as never);
      if (error) throw error;
    },
    onSuccess: invalidateSub,
    onError: () => toast.error('Erro ao adicionar registo'),
  });

  const updateRow = useMutation({
    mutationFn: async ({ table, id, data }: { table: string; id: string; data: Record<string, unknown> }) => {
      const { error } = await supabase.from(table as 'clients').update(data as never).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateSub,
  });

  const deleteRow = useMutation({
    mutationFn: async ({ table, id }: { table: string; id: string }) => {
      const { error } = await supabase.from(table as 'clients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateSub,
  });

  return { addRow, updateRow, deleteRow, invalidateSub };
}
