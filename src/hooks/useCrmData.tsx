import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMemo } from 'react';

function cleanPayload(obj: Record<string, any>): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    cleaned[k] = v === '' ? null : v;
  }
  return cleaned;
}

export const CRM_STATUSES = [
  { value: 'lead', label: 'Lead' },
  { value: 'primeiro_contacto', label: 'Primeiro Contacto' },
  { value: 'sessao_agendada', label: 'Sessão Agendada' },
  { value: 'proposta_enviada', label: 'Proposta Enviada' },
  { value: 'follow_up_1', label: 'Follow Up 1' },
  { value: 'follow_up_2', label: 'Follow Up 2' },
  { value: 'follow_up_3', label: 'Follow Up 3' },
  { value: 'aguarda_retorno', label: 'Aguarda Retorno' },
  { value: 'outra_altura', label: 'Outra Altura' },
  { value: 'ganho', label: 'Ganho' },
  { value: 'perdido', label: 'Perdido' },
] as const;

export const CRM_SOURCES = [
  'Lead Magnet', 'Instagram', 'Recomendação', 'Sessão de Diagnóstico', 'Orgânico', 'Outro',
];

export const INTERACTION_TYPES = [
  { value: 'email', label: 'Email' },
  { value: 'chamada', label: 'Chamada' },
  { value: 'mensagem', label: 'Mensagem' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'outro', label: 'Outro' },
];

const ACTIVE_STATUSES: string[] = CRM_STATUSES.filter(s => s.value !== 'ganho' && s.value !== 'perdido').map(s => s.value);

export function statusLabel(val: string) {
  return CRM_STATUSES.find(s => s.value === val)?.label || val;
}

export type FollowUpState = 'overdue' | 'today' | 'soon' | 'normal' | 'none';

export function getFollowUpState(dateStr: string | null | undefined): FollowUpState {
  if (!dateStr) return 'none';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 3) return 'soon';
  return 'normal';
}

export function useCrmData() {
  const qc = useQueryClient();
  const key = ['crm'];

  const leads = useQuery({
    queryKey: [...key, 'leads'],
    queryFn: async () => {
      const { data } = await supabase.from('crm_leads').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const upsertLead = useMutation({
    mutationFn: async (raw: any) => {
      const lead = cleanPayload(raw);
      if (lead.id) {
        const { error } = await supabase.from('crm_leads').update(lead as any).eq('id', lead.id);
        if (error) throw error;
      } else {
        delete lead.id;
        const { error } = await supabase.from('crm_leads').insert(lead as any);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: () => toast.error('Erro ao guardar lead'),
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_leads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Interactions for a specific lead
  const useLeadInteractions = (leadId: string | null) => useQuery({
    queryKey: [...key, 'interactions', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data } = await supabase.from('crm_interactions').select('*').eq('lead_id', leadId).order('interaction_date', { ascending: false });
      return data || [];
    },
    enabled: !!leadId,
  });

  const upsertInteraction = useMutation({
    mutationFn: async (rec: any) => {
      if (rec.id) {
        const { error } = await supabase.from('crm_interactions').update(rec).eq('id', rec.id);
        if (error) throw error;
      } else {
        delete rec.id;
        const { error } = await supabase.from('crm_interactions').insert(rec);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: () => toast.error('Erro ao guardar interação'),
  });

  const deleteInteraction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_interactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Lead actions (checklist)
  const useLeadActions = (leadId: string | null) => useQuery({
    queryKey: [...key, 'actions', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data } = await supabase.from('crm_lead_actions').select('*').eq('lead_id', leadId).order('created_at');
      return data || [];
    },
    enabled: !!leadId,
  });

  const upsertLeadAction = useMutation({
    mutationFn: async (rec: any) => {
      if (rec.id) {
        const { error } = await supabase.from('crm_lead_actions').update(rec).eq('id', rec.id);
        if (error) throw error;
      } else {
        delete rec.id;
        const { error } = await supabase.from('crm_lead_actions').insert(rec);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: () => toast.error('Erro ao guardar ação'),
  });

  const deleteLeadAction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_lead_actions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Computed
  const allLeads = leads.data || [];
  const activeLeads = useMemo(() => allLeads.filter(l => ACTIVE_STATUSES.includes(l.status)), [allLeads]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const leadsToContact = useMemo(() =>
    activeLeads.filter(l => l.next_followup && l.next_followup <= todayStr),
    [activeLeads, todayStr]
  );

  const pipelineValue = useMemo(() =>
    activeLeads.reduce((s, l) => s + Number(l.estimated_value || 0), 0),
    [activeLeads]
  );

  const winsThisMonth = useMemo(() =>
    allLeads.filter(l => l.status === 'ganho' && l.updated_at &&
      new Date(l.updated_at).getMonth() === currentMonth &&
      new Date(l.updated_at).getFullYear() === currentYear
    ).length,
    [allLeads, currentMonth, currentYear]
  );

  return {
    leads, allLeads, activeLeads, leadsToContact, pipelineValue, winsThisMonth,
    upsertLead, deleteLead,
    useLeadInteractions, upsertInteraction, deleteInteraction,
    useLeadActions, upsertLeadAction, deleteLeadAction,
    invalidate,
  };
}
