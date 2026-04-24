import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Subscription {
  id: string;
  platform_name: string;
  category: string;
  value: number;
  periodicity: string;
  monthly_equivalent: number;
  location: string;
  start_date: string | null;
  renewal_date: string | null;
  status: string;
  notes: string | null;
  vat_rate: number;
  includes_vat: boolean;
  nif: string | null;
  country: string | null;
  supplier_id: string | null;
  documents: any;
  created_at: string;
  updated_at: string;
}

const PERIOD_FACTOR: Record<string, number> = {
  semanal: 52 / 12,
  mensal: 1,
  bimestral: 1 / 2,
  trimestral: 1 / 3,
  semestral: 1 / 6,
  anual: 1 / 12,
};

export function calcMonthlyEquivalent(value: number, periodicity: string): number {
  return Math.round(value * (PERIOD_FACTOR[periodicity] || 1) * 100) / 100;
}

export function useSubscriptions() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['financial_subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_subscriptions')
        .select('*')
        .order('platform_name', { ascending: true });
      if (error) throw error;
      return (data || []) as Subscription[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: Partial<Subscription> & { id?: string }) => {
      const monthly = calcMonthlyEquivalent(Number(payload.value || 0), payload.periodicity || 'mensal');
      const row = { ...payload, monthly_equivalent: monthly };
      if (payload.id) {
        const { error } = await supabase.from('financial_subscriptions').update(row as any).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('financial_subscriptions').insert(row as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial_subscriptions'] });
      toast.success('Subscrição guardada');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('financial_subscriptions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial_subscriptions'] });
      toast.success('Subscrição eliminada');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  return { list, upsert, remove };
}