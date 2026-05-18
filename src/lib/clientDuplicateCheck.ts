import { supabase } from '@/integrations/supabase/client';
import { confirmDestructive } from '@/lib/confirmDestructive';

type Hit = { id: string; full_name: string; status: string | null };

/**
 * Verifica se já existe(m) cliente(s) com o mesmo NIF ou email.
 * Não bloqueia — apenas avisa o utilizador antes de inserir.
 *
 * Devolve `true` se for seguro avançar (sem duplicados, ou utilizador confirmou).
 * Devolve `false` se o utilizador cancelar.
 */
export async function confirmNoClientDuplicates(opts: {
  nif?: string | null;
  email?: string | null;
  excludeId?: string;
}): Promise<boolean> {
  const nif = opts.nif?.trim();
  const email = opts.email?.trim().toLowerCase();

  const lines: string[] = [];

  if (nif) {
    let q = supabase.from('clients').select('id, full_name, status').eq('nif', nif);
    if (opts.excludeId) q = q.neq('id', opts.excludeId);
    const { data } = await q;
    const hits = (data || []) as Hit[];
    const active = hits.filter(h => h.status !== 'terminado');
    const terminated = hits.filter(h => h.status === 'terminado');
    if (active.length > 0) {
      lines.push(`NIF ${nif} já existe em cliente ativo: ${active.map(h => h.full_name).join(', ')}.`);
    } else if (terminated.length > 0) {
      lines.push(`NIF ${nif} pertenceu a cliente terminado: ${terminated.map(h => h.full_name).join(', ')}. Considera reactivar em vez de criar novo.`);
    }
  }

  if (email) {
    let q = supabase.from('clients').select('id, full_name, status').ilike('email', email);
    if (opts.excludeId) q = q.neq('id', opts.excludeId);
    const { data } = await q;
    const hits = (data || []) as Hit[];
    if (hits.length > 0) {
      lines.push(`Email ${email} já está associado a: ${hits.map(h => h.full_name).join(', ')}.`);
    }
  }

  if (lines.length === 0) return true;

  return confirmDestructive({
    title: 'Possível cliente duplicado',
    description: `${lines.join('\n\n')}\n\nQueres mesmo criar um novo registo?`,
    confirmText: 'Criar mesmo assim',
    cancelText: 'Cancelar',
  });
}