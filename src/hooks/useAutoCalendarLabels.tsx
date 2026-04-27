import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AutoCalendarKey = 'meeting' | 'sales' | 'feriado';

export interface AutoCalendarLabels {
  meeting: string;
  sales: string;
  feriado: string;
}

export const DEFAULT_AUTO_LABELS: AutoCalendarLabels = {
  meeting: 'Reuniões',
  sales: 'Campanhas vendas',
  feriado: 'Feriados PT',
};

/**
 * Reads/writes the editable display names of the *automatic* calendars.
 * The internal IDs (`meta:meeting`, `meta:sales`, `meta:feriado`) NEVER change —
 * only the visible label is configurable. This guarantees that filters,
 * data sources (meetings, commercial_sales_actions, holidays) and visibility
 * logic keep working regardless of what the user names them.
 */
export function useAutoCalendarLabels() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['auto_calendar_labels'],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<AutoCalendarLabels> => {
      const { data } = await supabase
        .from('business_settings')
        .select('auto_calendar_labels')
        .limit(1)
        .maybeSingle();
      const raw = (data as any)?.auto_calendar_labels || {};
      return {
        meeting: raw.meeting || DEFAULT_AUTO_LABELS.meeting,
        sales: raw.sales || DEFAULT_AUTO_LABELS.sales,
        feriado: raw.feriado || DEFAULT_AUTO_LABELS.feriado,
      };
    },
  });

  const update = useMutation({
    mutationFn: async ({ key, value }: { key: AutoCalendarKey; value: string }) => {
      const trimmed = (value || '').trim() || DEFAULT_AUTO_LABELS[key];
      const current = query.data || DEFAULT_AUTO_LABELS;
      const next = { ...current, [key]: trimmed };
      const { data: row } = await supabase
        .from('business_settings')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (!row?.id) throw new Error('business_settings row missing');
      const { error } = await supabase
        .from('business_settings')
        .update({ auto_calendar_labels: next as any })
        .eq('id', row.id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData(['auto_calendar_labels'], next);
      toast.success('Nome atualizado');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao atualizar nome'),
  });

  return {
    labels: query.data || DEFAULT_AUTO_LABELS,
    isLoading: query.isLoading,
    rename: (key: AutoCalendarKey, value: string) => update.mutate({ key, value }),
  };
}