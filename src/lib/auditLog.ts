import { supabase } from '@/integrations/supabase/client';

/**
 * Logs an action to the audit_logs table for observability.
 * Fire-and-forget — never blocks the UI or throws errors.
 *
 * Usage:
 *   logAudit('created', 'meeting', meetingId, { title: 'Reunião X' });
 *   logAudit('deleted', 'client', clientId);
 *   logAudit('updated', 'sale', saleId, { field: 'status', oldValue: 'pending', newValue: 'paid' });
 */
export async function logAudit(
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>,
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user name from profiles (cached by react-query elsewhere, but we do a quick fetch here)
    let userName: string | null = null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle();
    userName = profile?.full_name ?? user.email ?? null;

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_name: userName,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      metadata: metadata ?? {},
    } as any);
  } catch {
    // Silently fail — audit should never break the app
  }
}
