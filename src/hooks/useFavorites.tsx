import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Favorite {
  id: string;
  page_path: string;
  page_title: string;
  page_icon: string;
}

export function useFavorites() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: favorites = [] } = useQuery({
    queryKey: ['user-favorites', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('user_favorites')
        .select('id, page_path, page_title, page_icon')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      return (data || []) as Favorite[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const isFavorite = (path: string) => favorites.some(f => f.page_path === path);

  const toggleFavorite = useMutation({
    mutationFn: async ({ path, title, icon }: { path: string; title: string; icon: string }) => {
      if (!user?.id) return;
      const existing = favorites.find(f => f.page_path === path);
      if (existing) {
        await supabase.from('user_favorites').delete().eq('id', existing.id);
      } else {
        await supabase.from('user_favorites').insert({
          user_id: user.id,
          page_path: path,
          page_title: title,
          page_icon: icon,
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-favorites'] }),
    onError: () => toast.error('Erro ao atualizar favoritos'),
  });

  return { favorites, isFavorite, toggleFavorite };
}
