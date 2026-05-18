import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

export interface CrmLabel {
  id: string;
  name: string;
  color: string;
  pipeline_id: string | null;
}

export function useCrmLabels() {
  const qc = useQueryClient();

  const { data: labels = [] } = useQuery<CrmLabel[]>({
    queryKey: ['crm-labels'],
    queryFn: async () => {
      const { data } = await supabase.from('crm_labels').select('*').order('name');
      return (data || []) as CrmLabel[];
    },
  });

  const { data: leadLabelsMap = {} } = useQuery<Record<string, string[]>>({
    queryKey: ['crm-lead-labels'],
    queryFn: async () => {
      const { data } = await supabase.from('crm_lead_labels').select('lead_id, label_id');
      const map: Record<string, string[]> = {};
      (data || []).forEach((r) => {
        if (!map[r.lead_id]) map[r.lead_id] = [];
        map[r.lead_id].push(r.label_id);
      });
      return map;
    },
  });

  const createLabel = useMutation({
    mutationFn: async (label: { name: string; color: string; pipeline_id?: string | null }) => {
      const { error } = await supabase.from('crm_labels').insert(label);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-labels'] }),
  });

  const deleteLabel = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('crm_labels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-labels'] });
      qc.invalidateQueries({ queryKey: ['crm-lead-labels'] });
    },
  });

  const toggleLeadLabel = useMutation({
    mutationFn: async ({ leadId, labelId, active }: { leadId: string; labelId: string; active: boolean }) => {
      if (active) {
        const { error } = await supabase.from('crm_lead_labels').insert({ lead_id: leadId, label_id: labelId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('crm_lead_labels').delete().eq('lead_id', leadId).eq('label_id', labelId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-lead-labels'] }),
  });

  return { labels, leadLabelsMap, createLabel, deleteLabel, toggleLeadLabel };
}
