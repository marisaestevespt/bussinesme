import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type ViewScope = 'today' | 'week' | 'tasks';
export type ViewLayout = 'table' | 'list' | 'board';
export type ViewColumn = 'task' | 'status' | 'priority' | 'deadline' | 'project';
export type ViewGroupBy = 'none' | 'status' | 'priority' | 'project' | 'deadline';
export type ViewSort =
  | 'deadline_asc' | 'deadline_desc'
  | 'priority_desc' | 'priority_asc'
  | 'name_asc' | 'name_desc'
  | 'recent';

export interface ViewFilters {
  search?: string;
  statuses?: string[];               // task status values
  priorities?: string[];             // 'alta' | 'media' | 'baixa'
  projectIds?: string[];
  deadlineWindow?: 'overdue' | 'today' | 'week' | 'no_deadline' | 'all';
  completion?: 'all' | 'pending' | 'done';
}

export interface CustomView {
  id: string;
  user_id: string;
  scope: ViewScope;
  name: string;
  layout: ViewLayout;
  columns: ViewColumn[];
  filters: ViewFilters;
  group_by: ViewGroupBy;
  sort_by: ViewSort;
  sort_order: number;
}

export const ALL_COLUMNS: { key: ViewColumn; label: string }[] = [
  { key: 'task', label: 'Tarefa' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Prioridade' },
  { key: 'deadline', label: 'Data Limite' },
  { key: 'project', label: 'Projeto' },
];

export const DEFAULT_COLUMNS: ViewColumn[] = ['task', 'status', 'priority', 'deadline', 'project'];

export function useSecretariaCustomViews(scope: ViewScope) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['secretaria-custom-views', user?.id, scope],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('secretaria_custom_views')
        .select('*')
        .eq('user_id', user!.id)
        .eq('scope', scope)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as CustomView[];
    },
  });

  const create = useMutation({
    mutationFn: async (v: Omit<CustomView, 'id' | 'user_id' | 'sort_order'> & { sort_order?: number }) => {
      const payload = {
        user_id: user!.id,
        scope,
        name: v.name,
        layout: v.layout,
        columns: v.columns as any,
        filters: v.filters as any,
        group_by: v.group_by,
        sort_by: v.sort_by,
        sort_order: v.sort_order ?? (list.data?.length ?? 0),
      };
      const { data, error } = await supabase
        .from('secretaria_custom_views')
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CustomView;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['secretaria-custom-views', user?.id, scope] });
      toast.success('Vista criada');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar vista'),
  });

  const update = useMutation({
    mutationFn: async (v: Partial<CustomView> & { id: string }) => {
      const { id, ...rest } = v;
      const { error } = await supabase
        .from('secretaria_custom_views')
        .update(rest as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['secretaria-custom-views', user?.id, scope] });
      toast.success('Vista atualizada');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao atualizar vista'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('secretaria_custom_views').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['secretaria-custom-views', user?.id, scope] });
      toast.success('Vista removida');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao remover vista'),
  });

  return { views: list.data || [], isLoading: list.isLoading, create, update, remove };
}