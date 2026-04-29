import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

const CACHE_OPTS = {
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
} as const;

/**
 * Consolidated system notifications hook.
 * Checks for overdue lead follow-ups and creates daily notifications.
 * Runs with aggressive caching to avoid N+1 on every navigation.
 */
export function useSystemNotifications() {
  const { user } = useAuth();

  const { data: overdueLeads } = useQuery({
    queryKey: ['system-notif-leads'],
    queryFn: async () => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('crm_leads')
        .select('id, name, next_followup, status, potential_product')
        .not('status', 'in', '("ganho","perdido")')
        .not('next_followup', 'is', null)
        .lte('next_followup', todayStr)
        .order('next_followup');
      return data || [];
    },
    enabled: !!user,
    ...CACHE_OPTS,
  });

  useEffect(() => {
    if (!user || !overdueLeads || overdueLeads.length === 0) return;

    const createNotifications = async () => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      for (const lead of overdueLeads) {
        const notifKey = `lead-followup-${lead.id}-${todayStr}`;

        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'lead_followup')
          .eq('dedup_key', notifKey)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const isToday = lead.next_followup === todayStr;
        const emoji = isToday ? '📞' : '🔔';
        const title = isToday
          ? `${emoji} Follow-up de ${lead.name} é hoje`
          : `${emoji} Follow-up de ${lead.name} está em atraso`;

        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'lead_followup',
          title,
          dedup_key: notifKey,
          link: '/hub/comercial/crm',
        } as any);
      }
    };

    createNotifications();
  }, [user, overdueLeads]);
}
