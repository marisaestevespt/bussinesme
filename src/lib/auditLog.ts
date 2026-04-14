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
    await supabase.rpc('log_audit_entry', {
      _action: action,
      _entity_type: entityType,
      _entity_id: entityId ?? null,
      _metadata: (metadata ?? {}) as any,
    });
  } catch {
    // Silently fail — audit should never break the app
  }
}
