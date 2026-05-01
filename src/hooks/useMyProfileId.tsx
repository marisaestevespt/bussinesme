import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Devolve o profile.id do utilizador autenticado.
 * Use SEMPRE este hook (e nunca user.id) ao filtrar por colunas
 * tipo tasks.assigned_to ou content_items.assigned_to, que apontam
 * para profiles(id) e não para auth.users(id).
 */
export function useMyProfileId() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-profile-id', user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      return (data?.id as string | null) ?? null;
    },
  });
}