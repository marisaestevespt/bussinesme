import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const notifications = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['notifications', user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', user?.id] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase.from('notifications').update({ read: true }).eq('user_id', user!.id).eq('read', false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', user?.id] }),
  });

  const deleteNotification = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').delete().eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', user?.id] }),
  });

  const unreadCount = (notifications.data || []).filter(n => !n.read).length;

  return { notifications: notifications.data || [], unreadCount, markAsRead, markAllRead, deleteNotification };
}

/** Helper to send a notification to a specific user */
export async function sendNotification(params: {
  userId: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
}) {
  await supabase.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message || null,
    link: params.link || null,
  });
}
