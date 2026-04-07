import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, differenceInDays } from 'date-fns';
import { statusLabel, CRM_STATUSES } from '@/hooks/useCrmData';

interface Props {
  leadId: string | null;
  onClose: () => void;
}

export function LeadPreviewDialog({ leadId, onClose }: Props) {
  const { data: lead } = useQuery({
    queryKey: ['crm-lead-preview', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const { data } = await supabase.from('crm_leads').select('*').eq('id', leadId).maybeSingle();
      return data;
    },
    enabled: !!leadId,
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ['crm-lead-preview-interactions', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data } = await supabase.from('crm_interactions').select('*').eq('lead_id', leadId).order('interaction_date', { ascending: false });
      return data || [];
    },
    enabled: !!leadId,
  });

  if (!lead) return null;

  const createdAt = lead.created_at ? parseISO(lead.created_at) : null;
  const updatedAt = lead.updated_at ? parseISO(lead.updated_at) : null;
  const daysInCrm = createdAt && updatedAt ? differenceInDays(updatedAt, createdAt) : null;

  return (
    <Dialog open={!!leadId} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Ficha CRM — {lead.name}
            <Badge variant="outline">{statusLabel(lead.status)}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome" value={lead.name} />
            <Field label="Email" value={lead.email} />
            <Field label="Telefone" value={lead.phone} />
            <Field label="Fonte" value={lead.source} />
            <Field label="Produto Potencial" value={lead.potential_product} />
            <Field label="Produto Fechado" value={lead.closed_product} />
            <Field label="Valor Estimado" value={lead.estimated_value ? `${lead.estimated_value}€` : null} />
            <Field label="Entrada no CRM" value={createdAt ? format(createdAt, 'dd/MM/yyyy') : null} />
            <Field label="Última atualização" value={updatedAt ? format(updatedAt, 'dd/MM/yyyy') : null} />
            <Field label="Tempo no CRM" value={daysInCrm !== null ? `${daysInCrm} dia(s)` : null} />
          </div>

          {lead.context && (
            <div>
              <span className="text-xs text-muted-foreground font-medium">Contexto</span>
              <p className="mt-0.5 whitespace-pre-wrap">{lead.context}</p>
            </div>
          )}

          {lead.followup_notes && (
            <div>
              <span className="text-xs text-muted-foreground font-medium">Notas de Follow-up</span>
              <p className="mt-0.5 whitespace-pre-wrap">{lead.followup_notes}</p>
            </div>
          )}

          {lead.lost_reason && (
            <div>
              <span className="text-xs text-muted-foreground font-medium">Motivo de Perda</span>
              <p className="mt-0.5">{lead.lost_reason}</p>
            </div>
          )}

          {/* Interactions */}
          {interactions.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground font-medium">Interações ({interactions.length})</span>
              <div className="mt-1 space-y-2">
                {interactions.map(i => (
                  <div key={i.id} className="rounded-md border p-2 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="secondary" className="text-[10px]">{i.interaction_type}</Badge>
                      <span className="text-muted-foreground">
                        {i.interaction_date ? format(parseISO(i.interaction_date), 'dd/MM/yyyy') : '—'}
                      </span>
                    </div>
                    {i.notes && <p className="whitespace-pre-wrap">{i.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="font-medium">{value}</p>
    </div>
  );
}
