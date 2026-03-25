import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

/**
 * Checks for CRM leads with overdue next_followup dates
 * and creates a daily notification for each.
 * Runs once per session (staleTime = 1h).
 */
export function useLeadFollowupNotifications() {
  const { user } = useAuth();

  const { data: overdueLeads } = useQuery({
    queryKey: ['lead-followup-check'],
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
    staleTime: 1000 * 60 * 60,
  });

  useEffect(() => {
    if (!user || !overdueLeads || overdueLeads.length === 0) return;

    const createNotifications = async () => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      for (const lead of overdueLeads) {
        const notifKey = `lead-followup-${lead.id}-${todayStr}`;

        // Dedup check
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'lead_followup')
          .eq('message', notifKey)
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
          message: notifKey,
          link: '/hub/comercial/crm',
        });
      }
    };

    createNotifications();
  }, [user, overdueLeads]);
}
