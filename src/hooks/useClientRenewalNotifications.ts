import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { addDays, differenceInDays, format } from 'date-fns';

/**
 * Checks for client contracts/cycles expiring within 30 days
 * and creates notifications at 30 days, 15 days, and on the day.
 * Runs once per session (staleTime = 1h).
 */
export function useClientRenewalNotifications() {
  const { user } = useAuth();

  const { data: renewalClients } = useQuery({
    queryKey: ['client-renewal-check'],
    queryFn: async () => {
      const now = new Date();
      const thirtyDaysAhead = format(addDays(now, 31), 'yyyy-MM-dd');
      const todayStr = format(now, 'yyyy-MM-dd');
      const { data } = await supabase
        .from('clients')
        .select('id, full_name, end_of_cycle, current_product')
        .in('status', ['ativo', 'em onboarding'])
        .not('end_of_cycle', 'is', null)
        .lte('end_of_cycle', thirtyDaysAhead)
        .gte('end_of_cycle', todayStr)
        .order('end_of_cycle');
      return data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 60,
  });

  useEffect(() => {
    if (!user || !renewalClients || renewalClients.length === 0) return;

    const createNotifications = async () => {
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');

      for (const client of renewalClients) {
        if (!client.end_of_cycle) continue;
        const daysLeft = differenceInDays(new Date(client.end_of_cycle), now);

        // Only notify at specific thresholds: 30, 15, 7, 0 days
        const thresholds = [30, 15, 7, 0];
        const matchedThreshold = thresholds.find(t => daysLeft === t);
        if (matchedThreshold === undefined) continue;

        const notifKey = `client-renewal-${client.id}-${matchedThreshold}-${todayStr}`;

        // Dedup check
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'client_renewal')
          .eq('message', notifKey)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const emoji = daysLeft <= 0 ? '⚠️' : daysLeft <= 7 ? '🔴' : daysLeft <= 15 ? '🟡' : '📅';
        const title = daysLeft <= 0
          ? `${emoji} Ciclo de ${client.full_name} termina hoje`
          : `${emoji} Ciclo de ${client.full_name} termina em ${daysLeft} dias`;

        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'client_renewal',
          title,
          message: notifKey,
          link: `/hub/clientes/${client.id}`,
        });
      }
    };

    createNotifications();
  }, [user, renewalClients]);
}
