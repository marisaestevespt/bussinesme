import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

export interface DefaultView {
  key: string;
  label: string;
  icon?: React.ReactNode;
  isDefault: true;
}

export interface UserView {
  id: string;
  key: string;
  label: string;
  filter_config: Record<string, any>;
  isDefault: false;
}

export type AnyView = DefaultView | UserView;

export function useUserViews(pageKey: string, defaultViews: DefaultView[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: customViews = [] } = useQuery({
    queryKey: ['user_views', pageKey, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_views')
        .select('*')
        .eq('user_id', user.id)
        .eq('page_key', pageKey)
        .order('sort_order');
      if (error) throw error;
      return (data || []).map(v => ({
        id: v.id,
        key: `custom_${v.id}`,
        label: v.label,
        filter_config: (v.filter_config || {}) as Record<string, any>,
        isDefault: false as const,
      }));
    },
    enabled: !!user,
  });

  const addView = useMutation({
    mutationFn: async (label: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('user_views').insert({
        user_id: user.id,
        page_key: pageKey,
        label,
        filter_config: {},
        sort_order: customViews.length,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user_views', pageKey] }),
  });

  const renameView = useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const { error } = await supabase.from('user_views').update({ label }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user_views', pageKey] }),
  });

  const deleteView = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('user_views').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user_views', pageKey] }),
  });

  const updateViewConfig = useMutation({
    mutationFn: async ({ id, config }: { id: string; config: Record<string, any> }) => {
      const { error } = await supabase.from('user_views').update({ filter_config: config }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user_views', pageKey] }),
  });

  const allViews: AnyView[] = [...defaultViews, ...customViews];

  return {
    allViews,
    customViews,
    defaultViews,
    addView: addView.mutate,
    renameView: renameView.mutate,
    deleteView: deleteView.mutate,
    updateViewConfig: updateViewConfig.mutate,
  };
}
