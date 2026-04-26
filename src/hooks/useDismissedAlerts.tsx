import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { startOfDay } from 'date-fns';
import { toast } from 'sonner';

/**
 * Manages "tratado" state for CEO Cockpit alerts.
 * Each alert has a stable key + a daily signature so that stale dismissals
 * are auto-cleared when the underlying numbers change.
 */
export function useDismissedAlerts() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['dismissed-ceo-alerts', user?.id],
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dismissed_ceo_alerts')
        .select('alert_key, dismissed_at')
        .eq('user_id', user!.id);
      if (error) throw error;
      return data || [];
    },
  });

  const dismiss = useMutation({
    mutationFn: async (alertKey: string) => {
      if (!user?.id) throw new Error('Sem sessão');
      const { error } = await supabase
        .from('dismissed_ceo_alerts')
        .upsert({ user_id: user.id, alert_key: alertKey, dismissed_at: new Date().toISOString() }, { onConflict: 'user_id,alert_key' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dismissed-ceo-alerts'] });
      toast.success('Alerta marcado como tratado');
    },
    onError: () => toast.error('Não foi possível marcar como tratado'),
  });

  const restore = useMutation({
    mutationFn: async (alertKey: string) => {
      if (!user?.id) throw new Error('Sem sessão');
      const { error } = await supabase
        .from('dismissed_ceo_alerts')
        .delete()
        .eq('user_id', user.id)
        .eq('alert_key', alertKey);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dismissed-ceo-alerts'] });
      toast.success('Alerta reposto');
    },
  });

  // A dismissal is "fresh" only for today — any new day re-surfaces alerts.
  const todayStart = startOfDay(new Date()).getTime();
  const dismissedKeys = new Set(
    (query.data || [])
      .filter(d => new Date(d.dismissed_at).getTime() >= todayStart)
      .map(d => d.alert_key)
  );

  return {
    dismissedKeys,
    isDismissed: (key: string) => dismissedKeys.has(key),
    dismiss: (key: string) => dismiss.mutate(key),
    restore: (key: string) => restore.mutate(key),
    isLoading: query.isLoading,
  };
}
