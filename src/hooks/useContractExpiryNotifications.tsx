import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { addDays, differenceInDays, format } from 'date-fns';

/**
 * Checks for contracts expiring within 30 days and creates notifications
 * for the owner. Runs once per session to avoid duplicates.
 */
export function useContractExpiryNotifications() {
  const { user } = useAuth();

  const { data: expiringContracts } = useQuery({
    queryKey: ['contract-expiry-check'],
    queryFn: async () => {
      const now = new Date();
      const thirtyDaysAhead = format(addDays(now, 30), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('member_contracts')
        .select('id, end_date, team_members(full_name)')
        .eq('status', 'ativo')
        .not('end_date', 'is', null)
        .lte('end_date', thirtyDaysAhead)
        .order('end_date');
      return (data || []) as any[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 60, // 1 hour - don't re-check too often
  });

  useEffect(() => {
    if (!user || !expiringContracts || expiringContracts.length === 0) return;

    const createNotifications = async () => {
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');

      for (const contract of expiringContracts) {
        const daysLeft = differenceInDays(new Date(contract.end_date), now);
        const memberName = contract.team_members?.full_name || 'Membro';
        const notifKey = `contract-expiry-${contract.id}-${todayStr}`;

        // Check if we already sent this notification today
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'contract_expiry')
          .like('message', `%${contract.id}%`)
          .gte('created_at', todayStr)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const title = daysLeft <= 0
          ? `⚠️ Contrato de ${memberName} expirou`
          : daysLeft <= 7
            ? `🔴 Contrato de ${memberName} expira em ${daysLeft} dias`
            : `🟡 Contrato de ${memberName} expira em ${daysLeft} dias`;

        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'contract_expiry',
          title,
          message: `Contract ID: ${contract.id} — Fim: ${contract.end_date}`,
          link: '/hub/pessoas',
        });
      }
    };

    createNotifications();
  }, [user, expiringContracts]);
}
