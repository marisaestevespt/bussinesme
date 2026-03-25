import { supabase } from '@/integrations/supabase/client';

/**
 * Subtract N business days from a target date (Mon-Fri only).
 */
function subtractBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return result;
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * On app boot, check upcoming birthdays for clients and team members.
 * Creates notifications 30 and 15 business days before, plus on the day.
 */
export async function checkBirthdayNotifications() {
  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  const year = today.getFullYear();
  const todayStr = toDateStr(today);

  // Find owner user_id
  const { data: ownerRole } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();

  if (!ownerRole) return;
  const ownerId = ownerRole.user_id;

  // ── Clients ──
  const { data: clients } = await supabase
    .from('clients')
    .select('id, full_name, birthday')
    .in('status', ['ativo', 'em onboarding'])
    .not('birthday', 'is', null);

  // ── Team members ──
  const { data: members } = await supabase
    .from('team_members')
    .select('id, full_name, birthday')
    .eq('status', 'ativo')
    .not('birthday', 'is', null);

  const people: { name: string; birthday: string; link: string; source: string }[] = [];

  (clients || []).forEach(c => {
    if (c.birthday) people.push({ name: c.full_name, birthday: c.birthday, link: `/hub/clientes/${c.id}`, source: 'cliente' });
  });
  (members || []).forEach(m => {
    if ((m as any).birthday) people.push({ name: m.full_name, birthday: (m as any).birthday, link: '/hub/pessoas', source: 'equipa' });
  });

  if (people.length === 0) return;

  const notifications: { user_id: string; type: string; title: string; link: string; message: string }[] = [];

  for (const person of people) {
    const bd = new Date(person.birthday + 'T00:00:00');
    // This year's birthday
    const thisYearBd = new Date(year, bd.getMonth(), bd.getDate());
    // If birthday already passed this year, check next year
    const targetBd = thisYearBd < today && !(thisYearBd.getMonth() === today.getMonth() && thisYearBd.getDate() === today.getDate())
      ? new Date(year + 1, bd.getMonth(), bd.getDate())
      : thisYearBd;

    const alert30 = subtractBusinessDays(targetBd, 30);
    const alert15 = subtractBusinessDays(targetBd, 15);

    const checks = [
      { date: alert30, prefix: '📅 Faltam ~30 dias úteis para o aniversário' },
      { date: alert15, prefix: '📅 Faltam ~15 dias úteis para o aniversário' },
      { date: targetBd, prefix: '🎂 Hoje é o aniversário' },
    ];

    for (const check of checks) {
      if (toDateStr(check.date) === todayStr) {
        const label = person.source === 'cliente' ? '(cliente)' : '(equipa)';
        notifications.push({
          user_id: ownerId,
          type: 'birthday',
          title: `${check.prefix} de ${person.name} ${label}`,
          link: person.link,
          message: `birthday-${person.source}-${person.birthday}-${todayStr}`,
        });
      }
    }
  }

  if (notifications.length === 0) return;

  // Deduplicate: check which were already sent today
  const { data: existing } = await supabase
    .from('notifications')
    .select('message')
    .eq('user_id', ownerId)
    .eq('type', 'birthday')
    .gte('created_at', todayStr);

  const existingMessages = new Set((existing || []).map(n => n.message));
  const toInsert = notifications.filter(n => !existingMessages.has(n.message));

  if (toInsert.length > 0) {
    await supabase.from('notifications').insert(toInsert);
  }
}
