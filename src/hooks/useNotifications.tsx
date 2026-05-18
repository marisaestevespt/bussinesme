import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const notifications = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, type, title, message, link, read, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 60 * 1000,
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
      await requireConfirm();
      await supabase.from('notifications').delete().eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', user?.id] }),
  });

  const unreadCount = (notifications.data || []).filter(n => !n.read).length;

  return { notifications: notifications.data || [], unreadCount, markAsRead, markAllRead, deleteNotification };
}

/** Helper to send a notification to a specific user.
 *  userId can be either an auth user_id or a profile.id — we resolve it. */
export async function sendNotification(params: {
  userId: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
}) {
  // Resolve: if the id is a profile.id, get the actual auth user_id
  let authUserId = params.userId;
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('id', params.userId)
    .maybeSingle();
  if (profile?.user_id) {
    authUserId = profile.user_id;
  }

  // Use SECURITY DEFINER RPC so we can notify other users without
  // granting blanket cross-user INSERT privileges on the table.
  await supabase.rpc('send_notification_to_user', {
    _user_id: authUserId,
    _type: params.type,
    _title: params.title,
    _message: params.message || null,
    _link: params.link || null,
  });
}

/** Extract @mentions from text and notify mentioned users */
export async function notifyMentions(text: string, authorId: string, context: string, link?: string) {
  // Mentions are stored as @Full Name
  const mentionRegex = /@([A-Za-zÀ-ÖØ-öø-ÿ]+(?:\s[A-Za-zÀ-ÖØ-öø-ÿ]+)*)/g;
  const names = new Set<string>();
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    names.add(match[1].trim());
  }
  if (names.size === 0) return;

  // Look up user IDs from profile names
  const { data: profiles } = await supabase.from('profiles').select('user_id, full_name');
  if (!profiles) return;

  for (const name of names) {
    const profile = profiles.find(p => p.full_name === name);
    if (profile && profile.user_id !== authorId) {
      await sendNotification({
        userId: profile.user_id,
        type: 'mention',
        title: `Foste mencionado(a): ${context}`,
        link,
      });
    }
  }
}
