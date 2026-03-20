import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface CustomView {
  id: string;
  view_name: string;
  filters: Record<string, any>;
  visible_columns: string[];
  sort_config: Record<string, any>;
  is_default: boolean;
}

export function useCustomViews(pageKey: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ['custom_views', pageKey, user?.id];

  const { data: views = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('custom_views')
        .select('*')
        .eq('created_by', user.id)
        .eq('page_key', pageKey)
        .order('created_at');
      if (error) throw error;
      return (data || []).map(v => ({
        id: v.id,
        view_name: v.view_name,
        filters: (v.filters || {}) as Record<string, any>,
        visible_columns: v.visible_columns || [],
        sort_config: (v.sort_config || {}) as Record<string, any>,
        is_default: v.is_default || false,
      })) as CustomView[];
    },
    enabled: !!user,
  });

  const saveView = useMutation({
    mutationFn: async (view: Omit<CustomView, 'id'> & { id?: string }) => {
      if (!user) throw new Error('Not authenticated');
      if (view.id) {
        const { error } = await supabase.from('custom_views').update({
          view_name: view.view_name,
          filters: view.filters as any,
          visible_columns: view.visible_columns,
          sort_config: view.sort_config as any,
          is_default: view.is_default,
        }).eq('id', view.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('custom_views').insert({
          created_by: user.id,
          page_key: pageKey,
          view_name: view.view_name,
          filters: view.filters as any,
          visible_columns: view.visible_columns,
          sort_config: view.sort_config as any,
          is_default: view.is_default,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const deleteView = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custom_views').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return { views, saveView, deleteView };
}
