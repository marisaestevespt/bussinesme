import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export interface PASection {
  id: string;
  section_key: string;
  title: string;
  subtitle: string | null;
  nav_group: string;
  sort_order: number;
  content: Json;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ['publico-alvo-sections'];

export function usePublicoAlvoSections() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('publico_alvo_sections')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as PASection[];
    },
  });
}

export function useUpdateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { id: string } & Partial<Pick<PASection, 'title' | 'subtitle' | 'content' | 'nav_group' | 'sort_order'>>) => {
      const { id, ...rest } = patch;
      const { error } = await supabase
        .from('publico_alvo_sections')
        .update(rest as TablesUpdate<'publico_alvo_sections'>)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('publico_alvo_sections')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useAddSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (section: { section_key: string; title: string; subtitle?: string; nav_group: string; sort_order: number; content: Json }) => {
      const { error } = await supabase
        .from('publico_alvo_sections')
        .insert(section as TablesInsert<'publico_alvo_sections'>);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
