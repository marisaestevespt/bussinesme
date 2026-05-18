import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

export interface ModifierLevel {
  id: string;
  dimension_id: string;
  label: string;
  multiplier: number;
  sort_order: number;
}

export interface ModifierDimension {
  id: string;
  product_id: string;
  name: string;
  sort_order: number;
  levels: ModifierLevel[];
}

export function useProductModifiers(productId?: string | null) {
  const qc = useQueryClient();
  const key = ['product-modifiers', productId];

  const query = useQuery({
    queryKey: key,
    enabled: !!productId,
    queryFn: async (): Promise<ModifierDimension[]> => {
      const { data: dims, error } = await supabase
        .from('product_modifier_dimensions')
        .select('id, product_id, name, sort_order')
        .eq('product_id', productId!)
        .order('sort_order');
      if (error) throw error;
      if (!dims?.length) return [];
      const { data: levels, error: e2 } = await supabase
        .from('product_modifier_levels')
        .select('id, dimension_id, label, multiplier, sort_order')
        .in('dimension_id', dims.map(d => d.id))
        .order('sort_order');
      if (e2) throw e2;
      return dims.map(d => ({
        ...d,
        levels: (levels || []).filter(l => l.dimension_id === d.id) as ModifierLevel[],
      }));
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const addDimension = useMutation({
    mutationFn: async (name: string) => {
      const sort = query.data?.length || 0;
      const { error } = await supabase.from('product_modifier_dimensions')
        .insert({ product_id: productId!, name, sort_order: sort });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message || 'Erro'),
  });

  const updateDimension = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('product_modifier_dimensions').update({ name }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const removeDimension = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('product_modifier_dimensions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const addLevel = useMutation({
    mutationFn: async (dimensionId: string) => {
      const dim = query.data?.find(d => d.id === dimensionId);
      const sort = dim?.levels.length || 0;
      const { error } = await supabase.from('product_modifier_levels')
        .insert({ dimension_id: dimensionId, label: 'Novo nível', multiplier: 1, sort_order: sort });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateLevel = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ModifierLevel> }) => {
      const { error } = await supabase.from('product_modifier_levels').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const removeLevel = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('product_modifier_levels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { query, addDimension, updateDimension, removeDimension, addLevel, updateLevel, removeLevel };
}