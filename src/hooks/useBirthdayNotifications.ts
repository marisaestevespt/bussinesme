import { supabase } from '@/integrations/supabase/client';

/**
 * On app boot, check if today is the birthday of any active client.
 * If so, create a notification for the owner (if not already sent this year).
 */
export async function checkBirthdayNotifications() {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const year = today.getFullYear();

  // Find owner user_id
  const { data: ownerRole } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();

  if (!ownerRole) return;

  const ownerId = ownerRole.user_id;

  // Get active clients with a birthday set
  const { data: clients } = await supabase
    .from('clients')
    .select('id, full_name, birthday')
    .in('status', ['ativo', 'em onboarding'])
    .not('birthday', 'is', null);

  if (!clients || clients.length === 0) return;

  // Filter clients whose birthday matches today
  const birthdayClients = clients.filter(c => {
    if (!c.birthday) return false;
    const bd = new Date(c.birthday + 'T00:00:00');
    return bd.getMonth() + 1 === month && bd.getDate() === day;
  });

  if (birthdayClients.length === 0) return;

  // Check which notifications already exist for this year
  const titles = birthdayClients.map(c => `Hoje é o aniversário de ${c.full_name}!`);
  const { data: existing } = await supabase
    .from('notifications')
    .select('title')
    .eq('user_id', ownerId)
    .eq('type', 'birthday')
    .gte('created_at', `${year}-01-01`)
    .in('title', titles);

  const existingTitles = new Set((existing || []).map(n => n.title));

  const toInsert = birthdayClients
    .filter(c => !existingTitles.has(`Hoje é o aniversário de ${c.full_name}!`))
    .map(c => ({
      user_id: ownerId,
      type: 'birthday',
      title: `Hoje é o aniversário de ${c.full_name}!`,
      link: `/hub/clientes/${c.id}`,
    }));

  if (toInsert.length > 0) {
    await supabase.from('notifications').insert(toInsert);
  }
}
