import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

export type BrainDumpStatus = 'em_ideia' | 'aplicado' | 'desconsiderado';

export interface BrainDumpCategory {
  id: string;
  name: string;
  color: string;
}

export interface BrainDumpItem {
  id: string;
  task: string;
  notes: string | null;
  status: BrainDumpStatus;
  category_id: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export const BRAIN_DUMP_STATUS_LABEL: Record<BrainDumpStatus, string> = {
  em_ideia: 'Em ideia',
  aplicado: 'Aplicado',
  desconsiderado: 'Desconsiderado',
};

export function useBrainDump() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['brain-dump'] });
    qc.invalidateQueries({ queryKey: ['executive', 'braindump'] });
  };
  const invalidateCats = () => qc.invalidateQueries({ queryKey: ['brain-dump-categories'] });

  const items = useQuery({
    queryKey: ['brain-dump', 'items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('executive_brain_dump')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as BrainDumpItem[];
    },
    staleTime: 60 * 1000,
  });

  const categories = useQuery({
    queryKey: ['brain-dump-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('executive_brain_dump_categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as BrainDumpCategory[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const addItem = useMutation({
    mutationFn: async (payload: { task: string; category_id?: string | null }) => {
      const task = payload.task.trim();
      if (!task) throw new Error('Ideia obrigatória');
      if (task.length > 500) throw new Error('Ideia demasiado longa (máx. 500 caracteres)');
      const { error } = await supabase.from('executive_brain_dump').insert({
        task,
        category_id: payload.category_id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<BrainDumpItem> & { id: string }) => {
      if (patch.task !== undefined) {
        const t = (patch.task || '').trim();
        if (!t) throw new Error('Ideia não pode estar vazia');
        if (t.length > 500) throw new Error('Ideia demasiado longa');
        patch.task = t;
      }
      if (patch.notes !== undefined && patch.notes !== null && patch.notes.length > 5000) {
        throw new Error('Notas demasiado longas (máx. 5000 caracteres)');
      }
      const { error } = await supabase.from('executive_brain_dump').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('executive_brain_dump').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const addCategory = useMutation({
    mutationFn: async (payload: { name: string; color?: string }) => {
      const name = payload.name.trim();
      if (!name) throw new Error('Nome obrigatório');
      if (name.length > 60) throw new Error('Nome demasiado longo');
      const { error } = await supabase
        .from('executive_brain_dump_categories')
        .insert({ name, color: payload.color || '#94a3b8' });
      if (error) throw error;
    },
    onSuccess: invalidateCats,
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; name?: string; color?: string }) => {
      if (patch.name !== undefined) {
        const n = patch.name.trim();
        if (!n) throw new Error('Nome obrigatório');
        if (n.length > 60) throw new Error('Nome demasiado longo');
        patch.name = n;
      }
      const { error } = await supabase
        .from('executive_brain_dump_categories')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCats();
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('executive_brain_dump_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCats();
      invalidate();
    },
  });

  return {
    items,
    categories,
    addItem,
    updateItem,
    deleteItem,
    addCategory,
    updateCategory,
    deleteCategory,
  };
}